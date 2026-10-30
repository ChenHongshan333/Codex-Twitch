import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { DanmakuEngine } from './danmaku.mjs';
import { TwitchBridge } from './twitch.mjs';

const files = new Map([
  ['/', ['index.html', 'text/html']], ['/dodge.js', ['dodge.js', 'text/javascript']],
  ['/tracker.js', ['tracker.js', 'text/javascript']], ['/dodge.css', ['dodge.css', 'text/css']],
  ['/overlay/a', ['overlay.html', 'text/html']], ['/overlay/b', ['overlay.html', 'text/html']],
  ['/track/a', ['track.html', 'text/html']], ['/track/b', ['track.html', 'text/html']],
]);
const assetRoot = new URL('../public/dodge/', import.meta.url);

export async function sampleAudience(bridge) {
  if (bridge.status.state !== 'connected' || bridge.channels?.length !== 2) throw new Error('Both Twitch chats must be connected.');
  const query = new URLSearchParams(bridge.channels.map(channel => ['user_id', channel.id]));
  const result = await bridge.request(`https://api.twitch.tv/helix/streams?${query}`);
  return Object.fromEntries(bridge.channels.map(channel => [channel.team, result.data?.find(stream => stream.user_id === channel.id)?.viewer_count ?? null]));
}

export function createDodgeServer({ engine = new DanmakuEngine(), live = false, token = '', channels = {}, supportTokens = {}, bridgeFactory = options => new TwitchBridge(options) } = {}) {
  const bridge = bridgeFactory({ token, moderationEvents: true });
  const support = {};
  let sampling = false, stopped = false, syntheticAudience = { a: 100, b: 100 };
  const source = live ? 'twitch' : 'synthetic';
  function snapshot() {
    return { ...engine.snapshot(), inputSource: source, twitch: live ? bridge.status : { state: 'disabled', message: 'Synthetic rehearsal — no Twitch events or real audience counts.' },
      support: Object.fromEntries(Object.entries(support).map(([side, item]) => [side, item.status])) };
  }
  async function sample() {
    if (stopped || sampling) return;
    if (!live) { engine.audience(syntheticAudience, 'synthetic'); return; }
    sampling = true;
    try { const counts = await sampleAudience(bridge); if (!stopped) engine.audience(counts, 'twitch'); }
    catch { if (!stopped && bridge.status.state !== 'connected') engine.audience({ a: null, b: null }, 'twitch'); }
    finally { sampling = false; }
  }
  bridge.on('chat', chat => {
    if (!live || chat.isCheer && support[chat.channelTeam]?.identity?.scopes?.includes('bits:read')) return;
    engine.activity({ ...chat, kind: 'chat' });
  });
  bridge.on('moderation', () => engine.moderate());
  bridge.on('status', status => {
    if (!live) return;
    if (status.state === 'connected') void sample();
    else engine.audience({ a: null, b: null }, 'twitch');
  });
  for (const side of ['a', 'b']) if (live && supportTokens[side]) {
    const item = bridgeFactory({ token: supportTokens[side], supportOnly: true }); support[side] = item;
    item.on('activity', event => engine.activity(event));
  }
  const server = http.createServer(async (req, res) => {
    const port = server.address()?.port, origin = `http://127.0.0.1:${port}`;
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'");
    const respond = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || ![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host) || Object.keys(req.headers).some(key => key === 'forwarded' || key.startsWith('x-forwarded-'))) return respond(403, { error: 'Local direct connections only.' });
    const url = new URL(req.url, origin), path = url.pathname;
    if (req.method === 'GET' && path === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (req.method === 'GET' && path === '/api/dodge/state') return respond(200, snapshot());
    if (req.method === 'GET' && files.has(path)) {
      const [file, type] = files.get(path);
      try { const content = await readFile(new URL(file, assetRoot)); res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }); res.end(content); }
      catch { respond(500, { error: 'Dodge asset unavailable.' }); }
      return;
    }
    if (req.method !== 'POST' || !path.startsWith('/api/dodge/')) return respond(404, { error: 'Not found.' });
    if (![origin, `http://localhost:${port}`].includes(req.headers.origin)) return respond(403, { error: 'Same-origin local controller required.' });
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') return respond(415, { error: 'JSON required.' });
    try {
      let raw = '', size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 8192) { respond(413, { error: 'Request too large.' }); return; } raw += chunk; }
      let input;
      try { input = JSON.parse(raw); } catch { return respond(400, { error: 'Invalid JSON.' }); }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return respond(400, { error: 'Object required.' });
      if (path === '/api/dodge/marker') engine.marker(input.side, input);
      else if (path === '/api/dodge/action') {
        if (!['start', 'pause', 'resume', 'reset'].includes(input.action)) return respond(400, { error: 'Unknown action.' });
        if (input.action === 'start' && input.durationSeconds !== undefined) {
          if (engine.phase !== 'lobby' || ![60, 180, 300].includes(input.durationSeconds)) return respond(400, { error: 'Choose a 60, 180 or 300 second round before starting.' });
          engine.config.durationMs = input.durationSeconds * 1000;
        }
        engine[input.action]();
        if (input.action === 'reset') { if (live) void sample(); else engine.audience(syntheticAudience, 'synthetic'); }
      } else if (path === '/api/dodge/audience' && !live) {
        if (!['a', 'b'].every(side => Number.isInteger(input[side]) && input[side] >= 0 && input[side] <= 10000000)) return respond(400, { error: 'Use nonnegative integer synthetic audience counts.' });
        syntheticAudience = { a: input.a, b: input.b }; engine.audience(input, 'synthetic', { reset: true });
      } else if (path === '/api/dodge/activity' && !live) {
        if (typeof input.text !== 'string' || input.text.length > 2000) return respond(400, { error: 'Text must be at most 2000 code units.' });
        const result = engine.activity(input); return respond(result.ok ? 200 : 409, { ...result, state: snapshot() });
      } else return respond(404, { error: 'Not available in this mode.' });
      respond(200, snapshot());
    } catch (error) {
      if (!res.writableEnded) respond(400, { error: error instanceof Error ? error.message : 'Invalid request.' });
    }
  });
  const timer = setInterval(() => engine.tick(), 20); timer.unref();
  const audienceTimer = setInterval(() => { void sample(); }, 15000); audienceTimer.unref();
  if (!live) engine.audience({ a: 100, b: 100 }, 'synthetic');
  async function connect() {
    if (!live) return;
    if (!/^[a-zA-Z0-9_]{1,25}$/.test(channels.a ?? '') || !/^[a-zA-Z0-9_]{1,25}$/.test(channels.b ?? '') || channels.a.toLowerCase() === channels.b.toLowerCase()) throw new Error('Configure two different Twitch channel logins for live mode.');
    await bridge.start(channels);
    for (const [side, item] of Object.entries(support)) await item.start({ [side]: channels[side] });
  }
  async function close() {
    stopped = true; clearInterval(timer); clearInterval(audienceTimer); bridge.stop(false);
    for (const item of Object.values(support)) item.stop(false);
    if (server.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
  return { server, engine, bridge, connect, close, snapshot };
}

export async function startDodgeServer(options = {}) {
  const app = createDodgeServer(options);
  try {
    await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(options.port ?? 3020, '127.0.0.1', resolve); });
    await app.connect(); return app;
  } catch (error) { await app.close(); throw error; }
}
