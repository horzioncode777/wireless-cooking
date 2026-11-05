import pool from '../config/db.js';

let cached, pending;
export async function catalogRevision() {
  const { rows } = await pool.query('SELECT revision FROM catalog_revision WHERE id=1');
  return String(rows[0].revision);
}

export async function catalogSnapshot() {
  const revision = await catalogRevision();
  if (cached?.revision === revision && Date.now() - cached.created < 30000) return cached;
  if (pending) { await pending; if (cached?.revision === revision) return cached; }
  const refresh = (async () => {
    const { rows } = await pool.query(`
      SELECT p.*,v.nombre_tienda AS vendedor_nombre,c.nombre AS categoria,
        COALESCE(r.calificacion,0) AS calificacion,COALESCE(r.resenas,0) AS resenas
      FROM productos p
      LEFT JOIN vendedores v USING(id_vendedor)
      LEFT JOIN usuarios u ON u.id_usuario=v.id_usuario
      LEFT JOIN categorias c USING(id_categoria)
      LEFT JOIN (
        SELECT id_producto,ROUND(AVG(puntuacion)::numeric,1) AS calificacion,COUNT(*)::int AS resenas
        FROM resenas_producto GROUP BY id_producto
      ) r USING(id_producto)
      WHERE lower(p.estado)='activo' AND (p.id_vendedor IS NULL OR u.estado='activo')
      ORDER BY p.fecha_creacion DESC,p.id_producto DESC
    `);
    cached = { revision, created: Date.now(), products: rows };
  })();
  pending=refresh;
  try { await refresh; return cached; } finally { if(pending===refresh) pending = null; }
}

// One inexpensive DB check per second per server, independent of connected browsers.
const streams = new Set();
let timer, checking = false, lastRevision;
async function checkRevision() {
  if (checking) return;
  checking = true;
  try {
    const revision = await catalogRevision();
    if (revision !== lastRevision) {
      lastRevision = revision;
      for (const stream of streams) {
        if(stream.writableLength>65536) stream.end();
        else if (!stream.writableEnded) stream.write(`id: ${revision}\nevent: catalog\ndata: ${JSON.stringify({ revision })}\n\n`);
      }
    }
  } catch {
    // Closing forces EventSource to reconnect. No internal errors or user data are broadcast.
    for (const stream of [...streams]) stream.end();
  } finally { checking = false; }
}
export async function catalogEvents(req,res,next) {
  try {
    const revision = await catalogRevision();
    res.set({ 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache, no-transform', 'Connection':'keep-alive', 'X-Accel-Buffering':'no' });
    res.flushHeaders();
    res.write(`retry: 3000\nid: ${revision}\nevent: catalog\ndata: ${JSON.stringify({ revision })}\n\n`);
    streams.add(res);
    if (!timer) { lastRevision = revision; timer = setInterval(checkRevision,1000); timer.unref(); }
    const heartbeat = setInterval(() => { if (!res.writableEnded) res.write(': keepalive\n\n'); },15000);
    heartbeat.unref();
    res.on('close',() => {
      clearInterval(heartbeat); streams.delete(res);
      if (!streams.size) { clearInterval(timer); timer = null; lastRevision = undefined; }
    });
  } catch(error) { next(error); }
}
