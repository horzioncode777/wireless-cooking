import 'dotenv/config';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import pool from '../src/config/db.js';
const base='http://localhost:6001';
try {
 const {rows}=await pool.query(`SELECT v.id_vendedor,v.nombre_tienda,v.logo,v.banner_url,COUNT(p.id_producto)::int AS productos FROM vendedores v JOIN usuarios u USING(id_usuario) LEFT JOIN productos p ON p.id_vendedor=v.id_vendedor AND p.estado!='eliminado' WHERE u.correo LIKE 'empresa%@catalogo.wireless.example' GROUP BY v.id_vendedor`);
 assert.equal(rows.length,50);
 assert.ok(rows.every(s=>s.productos===40));
 assert.equal(new Set(rows.map(s=>s.logo)).size,50);
 const products=(await pool.query(`SELECT p.* FROM productos p JOIN vendedores v USING(id_vendedor) JOIN usuarios u USING(id_usuario) WHERE u.correo LIKE 'empresa%@catalogo.wireless.example' AND p.estado!='eliminado'`)).rows;
 assert.equal(products.length,2000);
 assert.ok(products.every(p=>Number(p.precio)>0&&p.stock>0&&p.material&&p.imagen));
 const assets=new Set([...rows.flatMap(s=>[s.logo,s.banner_url]),...products.map(p=>p.imagen)]);
 for(const asset of assets) {
  await access(new URL(`..${asset}`,import.meta.url));
  const response=await fetch(`${base}${asset}`,{method:'HEAD'});
  assert.equal(response.status,200,asset);
  assert.match(response.headers.get('content-type'),/^image\//,asset);
 }
 const marketplace=await (await fetch(`${base}/api/marketplace`)).json();
 assert.ok(rows.every(s=>marketplace.sellers.some(item=>item.id_vendedor===s.id_vendedor&&item.productos===40&&item.logo&&item.banner_url)));
 const credentials=await readFile(new URL('../../ACCESOS-EMPRESAS.local.md',import.meta.url),'utf8');
 const account=credentials.match(/Correo: (empresa01@[^\n]+)\nContraseña: ([^\n]+)/);
 assert.ok(account);
 const response=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({correo:account[1],password:account[2]})});
 assert.equal(response.status,200);
 const login=await response.json();
 const inventory=await (await fetch(`${base}/api/seller/products/mine`,{headers:{Authorization:`Bearer ${login.token}`}})).json();
 assert.equal(inventory.products.length,40);
 console.log(JSON.stringify({empresas:rows.length,productos:products.length,logos:50,fotos:12,archivosServidos:assets.size,accesoVendedor:'correcto',inventarioPropio:40}));
} finally {await pool.end();}
