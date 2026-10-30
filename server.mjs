import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { MatchEngine, RuleError } from './src/engine.mjs';
import { Store } from './src/store.mjs';
import { TwitchBridge } from './src/twitch.mjs';
import { ExtensionHttp, ExtensionAuthError } from './src/extension-http.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ASSETS = new Map([
  ['/', ['landing.html', 'text/html; charset=utf-8']],
  ['/debug', ['index.html', 'text/html; charset=utf-8']],
  ['/sandbox', ['sandbox.html', 'text/html; charset=utf-8']],
  ['/sandbox.js', ['sandbox.js', 'text/javascript; charset=utf-8']],
  ['/overlay/a', ['index.html', 'text/html; charset=utf-8']],
  ['/overlay/b', ['index.html', 'text/html; charset=utf-8']],
  ['/cue/a', ['index.html', 'text/html; charset=utf-8']],
  ['/cue/b', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
]);

export function createApp({
  store = new Store(join(ROOT, 'data')), engine, bridge,
  token = process.env.TWITCH_OAUTH_TOKEN ?? '',
  adminKey = process.env.ADMIN_KEY || randomBytes(24).toString('hex'),
  publicOrigin = process.env.PUBLIC_ORIGIN || '',
  extensionId = process.env.TWITCH_EXTENSION_ID ?? '',
  extensionSecret = process.env.TWITCH_EXTENSION_SECRET ?? '',
  extensionAllowedOrigins = process.env.EXTENSION_ALLOWED_ORIGINS ?? '',
  sandboxEnabled = process.env.ENABLE_SANDBOX === '1',
  debugEnabled = !publicOrigin && process.env.ENABLE_DEBUG !== '0',
  extensionOptions = {},
} = {}) {
  if (adminKey.length < 24) throw new Error('ADMIN_KEY must contain at least 24 characters.');
  if (sandboxEnabled && publicOrigin) throw new Error('Local simulation cannot be enabled with PUBLIC_ORIGIN. Use npm run sandbox on loopback only.');
  if (publicOrigin) {
    const origin = new URL(publicOrigin);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
      throw new Error('PUBLIC_ORIGIN must be an HTTP(S) origin without a path, query, credentials or fragment.');
    }
    publicOrigin = origin.origin;
  }
  engine ??= new MatchEngine({ config: store.loadConfig() });
  bridge ??= new TwitchBridge({ token });
  const extension = new ExtensionHttp({ extensionId, extensionSecret, token, sandboxEnabled,
    onEvents: (id, events) => store.log(id, events), ...extensionOptions });
  const session = randomBytes(32).toString('hex');
  const clients = new Set(); let loggedMatch = null; let loggedSequence = 0;
  const demoNames = { a: ['pixelpilot', 'mango.exe', 'noodleknight', 'cozycomet', 'tinychaos'], b: ['moonmoth', 'jellybyte', 'citrusclub', 'starloaf', 'ghosttoast'] };
  let demoCursor = { a: 0, b: 0 }; let shuttingDown = false;
  const equal = (a, b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  function isAdmin(req) { return (req.headers.cookie ?? '').split(';').some(part => equal(part.trim(), `crossfire_session=${session}`)); }
  function snapshot() { return { ...engine.snapshot(), twitch: structuredClone(bridge.status) }; }
  function logEvents() {
    if (loggedMatch !== engine.id) { loggedMatch = engine.id; loggedSequence = 0; }
    const events = engine.events.filter(event => event.id > loggedSequence);
    if (events.length) { store.log(engine.id, events); loggedSequence = events.at(-1).id; }
  }
  function broadcast() {
    logEvents(); const state = snapshot();
    const packet = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
    for (const res of clients) {
      if (res.writableLength > 512 * 1024 || res.destroyed) { res.destroy(); clients.delete(res); }
      else res.write(packet);
    }
    return state;
  }
  function restartBridge() {
    if (engine.mode === 'live') void bridge.start({ a: engine.config.channelA, b: engine.config.channelB });
    else bridge.stop();
  }
  bridge.on('status', () => { if (!shuttingDown) broadcast(); });
  bridge.on('chat', chat => {
    if (engine.mode !== 'live') return;
    if (chat.text.trim() === 'HeyGuys') { void bridge.reply(chat.channelId, 'VoHiYo · ChatCrossfire ready! !join · !attack · !switch'); return; }
    try {
      const result = engine.command(chat);
      if (result.help) void bridge.reply(chat.channelId, result.text);
      else if (result.joined) void bridge.reply(chat.channelId, `${chat.name} joined ${engine.name(result.team)}. Type !attack once the round starts.`);
      else if (result.switched) void bridge.reply(chat.channelId, `${chat.name} crossed the line! Now fighting for ${engine.name(result.team)}.`);
      if (!result.ignored && !result.help) broadcast();
    } catch (error) {
      if (error instanceof RuleError && error.code !== 'cooldown' && error.code !== 'charged') void bridge.reply(chat.channelId, `${chat.name}: ${error.message}`);
      else if (!(error instanceof RuleError)) console.error('[CHAT] Unable to process chat event.');
    }
  });
  bridge.on('reply_error', message => console.warn(`[TWITCH] ${message}`));

  function send(res, status, value, headers = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
    res.end(JSON.stringify(value));
  }
  async function body(req) {
    let size = 0; const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16384) throw new RuleError('Request body is too large.');
      chunks.push(chunk);
    }
    try {
      const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
      return value;
    } catch { throw new RuleError('Expected a JSON object.'); }
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const path = new URL(req.url, 'http://localhost').pathname;
    const isExtensionAsset = path.startsWith('/extension/');
    if (!isExtensionAsset) res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', isExtensionAsset
      ? "default-src 'self'; script-src 'self' https://extension-files.twitch.tv; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors https://*.twitch.tv https://twitch.tv https://*.ext-twitch.tv 'self'; base-uri 'none'; form-action 'self'"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const port = server.address()?.port;
    const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
    if (publicOrigin) allowedHosts.add(new URL(publicOrigin).host);
    if (!allowedHosts.has(req.headers.host)) return send(res, 403, { error: 'Host is not allowed. Set PUBLIC_ORIGIN for a remote deployment.' });
    const origin = req.headers.origin;
    const allowedOrigins = new Set([`http://${req.headers.host}`, ...(publicOrigin ? [publicOrigin.replace(/\/$/, '')] : [])]);
    if (path.startsWith('/api/extension/')) {
      if (extensionId) allowedOrigins.add(`https://${extensionId.toLowerCase()}.ext-twitch.tv`);
      for (const entry of extensionAllowedOrigins.split(',').map(value => value.trim()).filter(Boolean)) allowedOrigins.add(entry);
    }
    if (origin && !allowedOrigins.has(origin)) return send(res, 403, { error: 'Cross-origin requests are not allowed.' });
    if (origin && path.startsWith('/api/extension/')) {
      res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Extension-JWT');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Max-Age', '300');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    }
    try {
      if (await extension.handle(req, res, { path, readBody: body, send })) return;
      if (!debugEnabled && (path === '/debug' || path.startsWith('/api/'))) return send(res, 404, { error: 'Developer controls are disabled on this backend.' });
      if (path === '/api/state' && req.method === 'GET') return send(res, 200, snapshot());
      if (path === '/api/session' && req.method === 'GET') return send(res, 200, { admin: isAdmin(req) });
      if (path === '/api/session' && req.method === 'POST') {
        // Fixed-length keys, rate limited per connection address, never stored in the browser URL.
        const address = req.socket.remoteAddress;
        const limit = loginAttempts.get(address) ?? { count: 0, since: Date.now() };
        if (Date.now() - limit.since > 60000) { limit.count = 0; limit.since = Date.now(); }
        if (++limit.count > 20) return send(res, 429, { error: 'Too many unlock attempts. Try again in one minute.' });
        loginAttempts.set(address, limit);
        const input = await body(req);
        if (!equal(input.key, adminKey)) return send(res, 401, { error: 'Incorrect host key. Use the host link printed in the server terminal.' });
        return send(res, 200, { admin: true }, { 'Set-Cookie': `crossfire_session=${session}; HttpOnly; SameSite=Strict; Path=/${publicOrigin.startsWith('https:') ? '; Secure' : ''}` });
      }
      if (path === '/api/events' && req.method === 'GET') {
        if (clients.size >= 64) return send(res, 503, { error: 'Too many connected screens.' });
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`);
        clients.add(res); req.on('close', () => clients.delete(res)); return;
      }
      if (path.startsWith('/api/')) {
        if (req.method !== 'POST') return send(res, 405, { error: 'Use POST for host actions.' }, { Allow: 'POST' });
        if (!isAdmin(req)) return send(res, 401, { error: 'Unlock host controls using the link in the server terminal.' });
        const input = await body(req);
        if (path === '/api/config') {
          engine.configure(input); store.saveConfig(engine.config);
          if (engine.mode === 'live') restartBridge();
        } else if (path === '/api/mode') {
          if (!['demo', 'live'].includes(input.mode)) throw new RuleError('Choose demo or live.');
          if (['running', 'paused'].includes(engine.phase)) throw new RuleError('End the current round before changing input mode.');
          bridge.stop(); engine.reset(input.mode); demoCursor = { a: 0, b: 0 }; restartBridge();
        } else if (path === '/api/action') {
          switch (input.action) {
            case 'start':
              if (engine.mode === 'live' && bridge.status.state !== 'connected') throw new RuleError('Wait for Twitch to connect before starting.');
              engine.start(); break;
            case 'pause': engine.pause(); break;
            case 'resume': engine.resume(); break;
            case 'finish': engine.finish(); break;
            case 'reset': engine.reset(); demoCursor = { a: 0, b: 0 }; break;
            case 'open_defection': engine.openDefection(); break;
            case 'close_defection': engine.closeDefection(); break;
            case 'score': engine.setScore(input.team, input.value); break;
            case 'cancel_challenge': engine.cancelChallenge(input.team); break;
            case 'confirm': engine.confirmResult(); break;
            case 'reconnect': if (engine.mode !== 'live') throw new RuleError('Switch to Twitch mode first.'); restartBridge(); break;
            default: throw new RuleError('Unknown host action.');
          }
        } else if (path === '/api/demo') {
          if (engine.mode !== 'demo') throw new RuleError('Simulated inputs are disabled in Twitch mode.');
          engine.requireTeam(input.team);
          if (input.command === '!switch') {
            const player = [...engine.players.values()].find(player => player.team === input.team && !player.switched);
            if (!player) throw new RuleError('Add a demo viewer to this team first.');
            engine.command({ userId: player.id, name: player.name, channelTeam: input.team, text: '!switch' });
          } else if (input.command === '!attack' || input.command === '!join') {
            const index = demoCursor[input.team]++ % demoNames[input.team].length;
            const name = demoNames[input.team][index], userId = `demo-${input.team}-${index}`;
            engine.command({ userId, name, channelTeam: input.team, text: '!join' });
            if (input.command === '!attack') engine.command({ userId, name, channelTeam: input.team, text: '!attack' });
          } else throw new RuleError('Unknown demo command.');
        } else return send(res, 404, { error: 'API endpoint not found.' });
        return send(res, 200, broadcast());
      }
      if ((req.method === 'GET' || req.method === 'HEAD') && ASSETS.has(path)) {
        const [file, type] = ASSETS.get(path), data = await readFile(join(ROOT, 'public', file));
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
        return res.end(req.method === 'HEAD' ? undefined : data);
      }
      if ((req.method === 'GET' || req.method === 'HEAD') && isExtensionAsset) {
        const asset = path.slice('/extension/'.length);
        const view = asset.match(/^(panel|dashboard|config|overlay)\.html$/)?.[1];
        if (view) {
          const html = (await readFile(join(ROOT, 'extension', 'index.html'), 'utf8')).replace(/<head(?:\s[^>]*)?>/i, match => `${match}\n<meta name="crossfire-view" content="${view}">`);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(req.method === 'HEAD' ? undefined : html); return;
        }
        const types = { 'index.html': 'text/html; charset=utf-8', 'app.js': 'text/javascript; charset=utf-8', 'styles.css': 'text/css; charset=utf-8', 'config.js': 'text/javascript; charset=utf-8' };
        if (types[asset]) {
          const data = await readFile(join(ROOT, 'extension', asset));
          res.writeHead(200, { 'Content-Type': types[asset], 'Cache-Control': 'no-store' });
          res.end(req.method === 'HEAD' ? undefined : data); return;
        }
      }
      send(res, 404, { error: 'Page not found.' });
    } catch (error) {
      if (res.headersSent) { res.destroy(); return; }
      if (error instanceof RuleError) send(res, error.status ?? 400, { error: error.message, code: error.code });
      else if (error instanceof ExtensionAuthError || Number.isInteger(error.status) && error.status >= 400 && error.status <= 599) send(res, error.status, { error: error.message, code: error.code });
      else { console.error('[SERVER] Request failed. Check local data permissions.'); send(res, 500, { error: 'Server error. Check the terminal.' }); }
    }
  });
  const loginAttempts = new Map();
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  let lastStamp = '';
  const timer = setInterval(() => {
    try {
      engine.tick();
      extension.tick();
      const stamp = `${engine.id}:${engine.revision}:${Math.floor(engine.elapsed() / 1000)}`;
      if (stamp !== lastStamp) { lastStamp = stamp; broadcast(); }
    } catch { console.error('[STATE] Could not save match events. Check data/ write access.'); }
  }, 250);
  timer.unref();
  const heartbeat = setInterval(() => { for (const res of clients) res.write(': heartbeat\n\n'); }, 15000);
  heartbeat.unref();
  function close() {
    shuttingDown = true; clearInterval(timer); clearInterval(heartbeat); bridge.stop(false); extension.close();
    for (const res of clients) res.end(); clients.clear();
    return new Promise(resolveClose => { server.close(resolveClose); server.closeIdleConnections(); });
  }
  return { server, engine, bridge, extension, debugEnabled, adminKey, close, snapshot };
}

export function startServer(options = {}) {
  const app = createApp(options);
  const port = options.port ?? Number(process.env.PORT || 3000), host = options.host ?? process.env.HOST ?? '127.0.0.1';
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535.');
  app.server.on('error', error => { console.error(`[SERVER] ${error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Set PORT to another number.` : error.code}`); process.exitCode = 1; });
  app.server.listen(port, host, () => {
    const origin = process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${port}`;
    console.log(`\n  CHATCROSSFIRE / 弹幕交火\n  Home:   ${origin}/\n  Twitch: ${origin}/extension/index.html\n${app.debugEnabled ? `  Debug:  ${origin}/debug#key=${app.adminKey}\n  OBS A:  ${origin}/overlay/a\n  OBS B:  ${origin}/overlay/b\n` : '  Developer controls disabled.\n'}${app.extension.sandboxEnabled ? `  Local simulation: ${origin}/sandbox\n` : '  Local simulation disabled. Use npm run sandbox to test four local roles.\n'}\n  Native Extension manages PK without a third-party host.\n  ${app.debugEnabled ? 'Keep the debug host link private. Original bot: npm run bot' : 'Authenticate through the installed Twitch Extension.'}\n`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void app.close().then(() => process.exit(0)); });
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startServer();
