import { TwitchBridge } from '../src/twitch.mjs';

// Read-only integration check: validates the existing token, subscribes, then exits.
// Does not send any chat messages or reveal the token.
const channelA = process.argv[2] || 'hongshan333';
const channelB = process.argv[3] || '';
for (const channel of [channelA, channelB]) if (channel && !/^[a-zA-Z0-9_]{3,25}$/.test(channel)) throw new Error('Supply Twitch channel names, not URLs.');
const bridge = new TwitchBridge({ token: process.env.TWITCH_OAUTH_TOKEN ?? '' });
let completed = false;
const timeout = setTimeout(() => finish(false, 'Timed out waiting for Twitch. Check token and network access.'), 25000);
function finish(ok, message) {
  if (completed) return; completed = true; clearTimeout(timeout); bridge.stop(false);
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${message}`); process.exitCode = ok ? 0 : 1;
}
bridge.on('status', status => {
  if (status.state === 'connected') finish(true, `EventSub subscribed to ${status.channels.map(channel => channel.login).join(' + ')} as ${status.login}. No chat messages were sent.`);
  else if (['error', 'reconnecting'].includes(status.state)) finish(false, status.message);
});
await bridge.start({ a: channelA.toLowerCase(), b: channelB.toLowerCase() });
