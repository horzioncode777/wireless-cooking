import 'dotenv/config';
import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const schema=`test_stores_${randomUUID().replaceAll('-','')}`;
const owner=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
let db,server,origin,seller,inactive,product;
async function request(path){const response=await fetch(`${origin}/api${path}`);return {status:response.status,data:await response.json()};}
before(async()=>{
  await owner.connect();await owner.query(`CREATE SCHEMA ${schema}`);
  Object.assign(process.env,{TEST_SCHEMA:schema,NODE_ENV:'test',PAYMENT_MODE:'demo',OPENAI_API_KEY:'',GMAIL_USER:'',GMAIL_APP_PASSWORD:''});
  db=(await import('../src/config/db.js')).default;
  assert.equal((await db.query('SELECT current_schema() AS schema')).rows[0].schema,schema);
  await db.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
  const users=(await db.query("INSERT INTO usuarios(nombre,correo,contrasena_hash,telefono,direccion,rol,estado) VALUES('Activa','private-owner@example.local','private-password-hash','private-phone','private-address','vendedor','activo'),('Archivada','archived@example.local','hash','','','vendedor','inactivo'),('Cliente','buyer@example.local','hash','','','comprador','activo'),('Otro cliente','buyer2@example.local','hash','','','comprador','activo') RETURNING id_usuario")).rows;
  const profile={es_demo:true,lema:'Mesa con identidad',correo_publico:'hola@marca.example',telefono_publico:'0000000000',historia:'Historia pública',fundacion:2020,valores:['Oficio'],contrasena_hash:'hidden-nested-secret',datos_bancarios:'hidden-bank-account',servicios:['Asesoría',123,{token:'hidden-token'}]};
  seller=(await db.query("INSERT INTO vendedores(id_usuario,nombre_tienda,ciudad,perfil_publico) VALUES($1,'Tienda activa','Tabio',$2) RETURNING id_vendedor",[users[0].id_usuario,JSON.stringify(profile)])).rows[0].id_vendedor;
  inactive=(await db.query("INSERT INTO vendedores(id_usuario,nombre_tienda) VALUES($1,'Tienda archivada') RETURNING id_vendedor",[users[1].id_usuario])).rows[0].id_vendedor;
  const category=(await db.query('SELECT id_categoria FROM categorias LIMIT 1')).rows[0].id_categoria;
  const gallery=['/demo-assets/test-front.png','/demo-assets/test-detail.png'];
  product=(await db.query('INSERT INTO productos(id_vendedor,id_categoria,nombre,descripcion,precio,stock,imagen,galeria,ficha) VALUES($1,$2,$3,$4,45000,5,$5,$6,$7) RETURNING id_producto',[seller,category,'Cuenco','Ficha pública',gallery[0],JSON.stringify(gallery),JSON.stringify({contenido:'1 cuenco',cuidados:'Lavar suavemente'})])).rows[0].id_producto;
  await db.query("INSERT INTO productos(id_vendedor,id_categoria,nombre,descripcion,precio,stock,estado) VALUES($1,$3,'Archivado','Oculto',10,1,'activo'),($2,$3,'Pausado','Oculto',10,1,'pausado')",[inactive,seller,category]);
  await db.query('INSERT INTO resenas_producto(id_usuario,id_producto,puntuacion,comentario) VALUES($1,$3,4,$4),($2,$3,5,$4)',[users[2].id_usuario,users[3].id_usuario,product,'Reseña de prueba']);
  const app=(await import('../src/app.js')).default;
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(db)await db.end();await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await owner.end();});

test('Directorio público: solo tiendas activas, conteos sin duplicar productos por reseñas',async()=>{
  const result=await request('/marketplace');assert.equal(result.status,200);assert.equal(result.data.sellers.length,1);
  const row=result.data.sellers[0];assert.equal(row.id_vendedor,seller);assert.equal(row.productos,1);assert.equal(row.resenas,2);assert.equal(Number(row.calificacion),4.5);assert.equal(row.verificado,false);
});
test('Perfil público sin sesión: filtra datos privados y claves JSON no permitidas',async()=>{
  const result=await request(`/marketplace/${seller}`);assert.equal(result.status,200);
  const text=JSON.stringify(result.data);for(const privateValue of ['private-owner','private-password','private-phone','private-address','hidden-nested','hidden-bank','hidden-token'])assert.ok(!text.includes(privateValue));
  assert.equal(result.data.seller.perfil_publico.correo_publico,'hola@marca.example');
  assert.deepEqual(result.data.seller.perfil_publico.servicios,['Asesoría']);
  assert.equal(result.data.seller.id_usuario,undefined);
  assert.equal(result.data.products.length,1);assert.equal(result.data.products[0].id_producto,product);
});
test('Galería y ficha sobreviven a la migración y llegan al detalle de producto',async()=>{
  await db.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
  const result=await request(`/seller/products/${product}?view=0`);assert.equal(result.status,200);
  assert.deepEqual(result.data.product.galeria,['/demo-assets/test-front.png','/demo-assets/test-detail.png']);
  assert.equal(result.data.product.ficha.contenido,'1 cuenco');
  const prior=(await db.query('SELECT revision FROM catalog_revision')).rows[0].revision;
  await db.query('UPDATE productos SET galeria=$1 WHERE id_producto=$2',[JSON.stringify(['/one.png','/two.png']),product]);
  assert.ok(BigInt((await db.query('SELECT revision FROM catalog_revision')).rows[0].revision)>BigInt(prior));
});
test('Una tienda archivada, identificador inválido o inexistente no expone productos',async()=>{
  assert.equal((await request(`/marketplace/${inactive}`)).status,404);
  assert.equal((await request('/marketplace/99999999')).status,404);
  for(const id of ['0','-1','abc','1.5','9007199254740993'])assert.equal((await request(`/marketplace/${id}`)).status,400);
});
test('Colección ampliada: 12 tiendas, 4 artesanías y 24 productos con 2 fotos distintas',async()=>{
  const stores=(await Promise.all(['tiendas-sabana.json','tiendas-artesanias.json'].map(async name=>JSON.parse(await readFile(new URL(`../data/${name}`,import.meta.url),'utf8'))))).flat();
  assert.equal(stores.length,12);assert.equal(new Set(stores.map(s=>s.ciudad)).size,12);
  assert.equal(stores.flatMap(s=>s.productos).length,24);
  assert.equal(stores.flatMap(s=>s.productos).filter(p=>p.categoria==='Artesanías').length,4);
  for(const store of stores){
    assert.equal(store.productos.length,2);await readFile(new URL(`../demo-assets/brands/${store.slug}.png`,import.meta.url));
    for(const product of store.productos){
      const photos=await Promise.all([1,2].map(n=>readFile(new URL(`../demo-assets/brands/catalog/${product.slug}-${n}.png`,import.meta.url))));
      assert.notEqual(createHash('sha256').update(photos[0]).digest('hex'),createHash('sha256').update(photos[1]).digest('hex'));
    }
  }
});
