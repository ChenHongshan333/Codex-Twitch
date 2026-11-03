import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { EventEmitter } from 'node:events';
import { startDodgeServer } from '../src/dodge-http.mjs';

const html = readFileSync(new URL('../public/dodge/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../public/dodge/dodge.js', import.meta.url), 'utf8');
async function until(check) {
  const deadline = Date.now() + 3000;
  while (!check()) { if (Date.now() > deadline) throw new Error('Dodge UI condition timed out'); await new Promise(resolve => setTimeout(resolve, 10)); }
}
async function rig(t, { sourceOverride, appOptions = {} } = {}) {
  const app = await startDodgeServer({ port: 0, live: false, ...appOptions });
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
  assert.equal($('#live-setup').hidden, false);
  assert.equal($('#audience-form').hidden, true);
  assert.equal($('#input-a').value, 'camera');
  assert.equal($('#input-a option[value="keyboard"]').disabled, true);
  assert.match($('#movement-a').textContent, /Move your body/);
});

test('live streamer setup displays blockers, real-chat diagnostics and disables start after a disconnect', async t => {
  class Bridge extends EventEmitter {
    status = { state: 'connected', message: 'Both Twitch chats connected.' };
    channels = [{ team: 'a', id: '10', login: 'coral', subscribed: true }, { team: 'b', id: '20', login: 'violet', subscribed: true }];
    async start() { this.status.channels = this.channels; this.emit('status', this.status); }
    async request() { return { data: [{ user_id: '10', viewer_count: 2 }, { user_id: '20', viewer_count: 3 }] }; }
    stop() {}
  }
  const { app, $, window, calls, disconnect } = await rig(t, { appOptions: { live: true, channels: { a: 'coral', b: 'violet' }, bridgeFactory: () => new Bridge() } });
  assert.equal($('[data-action="start"]').disabled, true);
  assert.match($('#start-requirements').textContent, /camera setup/);
  assert.equal($('#chat-link-a').href, 'https://www.twitch.tv/coral/chat');
  app.bridge.emit('chat', { id: 'before-start', userId: 'real-shaped-user', channelTeam: 'a', text: 'Hello' });
  await until(() => $('#readiness-checks').textContent.includes('Chat received 1, accepted 0, rejected 1'));
  assert.match($('#readiness-checks').textContent, /not running/);
  for (const side of ['a', 'b']) app.engine.marker(side, { x: 480, y: 270 });
  await until(() => !$('[data-action="start"]').disabled);
  assert.match($('#start-requirements').textContent, /result are automatic/);
  $('#input-a').value = 'keyboard'; // Even programmatic selection must not submit rehearsal coordinates in live mode.
  $('#arena-a').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'w', bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(calls.some(call => call.method === 'POST'), false);
  app.bridge.status.message = '<img src=x onerror=alert(1)>';
  await until(() => $('#readiness-checks').textContent.includes('<img'));
  assert.equal($('#readiness-checks img'), null);
  disconnect(); await until(() => $('#connection').textContent.includes('Disconnected'));
  assert.equal($('[data-action="start"]').disabled, true);
  assert.match($('#start-requirements').textContent, /disconnected/);
});

test('AI demo labels its local opponent and embedded camera, with no second-chat readiness requirement', async t => {
  class Bridge extends EventEmitter {
    status = { state: 'connected' }; channels = [{ team: 'a', id: '10', login: 'streamer', subscribed: true }];
    async start() { this.status.channels = this.channels; this.emit('status', this.status); }
    async request() { return { data: [{ user_id: '10', viewer_count: 0 }] }; }
    stop() {}
  }
  const { app, $, window } = await rig(t, { appOptions: { mode: 'ai-demo', live: true, channels: { a: 'streamer' }, bridgeFactory: () => new Bridge() } });
  assert.match($('#source').textContent, /LOCAL AI DEMO/);
  assert.equal($('#ai-demo-note').hidden, false);
  assert.equal($('#ai-camera').hidden, false);
  assert.equal($('#ai-chat-help').hidden, false);
  assert.match($('#activity-title').textContent, /local AI/);
  assert.equal($('#camera-frame iframe').getAttribute('src'), '/track/a?embedded=1');
  assert.equal($('.team.b .tools').hidden, true);
  assert.equal($('#chat-link-b').hidden, true);
  assert.match($('#readiness-checks').textContent, /no second Twitch channel or viewer count/);
  assert.match($('#readiness-checks').textContent, /✓ Your Twitch channel viewers: 0/);
  assert.equal($('[data-action="start"]').disabled, true);
  app.engine.marker('a', { x: 480, y: 270 });
  await until(() => !$('[data-action="start"]').disabled);
  assert.equal(app.engine.markers.b.x, app.engine.config.width * .72);
  app.engine.health.a = 0; app.engine.finish();
  await until(() => $('#notice').textContent.includes('Local AI wins'));
  assert.equal($('#simulator-controls').hidden, true);
  const labels = [], frames = [], scales = [];
  const context = new Proxy({ measureText: () => ({ width: 0 }), fillText: text => labels.push(text), drawImage: (...args) => frames.push(args), scale: (...args) => scales.push(args) }, { get: (target, key) => key in target ? target[key] : () => {} });
  const cameraDocument = $('#camera-frame iframe').contentDocument;
  cameraDocument.open(); cameraDocument.write('<video id="video"></video><input id="mirror" type="checkbox" checked>'); cameraDocument.close();
  const video = cameraDocument.getElementById('video');
  Object.defineProperties(video, { readyState: { value: 4 }, videoWidth: { value: 1280 }, videoHeight: { value: 960 } });
  $('#arena-a').getContext = () => context;
  window.drawArena($('#arena-a'), 'a');
  assert.equal(frames[0][0], video);
  assert.deepEqual(frames[0].slice(1), [0, 120, 1280, 720, 0, 0, 960, 540], 'Live face picture uses the same centred 16:9 crop as marker tracking');
  assert.deepEqual(scales[0], [-1, 1], 'Camera mirror matches the tracker');
  assert.ok(labels.includes('LIVE CAMERA · TRACKED PHYSICAL MARKER'));
  $('#arena-b').getContext = () => context;
  window.drawArena($('#arena-b'), 'b');
  assert.ok(labels.includes('LOCAL AI'));
  assert.ok(labels.includes('ROUND OVER · LOCAL AI WINS'));
});
