import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../addon/server.mjs';
const dir = await mkdtemp(path.join(os.tmpdir(), 'kinetic-browser-'));
const prefix = '/api/hassio_ingress/browser-test';
const inventory = { areas: [{ area_id: 'living', name: 'Living room' }], devices: [{ id: 'lamp', area_id: 'living' }],
  entities: [{ entity_id: 'light.living', device_id: 'lamp' }], states: [{ entity_id: 'light.living', state: 'off', attributes: { friendly_name: 'Living lamp' } }, { entity_id: 'sensor.my_car_fuel', state: '67', attributes: { friendly_name: 'Car fuel' } }] };
const result = { 'auth/current_user': { is_admin: true }, 'config/area_registry/list': inventory.areas, 'config/device_registry/list': inventory.devices, 'config/entity_registry/list': inventory.entities, get_states: inventory.states };
const server = createServer({ dataDir: dir, staticDir: path.resolve('addon'), trustedPeer: '127.0.0.1', requestHA: async (_, commands) => commands.map(c => result[c.type]) });
// Simulate Supervisor stripping the prefix and adding the trusted header.
server.prependListener('request', req => { req.url = req.url.replace(prefix, '') || '/'; req.headers['x-ingress-path'] = prefix; });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const page = await browser.newPage({ viewport }); const errors = [];
    page.on('pageerror', e => errors.push(e.stack));
    await page.addInitScript(() => localStorage.setItem('hassTokens', JSON.stringify({ hassUrl: location.origin, refresh_token: 'test-session', access_token: 'admin', expires: Date.now() + 3600000, clientId: location.origin + '/' })));
    await page.route('**/auth/token', route => route.fulfill({ json: { access_token: 'admin' } }));
    await page.routeWebSocket('**/api/websocket', socket => {
      socket.send(JSON.stringify({ type: 'auth_required' }));
      socket.onMessage(raw => {
        const m = JSON.parse(raw);
        if (m.type === 'auth') return socket.send(JSON.stringify({ type: 'auth_ok', ha_version: '2026.10.0' }));
        const result = m.type === 'get_states' ? inventory.states : m.type === 'auth/current_user' ? { id: 'test', name: 'Test admin', is_admin: true } : null;
        socket.send(JSON.stringify({ type: 'result', id: m.id, success: true, result }));
      });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}${prefix}/setup.html`);
    await page.locator('#areas').waitFor({ state: 'visible' });
    await page.locator('#name').fill('Our home');
    await page.locator('#generate').click();
    const generated = JSON.parse(await page.locator('#config').inputValue());
    assert.deepEqual(generated.house[0].lights, ['light.living']);
    assert.equal(generated.brand.name, 'Our home');
    await page.locator('#vehicle-enabled').check();
    await page.locator('#vehicle-name').fill('Family car');
    await page.locator('#vehicle-fuel_level').fill('sensor.my_car_fuel');
    await page.locator('#apply-features').click();
    assert.equal(JSON.parse(await page.locator('#config').inputValue()).vehicle.entities.fuel_level, 'sensor.my_car_fuel');
    await page.locator('#save').click();
    await page.waitForURL('**/dash.html');
    await page.waitForTimeout(1200);
    assert.ok(!errors.length, errors.join('\n'));
    assert.equal(await page.locator('#st').textContent(), 'LIVE');
    await page.evaluate(() => { location.hash = '#vehicle'; });
    await page.locator('#vehicle .vring b').waitFor();
    assert.match(await page.locator('#vehicle .vring b').textContent(), /67/);
    assert.equal(await page.evaluate(() => REL.vehicle.test('sensor.my_car_fuel')), true);
    assert.match(await page.evaluate(() => { const v = CONFIG.vehicle; CONFIG.vehicle = null; drawVehicle(); const text = document.querySelector('#vehicle').textContent; CONFIG.vehicle = v; drawVehicle(); return text; }), /Set up your vehicle/);
    await page.locator('#navset').evaluate(el => el.click());
    await page.waitForURL('**/setup.html');
    await page.locator('#areas').waitFor({ state: 'visible' });
    assert.equal(JSON.parse(await page.locator('#config').inputValue()).brand.name, 'Our home');
    await page.close();
  }
  console.log('Add-on browser tests passed: phone/tablet wizard, save, dashboard boot and persisted configuration');
} finally { await browser.close(); await new Promise(r => server.close(r)); await rm(dir, { recursive: true, force: true }); }
