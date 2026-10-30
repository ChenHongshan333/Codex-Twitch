import { createHmac, timingSafeEqual } from 'node:crypto';

// Twitch Extension JWTs are scoped to an Extension by its unique shared secret.
// https://dev.twitch.tv/docs/extensions/reference/#jwt-schema
// https://dev.twitch.tv/docs/extensions/building/#signing-the-jwt
export class ExtensionAuthError extends Error {
  constructor(message, status = 401, code = 'invalid_extension_token') {
    super(message); this.name = 'ExtensionAuthError'; this.status = status; this.code = code;
  }
}

const numericId = value => typeof value === 'string' && /^[1-9][0-9]{0,31}$/.test(value);
const opaqueId = value => typeof value === 'string' && /^[UA][A-Za-z0-9_-]{1,127}$/.test(value);
const invalid = () => new ExtensionAuthError('Invalid or expired Twitch Extension session. Reopen the extension to refresh authentication.');

function parseSegment(segment) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw invalid();
  const bytes = Buffer.from(segment, 'base64url');
  if (bytes.toString('base64url') !== segment) throw invalid();
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const object = JSON.parse(text);
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw invalid();
  return object;
}

function decodeSecret(secret) {
  if (typeof secret !== 'string' || !secret || secret !== secret.trim() || secret.length > 1024 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(secret) || secret.length % 4 === 1) {
    throw new Error('TWITCH_EXTENSION_SECRET must be the Base64-encoded Extension shared secret.');
  }
  const bytes = Buffer.from(secret, 'base64');
  if (bytes.length < 32 || bytes.length > 512 || bytes.toString('base64').replace(/=+$/, '') !== secret.replace(/=+$/, '') ||
      secret.includes('=') && secret.length % 4 !== 0) {
    throw new Error('TWITCH_EXTENSION_SECRET must decode to 32–512 secret bytes using canonical Base64.');
  }
  return bytes;
}

export class ExtensionAuth {
  #secret;
  constructor({ extensionId, secret, now = Date.now } = {}) {
    if (typeof extensionId !== 'string' || !/^[A-Za-z0-9_-]{3,128}$/.test(extensionId)) {
      throw new Error('TWITCH_EXTENSION_ID must be a valid Extension client ID.');
    }
    if (typeof now !== 'function') throw new Error('ExtensionAuth now must be a clock function.');
    this.extensionId = extensionId; this.#secret = decodeSecret(secret); this.now = now;
  }

  verify(token) {
    try {
      if (typeof token !== 'string' || token.length > 16384) throw invalid();
      const parts = token.split('.');
      if (parts.length !== 3 || !parts.every(Boolean)) throw invalid();
      const [encodedHeader, encodedPayload, signature] = parts;
      if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) throw invalid();
      const header = parseSegment(encodedHeader);
      if (header.alg !== 'HS256' || header.typ !== undefined && header.typ !== 'JWT' || header.crit !== undefined || header.b64 !== undefined) throw invalid();
      const actual = Buffer.from(signature, 'base64url');
      const expected = createHmac('sha256', this.#secret).update(`${encodedHeader}.${encodedPayload}`).digest();
      if (actual.length !== expected.length || actual.toString('base64url') !== signature || !timingSafeEqual(expected, actual)) throw invalid();
      const claims = parseSegment(encodedPayload), currentSeconds = Math.floor(this.now() / 1000);
      if (!Number.isSafeInteger(claims.exp) || claims.exp <= currentSeconds || !Number.isFinite(currentSeconds)) throw invalid();
      if (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > currentSeconds)) throw invalid();
      if (claims.iat !== undefined && (!Number.isSafeInteger(claims.iat) || claims.iat > currentSeconds + 30)) throw invalid();
      if (!numericId(claims.channel_id) || !opaqueId(claims.opaque_user_id)) throw invalid();
      if (!['broadcaster', 'moderator', 'viewer', 'external'].includes(claims.role)) throw invalid();
      if (claims.role === 'external') throw new ExtensionAuthError('Backend tokens cannot act as a Twitch viewer.', 403, 'invalid_extension_role');
      if (claims.user_id !== undefined && !numericId(claims.user_id)) throw invalid();
      // Normal Twitch JWTs omit aud/client_id. If a token supplies either, bind it too.
      if (claims.aud !== undefined && claims.aud !== this.extensionId || claims.client_id !== undefined && claims.client_id !== this.extensionId) throw invalid();
      if (claims.is_unlinked !== undefined && ![true, false, 'true', 'false'].includes(claims.is_unlinked)) throw invalid();
      const broadcaster = claims.role === 'broadcaster';
      let userId = claims.user_id ?? null;
      if (broadcaster) {
        // Twitch promises broadcaster opaque IDs are U + their real Twitch ID.
        if (claims.opaque_user_id !== `U${claims.channel_id}` || userId && userId !== claims.channel_id) throw invalid();
        userId = claims.channel_id;
      } else {
        if (claims.opaque_user_id.startsWith('A') && userId) throw invalid();
        if (claims.is_unlinked === true || claims.is_unlinked === 'true') userId = null;
      }
      return Object.freeze({ channelId: claims.channel_id, userId, opaqueUserId: claims.opaque_user_id, role: claims.role, broadcaster });
    } catch (error) {
      if (error instanceof ExtensionAuthError) throw error;
      throw invalid();
    }
  }
}

export function requireBroadcaster(identity, channelId = identity?.channelId) {
  if (!identity || !identity.broadcaster || identity.role !== 'broadcaster' || identity.userId !== identity.channelId || identity.channelId !== channelId) {
    throw new ExtensionAuthError('Only this channel’s broadcaster can perform this action.', 403, 'broadcaster_required');
  }
  return identity;
}

export function requireLinkedViewer(identity) {
  if (!identity || !numericId(identity.userId) || !identity.opaqueUserId?.startsWith('U') || !['broadcaster', 'moderator', 'viewer'].includes(identity.role)) {
    throw new ExtensionAuthError('Share your Twitch identity to join, attack or switch sides. Use the extension’s Share identity button.', 403, 'identity_link_required');
  }
  return identity;
}
