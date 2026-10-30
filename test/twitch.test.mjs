import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { TwitchBridge } from '../src/twitch.mjs';

class FakeSocket extends EventTarget {
  static instances = [];
  constructor(url) { super(); this.url = url; FakeSocket.instances.push(this); }
  sendEvent(data) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })); }
  close() { if (this.closed) return; this.closed = true; this.dispatchEvent(new Event('close')); }
}
const welcome = id => ({ metadata: { message_type: 'session_welcome' }, payload: { session: { id, keepalive_timeout_seconds: 10 } } });
const notification = (id, user = 'viewer1', broadcaster = 'channel-a', extra = {}) => ({
  metadata: { message_type: 'notification', subscription_type: 'channel.chat.message', message_id: `envelope-${id}` },
  payload: { event: { message_id: id, broadcaster_user_id: broadcaster, chatter_user_id: user, chatter_user_login: user, message: { text: '!attack' }, ...extra } },
});

async function rig(t, { fetchOverride, retryBaseMs = 60000 } = {}) {
  const calls = [], socketsAtStart = FakeSocket.instances.length;
  const bridge = new TwitchBridge({ token: 'fakeTokenForTests', WebSocketImpl: FakeSocket, retryBaseMs,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (fetchOverride) { const result = fetchOverride(url, options); if (result) return result; }
      const data = url.includes('/validate') ? { user_id: 'bot1', client_id: 'app1', login: 'bot_account', scopes: ['user:read:chat', 'user:write:chat'] } :
        url.includes('/helix/users?') ? { data: [{ id: 'channel-a', login: 'hongshan333' }, { id: 'channel-b', login: 'rival' }] } : { data: [{ is_sent: true }] };
      return { ok: true, json: async () => data };
    },
  });
  t.after(() => bridge.stop(false));
  await bridge.start({ a: 'hongshan333', b: 'rival' });
  return { bridge, calls, socket: FakeSocket.instances[socketsAtStart] };
}

test('one EventSub connection subscribes to both channels using the validated user identity', async t => {
  const { bridge, socket, calls } = await rig(t); socket.sendEvent(welcome('session-1')); await nextTurn();
  assert.equal(bridge.status.state, 'connected'); assert.equal(bridge.status.channels.length, 2);
  const subscriptions = calls.filter(call => call.url.endsWith('/eventsub/subscriptions')).map(call => JSON.parse(call.options.body));
  assert.equal(subscriptions.length, 2);
  assert.deepEqual(subscriptions.map(sub => sub.condition.broadcaster_user_id).sort(), ['channel-a', 'channel-b']);
  assert.ok(subscriptions.every(sub => sub.condition.user_id === 'bot1' && sub.transport.session_id === 'session-1'));
});

test('duplicate delivery, Shared Chat copies and unknown channels do not trigger extra actions', async t => {
  const { bridge, socket } = await rig(t); socket.sendEvent(welcome('session-1')); await nextTurn();
  const chats = []; bridge.on('chat', chat => chats.push(chat));
  socket.sendEvent(notification('message1')); socket.sendEvent(notification('message1'));
  socket.sendEvent(notification('message2', 'viewer1', 'channel-b'));
  socket.sendEvent(notification('message3', 'viewer1', 'channel-b', { source_broadcaster_user_id: 'channel-a' }));
  socket.sendEvent(notification('message4', 'viewer1', 'unknown-channel'));
  await nextTurn(); assert.equal(chats.length, 2); assert.deepEqual(chats.map(chat => chat.channelTeam), ['a', 'b']);
});

test('Twitch-requested migration transfers subscriptions without creating duplicates', async t => {
  const { bridge, socket, calls } = await rig(t); socket.sendEvent(welcome('session-1')); await nextTurn();
  socket.sendEvent({ metadata: { message_type: 'session_reconnect' }, payload: { session: { reconnect_url: 'wss://eventsub.wss.twitch.tv/ws?session=migrate' } } });
  await nextTurn(); const next = FakeSocket.instances.at(-1); assert.notEqual(next, socket);
  next.sendEvent(welcome('session-2')); await nextTurn();
  assert.equal(socket.closed, true); assert.equal(bridge.status.state, 'connected');
  assert.equal(calls.filter(call => call.url.endsWith('/eventsub/subscriptions')).length, 2);
});

test('unexpected disconnection retries with fresh subscriptions and visible status', async t => {
  const { bridge, socket, calls } = await rig(t, { retryBaseMs: 1 }); socket.sendEvent(welcome('session-1')); await nextTurn();
  const reconnected = new Promise(resolve => {
    const listener = status => { if (status.state === 'connecting' && status.message.includes('Opening')) { bridge.off('status', listener); resolve(); } };
    bridge.on('status', listener);
  });
  socket.close(); assert.equal(bridge.status.state, 'reconnecting');
  await reconnected; const next = FakeSocket.instances.at(-1); next.sendEvent(welcome('fresh-session')); await nextTurn();
  assert.equal(bridge.status.state, 'connected');
  assert.equal(calls.filter(call => call.url.endsWith('/eventsub/subscriptions')).length, 4);
});

test('an unauthorized subscription never reports a healthy two-channel connection', async t => {
  const { bridge, socket } = await rig(t, { fetchOverride: (url, options) => url.endsWith('/eventsub/subscriptions') && JSON.parse(options.body).condition.broadcaster_user_id === 'channel-b' ? { ok: false, status: 403 } : null });
  socket.sendEvent(welcome('session-1')); await nextTurn();
  assert.equal(bridge.status.state, 'reconnecting'); assert.ok(bridge.status.channels.every(channel => !channel.subscribed));
  assert.match(bridge.status.message, /403/);
});

test('chat replies are rate limited and token values are redacted from errors', async t => {
  const { bridge, socket, calls } = await rig(t); socket.sendEvent(welcome('session-1')); await nextTurn();
  assert.equal(await bridge.reply('channel-a', 'Hello'), true);
  assert.equal(await bridge.reply('channel-a', 'Hello again'), false);
  assert.equal(calls.filter(call => call.url.endsWith('/chat/messages')).length, 1);
  bridge.report('error', 'Secret fakeTokenForTests should be hidden');
  assert.equal(bridge.status.message.includes('fakeTokenForTests'), false);
});

test('stopping while channel lookup is in flight cannot create a late connection', async t => {
  let finishLookup;
  const bridge = new TwitchBridge({ token: 'fakeToken', WebSocketImpl: FakeSocket, fetchImpl: async url => {
    if (url.includes('/validate')) return { ok: true, json: async () => ({ user_id: 'bot', client_id: 'app', login: 'bot', scopes: ['user:read:chat'] }) };
    return new Promise(resolve => { finishLookup = () => resolve({ ok: true, json: async () => ({ data: [{ id: 'channel-a', login: 'hongshan333' }] }) }); });
  } });
  t.after(() => bridge.stop(false));
  const before = FakeSocket.instances.length; const pending = bridge.start({ a: 'hongshan333' }); await nextTurn();
  bridge.stop(); finishLookup(); await pending;
  assert.equal(FakeSocket.instances.length, before); assert.equal(bridge.status.state, 'disabled');
});
