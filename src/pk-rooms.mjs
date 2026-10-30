import { randomUUID } from 'node:crypto';
import { MatchEngine, RuleError } from './engine.mjs';

const TERMINAL = new Set(['finished', 'cancelled']);
const CONNECTED_COMMANDS = new Set(['!join', '!attack', '!switch']);

function fail(message, status = 400, code = 'invalid_action') {
  const error = new RuleError(message, code); error.status = status; throw error;
}
function requireBroadcaster(identity) {
  if (!identity?.broadcaster || identity.userId !== identity.channelId) fail('Only this channel’s broadcaster can manage a PK.', 403);
}

// Both production and sandbox instantiate this service. Each uses a separate room registry,
// identity verifier and channel directory; simulated accounts can never join production rooms.
export class PkRooms {
  constructor({ directory, now = Date.now, countdownMs = 5000, invitationMs = 90000,
    mode = 'live', inputSource = 'twitch-extension', bridgeFactory = null, onEvents = () => {}, maxRooms = 8 } = {}) {
    this.directory = directory; this.now = now; this.countdownMs = countdownMs; this.invitationMs = invitationMs;
    this.mode = mode; this.inputSource = inputSource; this.bridgeFactory = bridgeFactory; this.onEvents = onEvents; this.maxRooms = maxRooms;
    this.rooms = new Map(); this.channelRooms = new Map();
  }
  roomFor(channelId) { const id = this.channelRooms.get(channelId); return id ? this.rooms.get(id) ?? null : null; }
  side(room, channelId) { return room.channels.a.id === channelId ? 'a' : room.channels.b.id === channelId ? 'b' : null; }
  access(identity, roomId) {
    const room = this.rooms.get(roomId);
    if (!room || !this.side(room, identity.channelId) || this.roomFor(identity.channelId)?.id !== room.id) fail('This channel is not part of that PK.', 403, 'wrong_room');
    return room;
  }
  busy(channelId) { const room = this.roomFor(channelId); return room && !TERMINAL.has(room.lifecycle); }
  async invite(identity, input) {
    requireBroadcaster(identity); this.tick();
    if (!input || typeof input.targetLogin !== 'string' || !/^[a-zA-Z0-9_]{3,25}$/.test(input.targetLogin)) fail('Enter your opponent’s Twitch login, not a URL.');
    const title = input.title === undefined ? 'Draw your rival’s mascot' : input.title;
    const durationSeconds = input.durationSeconds ?? 180;
    if (typeof title !== 'string' || !title.trim() || title.length > 100) fail('Provide a challenge title of 1–100 characters.');
    if (!Number.isInteger(durationSeconds) || durationSeconds < 30 || durationSeconds > 900) fail('Choose a round length between 30 and 900 seconds.');
    if (this.busy(identity.channelId)) fail('Your channel already has an active PK or invitation.', 409, 'channel_busy');
    const [self, target] = await Promise.all([this.directory.resolve({ id: identity.channelId }), this.directory.resolve({ login: input.targetLogin })]);
    if (self.id === target.id) fail('Choose another broadcaster. You cannot PK your own channel.');
    // Recheck after the asynchronous directory lookup to avoid double invitations racing.
    if (this.busy(self.id) || this.busy(target.id)) fail('One of these channels already has an active PK or invitation.', 409, 'channel_busy');
    if ([...this.rooms.values()].filter(room => !TERMINAL.has(room.lifecycle)).length >= this.maxRooms) fail('The PK service is full. Try again after a match finishes.', 503);
    const engine = new MatchEngine({ now: this.now, mode: this.mode, config: {
      title: title.trim(), channelA: self.login, channelB: target.login, nameA: self.name, nameB: target.name,
      durationSeconds, scoringMode: 'community', autoDefection: true,
      defectionDurationSeconds: Math.min(30, Math.floor(durationSeconds / 3)),
    } });
    const room = { id: randomUUID(), revision: 1, lifecycle: 'invited', channels: { a: self, b: target },
      inviterChannelId: self.id, ready: { a: false, b: false }, createdAt: this.now(), invitationEndsAt: this.now() + this.invitationMs,
      countdownEndsAt: null, engine, bridge: null, loggedSequence: 0, lastActivityAt: this.now(), cancellationReason: null };
    this.rooms.set(room.id, room); this.channelRooms.set(self.id, room.id); this.channelRooms.set(target.id, room.id);
    this.flush(room); return this.state(identity);
  }
  action(identity, input) {
    requireBroadcaster(identity); this.tick();
    const room = this.access(identity, input.roomId), side = this.side(room, identity.channelId);
    switch (input.action) {
      case 'accept':
        if (room.lifecycle !== 'invited' || side !== 'b') fail('Only the invited broadcaster can accept this invitation.', 403);
        room.lifecycle = 'lobby'; room.invitationEndsAt = null;
        if (this.bridgeFactory) {
          room.bridge = this.bridgeFactory(room);
          room.bridge.on('chat', chat => {
            const expected = room.channels[chat.channelTeam];
            if (TERMINAL.has(room.lifecycle) || !expected || chat.channelId !== expected.id) return;
            try {
              const result = room.engine.command(chat);
              if (result.help) void room.bridge.reply(chat.channelId, result.text);
              this.flush(room);
            } catch (error) { if (!(error instanceof RuleError)) console.error('[PK] Chat processing failed.'); }
          });
          void Promise.resolve(room.bridge.start({ a: room.channels.a.login, b: room.channels.b.login })).catch(() => {
            room.bridge.stop();
          });
        }
        break;
      case 'decline':
        if (room.lifecycle !== 'invited' || side !== 'b') fail('Only the invited broadcaster can decline.', 403);
        this.cancel(room, 'Invitation declined.'); break;
      case 'ready':
        if (room.lifecycle !== 'lobby') fail('Accept the invitation before marking ready.');
        room.ready[side] = true;
        if (room.ready.a && room.ready.b) { room.lifecycle = 'countdown'; room.countdownEndsAt = this.now() + this.countdownMs; }
        break;
      case 'unready':
        if (!['lobby', 'countdown'].includes(room.lifecycle)) fail('The match has already started. Pause or leave instead.');
        room.ready[side] = false; room.lifecycle = 'lobby'; room.countdownEndsAt = null; break;
      case 'pause':
        if (room.lifecycle !== 'running') fail('The round is not running.');
        room.engine.pause(); room.lifecycle = 'paused'; break;
      case 'resume':
        if (room.lifecycle !== 'paused') fail('The round is not paused.');
        room.engine.resume(); room.lifecycle = 'running'; break;
      case 'leave':
        if (TERMINAL.has(room.lifecycle)) {
          for (const channel of Object.values(room.channels)) if (this.channelRooms.get(channel.id) === room.id) this.channelRooms.delete(channel.id);
        } else this.cancel(room, `${room.channels[side].name} left the PK.`);
        break;
      default: fail('Unknown broadcaster action.');
    }
    room.revision++; room.lastActivityAt = this.now(); this.flush(room);
    return this.state(identity);
  }
  play(identity, input) {
    this.tick();
    if (!identity.userId) fail('Share your Twitch identity in the extension to join or play.', 403, 'identity_required');
    const room = this.access(identity, input.roomId);
    if (!['lobby', 'countdown', 'running', 'paused'].includes(room.lifecycle)) fail('Wait for both streamers to accept and prepare the PK.');
    if (!CONNECTED_COMMANDS.has(input.command)) fail('Unknown viewer command.');
    const channelTeam = this.side(room, identity.channelId);
    room.engine.command({ userId: identity.userId, name: `Viewer ${identity.userId.slice(-6)}`, channelTeam, text: input.command });
    room.lastActivityAt = this.now(); this.flush(room); return this.state(identity);
  }
  cancel(room, reason) {
    if (['running', 'paused'].includes(room.engine.phase)) room.engine.finish();
    room.lifecycle = 'cancelled'; room.cancellationReason = reason; room.countdownEndsAt = null; room.invitationEndsAt = null;
    room.bridge?.stop(); room.revision++; room.lastActivityAt = this.now();
  }
  tick() {
    for (const room of this.rooms.values()) {
      if (room.lifecycle === 'invited' && this.now() >= room.invitationEndsAt) this.cancel(room, 'Invitation expired.');
      if (room.lifecycle === 'countdown' && this.now() >= room.countdownEndsAt) { room.engine.start(); room.lifecycle = 'running'; room.countdownEndsAt = null; room.revision++; }
      if (room.lifecycle === 'running') {
        room.engine.tick();
        if (room.engine.phase === 'finished') { room.lifecycle = 'finished'; room.revision++; room.lastActivityAt = this.now(); room.bridge?.stop(); }
      }
      this.flush(room);
      if (TERMINAL.has(room.lifecycle) && this.now() - room.lastActivityAt > 3600000) {
        room.bridge?.stop(); this.rooms.delete(room.id);
        for (const channel of Object.values(room.channels)) if (this.channelRooms.get(channel.id) === room.id) this.channelRooms.delete(channel.id);
      }
    }
    const history = [...this.rooms.values()].filter(room => TERMINAL.has(room.lifecycle)).sort((a, b) => a.lastActivityAt - b.lastActivityAt);
    for (const room of history.slice(0, Math.max(0, history.length - 64))) {
      room.bridge?.stop(); this.rooms.delete(room.id);
      for (const channel of Object.values(room.channels)) if (this.channelRooms.get(channel.id) === room.id) this.channelRooms.delete(channel.id);
    }
  }
  flush(room) {
    const events = room.engine.events.filter(event => event.id > room.loggedSequence);
    if (events.length) { this.onEvents(`${this.inputSource}:${room.id}`, events); room.loggedSequence = events.at(-1).id; }
  }
  state(identity) {
    this.tick(); const room = this.roomFor(identity.channelId);
    const player = room && identity.userId ? room.engine.players.get(identity.userId) : null;
    return {
      identity: { channelId: identity.channelId, userId: identity.userId ?? null, opaqueUserId: identity.opaqueUserId, role: identity.role, broadcaster: identity.broadcaster },
      roomSide: room ? this.side(room, identity.channelId) : null, inputSource: this.inputSource,
      viewer: { joined: Boolean(player), team: player?.team ?? null, switched: player?.switched ?? false,
        attackReadyInMs: player ? Math.max(0, room.engine.config.userCooldownSeconds * 1000 - (room.engine.elapsed() - player.lastAttackAt)) : 0 },
      liveChat: room?.bridge?.status ?? { state: 'disabled', message: this.inputSource === 'local-simulation' ? 'Simulated accounts. No Twitch events.' : 'Native extension buttons are active; chat bridge starts after acceptance when configured.', channels: [] },
      room: room ? {
        id: room.id, revision: room.revision + room.engine.revision, lifecycle: room.lifecycle,
        channels: structuredClone(room.channels), inviterChannelId: room.inviterChannelId, ready: { ...room.ready },
        countdownRemainingMs: room.countdownEndsAt ? Math.max(0, room.countdownEndsAt - this.now()) : 0,
        invitationRemainingMs: room.invitationEndsAt ? Math.max(0, room.invitationEndsAt - this.now()) : 0,
        cancellationReason: room.cancellationReason, engine: room.engine.snapshot(),
      } : null,
    };
  }
  close() { for (const room of this.rooms.values()) room.bridge?.stop(false); }
}

export const SANDBOX_CHANNELS = Object.freeze([
  { id: '90000001', login: 'demo_coral', name: 'CORAL CREW' },
  { id: '90000002', login: 'demo_violet', name: 'VIOLET CREW' },
]);
export class SandboxDirectory {
  async resolve({ id, login }) {
    const channel = SANDBOX_CHANNELS.find(channel => id ? channel.id === id : channel.login === login.toLowerCase());
    if (!channel) fail('Sandbox opponent must be demo_coral or demo_violet.');
    return { ...channel };
  }
}
