import { RuleError } from './engine.mjs';

export class TwitchDirectory {
  constructor({ token = '', fetchImpl = fetch, now = Date.now } = {}) {
    this.token = token.trim(); this.fetch = fetchImpl; this.now = now; this.cache = new Map();
  }
  async auth() {
    if (this.identity && this.identityUntil > this.now()) return this.identity;
    if (!this.token || !/^[a-zA-Z0-9]+$/.test(this.token) || this.token === 'PASTE_NEW_TOKEN_HERE') {
      const error = new RuleError('Configure TWITCH_OAUTH_TOKEN on the backend to look up your opponent.', 'twitch_configuration'); error.status = 503; throw error;
    }
    const response = await this.fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${this.token}` }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) { const error = new RuleError(`Twitch token validation failed (HTTP ${response.status}). Update the backend token.`, 'twitch_configuration'); error.status = 503; throw error; }
    const identity = await response.json();
    if (!identity.client_id || !identity.user_id) throw new RuleError('A Twitch user token is required on the backend.');
    this.identity = identity; this.identityUntil = this.now() + Math.min(300000, Math.max(1000, (identity.expires_in ?? 300) * 1000));
    return identity;
  }
  async resolve({ id, login }) {
    if (id !== undefined && (typeof id !== 'string' || !/^\d+$/.test(id))) throw new RuleError('Invalid channel ID.');
    if (login !== undefined && (typeof login !== 'string' || !/^[a-zA-Z0-9_]{3,25}$/.test(login))) throw new RuleError('Enter a Twitch channel login, not a URL.');
    if (!id && !login) throw new RuleError('A channel ID or login is required.');
    const key = id ? `id:${id}` : `login:${login.toLowerCase()}`;
    const cached = this.cache.get(key); if (cached?.until > this.now()) return { ...cached.channel };
    try {
      const identity = await this.auth();
      const params = new URLSearchParams(id ? { id } : { login: login.toLowerCase() });
      const response = await this.fetch(`https://api.twitch.tv/helix/users?${params}`, { headers: { Authorization: `Bearer ${this.token}`, 'Client-Id': identity.client_id }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) { const error = new RuleError(`Twitch channel lookup failed (HTTP ${response.status}).`, 'twitch_lookup'); error.status = 502; throw error; }
      const user = (await response.json()).data?.[0];
      if (!user || id && user.id !== id || login && user.login.toLowerCase() !== login.toLowerCase()) throw new RuleError('That Twitch channel was not found.', 'channel_not_found');
      const channel = { id: user.id, login: user.login, name: user.display_name || user.login };
      const value = { channel, until: this.now() + 300000 };
      if (this.cache.size > 1000) this.cache.clear();
      this.cache.set(`id:${user.id}`, value); this.cache.set(`login:${user.login.toLowerCase()}`, value);
      return { ...channel };
    } catch (error) {
      if (error instanceof RuleError) throw error;
      const safe = new RuleError('Cannot reach Twitch to look up channels. Check backend network access.', 'twitch_network'); safe.status = 502; throw safe;
    }
  }
}
