import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// LOCAL SIMULATION ONLY. This independently acts as broadcaster B + viewer B
// against the running HTTP backend. No Twitch accounts, live streams or real JWTs.
const origin = process.env.SMOKE_ORIGIN || 'http://127.0.0.1:3010';
const title = 'Two-agent full-chain rehearsal';
const report = { inputSource: 'local-simulation', role: 'broadcaster-b-and-viewer-b', origin, title, startedAt: new Date().toISOString(), evidence: [], attacks: [], passed: false };
let streamerToken, viewerToken, roomId, joined = false, ready = false, nextAttackAt = 0, observedLifecycle;
const deadline = Date.now() + 100000;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function api(path, token, input) {
  const response = await fetch(`${origin}${path}`, {
    method: input ? 'POST' : 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(input ? { 'Content-Type': 'application/json' } : {}) },
    ...(input ? { body: JSON.stringify(input) } : {}), signal: AbortSignal.timeout(5000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${body.code ?? ''} ${body.error ?? ''}`);
  return body;
}
function evidence(type, state, extra = {}) {
  const item = { type, at: new Date().toISOString(), lifecycle: state.room?.lifecycle, elapsedMs: state.room?.engine.elapsedMs ?? 0, ...extra };
  report.evidence.push(item); console.log(`[B / LOCAL SIMULATION] ${type} ${item.lifecycle ?? ''} elapsed=${item.elapsedMs}`);
}
try {
  streamerToken = (await api('/api/sandbox/session', null, { persona: 'streamer-b' })).token;
  viewerToken = (await api('/api/sandbox/session', null, { persona: 'viewer-b' })).token;
  console.log('[B / LOCAL SIMULATION] Waiting for broadcaster A invitation.');
  while (Date.now() < deadline) {
    let state = await api('/api/extension/state', streamerToken);
    if (!state.room || state.room.engine.config.title !== title) { await delay(250); continue; }
    if (!roomId && state.room.lifecycle !== 'invited') { await delay(250); continue; }
    roomId ??= state.room.id;
    if (state.room.id !== roomId) throw new Error('Room identity unexpectedly changed during the rehearsal.');
    if (state.room.lifecycle !== observedLifecycle) { observedLifecycle = state.room.lifecycle; evidence('observed-lifecycle', state); }
    if (state.room.lifecycle === 'invited') {
      state = await api('/api/extension/action', streamerToken, { roomId, action: 'accept' });
      evidence('B-accepted', state);
    }
    if (state.room.lifecycle === 'lobby' && !ready) {
      state = await api('/api/extension/action', streamerToken, { roomId, action: 'ready' }); ready = true;
      evidence('B-ready', state);
    }
    if (state.room.lifecycle === 'running') {
      if (!joined) {
        state = await api('/api/extension/play', viewerToken, { roomId, command: '!join' }); joined = true;
        evidence('viewer-B-joined', state);
      }
      const elapsed = state.room.engine.elapsedMs;
      if (report.attacks.length < 6 && elapsed >= nextAttackAt) {
        const viewerState = await api('/api/extension/state', viewerToken);
        if (viewerState.viewer.attackReadyInMs <= 0) {
          const after = await api('/api/extension/play', viewerToken, { roomId, command: '!attack' });
          const item = { elapsedMs: after.room.engine.elapsedMs, team: after.viewer.team, scoreA: after.room.engine.teams.a.score, scoreB: after.room.engine.teams.b.score };
          report.attacks.push(item); nextAttackAt = item.elapsedMs + 10200;
          evidence(`viewer-B-attack-${report.attacks.length}`, after, item);
        }
      }
    }
    if (state.room.lifecycle === 'cancelled') throw new Error(`Rehearsal was cancelled: ${state.room.cancellationReason}`);
    if (state.room.lifecycle === 'finished') {
      const final = await api('/api/extension/state', viewerToken);
      report.final = { roomId, lifecycle: final.room.lifecycle, result: final.room.engine.result, scoreA: final.room.engine.teams.a.score, scoreB: final.room.engine.teams.b.score, viewerB: final.viewer, participants: final.room.engine.participants, defectionEvents: final.room.engine.events.filter(event => event.type === 'defected') };
      if (report.attacks.length !== 6) throw new Error(`Expected six B attacks, got ${report.attacks.length}.`);
      if (report.final.result?.winner !== 'b' || report.final.result.provisional !== false || report.final.scoreA !== 1 || report.final.scoreB !== 2) throw new Error(`Unexpected automatic result: ${JSON.stringify(report.final.result)}`);
      if (report.final.viewerB.switched || report.final.viewerB.team !== 'b') throw new Error('Viewer B unexpectedly switched sides.');
      evidence('automatic-result-verified', final);
      report.passed = true; break;
    }
    await delay(250);
  }
  if (!report.passed) throw new Error('Timed out after 100 seconds waiting for the automatic final result.');
} catch (error) {
  report.error = String(error.message).replace(/sandbox_[a-f0-9]+/g, '[REDACTED]');
  console.error(`[B / LOCAL SIMULATION] FAIL ${report.error}`); process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  const directory = join(process.cwd(), 'artifacts'); mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'role-b-result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[B / LOCAL SIMULATION] ${report.passed ? 'PASS' : 'FAIL'} report saved to artifacts/role-b-result.json`);
}
