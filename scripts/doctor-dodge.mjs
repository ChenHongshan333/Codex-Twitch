import { inspectDodgeConfig, verifyDodgeConnection } from '../src/dodge-setup.mjs';

const connect = process.argv.slice(2).includes('--connect');
if (process.argv.slice(2).some(arg => arg !== '--connect')) {
  console.error('Usage: npm run doctor:dodge [-- --connect]'); process.exitCode = 1;
} else {
  const report = inspectDodgeConfig();
  for (const check of report.checks) console.log(`[${check.ok ? 'OK' : 'NEEDED'}] ${check.message}`);
  console.log('[NOTE] This route needs no Twitch Extension credentials. Existing .env is never modified.');
  if (!report.ok) process.exitCode = 1;
  else if (connect) {
    const result = await verifyDodgeConnection({ token: process.env.TWITCH_OAUTH_TOKEN, channels: { a: process.env.DODGE_CHANNEL_A, b: process.env.DODGE_CHANNEL_B } });
    console.log(`[${result.ok ? 'PASS' : 'NEEDED'}] ${result.message}`);
    if (result.counts) console.log(`Live viewer counts: A=${result.counts.a ?? 'offline/unavailable'}, B=${result.counts.b ?? 'offline/unavailable'}`);
    if (!result.ok) process.exitCode = 1;
  } else console.log('[NEXT] npm run verify:dodge checks authorization, both chats and live counts without sending messages.');
  console.log('[MANUAL] Calibrate /track/a and /track/b; align 960x540 OBS Browser Sources; check real messages, dodging, hits and settlement.');
  console.log('[LIMIT] Current dodge is loopback-only on one computer. Remote two-computer play and specific VTuber adapters are not implemented.');
}
