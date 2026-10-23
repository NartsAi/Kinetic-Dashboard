import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer, validateConfig, haRequest } from '../addon/server.mjs';
import { discover } from '../addon/discovery.mjs';

test('discovery respects overrides, disabled entities and device inheritance', () => {
  const inventory = { areas: [{ area_id: 'a', name: 'Kitchen' }, { area_id: 'b', name: 'Bedroom' }],
    devices: [{ id: 'd', area_id: 'a' }], entities: [
      { entity_id: 'light.kitchen', device_id: 'd' }, { entity_id: 'light.override', device_id: 'd', area_id: 'b' },
      { entity_id: 'light.disabled', device_id: 'd', disabled_by: 'user' }, { entity_id: 'sensor.temp', device_id: 'd' },
      { entity_id: 'binary_sensor.motion', device_id: 'd' }],
    states: ['light.kitchen', 'light.override', 'light.disabled', 'sensor.temp', 'binary_sensor.motion', 'camera.unassigned'].map(entity_id => ({ entity_id, attributes: { device_class: entity_id === 'sensor.temp' ? 'temperature' : 'motion' } })) };
  const config = discover(inventory, ['a']);
  assert.deepEqual(config.house[0].lights, ['light.kitchen']);
  assert.equal(config.house[0].temp, 'sensor.temp');
  assert.deepEqual(config.house[0].occ, ['binary_sensor.motion']);
  assert.equal(config.cameras[0].id, 'camera.unassigned');
  assert.deepEqual(discover(inventory, ['b']).house[0].lights, ['light.override']);
});

test('configuration rejects credentials and prototype pollution', () => {
  for (const config of [null, [], { token: 'secret' }, { nested: { refresh_token: 'secret' } }, JSON.parse('{"__proto__":{}}'), { rooms: {} }])
    assert.throws(() => validateConfig(config));
  assert.equal(validateConfig({ house: [], tariff: { daily: 2 } }).tariff.daily, 2);
});

test('Ingress, admin authorization, routing, revisions and restart persistence', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kinetic-test-'));
  const options = { dataDir: dir, staticDir: path.resolve('addon'), trustedPeer: '127.0.0.1',
    requestHA: async (token, commands) => {
      if (token === 'invalid') throw Object.assign(Error('Invalid token'), { status: 401 });
      return commands.map(c => c.type === 'auth/current_user' ? { is_admin: token === 'admin' } : []);
    } };
  let server;
  const start = async (extra = {}) => { server = createServer({ ...options, ...extra }); await new Promise(r => server.listen(0, '127.0.0.1', r)); return 'http://127.0.0.1:' + server.address().port; };
  const stop = () => new Promise(r => server.close(r));
  let url = await start();
  const base = '/api/hassio_ingress/test-token';
  const request = (route, method = 'GET', body, token = 'admin', extra = {}) => fetch(url + route, { method, redirect: 'manual', headers: { 'X-Ingress-Path': base, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  try {
    assert.equal((await request('/')).headers.get('location'), base + '/setup.html');
    assert.equal((await request('/api/config', 'GET', undefined, 'invalid')).status, 401);
    assert.equal((await request('/api/config', 'GET', undefined, 'regular')).status, 403);
    assert.equal((await request('/api/config', 'PUT', {}, 'admin', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal((await request('/api/config', 'PUT', { revision: null, config: { token: 'secret' } })).status, 400);
    assert.equal((await request('/api/config', 'PUT', null)).status, 400);
    assert.equal((await request('/api/config', 'PUT', { revision: null, config: { name: 'x'.repeat(524288) } })).status, 413);
    const config = { house: [], brand: { name: 'Test home' }, tariff: { daily: 2 } };
    const saved = await (await request('/api/config', 'PUT', { revision: null, config })).json();
    assert.ok(saved.revision);
    assert.equal((await request('/api/config', 'PUT', { revision: null, config })).status, 409);
    assert.equal((await request('/')).headers.get('location'), base + '/dash.html');
    const script = await (await request('/config.js')).text();
    assert.match(script, /location.origin/); assert.match(script, /setup.html/); assert.doesNotMatch(script, /Bearer|SUPERVISOR/);
    assert.equal((await request('/api/discovery')).status, 200);
    assert.equal((await request('/server.mjs')).status, 404);
    assert.equal((await request('/setup.html')).status, 200);
    await stop(); url = await start();
    assert.deepEqual((await (await request('/api/config')).json()).config, config);
    await stop(); url = await start({ trustedPeer: '172.30.32.2' });
    assert.equal((await request('/api/config', 'GET', undefined, 'admin', { 'X-Forwarded-For': '172.30.32.2' })).status, 403);
  } finally { await stop(); await rm(dir, { recursive: true, force: true }); }
});

test('HA websocket authenticates as the user and propagates permission failures', async () => {
  const Original = globalThis.WebSocket;
  class FakeWS {
    constructor() { queueMicrotask(() => this.onmessage({ data: JSON.stringify({ type: 'auth_required' }) })); }
    send(raw) { const m = JSON.parse(raw); queueMicrotask(() => {
      const result = m.type === 'auth' ? { type: m.access_token === 'bad' ? 'auth_invalid' : 'auth_ok' } : { type: 'result', id: m.id, success: m.type !== 'denied', result: { name: 'User' } };
      this.onmessage({ data: JSON.stringify(result) });
    }); }
    close() {}
  }
  globalThis.WebSocket = FakeWS;
  try {
    assert.deepEqual(await haRequest('user-token', [{ type: 'auth/current_user' }]), [{ name: 'User' }]);
    await assert.rejects(haRequest('bad', [{ type: 'auth/current_user' }]), e => e.status === 401);
    await assert.rejects(haRequest('user-token', [{ type: 'denied' }]), e => e.status === 403);
  } finally { globalThis.WebSocket = Original; }
});
