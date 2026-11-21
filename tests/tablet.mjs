import http from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { publishDashboard } from '../addon/publish.mjs';

const dir = await mkdtemp(path.join(os.tmpdir(), 'kinetic-tablet-'));
const homeAssistantDir = path.join(dir, 'homeassistant');
await mkdir(homeAssistantDir);
await publishDashboard({ homeAssistantDir, staticDir: path.resolve('addon'), config: {
  house: [], rooms: [], pages: ['home', 'vehicle', 'theme'],
  vehicle: { name: 'Ford Ranger', lowFuelPct: 15, entities: { fuel_level: 'sensor.ranger_fuel' } }
} });
// Model the same-origin HA Webpage card: the parent exposes the signed-in tablet
// user's HA session and the published HTML borrows it. No admin login in the iframe.
const server = http.createServer(async (req, res) => {
  const route = new URL(req.url, 'http://ha').pathname;
  if (route === '/dashboard-kinetic/home') {
    res.setHeader('Content-Type', 'text/html');
    return res.end('<home-assistant></home-assistant><script>document.querySelector("home-assistant").hass={auth:{accessToken:"tablet-user-token",expired:false},user:{id:"tablet",name:"Tablet",is_admin:false}};</script><iframe title="Kinetic" style="width:100%;height:90vh" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" src="/local/kinetic/dash.html"></iframe>');
  }
  const name = route.replace('/local/kinetic/', '');
  if (route.startsWith('/local/kinetic/') && ['dash.html', 'config.js', 'brand-logo.js'].includes(name)) {
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : 'text/html');
    return res.end(await readFile(path.join(homeAssistantDir, 'www/kinetic', name)));
  }
  res.writeHead(404); res.end();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [], tokens = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.routeWebSocket('**/api/websocket', socket => {
    socket.send(JSON.stringify({ type: 'auth_required' }));
    socket.onMessage(raw => {
      const m = JSON.parse(raw);
      if (m.type === 'auth') { tokens.push(m.access_token); return socket.send(JSON.stringify({ type: 'auth_ok' })); }
      const result = m.type === 'get_states' ? [{ entity_id: 'sensor.ranger_fuel', state: '72', attributes: {} }] : m.type === 'auth/current_user' ? { id: 'tablet', name: 'Tablet', is_admin: false } : null;
      socket.send(JSON.stringify({ type: 'result', id: m.id, success: true, result }));
    });
  });
  await page.goto('http://127.0.0.1:' + server.address().port + '/dashboard-kinetic/home');
  const frame = page.frameLocator('iframe');
  await frame.locator('#st').filter({ hasText: 'LIVE' }).waitFor();
  const state = await frame.locator('body').evaluate(() => { location.hash = '#vehicle'; return { admin: ME.admin, token: CONFIG.token }; });
  assert.equal(state.admin, false); assert.equal(state.token, '');
  await frame.locator('#vehicle .vring b').waitFor();
  assert.match(await frame.locator('#vehicle .vring b').textContent(), /72/);
  assert.deepEqual([...new Set(tokens)], ['tablet-user-token']);
  assert.deepEqual(errors, []);
  console.log('Tablet embed passed: published dash.html, non-admin parent session, live vehicle telemetry and no embedded credentials.');
} finally { await browser.close(); await new Promise(r => server.close(r)); await rm(dir, { recursive: true, force: true }); }
