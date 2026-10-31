import test from 'node:test';
import assert from 'node:assert/strict';
import { DanmakuEngine, sweptHit } from '../src/danmaku.mjs';

function rig(config = {}) {
  let time = 0;
  const game = new DanmakuEngine({ now: () => time, random: () => .5, config });
  const points = { a: { x: 480, y: 270 }, b: { x: 480, y: 270 } };
  const markers = () => { for (const side of ['a', 'b']) game.marker(side, points[side]); };
  game.audience({ a: 100, b: 100 }, 'synthetic'); markers(); game.start();
  return { game, advance(ms) { for (let left = ms; left > 0;) { const dt = Math.min(50, left); time += dt; markers(); game.tick(); left -= dt; } },
    jump(ms) { time += ms; game.tick(); }, markers,
    move(side, point) { points[side] = point; game.marker(side, point); } };
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

test('warnings hold horizontal shots still and moving away dodges the fixed lane', () => {
  const { game, advance, move } = rig();
  game.activity(chat('aim')); advance(20);
  const announced = game.snapshot().bullets[0];
  advance(799);
  const warning = game.snapshot();
  assert.equal(warning.bullets[0].x, announced.x);
  assert.equal(warning.health.b, 5);
  move('b', { x: 480, y: 80 }); advance(1000);
  const flying = game.snapshot().bullets[0];
  assert.ok(flying.x > announced.x);
  assert.equal(flying.vx, announced.vx); assert.equal(flying.vy, 0);
  assert.equal(flying.y, announced.y);
  advance(4000);
  assert.equal(game.snapshot().health.b, 5);
  assert.equal(game.snapshot().bullets.length, 0);
});

test('both source chats send straight left-to-right messages into the opposing arena without aiming', () => {
  const { game, advance, move } = rig();
  move('a', { x: 480, y: 50 }); move('b', { x: 480, y: 490 });
  game.activity(chat('from-a', 'a', { id: 'from-a' }));
  game.activity(chat('from-a-2', 'a', { id: 'from-a-2' }));
  game.activity(chat('from-b', 'b', { id: 'from-b' }));
  advance(20);
  const first = game.snapshot().bullets;
  const shotFromA = first.find(bullet => bullet.from === 'a');
  const shotFromB = first.find(bullet => bullet.from === 'b');
  assert.equal(shotFromA.target, 'b'); assert.equal(shotFromB.target, 'a');
  for (const bullet of first) {
    assert.equal(bullet.x, -game.config.bulletWidth / 2);
    assert.equal(bullet.vx, game.config.speed); assert.equal(bullet.vy, 0);
  }
  assert.notEqual(shotFromA.y, game.snapshot().markers.b.y);
  assert.notEqual(shotFromB.y, game.snapshot().markers.a.y);
  assert.equal(shotFromA.y, shotFromB.y);
  advance(350);
  assert.notEqual(game.snapshot().bullets.filter(bullet => bullet.target === 'b')[1].y, shotFromA.y);
});

test('a marker crossing a projectile between samples is hit even when both endpoints miss', () => {
  const { game, advance, move } = rig();
  game.activity(chat('crossing')); advance(20);
  move('b', { x: 480, y: 100 }); advance(2400);
  const before = game.snapshot();
  assert.equal(before.health.b, 5);
  assert.ok(Math.abs(before.bullets[0].y - before.markers.b.y) > 28);
  move('b', { x: 480, y: 440 }); advance(50);
  const after = game.snapshot();
  assert.ok(Math.abs(before.bullets[0].y - after.markers.b.y) > 28);
  assert.equal(after.health.b, 4);
  assert.equal(after.bullets.length, 0);
  assert.equal(after.events.filter(event => event.type === 'hit').length, 1);
});

test('operator pause freezes projectiles and shared cooldown until gameplay resumes', () => {
  const { game, advance, jump, markers } = rig();
  game.activity(chat('paused-viewer')); advance(100); game.pause();
  const before = game.snapshot(); jump(10000);
  assert.equal(game.snapshot().elapsedMs, before.elapsedMs);
  assert.deepEqual(game.snapshot().bullets, before.bullets);
  assert.equal(game.activity(chat('paused-viewer', 'b', { id: 'while-paused' })).ok, false);
  assert.throws(() => game.resume(), /Recover both markers/);
  markers(); game.resume(); advance(1899);
  assert.equal(game.activity(chat('paused-viewer', 'b', { id: 'too-soon' })).ok, false);
  advance(1);
  const admitted = game.activity(chat('paused-viewer', 'b', { id: 'cooldown-end' }));
  assert.equal(admitted.ok, true); assert.equal(admitted.team, 'a');
  assert.equal(game.snapshot().elapsedMs, 2000);
});

test('audience updates are smoothed but weighting stays frozen until the next window', () => {
  const { game, advance } = rig();
  game.audience({ a: 1000, b: 100 }, 'twitch', { reset: true });
  assert.equal(game.activity(chat('first')).normalized, 1 / 1000);
  game.audience({ a: 2000, b: 100 }, 'twitch');
  assert.equal(game.snapshot().pressure.audience.a.value, 1300);
  assert.equal(game.activity(chat('same-window')).normalized, 1 / 1000);
  advance(8000);
  const next = game.snapshot().pressure;
  assert.equal(next.denominator.a, 1300);
  assert.equal(next.previous.a, 2 / 1000); assert.equal(next.current.a, 0);
  assert.equal(game.activity(chat('next-window')).normalized, 1 / 1300);
});

test('an offline stream discards fractional shot credit before audience recovery', () => {
  const { game } = rig();
  game.audience({ a: 1000, b: 100 }, 'twitch', { reset: true });
  for (let i = 0; i < 9; i++) game.activity(chat(`before-offline-${i}`));
  assert.equal(game.snapshot().pending.a, 0);
  game.audience({ a: 1000, b: 0 }, 'twitch');
  assert.equal(game.snapshot().pressure.enabled, false);
  game.audience({ a: 1000, b: 100 }, 'twitch', { reset: true });
  game.activity(chat('recovered'));
  assert.equal(game.snapshot().pending.a, 0);
  for (let i = 0; i < 9; i++) game.activity(chat(`after-recovery-${i}`));
  assert.equal(game.snapshot().pending.a, 1);
});

test('tying the pressure resets the sustained-lead clock before a barrage can fire', () => {
  const { game, advance } = rig({ windowMs: 20000 });
  for (let i = 0; i < 3; i++) game.activity(chat(`early-a-${i}`));
  advance(4000);
  for (let i = 0; i < 3; i++) game.activity(chat(`tie-b-${i}`, 'b'));
  for (let i = 0; i < 3; i++) game.activity(chat(`new-a-${i}`));
  advance(4999);
  assert.equal(game.snapshot().pressure.barrage, null);
  advance(1);
  assert.equal(game.snapshot().pressure.barrage, 'a');
  assert.equal(game.snapshot().events.filter(event => event.type === 'barrage').length, 1);
});

test('a knockout settles before the deadline and reset isolates the next round', () => {
  const { game, advance, markers } = rig({ health: 1 });
  game.activity(chat('knockout')); advance(3000);
  const settled = game.snapshot();
  assert.equal(settled.phase, 'finished'); assert.equal(settled.result.winner, 'a');
  assert.deepEqual(settled.result.health, { a: 1, b: 0 });
  assert.ok(settled.elapsedMs < settled.config.durationMs);
  assert.equal(game.activity(chat('after-finish')).ok, false);
  advance(1000); assert.equal(game.snapshot().elapsedMs, settled.elapsedMs);
  assert.throws(() => game.start(), /Reset before starting/);
  game.reset();
  const lobby = game.snapshot();
  assert.notEqual(lobby.id, settled.id); assert.equal(lobby.phase, 'lobby');
  assert.equal(lobby.result, null); assert.deepEqual(lobby.health, { a: 1, b: 1 });
  assert.deepEqual(lobby.shots, { a: 0, b: 0 }); assert.equal(lobby.bullets.length, 0);
  game.audience({ a: 100, b: 100 }, 'synthetic'); markers(); game.start();
  assert.equal(game.activity(chat('knockout')).ok, true);
});

test('mutating a snapshot cannot alter authoritative state or subsequent collisions', () => {
  const { game, advance } = rig();
  game.activity(chat('snapshot')); advance(100);
  const snapshot = game.snapshot(), expected = structuredClone(snapshot);
  snapshot.config.radius = 500;
  snapshot.health.b = 0; snapshot.markers.b.y = 20;
  snapshot.bullets[0].vy = 1000; snapshot.bullets[0].text = 'changed';
  snapshot.pressure.audience.a.value = 1; snapshot.pressure.denominator.a = 1;
  snapshot.events[0].type = 'changed'; snapshot.events.push({ type: 'hit' });
  assert.deepEqual(game.snapshot(), expected);
  advance(2900); assert.equal(game.snapshot().health.b, 4);
});
