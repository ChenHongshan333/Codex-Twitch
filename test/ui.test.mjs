import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createApp } from '../server.mjs';
import { Store } from '../src/store.mjs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
async function until(check) {
  const deadline = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('UI did not reach expected state.');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
async function rig(t, { host = true, route = '/' } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'crossfire-ui-'));
  const key = 'ui-test-host-key-with-24-characters';
  const app = createApp({ store: new Store(directory), adminKey: key, token: '' });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const errors = [], console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  console.on('error', (...args) => errors.push(args.join(' ')));
  const dom = new JSDOM(html, { url: origin + route + (host ? `#key=${key}` : ''), runScripts: 'outside-only', virtualConsole: console, pretendToBeVisual: true });
  const { window } = dom; let cookie = '', stream;
  // jsdom has no native modal rendering; real browser visual verification is tracked separately.
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.fetch = async (path, options = {}) => {
    const response = await fetch(new URL(path, origin), { ...options, headers: { ...options.headers, ...(cookie ? { Cookie: cookie } : {}) } });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  };
  window.confirm = () => true;
  window.EventSource = class {
    constructor() { this.listeners = new Map(); stream = this; queueMicrotask(() => this.push()); }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    push() { this.listeners.get('state')?.({ data: JSON.stringify(app.snapshot()) }); }
    disconnect() { this.listeners.get('error')?.(); }
    close() {}
  };
  window.eval(script);
  t.after(async () => {
    dom.window.close(); await app.close();
    assert.ok(directory.startsWith(join(tmpdir(), 'crossfire-ui-')));
    rmSync(directory, { recursive: true, force: true });
    assert.deepEqual(errors, [], 'No client runtime errors');
  });
  await until(() => stream && window.document.querySelector('#room-code').textContent !== 'ROOM / —' || route !== '/' && window.document.querySelector('#screen-title')?.textContent);
  const $ = selector => window.document.querySelector(selector);
  async function click(selector, check) { $(selector).click(); if (check) await until(check); }
  return { app, window, $, click, push: () => stream.push(), pushState: value => stream.listeners.get('state')({ data: JSON.stringify(value) }), disconnect: () => stream.disconnect() };
}

test('host link unlocks controls, scrubs its key from history and starts a round', async t => {
  const { app, window, $, click } = await rig(t);
  assert.equal(window.location.hash, ''); assert.equal($('#unlock-btn span').textContent, 'Host access');
  assert.equal($('#primary-action').disabled, false);
  await click('#primary-action', () => app.engine.phase === 'running' && $('#phase-tag').textContent === 'ROUND LIVE');
  assert.equal($('#primary-action span').textContent, 'Pause the round');
  assert.equal($('#mode-live').disabled, true);
});

test('demo UI recruits, attacks, opens defection, switches sides and displays host scoring', async t => {
  const { app, $, click } = await rig(t);
  await click('#primary-action', () => app.engine.phase === 'running' && !$('#primary-action').disabled);
  for (let i = 0; i < 3; i++) {
    const before = app.engine.teams.a.attacks;
    await click('[data-demo="!attack"][data-team="a"]', () => app.engine.teams.a.attacks > before && !$('#primary-action').disabled);
  }
  assert.notEqual($('#challenge-b').textContent, 'Clear skies. For now.');
  await click('#window-button', () => app.engine.windowUsed && !$('#window-button').disabled);
  await click('[data-demo="!switch"][data-team="a"]', () => app.engine.teams.b.switchedIn === 1 && !$('#primary-action').disabled);
  assert.match($('#defection-name').textContent, /crossed the line/);
  assert.equal($('#members-b').textContent, '1');
  await click('[data-score="a"][data-delta="1"]', () => $('#score-a').textContent === '01');
});

test('public viewers cannot use host controls and disconnected screens disable input', async t => {
  const { $, disconnect } = await rig(t, { host: false });
  assert.equal($('#unlock-btn span').textContent, 'Viewer access');
  assert.equal($('#primary-action').disabled, true);
  disconnect(); assert.match($('#stream-status').textContent, /disconnected/);
  assert.equal($('#mode-live').disabled, true);
});

test('settings form saves custom competition content and exposes read-only broadcast links', async t => {
  const { app, $, click } = await rig(t);
  await click('.heading-actions [data-open="setup-dialog"]');
  const form = $('#setup-form');
  form.elements.title.value = 'Trivia showdown'; form.elements.channelB.value = 'teammate';
  form.elements.nameB.value = 'QUIZ CREW';
  form.dispatchEvent(new form.ownerDocument.defaultView.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => $('#match-title').textContent === 'Trivia showdown' && !$('#setup-dialog').open);
  assert.equal(app.engine.config.channelB, 'teammate');
  await click('.heading-actions [data-open="broadcast-dialog"]');
  assert.equal($('#broadcast-links').querySelectorAll('a').length, 4);
  assert.match($('#broadcast-links').textContent, /\/overlay\/a/);
  assert.equal($('#broadcast-links').textContent.includes('#key='), false);
});

test('user-controlled names, challenge text and activity feed are rendered as text', async t => {
  const { app, $, push } = await rig(t);
  const payload = '<img src=x onerror=alert(1)>';
  app.engine.configure({ title: payload, challenges: [payload], attackThreshold: 1 });
  app.engine.start();
  app.engine.command({ userId: 'x', name: payload, channelTeam: 'a', text: '!join' });
  app.engine.command({ userId: 'x', name: payload, channelTeam: 'a', text: '!attack' });
  push();
  assert.equal($('#match-title').textContent, payload); assert.equal($('#challenge-b').textContent, payload);
  assert.match($('#event-feed').textContent, /<img/);
  assert.equal($('#event-feed img'), null); assert.equal($('#leaders img'), null);
});

test('OBS screen restores current challenges, scores and pause state without host controls', async t => {
  const { app, $, push } = await rig(t, { route: '/overlay/b', host: false });
  app.engine.configure({ attackThreshold: 1 }); app.engine.start();
  app.engine.command({ userId: 'x', name: 'viewer', channelTeam: 'a', text: '!join' });
  app.engine.command({ userId: 'x', name: 'viewer', channelTeam: 'a', text: '!attack' });
  app.engine.setScore('a', 4); app.engine.pause(); push();
  assert.equal($('#dashboard').hidden, true);
  assert.equal($('#screen-challenge').hidden, false);
  assert.equal($('#screen-challenge-text').textContent, app.engine.config.challenges[0]);
  assert.match($('#screen-score-a').textContent, /4/); assert.match($('#screen-phase').textContent, /PAUSED/);
  assert.match($('#screen-challenge-time').textContent, /PAUSED/);
});

test('streamer cue page shows an idle cue and joins the same authoritative match', async t => {
  const { $, push, app } = await rig(t, { route: '/cue/a', host: false });
  assert.equal($('#screen-challenge').hidden, false);
  assert.equal($('#screen-challenge-text').textContent, 'Clear skies. For now.');
  app.engine.start(); app.engine.openDefection(); push();
  assert.equal($('#screen-window').hidden, false); assert.match($('#screen-window').textContent, /!switch/);
});

test('host can cancel an incoming challenge from its visible control', async t => {
  const { app, $, push, click } = await rig(t);
  app.engine.configure({ attackThreshold: 1 }); app.engine.start();
  app.engine.command({ userId: 'viewer', name: 'viewer', channelTeam: 'a', text: '!join' });
  app.engine.command({ userId: 'viewer', name: 'viewer', channelTeam: 'a', text: '!attack' }); push();
  assert.equal($('[data-cancel="b"]').hidden, false);
  await click('[data-cancel="b"]', () => $('#challenge-b').textContent === 'Clear skies. For now.');
  assert.equal(app.engine.teams.b.activeChallenge, null);
});

test('late HTTP/SSE state cannot rewind a newer score or match phase', async t => {
  const { app, $, push, pushState } = await rig(t);
  const oldState = app.snapshot(); app.engine.start(); app.engine.setScore('a', 9); push();
  assert.equal($('#score-a').textContent, '09');
  pushState(oldState);
  assert.equal($('#score-a').textContent, '09'); assert.equal($('#phase-tag').textContent, 'ROUND LIVE');
});
