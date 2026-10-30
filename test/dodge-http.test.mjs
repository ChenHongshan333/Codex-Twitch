import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import { startDodgeServer, sampleAudience } from '../src/dodge-http.mjs';
import { DanmakuEngine } from '../src/danmaku.mjs';
import { findMarker } from '../public/dodge/tracker.js';

async function rig(t, options = {}) {
  const app = await startDodgeServer({ ...options, port: 0 }); t.after(() => app.close());
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  return { ...app, origin, post: async (path, body, headers = {}) => {
    const response = await fetch(`${origin}/api/dodge/${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  } };
}
test('local controller requires exact Host/Origin and refuses forwarding and oversized input', async t => {
  const { post, origin } = await rig(t);
  assert.equal((await post('action', { action: 'start' }, { Origin: 'https://evil.example' })).status, 403);
  const wrongHost = await new Promise(resolve => { const req = http.request(`${origin}/api/dodge/state`, { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }); req.end(); });
  assert.equal(wrongHost, 403);
  assert.equal((await post('action', {}, { Forwarded: 'for=127.0.0.1' })).status, 403);
  assert.equal((await post('action', {}, { 'X-Forwarded-Host': 'localhost' })).status, 403);
  assert.equal((await post('marker', { side: 'z', x: 1, y: 1 })).status, 400);
  assert.equal((await post('activity', { text: 'x'.repeat(9000) })).status, 413);
  const page = await fetch(`${origin}/overlay/a`);
  assert.equal(page.status, 200); assert.match(await page.text(), /id="overlay"/);
  assert.match(page.headers.get('content-security-policy'), /connect-src 'self'/);
});

test('HTTP rehearsal runs both directions, preserves identity on switch and pauses tracking loss', async t => {
  let now = 0; const engine = new DanmakuEngine({ now: () => now, config: { durationMs: 40000 } });
  const { post } = await rig(t, { engine });
  const markers = async () => { for (const side of ['a', 'b']) assert.equal((await post('marker', { side, x: 480, y: 270 })).status, 200); };
  await markers(); assert.equal((await post('action', { action: 'start' })).status, 200);
  for (const side of ['a', 'b']) assert.equal((await post('activity', { id: side, userId: side, channelTeam: side, text: 'Hi', kind: 'chat' })).status, 200);
  for (let i = 0; i < 220; i++) { now += 50; await markers(); engine.tick(); }
  const switched = await post('activity', { id: 'switch', userId: 'a', channelTeam: 'b', text: '!switch' });
  assert.equal(switched.body.team, 'b');
  const attack = await post('activity', { id: 'new', userId: 'a', channelTeam: 'a', text: 'Now the other way' });
  assert.equal(attack.body.team, 'b');
  assert.equal((await post('activity', { id: 'again', userId: 'a', channelTeam: 'b', text: 'too soon' })).status, 409);
  assert.ok(engine.snapshot().shots.a > 0 && engine.snapshot().shots.b > 0);
  now += 1100; engine.tick(); assert.equal(engine.snapshot().phase, 'paused');
});

test('live mode rejects synthetic activity/counts and uses verified bridge identities only', async t => {
  const bridges = [];
  class FakeBridge extends EventEmitter {
    constructor() { super(); this.status = { state: 'connected' }; this.channels = [{ team: 'a', id: '10' }, { team: 'b', id: '20' }]; }
    async start() { this.emit('status', this.status); }
    async request() { return { data: [{ user_id: '10', viewer_count: 1000 }, { user_id: '20', viewer_count: 100 }] }; }
    stop() {}
  }
  const { post, engine } = await rig(t, { live: true, channels: { a: 'coral', b: 'violet' }, bridgeFactory: () => { const b = new FakeBridge(); bridges.push(b); return b; } });
  assert.equal((await post('audience', { a: 1, b: 1 })).status, 404);
  assert.equal((await post('activity', { text: 'fake' })).status, 404);
  for (const side of ['a', 'b']) await post('marker', { side, x: 480, y: 270 });
  await post('action', { action: 'start' });
  bridges[0].emit('chat', { id: 'real-shaped', userId: '7', channelTeam: 'a', text: 'hello' });
  assert.equal(engine.players.get('7').team, 'a');
  assert.equal(engine.snapshot().pressure.current.a, .001);
  bridges[0].emit('moderation', {}); assert.equal(engine.snapshot().pressure.current.a, 0);
});

test('audience sampler filters both channel IDs and treats offline as unavailable', async () => {
  let url;
  const result = await sampleAudience({ status: { state: 'connected' }, channels: [{ id: '10', team: 'a' }, { id: '20', team: 'b' }], request: async value => { url = value; return { data: [{ user_id: '10', viewer_count: 500 }] }; } });
  assert.deepEqual(result, { a: 500, b: null }); assert.equal(new URL(url).searchParams.getAll('user_id').length, 2);
});

test('colour detector follows largest marker, rejects absent/broad colours and isolated noise', () => {
  const width = 100, height = 60, pixels = new Uint8ClampedArray(width * height * 4);
  const paint = (x, y) => pixels.set([50, 220, 80, 255], (y * width + x) * 4);
  assert.equal(findMarker(pixels, width, height), null);
  paint(1, 1); assert.equal(findMarker(pixels, width, height), null);
  for (let y = 20; y < 30; y++) for (let x = 60; x < 70; x++) paint(x, y);
  const marker = findMarker(pixels, width, height); assert.equal(marker.x, .645); assert.equal(marker.y, 24.5 / 60);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) paint(x, y);
  assert.equal(findMarker(pixels, width, height), null);
  assert.equal(findMarker(pixels, width, height, [200, 200, 200]), null);
});
