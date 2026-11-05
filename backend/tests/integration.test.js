import 'dotenv/config';
import { galleryForm } from './helpers/productFixture.js';
import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID,createHash } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
const schema=`test_${randomUUID().replaceAll('-','')}`;
const owner=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
let pool,server,origin,buyer,seller,other,admin,product,order;
const uploadedPhotos = new Set();
async function request(path,{token,body,method='GET'}={}){
 const multipart = path==='/seller/products' && method==='POST';
 const response=await fetch(`${origin}/api${path}`,{method,headers:{...(multipart?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`} : {})},...(body?{body:multipart?galleryForm(body):JSON.stringify(body)}:{})});
 const data = await response.json();
 if (data.product?.galeria) for (const url of data.product.galeria) if (url.startsWith('/uploads/')) uploadedPhotos.add(url);
 return {status:response.status,data};
}
async function register(rol,nombre){const result=await request(`/auth/register/${rol}`,{method:'POST',body:{nombre,apellido:'Prueba',correo:`${nombre}@pruebas.local`,password:'TestingPassword!2026',telefono:'3001234567',nombre_tienda:`Tienda ${nombre}`}});assert.equal(result.status,201,JSON.stringify(result.data));assert.ok(result.data.token);return result.data;}
before(async()=>{
 await owner.connect();await owner.query(`CREATE SCHEMA ${schema}`);
 process.env.TEST_SCHEMA=schema;process.env.NODE_ENV='test';process.env.PAYMENT_MODE='demo';process.env.IMAGE_STORAGE='local';
 process.env.OPENAI_API_KEY='';process.env.RESEND_API_KEY='';process.env.WOMPI_EVENTS_SECRET='';
 process.env.GMAIL_USER='';process.env.GMAIL_APP_PASSWORD='';
 pool=(await import('../src/config/db.js')).default;
 assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name,schema);
 await pool.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
 const app=(await import('../src/app.js')).default;
 server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{
 if(server) await new Promise(resolve=>server.close(resolve));
 const {removeUploadedImage}=await import('../src/services/images.js');
 await Promise.all([...uploadedPhotos].map(secure_url=>removeUploadedImage({secure_url})));
 if(pool)await pool.end();
 await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await owner.end();
});
test('Registro, validación y permisos por rol',async()=>{
 assert.equal((await request('/auth/register/buyer',{method:'POST',body:{nombre:'A',correo:'bad',password:'1'}})).status,400);
 buyer=await register('buyer','comprador');seller=await register('seller','artesano');other=await register('seller','otro');
 assert.equal((await request('/seller/products/mine',{token:buyer.token})).status,403);
 const hash=await bcrypt.hash('AdminTestPassword2026',10);
 await pool.query("INSERT INTO usuarios(nombre,correo,contrasena_hash,rol) VALUES('Admin','admin@test.local',$1,'admin')",[hash]);
 admin=(await request('/auth/login',{method:'POST',body:{correo:'admin@test.local',password:'AdminTestPassword2026'}})).data;assert.ok(admin.token);
 assert.equal((await request('/admin/dashboard',{token:buyer.token})).status,403);
 assert.equal((await request('/user/profile',{token:buyer.token})).data.user.rol,'comprador');
});
test('Crear producto, aislar inventario y validar edición',async()=>{
 const category=(await pool.query('SELECT id_categoria FROM categorias ORDER BY id_categoria LIMIT 1')).rows[0].id_categoria;
 const result=await request('/seller/products',{token:seller.token,method:'POST',body:{nombre:'Olla cerámica',descripcion:'Olla artesanal para cocinar',id_categoria:category,precio:65000,stock:5}});
 assert.equal(result.status,201,JSON.stringify(result.data));product=result.data.product;
 assert.equal((await request('/seller/products/mine',{token:other.token})).data.products.length,0);
 assert.equal((await request(`/seller/products/${product.id_producto}`,{token:other.token,method:'PUT',body:{stock:100}})).status,403);
 assert.equal((await request(`/seller/products/mine/${product.id_producto}`,{token:other.token})).status,404);
 assert.equal((await request(`/seller/products/${product.id_producto}`,{token:seller.token,method:'PUT',body:{stock:-1}})).status,400);
 assert.equal((await request('/seller/products')).data.products.length,1);
});
test('Carrito valida enteros y stock; favoritos se conservan',async()=>{
 assert.equal((await request('/cart/add',{token:buyer.token,method:'POST',body:{id_producto:product.id_producto,cantidad:1.5}})).status,400);
 assert.equal((await request('/cart/add',{token:buyer.token,method:'POST',body:{id_producto:product.id_producto,cantidad:2}})).status,200);
 const items=(await request('/cart',{token:buyer.token})).data.cart.items;
 await pool.query("UPDATE productos SET estado='Activo' WHERE id_producto=$1",[product.id_producto]);
 assert.equal((await request('/cart',{token:buyer.token})).data.cart.items[0].estado,'activo');
 await pool.query("UPDATE productos SET estado='activo' WHERE id_producto=$1",[product.id_producto]);
 assert.equal((await request(`/cart/item/${items[0].id_item}`,{token:buyer.token,method:'PUT',body:{cantidad:99}})).status,409);
 assert.equal((await request('/favorites',{token:buyer.token,method:'POST',body:{productId:product.id_producto}})).status,200);
 assert.equal((await request('/favorites',{token:buyer.token})).data.length,1);
});
test('El catálogo invalida su caché y emite el nuevo stock por SSE después del commit',async()=>{
 const before=(await request('/seller/products')).data;
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),6000);
 let reader;
 try {
  const response=await fetch(`${origin}/api/catalog/events`,{signal:controller.signal});
  assert.match(response.headers.get('content-type'),/text\/event-stream/);
  reader=response.body.getReader();
  const decoder=new TextDecoder();let buffer='';
  async function nextEvent(){
   while(!buffer.includes('\n\n')) {const chunk=await reader.read();if(chunk.done)throw new Error('Stream closed');buffer+=decoder.decode(chunk.value,{stream:true});}
   const end=buffer.indexOf('\n\n'),packet=buffer.slice(0,end);buffer=buffer.slice(end+2);
   const data=packet.split('\n').find(line=>line.startsWith('data: '));return data?JSON.parse(data.slice(6)):nextEvent();
  }
  await nextEvent();
  const transaction=await pool.connect();
  try{await transaction.query('BEGIN');await transaction.query('UPDATE productos SET stock=0 WHERE id_producto=$1',[product.id_producto]);await transaction.query('ROLLBACK');}finally{transaction.release();}
  assert.equal((await request('/seller/products')).data.revision,before.revision,'Un rollback no debe publicar stock ni invalidar el catálogo.');
  await pool.query('UPDATE productos SET stock=4 WHERE id_producto=$1',[product.id_producto]);
  const event=await nextEvent();assert.ok(Number(event.revision)>Number(before.revision));
  const after=(await request('/seller/products')).data;assert.equal(after.products[0].stock,4);assert.equal(after.revision,event.revision);
  // A detail refresh must not generate another inventory event or inflate views.
  const revision=after.revision;
  await request(`/seller/products/${product.id_producto}?view=0`);
  assert.equal((await request('/seller/products')).data.revision,revision);
  await pool.query('UPDATE productos SET stock=5 WHERE id_producto=$1',[product.id_producto]);
 }finally{clearTimeout(timeout);controller.abort();await reader?.cancel().catch(()=>{});}
});
test('Paginación del catálogo conserva metadatos y rechaza límites inválidos',async()=>{
 const data=(await request('/seller/products?page=1&pageSize=1')).data;
 assert.equal(data.pageSize,1);assert.equal(data.total,1);
 assert.equal((await request('/seller/products?page=1&pageSize=10000')).status,400);
});
test('Productos relacionados excluye el producto consultado y vendedores inactivos',async()=>{
 assert.equal((await request(`/seller/products/${product.id_producto}/related`)).data.products.length,0);
 await pool.query("UPDATE usuarios SET estado='inactivo' WHERE id_usuario=$1",[seller.user.id_usuario]);
 assert.equal((await request('/seller/products')).data.products.length,0);
 assert.equal((await request('/recommendations',{token:buyer.token})).data.products.length,0);
 await pool.query("UPDATE usuarios SET estado='activo' WHERE id_usuario=$1",[seller.user.id_usuario]);
 assert.equal((await request('/seller/products')).data.products.length,1);
});
test('Checkout calcula total en servidor y reintentos no duplican pedido ni stock',async()=>{
 const payload={direccion_entrega:'Calle 12 # 8-10, Cajicá',metodo_pago:'NEQUI',entrega:'envio',clave_idempotencia:randomUUID(),total:1};
 const results=await Promise.all([request('/orders',{token:buyer.token,method:'POST',body:payload}),request('/orders',{token:buyer.token,method:'POST',body:payload})]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);order=results[0].data.order;
 assert.equal(results[1].data.order.id_pedido,order.id_pedido);assert.equal(Number(order.total),142000);
 assert.equal((await pool.query('SELECT stock FROM productos WHERE id_producto=$1',[product.id_producto])).rows[0].stock,3);
 assert.equal((await request('/cart',{token:buyer.token})).data.cart.items.length,0);
 assert.equal((await request(`/orders/${order.id_pedido}`,{token:other.token})).status,404);
});
test('Pago demo, recibo e idempotencia en confirmaciones',async()=>{
 assert.equal((await request(`/payments/${order.id_pedido}/demo`,{token:buyer.token,method:'POST'})).status,200);
 assert.equal((await request(`/payments/${order.id_pedido}/demo`,{token:buyer.token,method:'POST'})).status,200);
 const data=(await request(`/orders/${order.id_pedido}`,{token:buyer.token})).data;
 assert.equal(data.order.estado,'pagado');assert.equal(data.payment.estado_pago,'aprobado');assert.equal(data.items.length,1);
 assert.equal((await pool.query('SELECT ventas FROM productos WHERE id_producto=$1',[product.id_producto])).rows[0].ventas,2);
 process.env.NODE_ENV='production';assert.equal((await request(`/payments/${order.id_pedido}/demo`,{token:buyer.token,method:'POST'})).status,404);process.env.NODE_ENV='test';
});
test('PQR: propietario consulta y administrador responde',async()=>{
 const result=await request('/pqr',{token:buyer.token,method:'POST',body:{tipo:'peticion',asunto:'Estado de entrega',descripcion:'Quisiera consultar el estado de entrega de mi pedido.'}});assert.equal(result.status,201);
 const id=result.data.request.id_pqr;
 assert.equal((await request('/pqr',{token:other.token})).data.requests.length,0);
 assert.equal((await request(`/pqr/${id}`,{token:buyer.token,method:'PATCH',body:{estado:'resuelta',respuesta:'Prueba'}})).status,403);
 assert.equal((await request(`/pqr/${id}`,{token:admin.token,method:'PATCH',body:{estado:'resuelta',respuesta:'Tu pedido será enviado mañana.'}})).status,200);
 assert.equal((await request('/pqr',{token:buyer.token})).data.requests[0].estado,'resuelta');
});
test('El límite de IA persiste y reserva cuota atómicamente con solicitudes concurrentes',async()=>{
 const {createChatHandler}=await import('../src/services/chat.js');
 await pool.query('DELETE FROM chat_ai_daily_usage');
 let providerCalls=0;
 const handler=createChatHandler({db:pool,env:{OPENAI_API_KEY:'fake-key-for-quota-test',CHAT_AI_DAILY_LIMIT:'2',PAYMENT_MODE:'demo'},reply:async()=>{providerCalls++;return {answer:'Respuesta de prueba'};}});
 const makeResponse=()=>({set(){},json(body){this.body=body;}});
 const responses=await Promise.all(Array.from({length:8},async()=>{const res=makeResponse();await handler({body:{message:'¿Qué productos hay?'}},res);return res.body;}));
 assert.equal(providerCalls,2);assert.equal(responses.filter(item=>item.mode==='ia').length,2);assert.equal(responses.filter(item=>item.fallbackReason==='daily_limit').length,6);
 const restarted=createChatHandler({db:pool,env:{OPENAI_API_KEY:'fake-key-for-quota-test',CHAT_AI_DAILY_LIMIT:'2'},reply:async()=>{throw Error('No debe haber otra llamada');}});
 const res=makeResponse();await restarted({body:{message:'Hola'}},res);assert.equal(res.body.fallbackReason,'daily_limit');
 assert.equal((await pool.query('SELECT solicitudes FROM chat_ai_daily_usage')).rows[0].solicitudes,2);
});

test('Marketplace, historial, recomendaciones y ayuda local',async()=>{
 assert.equal((await request('/marketplace')).data.sellers.length,2);
 assert.equal((await request('/history',{token:buyer.token,method:'POST',body:{id_producto:product.id_producto}})).status,200);
 assert.equal((await request('/recommendations',{token:buyer.token})).data.products[0].id_producto,product.id_producto);
 const chat=await request('/chat',{method:'POST',body:{message:'¿Cómo pago con Nequi?'}});assert.equal(chat.status,200);assert.equal(chat.data.mode,'ayuda_local');assert.match(chat.data.answer,/Nequi/);
});
test('Reportes por tienda y panel administrativo consultan datos reales',async()=>{
 for(const route of ['/admin/dashboard','/admin/reports','/admin/users','/admin/sellers','/admin/orders',`/admin/orders/${order.id_pedido}`]){const result=await request(route,{token:admin.token});assert.equal(result.status,200,`${route}: ${JSON.stringify(result.data)}`);}
 const summary=(await request('/seller/overview',{token:seller.token})).data;assert.equal(summary.orders.length,1);assert.equal(Number(summary.today.ingresos),130000);
 assert.equal((await request('/seller/overview',{token:other.token})).data.orders.length,0);
});
test('Cancelar pedido pendiente repone inventario una sola vez; pagos no se falsifican desde admin',async()=>{
 await request('/cart/add',{token:buyer.token,method:'POST',body:{id_producto:product.id_producto,cantidad:1}});
 const pending=(await request('/orders',{token:buyer.token,method:'POST',body:{direccion_entrega:'Calle 12 # 8-10, Cajicá',metodo_pago:'CARD',entrega:'recogida',clave_idempotencia:randomUUID()}})).data.order;
 assert.equal((await request(`/admin/orders/${pending.id_pedido}/status`,{token:admin.token,method:'PATCH',body:{estado:'pagado'}})).status,409);
 for(let i=0;i<2;i++) assert.equal((await request(`/admin/orders/${pending.id_pedido}/status`,{token:admin.token,method:'PATCH',body:{estado:'cancelado'}})).status,200);
 assert.equal((await pool.query('SELECT stock FROM productos WHERE id_producto=$1',[product.id_producto])).rows[0].stock,3);
 assert.equal((await request(`/payments/${pending.id_pedido}/demo`,{token:buyer.token,method:'POST'})).status,409);
});
test('Pago firmado: URL integra el total e ignora eventos con firma falsa',async()=>{
 process.env.PAYMENT_MODE='wompi';process.env.WOMPI_PUBLIC_KEY='pub_test_example';process.env.WOMPI_PRIVATE_KEY='prv_test_example';process.env.WOMPI_INTEGRITY_SECRET='test_secret';process.env.WOMPI_EVENTS_SECRET='events_secret';
 await request('/cart/add',{token:buyer.token,method:'POST',body:{id_producto:product.id_producto,cantidad:1}});
 const pending=(await request('/orders',{token:buyer.token,method:'POST',body:{direccion_entrega:'Calle 12 # 8-10, Cajicá',metodo_pago:'PSE',entrega:'recogida',clave_idempotencia:randomUUID()}})).data.order;
 const session=await request(`/payments/${pending.id_pedido}/session`,{token:buyer.token,method:'POST'});assert.equal(session.status,200);
 const url=new URL(session.data.url);assert.equal(url.searchParams.get('amount-in-cents'),'6500000');
 assert.equal(url.searchParams.get('signature:integrity'),createHash('sha256').update(`${pending.referencia}6500000COPtest_secret`).digest('hex'));
 assert.equal((await request('/payments/wompi/events',{method:'POST',body:{timestamp:123,signature:{properties:['transaction.status'],checksum:'0'.repeat(64)},data:{transaction:{status:'APPROVED'}}}})).status,401);
 await request(`/admin/orders/${pending.id_pedido}/status`,{token:admin.token,method:'PATCH',body:{estado:'cancelado'}});process.env.PAYMENT_MODE='demo';
});
test('Eliminación lógica mantiene los comprobantes y oculta el catálogo',async()=>{
 assert.equal((await request(`/seller/products/${product.id_producto}`,{token:seller.token,method:'DELETE'})).status,200);
 assert.equal((await request('/seller/products')).data.products.length,0);
 assert.equal((await request('/admin/products',{token:admin.token})).data.products.length,0);
 assert.equal((await request(`/orders/${order.id_pedido}`,{token:buyer.token})).data.items[0].nombre,'Olla cerámica');
});
test('Dos compradores no pueden comprar simultáneamente la última unidad',async()=>{
 const category=(await pool.query('SELECT id_categoria FROM categorias LIMIT 1')).rows[0].id_categoria;
 const limited=(await request('/seller/products',{token:seller.token,method:'POST',body:{nombre:'Última unidad',descripcion:'Producto limitado de prueba',precio:1000,stock:1,id_categoria:category,material:'Cerámica'}})).data.product;
 for(const account of [seller,other]) await request('/cart/add',{token:account.token,method:'POST',body:{id_producto:limited.id_producto,cantidad:1}});
 const results=await Promise.all([seller,other].map(account=>request('/orders',{token:account.token,method:'POST',body:{direccion_entrega:'Calle 20 # 10-20, Cajicá',metodo_pago:'CARD',entrega:'recogida',clave_idempotencia:randomUUID()}})));
 assert.deepEqual(results.map(result=>result.status).sort(),[201,409]);
 assert.equal((await pool.query('SELECT stock FROM productos WHERE id_producto=$1',[limited.id_producto])).rows[0].stock,0);
});
test('Una imagen falsa no se acepta como foto de producto',async()=>{
 const form=new FormData();form.append('imagen',new Blob(['not a png'],{type:'image/png'}),'fake.png');
 form.append('nombre','Imagen falsa');form.append('descripcion','Este producto no debe crearse');form.append('precio','1000');form.append('stock','1');
 const category=(await pool.query('SELECT id_categoria FROM categorias LIMIT 1')).rows[0].id_categoria;form.append('id_categoria',String(category));
 const response=await fetch(`${origin}/api/seller/products`,{method:'POST',headers:{Authorization:`Bearer ${seller.token}`},body:form});assert.equal(response.status,400);
});
test('Recuperación de contraseña usa token con expiración y un solo uso',async()=>{
 const token=randomUUID();await pool.query("INSERT INTO password_resets(id_usuario,token_hash,expira,version_cuenta,correo_cuenta) SELECT id_usuario,$2,now()+interval '10 minutes',token_version,correo FROM usuarios WHERE id_usuario=$1",[other.user.id_usuario,createHash('sha256').update(token).digest('hex')]);
 assert.equal((await request('/auth/reset-password',{method:'POST',body:{token,password:'AnotherPassword2026!'}})).status,200);
 assert.equal((await request('/auth/reset-password',{method:'POST',body:{token,password:'AnotherPassword2026!'}})).status,400);
 assert.equal((await request('/user/profile',{token:other.token})).status,401);
});
test('Cambiar contraseña revoca sesión; recuperación informa falta de correo configurado',async()=>{
 assert.equal((await request('/auth/change-password',{token:buyer.token,method:'POST',body:{actual:'TestingPassword!2026',nueva:'UpdatedPassword!2026'}})).status,200);
 assert.equal((await request('/user/profile',{token:buyer.token})).status,401);
 assert.equal((await request('/auth/forgot-password',{method:'POST',body:{correo:'comprador@pruebas.local'}})).status,503);
});
