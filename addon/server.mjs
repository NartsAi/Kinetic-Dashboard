import http from 'node:http';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

// No Supervisor credential is needed: every HA request uses the current user's token.
export function haRequest(token, commands, url = 'ws://homeassistant:8123/api/websocket') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url), results = []; let settled = false;
    const finish = (err) => { if (settled) return; settled = true; clearTimeout(timer); ws.close(); err ? reject(err) : resolve(results); };
    const timer = setTimeout(() => finish(Object.assign(new Error('Home Assistant timed out'), { status: 504 })), 15000);
    ws.onerror = () => finish(Object.assign(new Error('Home Assistant unavailable'), { status: 502 }));
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.type === 'auth_required') ws.send(JSON.stringify({ type: 'auth', access_token: token }));
      if (m.type === 'auth_invalid') finish(Object.assign(new Error('Sign in to Home Assistant again'), { status: 401 }));
      if (m.type === 'auth_ok') commands.forEach((c, i) => ws.send(JSON.stringify({ ...c, id: i + 1 })));
      if (m.type === 'result') {
        if (!m.success) return finish(Object.assign(new Error('Home Assistant denied the request'), { status: 403 }));
        results[m.id - 1] = m.result;
        if (commands.every((_, i) => i in results)) finish();
      }
    };
    ws.onclose = () => { if (!commands.every((_, i) => i in results)) finish(Object.assign(new Error('Home Assistant connection closed'), { status: 502 })); };
  });
}

export function validateConfig(config) {
  if (!config || Array.isArray(config) || typeof config !== 'object') throw Object.assign(new Error('Configuration must be a JSON object'), { status: 400 });
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype', 'token', 'access_token', 'refresh_token', 'url'].includes(key))
        throw Object.assign(new Error('Credentials, URLs and prototype keys cannot be stored in configuration'), { status: 400 });
      walk(child);
    }
  };
  walk(config);
  for (const key of ['house', 'rooms', 'tiles', 'cameras', 'security', 'media', 'calendars', 'pages'])
    if (key in config && !Array.isArray(config[key])) throw Object.assign(new Error(key + ' must be an array'), { status: 400 });
  return config;
}

export function createServer({ dataDir = '/data', staticDir = path.dirname(fileURLToPath(import.meta.url)), trustedPeer = '172.30.32.2', requestHA = haRequest } = {}) {
  const configFile = path.join(dataDir, 'dashboard.json');
  let saving = Promise.resolve();
  const load = async () => {
    try { return JSON.parse(await readFile(configFile, 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  };
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    const reply = (status, body, type = 'application/json') => { res.writeHead(status, { 'Content-Type': type }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
    try {
      // Check the socket, never X-Forwarded-For or a user-supplied identity header.
      if (req.socket.remoteAddress?.replace(/^::ffff:/, '') !== trustedPeer) return reply(403, { error: 'Use Home Assistant Ingress' });
      const route = new URL(req.url, 'http://addon').pathname;
      const base = req.headers['x-ingress-path'];
      if (typeof base !== 'string' || !/^\/api\/hassio_ingress\/[A-Za-z0-9_-]+$/.test(base)) return reply(400, { error: 'Missing or invalid Ingress path' });
      if (req.method === 'GET' && route === '/') { res.writeHead(302, { Location: base + ((await load()) ? '/dash.html' : '/setup.html') }); return res.end(); }
      if (req.method === 'GET' && route === '/config.js') {
        const config = await load();
        if (!config) { res.writeHead(302, { Location: base + '/setup.html' }); return res.end(); }
        return reply(200, 'window.DASH_CONFIG=' + JSON.stringify({ ...config.config, token: '', settingsPath: base + '/setup.html' }) + ';window.DASH_CONFIG.url=location.origin;', 'text/javascript');
      }
      if (route.startsWith('/api/')) {
        if (req.headers['sec-fetch-site'] === 'cross-site') return reply(403, { error: 'Cross-site request denied' });
        const match = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
        if (!match) return reply(401, { error: 'Home Assistant sign-in required' });
        const [user] = await requestHA(match[1], [{ type: 'auth/current_user' }]);
        if (!user?.is_admin) return reply(403, { error: 'An administrator must configure Kinetic' });
        if (route === '/api/config' && req.method === 'GET') return reply(200, await load() || { revision: null, config: {} });
        if (route === '/api/discovery' && req.method === 'GET') {
          const [areas, devices, entities, states] = await requestHA(match[1], ['config/area_registry/list', 'config/device_registry/list', 'config/entity_registry/list', 'get_states'].map(type => ({ type })));
          return reply(200, { areas, devices, entities, states });
        }
        if (route === '/api/config' && req.method === 'PUT') {
          if (!(req.headers['content-type'] || '').startsWith('application/json')) return reply(415, { error: 'Use application/json' });
          const chunks = []; let size = 0;
          for await (const chunk of req) { size += chunk.length; if (size > 524288) return reply(413, { error: 'Configuration is too large' }); chunks.push(chunk); }
          let input; try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(400, { error: 'Invalid JSON' }); }
          if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(400, { error: 'Expected a configuration envelope' });
          const config = validateConfig(input.config);
          const save = saving.catch(() => {}).then(async () => {
            const prior = await load();
            if (input.revision !== (prior?.revision ?? null)) throw Object.assign(new Error('Configuration changed. Reload before saving.'), { status: 409 });
            const next = { revision: randomUUID(), config };
            await mkdir(dataDir, { recursive: true });
            const tmp = configFile + '.' + randomUUID() + '.tmp';
            await writeFile(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
            await rename(tmp, configFile);
            return next;
          });
          saving = save;
          return reply(200, await save);
        }
        return reply(404, { error: 'Unknown API route' });
      }
      const files = { '/dash.html': ['dash.html', 'text/html'], '/brand-logo.js': ['brand-logo.js', 'text/javascript'], '/setup.html': ['setup.html', 'text/html'], '/setup.js': ['setup.js', 'text/javascript'], '/discovery.mjs': ['discovery.mjs', 'text/javascript'] };
      files['/config-manager.mjs'] = ['config-manager.mjs', 'text/javascript'];
      const file = files[route];
      if (req.method !== 'GET' || !file) return reply(404, { error: 'Not found' });
      if (route === '/dash.html' && !(await load())) { res.writeHead(302, { Location: base + '/setup.html' }); return res.end(); }
      return reply(200, await readFile(path.join(staticDir, file[0]), 'utf8'), file[1]);
    } catch (e) { reply(e.status || 500, { error: e.status ? e.message : 'Unable to read or save configuration. Check add-on storage.' }); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) createServer().listen(8099, '0.0.0.0', () => console.log('Kinetic listening on Ingress port 8099'));
