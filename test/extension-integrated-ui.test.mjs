import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createApp } from '../server.mjs';
import { Store } from '../src/store.mjs';

const html = readFileSync(new URL('../extension/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../extension/app.js', import.meta.url), 'utf8');
const channels = [
  { id: '91000001', login: 'dom_coral', name: 'DOM CORAL' },
  { id: '91000002', login: 'dom_violet', name: 'DOM VIOLET' },
];
const extensionId = 'syntheticdomintegration';
async function until(check, description = 'expected UI state') {
  const deadline = Date.now() + 4000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${description}.`);
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

test('four real Extension frontends complete invite to automatic result through HTTP and signed synthetic identities', async t => {
  // Real app.js, local HTTP server, JWT verification and room engine. Only the Twitch
  // Helper identities, directory and clock are synthetic; this is not a browser render
  // or a connection to real Twitch accounts.
  let now = 1800000000000;
  const secret = randomBytes(32), temporary = mkdtempSync(join(tmpdir(), 'crossfire-dom-http-'));
  const doms = [], errors = [], requests = new Set();
  const directory = { async resolve({ id, login }) {
    const channel = channels.find(channel => id ? channel.id === id : channel.login === login.toLowerCase());
    if (!channel) throw new Error('Synthetic DOM integration channel not found.');
    return { ...channel };
  } };
  const app = createApp({ store: new Store(temporary), token: '', adminKey: randomBytes(24).toString('hex'),
    extensionId, extensionSecret: secret.toString('base64'), sandboxEnabled: false,
    extensionOptions: { directory, now: () => now, bridgeFactory: null },
  });
  await new Promise(resolveListening => app.server.listen(0, '127.0.0.1', resolveListening));
  const backend = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => {
    for (const dom of doms) { dom.window.dispatchEvent(new dom.window.Event('pagehide')); dom.window.close(); }
    await Promise.allSettled([...requests]); await app.close();
    const target = resolve(temporary), prefix = resolve(tmpdir()) + sep;
    assert.ok(target.startsWith(prefix) && target.slice(prefix.length).startsWith('crossfire-dom-http-'));
    rmSync(target, { recursive: true, force: true });
    assert.deepEqual(errors, [], 'All four real frontends completed without runtime errors');
  });
  function sign(side, broadcaster, userId) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + 3600, channel_id: channels[side].id,
      role: broadcaster ? 'broadcaster' : 'viewer', opaque_user_id: broadcaster ? `U${channels[side].id}` : `Udom${userId}`,
      ...(broadcaster ? {} : { user_id: userId }),
    })).toString('base64url');
    return `${header}.${payload}.${createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')}`;
  }
  function frontend(side, broadcaster, userId) {
    const console = new VirtualConsole(); console.on('jsdomError', error => errors.push(error.message)); console.on('error', error => errors.push(String(error)));
    const view = broadcaster ? 'dashboard' : 'panel';
    const dom = new JSDOM(html, { url: `https://${extensionId}.ext-twitch.tv/index.html?view=${view}`,
      runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console,
    });
    doms.push(dom); const { window } = dom, calls = [];
    window.CROSSFIRE_CONFIG = { backendOrigin: backend, enableSandbox: false };
    window.AbortController = AbortController;
    // Keep the actual production polling code while shortening only its test scheduling.
    const nativeTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => nativeTimeout(callback, delay === 1000 || delay === 200 ? 10 : delay, ...args);
    window.Twitch = { ext: {
      onAuthorized(callback) { queueMicrotask(() => callback({ token: sign(side, broadcaster, userId), channelId: channels[side].id })); },
      onContext() {}, onVisibilityChanged() {}, onError() {}, actions: { requestIdShare() { throw new Error('Synthetic identities are already linked.'); } },
    } };
    window.fetch = (url, options = {}) => {
      const call = { path: new URL(url).pathname, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null, status: null };
      calls.push(call);
      const request = fetch(url, { ...options, headers: { ...options.headers, Origin: `https://${extensionId}.ext-twitch.tv` } });
      requests.add(request); request.finally(() => requests.delete(request)).catch(() => {});
      request.then(response => { call.status = response.status; }, () => { call.status = 'aborted'; });
      return request;
    };
    window.eval(script);
    const $ = selector => window.document.querySelector(selector);
    async function click(selector, check, description) {
      await until(() => !$(selector).hidden && !$(selector).disabled, `${selector} enabled`);
      const before = calls.filter(call => call.method === 'POST').length;
      $(selector).click();
      await until(() => calls.filter(call => call.method === 'POST').length > before && calls.filter(call => call.method === 'POST').at(-1).status !== null, `${selector} HTTP completion`);
      assert.equal(calls.filter(call => call.method === 'POST').at(-1).status, 200, `${selector} accepted`);
      if (check) await until(check, description || selector);
    }
    return { window, $, calls, click };
  }
  const a = frontend(0, true), b = frontend(1, true), viewerA = frontend(0, false, '81000001'), viewerB = frontend(1, false, '81000002');
  for (const ui of [a, b, viewerA, viewerB]) await until(() => ui.$('#connection span').textContent === 'Twitch connected', 'verified frontend identity');
  assert.equal(viewerA.$('#invite-form').hidden, true); assert.equal(viewerB.$('#invite-form').hidden, true);
  a.$('#target-login').value = channels[1].login; a.$('#match-title').value = 'Four-window DOM to HTTP rehearsal'; a.$('#round-length').value = '60';
  a.$('#invite-form').dispatchEvent(new a.window.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => !b.$('#accept-button').hidden && !b.$('#accept-button').disabled, 'B sees invitation');
  assert.match(a.$('#invite-message').textContent, /DOM VIOLET/);
  await b.click('#accept-button', () => !a.$('#ready-button').hidden, 'A sees accepted room');
  await a.click('#ready-button', () => a.$('#ready-a').textContent.includes('READY FOR'));
  await b.click('#ready-button', () => !a.$('#countdown-banner').hidden && !b.$('#countdown-banner').hidden, 'both countdowns');
  now += 5000; app.extension.tick();
  await until(() => a.$('#phase-pill').textContent === 'PK LIVE' && b.$('#phase-pill').textContent === 'PK LIVE', 'both automatic starts');
  await viewerA.click('#join-button', () => viewerA.$('#my-team').textContent.includes('DOM CORAL'));
  await viewerB.click('#join-button', () => viewerB.$('#my-team').textContent.includes('DOM VIOLET'));
  for (let index = 0; index < 3; index++) {
    if (index) { now += 10001; app.extension.tick(); }
    const beforeA = a.calls.length, beforeB = b.calls.length;
    await viewerA.click('#attack-button'); await viewerB.click('#attack-button');
    // Request completion becomes visible in the next room snapshot rather than a mock response.
    const expectedA = index === 2 ? '01' : '00';
    await until(() => a.calls.length > beforeA && b.calls.length > beforeB && [a, b].every(ui => ui.$('#score-a').textContent === expectedA && ui.$('#score-b').textContent === expectedA), 'shared attack/score updates');
  }
  assert.equal(b.$('#challenge-box').classList.contains('active'), true);
  assert.equal(a.$('#score-a').textContent, '01'); assert.equal(b.$('#score-b').textContent, '01');
  now += 11000; app.extension.tick();
  await until(() => !viewerA.$('#defection-window').hidden && !viewerA.$('#switch-button').disabled, 'automatic defection window');
  await viewerA.click('#switch-button', () => viewerA.$('#my-team').textContent.includes('DOM VIOLET'), 'actual allegiance after defection');
  assert.match(viewerA.$('#play-hint').textContent, /target DOM CORAL/);
  await viewerA.click('#attack-button'); await viewerB.click('#attack-button');
  now += 11000; app.extension.tick();
  await viewerB.click('#attack-button', () => b.$('#score-b').textContent === '02', 'B second community point');
  now += 18000; app.extension.tick();
  await until(() => [a, b, viewerA, viewerB].every(ui => !ui.$('#result-box').hidden), 'all four automatic results');
  const resultText = a.$('#result-title').textContent;
  for (const ui of [a, b, viewerA, viewerB]) {
    assert.equal(ui.$('#score-a').textContent, '01'); assert.equal(ui.$('#score-b').textContent, '02');
    assert.equal(ui.$('#result-title').textContent, resultText); assert.match(ui.$('#result-label').textContent, /AUTOMATIC RESULT/);
    assert.match(ui.$('#result-title').textContent, /DOM VIOLET wins/);
  }
  assert.equal(viewerA.$('#switch-button').disabled, true); assert.equal(viewerA.$('#attack-button').disabled, true);
  assert.equal(viewerA.$('#my-team').textContent, 'FIGHTING FOR DOM VIOLET');
  assert.ok(viewerA.calls.some(call => call.path.endsWith('/play') && call.body.command === '!switch'));
  assert.equal([a, b, viewerA, viewerB].flatMap(ui => ui.calls).some(call => call.path === '/api/action' || call.path === '/api/sandbox/session'), false, 'No third host or sandbox session route used');
});
