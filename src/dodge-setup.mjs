import { TwitchBridge } from './twitch.mjs';
import { sampleAudience } from './dodge-http.mjs';

// Configuration diagnostics expose booleans and fixed guidance, never credentials.
export function inspectDodgeConfig(env = process.env) {
  const channel = value => /^[a-zA-Z0-9_]{1,25}$/.test(value ?? '');
  const a = env.DODGE_CHANNEL_A ?? '', b = env.DODGE_CHANNEL_B ?? '';
  const token = env.TWITCH_OAUTH_TOKEN ?? '';
  const port = Number(env.DODGE_PORT || 3020);
  const checks = [
    { id: 'live', ok: env.DODGE_LIVE === '1', message: 'DODGE_LIVE=1 selects real Twitch input; restart dodge after editing .env.' },
    { id: 'token', ok: Boolean(token && token !== 'PASTE_NEW_TOKEN_HERE' && /^[a-zA-Z0-9]+$/.test(token)), message: 'TWITCH_OAUTH_TOKEN: user-token format present; authorization and user:read:chat still require verify:dodge. Client Secret is not a user token.' },
    { id: 'channels', ok: channel(a) && channel(b) && a.toLowerCase() !== b.toLowerCase(), message: 'DODGE_CHANNEL_A and DODGE_CHANNEL_B must be two different channel login names, without URLs or @.' },
    { id: 'port', ok: Number.isInteger(port) && port >= 1 && port <= 65535, message: 'DODGE_PORT must be an available local TCP port (default 3020).' },
  ];
  return { ok: checks.every(check => check.ok), checks };
}

// Validates authorization, two EventSub subscriptions and current live counts.
// Never sends chat, starts a match, opens a camera, or starts an OBS broadcast.
export async function verifyDodgeConnection({ token, channels, bridgeFactory = options => new TwitchBridge(options), timeoutMs = 25000 } = {}) {
  const bridge = bridgeFactory({ token });
  let timer;
  try {
    return await new Promise(resolve => {
      let completed = false, sampling = false;
      const finish = result => { if (!completed) { completed = true; clearTimeout(timer); resolve(result); } };
      timer = setTimeout(() => finish({ ok: false, message: 'Twitch connection timed out. Check network access and user authorization.' }), timeoutMs);
      bridge.on('status', status => {
        if (completed) return;
        if (['error', 'reconnecting'].includes(status.state)) {
          finish({ ok: false, message: 'Twitch subscription failed. Check the user token, user:read:chat permission and access to both channels.' });
        } else if (status.state === 'connected' && !sampling) {
          sampling = true;
          void sampleAudience(bridge).then(counts => {
            const ok = ['a', 'b'].every(side => Number.isFinite(counts[side]) && counts[side] > 0);
            finish({ ok, chatsConnected: true, counts, message: ok ? 'Both chats subscribed and both streams have positive viewer counts. Camera/OBS/gameplay still need acceptance.' : 'Both chats subscribed, but both streams need fresh positive viewer counts. Start both authorized broadcasts, have test viewers watch, then retry.' });
          }).catch(() => finish({ ok: false, message: 'Could not read both live viewer counts. Check API/network access and retry.' }));
        }
      });
      void Promise.resolve().then(() => bridge.start(channels)).catch(() => finish({ ok: false, message: 'Twitch connection failed. Check authorization and network access.' }));
    });
  } finally { clearTimeout(timer); bridge.stop(false); }
}
