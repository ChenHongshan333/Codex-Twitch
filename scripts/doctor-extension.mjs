import { ExtensionAuth } from '../src/extension-auth.mjs';

// Configuration names/status only. Never print token values, decoded keys, or secrets.
let ready = true;
function check(ok, message) { console.log(`${ok ? '[OK]' : '[NEEDED]'} ${message}`); if (!ok) ready = false; }
const id = process.env.TWITCH_EXTENSION_ID ?? '', secret = process.env.TWITCH_EXTENSION_SECRET ?? '';
check(Boolean(id), 'TWITCH_EXTENSION_ID: native Extension Client ID');
check(Boolean(secret), 'TWITCH_EXTENSION_SECRET: Base64 shared secret (separate from bot OAuth)');
if (id && secret) {
  try { new ExtensionAuth({ extensionId: id, secret }); check(true, 'Extension credential format valid'); }
  catch { check(false, 'Extension credential format is invalid; check the private .env values'); }
}
check(Boolean(process.env.TWITCH_OAUTH_TOKEN && process.env.TWITCH_OAUTH_TOKEN !== 'PASTE_NEW_TOKEN_HERE'), 'TWITCH_OAUTH_TOKEN: channel lookup and optional chat bridge');
let publicReady = false;
try {
  const url = new URL(process.env.PUBLIC_ORIGIN || '');
  publicReady = url.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password;
} catch { /* No public origin yet. */ }
check(publicReady, 'PUBLIC_ORIGIN: actual public HTTPS backend origin');
check(process.env.ENABLE_SANDBOX !== '1', 'Public deployment: local simulation disabled');
console.log('\n[MANUAL] Confirm both Twitch channels install/activate the Extension and all test accounts are allowlisted.');
console.log('[MANUAL] Confirm identity linking and backend URL allowlist in the Extension console.');
console.log('[NOTE] This checks configuration presence, not Twitch installation or live gameplay.');
if (!ready) process.exitCode = 1;
