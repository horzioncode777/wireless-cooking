import 'dotenv/config';
import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const schema=`test_settings_${randomUUID().replaceAll('-','')}`;
const owner=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
let db,server,origin,buyer,other;
async function request(path,{user=buyer,method='GET',body}={}){
 const token=user?jwt.sign({id_usuario:user.id_usuario,version:0},process.env.JWT_SECRET,{expiresIn:'1h'}):null;
 const response=await fetch(`${origin}/api${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};
}
before(async()=>{
 await owner.connect();await owner.query(`CREATE SCHEMA ${schema}`);
 Object.assign(process.env,{TEST_SCHEMA:schema,NODE_ENV:'test',PAYMENT_MODE:'demo',OPENAI_API_KEY:'',GMAIL_USER:'',GMAIL_APP_PASSWORD:''});
 db=(await import('../src/config/db.js')).default;assert.equal((await db.query('SELECT current_schema() AS schema')).rows[0].schema,schema);
 await db.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
 const hash=await bcrypt.hash('FixturePassword!2026',10);
 buyer=(await db.query("INSERT INTO usuarios(nombre,correo,contrasena_hash) VALUES('Configuración de prueba','buyer@settings.local',$1) RETURNING *",[hash])).rows[0];
 other=(await db.query("INSERT INTO usuarios(nombre,correo,contrasena_hash) VALUES('Otra cuenta de prueba','other@settings.local',$1) RETURNING *",[hash])).rows[0];
 const app=(await import('../src/app.js')).default;server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(db)await db.end();await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await owner.end();});
const allOff={pedidos:false,resenas:false,novedades:false};

test('El perfil devuelve registro real y favoritos propios, sin datos de autenticación',async()=>{
 assert.equal((await request('/user/profile',{user:null})).status,401);
 await db.query("UPDATE usuarios SET fecha_registro='2021-07-15T16:00:00Z',fecha_creacion='2026-10-22T16:00:00Z' WHERE id_usuario=$1",[buyer.id_usuario]);
 const category=(await db.query('SELECT id_categoria FROM categorias LIMIT 1')).rows[0];
 const products=(await db.query("INSERT INTO productos(id_categoria,nombre,descripcion,precio,stock) VALUES($1,'Favorito A','Prueba local',10000,1),($1,'Favorito B','Prueba local',20000,1) RETURNING id_producto",[category.id_categoria])).rows;
 for(const product of products)await db.query('INSERT INTO favoritos(id_usuario,id_producto) VALUES($1,$2)',[buyer.id_usuario,product.id_producto]);
 await db.query('INSERT INTO favoritos(id_usuario,id_producto) VALUES($1,$2)',[other.id_usuario,products[0].id_producto]);
 const result=await request('/user/profile?id_usuario='+other.id_usuario);assert.equal(result.status,200);
 assert.equal(result.data.user.id_usuario,buyer.id_usuario);assert.equal(result.data.user.fecha_registro,'2021-07-15T16:00:00.000Z');
 assert.equal(result.data.user.contrasena_hash,undefined);assert.equal(result.data.user.token_version,undefined);
 assert.equal(result.data.summary.favorites,2);assert.equal((await request('/user/profile',{user:other})).data.summary.favorites,1);
 assert.equal((await request(`/favorites/${products[0].id_producto}`,{method:'DELETE'})).status,200);
 assert.equal((await request('/user/profile')).data.summary.favorites,1);
 assert.equal((await request('/user/profile',{user:other})).data.summary.favorites,1);
 await db.query('UPDATE usuarios SET fecha_registro=NULL WHERE id_usuario=$1',[other.id_usuario]);
 const fallback=(await request('/user/profile',{user:other})).data.user.fecha_registro;
 assert.equal(fallback,new Date(other.fecha_creacion).toISOString());
});

test('El resumen de compras cuenta también pedidos fuera de la primera página',async()=>{
 await db.query(`INSERT INTO pedidos(id_usuario,total,direccion_entrega,metodo_pago,estado,fecha_creacion)
 SELECT $1,10000,'Dirección ficticia','CARD',CASE WHEN n=14 THEN 'entregado' ELSE 'pendiente' END,now()-n*interval '1 day' FROM generate_series(1,14) AS n`,[buyer.id_usuario]);
 const result=await request('/orders');assert.equal(result.status,200);assert.equal(result.data.orders.length,12);
 assert.equal(result.data.summary.total,14);assert.equal(result.data.summary.entregados,1);
 assert.equal((await request('/orders',{user:other})).data.summary.total,0);
});
test('Configuración requiere sesión y conserva todos los avisos activos por defecto',async()=>{
 assert.equal((await request('/user/settings',{user:null})).status,401);
 const result=await request('/user/settings');assert.equal(result.status,200);assert.deepEqual(result.data.preferences,{pedidos:true,resenas:true,novedades:true});
});
test('Las preferencias persisten por cuenta y solo aceptan tres valores booleanos',async()=>{
 for(const body of [{pedidos:false},{...allOff,pedidos:'false'},{...allOff,id_usuario:other.id_usuario},[]])assert.equal((await request('/user/settings',{method:'PATCH',body})).status,400);
 assert.equal((await request('/user/settings',{method:'PATCH',body:allOff})).status,200);
 assert.deepEqual((await request('/user/settings')).data.preferences,allOff);
 assert.deepEqual((await request('/user/settings',{user:other})).data.preferences,{pedidos:true,resenas:true,novedades:true});
});
test('Se filtran nuevos avisos opcionales sin ocultar seguridad, PQR, cuenta ni el historial',async()=>{
 const before=(await db.query('SELECT COUNT(*)::int count FROM notificaciones WHERE id_usuario=$1',[buyer.id_usuario])).rows[0].count;
 for(const type of ['pedido','venta','pago','resena','producto','inventario','favoritos','tienda','carrito','seguridad','pqr','cuenta'])await db.query("SELECT avisar_usuario($1,$2,$3,'Prueba aislada','/notificaciones')",[buyer.id_usuario,type,`settings-${type}`]);
 const after=(await db.query('SELECT COUNT(*)::int count FROM notificaciones WHERE id_usuario=$1',[buyer.id_usuario])).rows[0].count;assert.equal(after,before+3);
 await db.query("SELECT avisar_usuario($1,'pedido','settings-other','Prueba aislada','/mis-pedidos')",[other.id_usuario]);
 assert.equal((await db.query("SELECT COUNT(*)::int count FROM notificaciones WHERE id_usuario=$1 AND titulo='settings-other'",[other.id_usuario])).rows[0].count,1);
 await request('/user/settings',{method:'PATCH',body:{...allOff,resenas:true}});
 await db.query("SELECT avisar_usuario($1,'resena','settings-restored','Prueba aislada','/notificaciones')",[buyer.id_usuario]);
 assert.equal((await db.query("SELECT COUNT(*)::int count FROM notificaciones WHERE id_usuario=$1 AND titulo='settings-restored'",[buyer.id_usuario])).rows[0].count,1);
});
test('La migración conserva preferencias existentes',async()=>{
 await db.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
 assert.deepEqual((await request('/user/settings')).data.preferences,{...allOff,resenas:true});
});
test('Cambiar contraseña valida la actual, revoca sesiones y mantiene el aviso de seguridad',async()=>{
 const path='/auth/change-password';
 assert.equal((await request(path,{method:'POST',body:{actual:'Incorrecta',nueva:'NewFixturePassword!2026'}})).status,400);
 assert.equal((await request(path,{method:'POST',body:{actual:'FixturePassword!2026',nueva:'FixturePassword!2026'}})).status,400);
 assert.equal((await request(path,{method:'POST',body:{actual:'FixturePassword!2026',nueva:'corta'}})).status,400);
 assert.equal((await request(path,{method:'POST',body:{actual:'FixturePassword!2026',nueva:'NewFixturePassword!2026'}})).status,200);
 assert.equal((await request('/user/settings')).status,401);
 assert.equal((await request('/auth/login',{user:null,method:'POST',body:{correo:buyer.correo,password:'FixturePassword!2026'}})).status,401);
 assert.equal((await request('/auth/login',{user:null,method:'POST',body:{correo:buyer.correo,password:'NewFixturePassword!2026'}})).status,200);
 assert.equal((await db.query("SELECT COUNT(*)::int count FROM notificaciones WHERE id_usuario=$1 AND tipo='seguridad' AND titulo='Contraseña actualizada'",[buyer.id_usuario])).rows[0].count,1);
});
