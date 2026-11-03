import { TwitchBridge } from './twitch.mjs';
import { sampleAudience } from './dodge-http.mjs';

// Configuration diagnostics expose booleans and fixed guidance, never credentials.
export function inspectDodgeConfig(env = process.env) {
  const channel = value => /^[a-zA-Z0-9_]{1,25}$/.test(value ?? '');
  const a = env.DODGE_CHANNEL_A ?? '', b = env.DODGE_CHANNEL_B ?? '';
  const token = env.TWITCH_OAUTH_TOKEN ?? '';
  const port = Number(env.DODGE_PORT || 3020);
  const mode = env.DODGE_MODE || 'duel', aiDemo = mode === 'ai-demo';
  const checks = [
    { id: 'mode', ok: ['duel', 'ai-demo'].includes(mode), message: 'DODGE_MODE is duel (two real channels) or ai-demo (one real channel versus local game AI).' },
    { id: 'live', ok: env.DODGE_LIVE === '1', message: 'DODGE_LIVE=1 selects real Twitch input; restart dodge after editing .env.' },
    { id: 'token', ok: Boolean(token && token !== 'PASTE_NEW_TOKEN_HERE' && /^[a-zA-Z0-9]+$/.test(token)), message: 'TWITCH_OAUTH_TOKEN: user-token format present; authorization and user:read:chat still require verify:dodge. Client Secret is not a user token.' },
    { id: 'channels', ok: channel(a) && (aiDemo || channel(b) && a.toLowerCase() !== b.toLowerCase()), message: aiDemo ? 'DODGE_CHANNEL_A must be your real Twitch login. Channel B is local AI, not a second Twitch channel; DODGE_CHANNEL_B is ignored.' : 'DODGE_CHANNEL_A and DODGE_CHANNEL_B must be two different channel login names, without URLs or @.' },
    { id: 'port', ok: Number.isInteger(port) && port >= 1 && port <= 65535, message: 'DODGE_PORT must be an available local TCP port (default 3020).' },
  ];
  return { ok: checks.every(check => check.ok), checks };
}

// Validates authorization, two EventSub subscriptions and current live counts.
// Never sends chat, starts a match, opens a camera, or starts an OBS broadcast.
export async function verifyDodgeConnection({ token, channels, mode = 'duel', bridgeFactory = options => new TwitchBridge(options), timeoutMs = 25000 } = {}) {
  if (!['duel', 'ai-demo'].includes(mode)) throw new Error('Unknown dodge mode.');
  const aiDemo = mode === 'ai-demo', requiredSides = aiDemo ? ['a'] : ['a', 'b'];
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
          finish({ ok: false, message: aiDemo ? 'Twitch subscription failed. Check the user token, user:read:chat permission and channel access.' : 'Twitch subscription failed. Check the user token, user:read:chat permission and access to both channels.' });
        } else if (status.state === 'connected' && !sampling) {
          sampling = true;
          void sampleAudience(bridge, requiredSides).then(counts => {
            const ok = requiredSides.every(side => Number.isFinite(counts[side]) && (aiDemo ? counts[side] >= 0 : counts[side] > 0));
            finish({ ok, chatsConnected: true, counts, message: aiDemo ? (ok ? 'Your Twitch chat is subscribed and Twitch confirms the stream is live. Zero actual viewers is allowed; the opponent is local AI. Camera/OBS/gameplay still need acceptance.' : 'Your Twitch chat is subscribed, but Twitch must confirm that the channel is live. Start your authorized broadcast, then retry.') : (ok ? 'Both chats subscribed and both streams have positive viewer counts. Camera/OBS/gameplay still need acceptance.' : 'Both chats subscribed, but both streams need fresh positive viewer counts. Start both authorized broadcasts, have test viewers watch, then retry.') });
          }).catch(() => finish({ ok: false, message: aiDemo ? 'Could not read your live viewer count. Check API/network access and retry.' : 'Could not read both live viewer counts. Check API/network access and retry.' }));
        }
      });
      void Promise.resolve().then(() => bridge.start(aiDemo ? { a: channels.a } : channels)).catch(() => finish({ ok: false, message: 'Twitch connection failed. Check authorization and network access.' }));
    });
  } finally { clearTimeout(timer); bridge.stop(false); }
}
