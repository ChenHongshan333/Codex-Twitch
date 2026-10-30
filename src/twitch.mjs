import { EventEmitter } from 'node:events';

const EVENTSUB = 'wss://eventsub.wss.twitch.tv/ws';

export class TwitchBridge extends EventEmitter {
  constructor({ token = '', fetchImpl = fetch, WebSocketImpl = WebSocket, retryBaseMs = 1500 } = {}) {
    super(); this.token = token.trim(); this.fetch = fetchImpl; this.WebSocket = WebSocketImpl;
    this.retryBaseMs = retryBaseMs; this.epoch = 0; this.sockets = new Set();
    this.seen = new Set(); this.replies = new Map(); this.retryCount = 0;
    this.status = { state: 'disabled', message: 'Twitch is off. Demo inputs are simulated.', channels: [], login: null };
  }
  safe(value) { return this.token ? String(value).split(this.token).join('[REDACTED]') : String(value); }
  report(state, message, extra = {}) {
    this.status = { ...this.status, state, message: this.safe(message), ...extra };
    this.emit('status', structuredClone(this.status));
  }
  async request(url, { body, validate = false } = {}) {
    const response = await this.fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: validate ? { Authorization: `OAuth ${this.token}` } : {
        Authorization: `Bearer ${this.token}`, 'Client-Id': this.identity.client_id,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      // Keep tokens and arbitrary upstream response bodies out of logs and public state.
      throw new Error(`Twitch ${validate ? 'token validation' : new URL(url).pathname} returned HTTP ${response.status}.${response.status === 401 ? ' Update .env with a valid user token and restart.' : ''}`);
    }
    return response.json();
  }
  async validate() {
    const auth = await this.request('https://id.twitch.tv/oauth2/validate', { validate: true });
    if (!auth.user_id || !auth.client_id || !auth.login) throw new Error('A Twitch USER access token is required.');
    if (!auth.scopes?.includes('user:read:chat')) throw new Error('Token is missing user:read:chat. Authorize again.');
    if (this.identity && (auth.user_id !== this.identity.user_id || auth.client_id !== this.identity.client_id)) throw new Error('Twitch token identity changed. Restart the server.');
    this.identity = auth;
  }
  async start(channels) {
    this.stop(false); this.desiredChannels = { ...channels };
    this.seen.clear(); this.retryCount = 0;
    if (!this.token || this.token === 'PASTE_NEW_TOKEN_HERE' || !/^[a-zA-Z0-9]+$/.test(this.token)) {
      this.report('error', 'Set TWITCH_OAUTH_TOKEN in .env, then restart. Demo mode works without a token.', { channels: [], login: null });
      return;
    }
    await this.boot(this.epoch);
  }
  async boot(epoch) {
    try {
      this.report('connecting', 'Validating token and resolving channels…', { channels: [], login: null });
      await this.validate();
      if (epoch !== this.epoch) return;
      const entries = Object.entries(this.desiredChannels).filter(([, login]) => login);
      if (!entries.length) throw new Error('Set at least one Twitch channel in room settings.');
      const query = new URLSearchParams(entries.map(([, login]) => ['login', login]));
      const users = await this.request(`https://api.twitch.tv/helix/users?${query}`);
      if (epoch !== this.epoch) return;
      this.channels = entries.map(([team, login]) => {
        const user = users.data?.find(user => user.login.toLowerCase() === login.toLowerCase());
        if (!user) throw new Error(`Twitch channel ${login} was not found.`);
        return { team, login: user.login, id: user.id, subscribed: false };
      });
      this.report('connecting', 'Opening Twitch EventSub…', { channels: this.channels, login: this.identity.login });
      this.connect(EVENTSUB, epoch);
      clearInterval(this.validationTimer);
      this.validationTimer = setInterval(() => {
        void this.validate().catch(error => { if (epoch === this.epoch) this.fail(error, epoch); });
      }, 3600000);
      this.validationTimer.unref?.();
    } catch (error) { if (epoch === this.epoch) this.fail(error, epoch); }
  }
  connect(url, epoch, previous = null) {
    const socket = new this.WebSocket(url);
    const connection = { socket, epoch, welcomed: false, intentional: false, migrating: false, timeout: 15000 };
    this.sockets.add(connection);
    const watchdog = () => {
      clearTimeout(connection.watchdog);
      connection.watchdog = setTimeout(() => this.fail(new Error('Twitch keepalive timed out. Events during a disconnect cannot be replayed.'), epoch), connection.timeout);
      connection.watchdog.unref?.();
    };
    watchdog();
    socket.addEventListener('error', () => { if (!connection.intentional && epoch === this.epoch) this.fail(new Error('Twitch WebSocket failed. Check network access.'), epoch); });
    socket.addEventListener('close', () => {
      this.sockets.delete(connection); clearTimeout(connection.watchdog);
      if (!connection.intentional && epoch === this.epoch) this.fail(new Error('Twitch disconnected. Missing chat events cannot be recovered.'), epoch);
    });
    socket.addEventListener('message', event => {
      if (epoch !== this.epoch || connection.intentional) return;
      watchdog();
      void this.handle(connection, event.data, previous).then(() => {
        if (!connection.intentional && epoch === this.epoch) watchdog();
      }).catch(error => { if (epoch === this.epoch) this.fail(error, epoch); });
    });
    return connection;
  }
  async handle(connection, raw, previous) {
    const message = JSON.parse(raw), type = message.metadata?.message_type;
    if (type === 'session_welcome') {
      if (connection.welcomed) return;
      connection.welcomed = true;
      connection.timeout = ((message.payload.session.keepalive_timeout_seconds ?? 10) + 5) * 1000;
      if (previous) {
        previous.intentional = true; clearTimeout(previous.watchdog); previous.socket.close(); this.sockets.delete(previous);
      } else {
        await Promise.all(this.channels.map(async channel => {
          await this.request('https://api.twitch.tv/helix/eventsub/subscriptions', { body: {
            type: 'channel.chat.message', version: '1',
            condition: { broadcaster_user_id: channel.id, user_id: this.identity.user_id },
            transport: { method: 'websocket', session_id: message.payload.session.id },
          } });
          if (connection.epoch === this.epoch) channel.subscribed = true;
        }));
      }
      if (connection.epoch !== this.epoch) return;
      this.retryCount = 0;
      this.report('connected', this.channels.length === 2 ? 'Both Twitch chats connected.' : 'One Twitch chat connected. Configure the second channel for a full PK.', { channels: this.channels });
    } else if (type === 'session_reconnect') {
      if (connection.migrating) return;
      const url = new URL(message.payload.session.reconnect_url);
      if (url.protocol !== 'wss:' || url.hostname !== 'eventsub.wss.twitch.tv' || url.username || url.password) throw new Error('Unexpected Twitch reconnect address.');
      connection.migrating = true;
      this.report('connecting', 'Migrating Twitch session…');
      this.connect(url.href, connection.epoch, connection);
    } else if (type === 'revocation') {
      throw new Error('Twitch revoked a chat subscription. Check the token permissions and channel access.');
    } else if (type === 'notification' && message.metadata.subscription_type === 'channel.chat.message') {
      const chat = message.payload.event;
      const channel = this.channels.find(channel => channel.id === chat.broadcaster_user_id);
      if (!channel) return;
      // Shared Chat forwards the same source message into another channel. Ignore the copy.
      if (chat.source_broadcaster_user_id && chat.source_broadcaster_user_id !== chat.broadcaster_user_id) return;
      const id = chat.message_id ?? message.metadata.message_id;
      if (!id || this.seen.has(id)) return;
      this.seen.add(id); if (this.seen.size > 5000) this.seen.delete(this.seen.values().next().value);
      this.emit('chat', { userId: chat.chatter_user_id, name: chat.chatter_user_name || chat.chatter_user_login, channelTeam: channel.team, text: chat.message.text, channelId: channel.id });
    }
  }
  fail(error, epoch) {
    if (epoch !== this.epoch) return;
    this.clearConnections(); clearInterval(this.validationTimer);
    // A new epoch invalidates all outstanding fetches and old socket callbacks.
    this.epoch++; const retryEpoch = this.epoch;
    const delay = Math.min(30000, this.retryBaseMs * 2 ** Math.min(this.retryCount++, 5));
    this.report('reconnecting', `${this.safe(error.message)} Retrying in ${Math.ceil(delay / 1000)}s.`, {
      channels: (this.channels ?? []).map(channel => ({ ...channel, subscribed: false })),
    });
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => { void this.boot(retryEpoch); }, delay);
    this.retryTimer.unref?.();
  }
  async reply(channelId, message) {
    if (this.status.state !== 'connected' || !this.identity.scopes.includes('user:write:chat')) return false;
    const now = Date.now();
    if (now - (this.replies.get(channelId) ?? 0) < 8000 || now - (this.lastReply ?? 0) < 1200) return false;
    this.replies.set(channelId, now); this.lastReply = now;
    try {
      const result = await this.request('https://api.twitch.tv/helix/chat/messages', { body: {
        broadcaster_id: channelId, sender_id: this.identity.user_id, message: message.slice(0, 450),
      } });
      return Boolean(result.data?.[0]?.is_sent);
    } catch { this.emit('reply_error', 'A chat reply could not be sent. Match state is unaffected.'); return false; }
  }
  clearConnections() {
    for (const connection of this.sockets) {
      connection.intentional = true; clearTimeout(connection.watchdog);
      try { connection.socket.close(); } catch { /* Already closed. */ }
    }
    this.sockets.clear();
  }
  stop(report = true) {
    this.epoch++; clearTimeout(this.retryTimer); clearInterval(this.validationTimer); this.clearConnections();
    if (report) this.report('disabled', 'Twitch is off. Demo inputs are simulated.', { channels: [], login: null });
  }
}
