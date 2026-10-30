import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PkRooms, SandboxDirectory, SANDBOX_CHANNELS } from '../src/pk-rooms.mjs';

// All identities below are synthetic, directly injected into the service. Native JWT
// verification is covered separately; these are not Twitch accounts or live broadcasts.
const channels = [...SANDBOX_CHANNELS, { id: '90000003', login: 'demo_cyan', name: 'CYAN CREW' }, { id: '90000004', login: 'demo_lime', name: 'LIME CREW' }];
const owner = index => ({ channelId: channels[index].id, userId: channels[index].id, opaqueUserId: `U${channels[index].id}`, role: 'broadcaster', broadcaster: true });
const viewer = (index, userId = '8001') => ({ channelId: channels[index].id, userId, opaqueUserId: `Uopaque${userId}`, role: 'viewer', broadcaster: false });
const A = owner(0), B = owner(1), C = owner(2), D = owner(3);
const action = (service, identity, roomId, command) => service.action(identity, { roomId, action: command });
const play = (service, identity, roomId, command) => service.play(identity, { roomId, command });
const errorCode = (code, status) => error => error.code === code && (status === undefined || error.status === status);

class FakeBridge extends EventEmitter {
  constructor() {
    super(); this.status = { state: 'disabled', message: 'Fake bridge', channels: [] };
    this.started = []; this.replies = []; this.stopped = 0;
  }
  async start(input) { this.started.push(input); this.status.state = 'connected'; }
  async reply(channelId, text) { this.replies.push({ channelId, text }); return true; }
  stop() { this.stopped++; this.status.state = 'disabled'; }
  chat({ channelTeam = 'a', channelId = channels[0].id, userId = '8001', text, name = 'Synthetic Viewer' }) {
    this.emit('chat', { channelTeam, channelId, userId, name, text });
  }
}

function rig(t, options = {}) {
  let now = 1800000000000;
  const events = [];
  const directory = { async resolve({ id, login }) {
    const channel = channels.find(channel => id ? channel.id === id : channel.login === login.toLowerCase());
    if (!channel) throw new Error('Synthetic channel not found.');
    return { ...channel };
  } };
  const service = new PkRooms({ directory, now: () => now, onEvents: (id, entries) => events.push(...entries.map(event => ({ sourceId: id, ...event }))), ...options });
  t.after(() => service.close());
  return { service, directory, events, advance(ms) { now += ms; service.tick(); } };
}
async function invite(service, inviter = A, targetIndex = 1, durationSeconds = 60) {
  const state = await service.invite(inviter, { targetLogin: channels[targetIndex].login, title: 'Synthetic two-streamer PK', durationSeconds });
  return state.room.id;
}
async function start(rig) {
  const { service, advance } = rig, roomId = await invite(service);
  action(service, B, roomId, 'accept'); action(service, A, roomId, 'ready'); action(service, B, roomId, 'ready'); advance(5000);
  return roomId;
}

test('broadcaster B accepts A’s invite, both ready, then the backend automatically starts the round', async t => {
  const { service, advance } = rig(t), roomId = await invite(service);
  assert.equal(service.state(B).room.lifecycle, 'invited');
  assert.equal(service.state(B).roomSide, 'b');
  assert.equal(service.state(A).room.id, service.state(B).room.id);
  assert.throws(() => action(service, A, roomId, 'accept'), error => error.status === 403);
  action(service, B, roomId, 'accept'); assert.equal(service.state(A).room.lifecycle, 'lobby');
  action(service, A, roomId, 'ready'); assert.equal(service.state(B).room.ready.a, true);
  assert.equal(service.state(B).room.lifecycle, 'lobby');
  action(service, B, roomId, 'ready'); assert.equal(service.state(A).room.lifecycle, 'countdown');
  assert.equal(service.state(B).room.countdownRemainingMs, 5000);
  play(service, viewer(0), roomId, '!join');
  assert.throws(() => play(service, viewer(0), roomId, '!attack'), errorCode('not_running'));
  advance(4999); assert.equal(service.state(A).room.lifecycle, 'countdown');
  advance(1); assert.equal(service.state(A).room.lifecycle, 'running');
  assert.equal(service.state(B).room.engine.phase, 'running');
  assert.equal(service.state(A).room.engine.remainingMs, 60000);
});

test('full automatic battle: attacks, halftime defection, changed target and final winner need no host', async t => {
  const instance = rig(t), { service, advance } = instance, roomId = await start(instance);
  for (const id of ['8001', '8002', '8003']) { play(service, viewer(0, id), roomId, '!join'); play(service, viewer(0, id), roomId, '!attack'); }
  let state = service.state(B);
  assert.equal(state.room.engine.teams.a.score, 1); assert.equal(state.room.engine.teams.a.volleys, 1);
  assert.ok(state.room.engine.teams.b.activeChallenge);
  for (const id of ['8004', '8005']) { play(service, viewer(1, id), roomId, '!join'); play(service, viewer(1, id), roomId, '!attack'); }
  assert.throws(() => play(service, viewer(0, '8001'), roomId, '!switch'), errorCode('window_closed'));
  advance(30000); state = service.state(B);
  assert.equal(state.room.engine.defectionRemainingMs, 20000);
  play(service, viewer(1, '8001'), roomId, '!switch');
  play(service, viewer(0, '8001'), roomId, '!attack');
  state = service.state(B);
  assert.equal(state.room.engine.teams.b.score, 1);
  assert.equal(state.room.engine.teams.a.members, 2); assert.equal(state.room.engine.teams.b.members, 3);
  assert.equal(state.room.engine.events.filter(event => event.type === 'attack').at(-1).target, 'a');
  assert.throws(() => play(service, viewer(0, '8001'), roomId, '!switch'), errorCode('already_switched'));
  advance(20000);
  for (const id of ['8001', '8004', '8005']) play(service, viewer(1, id), roomId, '!attack');
  assert.equal(service.state(A).room.engine.teams.b.score, 2);
  advance(10000);
  const a = service.state(A), b = service.state(B);
  assert.equal(a.room.lifecycle, 'finished'); assert.equal(b.room.lifecycle, 'finished');
  assert.deepEqual(a.room.engine.result, { winner: 'b', scores: { a: 1, b: 2 }, provisional: false });
  assert.deepEqual(a.room.engine.result, b.room.engine.result);
  assert.equal(a.room.engine.defectionRemainingMs, 0);
  assert.throws(() => play(service, viewer(1, '8004'), roomId, '!attack'));
});

test('one linked viewer retains allegiance, cooldown and defection history in either channel', async t => {
  const instance = rig(t), { service, advance } = instance, roomId = await start(instance);
  play(service, viewer(0), roomId, '!join');
  play(service, viewer(1), roomId, '!join');
  assert.equal(service.state(A).room.engine.participants, 1);
  assert.equal(service.state(viewer(1)).viewer.team, 'a');
  play(service, viewer(1), roomId, '!attack');
  assert.throws(() => play(service, viewer(0), roomId, '!attack'), errorCode('cooldown'));
  advance(30000); play(service, viewer(1), roomId, '!switch');
  assert.equal(service.state(viewer(0)).viewer.team, 'b');
  assert.equal(service.state(viewer(0)).viewer.switched, true);
  assert.throws(() => play(service, viewer(0), roomId, '!switch'), errorCode('already_switched'));
});

test('viewers cannot invoke streamer actions, forge foreign room IDs or play anonymously', async t => {
  const { service } = rig(t), roomId = await invite(service);
  for (const command of ['accept', 'decline', 'ready', 'unready', 'pause', 'resume', 'leave']) {
    assert.throws(() => action(service, viewer(1), roomId, command), error => error.status === 403);
  }
  assert.throws(() => action(service, C, roomId, 'accept'), errorCode('wrong_room', 403));
  assert.throws(() => action(service, B, 'invented-room-id', 'accept'), errorCode('wrong_room', 403));
  action(service, B, roomId, 'accept');
  assert.throws(() => play(service, viewer(2), roomId, '!join'), errorCode('wrong_room', 403));
  assert.throws(() => play(service, { ...viewer(0), userId: null }, roomId, '!join'), errorCode('identity_required', 403));
  await assert.rejects(service.invite(viewer(0), { targetLogin: channels[1].login }), error => error.status === 403);
});

test('parallel invitations cannot reserve either broadcaster in two active matches', async t => {
  const { service } = rig(t);
  const results = await Promise.allSettled([invite(service, A, 1), invite(service, A, 2), invite(service, D, 1)]);
  const successes = results.filter(result => result.status === 'fulfilled');
  assert.equal(successes.length, 1);
  for (const failed of results.filter(result => result.status === 'rejected')) assert.equal(failed.reason.code, 'channel_busy');
  assert.equal([...service.rooms.values()].filter(room => room.lifecycle === 'invited').length, 1);
});

test('self invitations are rejected and an expired invite frees both channels for a new match', async t => {
  const { service, advance } = rig(t, { invitationMs: 3000 });
  await assert.rejects(invite(service, A, 0), /own channel/);
  const roomId = await invite(service); advance(3000);
  assert.equal(service.state(B).room.lifecycle, 'cancelled');
  assert.equal(service.state(B).room.cancellationReason, 'Invitation expired.');
  assert.throws(() => action(service, B, roomId, 'accept'));
  const next = await invite(service, B, 0);
  assert.notEqual(next, roomId); assert.equal(service.state(A).room.lifecycle, 'invited');
});

test('B can withdraw readiness during countdown without letting the cancelled countdown start', async t => {
  const { service, advance } = rig(t), roomId = await invite(service);
  action(service, B, roomId, 'accept'); action(service, A, roomId, 'ready'); action(service, B, roomId, 'ready');
  advance(2000); action(service, B, roomId, 'unready'); advance(5000);
  let state = service.state(A);
  assert.equal(state.room.lifecycle, 'lobby'); assert.equal(state.room.ready.a, true); assert.equal(state.room.ready.b, false);
  assert.equal(state.room.engine.elapsedMs, 0);
  action(service, B, roomId, 'ready'); advance(5000);
  state = service.state(B); assert.equal(state.room.lifecycle, 'running'); assert.equal(state.room.engine.elapsedMs, 0);
});

test('either broadcaster can pause; all match and defection clocks stay frozen until resumed', async t => {
  const instance = rig(t), { service, advance } = instance, roomId = await start(instance);
  play(service, viewer(0), roomId, '!join'); advance(30000);
  action(service, B, roomId, 'pause'); const before = service.state(A);
  advance(100000); const after = service.state(B);
  assert.equal(after.room.lifecycle, 'paused'); assert.equal(after.room.engine.remainingMs, before.room.engine.remainingMs);
  assert.equal(after.room.engine.defectionRemainingMs, before.room.engine.defectionRemainingMs);
  assert.throws(() => play(service, viewer(0), roomId, '!attack'), errorCode('paused'));
  action(service, A, roomId, 'resume'); advance(1000);
  assert.equal(service.state(B).room.engine.remainingMs, before.room.engine.remainingMs - 1000);
});

test('leaving cancels active play, releases the pair for invitations and isolates old room IDs', async t => {
  const instance = rig(t), { service } = instance, oldRoom = await start(instance);
  action(service, B, oldRoom, 'leave'); assert.equal(service.state(A).room.lifecycle, 'cancelled');
  const next = await invite(service, A, 2);
  assert.notEqual(next, oldRoom);
  assert.throws(() => action(service, A, oldRoom, 'leave'), errorCode('wrong_room', 403));
  assert.equal(service.state(A).room.id, next); assert.equal(service.state(C).room.id, next);
  assert.throws(() => play(service, viewer(0), oldRoom, '!join'), errorCode('wrong_room', 403));
});

test('the room chat bridge shares identity with extension actions and ignores wrong channels and terminal matches', async t => {
  const bridges = [], instance = rig(t, { bridgeFactory: () => { const bridge = new FakeBridge(); bridges.push(bridge); return bridge; } });
  const { service, advance } = instance, roomId = await invite(service);
  assert.equal(bridges.length, 0); action(service, B, roomId, 'accept');
  const bridge = bridges[0]; assert.deepEqual(bridge.started, [{ a: channels[0].login, b: channels[1].login }]);
  bridge.chat({ text: '!join' }); assert.equal(service.state(A).room.engine.participants, 1);
  bridge.chat({ channelId: channels[1].id, channelTeam: 'a', text: '!join', userId: 'wrong-channel' });
  assert.equal(service.state(A).room.engine.participants, 1);
  bridge.chat({ text: '!attack' }); assert.equal(service.state(A).room.engine.teams.a.attacks, 0);
  bridge.chat({ text: '!help' }); assert.equal(bridge.replies.length, 1);
  action(service, A, roomId, 'ready'); action(service, B, roomId, 'ready'); advance(5000);
  bridge.chat({ text: '!attack' }); assert.equal(service.state(viewer(1)).viewer.team, 'a');
  assert.throws(() => play(service, viewer(1), roomId, '!attack'), errorCode('cooldown'));
  action(service, B, roomId, 'pause'); bridge.chat({ text: '!attack', userId: '8002' });
  assert.equal(service.state(A).room.engine.teams.a.attacks, 1);
  action(service, A, roomId, 'resume'); advance(60000);
  assert.equal(bridge.stopped, 1);
  bridge.chat({ text: '!join', userId: '8003' }); bridge.chat({ text: '!help' });
  assert.equal(service.state(A).room.engine.participants, 1); assert.equal(bridge.replies.length, 1);
});

test('sandbox directory is explicit and isolated, and event output is not repeatedly duplicated', async t => {
  const directory = new SandboxDirectory();
  assert.equal((await directory.resolve({ login: 'DEMO_CORAL' })).id, SANDBOX_CHANNELS[0].id);
  await assert.rejects(directory.resolve({ login: 'hongshan333' }), /Sandbox opponent/);
  const instance = rig(t, { directory, mode: 'demo', inputSource: 'local-simulation' });
  const { service, events } = instance; await start(instance);
  const count = events.length; service.tick(); service.state(A); service.state(B);
  assert.equal(events.length, count); assert.ok(events.every(event => event.sourceId.startsWith('local-simulation:')));
  assert.equal(service.state(B).inputSource, 'local-simulation');
});
