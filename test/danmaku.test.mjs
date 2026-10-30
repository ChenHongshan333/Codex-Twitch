import test from 'node:test';
import assert from 'node:assert/strict';
import { DanmakuEngine, sweptHit } from '../src/danmaku.mjs';

function rig(config = {}) {
  let time = 0;
  const game = new DanmakuEngine({ now: () => time, random: () => .5, config });
  const markers = () => { for (const side of ['a', 'b']) game.marker(side, { x: 480, y: 270 }); };
  game.audience({ a: 100, b: 100 }, 'synthetic'); markers(); game.start();
  return { game, advance(ms) { for (let left = ms; left > 0;) { const dt = Math.min(50, left); time += dt; markers(); game.tick(); left -= dt; } },
    jump(ms) { time += ms; game.tick(); }, markers };
}
const chat = (userId, channelTeam = 'a', extra = {}) => ({ id: `msg-${userId}`, userId, channelTeam, text: 'hello', kind: 'chat', ...extra });

test('continuous collision catches crossing shots and misses rounded corners', () => {
  assert.equal(sweptHit(-200, 0, 200, 0, 64, 14, 14), true);
  assert.equal(sweptHit(77, 27, 77, 27, 64, 14, 14), false);
  assert.equal(sweptHit(-200, 80, 200, 80, 64, 14, 14), false);
});

test('equal participation per viewer produces equal projectiles and pressure', () => {
  const { game, advance } = rig();
  game.audience({ a: 1000, b: 100 }, 'synthetic', { reset: true });
  for (let i = 0; i < 10; i++) game.activity(chat(`large${i}`, 'a'));
  game.activity(chat('small', 'b'));
  assert.equal(game.snapshot().pending.a, 1); assert.equal(game.snapshot().pending.b, 1);
  advance(8000);
  assert.equal(game.snapshot().pressure.barrage, null);
  assert.deepEqual(game.snapshot().shots, { a: 1, b: 1 });
});

test('tracking loss freezes time, bullets and requires explicit resume', () => {
  const { game, jump, markers, advance } = rig(); game.activity(chat('one'));
  advance(100); const before = game.snapshot(); jump(1100);
  const paused = game.snapshot(); assert.equal(paused.phase, 'paused');
  assert.equal(paused.elapsedMs, before.elapsedMs);
  markers(); assert.equal(game.snapshot().phase, 'paused'); game.resume(); advance(100);
  assert.equal(game.snapshot().elapsedMs, before.elapsedMs + 100);
});

test('shots hit automatically once, grant invulnerability and settle by health', () => {
  const { game, advance } = rig({ durationMs: 5000 });
  game.activity(chat('one')); game.activity(chat('two')); advance(4000);
  assert.equal(game.snapshot().health.b, 4); advance(1000);
  assert.equal(game.snapshot().result.winner, 'a');
  assert.equal(game.snapshot().phase, 'finished');
});

test('one identity across both chats retains cooldown after defection and source weighting', () => {
  const { game, advance } = rig({ durationMs: 40000 }); advance(11000);
  game.audience({ a: 1000, b: 100 }, 'synthetic', { reset: true });
  assert.equal(game.activity(chat('viewer')).ok, true);
  assert.equal(game.activity(chat('viewer', 'b', { id: 'switch', text: '!switch' })).ok, true);
  assert.equal(game.activity(chat('viewer', 'b', { id: 'early' })).ok, false);
  advance(2000);
  assert.equal(game.activity(chat('viewer', 'a', { id: 'later' })).ok, true);
  assert.equal(game.snapshot().pressure.current.b, .001);
  assert.equal(game.activity(chat('viewer', 'b', { id: 'switch2', text: '!switch' })).ok, false);
});

test('stale or offline audience suspends admission and never produces a catch-up burst', () => {
  const { game, advance } = rig(); advance(46000);
  assert.equal(game.activity(chat('stale')).ok, false);
  assert.equal(game.snapshot().pressure.enabled, false);
  game.audience({ a: 0, b: 100 }, 'twitch');
  assert.equal(game.activity(chat('offline')).ok, false);
  game.audience({ a: 100, b: 100 }, 'synthetic'); advance(8000);
  assert.equal(game.snapshot().shots.a, 0);
});

test('sustained normalized advantage triggers a bounded barrage and hostile load is bounded', () => {
  const { game, advance } = rig();
  for (let i = 0; i < 12000; i++) game.activity(chat(String(i)));
  assert.ok(game.snapshot().pending.a <= 32); assert.ok(game.players.size <= 10000);
  advance(8000);
  assert.equal(game.snapshot().pressure.barrage, 'a');
  assert.ok(game.snapshot().bullets.length <= 64);
});

test('a short lead cannot trigger a barrage; a mid-bucket lead can after five seconds', () => {
  const { game, advance } = rig(); advance(1000);
  for (let i = 0; i < 3; i++) game.activity(chat(`lead-${i}`));
  advance(4900); assert.equal(game.snapshot().pressure.barrage, null);
  advance(100); assert.equal(game.snapshot().pressure.barrage, 'a');
});

test('duplicate support, oversized text and anonymous gifts have safe consistent handling', () => {
  const { game, advance } = rig();
  const event = chat('gift', 'b', { id: 'unique', kind: 'gift', units: 1000, text: '😀'.repeat(1000) });
  assert.equal(game.activity(event).ok, true); assert.equal(game.activity(event).ok, false);
  game.activity({ id: 'anon', userId: null, channelTeam: 'a', kind: 'gift', units: 1, text: '<script>' });
  advance(500); const bullets = game.snapshot().bullets;
  assert.ok(bullets.every(b => [...b.text].length <= 49));
  assert.ok(bullets.some(b => b.from === 'a'));
  assert.throws(() => game.marker('a', { x: NaN, y: 1 }));
});

test('deletion clears queued/in-flight/replayed text without undoing past hits', () => {
  const { game, advance } = rig(); game.activity(chat('one')); advance(3000);
  const health = game.snapshot().health.b; game.activity(chat('two')); advance(100);
  game.moderate(); const state = game.snapshot();
  assert.equal(state.health.b, health); assert.equal(state.bullets.length, 0);
  assert.deepEqual(state.pending, { a: 0, b: 0 }); assert.equal(state.pressure.barrage, null);
});
