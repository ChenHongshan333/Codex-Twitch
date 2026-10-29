// Local setup bot. Node.js >=22; no third-party dependencies.
const token = (process.env.TWITCH_OAUTH_TOKEN ?? '').trim();
const sockets = new Set();
let stopping = false;
let identity;
let validationTimer;
let lastReply = 0;
const seen = new Set();

function safe(value) {
  const text = String(value);
  return token ? text.split(token).join('[REDACTED]') : text;
}

function stop(error) {
  if (stopping) return;
  stopping = true;
  clearInterval(validationTimer);
  for (const socket of sockets) {
    clearTimeout(socket.watchdog);
    socket.close();
  }
  if (error) console.error('[ERROR]', safe(error.message ?? error));
  else console.log('[STOP] Bot stopped.');
  process.exit(error ? 1 : 0);
}

async function validate() {
  const response = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Token validation failed (HTTP ${response.status}). Get a new USER token and update .env.`);
  const auth = await response.json();
  if (!auth.user_id || !auth.client_id || !auth.login) throw new Error('A USER access token is required.');
  const missing = ['user:read:chat', 'user:write:chat'].filter(scope => !auth.scopes?.includes(scope));
  if (missing.length) throw new Error(`Missing permissions: ${missing.join(', ')}. Authorize again.`);
  if (identity && (auth.user_id !== identity.user_id || auth.client_id !== identity.client_id)) {
    throw new Error('Token identity changed. Restart the bot.');
  }
  return auth;
}

async function api(path, body) {
  const response = await fetch(`https://api.twitch.tv/helix/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id': identity.client_id,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} - ${safe(result.message ?? 'request failed')}`);
  return result;
}

function connect(url = 'wss://eventsub.wss.twitch.tv/ws', previous = null) {
  const socket = new WebSocket(url);
  sockets.add(socket);
  let welcomed = false;
  let migrating = false;
  let timeoutSeconds = 10;
  function resetWatchdog() {
    clearTimeout(socket.watchdog);
    socket.watchdog = setTimeout(() => stop(new Error('No EventSub messages received. Check your network, then restart.')), (timeoutSeconds + 5) * 1000);
  }
  resetWatchdog();
  socket.addEventListener('error', () => stop(new Error('WebSocket connection failed. Check your network and restart.')));
  socket.addEventListener('close', event => {
    sockets.delete(socket);
    clearTimeout(socket.watchdog);
    if (!stopping && !migrating) stop(new Error(`EventSub disconnected (code ${event.code}). Restart the bot.`));
  });
  socket.addEventListener('message', event => {
    void handle(event).catch(stop);
  });
  async function handle(event) {
    const message = JSON.parse(event.data);
    resetWatchdog();
    const type = message.metadata.message_type;
    if (type === 'session_welcome') {
      if (welcomed) return;
      welcomed = true;
      timeoutSeconds = message.payload.session.keepalive_timeout_seconds ?? 10;
      resetWatchdog();
      if (previous) {
        // Twitch transfers existing subscriptions to this new connection.
        clearTimeout(previous.watchdog);
        previous.close();
        console.log('[CONNECTED] Twitch session migrated.');
      } else {
        console.log('[CONNECTED] EventSub WebSocket connected.');
        await api('eventsub/subscriptions', {
          type: 'channel.chat.message',
          version: '1',
          condition: { broadcaster_user_id: identity.user_id, user_id: identity.user_id },
          transport: { method: 'websocket', session_id: message.payload.session.id },
        });
        console.log('[READY] Subscribed to channel.chat.message');
        console.log(`[TEST] Open https://www.twitch.tv/${identity.login}/chat and send HeyGuys`);
      }
    } else if (type === 'session_reconnect') {
      if (migrating) return;
      const next = new URL(message.payload.session.reconnect_url);
      if (next.protocol !== 'wss:' || next.hostname !== 'eventsub.wss.twitch.tv') throw new Error('Unexpected reconnect host.');
      migrating = true;
      console.log('[RECONNECT] Migrating Twitch session...');
      connect(next.href, socket);
    } else if (type === 'revocation') {
      throw new Error(`Subscription revoked: ${message.payload.subscription.status}. Authorize again and restart.`);
    } else if (type === 'notification' && message.metadata.subscription_type === 'channel.chat.message') {
      const id = message.metadata.message_id;
      if (seen.has(id)) return;
      seen.add(id);
      if (seen.size > 1000) seen.delete(seen.values().next().value);
      const chat = message.payload.event;
      console.log(safe(`[CHAT] ${chat.chatter_user_login}: ${chat.message.text}`));
      if (chat.message.text.trim() !== 'HeyGuys') return;
      if (Date.now() - lastReply < 2000) return;
      lastReply = Date.now();
      const result = await api('chat/messages', {
        broadcaster_id: identity.user_id,
        sender_id: identity.user_id,
        message: 'VoHiYo',
      });
      if (!result.data?.[0]?.is_sent) {
        console.error('[NOT SENT]', safe(result.data?.[0]?.drop_reason?.message ?? 'Twitch did not send the reply.'));
      } else console.log('[SENT] VoHiYo');
    }
  }
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

try {
  if (!token || token === 'PASTE_NEW_TOKEN_HERE') throw new Error('Open .env and replace PASTE_NEW_TOKEN_HERE with your new access token.');
  if (!/^[a-zA-Z0-9]+$/.test(token)) throw new Error('Paste only the token into .env, without the URL, access_token=, or &scope=...');
  identity = await validate();
  console.log(`[AUTH OK] Account: ${identity.login} | User ID: ${identity.user_id}`);
  console.log(`[CHANNEL] Using your own channel: ${identity.login}`);
  console.log('[INFO] Replies use your own account. Press Ctrl+C to stop.');
  validationTimer = setInterval(() => { void validate().catch(stop); }, 60 * 60 * 1000);
  validationTimer.unref();
  connect();
} catch (error) { stop(error); }
