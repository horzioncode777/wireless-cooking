import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { fixtureToken } from './helpers/authFixture.js';
import bcrypt from 'bcryptjs';

const schema=`test_notifications_${randomUUID().replaceAll('-','')}`;
const owner=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
let pool,server,origin,buyer,seller,admin,product,order;
const token=user=>fixtureToken(pool,user);
async function inbox(user){return (await request('/',user)).data;}
async function request(path,user,{method='GET',body}={}){
 const response=await fetch(`${origin}/api/notifications${path}`,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${await token(user)}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,data:await response.json()};
}
before(async()=>{
 await owner.connect();await owner.query(`CREATE SCHEMA ${schema}`);
 process.env.TEST_SCHEMA=schema;process.env.NODE_ENV='test';
 pool=(await import('../src/config/db.js')).default;
 const sql=await readFile(new URL('../db/schema.sql',import.meta.url),'utf8');
 await pool.query(sql);
 // Reapplying the migration must keep the existing inbox and triggers usable.
 await pool.query(sql);
 const hash=await bcrypt.hash('NotificationTest!2026',10);
 async function account(name,role){return (await pool.query('INSERT INTO usuarios(nombre,correo,contrasena_hash,rol) VALUES($1,$2,$3,$4) RETURNING *',[name,`${name}@notifications.local`,hash,role])).rows[0];}
 admin=await account('admin','admin');buyer=await account('buyer','comprador');seller=await account('seller','vendedor');
 const shop=(await pool.query("INSERT INTO vendedores(id_usuario,nombre_tienda) VALUES($1,'Tienda prueba') RETURNING *",[seller.id_usuario])).rows[0];
 const category=(await pool.query('SELECT id_categoria FROM categorias LIMIT 1')).rows[0];
 product=(await pool.query("INSERT INTO productos(id_vendedor,id_categoria,nombre,descripcion,precio,stock) VALUES($1,$2,'Olla de prueba','Una olla',50000,10) RETURNING *",[shop.id_vendedor,category.id_categoria])).rows[0];
 const app=(await import('../src/app.js')).default;
 server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 if(pool)await pool.end();
 await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await owner.end();
});

test('El historial requiere sesión y aísla las notificaciones por usuario',async()=>{
 assert.equal((await request('/')).status,401);
 const own=await inbox(buyer);
 assert.ok(own.notifications.some(item=>item.titulo.includes('Bienvenido')));
 assert.ok(own.notifications.every(item=>!('id_usuario' in item)));
 const otherNotice=(await inbox(seller)).notifications.find(item=>item.tipo==='tienda');
 assert.equal((await request(`/${otherNotice.id}/read`,buyer,{method:'PATCH'})).status,404);
 assert.equal((await inbox(seller)).notifications.find(item=>item.id===otherNotice.id).leida_en,null);
 assert.equal((await request('/?before=bad',buyer)).status,400);
 assert.equal((await request('/1%20OR%201=1/read',buyer,{method:'PATCH'})).status,400);
});

test('Pedidos, ventas y pagos generan avisos una sola vez por estado confirmado',async()=>{
 order=(await pool.query("INSERT INTO pedidos(id_usuario,total,direccion_entrega,metodo_pago) VALUES($1,50000,'Calle de prueba 123','CARD') RETURNING *",[buyer.id_usuario])).rows[0];
 for(let i=0;i<2;i++)await pool.query('INSERT INTO detalle_pedido(id_pedido,id_producto,nombre_producto,cantidad,precio_unitario,subtotal) VALUES($1,$2,$3,1,50000,50000)',[order.id_pedido,product.id_producto,product.nombre]);
 await pool.query("INSERT INTO pagos(id_pedido,monto,metodo_pago) VALUES($1,50000,'CARD')",[order.id_pedido]);
 assert.equal((await inbox(seller)).notifications.filter(item=>item.mensaje.includes(`#${order.id_pedido}`)&&item.tipo==='venta').length,1);
 await pool.query("UPDATE pedidos SET estado='pagado' WHERE id_pedido=$1",[order.id_pedido]);
 await pool.query("UPDATE pagos SET estado_pago='aprobado' WHERE id_pedido=$1",[order.id_pedido]);
 await pool.query("UPDATE pedidos SET estado='pagado' WHERE id_pedido=$1",[order.id_pedido]);
 await pool.query("UPDATE pagos SET estado_pago='aprobado' WHERE id_pedido=$1",[order.id_pedido]);
 assert.equal((await inbox(buyer)).notifications.filter(item=>item.titulo==='Pago confirmado').length,1);
 assert.equal((await inbox(buyer)).notifications.filter(item=>item.titulo==='Pedido pagado').length,1);
 assert.ok((await inbox(admin)).notifications.some(item=>item.tipo==='pedido'));
 for(const state of ['enviado','entregado'])await pool.query('UPDATE pedidos SET estado=$1 WHERE id_pedido=$2',[state,order.id_pedido]);
 assert.ok((await inbox(buyer)).notifications.some(item=>item.titulo==='Tu pedido está en camino'));
 assert.ok((await inbox(seller)).notifications.some(item=>item.titulo==='Pedido entregado'));
});

test('Las transacciones fallidas no dejan avisos de cambios que no ocurrieron',async()=>{
 const client=await pool.connect();
 const before=(await inbox(buyer)).notifications.length;
 try{await client.query('BEGIN');await client.query("UPDATE pedidos SET estado='cancelado' WHERE id_pedido=$1",[order.id_pedido]);await client.query('ROLLBACK');}finally{client.release();}
 assert.equal((await inbox(buyer)).notifications.length,before);
});

test('PQR, reseñas, inventario, favoritos y carrito notifican a sus destinatarios',async()=>{
 const pqr=(await pool.query("INSERT INTO pqr(id_usuario,tipo,asunto,descripcion) VALUES($1,'peticion','Consulta de envío','Necesito información del envío') RETURNING *",[buyer.id_usuario])).rows[0];
 await pool.query("UPDATE pqr SET respuesta='Tu compra se encuentra en camino',estado='resuelta' WHERE id_pqr=$1",[pqr.id_pqr]);
 assert.ok((await inbox(buyer)).notifications.some(item=>item.titulo==='Tienes una respuesta a tu PQR'));
 assert.ok((await inbox(admin)).notifications.some(item=>item.titulo==='Nueva PQR por atender'));
 await pool.query('INSERT INTO resenas_producto(id_usuario,id_producto,puntuacion,comentario) VALUES($1,$2,5,$3)',[buyer.id_usuario,product.id_producto,'Muy buena']);
 assert.ok((await inbox(seller)).notifications.some(item=>item.tipo==='resena'));
 await pool.query('INSERT INTO favoritos(id_usuario,id_producto) VALUES($1,$2)',[buyer.id_usuario,product.id_producto]);
 const cart=(await pool.query('INSERT INTO carritos(id_usuario) VALUES($1) RETURNING *',[buyer.id_usuario])).rows[0];
 await pool.query('INSERT INTO carrito_items(id_carrito,id_producto,cantidad) VALUES($1,$2,1)',[cart.id_carrito,product.id_producto]);
 await pool.query('UPDATE productos SET stock=4 WHERE id_producto=$1',[product.id_producto]);
 const lowCount=(await inbox(seller)).notifications.filter(item=>item.tipo==='inventario').length;
 await pool.query('UPDATE productos SET stock=3 WHERE id_producto=$1',[product.id_producto]);
 assert.equal((await inbox(seller)).notifications.filter(item=>item.tipo==='inventario').length,lowCount);
 await pool.query('UPDATE productos SET stock=0 WHERE id_producto=$1',[product.id_producto]);
 assert.ok((await inbox(buyer)).notifications.some(item=>item.tipo==='carrito'));
 await pool.query('UPDATE productos SET stock=10,precio=40000 WHERE id_producto=$1',[product.id_producto]);
 assert.ok((await inbox(buyer)).notifications.some(item=>item.tipo==='favoritos'));
});

test('Cambios de seguridad y verificación de tienda quedan guardados',async()=>{
 await pool.query("UPDATE usuarios SET contrasena_hash='changed-for-test',direccion='Nueva dirección' WHERE id_usuario=$1",[buyer.id_usuario]);
 await pool.query('UPDATE vendedores SET verificado=true WHERE id_usuario=$1',[seller.id_usuario]);
 assert.ok((await inbox(buyer)).notifications.some(item=>item.titulo==='Contraseña actualizada'));
 assert.ok((await inbox(buyer)).notifications.some(item=>item.titulo==='Perfil actualizado'));
 assert.ok((await inbox(seller)).notifications.some(item=>item.titulo==='Tu tienda fue verificada'));
});

test('Marcar leídas conserva eventos concurrentes y pagina sin repetir el historial',async()=>{
 const initial=await inbox(buyer),through=initial.notifications[0].id;
 const readId=initial.notifications[1].id;
 assert.equal((await request(`/${readId}/read`,buyer,{method:'PATCH'})).status,200);
 assert.equal((await inbox(buyer)).unread,initial.unread-1);
 await request(`/${readId}/read`,buyer,{method:'PATCH'});
 assert.equal((await inbox(buyer)).unread,initial.unread-1);
 await pool.query("SELECT avisar_usuario($1,'cuenta','Aviso concurrente','Prueba de concurrencia','/perfil')",[buyer.id_usuario]);
 await request('/read-all',buyer,{method:'PATCH',body:{through}});
 assert.equal((await inbox(buyer)).unread,1);
 assert.equal((await request('/read-all',buyer,{method:'PATCH',body:{through:'bad'}})).status,400);
 for(let i=0;i<45;i++)await pool.query("SELECT avisar_usuario($1,'cuenta','Historial','Aviso anterior','/perfil')",[buyer.id_usuario]);
 const page1=await inbox(buyer),page2=(await request(`/?before=${page1.nextCursor}`,buyer)).data;
 assert.equal(page1.notifications.length,40);assert.ok(page1.nextCursor);
 const ids=new Set(page1.notifications.map(item=>item.id));
 assert.ok(page2.notifications.length);assert.ok(page2.notifications.every(item=>!ids.has(item.id)));
});
