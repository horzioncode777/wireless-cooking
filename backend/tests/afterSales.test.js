import 'dotenv/config';
import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { fixtureToken } from './helpers/authFixture.js';
const schema=`test_postventa_${randomUUID().replaceAll('-','')}`;
const owner=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
let db,server,origin,buyer,other,seller,seller2,admin,product,settlePayment;
const token=user=>fixtureToken(db,user);
async function request(path,{user=buyer,method='GET',body}={}){const response=await fetch(`${origin}/api${path}`,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${await token(user)}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
before(async()=>{
 await owner.connect();await owner.query(`CREATE SCHEMA ${schema}`);
 Object.assign(process.env,{TEST_SCHEMA:schema,NODE_ENV:'test',PAYMENT_MODE:'demo',OPENAI_API_KEY:'',GMAIL_USER:'',GMAIL_APP_PASSWORD:''});
 db=(await import('../src/config/db.js')).default;await db.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
 ({settlePayment}=await import('../src/services/orders.js'));
 const account=async(name,role)=>(await db.query('INSERT INTO usuarios(nombre,correo,contrasena_hash,rol) VALUES($1,$2,$3,$4) RETURNING *',[name,`${name}@postventa.local`,'unused-fixture-hash',role])).rows[0];
 buyer=await account('buyer','comprador');other=await account('other','comprador');seller=await account('seller','vendedor');seller2=await account('seller2','vendedor');admin=await account('admin','admin');
 const shop=(await db.query("INSERT INTO vendedores(id_usuario,nombre_tienda) VALUES($1,'Tienda de postventa') RETURNING *",[seller.id_usuario])).rows[0];
 await db.query("INSERT INTO vendedores(id_usuario,nombre_tienda) VALUES($1,'Otra tienda')",[seller2.id_usuario]);
 const category=(await db.query('SELECT id_categoria FROM categorias LIMIT 1')).rows[0];
 product=(await db.query("INSERT INTO productos(id_vendedor,id_categoria,nombre,descripcion,precio,stock) VALUES($1,$2,'Olla para postventa','Prueba local',25000,100) RETURNING *",[shop.id_vendedor,category.id_categoria])).rows[0];
 const app=(await import('../src/app.js')).default;server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(db)await db.end();await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await owner.end();});
async function order(paid=true){
 assert.equal((await request('/cart/add',{method:'POST',body:{id_producto:product.id_producto,cantidad:2}})).status,200);
 const result=await request('/orders',{method:'POST',body:{direccion_entrega:'Calle de prueba 123, Cajicá',metodo_pago:'CARD',entrega:'envio',clave_idempotencia:randomUUID()}});assert.equal(result.status,201,JSON.stringify(result.data));
 const row=result.data.order;if(paid)await settlePayment({id:`demo-${row.id_pedido}`,reference:row.referencia,currency:'COP',amount_in_cents:Math.round(Number(row.total)*100),status:'APPROVED'},{environment:'demo'});
 const detail=(await request('/orders/'+row.id_pedido)).data;return {...row,item:detail.items[0]};
}
const payload=row=>({id_detalle:row.item.id_detalle,cantidad:1,motivo:'defectuoso',descripcion:'Una pieza llegó con una fisura visible.'});
async function create(){const purchase=await order();const result=await request('/after-sales',{method:'POST',body:payload(purchase)});assert.equal(result.status,201,JSON.stringify(result.data));return {purchase,row:result.data.case};}
const detail=async row=>(await request(`/after-sales/${row.id}`,{user:admin})).data.case;
async function step(row,estado,extra={}){const fresh=await detail(row);return request(`/after-sales/${row.id}`,{user:admin,method:'PATCH',body:{estado,version:fresh.version,mensaje:'Respuesta de prueba e instrucciones para continuar.',...extra}});}

test('Guía interna automática aísla tienda y comprador y exige pago confirmado',async()=>{
 const purchase=await order(false),path=`/shipping-guides/orders/${purchase.id_pedido}/${product.id_vendedor}`;
 assert.equal((await request(path)).status,409);
 await settlePayment({id:`demo-${purchase.id_pedido}`,reference:purchase.referencia,currency:'COP',amount_in_cents:Math.round(Number(purchase.total)*100),status:'APPROVED'},{environment:'demo'});
 for(const user of [buyer,seller,admin]){
  const result=await request(path,{user});assert.equal(result.status,200,JSON.stringify(result.data));
  assert.equal(result.data.guide.reference,`WC-ENV-${String(purchase.id_pedido).padStart(6,'0')}-T${product.id_vendedor}`);
  assert.equal(result.data.guide.recipient.direccion,'Calle de prueba 123, Cajicá');assert.equal(result.data.guide.items.length,1);
  assert.equal(result.data.guide.items[0].cantidad,2);assert.equal(result.data.guide.environment,'demo');
  assert.equal(result.data.guide.peso,undefined);assert.equal(result.data.guide.items[0].precio_unitario,undefined);
 }
 for(const user of [other,seller2])assert.equal((await request(path,{user})).status,404);
 assert.equal((await request(path,{user:null})).status,401);
 const unrelated=(await db.query('SELECT id_vendedor FROM vendedores WHERE id_usuario=$1',[seller2.id_usuario])).rows[0];
 assert.equal((await request(`/shipping-guides/orders/${purchase.id_pedido}/${unrelated.id_vendedor}`)).status,404);
 await db.query("UPDATE pagos SET estado_pago='rechazado' WHERE id_pedido=$1",[purchase.id_pedido]);
 assert.equal((await request(path)).status,409);
});

test('Guía de devolución se habilita al aprobar y contiene solo las unidades autorizadas',async()=>{
 const {row}=await create(),path=`/shipping-guides/returns/${row.id}`;
 assert.equal((await request(path)).status,409);
 await step(row,'en_revision');await step(row,'aprobada',{solucion:'cambio',requiere_devolucion:true});
 for(const user of [buyer,seller,admin]){
  const result=await request(path,{user});assert.equal(result.status,200,JSON.stringify(result.data));
  assert.equal(result.data.guide.kind,'devolucion');assert.equal(result.data.guide.items[0].cantidad,1);
  assert.equal(result.data.guide.recipient.nombre,'Tienda de postventa');assert.equal(result.data.guide.sender.direccion,'Calle de prueba 123, Cajicá');
 }
 for(const user of [other,seller2])assert.equal((await request(path,{user})).status,404);
 const first=(await request(path)).data.guide.reference;
 await request(`/after-sales/${row.id}/return`,{method:'POST',body:{transportadora:'Empresa elegida',guia:'REAL-123'}});
 const result=(await request(path)).data.guide;assert.equal(result.reference,first);assert.equal(result.tracking,'REAL-123');assert.equal(result.carrier,'Empresa elegida');
 const noReturn=await create();await step(noReturn.row,'en_revision');await step(noReturn.row,'aprobada',{solucion:'orientacion',requiere_devolucion:false});
 assert.equal((await request(`/shipping-guides/returns/${noReturn.row.id}`)).status,409);
});

test('Datos incompletos impiden usar la guía sin inventar direcciones ni contactos',async()=>{
 const purchase=await order(),path=`/shipping-guides/orders/${purchase.id_pedido}/${product.id_vendedor}`;
 const missing=(await request(path)).data.guide;assert.equal(missing.ready,false);assert.ok(missing.missing.some(message=>message.includes('dirección')));
 try{
  await db.query("UPDATE usuarios SET direccion='Calle tienda 45, Cajicá',telefono='3000000001' WHERE id_usuario=$1",[seller.id_usuario]);
  await db.query("UPDATE pedidos SET nombre_destinatario='Comprador de prueba',telefono_entrega='3000000002' WHERE id_pedido=$1",[purchase.id_pedido]);
  const complete=(await request(path)).data.guide;assert.equal(complete.ready,true);assert.deepEqual(complete.missing,[]);assert.ok(complete.sender.direccion.includes('Calle tienda 45'));
  assert.equal(complete.reference,missing.reference);
 }finally{await db.query('UPDATE usuarios SET direccion=NULL,telefono=NULL WHERE id_usuario=$1',[seller.id_usuario]);}
});

test('Solo compras propias con pago confirmado admiten postventa; cantidad y duplicados se validan',async()=>{
 const pending=await order(false);assert.equal((await request('/after-sales',{method:'POST',body:payload(pending)})).status,409);
 const paid=await order();assert.equal((await request('/after-sales',{user:other,method:'POST',body:payload(paid)})).status,404);
 assert.equal((await request('/after-sales',{method:'POST',body:{...payload(paid),cantidad:3}})).status,400);
 assert.equal((await request('/after-sales',{method:'POST',body:payload(paid)})).status,201);
 assert.equal((await request('/after-sales',{method:'POST',body:payload(paid)})).status,409);
});
test('Comprador, tienda y administración ven el caso; otras cuentas no ven contenido ni evidencias',async()=>{
 const {row,purchase}=await create();
 for(const user of [buyer,seller,admin])assert.equal((await request(`/after-sales/${row.id}`,{user})).status,200);
 for(const user of [other,seller2]){assert.equal((await request(`/after-sales/${row.id}`,{user})).status,404);assert.equal((await request('/after-sales',{user})).data.cases.length,0);}
 assert.equal((await request(`/after-sales/${row.id}`,{user:null})).status,401);
 assert.equal((await request(`/after-sales/${row.id}`,{user:seller,method:'PATCH',body:{}})).status,403);
 assert.equal((await request('/after-sales?pedido='+purchase.id_pedido)).data.cases.length,1);
 assert.ok((await db.query("SELECT * FROM notificaciones WHERE tipo='pqr' AND id_usuario=$1 AND titulo LIKE 'Postventa%'",[seller.id_usuario])).rowCount>0);
});
test('Historial registra comentarios, rechazos y reapertura sin permitir saltos ni ediciones obsoletas',async()=>{
 const {row}=await create();assert.equal((await step(row,'resuelta')).status,409);
 assert.equal((await request(`/after-sales/${row.id}/messages`,{user:seller,method:'POST',body:{mensaje:'Necesitamos una fotografía de la pieza afectada.'}})).status,200);
 assert.equal((await step(row,'en_revision')).status,200);
 assert.equal((await request(`/after-sales/${row.id}`,{user:admin,method:'PATCH',body:{estado:'rechazada',version:0,mensaje:'Respuesta de prueba con motivo de rechazo.'}})).status,409);
 assert.equal((await step(row,'rechazada')).status,200);
 assert.equal((await request(`/after-sales/${row.id}/messages`,{method:'POST',body:{mensaje:'Mensaje posterior al cierre.'}})).status,409);
 assert.equal((await step(row,'en_revision')).status,200);
 const result=(await request('/after-sales/'+row.id)).data;assert.ok(result.history.some(item=>item.rol==='vendedor'));assert.equal(result.history.at(-1).estado,'en_revision');
});
test('Devolución, recepción y conciliación de prueba completan el caso sin alterar pagos ni inventario',async()=>{
 const {row,purchase}=await create();const stock=(await db.query('SELECT stock FROM productos WHERE id_producto=$1',[product.id_producto])).rows[0].stock;
 assert.equal((await request(`/after-sales/${row.id}/return`,{method:'POST',body:{transportadora:'Entrega acordada',guia:'DEV-123'}})).status,409);
 assert.equal((await step(row,'en_revision')).status,200);assert.equal((await step(row,'aprobada',{solucion:'reembolso',requiere_devolucion:true})).status,200);
 assert.equal((await step(row,'reembolso_pendiente')).status,409);
 assert.equal((await request(`/after-sales/${row.id}/return`,{user:seller,method:'POST',body:{transportadora:'Entrega acordada',guia:'DEV-123'}})).status,403);
 assert.equal((await request(`/after-sales/${row.id}/return`,{method:'POST',body:{transportadora:'Entrega acordada',guia:'DEV-123'}})).status,200);
 assert.equal((await step(row,'recibida')).status,200);assert.equal((await step(row,'reembolso_pendiente')).status,200);assert.equal((await step(row,'resuelta')).status,409);
 const refund={monto:25000,referencia:'SANDBOX-'+randomUUID(),mensaje:'Conciliación simulada para la prueba del flujo.',confirmado:true};
 assert.equal((await request(`/after-sales/${row.id}/refund`,{user:seller,method:'POST',body:refund})).status,403);
 assert.equal((await request(`/after-sales/${row.id}/refund`,{user:admin,method:'POST',body:{...refund,confirmado:false}})).status,400);
 assert.equal((await request(`/after-sales/${row.id}/refund`,{user:admin,method:'POST',body:{...refund,monto:25001}})).status,400);
 assert.equal((await request(`/after-sales/${row.id}/refund`,{user:admin,method:'POST',body:refund})).status,200);
 assert.equal((await request(`/after-sales/${row.id}/refund`,{user:admin,method:'POST',body:refund})).status,409);
 assert.equal((await step(row,'resuelta')).status,200);
 const result=await detail(row);assert.equal(result.estado,'resuelta');assert.ok(result.referencia_reembolso.startsWith('PRUEBA:'));
 assert.equal((await db.query('SELECT stock FROM productos WHERE id_producto=$1',[product.id_producto])).rows[0].stock,stock);
 assert.equal((await request('/orders/'+purchase.id_pedido)).data.payment.estado_pago,'aprobado');
});
test('Solución de cambio sin devolución cierra con respuesta y sin fabricar reembolso',async()=>{
 const {row}=await create();assert.equal((await step(row,'en_revision')).status,200);assert.equal((await step(row,'aprobada',{solucion:'cambio',requiere_devolucion:false})).status,200);
 assert.equal((await step(row,'reembolso_pendiente')).status,409);assert.equal((await step(row,'resuelta')).status,200);assert.equal((await detail(row)).referencia_reembolso,null);
});
test('Evidencias permanecen privadas, rechazan archivos falsos y conservan historial',async()=>{
 const {row}=await create();
 async function upload(user,bytes){const body=new FormData();body.append('imagen',new Blob([bytes],{type:'image/png'}),'prueba.png');return fetch(`${origin}/api/after-sales/${row.id}/evidence`,{method:'POST',headers:{Authorization:`Bearer ${await token(user)}`},body});}
 assert.equal((await upload(other,'fake')).status,404);assert.equal((await upload(buyer,'fake')).status,400);
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=','base64');
 assert.equal((await upload(buyer,bytes)).status,201);
 const evidence=(await request('/after-sales/'+row.id)).data.evidence;assert.equal(evidence.length,1);assert.equal(evidence[0].datos,undefined);
 for(const user of [other,seller2])assert.equal((await request(`/after-sales/${row.id}/evidence/${evidence[0].id}`,{user})).status,404);
 const response=await fetch(`${origin}/api/after-sales/${row.id}/evidence/${evidence[0].id}`,{headers:{Authorization:`Bearer ${await token(seller)}`}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
 for(let index=0;index<5;index++)assert.equal((await upload(buyer,bytes)).status,201);
 assert.equal((await upload(buyer,bytes)).status,409);
 assert.equal((await upload(buyer,Buffer.alloc(5*1024*1024+1))).status,400);
});
test('Empaque se guarda por tienda, protege versiones y bloquea pedidos sin pago o enviados',async()=>{
 const purchase=await order(),path=`/seller/orders/${purchase.id_pedido}/packing`;
 const packing={bultos:1,peso:1.5,alto:20,ancho:30,largo:40,preparado_por:'Persona de prueba',notas:'Proteger la cerámica.',fragil:true,revisados:[purchase.item.id_detalle],version:0};
 assert.equal((await request(path,{user:buyer,method:'PUT',body:packing})).status,403);assert.equal((await request(path,{user:seller2,method:'PUT',body:packing})).status,404);
 assert.equal((await request(path,{user:seller,method:'PUT',body:{...packing,peso:-1}})).status,400);
 assert.equal((await request(path,{user:seller,method:'PUT',body:{...packing,revisados:[2147483647]}})).status,400);
 const saved=await request(path,{user:seller,method:'PUT',body:packing});assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal(saved.data.packing.version,1);
 assert.equal((await request(path,{user:seller,method:'PUT',body:packing})).status,409);
 const sheet=(await request(`/seller/orders/${purchase.id_pedido}`,{user:seller})).data;assert.equal(Number(sheet.packing.peso),1.5);assert.equal(sheet.packing.revisados[0],purchase.item.id_detalle);
 for(const estado of ['empacando','enviado'])assert.equal((await request(`/admin/orders/${purchase.id_pedido}/status`,{user:admin,method:'PATCH',body:{estado}})).status,200);
 assert.equal((await request(path,{user:seller,method:'PUT',body:{...packing,version:1}})).status,409);
 const pending=await order(false);assert.equal((await request(`/seller/orders/${pending.id_pedido}/packing`,{user:seller,method:'PUT',body:{...packing,revisados:[]}})).status,409);
});

const contact={nombre:'Persona que recibe',telefono:'3000000000',direccion:'Dirección de prueba 456, Cajicá'};
const delivery={estado:'empacando',transportadora:'Empresa de prueba',guia:'GUIA-PRUEBA',fecha_estimada:'2026-11-05',nota_entrega:'Coordinar recepción con el destinatario.',version:0};

test('Pedidos por enviar muestra compras pagadas de la tienda y excluye pagos inválidos y despachos realizados',async()=>{
 const purchase=await order(),pending=await order(false),path='/seller/orders/to-dispatch';
 assert.equal((await request(path)).status,403);
 assert.equal((await request(path,{user:null})).status,401);
 assert.equal((await request(path+'?page=0',{user:seller})).status,400);
 const list=await request(path,{user:seller});assert.equal(list.status,200,JSON.stringify(list.data));
 assert.ok(list.data.orders.some(row=>row.id_pedido===purchase.id_pedido));
 assert.ok(!list.data.orders.some(row=>row.id_pedido===pending.id_pedido));
 assert.equal(list.data.pagination.limit,12);
 assert.ok(!(await request(path,{user:seller2})).data.orders.some(row=>row.id_pedido===purchase.id_pedido));
 const last=await request(path+'?page=1000',{user:seller});assert.deepEqual(last.data.orders,[]);assert.equal(last.data.pagination.total,list.data.pagination.total);
 await db.query('UPDATE pagos SET monto=monto+1 WHERE id_pedido=$1',[purchase.id_pedido]);
 assert.ok(!(await request(path,{user:seller})).data.orders.some(row=>row.id_pedido===purchase.id_pedido));
 await db.query('UPDATE pagos SET monto=monto-1 WHERE id_pedido=$1',[purchase.id_pedido]);
 await request(`/orders/${purchase.id_pedido}/contact`,{method:'PATCH',body:contact});
 assert.equal((await request(`/seller/orders/${purchase.id_pedido}/delivery`,{user:seller,method:'PUT',body:{...delivery,estado:'enviado'}})).status,200);
 assert.ok(!(await request(path,{user:seller})).data.orders.some(row=>row.id_pedido===purchase.id_pedido));
});

test('Envío simple permite pasar de pago confirmado a enviado sin omitir pago, guía o recepción',async()=>{
 const purchase=await order(),path=`/seller/orders/${purchase.id_pedido}/delivery`;
 await request(`/orders/${purchase.id_pedido}/contact`,{method:'PATCH',body:contact});
 assert.equal((await request(path,{user:seller,method:'PUT',body:{...delivery,estado:'entregado'}})).status,409);
 assert.equal((await request(path,{user:seller,method:'PUT',body:{...delivery,estado:'enviado',guia:''}})).status,400);
 const sent=await request(path,{user:seller,method:'PUT',body:{...delivery,estado:'enviado'}});
 assert.equal(sent.status,200,JSON.stringify(sent.data));assert.equal(sent.data.shipment.estado,'enviado');
 assert.equal((await request('/orders/'+purchase.id_pedido)).data.order.estado,'enviado');
 assert.equal((await request(path,{user:seller,method:'PUT',body:{...delivery,estado:'pagado',version:sent.data.shipment.version}})).status,409);
 const received=await request(path,{user:seller,method:'PUT',body:{...delivery,estado:'entregado',version:sent.data.shipment.version}});
 assert.equal(received.status,200);assert.equal(received.data.shipment.estado,'entregado');
});
test('El contacto pertenece al pedido, persiste y solo el comprador puede corregirlo antes del despacho',async()=>{
 const purchase=await order(),path=`/orders/${purchase.id_pedido}/contact`;
 assert.equal((await request(path,{user:other,method:'PATCH',body:contact})).status,404);
 assert.equal((await request(path,{user:seller,method:'PATCH',body:contact})).status,404);
 assert.equal((await request(path,{method:'PATCH',body:{...contact,telefono:'incorrecto'}})).status,400);
 const before=(await db.query('SELECT count(*)::int count FROM pedido_historial WHERE id_pedido=$1',[purchase.id_pedido])).rows[0].count;
 for(let i=0;i<2;i++)assert.equal((await request(path,{method:'PATCH',body:contact})).status,200);
 const data=(await request('/orders/'+purchase.id_pedido)).data;assert.equal(data.order.telefono_entrega,contact.telefono);assert.equal(data.order.nombre_destinatario,contact.nombre);
 assert.equal((await db.query('SELECT count(*)::int count FROM pedido_historial WHERE id_pedido=$1',[purchase.id_pedido])).rows[0].count,before+1);
 const sheet=(await request('/seller/orders/'+purchase.id_pedido,{user:seller})).data;assert.equal(sheet.recipient.nombre,contact.nombre);assert.equal(sheet.recipient.direccion,contact.direccion);
 await db.query("UPDATE usuarios SET nombre='Nombre de cuenta distinto' WHERE id_usuario=$1",[buyer.id_usuario]);
 assert.equal((await request('/seller/orders/'+purchase.id_pedido,{user:seller})).data.recipient.nombre,contact.nombre);
});
test('El vendedor coordina su envío con guía, avisa al comprador y bloquea cambios posteriores de contacto y empaque',async()=>{
 const purchase=await order(),path=`/seller/orders/${purchase.id_pedido}/delivery`;
 assert.equal((await request(path,{user:buyer,method:'PUT',body:delivery})).status,403);
 assert.equal((await request(path,{user:seller2,method:'PUT',body:delivery})).status,404);
 assert.equal((await request(path,{user:seller,method:'PUT',body:{...delivery,estado:'enviado'}})).status,409);
 const packing=await request(path,{user:seller,method:'PUT',body:delivery});assert.equal(packing.status,200,JSON.stringify(packing.data));
 assert.equal((await request(path,{user:seller,method:'PUT',body:delivery})).status,409);
 const sending={...delivery,estado:'enviado',version:packing.data.shipment.version};
 assert.equal((await request(path,{user:seller,method:'PUT',body:{...sending,guia:''}})).status,400);
 assert.equal((await request(path,{user:seller,method:'PUT',body:sending})).status,409);
 await request(`/orders/${purchase.id_pedido}/contact`,{method:'PATCH',body:contact});
 const sent=await request(path,{user:seller,method:'PUT',body:sending});assert.equal(sent.status,200,JSON.stringify(sent.data));
 const before=(await db.query('SELECT count(*)::int count FROM pedido_historial WHERE id_pedido=$1',[purchase.id_pedido])).rows[0].count;
 assert.equal((await request(path,{user:seller,method:'PUT',body:{...sending,version:sent.data.shipment.version}})).status,200);
 assert.equal((await db.query('SELECT count(*)::int count FROM pedido_historial WHERE id_pedido=$1',[purchase.id_pedido])).rows[0].count,before);
 const detail=(await request('/orders/'+purchase.id_pedido)).data;assert.equal(detail.order.estado,'enviado');assert.equal(detail.shipments[0].guia,delivery.guia);
 assert.equal((await request(`/orders/${purchase.id_pedido}/contact`,{method:'PATCH',body:{...contact,nombre:'Otro destinatario'}})).status,409);
 assert.ok((await db.query("SELECT id FROM notificaciones WHERE id_usuario=$1 AND titulo LIKE 'Entrega ·%'",[buyer.id_usuario])).rowCount>0);
});
test('Dos tiendas conservan guías separadas y el estado general espera el avance de ambas',async()=>{
 const shop=(await db.query('SELECT id_vendedor FROM vendedores WHERE id_usuario=$1',[seller2.id_usuario])).rows[0];
 const extra=(await db.query("INSERT INTO productos(id_vendedor,id_categoria,nombre,descripcion,precio,stock) VALUES($1,$2,'Producto de segunda tienda','Prueba',15000,10) RETURNING *",[shop.id_vendedor,product.id_categoria])).rows[0];
 await request('/cart/add',{method:'POST',body:{id_producto:extra.id_producto,cantidad:1}});
 const purchase=await order(),path=`/seller/orders/${purchase.id_pedido}/delivery`;
 await request(`/orders/${purchase.id_pedido}/contact`,{method:'PATCH',body:contact});
 const first=await request(path,{user:seller,method:'PUT',body:delivery});assert.equal(first.status,200);
 const sent=await request(path,{user:seller,method:'PUT',body:{...delivery,estado:'enviado',version:first.data.shipment.version}});assert.equal(sent.status,200);
 assert.equal((await request('/orders/'+purchase.id_pedido)).data.order.estado,'pagado');
 assert.ok(!(await request('/seller/orders/to-dispatch',{user:seller})).data.orders.some(row=>row.id_pedido===purchase.id_pedido));
 assert.ok((await request('/seller/orders/to-dispatch',{user:seller2})).data.orders.some(row=>row.id_pedido===purchase.id_pedido));
 assert.equal((await request(`/admin/orders/${purchase.id_pedido}/status`,{user:admin,method:'PATCH',body:{estado:'empacando'}})).status,409);
 const second=await request(`/admin/orders/${purchase.id_pedido}/shipments/${shop.id_vendedor}`,{user:admin,method:'PUT',body:{...delivery,guia:'GUIA-SEGUNDA'}});assert.equal(second.status,200);
 assert.equal((await request('/orders/'+purchase.id_pedido)).data.order.estado,'empacando');
 assert.equal((await request(path,{user:seller2,method:'PUT',body:{...delivery,guia:'GUIA-SEGUNDA',estado:'enviado',version:second.data.shipment.version}})).status,200);
 const data=(await request('/orders/'+purchase.id_pedido)).data;assert.equal(data.order.estado,'enviado');assert.equal(data.shipments.length,2);assert.deepEqual(new Set(data.shipments.map(row=>row.guia)),new Set([delivery.guia,'GUIA-SEGUNDA']));
 const own=(await request('/seller/orders/'+purchase.id_pedido,{user:seller})).data;assert.equal(own.order.guia,delivery.guia);assert.equal(JSON.stringify(own).includes('GUIA-SEGUNDA'),false);
 const adminDetail=(await request('/admin/orders/'+purchase.id_pedido,{user:admin})).data;assert.equal(adminDetail.order.shipments.length,2);
});
test('Recogida exige punto y horario y un pago rechazado nunca permite coordinar entrega',async()=>{
 const purchase=await order();await db.query("UPDATE pedidos SET tipo_entrega='recogida' WHERE id_pedido=$1",[purchase.id_pedido]);
 const path=`/seller/orders/${purchase.id_pedido}/delivery`;
 const fields={...delivery,transportadora:'',guia:'',nota_entrega:'Punto de prueba, de 9 a 12.'};
 const packing=await request(path,{user:seller,method:'PUT',body:fields});assert.equal(packing.status,200);
 await request(`/orders/${purchase.id_pedido}/contact`,{method:'PATCH',body:contact});
 assert.equal((await request(path,{user:seller,method:'PUT',body:{...fields,estado:'enviado',nota_entrega:'',version:packing.data.shipment.version}})).status,400);
 assert.equal((await request(path,{user:seller,method:'PUT',body:{...fields,estado:'enviado',version:packing.data.shipment.version}})).status,200);
 const pending=await order(false);await db.query("UPDATE pagos SET estado_pago='rechazado' WHERE id_pedido=$1",[pending.id_pedido]);
 assert.equal((await request(`/seller/orders/${pending.id_pedido}/delivery`,{user:seller,method:'PUT',body:delivery})).status,409);
});
