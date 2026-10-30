import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const input = process.argv[2] || JSON.parse(readFileSync(join(root, 'artifacts', 'public-backend.json'), 'utf8')).origin;
const origin = new URL(input);
if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password || ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) throw new Error('Provide the actual public HTTPS backend origin.');
const report = { origin: origin.origin, checkedAt: new Date().toISOString(), checks: [], liveTwitchGameplayVerified: false };
async function check(path, expected, { body, verify } = {}) {
  try {
    const response = await fetch(new URL(path, origin), { method: body ? 'POST' : 'GET', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
    const text = await response.text();
    const passed = expected.includes(response.status) && (!verify || verify(text));
    report.checks.push({ path, status: response.status, passed });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${path}: HTTP ${response.status}`);
    return { status: response.status, text };
  } catch { report.checks.push({ path, passed: false, error: 'Public network request failed.' }); console.log(`[FAIL] ${path}: public network request failed.`); return null; }
}
const health = await check('/api/health', [200], { verify: text => {
  try { const value = JSON.parse(text); return value.service === 'chatcrossfire' && value.ok === true && value.sandboxEnabled === false; } catch { return false; }
} });
if (health?.status === 200) { try { report.extensionConfigured = JSON.parse(health.text).extensionConfigured === true; } catch { report.extensionConfigured = false; } }
await check('/extension/panel.html', [200], { verify: text => text.includes('extension-files.twitch.tv/helper/v1/twitch-ext.min.js') });
await check('/api/state', [404]);
await check('/debug', [404]);
await check('/api/sandbox/session', [403], { body: { persona: 'streamer-a' } });
await check('/api/extension/state', [401, 503]);
report.passed = report.checks.every(check => check.passed);
mkdirSync(join(root, 'artifacts'), { recursive: true });
writeFileSync(join(root, 'artifacts', 'public-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`[STATUS] Extension credentials ${report.extensionConfigured ? 'configured' : 'still needed'}. Twitch installation/gameplay must be verified separately.`);
if (!report.passed) process.exitCode = 1;
