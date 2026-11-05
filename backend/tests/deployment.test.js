import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { databaseOptions } from '../src/config/databaseOptions.js';
import { mountFrontend } from '../src/frontend.js';

let directory, origin, server;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'wireless-deployment-'));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), '<!doctype html><title>Wireless Cooking</title>');
  await writeFile(join(directory, 'assets', 'app-123abc.js'), '/* compiled asset */');
  await writeFile(join(directory, 'public-ca.pem'), 'PUBLIC-TEST-CERTIFICATE');
  const app = express();
  app.get('/api/example', (req, res) => res.json({ ok: true }));
  mountFrontend(app, { directory });
  app.use((req, res) => res.status(404).json({ ok: false }));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (directory) {
    await unlink(join(directory, 'assets', 'app-123abc.js'));
    await unlink(join(directory, 'index.html'));
    await unlink(join(directory, 'public-ca.pem'));
    await rmdir(join(directory, 'assets'));
    await rmdir(directory);
  }
});

test('La página y las rutas internas de React abren al recargar, sin cachear el HTML', async () => {
  for (const path of ['/', '/login', '/mis-pedidos', '/pedido/17']) {
    const response = await fetch(origin + path, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    assert.match(await response.text(), /Wireless Cooking/);
  }
  const asset = await fetch(origin + '/assets/app-123abc.js');
  assert.match(asset.headers.get('cache-control'), /immutable/);
});

test('El fallback de React no oculta errores de la API o archivos inexistentes', async () => {
  assert.deepEqual(await (await fetch(origin + '/api/example')).json(), { ok: true });
  for (const path of ['/api/missing', '/API/missing', '/uploads/missing.png', '/demo-assets/missing.png', '/assets/missing', '/missing.js', '/.env', '/%2eenv', '/.git/config']) {
    const response = await fetch(origin + path, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 404, path);
    assert.doesNotMatch(await response.text(), /Wireless Cooking/, path);
  }
  assert.equal((await fetch(origin + '/login', { method: 'POST' })).status, 404);
  assert.equal((await fetch(origin + '/login', { headers: { Accept: 'application/json' } })).status, 404);
});

test('RDS admite una CA explícita y conserva la verificación del certificado y TLS 1.2', () => {
  const options = databaseOptions({ DB_SSL: 'true', DB_SSL_CA_FILE: join(directory, 'public-ca.pem'), DB_HOST: 'db.example', DB_NAME: 'wireless', TEST_SCHEMA: 'test_rds' });
  assert.equal(options.ssl.ca, 'PUBLIC-TEST-CERTIFICATE');
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.ssl.minVersion, 'TLSv1.2');
  assert.equal(options.options, '-c search_path=test_rds');
  assert.equal(databaseOptions({ DB_SSL: 'true' }).ssl.rejectUnauthorized, true);
  assert.equal(databaseOptions({ DB_SSL: 'false' }).ssl, false);
  assert.throws(() => databaseOptions({ DB_SSL: 'true', DB_SSL_CA_FILE: join(directory, 'missing.pem') }), { code: 'ENOENT' });
});

test('El servidor detecta un frontend sin compilar antes de aceptar visitas', () => {
  assert.throws(() => mountFrontend(express(), { directory: join(directory, 'missing') }), /Falta compilar/);
});
