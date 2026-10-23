import { discover } from './discovery.mjs';
const $ = id => document.getElementById(id);
let token = '', discovery, revision = null;
const status = text => { $('status').textContent = text; };
async function getToken() {
  try {
    const auth = parent !== window && parent.document.querySelector('home-assistant')?.hass?.auth;
    if (auth) { if (auth.expired) await auth.refreshAccessToken(); return auth.accessToken || auth.data?.access_token; }
  } catch { /* A separate sign-in is available when the frontend cannot be reached. */ }
  const stored = JSON.parse(sessionStorage.getItem('kineticSetupAuth') || localStorage.getItem('hassTokens') || 'null');
  if (!stored?.refresh_token) throw Error('Sign in with a Home Assistant administrator to configure Kinetic.');
  const response = await fetch('/auth/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: stored.refresh_token, client_id: stored.clientId || location.origin + '/' }) });
  const result = await response.json();
  if (!response.ok) throw Error('Your session expired. Sign in again.');
  return result.access_token;
}
async function api(route, options = {}) {
  token = await getToken();
  const response = await fetch('api/' + route, { ...options, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Request failed');
  return result;
}
$('login').onclick = () => {
  const state = crypto.randomUUID();
  sessionStorage.setItem('kineticSetupState', JSON.stringify({ state, time: Date.now() }));
  const redirect = new URL(location.href); redirect.search = ''; redirect.hash = '';
  location.href = '/auth/authorize?' + new URLSearchParams({ response_type: 'code', client_id: location.origin + '/', redirect_uri: redirect.href, state });
};
async function authReturn() {
  const params = new URLSearchParams(location.search);
  if (!params.has('code')) return;
  const saved = JSON.parse(sessionStorage.getItem('kineticSetupState') || 'null');
  if (!saved || saved.state !== params.get('state') || Date.now() - saved.time > 600000) throw Error('Invalid or expired sign-in state. Please sign in again.');
  sessionStorage.removeItem('kineticSetupState');
  const code = params.get('code'); history.replaceState(null, '', location.pathname);
  const response = await fetch('/auth/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: location.origin + '/' }) });
  const auth = await response.json();
  if (!response.ok || !auth.refresh_token) throw Error('Home Assistant sign-in failed.');
  // Only the browser session holds this user's refresh token. Never send it to the add-on.
  sessionStorage.setItem('kineticSetupAuth', JSON.stringify({ refresh_token: auth.refresh_token, clientId: location.origin + '/' }));
}
async function connect() {
  $('refresh').disabled = true;
  try {
    status('Discovering areas, devices and entities…');
    const saved = await api('config'); revision = saved.revision;
    $('config').value = JSON.stringify(saved.config, null, 2);
    $('name').value = saved.config.brand?.name || 'My home';
    $('review').hidden = false;
    discovery = await api('discovery');
    $('counts').textContent = `${discovery.areas.length} areas · ${discovery.devices.length} devices · ${discovery.entities.length} entities. Unassigned cameras, climate, media and calendars are also included.`;
    $('area-list').replaceChildren();
    for (const area of discovery.areas) {
      const label = document.createElement('label'), input = document.createElement('input');
      input.type = 'checkbox'; input.value = area.area_id;
      input.checked = !saved.revision || (saved.config.house || []).some(r => r.id === area.area_id);
      label.append(input, document.createTextNode(' ' + area.name)); $('area-list').append(label);
    }
    $('areas').hidden = false; status(saved.revision ? 'Configuration loaded. Refresh mappings or edit your existing configuration.' : 'Connected. Choose areas to create your first dashboard.');
  } catch (e) { status(e.message); } finally { $('refresh').disabled = false; }
}
$('refresh').onclick = connect;
$('generate').onclick = () => {
  try {
    const existing = JSON.parse($('config').value);
    const selected = [...$('area-list').querySelectorAll('input:checked')].map(el => el.value);
    const config = { ...existing, ...discover(discovery, selected), brand: { ...existing.brand, name: $('name').value, intro: false } };
    $('config').value = JSON.stringify(config, null, 2); $('review').hidden = false;
    status('Generated. Review your mappings, then save.'); $('review').scrollIntoView({ behavior: 'smooth' });
  } catch (e) { status(e.message); }
};
$('save').onclick = async () => {
  $('save').disabled = true;
  try {
    const config = JSON.parse($('config').value);
    const saved = await api('config', { method: 'PUT', body: JSON.stringify({ revision, config }) });
    revision = saved.revision; location.href = 'dash.html';
  } catch (e) { status(e.message); } finally { $('save').disabled = false; }
};
try { await authReturn(); await connect(); } catch (e) { status(e.message); }
