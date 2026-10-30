import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { ExtensionAuth, ExtensionAuthError, requireBroadcaster, requireLinkedViewer } from '../src/extension-auth.mjs';

const key = randomBytes(32), secret = key.toString('base64'), nowSeconds = 1800000000;
const extensionId = 'test-extension';
const auth = new ExtensionAuth({ extensionId, secret, now: () => nowSeconds * 1000 });
const defaultClaims = { exp: nowSeconds + 300, channel_id: '1001', opaque_user_id: 'UviewerOpaque', role: 'viewer', user_id: '8001' };
function sign(claims = {}, header = { alg: 'HS256', typ: 'JWT' }, signingKey = key) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const input = `${encode(header)}.${encode({ ...defaultClaims, ...claims })}`;
  return `${input}.${createHmac('sha256', signingKey).update(input).digest('base64url')}`;
}
const unauthorized = error => error instanceof ExtensionAuthError && error.status === 401;
const forbidden = code => error => error instanceof ExtensionAuthError && error.status === 403 && error.code === code;

test('valid linked viewers use real Twitch IDs across channel-scoped JWTs', () => {
  const a = auth.verify(sign()), b = auth.verify(sign({ channel_id: '1002' }));
  assert.deepEqual(a, { channelId: '1001', userId: '8001', opaqueUserId: 'UviewerOpaque', role: 'viewer', broadcaster: false });
  assert.equal(a.userId, b.userId); assert.notEqual(a.channelId, b.channelId);
  assert.equal(requireLinkedViewer(a), a);
  assert.equal(Object.isFrozen(a), true);
});

test('a broadcaster’s signed opaque ID safely identifies the channel owner without user_id', () => {
  const identity = auth.verify(sign({ role: 'broadcaster', opaque_user_id: 'U1001', user_id: undefined }));
  assert.equal(identity.userId, '1001'); assert.equal(identity.broadcaster, true);
  assert.equal(requireBroadcaster(identity), identity); assert.equal(requireLinkedViewer(identity), identity);
  assert.throws(() => requireBroadcaster(identity, '1002'), forbidden('broadcaster_required'));
});

test('moderators and viewers cannot acquire broadcaster rights', () => {
  const moderator = auth.verify(sign({ role: 'moderator' }));
  assert.equal(moderator.broadcaster, false); assert.equal(requireLinkedViewer(moderator), moderator);
  assert.throws(() => requireBroadcaster(moderator), forbidden('broadcaster_required'));
  assert.throws(() => auth.verify(sign({ role: 'broadcaster' })), unauthorized);
  assert.throws(() => auth.verify(sign({ role: 'broadcaster', opaque_user_id: 'U1001', user_id: '1002' })), unauthorized);
});

test('anonymous and unlinked users can read but cannot mutate viewer allegiance', () => {
  for (const claims of [
    { user_id: undefined, opaque_user_id: 'Asession123' },
    { user_id: undefined, opaque_user_id: 'UstableOpaque' },
    { is_unlinked: true },
    { is_unlinked: 'true' },
  ]) {
    const identity = auth.verify(sign(claims)); assert.equal(identity.userId, null);
    assert.throws(() => requireLinkedViewer(identity), forbidden('identity_link_required'));
  }
  assert.throws(() => auth.verify(sign({ opaque_user_id: 'Aanonymous', user_id: '8001' })), unauthorized);
});

test('expired and not-yet-valid tokens are rejected with no claim leakage', () => {
  for (const claims of [{ exp: nowSeconds }, { exp: nowSeconds - 1 }, { exp: '1800000300' }, { exp: NaN }, { nbf: nowSeconds + 1 }, { iat: nowSeconds + 60 }]) {
    assert.throws(() => auth.verify(sign(claims)), unauthorized);
  }
  assert.equal(auth.verify(sign({ nbf: nowSeconds, iat: nowSeconds })).userId, '8001');
});

test('signature tampering and tokens signed for another extension fail authentication', () => {
  const original = sign(); const segments = original.split('.');
  segments[1] = Buffer.from(JSON.stringify({ ...defaultClaims, user_id: '9999' })).toString('base64url');
  assert.throws(() => auth.verify(segments.join('.')), unauthorized);
  assert.throws(() => auth.verify(sign({}, undefined, randomBytes(32))), unauthorized);
  assert.throws(() => auth.verify(sign({ aud: 'another-extension' })), unauthorized);
  assert.throws(() => auth.verify(sign({ client_id: 'another-extension' })), unauthorized);
  assert.equal(auth.verify(sign({ aud: extensionId, client_id: extensionId })).userId, '8001');
});

test('alg=none, algorithm confusion and critical header extensions are rejected', () => {
  for (const header of [{ alg: 'none' }, { alg: 'HS384' }, { alg: 'RS256' }, { alg: 'HS256', crit: ['exp'] }, { alg: 'HS256', b64: false }, { alg: 'HS256', typ: 'OTHER' }]) {
    assert.throws(() => auth.verify(sign({}, header)), unauthorized);
  }
});

test('only native browser roles and valid channel/identity claims are accepted', () => {
  assert.throws(() => auth.verify(sign({ role: 'external' })), forbidden('invalid_extension_role'));
  for (const claims of [{ role: 'admin' }, { channel_id: 'hongshan333' }, { channel_id: 1001 }, { channel_id: '0' }, { opaque_user_id: '' }, { opaque_user_id: 'U' }, { user_id: 8001 }, { is_unlinked: 'yes' }]) {
    assert.throws(() => auth.verify(sign(claims)), unauthorized);
  }
});

test('malformed encodings and oversized tokens fail safely without including token data', () => {
  for (const token of [null, '', 'a.b.c', sign() + '.extra', 'a'.repeat(16385), sign().replace('.', '=.'), sign().replace(/.$/, '=')]) {
    assert.throws(() => auth.verify(token), error => unauthorized(error) && error.message === 'Invalid or expired Twitch Extension session. Reopen the extension to refresh authentication.');
  }
});

test('configuration validates canonical Base64 and keeps decoded secret private', () => {
  for (const invalidSecret of ['', 'not base64!', secret + '=', secret + '\n', Buffer.alloc(16).toString('base64'), 'AAAA=']) {
    assert.throws(() => new ExtensionAuth({ extensionId, secret: invalidSecret }), /SECRET/);
  }
  assert.throws(() => new ExtensionAuth({ extensionId: '', secret }), /ID/);
  const unpadded = new ExtensionAuth({ extensionId, secret: secret.replace(/=+$/, ''), now: () => nowSeconds * 1000 });
  assert.equal(unpadded.verify(sign()).userId, '8001');
  assert.equal(JSON.stringify(auth).includes(secret), false);
  assert.equal(JSON.stringify(auth).includes(key.toString('hex')), false);
});
