import { startDodgeServer } from '../src/dodge-http.mjs';

const app = await startDodgeServer({ mode: process.env.DODGE_MODE || 'duel', port: Number(process.env.DODGE_PORT || 3020), live: process.env.DODGE_LIVE === '1',
  token: process.env.TWITCH_OAUTH_TOKEN || '', channels: { a: process.env.DODGE_CHANNEL_A, b: process.env.DODGE_CHANNEL_B },
  supportTokens: { a: process.env.DODGE_SUPPORT_TOKEN_A, b: process.env.DODGE_SUPPORT_TOKEN_B } });
console.log(`ChatCrossfire dodge controller: http://127.0.0.1:${app.server.address().port}/ (${process.env.DODGE_LIVE === '1' ? 'Twitch input' : 'synthetic rehearsal'}; ${app.engine.mode})`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void app.close().then(() => process.exit(0)); });
