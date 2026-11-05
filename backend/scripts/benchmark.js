import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import pg from 'pg';
import jwt from 'jsonwebtoken';

// Synthetic data lives in its own schema. Never load-test the user's catalog.
const schema = `test_bench_${randomUUID().replaceAll('-', '')}`;
const owner = new pg.Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
const label = process.argv[2] || 'current';
const productCount = 1000;
const concurrency = Number(process.env.BENCH_CONCURRENCY || 20);
const requests = Number(process.env.BENCH_REQUESTS || 200);
const distinctUsers = process.env.BENCH_DISTINCT_USERS==='true';
let pool, server;
await owner.connect();
try {
  await owner.query(`CREATE SCHEMA ${schema}`);
  process.env.TEST_SCHEMA = schema;
  process.env.NODE_ENV = 'test';
  pool = (await import('../src/config/db.js')).default;
  await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  await pool.query(`INSERT INTO usuarios(nombre,correo,contrasena_hash,rol) SELECT 'Usuario '||i,'bench'||i||'@test.local','unused',CASE WHEN i=1 THEN 'vendedor' ELSE 'comprador' END FROM generate_series(1,201) i`);
  await pool.query("INSERT INTO vendedores(id_usuario,nombre_tienda) VALUES(1,'Taller de prueba')");
  await pool.query(`INSERT INTO productos(id_vendedor,id_categoria,nombre,descripcion,precio,stock,material,ventas,vistas) SELECT 1,1+(i%6),'Utensilio '||i,'Utensilio artesanal de cocina de Cajicá elaborado con materiales resistentes, apto para servir y preparar alimentos.',10000+i*100,20,'Cerámica',i%30,i%100 FROM generate_series(1,$1::int) i`, [productCount]);
  await pool.query(`INSERT INTO resenas_producto(id_usuario,id_producto,puntuacion,comentario) SELECT u,p,3+(u%3),'Reseña de prueba' FROM generate_series(2,11) u CROSS JOIN generate_series(1,$1::int) p`, [productCount]);
  await pool.query(`INSERT INTO pedidos(id_usuario,total,estado,direccion_entrega,metodo_pago) SELECT 2,50000,'pagado','Dirección sintética','CARD' FROM generate_series(1,2000)`);
  await pool.query(`INSERT INTO detalle_pedido(id_pedido,id_producto,nombre_producto,cantidad,precio_unitario,subtotal) SELECT i,1+(i%1000),'Producto sintético',1,50000,50000 FROM generate_series(1,2000) i`);
  await pool.query(`INSERT INTO historial_navegacion(id_usuario,id_producto,fecha) SELECT 2,1+(i%100),now()-(i||' hours')::interval FROM generate_series(1,200) i`);
  await pool.query('ANALYZE');
  const app = (await import('../src/app.js')).default;
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign({ id_usuario: 2, version: 0 }, process.env.JWT_SECRET);
  const tokens=distinctUsers?Array.from({length:200},(_,index)=>jwt.sign({id_usuario:index+2,version:0},process.env.JWT_SECRET)):[];
  const routes = ['/seller/products', '/seller/products/categories/list', '/recommendations'];
  const results = [];
  for (const route of routes) {
    const headers = route === '/recommendations' ? { Authorization: `Bearer ${token}` } : {};
    for (let i = 0; i < 3; i++) await (await fetch(`${origin}/api${route}`, { headers })).arrayBuffer();
    const durations = [], statuses = {}, sizes = [];
    let cursor = 0;
    const start = performance.now();
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (cursor++ < requests) {
        const t = performance.now();
        const requestHeaders=route==='/recommendations'&&distinctUsers?{Authorization:`Bearer ${tokens[(cursor-1)%tokens.length]}`}:headers;
        try {
          const response = await fetch(`${origin}/api${route}`, { headers:requestHeaders });
          const body = await response.arrayBuffer();
          sizes.push(body.byteLength);
          statuses[response.status] = (statuses[response.status] || 0) + 1;
        } catch { statuses.network_error = (statuses.network_error || 0) + 1; }
        durations.push(performance.now() - t);
      }
    }));
    const elapsed = performance.now() - start;
    durations.sort((a, b) => a - b);
    const percentile = p => Number(durations[Math.min(durations.length - 1, Math.ceil(durations.length * p) - 1)].toFixed(2));
    results.push({ route, requests, concurrency, statuses, p50_ms: percentile(.5), p95_ms: percentile(.95), p99_ms: percentile(.99), max_ms: Number(durations.at(-1).toFixed(2)), requests_per_second: Number((requests / elapsed * 1000).toFixed(2)), average_bytes: Math.round(sizes.reduce((sum, value) => sum + value, 0) / sizes.length) });
  }
  const report = { label, date: new Date().toISOString(), environment: 'Local Windows, Node.js and PostgreSQL; synthetic isolated schema; warm requests; no external services', recommendation_users:distinctUsers?200:1, products: productCount, users: 201, reviews: 10000, orders: 2000, results };
  const dir = new URL('../../docs/performance/', import.meta.url);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL(`${label}.json`, dir), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (pool) await pool.end();
  await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await owner.end();
}
