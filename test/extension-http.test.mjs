import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { request as httpRequest } from 'node:http';
import { createApp } from '../server.mjs';
import { Store } from '../src/store.mjs';

// These HS256 tokens, channel IDs, viewers and directory results are synthetic.
// The tests exercise real local HTTP requests and JWT verification, not Twitch accounts.
const CHANNELS = [
  { id: '90000001', login: 'wire_coral', name: 'WIRE CORAL' },
  { id: '90000002', login: 'wire_violet', name: 'WIRE VIOLET' },
  { id: '90000003', login: 'wire_cyan', name: 'WIRE CYAN' },
];
const EXTENSION_ID = 'syntheticwireextension';

async function fixture(t, { sandboxEnabled = false, configured = true, publicOrigin = '' } = {}) {
  let time = 1800000000000;
  const secret = randomBytes(32).toString('base64');
  const hostKey = randomBytes(24).toString('hex');
  const directory = mkdtempSync(join(tmpdir(), 'crossfire-extension-http-'));
  const mockDirectory = { async resolve({ id, login }) {
    const channel = CHANNELS.find(channel => id ? channel.id === id : channel.login === login.toLowerCase());
    if (!channel) throw new Error('Synthetic wire-test channel not found.');
    return { ...channel };
  } };
  const app = createApp({ store: new Store(directory), token: '', adminKey: hostKey, publicOrigin,
    extensionId: configured ? EXTENSION_ID : '', extensionSecret: configured ? secret : '', sandboxEnabled,
    extensionOptions: { directory: mockDirectory, now: () => time, bridgeFactory: null },
  });
  await new Promise(resolveListening => app.server.listen(0, '127.0.0.1', resolveListening));
  t.after(async () => {
    await app.close();
    const target = resolve(directory), safePrefix = resolve(tmpdir()) + sep;
    assert.ok(target.startsWith(safePrefix) && target.slice(safePrefix.length).startsWith('crossfire-extension-http-'));
    rmSync(target, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  function sign(claims, signingSecret = secret) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(time / 1000) + 3600, ...claims })).toString('base64url');
    return `${header}.${payload}.${createHmac('sha256', Buffer.from(signingSecret, 'base64')).update(`${header}.${payload}`).digest('base64url')}`;
  }
  const broadcaster = index => sign({ role: 'broadcaster', channel_id: CHANNELS[index].id, opaque_user_id: `U${CHANNELS[index].id}` });
  const viewer = (index, userId = '80000001', extra = {}) => sign({ role: 'viewer', channel_id: CHANNELS[index].id, opaque_user_id: `Uopaque${userId}`, user_id: userId, ...extra });
  async function request(path, { method = 'GET', token, body, headers = {} } = {}) {
    const response = await fetch(`${origin}${path}`, { method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const raw = await response.text();
    let value; try { value = raw ? JSON.parse(raw) : null; } catch { value = raw; }
    return { status: response.status, headers: response.headers, body: value };
  }
  const post = (path, token, body, headers) => request(path, { method: 'POST', token, body, headers });
  const state = token => request('/api/extension/state', { token });
  const action = (token, roomId, action) => post('/api/extension/action', token, { roomId, action });
  const play = (token, roomId, command) => post('/api/extension/play', token, { roomId, command });
  function advance(ms) { time += ms; app.extension.tick(); }
  async function invite() {
    const response = await post('/api/extension/invite', broadcaster(0), { targetLogin: CHANNELS[1].login, title: 'Synthetic HTTP rivalry', durationSeconds: 60 });
    assert.equal(response.status, 200); return response.body.room.id;
  }
  async function start() {
    const roomId = await invite();
    assert.equal((await action(broadcaster(1), roomId, 'accept')).status, 200);
    assert.equal((await action(broadcaster(0), roomId, 'ready')).status, 200);
    assert.equal((await action(broadcaster(1), roomId, 'ready')).body.room.lifecycle, 'countdown');
    advance(5000); assert.equal((await state(broadcaster(0))).body.room.lifecycle, 'running');
    return roomId;
  }
  return { app, origin, secret, hostKey, sign, broadcaster, viewer, request, post, state, action, play, advance, invite, start };
}

test('synthetic JWTs complete A/B invite, acceptance, countdown, attack, defection and automatic result over HTTP', async t => {
  const f = await fixture(t), a = f.broadcaster(0), b = f.broadcaster(1), roomId = await f.invite();
  const pendingA = (await f.state(a)).body, pendingB = (await f.state(b)).body;
  assert.equal(pendingA.room.id, pendingB.room.id); assert.equal(pendingB.roomSide, 'b');
  assert.equal(pendingB.room.lifecycle, 'invited'); assert.equal(pendingA.inputSource, 'twitch-extension');
  assert.equal((await f.action(a, roomId, 'accept')).status, 403);
  assert.equal((await f.action(b, roomId, 'accept')).body.room.lifecycle, 'lobby');
  assert.equal((await f.action(a, roomId, 'ready')).body.room.ready.a, true);
  assert.equal((await f.action(b, roomId, 'ready')).body.room.countdownRemainingMs, 5000);
  f.advance(5000);
  assert.equal((await f.state(a)).body.room.lifecycle, 'running');
  for (const id of ['80000001', '80000002', '80000003']) {
    assert.equal((await f.play(f.viewer(0, id), roomId, '!join')).status, 200);
    assert.equal((await f.play(f.viewer(0, id), roomId, '!attack')).status, 200);
  }
  let state = (await f.state(b)).body;
  assert.equal(state.room.engine.teams.a.score, 1); assert.ok(state.room.engine.teams.b.activeChallenge);
  for (const id of ['80000004', '80000005']) {
    await f.play(f.viewer(1, id), roomId, '!join'); await f.play(f.viewer(1, id), roomId, '!attack');
  }
  assert.equal((await f.play(f.viewer(0), roomId, '!switch')).body.code, 'window_closed');
  f.advance(30000);
  assert.equal((await f.state(a)).body.room.engine.defectionRemainingMs, 20000);
  const switched = await f.play(f.viewer(1), roomId, '!switch');
  assert.equal(switched.status, 200); assert.equal(switched.body.viewer.team, 'b'); assert.equal(switched.body.viewer.switched, true);
  assert.equal((await f.play(f.viewer(0), roomId, '!switch')).body.code, 'already_switched');
  const nextAttack = await f.play(f.viewer(0), roomId, '!attack');
  assert.equal(nextAttack.status, 200);
  assert.equal(nextAttack.body.room.engine.events.filter(event => event.type === 'attack').at(-1).target, 'a');
  assert.equal(nextAttack.body.room.engine.teams.b.score, 1);
  f.advance(20000);
  for (const id of ['80000001', '80000004', '80000005']) assert.equal((await f.play(f.viewer(1, id), roomId, '!attack')).status, 200);
  f.advance(10000);
  const finalA = (await f.state(a)).body, finalB = (await f.state(b)).body;
  assert.equal(finalA.room.lifecycle, 'finished'); assert.equal(finalB.room.lifecycle, 'finished');
  assert.deepEqual(finalA.room.engine.result, { winner: 'b', scores: { a: 1, b: 2 }, provisional: false });
  assert.deepEqual(finalA.room.engine.result, finalB.room.engine.result);
  assert.equal((await f.play(f.viewer(1), roomId, '!attack')).status, 400);
});

test('native HTTP auth rejects missing, bad-signature, expired and backend-role tokens', async t => {
  const f = await fixture(t);
  assert.equal((await f.state()).status, 401);
  assert.equal((await f.state('not-a-jwt')).status, 401);
  const wrongSecret = randomBytes(32).toString('base64');
  assert.equal((await f.state(f.sign({ role: 'viewer', channel_id: CHANNELS[0].id, opaque_user_id: 'Uopaque123', user_id: '80000001' }, wrongSecret))).status, 401);
  assert.equal((await f.state(f.viewer(0, '80000001', { exp: 1 }))).status, 401);
  const external = f.sign({ role: 'external', channel_id: CHANNELS[0].id, opaque_user_id: 'Ubackend', user_id: '80000001' });
  assert.equal((await f.state(external)).status, 403);
  const forgedBroadcaster = f.sign({ role: 'broadcaster', channel_id: CHANNELS[0].id, opaque_user_id: 'U80000001', user_id: '80000001' });
  assert.equal((await f.state(forgedBroadcaster)).status, 401);
  assert.equal((await f.request('/api/extension/state', { headers: { 'X-Extension-JWT': f.broadcaster(0) } })).status, 200);
});

test('viewers and moderators cannot call broadcaster actions or invite via HTTP', async t => {
  const f = await fixture(t), roomId = await f.invite();
  assert.equal((await f.post('/api/extension/invite', f.viewer(0), { targetLogin: CHANNELS[2].login })).status, 403);
  for (const action of ['accept', 'decline', 'ready', 'unready', 'pause', 'resume', 'leave']) {
    assert.equal((await f.action(f.viewer(1), roomId, action)).status, 403, action);
  }
  const moderator = f.viewer(1, '80000002', { role: 'moderator' });
  assert.equal((await f.action(moderator, roomId, 'accept')).status, 403);
});

test('foreign room IDs, foreign channels and unlinked viewer identities are rejected on the wire', async t => {
  const f = await fixture(t), roomId = await f.start();
  assert.equal((await f.action(f.broadcaster(2), roomId, 'pause')).status, 403);
  assert.equal((await f.action(f.broadcaster(1), 'invented-room-id', 'pause')).status, 403);
  assert.equal((await f.play(f.viewer(2), roomId, '!join')).status, 403);
  assert.equal((await f.play(f.viewer(0), 'invented-room-id', '!join')).status, 403);
  const unlinked = f.sign({ role: 'viewer', channel_id: CHANNELS[0].id, opaque_user_id: 'UopaqueUnlinked' });
  assert.equal((await f.state(unlinked)).status, 200);
  assert.equal((await f.play(unlinked, roomId, '!join')).status, 403);
  const anonymous = f.sign({ role: 'viewer', channel_id: CHANNELS[0].id, opaque_user_id: 'Aanonymous' });
  assert.equal((await f.play(anonymous, roomId, '!join')).status, 403);
});

test('the same linked viewer keeps one allegiance and cooldown in both channels over HTTP', async t => {
  const f = await fixture(t), roomId = await f.start();
  await f.play(f.viewer(0), roomId, '!join');
  const fromOtherChat = await f.play(f.viewer(1), roomId, '!join');
  assert.equal(fromOtherChat.body.room.engine.participants, 1); assert.equal(fromOtherChat.body.viewer.team, 'a');
  assert.equal((await f.play(f.viewer(1), roomId, '!attack')).status, 200);
  const repeat = await f.play(f.viewer(0), roomId, '!attack');
  assert.equal(repeat.status, 400); assert.equal(repeat.body.code, 'cooldown');
  const state = (await f.state(f.broadcaster(1))).body;
  assert.equal(state.room.engine.teams.a.attacks, 1); assert.equal(state.room.engine.teams.b.attacks, 0);
});

test('exact Twitch Extension CORS origin gets preflight headers, impostor and foreign origins are refused', async t => {
  const f = await fixture(t), twitchOrigin = `https://${EXTENSION_ID}.ext-twitch.tv`;
  const options = await f.request('/api/extension/play', { method: 'OPTIONS', headers: {
    Origin: twitchOrigin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type',
  } });
  assert.equal(options.status, 204); assert.equal(options.headers.get('access-control-allow-origin'), twitchOrigin);
  assert.match(options.headers.get('access-control-allow-headers'), /Authorization/);
  assert.match(options.headers.get('access-control-allow-headers'), /Content-Type/);
  assert.match(options.headers.get('access-control-allow-headers'), /X-Extension-JWT/);
  assert.equal(options.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS');
  assert.equal(options.headers.get('vary'), 'Origin');
  const actual = await f.request('/api/extension/state', { token: f.broadcaster(0), headers: { Origin: twitchOrigin } });
  assert.equal(actual.status, 200); assert.equal(actual.headers.get('access-control-allow-origin'), twitchOrigin);
  for (const origin of ['https://evil.example', `${twitchOrigin}.evil.example`, 'https://anotherextension.ext-twitch.tv']) {
    const denied = await f.request('/api/extension/state', { token: f.broadcaster(0), headers: { Origin: origin } });
    assert.equal(denied.status, 403); assert.equal(denied.headers.get('access-control-allow-origin'), null);
  }
  assert.equal((await f.post('/api/session', undefined, { key: f.hostKey }, { Origin: twitchOrigin })).status, 403);
});

test('sandbox session minting is disabled by default and cannot use forwarded production connections', async t => {
  const production = await fixture(t);
  assert.equal((await production.post('/api/sandbox/session', undefined, { persona: 'streamer-a' })).status, 403);
  assert.equal((await production.state('sandbox_fake')).status, 403);
  const local = await fixture(t, { sandboxEnabled: true });
  assert.equal((await local.post('/api/sandbox/session', undefined, { persona: 'streamer-a' }, { 'X-Forwarded-For': '203.0.113.1' })).status, 403);
  const session = await local.post('/api/sandbox/session', undefined, { persona: 'streamer-a' });
  assert.equal(session.status, 200);
  const forwarded = await local.request('/api/extension/state', { token: session.body.token, headers: { Forwarded: 'for=203.0.113.1' } });
  assert.equal(forwarded.status, 403);
});

test('local simulation and native JWT requests have isolated room registries even for matching channel IDs', async t => {
  const f = await fixture(t, { sandboxEnabled: true }), nativeRoom = await f.invite();
  const a = (await f.post('/api/sandbox/session', undefined, { persona: 'streamer-a' })).body.token;
  const b = (await f.post('/api/sandbox/session', undefined, { persona: 'streamer-b' })).body.token;
  assert.equal((await f.state(a)).body.room, null);
  const invited = await f.post('/api/extension/invite', a, { targetLogin: 'demo_violet', title: 'Local simulated rivalry', durationSeconds: 60 });
  assert.equal(invited.status, 200); assert.equal(invited.body.inputSource, 'local-simulation');
  const sandboxRoom = invited.body.room.id; assert.notEqual(sandboxRoom, nativeRoom);
  assert.equal((await f.state(f.broadcaster(0))).body.room.id, nativeRoom);
  assert.equal((await f.state(b)).body.room.id, sandboxRoom);
  assert.equal((await f.action(b, nativeRoom, 'accept')).status, 403);
  assert.equal((await f.action(f.broadcaster(1), sandboxRoom, 'accept')).status, 403);
  assert.equal((await f.action(b, sandboxRoom, 'accept')).status, 200);
  assert.equal((await f.state(f.broadcaster(1))).body.room.lifecycle, 'invited');
});

test('public health and extension assets expose no secret and permit Twitch embedding only for extension pages', async t => {
  const f = await fixture(t), health = await f.request('/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { service: 'chatcrossfire', ok: true, extensionConfigured: true, sandboxEnabled: false });
  for (const secret of [f.secret, f.hostKey]) assert.equal(JSON.stringify(health.body).includes(secret), false);
  for (const path of ['/extension/index.html', '/extension/panel.html', '/extension/dashboard.html', '/extension/config.html', '/extension/overlay.html']) {
    const response = await f.request(path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('x-frame-options'), null, path);
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors.*twitch\.tv/, path);
    assert.match(response.body, /https:\/\/extension-files\.twitch\.tv\/helper\/v1\/twitch-ext\.min\.js/);
    assert.equal(response.body.includes(f.secret), false);
  }
  const debug = await f.request('/debug'); assert.equal(debug.headers.get('x-frame-options'), 'DENY');
  assert.equal((await f.request('/.env')).status, 404);
});

test('unconfigured backend reports configuration status without leaking errors and rejects native sessions', async t => {
  const f = await fixture(t, { configured: false });
  const health = await f.request('/api/health'); assert.equal(health.body.extensionConfigured, false);
  const response = await f.state(f.broadcaster(0));
  assert.equal(response.status, 503); assert.equal(response.body.code, 'extension_not_configured');
  assert.equal(JSON.stringify(response.body).includes(f.secret), false);
});

test('native routes enforce the configured Host rather than trusting an attacker-supplied Host header', async t => {
  const f = await fixture(t);
  const response = await new Promise((resolveResponse, reject) => {
    const req = httpRequest(`${f.origin}/api/health`, { headers: { Host: 'evil.example' } }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolveResponse({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
    });
    req.on('error', reject); req.end();
  });
  assert.equal(response.status, 403); assert.match(response.body.error, /Host is not allowed/);
});

test('public deployment disables legacy developer routes even with the correct debug key while native PK stays available', async t => {
  const f = await fixture(t, { publicOrigin: 'https://pk.example.test' });
  for (const path of ['/debug', '/api/session', '/api/state', '/api/events']) {
    const response = await f.request(path);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get('set-cookie'), null, path);
  }
  const unlock = await f.post('/api/session', undefined, { key: f.hostKey });
  assert.equal(unlock.status, 404); assert.equal(unlock.headers.get('set-cookie'), null);
  assert.equal((await f.post('/api/action', undefined, { action: 'start' })).status, 404);
  const health = await f.request('/api/health');
  assert.equal(health.status, 200); assert.equal(health.body.extensionConfigured, true); assert.equal(health.body.sandboxEnabled, false);
  const native = await f.state(f.broadcaster(0));
  assert.equal(native.status, 200); assert.equal(native.body.identity.broadcaster, true);
  assert.equal(native.body.inputSource, 'twitch-extension');
  assert.equal((await f.post('/api/sandbox/session', undefined, { persona: 'streamer-a' })).status, 403);
});

test('public deployment cannot be created with local simulation enabled', t => {
  const directory = mkdtempSync(join(tmpdir(), 'crossfire-extension-http-'));
  t.after(() => {
    const target = resolve(directory), safePrefix = resolve(tmpdir()) + sep;
    assert.ok(target.startsWith(safePrefix) && target.slice(safePrefix.length).startsWith('crossfire-extension-http-'));
    rmSync(target, { recursive: true, force: true });
  });
  assert.throws(() => createApp({ store: new Store(directory), token: '', sandboxEnabled: true, publicOrigin: 'https://pk.example.test' }), /Local simulation cannot be enabled with PUBLIC_ORIGIN/);
});
