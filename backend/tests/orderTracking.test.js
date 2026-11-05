import 'dotenv/config';
import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { fixtureToken } from './helpers/authFixture.js';

const schema=`test_tracking_${randomUUID().replaceAll('-','')}`;
const owner=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
let db,server,origin,buyer,other,admin,seller,product,settlePayment;
const token=user=>fixtureToken(db,user);
async function request(path,{user=buyer,method='GET',body}={}){const response=await fetch(`${origin}/api${path}`,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${await token(user)}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
before(async()=>{
 await owner.connect();await owner.query(`CREATE SCHEMA ${schema}`);
 Object.assign(process.env,{TEST_SCHEMA:schema,NODE_ENV:'test',PAYMENT_MODE:'demo',OPENAI_API_KEY:'',GMAIL_USER:'',GMAIL_APP_PASSWORD:''});
 db=(await import('../src/config/db.js')).default;
 await db.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
 ({settlePayment}=await import('../src/services/orders.js'));
 const account=async(name,role)=>(await db.query('INSERT INTO usuarios(nombre,correo,contrasena_hash,rol) VALUES($1,$2,$3,$4) RETURNING *',[name,`${name}@tracking.local`,'unused-fixture-hash',role])).rows[0];
 buyer=await account('buyer','comprador');other=await account('other','comprador');seller=await account('seller','vendedor');admin=await account('admin','admin');
 const shop=(await db.query("INSERT INTO vendedores(id_usuario,nombre_tienda) VALUES($1,'Tienda de seguimiento') RETURNING *",[seller.id_usuario])).rows[0];
 const category=(await db.query('SELECT id_categoria FROM categorias LIMIT 1')).rows[0];
 product=(await db.query("INSERT INTO productos(id_vendedor,id_categoria,nombre,descripcion,precio,stock) VALUES($1,$2,'Olla para seguimiento','Prueba local',25000,100) RETURNING *",[shop.id_vendedor,category.id_categoria])).rows[0];
 const app=(await import('../src/app.js')).default;server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(db)await db.end();await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await owner.end();});
async function createOrder(user=buyer,delivery='envio'){
 assert.equal((await request('/cart/add',{user,method:'POST',body:{id_producto:product.id_producto,cantidad:1}})).status,200);
 const result=await request('/orders',{user,method:'POST',body:{direccion_entrega:delivery==='recogida'?'Recogida en tienda, Cajicá':'Calle de prueba 123, Cajicá',metodo_pago:'CARD',entrega:delivery,clave_idempotencia:randomUUID()}});
 assert.equal(result.status,201,JSON.stringify(result.data));return result.data.order;
}
async function paidOrder(delivery='envio'){const order=await createOrder(buyer,delivery);await settlePayment({id:`demo-${order.id_pedido}`,reference:order.referencia,currency:'COP',amount_in_cents:Math.round(Number(order.total)*100),status:'APPROVED'},{environment:'demo'});return order;}
const detail=async order=>(await request(`/orders/${order.id_pedido}`)).data;
const historyCount=async order=>(await db.query('SELECT COUNT(*)::int AS count FROM pedido_historial WHERE id_pedido=$1',[order.id_pedido])).rows[0].count;
const noticeCount=async()=>(await db.query('SELECT COUNT(*)::int AS count FROM notificaciones WHERE id_usuario=$1',[buyer.id_usuario])).rows[0].count;
const delivery={transportadora:'Transportadora de prueba',guia:'PRUEBA-123',fecha_estimada:'2026-11-05',nota_entrega:'Datos ficticios de entrega.'};

test('Listado y detalle aíslan pedidos, incluyen productos y permiten búsqueda y filtros',async()=>{
 const own=await createOrder(),foreign=await createOrder(other);
 const list=await request('/orders?q='+encodeURIComponent(own.referencia));assert.equal(list.status,200);assert.equal(list.data.pagination.total,1);
 assert.equal(list.data.orders[0].id_pedido,own.id_pedido);assert.equal(list.data.orders[0].productos[0].nombre,'Olla para seguimiento');assert.equal(list.data.orders[0].tipo_entrega,'envio');
 assert.equal((await request(`/orders/${foreign.id_pedido}`)).status,404);
 assert.equal((await request('/orders?q='+encodeURIComponent(foreign.referencia))).data.orders.length,0);
 assert.equal((await request('/orders?estado=pagado')).data.orders.length,0);
 for(const path of ['/orders?estado=unknown','/orders?page=0','/orders?page=abc','/orders?q='+('x'.repeat(121))])assert.equal((await request(path)).status,400);
});

test('La paginación y el conteo corresponden al filtro completo, sin repetir pedidos',async()=>{
 const prefix=`PAGE-${randomUUID()}`;
 await db.query("INSERT INTO pedidos(id_usuario,total,direccion_entrega,metodo_pago,referencia) SELECT $1,1000,'Dirección de prueba','CARD',$2 || n FROM generate_series(1,13) n",[buyer.id_usuario,prefix]);
 const first=(await request(`/orders?q=${prefix}&page=1`)).data,second=(await request(`/orders?q=${prefix}&page=2`)).data;
 assert.equal(first.pagination.total,13);assert.equal(first.orders.length,12);assert.equal(second.orders.length,1);assert.equal(new Set([...first.orders,...second.orders].map(item=>item.id_pedido)).size,13);
});

test('Solo administración guarda datos de entrega y repetir lo mismo no duplica historial ni avisos',async()=>{
 const order=await paidOrder(),path=`/admin/orders/${order.id_pedido}/delivery`;
 for(const user of [buyer,seller,other])assert.equal((await request(path,{user,method:'PATCH',body:delivery})).status,403);
 const before=await historyCount(order),notices=await noticeCount();
 const result=await request(path,{user:admin,method:'PATCH',body:delivery});assert.equal(result.status,200,JSON.stringify(result.data));
 assert.equal((await detail(order)).order.guia,'PRUEBA-123');assert.equal(await historyCount(order),before+1);assert.equal(await noticeCount(),notices+1);
 assert.equal((await request(path,{user:admin,method:'PATCH',body:delivery})).status,200);assert.equal(await historyCount(order),before+1);assert.equal(await noticeCount(),notices+1);
 const adminDetail=(await request(`/admin/orders/${order.id_pedido}`,{user:admin})).data;assert.equal(adminDetail.order.guia,'PRUEBA-123');assert.equal(adminDetail.history.length,before+1);
 assert.equal((await request('/admin/orders',{user:admin})).status,200);
});

test('Campos inválidos, pendientes y pedidos finalizados no reciben cambios de entrega',async()=>{
 const pending=await createOrder();assert.equal((await request(`/admin/orders/${pending.id_pedido}/delivery`,{user:admin,method:'PATCH',body:delivery})).status,409);
 const order=await paidOrder(),path=`/admin/orders/${order.id_pedido}/delivery`;
 for(const body of [{...delivery,fecha_estimada:'2026-02-30'},{...delivery,guia:123},{...delivery,transportadora:''},{...delivery,nota_entrega:'x'.repeat(1001)}])assert.equal((await request(path,{user:admin,method:'PATCH',body})).status,400);
 assert.equal((await request(`/admin/orders/${order.id_pedido}/status`,{user:admin,method:'PATCH',body:{estado:'empacando'}})).status,200);
 assert.equal((await request(`/admin/orders/${order.id_pedido}/status`,{user:admin,method:'PATCH',body:{estado:'enviado'}})).status,200);
 assert.equal((await request(`/admin/orders/${order.id_pedido}/status`,{user:admin,method:'PATCH',body:{estado:'entregado'}})).status,200);
 assert.equal((await request(path,{user:admin,method:'PATCH',body:delivery})).status,409);
});

test('Recogida utiliza instrucciones y notifica cuando está lista, sin inventar un envío',async()=>{
 const order=await paidOrder('recogida'),path=`/admin/orders/${order.id_pedido}/delivery`;
 assert.equal((await request(path,{user:admin,method:'PATCH',body:delivery})).status,400);
 assert.equal((await request(path,{user:admin,method:'PATCH',body:{nota_entrega:'Punto de prueba, horario de 9 a 12.',fecha_estimada:'2026-11-05'}})).status,200);
 assert.equal((await request(`/admin/orders/${order.id_pedido}/status`,{user:admin,method:'PATCH',body:{estado:'empacando'}})).status,200);
 assert.equal((await request(`/admin/orders/${order.id_pedido}/status`,{user:admin,method:'PATCH',body:{estado:'enviado'}})).status,200);
 const notice=(await db.query("SELECT titulo FROM notificaciones WHERE id_usuario=$1 AND clave_evento=$2",[buyer.id_usuario,`pedido:${order.id_pedido}:enviado`])).rows[0];assert.match(notice.titulo,/listo para recoger/);
 assert.equal((await detail(order)).order.transportadora,null);
});

test('Las transiciones conservan historial una sola vez y el rollback no deja movimientos',async()=>{
 const order=await paidOrder();
 assert.equal((await request(`/admin/orders/${order.id_pedido}/status`,{user:admin,method:'PATCH',body:{estado:'empacando'}})).status,200);
 const before=await historyCount(order);
 for(let i=0;i<2;i++)assert.equal((await request(`/admin/orders/${order.id_pedido}/status`,{user:admin,method:'PATCH',body:{estado:'enviado'}})).status,200);
 assert.equal(await historyCount(order),before+1);
 const client=await db.connect();try{await client.query('BEGIN');await client.query("UPDATE pedidos SET estado='entregado' WHERE id_pedido=$1",[order.id_pedido]);await client.query('ROLLBACK');}finally{client.release();}
 assert.equal(await historyCount(order),before+1);assert.equal((await detail(order)).order.estado,'enviado');
 await db.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));assert.equal(await historyCount(order),before+1);
});

test('Empacando mantiene el pago, exige permisos, registra un único aviso y evita saltos',async()=>{
 const order=await paidOrder(),path=`/admin/orders/${order.id_pedido}/status`,before=await historyCount(order);
 assert.equal((await request(path,{user:admin,method:'PATCH',body:{estado:'enviado'}})).status,409);
 assert.equal((await request(path,{user:buyer,method:'PATCH',body:{estado:'empacando'}})).status,403);
 for(let i=0;i<2;i++)assert.equal((await request(path,{user:admin,method:'PATCH',body:{estado:'empacando'}})).status,200);
 assert.equal(await historyCount(order),before+1);
 const notice=(await db.query('SELECT COUNT(*)::int count FROM notificaciones WHERE id_usuario=$1 AND clave_evento=$2',[buyer.id_usuario,`pedido:${order.id_pedido}:empacando`])).rows[0];assert.equal(notice.count,1);
 assert.equal((await request('/orders?estado=empacando')).data.orders.some(row=>row.id_pedido===order.id_pedido),true);
 assert.equal((await request(`/admin/orders/${order.id_pedido}/delivery`,{user:admin,method:'PATCH',body:delivery})).status,200);
 const salesBefore=(await db.query('SELECT ventas FROM productos WHERE id_producto=$1',[product.id_producto])).rows[0].ventas;
 await settlePayment({id:`demo-${order.id_pedido}`,reference:order.referencia,currency:'COP',amount_in_cents:Math.round(Number(order.total)*100),status:'APPROVED'},{environment:'demo'});
 assert.equal((await detail(order)).order.estado,'empacando');assert.equal((await detail(order)).payment.estado_pago,'aprobado');
 assert.equal((await db.query('SELECT ventas FROM productos WHERE id_producto=$1',[product.id_producto])).rows[0].ventas,salesBefore);
 assert.equal((await request(path,{user:admin,method:'PATCH',body:{estado:'entregado'}})).status,409);
 assert.equal((await request(path,{user:admin,method:'PATCH',body:{estado:'enviado'}})).status,200);
 assert.equal((await request(path,{user:admin,method:'PATCH',body:{estado:'entregado'}})).status,200);
});


test('La planilla del vendedor protege el destinatario hasta el pago y abre sus avisos al pedido',async()=>{
 const order=await createOrder(),path=`/seller/orders/${order.id_pedido}`;
 assert.equal((await request(path,{user:null})).status,401);
 assert.equal((await request(path,{user:buyer})).status,403);
 const pending=await request(path,{user:seller});assert.equal(pending.status,200);
 assert.equal(pending.data.recipient,null);assert.equal(pending.data.dispatchAllowed,false);
 assert.equal(JSON.stringify(pending.data).includes('Calle de prueba 123'),false);
 assert.equal(pending.data.items.length,1);assert.equal(pending.data.total,25000);
 const pendingNotice=(await db.query('SELECT destino FROM notificaciones WHERE id_usuario=$1 AND clave_evento=$2',[seller.id_usuario,`pedido:${order.id_pedido}:pendiente`])).rows[0];
 assert.equal(pendingNotice.destino,`/vendedor/pedido/${order.id_pedido}`);
 await settlePayment({id:`demo-${order.id_pedido}`,reference:order.referencia,currency:'COP',amount_in_cents:Math.round(Number(order.total)*100),status:'APPROVED'},{environment:'demo'});
 const paid=await request(path,{user:seller});assert.equal(paid.data.dispatchAllowed,true);
 assert.equal(paid.data.recipient.direccion,'Calle de prueba 123, Cajicá');assert.equal(paid.data.seller.nombre_tienda,'Tienda de seguimiento');
 assert.equal(paid.data.order.ambiente,'demo');assert.equal(paid.data.history.at(-1).estado,'pagado');
 assert.equal(paid.data.order.transaccion,undefined);assert.equal(paid.data.order.total,undefined);
 await request(`/admin/orders/${order.id_pedido}/delivery`,{user:admin,method:'PATCH',body:delivery});
 const notice=(await db.query("SELECT destino FROM notificaciones WHERE id_usuario=$1 AND titulo='Entrega del pedido actualizada' ORDER BY id DESC LIMIT 1",[seller.id_usuario])).rows[0];assert.equal(notice.destino,`/vendedor/pedido/${order.id_pedido}`);
});

test('Una compra con varias tiendas mantiene productos y totales separados en cada planilla',async()=>{
 const outsider=(await db.query("INSERT INTO usuarios(nombre,correo,contrasena_hash,rol) VALUES('Segundo vendedor','segundo@tracking.local','unused','vendedor') RETURNING *")).rows[0];
 const shop=(await db.query("INSERT INTO vendedores(id_usuario,nombre_tienda) VALUES($1,'Segunda tienda') RETURNING *",[outsider.id_usuario])).rows[0];
 const extra=(await db.query("INSERT INTO productos(id_vendedor,id_categoria,nombre,descripcion,precio,stock) VALUES($1,$2,'Producto exclusivo de otra tienda','Prueba',90000,10) RETURNING *",[shop.id_vendedor,product.id_categoria])).rows[0];
 const order=await createOrder();
 assert.equal((await request(`/seller/orders/${order.id_pedido}`,{user:outsider})).status,404);
 await db.query('INSERT INTO detalle_pedido(id_pedido,id_producto,nombre_producto,cantidad,precio_unitario,subtotal) VALUES($1,$2,$3,2,90000,180000)',[order.id_pedido,extra.id_producto,extra.nombre]);
 await db.query('UPDATE pedidos SET total=total+180000 WHERE id_pedido=$1',[order.id_pedido]);
 const first=(await request(`/seller/orders/${order.id_pedido}`,{user:seller})).data;
 const second=(await request(`/seller/orders/${order.id_pedido}`,{user:outsider})).data;
 assert.equal(first.items.length,1);assert.equal(first.total,25000);assert.equal(first.order.varias_tiendas,true);
 assert.equal(second.items.length,1);assert.equal(second.total,180000);
 assert.equal(first.items[0].id_producto,product.id_producto);assert.equal(second.items[0].id_producto,extra.id_producto);
 assert.equal(JSON.stringify(first).includes(extra.nombre),false);
 assert.equal((await request('/seller/orders/not-an-id',{user:seller})).status,400);
 assert.equal((await request('/seller/orders/2147483647',{user:seller})).status,404);
});

test('Recogida usa su propia planilla y un pedido cancelado bloquea datos de despacho',async()=>{
 const order=await paidOrder('recogida');
 const pickup=(await request(`/seller/orders/${order.id_pedido}`,{user:seller})).data;
 assert.equal(pickup.recipient.direccion,null);assert.equal(pickup.order.tipo_entrega,'recogida');
 const pending=await createOrder();
 assert.equal((await request(`/admin/orders/${pending.id_pedido}/status`,{user:admin,method:'PATCH',body:{estado:'cancelado'}})).status,200);
 const cancelled=(await request(`/seller/orders/${pending.id_pedido}`,{user:seller})).data;
 assert.equal(cancelled.dispatchAllowed,false);assert.equal(cancelled.recipient,null);
});
