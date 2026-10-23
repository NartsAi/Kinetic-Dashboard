import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
for (const file of ['dash.html', 'brand-logo.js']) {
  await copyFile(new URL(file, root), new URL('addon/' + file, root));
}
console.log('Packaged dashboard assets into ' + fileURLToPath(new URL('addon/', root)));
