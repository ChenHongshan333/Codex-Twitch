import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'extension');
const HELP = `Package the Twitch Extension without dependencies or secrets.

Production (explicit public HTTPS backend):
  node scripts/package-extension.mjs --backend https://YOUR-ACTUAL-BACKEND --check
  node scripts/package-extension.mjs --backend https://YOUR-ACTUAL-BACKEND

Local development archive (not a Hosted Test deployment):
  node scripts/package-extension.mjs --backend http://127.0.0.1:3000 --local

--check validates source/config without writing an archive.
--local only accepts an HTTP(S) loopback backend and labels its output LOCAL.
The output directory is always this repository's artifacts/ directory.
`;

export function parseOptions(args) {
  const options = { backend: null, local: false, check: false, help: false };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--backend') {
      if (options.backend !== null || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Supply exactly one URL after --backend.');
      options.backend = args[++index];
    } else if (argument === '--local') options.local = true;
    else if (argument === '--check') options.check = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.help) return options;
  if (!options.backend) throw new Error('An explicit --backend URL is required. No backend URL is guessed or read from .env.');
  let url;
  try { url = new URL(options.backend); } catch { throw new Error('--backend must be an absolute HTTP(S) origin.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('--backend must be an HTTP(S) origin with no path, credentials, query or fragment.');
  }
  const host = url.hostname.toLowerCase();
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(host) || host.endsWith('.localhost');
  if (options.local && !loopback) throw new Error('--local requires a loopback backend such as http://127.0.0.1:3000.');
  if (!options.local && (url.protocol !== 'https:' || loopback)) throw new Error('Production packages require a public HTTPS backend. Use --local for loopback development.');
  if (!options.local && (host.endsWith('.invalid') || host.endsWith('.example') || ['example.com', 'example.org', 'example.net'].includes(host) || host.includes('your-actual-backend'))) {
    throw new Error('Replace the placeholder with the actual deployed HTTPS backend before packaging.');
  }
  options.backend = url.origin;
  return options;
}

export function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ZIP method 0 (stored) is deliberately small and compatible with Twitch's uploader.
// Fixed timestamps make two archives of the same sources byte-for-byte identical.
export function createZip(entries) {
  if (entries.length > 0xffff) throw new Error('Too many archive entries.');
  const locals = [], central = [];
  let offset = 0;
  for (const [path, content] of entries) {
    if (!/^[a-zA-Z0-9._-]+$/.test(path) || path.startsWith('.')) throw new Error('Only explicitly named root-level assets may enter this archive.');
    const name = Buffer.from(path), data = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (data.length > 5 * 1024 * 1024) throw new Error(`Asset ${path} unexpectedly exceeds 5 MB.`);
    const checksum = crc32(data), local = Buffer.alloc(30), directory = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(33, 12);
    local.writeUInt32LE(checksum, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8); directory.writeUInt16LE(0, 10);
    directory.writeUInt16LE(0, 12); directory.writeUInt16LE(33, 14);
    directory.writeUInt32LE(checksum, 16); directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(offset, 42);
    central.push(directory, name); offset += local.length + name.length + data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

export function stripLocalSimulator(source) {
  const start = '/* LOCAL_SIMULATOR_START */', end = '/* LOCAL_SIMULATOR_END */';
  let output = source;
  while (output.includes(start)) {
    const from = output.indexOf(start), to = output.indexOf(end, from + start.length);
    if (to < 0) throw new Error('An unclosed LOCAL_SIMULATOR block was found.');
    output = output.slice(0, from) + output.slice(to + end.length);
  }
  if (output.includes(end)) throw new Error('An unmatched LOCAL_SIMULATOR_END marker was found.');
  if (/\/api\/sandbox\/session/.test(output)) throw new Error('Production app still contains the local simulator session entrypoint. Mark it with LOCAL_SIMULATOR blocks.');
  return output;
}

export async function collectAssets(options) {
  const entries = new Map();
  for (const file of ['index.html', 'app.js', 'styles.css']) {
    try { entries.set(file, await readFile(join(SOURCE, file), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') throw new Error(`Missing extension/${file}. Finish the extension front end before packaging.`); throw error; }
  }
  const html = entries.get('index.html');
  if (!html.includes('https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js')) throw new Error('The native Twitch Extension Helper is missing from index.html.');
  if (!/<head(?:\s[^>]*)?>/i.test(html)) throw new Error('index.html needs a head element for view metadata.');
  if (/(?:src|href)\s*=\s*["']\/(?!\/)/i.test(html)) throw new Error('Extension asset references must be relative, so they work from Twitch CDN subdirectories.');
  if (!options.local) entries.set('app.js', stripLocalSimulator(entries.get('app.js')));
  try { new Script(entries.get('app.js'), { filename: 'packaged-app.js' }); }
  catch { throw new Error('The packaged app.js has a JavaScript syntax error after simulator removal.'); }
  entries.set('config.js', `// Generated public configuration. Never place a Twitch token or shared secret here.\nwindow.CROSSFIRE_CONFIG = Object.freeze(${JSON.stringify({ backendOrigin: options.backend, enableSandbox: options.local })});\n`);
  for (const view of ['panel', 'dashboard', 'config', 'overlay']) {
    entries.set(`${view}.html`, html.replace(/<head(?:\s[^>]*)?>/i, match => `${match}\n  <meta name="crossfire-view" content="${view}">`));
  }
  return [...entries.entries()];
}

export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  if (options.help) { console.log(HELP); return; }
  const entries = await collectAssets(options);
  if (options.check) {
    console.log(`[PASS] ${options.local ? 'LOCAL' : 'PRODUCTION'} assets validated for ${options.backend}. No files written.\nFiles: ${entries.map(([file]) => file).join(', ')}\nThis checks packaging, not Twitch installation or backend availability.`);
    return;
  }
  const directory = join(ROOT, 'artifacts'); await mkdir(directory, { recursive: true });
  const name = options.local ? 'chatcrossfire-extension-local.zip' : 'chatcrossfire-extension.zip';
  const archive = createZip(entries); await writeFile(join(directory, name), archive);
  const manifest = {
    backendOrigin: options.backend, localOnly: options.local,
    files: entries.map(([file]) => file), bytes: archive.length,
    twitchPaths: { panel: 'panel.html', overlay: 'overlay.html', liveConfig: 'dashboard.html', config: 'config.html' },
    verification: 'Archive generated. Twitch installation and production availability must be verified separately.',
  };
  await writeFile(join(directory, name.replace(/\.zip$/, '.json')), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[BUILT] artifacts/${name} (${archive.length} bytes)\nBackend: ${options.backend}\n${options.local ? 'LOCAL DEVELOPMENT ONLY: loopback cannot serve remote Twitch viewers.' : 'Upload the ZIP contents via the Twitch Extension console, then verify Hosted Test with allowlisted accounts.'}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`[PACKAGE] ${error.message}`); process.exitCode = 1; });
}
