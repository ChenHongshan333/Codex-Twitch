import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { startDodgeServer } from '../src/dodge-http.mjs';
import { DanmakuEngine } from '../src/danmaku.mjs';
import { TwitchBridge } from '../src/twitch.mjs';

async function until(check) {
  const deadline = Date.now() + 2000;
  while (!check()) { if (Date.now() > deadline) throw new Error('Synthetic live pipeline timed out'); await delay(5); }
}

test('EventSub to dodge HTTP to OBS: readiness, real-shaped chat, dedupe, damage, result and reset are isolated from synthetic input', async t => {
  let now = 0, socket; const calls = [];
  class Socket extends EventTarget {
    constructor() { super(); socket = this; }
    emit(data) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })); }
    close() {}
  }
  const engine = new DanmakuEngine({ now: () => now, random: () => .5, config: { durationMs: 60000 } });
  const app = await startDodgeServer({ port: 0, live: true, engine, channels: { a: 'coral', b: 'violet' }, bridgeFactory: options => new TwitchBridge({ ...options, token: 'syntheticTestTokenOnly', WebSocketImpl: Socket,
    fetchImpl: async (url, options) => {
      calls.push({ url, method: options.method });
      return { ok: true, json: async () => url.includes('/validate') ? { user_id: 'reader', client_id: 'syntheticApp', login: 'reader', scopes: ['user:read:chat'] } :
        url.includes('/users?') ? { data: [{ id: '10', login: 'coral' }, { id: '20', login: 'violet' }] } :
        url.includes('/streams?') ? { data: [{ user_id: '10', viewer_count: 20 }, { user_id: '20', viewer_count: 20 }] } : { data: [] } };
    } }) });
  t.after(() => app.close());
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const post = async (route, body) => {
    const response = await fetch(`${origin}/api/dodge/${route}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await post('action', { action: 'start', durationSeconds: 180 })).status, 409);
  assert.equal(engine.config.durationMs, 60000, 'Failed readiness does not change match settings');
  assert.equal((await post('activity', { text: 'fake' })).status, 404);
  assert.equal((await post('audience', { a: 20, b: 20 })).status, 404);
  socket.emit({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'syntheticSession', keepalive_timeout_seconds: 10 } } });
  await until(() => app.snapshot().setup.chats && app.snapshot().setup.audience);
  assert.equal(app.snapshot().setup.ready, false);
  const chat = (id, broadcaster, user) => socket.emit({ metadata: { message_type: 'notification', subscription_type: 'channel.chat.message' }, payload: { event: { message_id: id, broadcaster_user_id: broadcaster, chatter_user_id: user, chatter_user_login: user, message: { text: 'Dodge this!' } } } });
  chat('before', '10', 'viewer-a');
  await until(() => app.snapshot().inputActivity.a.received === 1);
  assert.equal(app.snapshot().inputActivity.a.rejected, 1);
  assert.match(app.snapshot().inputActivity.a.lastReason, /not running/);
  for (const side of ['a', 'b']) await post('marker', { side, x: 480, y: 270 });
  assert.equal(app.snapshot().setup.ready, true);
  assert.equal((await post('action', { action: 'start' })).status, 200);
  chat('a-1', '10', 'viewer-a'); chat('a-1', '10', 'viewer-a'); chat('b-1', '20', 'viewer-b'); chat('unknown', '99', 'outsider');
  await until(() => app.snapshot().inputActivity.b.accepted === 1);
  assert.equal(app.snapshot().inputActivity.a.received, 2);
  assert.equal(engine.players.has('outsider'), false);
  for (let i = 0; i < 1210 && engine.phase !== 'finished'; i++) {
    now += 50;
    for (const side of ['a', 'b']) engine.marker(side, { x: 480, y: 270 });
    engine.tick();
  }
  assert.equal(engine.phase, 'finished');
  assert.ok(engine.health.a < 5 && engine.health.b < 5);
  assert.equal(engine.result.winner, 'tie');
  const state = await fetch(`${origin}/api/dodge/state`).then(r => r.json());
  assert.equal(state.serverTime, now); assert.equal(state.inputSource, 'twitch');
  assert.equal(JSON.stringify(state).includes('syntheticTestTokenOnly'), false);
  assert.equal((await fetch(`${origin}/overlay/a`)).status, 200);
  assert.equal(calls.some(call => call.url.endsWith('/chat/messages')), false, 'No chat is sent');
  const reset = await post('action', { action: 'reset' });
  assert.equal(reset.body.inputActivity.a.received, 0); assert.equal(reset.body.setup.markers, false);
});

test('live start/resume rejects missing, stale counts or disconnected chats even with fresh markers', async t => {
  let now = 0;
  const { EventEmitter } = await import('node:events');
  class Bridge extends EventEmitter {
    status = { state: 'connected' }; channels = [{ team: 'a', id: '10', subscribed: true }, { team: 'b', id: '20', subscribed: true }];
    async start() { this.emit('status', this.status); }
    async request() { return { data: [] }; }
    stop() {}
  }
  const engine = new DanmakuEngine({ now: () => now });
  const app = await startDodgeServer({ port: 0, live: true, engine, channels: { a: 'coral', b: 'violet' }, bridgeFactory: () => new Bridge() });
  t.after(() => app.close());
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const action = name => fetch(`${origin}/api/dodge/action`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: name }) });
  const mark = () => { for (const side of ['a', 'b']) engine.marker(side, { x: 480, y: 270 }); };
  mark(); assert.equal((await action('start')).status, 409);
  engine.audience({ a: 1, b: 1 }, 'twitch'); mark(); assert.equal((await action('start')).status, 200);
  await action('pause'); now += 45001; mark(); assert.equal((await action('resume')).status, 409);
  engine.audience({ a: 1, b: 1 }, 'twitch'); app.bridge.status.state = 'reconnecting';
  assert.equal((await action('resume')).status, 409);
  app.bridge.status.state = 'connected'; assert.equal((await action('resume')).status, 200);
});
