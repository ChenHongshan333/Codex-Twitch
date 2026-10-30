import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { isIP } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ORIGIN_ERROR = '--origin must be a public HTTPS domain origin without credentials, a path, query or fragment.';

function publicOrigin(value) {
  if (typeof value !== 'string' || value !== value.trim() || /[?#@]/.test(value)) throw new Error(ORIGIN_ERROR);
  let url;
  try { url = new URL(value); } catch { throw new Error(ORIGIN_ERROR); }
  const host = url.hostname.toLowerCase(), address = host.replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      isIP(address) || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      host.endsWith('.internal') || !host.includes('.') ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
    throw new Error(ORIGIN_ERROR);
  }
  return url.origin;
}

export function parsePublicOptions(argv = process.argv.slice(2)) {
  const values = new Map();
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (typeof argument !== 'string') throw new Error('Expected --origin HTTPS_ORIGIN and optional --port PORT.');
    const separator = argument.indexOf('=');
    const flag = separator < 0 ? argument : argument.slice(0, separator);
    if (!['--origin', '--port'].includes(flag)) throw new Error('Only --origin and --port are supported.');
    if (values.has(flag)) throw new Error(`${flag} must be specified only once.`);
    const value = separator < 0 ? argv[++index] : argument.slice(separator + 1);
    if (typeof value !== 'string' || !value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
    values.set(flag, value);
  }
  if (!values.has('--origin')) throw new Error('--origin is required. Supply the actual HTTPS tunnel or deployment origin.');
  const origin = publicOrigin(values.get('--origin'));
  const rawPort = values.get('--port') ?? '3020';
  if (!/^[1-9][0-9]{0,4}$/.test(rawPort) || Number(rawPort) > 65535) throw new Error('--port must be an integer between 1 and 65535.');
  return { origin, port: Number(rawPort) };
}

function main() {
  const { origin, port } = parsePublicOptions();
  // This is public routing metadata, not a credential. Existing .env values are
  // loaded by Node's --env-file-if-exists flag before this module starts.
  process.env.PUBLIC_ORIGIN = origin;
  const app = startServer({ host: '127.0.0.1', port, publicOrigin: origin, sandboxEnabled: false, debugEnabled: false });
  app.server.once('listening', () => {
    try {
      const directory = join(ROOT, 'artifacts'); mkdirSync(directory, { recursive: true });
      const destination = join(directory, 'public-backend.json');
      const temporary = join(directory, `public-backend.${process.pid}.tmp`);
      const metadata = { origin, port, startedAt: new Date().toISOString(), pid: process.pid, temporary: true, warning: 'Temporary until tunnel process stops' };
      writeFileSync(temporary, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
      renameSync(temporary, destination);
      console.log(`[PUBLIC TEST] Backend ready at ${origin}. Local simulation and debug controls are disabled.`);
      console.log('[PUBLIC TEST] Temporary until tunnel process stops.');
    } catch {
      console.error('[PUBLIC TEST] Could not write artifacts/public-backend.json. Closing the temporary backend.');
      process.exitCode = 1; void app.close();
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(`[PUBLIC TEST] ${error.message}`); process.exitCode = 1; }
}
