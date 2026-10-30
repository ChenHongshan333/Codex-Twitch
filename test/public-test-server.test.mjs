import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePublicOptions } from '../scripts/public-test-server.mjs';

test('temporary backend launcher requires the actual origin and defaults to port 3020', () => {
  assert.deepEqual(parsePublicOptions(['--origin', 'https://quiet-river.trycloudflare.com']), { origin: 'https://quiet-river.trycloudflare.com', port: 3020 });
  assert.deepEqual(parsePublicOptions(['--port=3040', '--origin=https://pk.example.com/']), { origin: 'https://pk.example.com', port: 3040 });
  assert.deepEqual(parsePublicOptions(['--origin', 'https://PK.EXAMPLE.COM:443', '--port', '65535']), { origin: 'https://pk.example.com', port: 65535 });
});

test('temporary backend launcher rejects local addresses and non-HTTPS origins', () => {
  for (const origin of [
    'http://pk.example.com', 'https://localhost', 'https://foo.localhost', 'https://example.local', 'https://app.internal',
    'https://127.0.0.1', 'https://127.9.8.7', 'https://0x7f000001', 'https://[::1]', 'https://0.0.0.0',
    'https://192.168.1.10', 'https://10.0.0.1', 'https://[::ffff:127.0.0.1]', 'https://singlehostname', 'not-a-url',
  ]) assert.throws(() => parsePublicOptions(['--origin', origin]), /public HTTPS domain origin/);
});

test('temporary backend launcher rejects credentials and hidden path/query/fragment content', () => {
  for (const origin of [
    'https://user:secret@pk.example.com', 'https://@pk.example.com', 'https://pk.example.com/path',
    'https://pk.example.com?token=secret', 'https://pk.example.com?', 'https://pk.example.com/#key=secret',
    'https://pk.example.com/#', ' https://pk.example.com', 'https://pk.example.com\n',
  ]) assert.throws(() => parsePublicOptions(['--origin', origin]), error => /public HTTPS domain origin/.test(error.message) && !error.message.includes('secret'));
});

test('temporary backend launcher rejects duplicate, missing, unknown and invalid port arguments', () => {
  for (const args of [[], ['--origin'], ['--origin', '--port', '3020'], ['--origin', 'https://pk.example.com', '--origin', 'https://other.example.com'], ['--host', '0.0.0.0'], ['--origin', 'https://pk.example.com', 'extra']]) {
    assert.throws(() => parsePublicOptions(args));
  }
  for (const port of ['0', '-1', '65536', '1.5', '1e3', '3020 ', 'NaN']) assert.throws(() => parsePublicOptions(['--origin', 'https://pk.example.com', '--port', port]), /--port/);
});
