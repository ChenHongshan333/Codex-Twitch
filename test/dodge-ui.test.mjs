import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { startDodgeServer } from '../src/dodge-http.mjs';

const html = readFileSync(new URL('../public/dodge/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../public/dodge/dodge.js', import.meta.url), 'utf8');
async function until(check) {
  const deadline = Date.now() + 3000;
  while (!check()) { if (Date.now() > deadline) throw new Error('Dodge UI condition timed out'); await new Promise(resolve => setTimeout(resolve, 10)); }
}
async function rig(t, { sourceOverride } = {}) {
  const app = await startDodgeServer({ port: 0, live: false });
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const errors = [], calls = [], virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(html, { url: origin, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const { window } = dom; let disconnected = false;
  window.requestAnimationFrame = () => 0; // Visual/canvas behavior is covered in Chrome.
  window.AbortSignal = AbortSignal;
  window.fetch = async (path, options = {}) => {
    if (disconnected) throw new Error('Synthetic disconnect');
    calls.push({ path, method: options.method ?? 'GET' });
    const response = await fetch(new URL(path, origin), { ...options, headers: { ...options.headers, Origin: origin } });
    if (!sourceOverride) return response;
    const state = await response.json(); state.inputSource = sourceOverride;
    return { ok: response.ok, json: async () => state };
  };
  t.after(async () => { window.close(); await app.close(); assert.deepEqual(errors, [], 'No UI runtime errors'); });
  window.eval(script);
  const $ = selector => window.document.querySelector(selector);
  await until(() => $('#source').textContent !== 'Connecting…');
  return { app, window, $, calls, disconnect: () => { disconnected = true; } };
}

test('one-click rehearsal starts real local HTTP play and view controls preserve server geometry', async t => {
  const { app, $, window, disconnect } = await rig(t);
  assert.equal($('#timer').textContent, '01:00');
  assert.equal($('#switch').disabled, true);
  assert.equal($('[data-action="start"]').disabled, true, 'Start waits for both markers');
  $('#quick-start').click();
  await until(() => app.engine.phase === 'running' && $('#rehearsal-intro').hidden);
  assert.equal(app.engine.config.durationMs, 60000);
  assert.equal(app.engine.freshMarkers(), true);
  assert.equal($('#input-a').value, 'keyboard'); assert.equal($('#input-b').value, 'keyboard');
  assert.equal($('#switch').disabled, true, 'Defection stays disabled before its window');
  $('button[data-view="a"]').click(); $('#arena-a').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal($('#arena-grid').dataset.view, 'a');
  assert.equal($('button[data-view="a"]').getAttribute('aria-pressed'), 'true');
  assert.equal(app.engine.config.width, 960);
  $('#stop-demo').click();
  $('#message').value = '<img src=x onerror=alert(1)>';
  $('#attack-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => app.engine.players.has('viewer-1') && $('#activity-feed').textContent.includes('message attack'));
  assert.equal($('#activity-feed img'), null);
  disconnect(); await until(() => $('[data-action="pause"]').disabled);
  assert.match($('#connection').textContent, /Disconnected/);
});

test('Twitch-source UI hides synthetic rehearsal controls without submitting test activity', async t => {
  const { $, calls } = await rig(t, { sourceOverride: 'twitch' });
  assert.equal($('#simulator-controls').hidden, true); assert.equal($('#rehearsal-intro').hidden, true);
  assert.equal($('#live-chat-help').hidden, false);
  $('#quick-start').click();
  assert.equal(calls.some(call => call.method === 'POST'), false);
  assert.equal($('#switch').disabled, true);
});
