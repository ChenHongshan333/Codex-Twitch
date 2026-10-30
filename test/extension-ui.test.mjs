import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const html = readFileSync(new URL('../extension/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../extension/app.js', import.meta.url), 'utf8');

function stateFor({ broadcaster = true, side = 'a', room = null, userId = '100' } = {}) {
  return {
    identity: { channelId: side === 'a' ? '100' : '200', userId, opaqueUserId: 'Uopaque', role: broadcaster ? 'broadcaster' : 'viewer', broadcaster },
    room, roomSide: room ? side : null, viewer: { joined: false, team: null, switched: false, attackReadyInMs: 0 }, inputSource: 'twitch-extension',
  };
}
function roomFor(lifecycle = 'running') {
  const team = () => ({ score: 0, members: 0, energy: 0, volleys: 0, attacks: 0, activeChallenge: null, queuedChallenge: null, switchedIn: 0 });
  return {
    id: 'room1', revision: 1, lifecycle, channels: { a: { id: '100', login: 'alpha', name: 'ALPHA' }, b: { id: '200', login: 'bravo', name: 'BRAVO' } },
    inviterChannelId: '100', ready: { a: false, b: false }, countdownRemainingMs: 3000, invitationRemainingMs: 60000,
    engine: { id: 'match1', config: { title: 'Draw a mascot', attackThreshold: 3 }, teams: { a: team(), b: team() }, elapsedMs: 0, remainingMs: 60000, defectionRemainingMs: 0, participants: 0, events: [], result: null, scoreLabel: 'Community battle points' },
  };
}
async function until(check) {
  const deadline = Date.now() + 2500;
  while (!check()) { if (Date.now() > deadline) throw new Error('Extension UI did not reach expected state.'); await new Promise(resolve => setTimeout(resolve, 5)); }
}
async function rig(t, { initial = stateFor(), route = '/extension/index.html', respond, helper = true, helperDelayMs = 0 } = {}) {
  const errors = [], calls = []; let authorized, context, requestIdShares = 0, nextState = initial;
  const virtualConsole = new VirtualConsole(); virtualConsole.on('jsdomError', error => errors.push(error.message)); virtualConsole.on('error', error => errors.push(String(error)));
  const dom = new JSDOM(html, { url: `http://127.0.0.1:3000${route}`, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const { window } = dom;
  window.CROSSFIRE_CONFIG = { backendOrigin: 'http://127.0.0.1:3000' };
  const twitch = { ext: {
    onAuthorized(callback) { authorized = callback; queueMicrotask(() => callback({ token: 'jwt-one', channelId: initial.identity.channelId })); },
    onContext(callback) { context = callback; }, onVisibilityChanged() {}, onError() {},
    actions: { requestIdShare() { requestIdShares++; } },
  } };
  if (helper && !helperDelayMs) window.Twitch = twitch;
  window.fetch = async (url, options) => {
    const path = new URL(url).pathname, input = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ path, input, authorization: options.headers.Authorization });
    const response = await respond?.(path, input, options);
    if (response?.state) nextState = response.state;
    return { ok: response?.ok ?? true, status: response?.status ?? 200, json: async () => response?.payload ?? structuredClone(nextState) };
  };
  window.eval(script);
  if (helper && helperDelayMs) setTimeout(() => {
    window.Twitch = twitch;
    window.document.querySelector('#twitch-extension-helper').dispatchEvent(new window.Event('load'));
  }, helperDelayMs);
  if (!helper && !route.includes('simulator=')) {
    window.document.querySelector('#twitch-extension-helper').dispatchEvent(new window.Event('error'));
    await until(() => window.document.querySelector('#connection span').textContent === 'Open on Twitch');
  }
  t.after(() => { window.dispatchEvent(new window.Event('pagehide')); dom.window.close(); assert.deepEqual(errors, [], 'No Extension client runtime errors'); });
  if (helper || route.includes('simulator=')) await until(() => calls.some(call => call.path === '/api/extension/state') || window.document.querySelector('#connection span').textContent === 'Sandbox unavailable');
  if (helper || route.includes('simulator=')) await until(() => window.document.querySelector('#connection span').textContent !== 'Connecting');
  return {
    window, calls, $: selector => window.document.querySelector(selector),
    authorize: token => authorized({ token, channelId: initial.identity.channelId }),
    setContext: value => context(value), setState: value => { nextState = value; }, get shares() { return requestIdShares; },
  };
}

test('native broadcaster gets an invite form and sends authenticated invitation', async t => {
  const room = roomFor('invited');
  const { $, window, calls } = await rig(t, { respond: path => path.endsWith('/invite') ? { state: stateFor({ room }) } : undefined });
  assert.equal($('#invite-form').hidden, false);
  $('#target-login').value = 'bravo'; $('#match-title').value = 'Draw a mascot';
  $('#invite-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await until(() => !$('#room').hidden);
  const invite = calls.find(call => call.path.endsWith('/invite'));
  assert.deepEqual(invite.input, { targetLogin: 'bravo', title: 'Draw a mascot', durationSeconds: 300 });
  assert.equal(invite.authorization, 'Bearer jwt-one');
  assert.equal($('#accept-button').hidden, true);
  assert.match($('#invite-message').textContent, /Waiting for BRAVO/);
});

test('invited broadcaster accepts, then readies without a third host', async t => {
  const invited = stateFor({ side: 'b', userId: '200', room: roomFor('invited') });
  const lobby = stateFor({ side: 'b', userId: '200', room: roomFor('lobby') });
  const countdown = stateFor({ side: 'b', userId: '200', room: roomFor('countdown') }); countdown.room.revision = 2;
  const { $, calls } = await rig(t, { initial: invited, respond: (path, input) => path.endsWith('/action') ? { state: input.action === 'accept' ? lobby : countdown } : undefined });
  assert.equal($('#accept-button').hidden, false); $('#accept-button').click();
  await until(() => !$('#ready-button').hidden && !$('#ready-button').disabled);
  $('#ready-button').click(); await until(() => !$('#countdown-banner').hidden);
  assert.deepEqual(calls.filter(call => call.path.endsWith('/action')).map(call => call.input.action), ['accept', 'ready']);
});

test('unlinked viewers see identity linking instead of spoofable participation controls', async t => {
  const ui = await rig(t, { initial: stateFor({ broadcaster: false, userId: null, room: roomFor() }) });
  assert.equal(ui.$('#streamer-controls').hidden, true);
  assert.equal(ui.$('#identity-link').hidden, false);
  assert.equal(ui.$('#viewer-action-row').hidden, true);
  ui.$('#link-identity-button').click(); assert.equal(ui.shares, 1);
});

test('viewer attacks after joining and actual allegiance follows a defection', async t => {
  const initial = stateFor({ broadcaster: false, userId: 'viewer1', room: roomFor() });
  const joined = structuredClone(initial); joined.viewer = { joined: true, team: 'a', switched: false, attackReadyInMs: 0 }; joined.room.revision = 2; joined.room.engine.defectionRemainingMs = 15000;
  const defected = structuredClone(joined); defected.viewer.team = 'b'; defected.viewer.switched = true; defected.room.revision = 3;
  const { $, calls } = await rig(t, { initial, respond: (path, input) => path.endsWith('/play') ? { state: input.command === '!switch' ? defected : joined } : undefined });
  assert.equal($('#attack-button').disabled, true); $('#join-button').click();
  await until(() => !$('#attack-button').disabled); $('#attack-button').click();
  await until(() => calls.some(call => call.input?.command === '!attack') && !$('#switch-button').disabled);
  $('#switch-button').click(); await until(() => $('#my-team').textContent.includes('BRAVO'));
  assert.match($('#play-hint').textContent, /target ALPHA/);
  assert.equal($('#switch-button').disabled, true);
});

test('native JWT refresh uses the newest token for the next action', async t => {
  const initial = stateFor({ broadcaster: false, userId: 'viewer1', room: roomFor() });
  const { $, authorize, calls } = await rig(t, { initial });
  authorize('jwt-refreshed');
  await until(() => calls.some(call => call.authorization === 'Bearer jwt-refreshed'));
  $('#join-button').click(); await until(() => calls.some(call => call.path.endsWith('/play')) && !$('#join-button').disabled);
  assert.equal(calls.find(call => call.path.endsWith('/play')).authorization, 'Bearer jwt-refreshed');
});

test('confirmed results and untrusted challenge text are rendered safely', async t => {
  const initial = stateFor({ broadcaster: false, userId: 'viewer1', room: roomFor('finished') });
  const text = '<img src=x onerror=alert(1)>';
  initial.room.channels.a.name = text; initial.room.engine.config.title = text;
  initial.room.engine.result = { winner: 'a', provisional: false };
  initial.room.engine.teams.a.score = 2;
  initial.room.engine.events = [{ id: 1, type: 'defected', name: text, team: 'a', text }];
  const { $ } = await rig(t, { initial });
  assert.equal($('#room-title').textContent, text); assert.match($('#result-title').textContent, /<img/);
  assert.match($('#result-label').textContent, /AUTOMATIC/);
  assert.equal($('#room img'), null); assert.equal($('#event-feed img'), null);
  assert.equal($('#attack-button').disabled, true);
});

test('local personas are explicit and display a simulation banner', async t => {
  const { $, calls } = await rig(t, { helper: false, route: '/extension/index.html?simulator=streamer-a', respond: path => path === '/api/sandbox/session' ? { payload: { token: 'signed-local-test-token', backendOrigin: 'http://127.0.0.1:3000' } } : undefined });
  assert.equal($('#simulation-banner').hidden, false); assert.match($('#simulation-persona').textContent, /STREAMER/);
  const session = calls.find(call => call.path === '/api/sandbox/session');
  assert.deepEqual(session.input, { persona: 'streamer-a' }); assert.equal(session.authorization, undefined);
  assert.equal(calls.find(call => call.path === '/api/extension/state').authorization, 'Bearer signed-local-test-token');
});

test('standalone native page does not silently forge a local identity', async t => {
  const { $, calls } = await rig(t, { helper: false });
  assert.equal(calls.length, 0); assert.equal($('#simulation-banner').hidden, true);
  assert.equal($('#connection span').textContent, 'Open on Twitch');
  assert.equal($('#invite-form').hidden, true);
});

test('configuration view confirms setup without exposing an invite form', async t => {
  const { $ } = await rig(t, { route: '/extension/index.html?view=config' });
  assert.equal($('#invite-form').hidden, true); assert.match($('#welcome-note').textContent, /Backend connected/);
});

test('asynchronous Twitch Helper can load after the app while native authorization still initializes', async t => {
  const { $, calls } = await rig(t, { helperDelayMs: 25 });
  assert.equal($('#twitch-extension-helper').hasAttribute('async'), true);
  assert.equal($('#connection span').textContent, 'Twitch connected');
  assert.equal($('#invite-form').hidden, false);
  assert.equal(calls.find(call => call.path === '/api/extension/state').authorization, 'Bearer jwt-one');
});
