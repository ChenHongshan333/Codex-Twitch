import { randomUUID } from 'node:crypto';

const sides = ['a', 'b'];
const other = side => side === 'a' ? 'b' : 'a';
const boundedText = text => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(String(text ?? '').slice(0, 2000))]
  .slice(0, 24).map(part => part.segment).join('').replace(/[\p{Cc}\p{Cf}]/gu, '');
const defaults = Object.freeze({ width: 960, height: 540, radius: 14, bulletWidth: 128, bulletHeight: 28,
  durationMs: 180000, health: 5, invulnerableMs: 1500, warningMs: 800, speed: 300,
  cooldownMs: 2000, windowMs: 8000, freshnessMs: 45000, trackingMs: 1000,
  audienceFloor: 20, referenceAudience: 100, normalRate: 3, barrageRate: 6,
  barrageMs: 6000, sustainMs: 5000, maxPending: 32, maxActive: 32 });

function segmentRect(x0, y0, x1, y1, halfWidth, halfHeight) {
  let low = 0, high = 1;
  for (const [start, delta, extent] of [[x0, x1 - x0, halfWidth], [y0, y1 - y0, halfHeight]]) {
    if (Math.abs(delta) < 1e-9) { if (Math.abs(start) > extent) return false; continue; }
    let a = (-extent - start) / delta, b = (extent - start) / delta;
    if (a > b) [a, b] = [b, a];
    low = Math.max(low, a); high = Math.min(high, b); if (low > high) return false;
  }
  return true;
}
// Swept circle against an axis-aligned rectangle: two strips plus corner circles.
export function sweptHit(x0, y0, x1, y1, hw, hh, radius) {
  if (segmentRect(x0, y0, x1, y1, hw + radius, hh) || segmentRect(x0, y0, x1, y1, hw, hh + radius)) return true;
  const dx = x1 - x0, dy = y1 - y0, length = dx * dx + dy * dy;
  for (const x of [-hw, hw]) for (const y of [-hh, hh]) {
    const t = length ? Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / length)) : 0;
    if ((x0 + t * dx - x) ** 2 + (y0 + t * dy - y) ** 2 <= radius ** 2) return true;
  }
  return false;
}

export class DanmakuEngine {
  constructor({ now = Date.now, random = Math.random, config = {} } = {}) {
    this.now = now; this.random = random;
    for (const [key, value] of Object.entries(config)) if (!(key in defaults) || !Number.isFinite(value) || value <= 0) throw new Error(`Invalid dodge rule: ${key}`);
    this.config = { ...defaults, ...config }; this.reset();
  }
  reset() {
    this.id = randomUUID(); this.phase = 'lobby'; this.elapsed = 0; this.lastTick = this.now();
    this.markers = { a: null, b: null }; this.previous = { a: null, b: null };
    this.counts = { a: null, b: null }; this.audienceSource = 'unavailable';
    this.frozen = { a: null, b: null }; this.normalized = { a: 0, b: 0 }; this.lastPressure = { a: 0, b: 0 };
    this.bucket = 0; this.barrage = null; this.barrageUntil = 0; this.lead = null; this.lastPayload = { a: null, b: null };
    this.health = { a: this.config.health, b: this.config.health }; this.invulnerable = { a: 0, b: 0 };
    this.queues = { a: [], b: [] }; this.credit = { a: 0, b: 0 }; this.nextShot = { a: 0, b: 0 };
    const laneCount = Math.max(1, Math.floor(this.config.height / this.config.bulletHeight));
    const initialLane = Math.floor(this.random() * laneCount);
    this.laneCursor = { a: initialLane, b: initialLane };
    this.shots = { a: 0, b: 0 }; this.players = new Map(); this.seen = new Set();
    this.bullets = []; this.sequence = 0; this.events = []; this.result = null; this.reason = '';
  }
  event(type, data = {}) {
    this.events.push({ id: ++this.sequence, type, at: this.elapsed, ...data });
    if (this.events.length > 30) this.events.shift();
  }
  marker(side, point) {
    if (!sides.includes(side) || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) throw new Error('Marker must have a side and finite coordinates.');
    const { width, height, radius } = this.config;
    this.markers[side] = { x: Math.max(radius, Math.min(width - radius, point.x)), y: Math.max(radius, Math.min(height - radius, point.y)), at: this.now() };
  }
  freshMarkers() { return sides.every(side => this.markers[side] && this.now() - this.markers[side].at < this.config.trackingMs); }
  audience(values, source, { reset = false } = {}) {
    for (const side of sides) {
      const value = values[side], old = this.counts[side];
      if (!Number.isFinite(value) || value <= 0) { this.counts[side] = null; this.frozen[side] = null; }
      else {
        this.counts[side] = { value: old && !reset ? .3 * value + .7 * old.value : value, at: this.now() };
        if (reset || !this.frozen[side]) this.frozen[side] = Math.max(this.config.audienceFloor, this.counts[side].value);
      }
    }
    this.audienceSource = source;
    if (!this.freshAudience()) this.clearPressure();
  }
  freshAudience() { return sides.every(side => this.counts[side] && this.now() - this.counts[side].at < this.config.freshnessMs); }
  clearPressure() {
    this.normalized = { a: 0, b: 0 }; this.credit = { a: 0, b: 0 };
    this.queues = { a: [], b: [] }; this.barrage = null; this.barrageUntil = 0; this.lead = null;
  }
  moderate() {
    // Conservative retraction: never continue displaying text after a deletion,
    // clear, or ban. Already awarded damage is not reversed.
    this.clearPressure(); this.bullets = []; this.lastPayload = { a: null, b: null };
    this.event('moderated');
  }
  start() {
    if (this.phase !== 'lobby') throw new Error('Reset before starting a new round.');
    if (!this.freshMarkers()) throw new Error('Both markers must be tracking before starting.');
    this.phase = 'running'; this.lastTick = this.now(); this.previous = structuredClone(this.markers);
    this.event('started');
  }
  pause(reason = 'Operator paused') { if (this.phase === 'running') { this.phase = 'paused'; this.reason = reason; this.event('paused', { reason }); } }
  resume() {
    if (this.phase !== 'paused') throw new Error('Round is not paused.');
    if (!this.freshMarkers()) throw new Error('Recover both markers before resuming.');
    this.phase = 'running'; this.reason = ''; this.lastTick = this.now(); this.previous = structuredClone(this.markers); this.event('resumed');
  }
  switchOpen() { return Math.abs(this.elapsed - this.config.durationMs / 2) <= Math.min(15000, this.config.durationMs / 4); }
  activity({ id, userId, channelTeam, text = '', kind = 'chat', units = 1 }) {
    if (this.phase !== 'running' || !sides.includes(channelTeam) || !['chat', 'cheer', 'gift'].includes(kind)) return { ok: false, reason: 'Round is not running or input is invalid.' };
    if (typeof id !== 'string' || !id || id.length > 200 || this.seen.has(id)) return { ok: false, reason: 'Duplicate or missing event ID.' };
    this.seen.add(id); if (this.seen.size > 5000) this.seen.delete(this.seen.values().next().value);
    if (userId != null && (typeof userId !== 'string' || !userId || userId.length > 200)) return { ok: false, reason: 'Invalid user.' };
    let player = userId ? this.players.get(userId) : null;
    if (!player && userId) {
      if (this.players.size >= 10000) return { ok: false, reason: 'Player capacity reached.' };
      player = { team: channelTeam, switched: false, nextAt: 0 }; this.players.set(userId, player);
    }
    if (text.trim().toLowerCase() === '!switch' && kind === 'chat') {
      if (!player || !this.switchOpen() || player.switched) return { ok: false, reason: 'One switch is allowed during the middle window.' };
      const from = player.team; player.team = other(from); player.switched = true;
      this.event('defected', { from, to: player.team }); return { ok: true, team: player.team, switched: true };
    }
    if (kind === 'chat' && text.trim().startsWith('!') && text.trim().toLowerCase() !== '!attack') return { ok: false, reason: 'Use ordinary chat, !attack or !switch.' };
    if (kind === 'chat' && !text.trim()) return { ok: false, reason: 'Empty chat.' };
    if (!userId && kind !== 'gift') return { ok: false, reason: 'Only gifts can be anonymous.' };
    if (player && this.elapsed < player.nextAt) return { ok: false, reason: 'Activity cooldown is shared across both channels.' };
    if (!this.freshAudience()) { this.clearPressure(); return { ok: false, reason: 'Waiting for fresh live audience counts for both streams.' }; }
    if (player) player.nextAt = this.elapsed + this.config.cooldownMs;
    const team = player?.team ?? channelTeam;
    const weight = kind === 'chat' ? 1 : Math.max(1, Math.min(3, Number.isFinite(units) ? units : 1));
    const normalized = weight / this.frozen[channelTeam];
    this.normalized[team] += normalized;
    const a = this.normalized.a, b = this.normalized.b;
    const leader = Math.abs(a - b) >= .02 && Math.max(a, b) >= Math.max(.001, Math.min(a, b)) * 1.5 ? (a > b ? 'a' : 'b') : null;
    if (!leader) this.lead = null;
    else if (this.lead?.side !== leader) this.lead = { side: leader, since: this.elapsed };
    this.credit[team] = Math.min(4, this.credit[team] + normalized * this.config.referenceAudience);
    while (this.credit[team] >= 1 - 1e-9) {
      this.credit[team] = Math.max(0, this.credit[team] - 1);
      if (this.queues[team].length < this.config.maxPending) this.queues[team].push({ text: boundedText(text === '!attack' ? 'Attack!' : text), kind });
    }
    return { ok: true, team, normalized };
  }
  spawn(from, payload) {
    const target = other(from), laneCount = Math.max(1, Math.floor(this.config.height / this.config.bulletHeight));
    const lane = this.laneCursor[target] % laneCount;
    this.laneCursor[target] = (lane + 1) % laneCount;
    // Both arenas use the same readable left-to-right lanes. Stream activity
    // decides which arena receives a message; marker position never steers it.
    const x = -this.config.bulletWidth / 2;
    const y = (lane + .5) * this.config.height / laneCount;
    this.bullets.push({ id: ++this.sequence, from, target, ...payload, x, y,
      vx: this.config.speed, vy: 0,
      armsAt: this.elapsed + this.config.warningMs,
      expiresAt: this.elapsed + this.config.warningMs + (this.config.width + this.config.bulletWidth) / this.config.speed * 1000 + 1000 });
    this.lastPayload[from] = payload; this.shots[from]++; this.event('shot', { from, target });
  }
  tick() {
    const wall = this.now(), dt = Math.max(0, wall - this.lastTick); this.lastTick = wall;
    if (this.phase !== 'running') return;
    if (!this.freshMarkers() || dt > 500) { this.pause('Tracking lost or simulation stalled — recover markers, then Resume'); return; }
    if (!this.freshAudience()) this.clearPressure();
    const end = Math.min(this.config.durationMs, this.elapsed + dt);
    while (this.elapsed < end && this.phase === 'running') {
      const before = this.elapsed, step = Math.min(20, end - before); this.elapsed += step;
      const bucket = Math.floor(this.elapsed / this.config.windowMs);
      if (bucket !== this.bucket) {
        this.lastPressure = { ...this.normalized };
        this.bucket = bucket; this.normalized = { a: 0, b: 0 }; this.lead = null;
        for (const side of sides) this.frozen[side] = this.counts[side] ? Math.max(this.config.audienceFloor, this.counts[side].value) : null;
      }
      if (this.freshAudience() && this.lead && !this.lead.fired && this.elapsed - this.lead.since >= this.config.sustainMs) {
        this.barrage = this.lead.side; this.barrageUntil = this.elapsed + this.config.barrageMs; this.lead.fired = true;
        this.event('barrage', { from: this.barrage });
      }
      if (this.elapsed >= this.barrageUntil) this.barrage = null;
      for (const side of sides) if (this.elapsed >= this.nextShot[side] && (this.queues[side].length || this.barrage === side && this.lastPayload[side]) && this.bullets.filter(b => b.target === other(side)).length < this.config.maxActive) {
        this.spawn(side, this.queues[side].shift() ?? this.lastPayload[side]);
        this.nextShot[side] = this.elapsed + 1000 / (this.barrage === side ? this.config.barrageRate : this.config.normalRate);
      }
      this.bullets = this.bullets.filter(bullet => {
        const movingMs = Math.max(0, this.elapsed - Math.max(before, bullet.armsAt));
        const x0 = bullet.x, y0 = bullet.y;
        bullet.x += bullet.vx * movingMs / 1000; bullet.y += bullet.vy * movingMs / 1000;
        const marker = this.markers[bullet.target], previous = this.previous[bullet.target] ?? marker;
        // Interpolate marker movement over this tick, rather than teleport past shots.
        const startT = dt ? (before - (end - dt)) / dt : 1, endT = dt ? (this.elapsed - (end - dt)) / dt : 1;
        const px0 = previous.x + (marker.x - previous.x) * startT, py0 = previous.y + (marker.y - previous.y) * startT;
        const px1 = previous.x + (marker.x - previous.x) * endT, py1 = previous.y + (marker.y - previous.y) * endT;
        if (movingMs > 0 && sweptHit(x0 - px0, y0 - py0, bullet.x - px1, bullet.y - py1, this.config.bulletWidth / 2, this.config.bulletHeight / 2, this.config.radius)) {
          if (this.elapsed >= this.invulnerable[bullet.target]) {
            this.health[bullet.target]--; this.invulnerable[bullet.target] = this.elapsed + this.config.invulnerableMs;
            this.event('hit', { target: bullet.target, health: this.health[bullet.target] });
          }
          return false;
        }
        return this.elapsed < bullet.expiresAt && bullet.x > -200 && bullet.x < this.config.width + 200 && bullet.y > -100 && bullet.y < this.config.height + 100;
      });
      if (this.health.a <= 0 || this.health.b <= 0) this.finish();
    }
    this.previous = structuredClone(this.markers);
    if (this.elapsed >= this.config.durationMs && this.phase === 'running') this.finish();
  }
  finish() {
    this.phase = 'finished'; this.result = { winner: this.health.a === this.health.b ? 'tie' : this.health.a > this.health.b ? 'a' : 'b', health: { ...this.health } };
    this.event('finished', this.result);
  }
  snapshot() {
    return structuredClone({ id: this.id, phase: this.phase, reason: this.reason, config: this.config,
      elapsedMs: this.elapsed, remainingMs: Math.max(0, this.config.durationMs - this.elapsed),
      health: this.health, markers: this.markers, tracking: Object.fromEntries(sides.map(side => [side, Boolean(this.markers[side] && this.now() - this.markers[side].at < this.config.trackingMs)])),
      invulnerable: Object.fromEntries(sides.map(side => [side, this.elapsed < this.invulnerable[side]])),
      pressure: { enabled: this.freshAudience(), current: this.normalized, previous: this.lastPressure, barrage: this.barrage, barrageRemainingMs: Math.max(0, this.barrageUntil - this.elapsed), source: this.audienceSource,
        audience: this.counts, denominator: this.frozen, windowRemainingMs: this.config.windowMs - this.elapsed % this.config.windowMs },
      switchOpen: this.switchOpen() && this.phase === 'running', pending: { a: this.queues.a.length, b: this.queues.b.length },
      shots: this.shots, bullets: this.bullets, events: this.events, result: this.result });
  }
}
