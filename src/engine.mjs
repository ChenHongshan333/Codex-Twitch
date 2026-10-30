import { randomUUID } from 'node:crypto';

export const TEAMS = ['a', 'b'];
export const opposite = team => team === 'a' ? 'b' : 'a';
export const DEFAULT_CONFIG = Object.freeze({
  title: 'Draw your rival’s mascot',
  channelA: 'hongshan333', channelB: '',
  nameA: 'HONGSHAN333', nameB: 'CHALLENGER',
  durationSeconds: 300, attackThreshold: 3, userCooldownSeconds: 10,
  volleyCooldownSeconds: 20, challengeDurationSeconds: 15,
  defectionDurationSeconds: 30, autoDefection: true,
  scoringMode: 'manual',
  challenges: ['Draw using only straight lines', 'Narrate like a supervillain', 'Do not use your favorite color'],
});

export class RuleError extends Error {
  constructor(message, code = 'invalid_action') { super(message); this.code = code; }
}

function bounded(value, key, min, max) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new RuleError(`${key} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

export function validateConfig(input = {}) {
  const config = { ...DEFAULT_CONFIG, ...input };
  const allowed = new Set(Object.keys(DEFAULT_CONFIG));
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new RuleError(`Unknown setting: ${key}`);
  for (const key of ['title', 'nameA', 'nameB']) {
    if (typeof config[key] !== 'string' || !config[key].trim() || config[key].length > 100) {
      throw new RuleError(`${key} must contain 1–100 characters.`);
    }
    config[key] = config[key].trim();
  }
  for (const key of ['channelA', 'channelB']) {
    if (typeof config[key] !== 'string') throw new RuleError(`${key} must be a Twitch channel login.`);
    config[key] = config[key].trim().toLowerCase();
    if (config[key] && !/^[a-z0-9_]{3,25}$/.test(config[key])) throw new RuleError(`${key} must be a Twitch channel login, not a URL.`);
  }
  if (config.channelA && config.channelA === config.channelB) throw new RuleError('Choose two different Twitch channels.');
  bounded(config.durationSeconds, 'Round length', 30, 3600);
  bounded(config.attackThreshold, 'Attack threshold', 1, 50);
  bounded(config.userCooldownSeconds, 'Viewer cooldown', 1, 120);
  bounded(config.volleyCooldownSeconds, 'Team cooldown', 1, 120);
  bounded(config.challengeDurationSeconds, 'Challenge length', 5, 120);
  bounded(config.defectionDurationSeconds, 'Defection window', 5, 120);
  if (typeof config.autoDefection !== 'boolean') throw new RuleError('autoDefection must be a boolean.');
  if (!['manual', 'community'].includes(config.scoringMode)) throw new RuleError('scoringMode must be manual or community.');
  if (!Array.isArray(config.challenges) || config.challenges.length < 1 || config.challenges.length > 10 ||
      config.challenges.some(text => typeof text !== 'string' || !text.trim() || text.length > 160)) {
    throw new RuleError('Provide 1–10 challenges, each 1–160 characters.');
  }
  config.challenges = config.challenges.map(text => text.trim());
  return config;
}

export class MatchEngine {
  constructor({ now = Date.now, config = {}, mode = 'demo' } = {}) {
    this.now = now;
    this.config = validateConfig(config);
    this.revision = 0;
    this.reset(mode);
  }

  reset(mode = this.mode) {
    if (!['demo', 'live'].includes(mode)) throw new RuleError('Unknown input mode.');
    this.id = randomUUID(); this.mode = mode; this.phase = 'lobby';
    this.elapsedBase = 0; this.resumedAt = null; this.players = new Map();
    this.events = []; this.sequence = 0; this.result = null;
    this.windowEndsAt = null; this.windowUsed = false; this.challengeIndex = 0;
    this.teams = Object.fromEntries(TEAMS.map(team => [team, {
      score: 0, energy: 0, attacks: 0, volleys: 0, nextVolleyAt: 0,
      activeChallenge: null, queuedChallenge: null, switchedIn: 0, switchedOut: 0,
    }]));
    this.record('reset', { text: `${mode === 'demo' ? 'Demo' : 'Twitch'} room ready. Recruit your chat.` });
  }

  elapsed() { return this.elapsedBase + (this.phase === 'running' ? Math.max(0, this.now() - this.resumedAt) : 0); }
  record(type, data = {}) {
    this.events.push({ id: ++this.sequence, type, at: this.now(), ...data });
    if (this.events.length > 100) this.events.shift();
    this.revision++;
  }
  configure(input) {
    if (this.phase !== 'lobby') throw new RuleError('Reset the match before changing settings.');
    if (this.players.size) throw new RuleError('Reset the match before changing settings after viewers have joined.');
    this.config = validateConfig({ ...this.config, ...input });
    this.record('configured', { text: 'Match settings updated.' });
  }
  start() {
    if (this.phase !== 'lobby') throw new RuleError('Only a ready room can start.');
    this.phase = 'running'; this.resumedAt = this.now();
    this.record('started', { text: 'The round is live. Your chat is their problem.' });
  }
  pause() {
    this.tick();
    if (this.phase !== 'running') throw new RuleError('The match is not running.');
    this.elapsedBase = this.elapsed(); this.resumedAt = null; this.phase = 'paused';
    this.record('paused', { text: 'Match paused. All game timers are frozen.' });
  }
  resume() {
    if (this.phase !== 'paused') throw new RuleError('The match is not paused.');
    this.resumedAt = this.now(); this.phase = 'running';
    this.record('resumed', { text: 'Back in the crossfire.' });
  }
  finish() {
    if (!['running', 'paused'].includes(this.phase)) throw new RuleError('Start the match before ending it.');
    this.elapsedBase = Math.min(this.elapsed(), this.config.durationSeconds * 1000);
    this.resumedAt = null; this.phase = 'finished'; this.windowEndsAt = null;
    for (const team of TEAMS) { this.teams[team].activeChallenge = null; this.teams[team].queuedChallenge = null; }
    this.updateResult();
    this.record('finished', { text: this.config.scoringMode === 'community' ? 'Round complete. Community battle score finalized automatically.' : 'Round complete. The host confirms the final score.' });
  }
  updateResult() {
    const a = this.teams.a.score, b = this.teams.b.score;
    this.result = { winner: a === b ? 'tie' : a > b ? 'a' : 'b', scores: { a, b }, provisional: this.config.scoringMode !== 'community' };
  }
  setScore(team, value) {
    this.requireTeam(team);
    if (this.config.scoringMode === 'community') throw new RuleError('Community battle scores are managed automatically.');
    if (!['running', 'paused', 'finished'].includes(this.phase)) throw new RuleError('Start the match before scoring.');
    bounded(value, 'Score', 0, 9999);
    this.teams[team].score = value;
    if (this.phase === 'finished') this.updateResult();
    this.record('score', { team, score: value, text: `${this.name(team)} score: ${value}` });
  }
  confirmResult() {
    if (this.phase !== 'finished') throw new RuleError('End the match before confirming the result.');
    if (!this.result.provisional) throw new RuleError('Result already confirmed.');
    this.result.provisional = false;
    this.record('confirmed', { text: this.result.winner === 'tie' ? 'The host confirms a draw.' : `${this.name(this.result.winner)} wins the match!` });
  }
  openDefection() {
    this.tick(false);
    if (this.phase !== 'running') throw new RuleError('Start or resume the match first.');
    if (this.windowUsed) throw new RuleError('The defection window has already been used this round.');
    this.windowUsed = true;
    this.windowEndsAt = Math.min(this.elapsed() + this.config.defectionDurationSeconds * 1000, this.config.durationSeconds * 1000);
    this.record('window_open', { text: 'DEFECT NOW. Type !switch to cross the line.' });
  }
  closeDefection() {
    if (this.windowEndsAt === null) throw new RuleError('No defection window is open.');
    this.windowEndsAt = null;
    this.record('window_closed', { text: 'Allegiances locked. Make your choice count.' });
  }
  requireTeam(team) { if (!TEAMS.includes(team)) throw new RuleError('Unknown team.'); }
  name(team) { return this.config[team === 'a' ? 'nameA' : 'nameB']; }
  command({ userId, name, channelTeam, text }) {
    this.tick(); this.requireTeam(channelTeam);
    const command = typeof text === 'string' ? text.trim().toLowerCase() : '';
    if (!['!join', '!attack', '!switch', '!help'].includes(command)) return { ignored: true };
    if (command === '!help') return { help: true, text: '!join = join this channel’s team · !attack = charge an attack on your rival · !switch = defect during the window. One allegiance per account.' };
    if (typeof userId !== 'string' || !userId || userId.length > 100 || typeof name !== 'string' || !name.trim() || name.length > 50) {
      throw new RuleError('Invalid viewer identity.');
    }
    if (this.phase === 'finished') throw new RuleError('The round has ended.', 'finished');
    if (this.phase === 'paused') throw new RuleError('The match is paused.', 'paused');
    let player = this.players.get(userId);
    if (command === '!join') {
      if (player) return { joined: false, team: player.team, text: `You are already on ${this.name(player.team)}.` };
      if (this.players.size >= 10000) throw new RuleError('This room is full.');
      player = { id: userId, name: name.trim(), team: channelTeam, originalTeam: channelTeam, switched: false, lastAttackAt: -Infinity, attacks: 0 };
      this.players.set(userId, player);
      this.record('joined', { team: player.team, name: player.name, text: `${player.name} joined ${this.name(player.team)}.` });
      return { joined: true, team: player.team };
    }
    if (!player) throw new RuleError('Type !join first to pick this channel’s team.', 'not_joined');
    if (this.phase !== 'running') throw new RuleError('Waiting for the host to start the round.', 'not_running');
    const elapsed = this.elapsed();
    if (command === '!switch') {
      if (this.windowEndsAt === null || elapsed >= this.windowEndsAt) throw new RuleError('Wait for the defection window.', 'window_closed');
      if (player.switched) throw new RuleError('You can defect only once per round.', 'already_switched');
      const from = player.team, to = opposite(from);
      player.team = to; player.switched = true;
      this.teams[from].switchedOut++; this.teams[to].switchedIn++;
      this.record('defected', { name: player.name, from, to, team: to, text: `${player.name} defected from ${this.name(from)} to ${this.name(to)}!` });
      return { switched: true, team: to };
    }
    const wait = this.config.userCooldownSeconds * 1000 - (elapsed - player.lastAttackAt);
    if (wait > 0) throw new RuleError(`Attack ready in ${Math.ceil(wait / 1000)}s.`, 'cooldown');
    const team = this.teams[player.team];
    if (team.energy >= this.config.attackThreshold) throw new RuleError('Your team is charged. Waiting for its next attack slot.', 'charged');
    player.lastAttackAt = elapsed; player.attacks++; team.attacks++; team.energy++;
    this.record('attack', { team: player.team, target: opposite(player.team), name: player.name, text: `${player.name} charged an attack on ${this.name(opposite(player.team))}.` });
    this.discharge(player.team);
    return { attacked: true, team: player.team };
  }
  discharge(teamId) {
    const team = this.teams[teamId], targetId = opposite(teamId), target = this.teams[targetId];
    const elapsed = this.elapsed();
    if (team.energy < this.config.attackThreshold || elapsed < team.nextVolleyAt || target.queuedChallenge) return;
    const challenge = { id: randomUUID(), text: this.config.challenges[this.challengeIndex++ % this.config.challenges.length], from: teamId };
    team.energy = 0; team.volleys++; team.nextVolleyAt = elapsed + this.config.volleyCooldownSeconds * 1000;
    if (target.activeChallenge) target.queuedChallenge = challenge;
    else target.activeChallenge = { ...challenge, endsAt: elapsed + this.config.challengeDurationSeconds * 1000 };
    this.record('volley', { team: teamId, target: targetId, challenge: challenge.text, queued: Boolean(target.queuedChallenge), text: `${this.name(teamId)} hit ${this.name(targetId)}: ${challenge.text}` });
    if (this.config.scoringMode === 'community') {
      team.score++;
      this.record('community_score', { team: teamId, score: team.score, text: `${this.name(teamId)} earned a community battle point.` });
    }
  }
  cancelChallenge(team) {
    this.requireTeam(team);
    this.teams[team].activeChallenge = null; this.teams[team].queuedChallenge = null;
    this.record('challenge_cancelled', { team, text: `${this.name(team)} challenge cleared by host.` });
  }
  tick(allowAutoWindow = true) {
    if (this.phase !== 'running') return;
    const elapsed = this.elapsed();
    if (elapsed >= this.config.durationSeconds * 1000) { this.finish(); return; }
    if (this.windowEndsAt !== null && elapsed >= this.windowEndsAt) this.closeDefection();
    if (allowAutoWindow && this.config.autoDefection && !this.windowUsed && elapsed >= this.config.durationSeconds * 500) this.openDefection();
    for (const teamId of TEAMS) {
      const team = this.teams[teamId];
      if (team.activeChallenge && elapsed >= team.activeChallenge.endsAt) {
        team.activeChallenge = team.queuedChallenge ? { ...team.queuedChallenge, endsAt: elapsed + this.config.challengeDurationSeconds * 1000 } : null;
        team.queuedChallenge = null;
        this.record('challenge_complete', { team: teamId, text: `${this.name(teamId)} challenge timer completed.` });
      }
    }
    for (const teamId of TEAMS) this.discharge(teamId);
  }
  snapshot() {
    const elapsed = this.elapsed();
    const counts = { a: 0, b: 0 };
    for (const player of this.players.values()) counts[player.team]++;
    return {
      id: this.id, revision: this.revision, mode: this.mode, phase: this.phase,
      scoreLabel: this.config.scoringMode === 'community' ? 'Community battle points' : 'Host-scored competition',
      config: structuredClone(this.config), serverTime: this.now(), elapsedMs: elapsed,
      remainingMs: Math.max(0, this.config.durationSeconds * 1000 - elapsed),
      windowUsed: this.windowUsed,
      defectionRemainingMs: this.windowEndsAt === null ? 0 : Math.max(0, this.windowEndsAt - elapsed),
      teams: Object.fromEntries(TEAMS.map(team => [team, { ...structuredClone(this.teams[team]), members: counts[team] }])),
      participants: this.players.size,
      leaders: [...this.players.values()].sort((a, b) => b.attacks - a.attacks).slice(0, 8).map(({ name, team, attacks, switched }) => ({ name, team, attacks, switched })),
      events: structuredClone(this.events.slice(-30)), result: this.result ? structuredClone(this.result) : null,
    };
  }
}
