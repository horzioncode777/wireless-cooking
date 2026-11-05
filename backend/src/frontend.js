import express from 'express';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function mountFrontend(app, {
  directory = fileURLToPath(new URL('../../frontend/dist/', import.meta.url)),
} = {}) {
  const index = join(directory, 'index.html');
  if (!existsSync(index)) throw new Error('Falta compilar el frontend: ejecuta npm run build desde frontend.');

  // Missing API endpoints or images must stay 404 instead of returning the React page.
  app.use(['/api', '/uploads', '/demo-assets'], (req, res) => res.status(404).json({ ok: false, message: 'Ruta no encontrada.' }));
  app.use('/assets', express.static(join(directory, 'assets'), { maxAge: '1y', immutable: true }));
  app.use('/assets', (req, res) => res.sendStatus(404));
  app.use(express.static(directory, { index: false, maxAge: 0, setHeaders: res => res.setHeader('Cache-Control', 'no-cache') }));
  app.get('*', (req, res, next) => {
    let pathname;
    try { pathname = decodeURIComponent(req.path); } catch { return next(); }
    if (extname(pathname) || pathname.split(/[\\/]/).some(part => part.startsWith('.')) || !req.accepts('html')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
}
