import { mkdir, readFile, writeFile, rename, readdir, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const TABLET_DASHBOARD_YAML = `title: Kinetic Tablet
views:
  - title: Kinetic
    path: home
    type: panel
    cards:
      - type: iframe
        url: /local/kinetic/dash.html
        hide_background: true
`;

// Only this dedicated directory is published. No HA dashboard/storage files are edited.
export async function publishDashboard({ config, staticDir, homeAssistantDir = '/homeassistant' }) {
  try { await realpath(homeAssistantDir); }
  catch { throw Object.assign(new Error('Home Assistant config folder is not mounted. Update the add-on and restart it before publishing.'), { status: 503 }); }
  const folder = path.join(homeAssistantDir, 'www', 'kinetic');
  const marker = '.kinetic-publisher.json';
  try {
    if ((await lstat(folder)).isSymbolicLink()) throw Object.assign(new Error('The kinetic publication folder must not be a symbolic link.'), { status: 409 });
    const files = await readdir(folder);
    if (files.length && !files.includes(marker)) throw Object.assign(new Error('www/kinetic already contains unmanaged files. Back up and rename that folder before publishing.'), { status: 409 });
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const assets = await Promise.all(['dash.html', 'brand-logo.js', 'ranger-xlt.png', 'vehicle-art.js'].map(async name => [name, await readFile(path.join(staticDir, name))]));
  // www is public: export configuration data only, never an HA session or API token.
  const script = 'window.DASH_CONFIG=' + JSON.stringify({ ...config, token: '', settingsPath: '/hassio/dashboard' }) + ';window.DASH_CONFIG.url=location.origin;\n';
  await mkdir(folder, { recursive: true });
  const put = async (name, content) => {
    const tmp = path.join(folder, '.' + name + '.' + randomUUID() + '.tmp');
    await writeFile(tmp, content, { mode: 0o644 });
    await rename(tmp, path.join(folder, name));
  };
  // Mark ownership before installing assets, so an interrupted publish can be retried.
  await put(marker, JSON.stringify({ publisher: 'kinetic-dashboard', updated: new Date().toISOString() }));
  for (const [name, content] of assets) await put(name, content);
  await put('config.js', script);
  await put('tablet-dashboard.yaml', TABLET_DASHBOARD_YAML);
  return { url: '/local/kinetic/dash.html', dashboard_yaml: TABLET_DASHBOARD_YAML };
}
