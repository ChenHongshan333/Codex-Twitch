import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { inspectDodgeConfig, verifyDodgeConnection } from '../src/dodge-setup.mjs';

const configured = { DODGE_LIVE: '1', TWITCH_OAUTH_TOKEN: 'syntheticTestTokenOnly', DODGE_CHANNEL_A: 'coral', DODGE_CHANNEL_B: 'violet' };

test('dodge diagnostics reject wrong mode, placeholder credentials, duplicate channels and invalid port without exposing values', () => {
  assert.equal(inspectDodgeConfig(configured).ok, true);
  for (const override of [{ DODGE_LIVE: '0' }, { TWITCH_OAUTH_TOKEN: 'PASTE_NEW_TOKEN_HERE' }, { TWITCH_OAUTH_TOKEN: 'invalid/private/value' }, { DODGE_CHANNEL_B: 'CORAL' }, { DODGE_CHANNEL_A: 'https://twitch.tv/coral' }, { DODGE_PORT: '0' }, { DODGE_PORT: '65536' }]) {
    const report = inspectDodgeConfig({ ...configured, ...override });
    assert.equal(report.ok, false);
    assert.ok(report.checks.some(check => !check.ok));
    assert.equal(JSON.stringify(report).includes('syntheticTestTokenOnly'), false);
    assert.equal(JSON.stringify(report).includes('invalid/private/value'), false);
  }
});

test('read-only live verifier distinguishes subscribed chats from offline or zero-viewer streams and always closes its bridge', async () => {
  for (const value of [null, 0, 25]) {
    let stopped = false; const requests = [];
    class Bridge extends EventEmitter {
      status = { state: 'connected' };
      channels = [{ team: 'a', id: '10' }, { team: 'b', id: '20' }];
      async start() { this.emit('status', this.status); }
      async request(url) { requests.push(url); return { data: [{ user_id: '10', viewer_count: 3 }, ...(value == null ? [] : [{ user_id: '20', viewer_count: value }])] }; }
      stop() { stopped = true; }
    }
    const result = await verifyDodgeConnection({ token: 'syntheticTestTokenOnly', channels: { a: 'coral', b: 'violet' }, bridgeFactory: () => new Bridge() });
    assert.equal(result.ok, value === 25); assert.equal(result.chatsConnected, true);
    assert.equal(result.counts.b, value); assert.equal(stopped, true);
    assert.equal(requests.length, 1); assert.equal(new URL(requests[0]).pathname, '/helix/streams');
  }
});

test('verifier times out and redacts thrown/status errors without sending messages', async () => {
  for (const mode of ['timeout', 'throw', 'status', 'api']) {
    let stopped = false;
    class Bridge extends EventEmitter {
      status = { state: 'connected' }; channels = [{ team: 'a', id: '10' }, { team: 'b', id: '20' }];
      async start() {
        if (mode === 'throw') throw new Error('syntheticTestTokenOnly');
        if (mode === 'status') this.emit('status', { state: 'reconnecting', message: 'syntheticTestTokenOnly' });
        if (mode === 'api') this.emit('status', this.status);
      }
      async request() { throw new Error('syntheticTestTokenOnly'); }
      stop() { stopped = true; }
    }
    const result = await verifyDodgeConnection({ bridgeFactory: () => new Bridge(), timeoutMs: 15 });
    assert.equal(result.ok, false); assert.equal(stopped, true);
    assert.equal(JSON.stringify(result).includes('syntheticTestTokenOnly'), false);
  }
});

test('verifier cannot report success if EventSub disconnects while viewer sampling is in flight', async () => {
  class Bridge extends EventEmitter {
    status = { state: 'connected' }; channels = [{ team: 'a', id: '10' }, { team: 'b', id: '20' }];
    async start() { this.emit('status', this.status); }
    async request() {
      this.status = { state: 'reconnecting' }; this.emit('status', this.status);
      return { data: [{ user_id: '10', viewer_count: 5 }, { user_id: '20', viewer_count: 5 }] };
    }
    stop() {}
  }
  const result = await verifyDodgeConnection({ bridgeFactory: () => new Bridge() });
  assert.equal(result.ok, false);
});
