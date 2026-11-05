import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { wompiSettings, wompiRedirectUrl } from '../src/services/wompi.js';

const schema=`test_wompi_${randomUUID().replaceAll('-','')}`;
const owner=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
const networkFetch=globalThis.fetch, transactions=new Map(), providerCalls=[];
let db,server,origin,buyer,outsider,product;
const token=user=>jwt.sign({id_usuario:user.id_usuario,version:0},process.env.JWT_SECRET,{expiresIn:'1h'});
async function request(path,{user=buyer,body,method='GET'}={}){
 const response=await networkFetch(`${origin}/api${path}`,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${token(user)}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,data:await response.json()};
}
before(async()=>{
 await owner.connect();await owner.query(`CREATE SCHEMA ${schema}`);
 Object.assign(process.env,{TEST_SCHEMA:schema,NODE_ENV:'test',PAYMENT_MODE:'wompi',WOMPI_ENVIRONMENT:'test',WOMPI_PUBLIC_KEY:'pub_test_fixture',WOMPI_PRIVATE_KEY:'prv_test_fixture',WOMPI_INTEGRITY_SECRET:'fixture-integrity-only',WOMPI_EVENTS_SECRET:'fixture-events-only',OPENAI_API_KEY:''});
 db=(await import('../src/config/db.js')).default;
 await db.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
 const account=async(name,role)=>(await db.query('INSERT INTO usuarios(nombre,correo,contrasena_hash,rol) VALUES($1,$2,$3,$4) RETURNING *',[name,`${name}@wompi.local`,'unused-fixture-hash',role])).rows[0];
 buyer=await account('buyer','comprador');outsider=await account('outsider','comprador');
 const seller=await account('seller','vendedor');
 const shop=(await db.query("INSERT INTO vendedores(id_usuario,nombre_tienda) VALUES($1,'Tienda Wompi de prueba') RETURNING *",[seller.id_usuario])).rows[0];
 const category=(await db.query('SELECT id_categoria FROM categorias LIMIT 1')).rows[0];
 product=(await db.query("INSERT INTO productos(id_vendedor,id_categoria,nombre,descripcion,precio,stock) VALUES($1,$2,'Olla de prueba','Solo fixture',25000,20) RETURNING *",[shop.id_vendedor,category.id_categoria])).rows[0];
 globalThis.fetch=async(url,options)=>{
  if(String(url).startsWith('https://sandbox.wompi.co/v1/transactions/')){
   assert.equal(options.headers.Authorization,'Bearer prv_test_fixture');
   const id=String(url).split('/').at(-1);providerCalls.push(id);
   return new Response(JSON.stringify({data:transactions.get(id)}),{status:transactions.has(id)?200:404,headers:{'Content-Type':'application/json'}});
  }
  throw Error('Las pruebas no permiten llamadas externas');
 };
 const app=(await import('../src/app.js')).default;
 server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{
 globalThis.fetch=networkFetch;
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 if(db)await db.end();await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await owner.end();
});
async function newOrder(){
 assert.equal((await request('/cart/add',{method:'POST',body:{id_producto:product.id_producto,cantidad:1}})).status,200);
 const result=await request('/orders',{method:'POST',body:{direccion_entrega:'Calle de pruebas 123, Cajicá',metodo_pago:'PSE',entrega:'recogida',clave_idempotencia:randomUUID()}});
 assert.equal(result.status,201,JSON.stringify(result.data));return result.data.order;
}
const stock=async()=>(await db.query('SELECT stock FROM productos WHERE id_producto=$1',[product.id_producto])).rows[0].stock;
const verify=(order,id,user=buyer)=>request(`/payments/${order.id_pedido}/verify`,{method:'POST',user,body:id?{transactionId:id}:{}});
const transaction=(order,status,id=`tx-${randomUUID()}`)=>({id,reference:order.referencia,currency:'COP',amount_in_cents:Math.round(Number(order.total)*100),status,payment_method_type:'CARD'});
function signedEvent(value){
 const event={event:'transaction.updated',environment:'test',timestamp:1800000000,data:{transaction:value},signature:{properties:['transaction.id','transaction.status','transaction.amount_in_cents']}};
 event.signature.checksum=createHash('sha256').update(`${value.id}${value.status}${value.amount_in_cents}${event.timestamp}${process.env.WOMPI_EVENTS_SECRET}`).digest('hex');return event;
}

test('Configuración separa ambientes y bloquea demo en producción',()=>{
 assert.equal(wompiSettings({PAYMENT_MODE:'demo',NODE_ENV:'production'}).mode,'wompi');
 assert.equal(wompiSettings({WOMPI_ENVIRONMENT:'test',WOMPI_PUBLIC_KEY:'pub_prod_wrong',WOMPI_INTEGRITY_SECRET:'x',WOMPI_EVENTS_SECRET:'y'}).configured,false);
});

test('La redirección externa excluye localhost y mantiene los destinos HTTPS publicados',()=>{
 for(const frontend of ['http://localhost:5173','https://localhost:5173','http://127.0.0.1:5173','https://app.localhost','invalid'])assert.equal(wompiRedirectUrl(frontend,7),undefined);
 assert.equal(wompiRedirectUrl('https://tienda.example.com',7),'https://tienda.example.com/pedido/7');
});

test('La URL firmada usa el total del servidor y nunca expone secretos',async()=>{
 const order=await newOrder();const result=await request(`/payments/${order.id_pedido}/session`,{method:'POST'});
 assert.equal(result.status,200);const url=new URL(result.data.url);
 assert.equal(url.origin,'https://checkout.wompi.co');assert.equal(url.searchParams.get('amount-in-cents'),'2500000');
 assert.equal(url.searchParams.get('signature:integrity'),createHash('sha256').update(`${order.referencia}2500000COPfixture-integrity-only`).digest('hex'));
 assert.ok(!result.data.url.includes(process.env.WOMPI_INTEGRITY_SECRET));
 assert.ok(!JSON.stringify(result.data).includes(process.env.WOMPI_PRIVATE_KEY));
 assert.equal(url.searchParams.has('redirect-url'),false);
 assert.equal(result.data.checkout.reference,order.referencia);assert.equal(result.data.checkout.amountInCents,2500000);assert.equal(result.data.checkout.redirectUrl,undefined);
 const config=(await request('/payments/config')).data;assert.equal(config.environment,'test');assert.equal(config.configured,true);assert.ok(!JSON.stringify(config).includes('fixture'));
});

test('El regreso no acepta pagos ajenos, importes falsos, monedas distintas ni identificadores inyectados',async()=>{
 const order=await newOrder(),before=await stock();
 let value=transaction(order,'APPROVED');transactions.set(value.id,{...value,reference:'OTHER-REFERENCE'});assert.equal((await verify(order,value.id)).status,400);
 transactions.set(value.id,{...value,amount_in_cents:1});assert.equal((await verify(order,value.id)).status,400);
 transactions.set(value.id,{...value,currency:'USD'});assert.equal((await verify(order,value.id)).status,400);
 const calls=providerCalls.length;assert.equal((await verify(order,value.id,outsider)).status,404);assert.equal(providerCalls.length,calls);
 assert.equal((await verify(order,'https://evil.example/')).status,400);
 assert.equal((await verify(order,'missing-id')).status,404);
 assert.equal((await request(`/orders/${order.id_pedido}`)).data.order.estado,'pendiente');assert.equal(await stock(),before);
});

test('Una aprobación verificada confirma recibo y medio real sin duplicar stock ni notificaciones',async()=>{
 const order=await newOrder(),before=await stock(),value=transaction(order,'APPROVED');transactions.set(value.id,value);
 assert.equal((await verify(order,value.id)).data.status,'APPROVED');
 const detail=(await request(`/orders/${order.id_pedido}`)).data;
 assert.equal(detail.order.estado,'pagado');assert.equal(detail.order.metodo_pago,'CARD');assert.equal(detail.payment.ambiente,'test');assert.equal(detail.payment.transaccion,value.id);
 const notices=(await db.query('SELECT COUNT(*)::int AS count FROM notificaciones WHERE id_usuario=$1',[buyer.id_usuario])).rows[0].count;
 assert.equal((await verify(order,value.id)).status,200);assert.equal(await stock(),before);
 assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM notificaciones WHERE id_usuario=$1',[buyer.id_usuario])).rows[0].count,notices);
});

test('Pendiente conserva la reserva, impide otro checkout y se reconcilia por webhook firmado',async()=>{
 const order=await newOrder(),value=transaction(order,'PENDING'),before=await stock();transactions.set(value.id,value);
 assert.equal((await verify(order,value.id)).data.status,'PENDING');assert.equal(await stock(),before);
 assert.equal((await request(`/orders/${order.id_pedido}`)).data.payment.transaccion,value.id);
 assert.equal((await request(`/payments/${order.id_pedido}/session`,{method:'POST'})).status,409);
 transactions.set(value.id,{...value,status:'APPROVED'});
 const event=signedEvent(value);
 assert.equal((await request('/payments/wompi/events',{user:null,method:'POST',body:event})).status,200);
 assert.equal((await request('/payments/wompi/events',{user:null,method:'POST',body:event})).status,200);
 assert.equal((await request(`/orders/${order.id_pedido}`)).data.order.estado,'pagado');assert.equal(await stock(),before);
});

test('Rechazo, error y anulación liberan stock una sola vez',async()=>{
 for(const status of ['DECLINED','ERROR','VOIDED']){
  const before=await stock(),order=await newOrder(),value=transaction(order,status);transactions.set(value.id,value);
  assert.equal(await stock(),before-1);assert.equal((await verify(order,value.id)).status,200);assert.equal(await stock(),before);
  assert.equal((await verify(order,value.id)).status,200);assert.equal(await stock(),before);
  const detail=(await request(`/orders/${order.id_pedido}`)).data;assert.equal(detail.order.estado,'cancelado');assert.equal(detail.payment.estado_pago,'rechazado');assert.equal(detail.receiptAllowed,false);assert.equal(detail.receiptState,'rejected');
 }
});

test('Firmas falsas y cambio de ambiente no realizan confirmaciones',async()=>{
 const order=await newOrder(),value=transaction(order,'APPROVED'),event=signedEvent(value),calls=providerCalls.length;
 event.signature.checksum='0'.repeat(64);
 assert.equal((await request('/payments/wompi/events',{user:null,method:'POST',body:event})).status,401);assert.equal(providerCalls.length,calls);
 process.env.WOMPI_ENVIRONMENT='prod';process.env.WOMPI_PUBLIC_KEY='pub_prod_fixture';process.env.WOMPI_PRIVATE_KEY='prv_prod_fixture';
 try {assert.equal((await verify(order,value.id)).status,409);assert.equal((await request(`/payments/${order.id_pedido}/session`,{method:'POST'})).status,409);}finally{process.env.WOMPI_ENVIRONMENT='test';process.env.WOMPI_PUBLIC_KEY='pub_test_fixture';process.env.WOMPI_PRIVATE_KEY='prv_test_fixture';}
});


test('Un estado logístico pagado nunca habilita recibo con pago rechazado o datos contradictorios',async()=>{
 const order=await newOrder();
 await db.query("UPDATE pedidos SET estado='pagado' WHERE id_pedido=$1",[order.id_pedido]);
 await db.query("UPDATE pagos SET estado_pago='rechazado',transaccion='tx-rejected-fixture' WHERE id_pedido=$1",[order.id_pedido]);
 let detail=(await request(`/orders/${order.id_pedido}`)).data;
 assert.equal(detail.order.estado,'pagado');assert.equal(detail.receiptAllowed,false);assert.equal(detail.receiptState,'rejected');
 await db.query("UPDATE pagos SET estado_pago='aprobado',monto=monto+1 WHERE id_pedido=$1",[order.id_pedido]);
 detail=(await request(`/orders/${order.id_pedido}`)).data;assert.equal(detail.receiptAllowed,false);assert.equal(detail.receiptState,'unverified');
 await db.query("UPDATE pagos SET monto=monto-1 WHERE id_pedido=$1",[order.id_pedido]);
 detail=(await request(`/orders/${order.id_pedido}`)).data;assert.equal(detail.receiptAllowed,true);assert.equal(detail.receiptState,'confirmed');
});
