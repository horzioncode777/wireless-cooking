import 'dotenv/config';
import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { fixtureToken } from './helpers/authFixture.js';

const schema=`test_reviews_${randomUUID().replaceAll('-','')}`;
const owner=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
let db,server,origin,buyer,other,seller,product;
async function request(path,{user=buyer,body,method='GET'}={}){
 const token=user?await fixtureToken(db,user):null;
 const response=await fetch(`${origin}/api${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};
}
before(async()=>{
 await owner.connect();await owner.query(`CREATE SCHEMA ${schema}`);
 Object.assign(process.env,{TEST_SCHEMA:schema,NODE_ENV:'test',PAYMENT_MODE:'demo',GMAIL_USER:'',GMAIL_APP_PASSWORD:'',OPENAI_API_KEY:''});
 db=(await import('../src/config/db.js')).default;
 assert.equal((await db.query('SELECT current_schema() AS schema')).rows[0].schema,schema);
 await db.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
 async function account(name,role){return (await db.query('INSERT INTO usuarios(nombre,correo,contrasena_hash,rol) VALUES($1,$2,$3,$4) RETURNING *',[name,`${name}@reviews.local`,'unused',role])).rows[0];}
 buyer=await account('buyer','comprador');other=await account('other','comprador');seller=await account('seller','vendedor');
 const shop=(await db.query("INSERT INTO vendedores(id_usuario,nombre_tienda) VALUES($1,'Tienda de reseñas') RETURNING *",[seller.id_usuario])).rows[0];
 const category=(await db.query('SELECT id_categoria FROM categorias LIMIT 1')).rows[0];
 product=(await db.query("INSERT INTO productos(id_vendedor,id_categoria,nombre,descripcion,precio,stock) VALUES($1,$2,'Olla para reseñas','Prueba aislada',25000,100) RETURNING *",[shop.id_vendedor,category.id_categoria])).rows[0];
 const app=(await import('../src/app.js')).default;server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(db)await db.end();await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await owner.end();});
const post=(puntuacion,comentario='',user=buyer)=>request('/reviews',{user,method:'POST',body:{productId:product.id_producto,puntuacion,comentario}});

test('Calificaciones públicas y escritura con sesión, validación entera y límites',async()=>{
 assert.equal((await request(`/reviews/product/${product.id_producto}`,{user:null})).status,200);
 assert.equal((await post(5,'',null)).status,401);
 for(const score of [0,6,2.5,'5',true])assert.equal((await post(score)).status,400);
 assert.equal((await post(5,{bad:'value'})).status,400);
 assert.equal((await post(5,'x'.repeat(2001))).status,400);
 assert.equal((await request('/reviews/product/bad')).status,400);
 assert.equal((await request('/reviews',{method:'POST',body:{productId:2147483647,puntuacion:5}})).status,404);
});
test('Guardar y editar mantiene una opinión por persona y actualiza promedio, fechas y avisos',async()=>{
 const before=(await db.query('SELECT revision FROM catalog_revision WHERE id=1')).rows[0].revision;
 assert.equal((await post(5,'  Excelente producto  ')).status,200);
 const own=(await request(`/reviews/product/${product.id_producto}/mine`)).data;
 assert.equal(own.review.comentario,'Excelente producto');assert.equal(own.canReview,true);
 assert.equal((await request(`/reviews/product/${product.id_producto}/mine`,{user:other})).data.review,null);
 const countBefore=(await db.query("SELECT COUNT(*)::int count FROM notificaciones WHERE id_usuario=$1 AND tipo='resena'",[seller.id_usuario])).rows[0].count;
 await post(5,'Excelente producto');
 assert.equal((await db.query("SELECT COUNT(*)::int count FROM notificaciones WHERE id_usuario=$1 AND tipo='resena'",[seller.id_usuario])).rows[0].count,countBefore);
 await post(3,'Calificación actualizada');await post(5,'Buena experiencia',other);
 const result=(await request(`/reviews/product/${product.id_producto}`,{user:null})).data;
 assert.equal(result.summary.total,2);assert.equal(Number(result.summary.average),4);
 assert.ok(result.reviews.every(row=>row.fecha_actualizacion));
 assert.equal((await request(`/reviews/product/${product.id_producto}/mine`)).data.review.puntuacion,3);
 assert.ok(BigInt((await db.query('SELECT revision FROM catalog_revision WHERE id=1')).rows[0].revision)>BigInt(before));
 const detail=(await request(`/seller/products/${product.id_producto}`,{user:null})).data.product;
 assert.equal(Number(detail.calificacion),4);assert.equal(detail.resenas,2);
});
test('El vendedor no se califica a sí mismo y el usuario autenticado determina la autoría',async()=>{
 assert.equal((await request(`/reviews/product/${product.id_producto}/mine`,{user:seller})).data.canReview,false);
 assert.equal((await post(5,'Autorreseña',seller)).status,403);
 const result=await request('/reviews',{method:'POST',body:{productId:product.id_producto,puntuacion:4,id_usuario:seller.id_usuario}});
 assert.equal(result.data.review.id_usuario,buyer.id_usuario);
});
test('Productos retirados y vendedores inactivos no aceptan nuevas opiniones',async()=>{
 await db.query("UPDATE productos SET estado='eliminado' WHERE id_producto=$1",[product.id_producto]);assert.equal((await post(5)).status,404);
 await db.query("UPDATE productos SET estado='activo' WHERE id_producto=$1",[product.id_producto]);
 await db.query("UPDATE usuarios SET estado='inactivo' WHERE id_usuario=$1",[seller.id_usuario]);assert.equal((await post(5)).status,404);
});
