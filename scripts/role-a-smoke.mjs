import { mkdir, writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:3010';
const deadline = Date.now() + 100000;
const report = { role: 'broadcaster-a-and-viewer-a', source: 'local-simulation', realTwitchVerified: false, startedAt: new Date().toISOString(), steps: [], passed: false };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let streamerToken, viewerToken, roomId, lastPhase;
async function api(path, token, input) {
  const response = await fetch(base + path, {
    method: input === undefined ? 'GET' : 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(input === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }), signal: AbortSignal.timeout(5000),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${value.error || 'request failed'}`);
  return value;
}
function check(value, message) { if (!value) throw new Error(message); }
function step(name, extra = {}) { report.steps.push({ name, at: new Date().toISOString(), ...extra }); console.log(`[A] ${name}${extra.phase ? `: ${extra.phase}` : ''}`); }
async function state() {
  const value = await api('/api/extension/state', streamerToken);
  const phase = value.room?.lifecycle ?? 'no-room';
  if (phase !== lastPhase) { lastPhase = phase; step('phase', { phase }); }
  return value;
}
async function waitFor(predicate, label) {
  while (Date.now() < deadline) {
    const value = await state();
    if (predicate(value)) return value;
    if (value.room?.lifecycle === 'cancelled') throw new Error(`Room cancelled while waiting for ${label}: ${value.room.cancellationReason}`);
    await pause(300);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}
async function play(command) {
  return api('/api/extension/play', viewerToken, { roomId, command });
}

try {
  streamerToken = (await api('/api/sandbox/session', null, { persona: 'streamer-a' })).token;
  viewerToken = (await api('/api/sandbox/session', null, { persona: 'viewer-a' })).token;
  check(streamerToken && viewerToken, 'Sandbox identities missing.');
  let initial = await state();
  if (initial.room) {
    check(initial.room.channels.a.login === 'demo_coral' && initial.room.channels.b.login === 'demo_violet', 'Refusing to alter a room belonging to other channels.');
    if (['finished', 'cancelled'].includes(initial.room.lifecycle)) {
      await api('/api/extension/action', streamerToken, { action: 'leave', roomId: initial.room.id });
      initial = await state();
    } else check(initial.room.engine.config.title === 'Two-agent full-chain rehearsal', 'Another active sandbox round exists.');
  }
  const invitation = initial.room ? initial : await api('/api/extension/invite', streamerToken, { targetLogin: 'demo_violet', title: 'Two-agent full-chain rehearsal', durationSeconds: 60 });
  roomId = invitation.room.id; report.roomId = roomId; step('invited-broadcaster-b');
  await waitFor(value => value.room?.id === roomId && value.room.lifecycle === 'lobby', 'broadcaster B acceptance');
  await api('/api/extension/action', streamerToken, { action: 'ready', roomId }); step('marked-a-ready');
  const running = await waitFor(value => value.room?.id === roomId && value.room.lifecycle === 'running', 'automatic countdown and start');
  check(running.inputSource === 'local-simulation', 'This rehearsal must remain explicitly simulated.'); step('automatic-start');
  const joined = await play('!join'); check(joined.viewer.joined && joined.viewer.team === 'a', 'Viewer A did not join side A.'); step('viewer-a-joined');
  for (const elapsedMs of [0, 10200, 20400]) {
    await waitFor(value => value.room.engine.elapsedMs >= elapsedMs, `attack at ${elapsedMs}ms`);
    const attacked = await play('!attack');
    const event = attacked.room.engine.events.findLast(event => event.type === 'attack');
    check(event?.team === 'a' && event.target === 'b', 'Pre-defection attack targeted the wrong side.');
    step('viewer-a-attack', { elapsedMs: Math.round(attacked.room.engine.elapsedMs), team: event.team, target: event.target });
  }
  await waitFor(value => value.room.engine.defectionRemainingMs > 0 && value.room.engine.elapsedMs >= 30700, 'automatic defection window and viewer cooldown');
  const defected = await play('!switch'); check(defected.viewer.team === 'b' && defected.viewer.switched, 'Viewer A defection did not change allegiance.'); step('viewer-a-defected-to-b');
  const redirected = await play('!attack');
  const redirectedEvent = redirected.room.engine.events.findLast(event => event.type === 'attack');
  check(redirectedEvent?.team === 'b' && redirectedEvent.target === 'a', 'Post-defection attack did not target original side A.');
  step('post-defection-attack', { elapsedMs: Math.round(redirected.room.engine.elapsedMs), team: redirectedEvent.team, target: redirectedEvent.target });
  const finished = await waitFor(value => value.room.lifecycle === 'finished', 'automatic finish');
  const viewerFinal = await api('/api/extension/state', viewerToken);
  report.result = finished.room.engine.result; report.finalScores = { a: finished.room.engine.teams.a.score, b: finished.room.engine.teams.b.score };
  report.participants = finished.room.engine.participants; report.defections = finished.room.engine.teams.a.switchedIn + finished.room.engine.teams.b.switchedIn;
  check(report.result?.provisional === false, 'Automatic result remains provisional.');
  check(report.result.winner === 'b' && report.finalScores.a === 1 && report.finalScores.b === 2, 'Expected B to win the coordinated rehearsal 2:1.');
  check(JSON.stringify(viewerFinal.room.engine.result) === JSON.stringify(report.result), 'Streamer and viewer final results disagree.');
  report.passed = true; step('automatic-finish-and-shared-result-verified');
} catch (error) {
  report.error = error.message; console.error(`[A] FAIL: ${error.message}`); process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString();
  await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
  await writeFile(new URL('../artifacts/role-a-result.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ source: report.source, role: report.role, passed: report.passed, roomId: report.roomId, result: report.result, finalScores: report.finalScores, error: report.error }));
}
