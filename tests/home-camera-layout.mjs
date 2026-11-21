import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const config = {
  url: '', token: '', weather: 'weather.home', rooms: [],
  house: Array.from({ length: 9 }, (_, i) => ({ id: 'room' + i, name: 'Room ' + i, lights: [] })),
  tiles: Array.from({ length: 9 }, (_, i) => ({ room: 'room' + i, name: 'Room ' + i, icon: 'home' })),
  cameras: Array.from({ length: 12 }, (_, i) => ({ id: 'camera.feed_' + i, name: 'Camera ' + i })),
  security: [], layout: { tablet: ['status', 'cams', 'rooms', 'heatpump', 'forecast'], mobile: ['status', 'cams', 'rooms', 'heatpump', 'forecast'] }
};
const server = http.createServer((req, res) => {
  const route = req.url.split('?')[0];
  if (route === '/config.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end('window.DASH_CONFIG=' + JSON.stringify(config) + ';window.DASH_CONFIG.url=location.origin;'); }
  if (route === '/dash.html') { res.setHeader('Content-Type', 'text/html'); return res.end(fs.readFileSync('dash.html')); }
  res.writeHead(404); res.end();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  for (const viewport of [{ width: 2048, height: 700 }, { width: 1280, height: 720 }, { width: 1024, height: 1366 }, { width: 1024, height: 600 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport }); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + server.address().port + '/dash.html');
    await page.evaluate(() => {
      document.documentElement.classList.remove('boot'); const login = document.getElementById('lg'); if (login) login.hidden = true;
      fc = Array.from({ length: 5 }, (_, i) => ({ datetime: new Date(Date.now() + i * 86400000).toISOString(), condition: 'sunny', temperature: 24, templow: 14, precipitation_probability: 5 }));
      drawFc(); applyLayout();
    });
    await page.waitForTimeout(1100);
    const metrics = await page.evaluate(() => {
      const page = document.getElementById('home'), cameras = document.getElementById('cams'), weather = document.getElementById('fcp');
      cameras.scrollTop = cameras.scrollHeight;
      return { galleryHeight: cameras.clientHeight, galleryContent: cameras.scrollHeight, cameraScroll: cameras.scrollTop, pageHeight: page.clientHeight, pageContent: page.scrollHeight, pageScroll: page.scrollTop, forecastHeight: weather.offsetHeight, count: cameras.children.length };
    });
    assert.equal(metrics.count, 12);
    assert.ok(metrics.forecastHeight < 450, JSON.stringify({ viewport, metrics }));
    assert.ok(metrics.galleryHeight <= metrics.pageHeight, JSON.stringify({ viewport, metrics }));
    assert.ok(metrics.galleryContent > metrics.galleryHeight && metrics.cameraScroll > 0, JSON.stringify({ viewport, metrics }));
    assert.equal(metrics.pageScroll, 0);
    if (viewport.width > 1100) assert.ok(metrics.pageContent <= metrics.pageHeight + 3, JSON.stringify({ viewport, metrics }));
    // Scrolling must not trap a fullscreen camera inside the gallery or lose its place.
    if (viewport.width > 1100) {
      await page.locator('#cams .cam').last().evaluate(el => el.click());
      await page.waitForTimeout(350);
      const full = await page.locator('#cams .cam.fs').boundingBox();
      assert.ok(full.height >= viewport.height - 35, JSON.stringify(full));
      await page.locator('#cams .cam.fs .cx').evaluate(el => el.click());
      await page.waitForTimeout(500);
      assert.ok(await page.locator('#cams').evaluate(el => el.scrollTop > 0));
    }
    assert.deepEqual(errors, []); await page.close();
  }
  console.log('Home layout passed: 12 feeds, compact forecast, independent camera scroll, fullscreen and five viewport sizes.');
} finally { await browser.close(); await new Promise(r => server.close(r)); }
