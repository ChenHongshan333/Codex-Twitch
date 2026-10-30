import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine, RuleError, validateConfig } from '../src/engine.mjs';

function rig(config = {}) {
  let time = 1000000;
  const engine = new MatchEngine({ now: () => time, config: { autoDefection: false, ...config } });
  return { engine, advance(ms) { time += ms; engine.tick(); }, chat(id, text, team = 'a') { return engine.command({ userId: id, name: id, channelTeam: team, text }); } };
}

test('viewers retain one identity and allegiance across both chats', () => {
  const { engine, chat } = rig();
  chat('alex', '!join', 'a');
  assert.equal(chat('alex', '!join', 'b').team, 'a');
  assert.equal(engine.snapshot().participants, 1);
  assert.equal(engine.snapshot().teams.b.members, 0);
  engine.start(); chat('alex', '!attack', 'b');
  assert.equal(engine.events.at(-1).team, 'a');
  assert.equal(engine.events.at(-1).target, 'b');
  assert.throws(() => chat('alex', '!attack', 'b'), error => error.code === 'cooldown');
});

test('three distinct viewers trigger a challenge on the opposite streamer, without changing scores', () => {
  const { engine, chat } = rig(); engine.start();
  for (const id of ['a1', 'a2', 'a3']) { chat(id, '!join'); chat(id, '!attack'); }
  const state = engine.snapshot();
  assert.equal(state.teams.a.activeChallenge, null);
  assert.equal(state.teams.b.activeChallenge.text, state.config.challenges[0]);
  assert.equal(state.teams.a.volleys, 1);
  assert.equal(state.teams.a.energy, 0);
  assert.equal(state.teams.a.score + state.teams.b.score, 0);
});

test('team cooldown caps bursts and automatically releases a charged attack later', () => {
  const { engine, chat, advance } = rig({ attackThreshold: 1 }); engine.start();
  chat('a1', '!join'); chat('a1', '!attack');
  chat('a2', '!join'); chat('a2', '!attack');
  assert.equal(engine.teams.a.energy, 1); assert.equal(engine.teams.a.volleys, 1);
  advance(19999); assert.equal(engine.teams.a.volleys, 1);
  advance(1); assert.equal(engine.teams.a.volleys, 2);
});

test('challenge queue is bounded to one and promotes after its active timer expires', () => {
  const { engine, chat, advance } = rig({ attackThreshold: 1, volleyCooldownSeconds: 1, challengeDurationSeconds: 5, userCooldownSeconds: 1 });
  engine.start(); chat('a1', '!join'); chat('a1', '!attack');
  advance(1000); chat('a1', '!attack');
  assert.ok(engine.teams.b.activeChallenge); assert.ok(engine.teams.b.queuedChallenge);
  advance(1000); chat('a1', '!attack');
  assert.equal(engine.teams.a.volleys, 2); assert.equal(engine.teams.a.energy, 1);
  advance(3000);
  assert.equal(engine.teams.b.activeChallenge.text, engine.config.challenges[1]);
  assert.equal(engine.teams.a.volleys, 3);
  assert.equal(engine.teams.b.queuedChallenge.text, engine.config.challenges[2]);
});

test('defection works only inside the window, once per round, and changes the attack target', () => {
  const { engine, chat, advance } = rig(); chat('alex', '!join'); engine.start();
  assert.throws(() => chat('alex', '!switch'), error => error.code === 'window_closed');
  chat('alex', '!attack'); engine.openDefection(); chat('alex', '!switch', 'b');
  assert.equal(engine.snapshot().teams.a.members, 0); assert.equal(engine.snapshot().teams.b.members, 1);
  assert.throws(() => chat('alex', '!switch'), error => error.code === 'already_switched');
  assert.throws(() => chat('alex', '!attack'), error => error.code === 'cooldown');
  advance(10000); chat('alex', '!attack', 'a');
  assert.equal(engine.events.at(-1).team, 'b'); assert.equal(engine.events.at(-1).target, 'a');
  advance(20000); assert.equal(engine.snapshot().defectionRemainingMs, 0);
  assert.throws(() => engine.openDefection(), RuleError);
});

test('pause freezes round, challenge, defection and viewer cooldown timers', () => {
  const { engine, chat, advance } = rig({ attackThreshold: 1 }); engine.start(); chat('alex', '!join'); chat('alex', '!attack'); engine.openDefection();
  advance(2000); engine.pause(); const before = engine.snapshot();
  advance(60000); const after = engine.snapshot();
  assert.equal(after.elapsedMs, before.elapsedMs);
  assert.equal(after.defectionRemainingMs, before.defectionRemainingMs);
  assert.equal(after.teams.b.activeChallenge.endsAt, before.teams.b.activeChallenge.endsAt);
  assert.throws(() => chat('alex', '!switch'), error => error.code === 'paused');
  engine.resume(); advance(1000);
  assert.equal(engine.elapsed(), 3000);
  assert.throws(() => chat('alex', '!attack'), error => error.code === 'cooldown');
});

test('automatic halftime window opens exactly once, and the round finishes at its deadline', () => {
  const { engine, chat, advance } = rig({ durationSeconds: 60, defectionDurationSeconds: 5, autoDefection: true }); engine.start();
  advance(30000); assert.equal(engine.snapshot().defectionRemainingMs, 5000);
  advance(5000); assert.equal(engine.snapshot().defectionRemainingMs, 0);
  advance(25000); assert.equal(engine.phase, 'finished');
  assert.throws(() => chat('alex', '!join'), error => error.code === 'finished');
  assert.equal(engine.events.filter(event => event.type === 'window_open').length, 1);
  assert.equal(engine.events.filter(event => event.type === 'finished').length, 1);
});

test('only host scores determine the provisional and confirmed result', () => {
  const { engine } = rig(); engine.start(); engine.setScore('a', 3); engine.setScore('b', 2); engine.finish();
  assert.deepEqual(engine.result, { winner: 'a', scores: { a: 3, b: 2 }, provisional: true });
  engine.confirmResult(); assert.equal(engine.result.provisional, false);
  engine.setScore('b', 4); assert.equal(engine.result.winner, 'b'); assert.equal(engine.result.provisional, true);
  engine.confirmResult(); assert.equal(engine.result.provisional, false);
});

test('reset clears viewers and timers, keeps configuration, and gives a new match ID', () => {
  const { engine, chat } = rig(); const id = engine.id;
  chat('alex', '!join'); engine.start(); engine.openDefection(); engine.reset('live');
  assert.notEqual(engine.id, id); assert.equal(engine.phase, 'lobby'); assert.equal(engine.players.size, 0);
  assert.equal(engine.mode, 'live'); assert.equal(engine.config.channelA, 'hongshan333');
  assert.equal(engine.snapshot().defectionRemainingMs, 0);
});

test('settings cannot change mid-round or after recruiting viewers', () => {
  const { engine, chat } = rig(); chat('alex', '!join');
  assert.throws(() => engine.configure({ title: 'New title' }), RuleError);
  engine.start(); assert.throws(() => engine.configure({ channelA: 'other' }), RuleError);
  assert.equal(engine.config.title, 'Draw your rival’s mascot');
});

test('invalid config, scores and unknown commands do not affect the match', () => {
  assert.throws(() => validateConfig({ channelA: 'https://twitch.tv/example' }), RuleError);
  assert.throws(() => validateConfig({ channelB: 'hongshan333' }), RuleError);
  for (const value of [0, NaN, Infinity, 2.5, '300']) assert.throws(() => validateConfig({ durationSeconds: value }), RuleError);
  assert.throws(() => validateConfig({ challenges: [''] }), RuleError);
  const { engine, chat } = rig(); engine.start();
  assert.throws(() => engine.setScore('a', -1), RuleError);
  assert.deepEqual(chat('nobody', 'Hello everyone!'), { ignored: true });
  assert.equal(engine.players.size, 0);
});

test('returned snapshots cannot mutate authoritative state', () => {
  const { engine } = rig(); const state = engine.snapshot();
  state.config.challenges[0] = 'Modified'; state.teams.a.score = 9000; state.events[0].text = 'Modified';
  assert.notEqual(engine.config.challenges[0], 'Modified'); assert.equal(engine.teams.a.score, 0); assert.notEqual(engine.events[0].text, 'Modified');
});

test('host cancellation clears both the active and queued challenge', () => {
  const { engine, chat, advance } = rig({ attackThreshold: 1, volleyCooldownSeconds: 1, userCooldownSeconds: 1 });
  engine.start(); chat('viewer', '!join'); chat('viewer', '!attack'); advance(1000); chat('viewer', '!attack');
  assert.ok(engine.teams.b.activeChallenge); assert.ok(engine.teams.b.queuedChallenge);
  engine.cancelChallenge('b');
  assert.equal(engine.teams.b.activeChallenge, null); assert.equal(engine.teams.b.queuedChallenge, null);
});
