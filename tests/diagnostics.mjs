import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const server = http.createServer((req, res) => {
  const route = req.url.split('?')[0];
  if (route === '/config.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end('window.DASH_CONFIG={url:location.origin,rooms:[],house:[],vehicle:{entities:{ignition_state:"sensor.ignition"},ignitionText:{2:2}}};'); }
  if (route === '/dash.html') { res.setHeader('Content-Type', 'text/html'); return res.end(fs.readFileSync('dash.html')); }
  res.writeHead(404); res.end();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://127.0.0.1:' + server.address().port + '/dash.html');
  await page.evaluate(() => {
    document.documentElement.classList.remove('boot'); const login = document.getElementById('lg'); if (login) login.hidden = true;
    states['sensor.ignition'] = { state: '2', attributes: {} }; drawVehicle();
    const error = new Error('Diagnostic test'); error.stack = 'Error: Diagnostic test\n at https://example.test/dash.html?token=secret';
    window.onerror('Uncaught TypeError: Diagnostic test', 'https://example.test/dash.html?token=secret', 123, 7, error);
    setStatus(true); location.hash = '#vehicle';
  });
  await page.locator('#st').filter({ hasText: 'JS ERROR' }).waitFor();
  await page.locator('#st').click();
  const report = await page.getByLabel('Error report').inputValue();
  assert.match(report, /Diagnostic test/); assert.match(report, /dash.html:123:7/); assert.match(report, /Connection: LIVE/); assert.doesNotMatch(report, /secret/);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(() => { location.hash = '#home'; });
  assert.match(await page.locator('#st').textContent(), /JS ERROR/);
  assert.equal(await page.locator('#st').getAttribute('role'), 'button');
  console.log('Diagnostics passed: global error survives navigation/status changes, full details open on mobile, URL credentials redacted; numeric vehicle status maps are safe.');
} finally { await browser.close(); await new Promise(r => server.close(r)); }
