import { randomBytes } from 'node:crypto';
import { ExtensionAuth, ExtensionAuthError } from './extension-auth.mjs';
import { PkRooms, SandboxDirectory, SANDBOX_CHANNELS } from './pk-rooms.mjs';
import { TwitchDirectory } from './twitch-directory.mjs';
import { TwitchBridge } from './twitch.mjs';

function loopback(req) { return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress); }
function error(message, status, code) { return Object.assign(new Error(message), { status, code }); }

export class ExtensionHttp {
  constructor({ extensionId = '', extensionSecret = '', token = '', sandboxEnabled = false,
    directory, rooms, sandboxRooms, now = Date.now, onEvents = () => {}, bridgeFactory,
  } = {}) {
    this.extensionId = extensionId; this.sandboxEnabled = sandboxEnabled; this.now = now;
    this.auth = extensionId && extensionSecret ? new ExtensionAuth({ extensionId, secret: extensionSecret, now }) : null;
    this.sessions = new Map();
    this.rooms = rooms ?? new PkRooms({ directory: directory ?? new TwitchDirectory({ token, now }), now, onEvents,
      bridgeFactory: bridgeFactory ?? (token && token !== 'PASTE_NEW_TOKEN_HERE' ? () => new TwitchBridge({ token }) : null),
    });
    this.sandboxRooms = sandboxRooms ?? new PkRooms({ directory: new SandboxDirectory(), now,
      mode: 'demo', inputSource: 'local-simulation', onEvents,
    });
  }
  authenticate(req) {
    const header = req.headers.authorization ?? req.headers['x-extension-jwt'];
    const token = typeof header === 'string' ? header.replace(/^Bearer\s+/i, '') : '';
    if (token.startsWith('sandbox_')) {
      if (!this.sandboxEnabled || !loopback(req) || req.headers['x-forwarded-for'] || req.headers.forwarded) throw error('Local simulation is unavailable on this connection.', 403, 'sandbox_disabled');
      const session = this.sessions.get(token);
      if (!session || session.expiresAt <= this.now()) { this.sessions.delete(token); throw error('Simulation session expired. Reload the local simulator.', 401, 'sandbox_expired'); }
      return { identity: session.identity, rooms: this.sandboxRooms };
    }
    if (!this.auth) throw error('Twitch Extension is not configured. Set TWITCH_EXTENSION_ID and TWITCH_EXTENSION_SECRET on the backend.', 503, 'extension_not_configured');
    return { identity: this.auth.verify(token), rooms: this.rooms };
  }
  mint(req, persona) {
    if (!this.sandboxEnabled || !loopback(req) || req.headers['x-forwarded-for'] || req.headers.forwarded) throw error('The local simulator is disabled.', 403, 'sandbox_disabled');
    const personas = ['streamer-a', 'streamer-b', 'viewer-a', 'viewer-b'];
    if (!personas.includes(persona)) throw error('Unknown simulation persona.', 400, 'invalid_persona');
    for (const [key, session] of this.sessions) if (session.expiresAt <= this.now()) this.sessions.delete(key);
    if (this.sessions.size >= 64) throw error('Too many simulation screens. Restart the local sandbox to clear old sessions.', 429, 'simulation_limit');
    const channel = SANDBOX_CHANNELS[persona.endsWith('-a') ? 0 : 1];
    const broadcaster = persona.startsWith('streamer');
    const userId = broadcaster ? channel.id : persona === 'viewer-a' ? '80000001' : '80000002';
    const identity = Object.freeze({ channelId: channel.id, userId, opaqueUserId: `U${userId}`, role: broadcaster ? 'broadcaster' : 'viewer', broadcaster });
    const token = `sandbox_${randomBytes(32).toString('hex')}`;
    this.sessions.set(token, { identity, expiresAt: this.now() + 3600000 });
    return { token, identity, inputSource: 'local-simulation' };
  }
  health() { return { service: 'chatcrossfire', ok: true, extensionConfigured: Boolean(this.auth), sandboxEnabled: this.sandboxEnabled }; }
  async handle(req, res, { path, readBody, send }) {
    if (path === '/api/health' && req.method === 'GET') { send(res, 200, this.health()); return true; }
    if (path === '/api/sandbox/session' && req.method === 'POST') {
      const { persona } = await readBody(req); send(res, 200, { ...this.mint(req, persona), backendOrigin: `http://${req.headers.host}` }); return true;
    }
    if (!path.startsWith('/api/extension/')) return false;
    if (req.method === 'GET' && path === '/api/extension/state') {
      const auth = this.authenticate(req); send(res, 200, auth.rooms.state(auth.identity)); return true;
    }
    if (req.method !== 'POST') { send(res, 405, { error: 'Use GET for state or POST for actions.' }); return true; }
    const auth = this.authenticate(req), input = await readBody(req);
    let state;
    if (path === '/api/extension/invite') state = await auth.rooms.invite(auth.identity, input);
    else if (path === '/api/extension/action') state = auth.rooms.action(auth.identity, input);
    else if (path === '/api/extension/play') state = auth.rooms.play(auth.identity, input);
    else { send(res, 404, { error: 'Extension endpoint not found.' }); return true; }
    send(res, 200, state); return true;
  }
  tick() { this.rooms.tick(); if (this.sandboxEnabled) this.sandboxRooms.tick(); }
  close() { this.rooms.close(); this.sandboxRooms.close(); this.sessions.clear(); }
}

export { ExtensionAuthError };
