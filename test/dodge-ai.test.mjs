import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { DanmakuEngine } from '../src/danmaku.mjs';
import { startDodgeServer } from '../src/dodge-http.mjs';
import { inspectDodgeConfig, verifyDodgeConnection } from '../src/dodge-setup.mjs';

function rig() {
  let now = 0;
  const engine = new DanmakuEngine({ mode: 'ai-demo', now: () => now, random: () => .5, config: { durationMs: 20000 } });
  engine.audience({ a: 20 }, 'twitch');
  const marker = () => engine.marker('a', { x: 480, y: 270 });
  return { engine, marker, advance(ms) { for (let left = ms; left > 0;) { const step = Math.min(50, left); now += step; marker(); engine.tick(); left -= step; } }, jump(ms) { now += ms; engine.tick(); } };
}

test('AI demo uses one real audience, a physical marker and bounded server AI without fabricating viewers or users', () => {
  const { engine, marker, advance } = rig();
  assert.equal(engine.freshMarkers(), false); marker();
  assert.equal(engine.freshMarkers(), true); assert.equal(engine.freshAudience(), true);
  assert.equal(engine.counts.b, null);
  assert.throws(() => engine.marker('b', { x: 1, y: 1 }), /server controlled/);
  engine.start();
  assert.equal(engine.activity({ id: 'wrong-source', userId: 'outsider', channelTeam: 'b', text: 'fake second channel' }).ok, false);
  assert.equal(engine.activity({ id: 'real-source', userId: 'viewer', channelTeam: 'a', text: 'Real chat' }).ok, true);
  advance(5000);
  assert.ok(engine.shots.a > 0 && engine.shots.b > 0);
  assert.ok(engine.health.a < 5, 'Labelled AI shots use the same authoritative collision and damage');
  assert.ok(engine.bullets.some(bullet => bullet.kind === 'ai' && bullet.from === 'b'));
  assert.equal(engine.players.size, 1); assert.equal(engine.players.has('outsider'), false);
  assert.equal(engine.snapshot().pressure.audience.b, null);
  assert.equal(engine.snapshot().pressure.barrage, null);
  const before = engine.markers.b.y; advance(50);
  assert.ok(Math.abs(engine.markers.b.y - before) <= 6.001, 'AI cannot teleport');
  assert.ok(engine.markers.b.y >= engine.config.radius && engine.markers.b.y <= engine.config.height - engine.config.radius);
  advance(15000);
  assert.equal(engine.phase, 'finished'); assert.ok(['a', 'b', 'tie'].includes(engine.result.winner));
  engine.reset(); assert.equal(engine.players.size, 0); assert.equal(engine.markers.a, null); assert.ok(engine.markers.b);
});

test('AI demo freezes AI and time on lost human tracking, and suspends new attacks on missing real counts', () => {
  const { engine, marker, advance, jump } = rig(); marker(); engine.start(); advance(1000);
  const before = engine.snapshot(); jump(1100);
  assert.equal(engine.phase, 'paused'); assert.equal(engine.elapsed, before.elapsedMs);
  assert.deepEqual(engine.markers.b, before.markers.b);
  marker(); engine.resume(); engine.audience({ a: null }, 'twitch');
  assert.equal(engine.freshAudience(), false);
  assert.match(engine.activity({ id: 'offline', userId: 'viewer', channelTeam: 'a', text: 'Hello' }).reason, /confirm your channel is live/);
  advance(5000); assert.equal(engine.shots.b, 0, 'No new AI attacks while real audience is unavailable');
});

test('one real viewer retains cooldown and a single defection when backing the AI', () => {
  const { engine, marker, advance } = rig(); marker(); engine.start(); advance(6000);
  const chat = (id, text) => engine.activity({ id, userId: 'same-viewer', channelTeam: 'a', text });
  assert.equal(chat('attack', 'Hello').team, 'a');
  assert.equal(chat('switch', '!switch').team, 'b');
  assert.match(chat('cooldown', 'Hello again').reason, /cooldown/);
  advance(2100);
  assert.equal(chat('after-switch', 'Back the AI!').team, 'b');
  assert.equal(chat('switch-twice', '!switch').ok, false);
  assert.equal(engine.counts.b, null); assert.equal(engine.frozen.a, 20);
});

test('AI demo accepts verified live zero viewers with the floor denominator but never accepts offline or invents AI viewers', () => {
  const { engine, marker } = rig();
  engine.audience({ a: 0, b: 999 }, 'twitch'); marker();
  assert.equal(engine.freshAudience(), true); assert.equal(engine.counts.a.raw, 0);
  assert.equal(engine.counts.a.value, 14, 'Normalization retains smoothing while the UI displays the raw sample');
  assert.equal(engine.frozen.a, 20); assert.equal(engine.counts.b, null);
  engine.start();
  assert.equal(engine.activity({ id: 'broadcaster', userId: 'owner', channelTeam: 'a', text: 'Live demo' }).ok, true);
  engine.audience({ a: null }, 'twitch'); assert.equal(engine.freshAudience(), false);
  const duel = new DanmakuEngine(); duel.audience({ a: 0, b: 1 }, 'twitch');
  assert.equal(duel.freshAudience(), false, 'Original duel still requires positive samples');
});

class Bridge extends EventEmitter {
  status = { state: 'connected' };
  channels = [{ team: 'a', id: '10', login: 'streamer', subscribed: true }];
  calls = [];
  async start(channels) { this.startedWith = channels; this.status.channels = this.channels; this.emit('status', this.status); }
  async request(url) { this.calls.push(url); return { data: [{ user_id: '10', viewer_count: 0 }] }; }
  stop() { this.stopped = true; }
}

test('live AI server only subscribes/samples channel A, requires actual readiness and keeps synthetic writes unavailable', async t => {
  const bridge = new Bridge(); let factories = 0;
  const app = await startDodgeServer({ port: 0, mode: 'ai-demo', live: true, channels: { a: 'streamer', b: 'ignored' }, supportTokens: { b: 'syntheticTestTokenOnly' }, bridgeFactory: () => { factories++; return bridge; } });
  t.after(() => app.close());
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const post = (path, body) => fetch(`${origin}/api/dodge/${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.deepEqual(bridge.startedWith, { a: 'streamer' }); assert.equal(factories, 1);
  assert.deepEqual(new URL(bridge.calls[0]).searchParams.getAll('user_id'), ['10']);
  assert.equal((await post('action', { action: 'start' })).status, 409);
  assert.equal((await post('marker', { side: 'b', x: 480, y: 270 })).status, 400);
  assert.equal((await post('marker', { side: 'a', x: 480, y: 270 })).status, 200);
  assert.equal((await post('action', { action: 'start', durationSeconds: 60 })).status, 200);
  assert.equal((await post('activity', { text: 'forged viewer' })).status, 404);
  assert.equal((await post('audience', { a: 999, b: 999 })).status, 404);
  bridge.emit('chat', { id: 'forged-source', userId: 'outsider', channelTeam: 'b', text: 'Hello' });
  bridge.emit('chat', { id: 'verified-source', userId: 'viewer', channelTeam: 'a', text: 'Hello' });
  assert.equal(app.engine.players.has('outsider'), false);
  assert.equal(app.snapshot().inputActivity.a.accepted, 1); assert.equal(app.snapshot().inputActivity.b.received, 0);
  assert.equal(app.snapshot().pressure.audience.b, null); assert.equal(app.snapshot().mode, 'ai-demo');
  await post('action', { action: 'pause' }); bridge.status.state = 'reconnecting';
  assert.equal((await post('action', { action: 'resume' })).status, 409);
  assert.equal(JSON.stringify(app.snapshot()).includes('syntheticTestTokenOnly'), false);
  await assert.rejects(startDodgeServer({ port: 0, mode: 'ai-demo', live: false }), /requires real Twitch/);
});

test('AI configuration and verifier require one real live stream without claiming AI viewers', async () => {
  const env = { DODGE_MODE: 'ai-demo', DODGE_LIVE: '1', DODGE_CHANNEL_A: 'streamer', TWITCH_OAUTH_TOKEN: 'syntheticTestTokenOnly' };
  assert.equal(inspectDodgeConfig(env).ok, true);
  assert.equal(inspectDodgeConfig({ ...env, DODGE_MODE: 'unknown' }).ok, false);
  assert.equal(inspectDodgeConfig({ ...env, DODGE_MODE: 'duel' }).ok, false);
  const bridge = new Bridge();
  const result = await verifyDodgeConnection({ mode: 'ai-demo', channels: { a: 'streamer', b: 'ignored' }, bridgeFactory: () => bridge });
  assert.equal(result.ok, true); assert.deepEqual(result.counts, { a: 0 });
  assert.deepEqual(bridge.startedWith, { a: 'streamer' }); assert.equal(bridge.stopped, true);
  assert.match(result.message, /local AI/i);
  const offline = new Bridge(); offline.request = async () => ({ data: [] });
  const unavailable = await verifyDodgeConnection({ mode: 'ai-demo', channels: { a: 'streamer' }, bridgeFactory: () => offline });
  assert.equal(unavailable.ok, false); assert.deepEqual(unavailable.counts, { a: null });
});
