import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createApp } from '../server.mjs';
import { Store } from '../src/store.mjs';

async function rig(t) {
  const directory = mkdtempSync(join(tmpdir(), 'crossfire-test-'));
  const key = 'test-host-key-with-at-least-24-characters';
  const app = createApp({ store: new Store(directory), adminKey: key, token: '' });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await app.close(); assert.ok(directory.startsWith(join(tmpdir(), 'crossfire-test-'))); rmSync(directory, { recursive: true, force: true }); });
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const login = await fetch(`${origin}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const post = async (path, input, auth = true, extra = {}) => {
    const response = await fetch(`${origin}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Cookie: cookie } : {}), ...extra }, body: JSON.stringify(input) });
    return { status: response.status, body: await response.json() };
  };
  return { app, origin, cookie, post, directory };
}

test('host authorization is required and public state never exposes keys or tokens', async t => {
  const { origin, post } = await rig(t);
  assert.equal((await post('/api/action', { action: 'start' }, false)).status, 401);
  assert.equal((await post('/api/session', { key: 'incorrect' }, false)).status, 401);
  const state = await fetch(`${origin}/api/state`).then(response => response.json());
  assert.equal(state.mode, 'demo'); assert.equal(JSON.stringify(state).includes('test-host-key'), false);
  assert.equal((await post('/api/action', { action: 'start' })).body.phase, 'running');
});

test('complete demo round: recruit, attack, defect, score, confirm and reset', async t => {
  const { post } = await rig(t);
  assert.equal((await post('/api/demo', { team: 'a', command: '!join' })).body.participants, 1);
  await post('/api/action', { action: 'start' });
  for (let i = 0; i < 3; i++) assert.equal((await post('/api/demo', { team: 'a', command: '!attack' })).status, 200);
  await post('/api/action', { action: 'open_defection' });
  const switched = await post('/api/demo', { team: 'a', command: '!switch' });
  assert.equal(switched.body.teams.b.members, 1); assert.ok(switched.body.teams.b.activeChallenge);
  await post('/api/action', { action: 'score', team: 'a', value: 7 });
  await post('/api/action', { action: 'finish' });
  const result = await post('/api/action', { action: 'confirm' });
  assert.equal(result.body.result.winner, 'a'); assert.equal(result.body.result.provisional, false);
  assert.equal((await post('/api/action', { action: 'reset' })).body.participants, 0);
});

test('live mode rejects demo events and refuses to start without a Twitch connection', async t => {
  const { post } = await rig(t);
  const live = await post('/api/mode', { mode: 'live' }); assert.equal(live.status, 200);
  assert.equal((await post('/api/demo', { team: 'a', command: '!join' })).status, 400);
  assert.equal((await post('/api/action', { action: 'start' })).status, 400);
});

test('configuration is saved and retained by a clean server instance', async t => {
  const { post, directory } = await rig(t);
  assert.equal((await post('/api/config', { title: 'Trivia showdown', channelB: 'second_streamer' })).status, 200);
  const saved = new Store(directory).loadConfig();
  assert.equal(saved.title, 'Trivia showdown'); assert.equal(saved.channelB, 'second_streamer');
  assert.equal((await post('/api/config', { durationSeconds: -1 })).status, 400);
});

test('SSE provides a fresh snapshot and read-only OBS/cue routes load', async t => {
  const { origin } = await rig(t);
  const response = await fetch(`${origin}/api/events`); const reader = response.body.getReader();
  const chunk = new TextDecoder().decode((await reader.read()).value);
  assert.match(chunk, /event: state/); assert.match(chunk, /"mode":"demo"/); await reader.cancel();
  for (const path of ['/', '/overlay/a', '/overlay/b', '/cue/a', '/cue/b', '/app.js', '/styles.css', '/favicon.svg']) {
    const asset = await fetch(`${origin}${path}`); assert.equal(asset.status, 200, path);
    assert.ok(asset.headers.get('content-security-policy')); await asset.body.cancel();
  }
  assert.equal((await fetch(`${origin}/.env`)).status, 404);
  assert.equal((await fetch(`${origin}/src/engine.mjs`)).status, 404);
});

test('cross-origin writes, untrusted Host headers and malformed bodies are rejected', async t => {
  const { origin, post, cookie } = await rig(t);
  assert.equal((await post('/api/action', { action: 'start' }, true, { Origin: 'https://evil.example' })).status, 403);
  const untrustedStatus = await new Promise((resolve, reject) => {
    const req = request(`${origin}/api/state`, { headers: { Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(untrustedStatus, 403);
  const bad = await fetch(`${origin}/api/action`, { method: 'POST', headers: { Cookie: cookie }, body: '{broken' });
  assert.equal(bad.status, 400);
});
