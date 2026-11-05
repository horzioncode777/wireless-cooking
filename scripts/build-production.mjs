import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Override any development .env URL: this build uses the same origin as Express.
const result = spawnSync(process.execPath, [fileURLToPath(new URL('../frontend/node_modules/vite/bin/vite.js', import.meta.url)), 'build'], {
  cwd: fileURLToPath(new URL('../frontend/', import.meta.url)),
  env: { ...process.env, NODE_ENV: 'production', VITE_API_URL: '' },
  stdio: 'inherit',
});
if (result.error) console.error('No se pudo compilar. Instala las dependencias de frontend con npm ci.');
process.exitCode = result.status ?? 1;
