import 'dotenv/config';
import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { fixtureToken } from './helpers/authFixture.js';
const schema=`test_wallet_${randomUUID().replaceAll('-','')}`;
const owner=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
let db,server,origin,buyer,other,seller,seller2,admin,shop,product,settlePayment,destination;
const token=user=>fixtureToken(db,user);
async function request(path,{user=seller,method='GET',body}={}){const response=await fetch(`${origin}/api${path}`,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${await token(user)}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
before(async()=>{
 await owner.connect();await owner.query(`CREATE SCHEMA ${schema}`);
 Object.assign(process.env,{TEST_SCHEMA:schema,NODE_ENV:'test',PAYMENT_MODE:'demo',WOMPI_ENVIRONMENT:'test',OPENAI_API_KEY:'',GMAIL_USER:'',GMAIL_APP_PASSWORD:''});
 db=(await import('../src/config/db.js')).default;await db.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));({settlePayment}=await import('../src/services/orders.js'));
 const account=async(name,role)=>(await db.query('INSERT INTO usuarios(nombre,correo,contrasena_hash,rol,telefono) VALUES($1,$2,$3,$4,$5) RETURNING *',[name,`${name}@wallet.local`,'unused-fixture-hash',role,'3000000000'])).rows[0];
 buyer=await account('buyer','comprador');other=await account('other','comprador');seller=await account('seller','vendedor');seller2=await account('seller2','vendedor');admin=await account('admin','admin');
 shop=(await db.query("INSERT INTO vendedores(id_usuario,nombre_tienda) VALUES($1,'Tienda de monedero') RETURNING *",[seller.id_usuario])).rows[0];await db.query("INSERT INTO vendedores(id_usuario,nombre_tienda) VALUES($1,'Otra tienda')",[seller2.id_usuario]);
 const category=(await db.query('SELECT id_categoria FROM categorias LIMIT 1')).rows[0];product=(await db.query("INSERT INTO productos(id_vendedor,id_categoria,nombre,descripcion,precio,stock) VALUES($1,$2,'Olla del monedero','Prueba local',25000,100) RETURNING *",[shop.id_vendedor,category.id_categoria])).rows[0];
 const app=(await import('../src/app.js')).default;server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(db)await db.end();await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await owner.end();});
const wallet=async(user=seller)=>(await request('/wallet',{user})).data;
async function order({paid=true,delivered=false,confirmed=false}={}){
 await request('/cart/add',{user:buyer,method:'POST',body:{id_producto:product.id_producto,cantidad:1}});
 const result=await request('/orders',{user:buyer,method:'POST',body:{direccion_entrega:'Dirección de prueba 123, Cajicá',metodo_pago:'CARD',entrega:'envio',clave_idempotencia:randomUUID()}});assert.equal(result.status,201,JSON.stringify(result.data));
 const row=result.data.order;
 if(paid)await settlePayment({id:`demo-${row.id_pedido}`,reference:row.referencia,currency:'COP',amount_in_cents:Math.round(Number(row.total)*100),status:'APPROVED'},{environment:'demo'});
 if(delivered)for(const estado of ['empacando','enviado','entregado'])assert.equal((await request(`/admin/orders/${row.id_pedido}/status`,{user:admin,method:'PATCH',body:{estado}})).status,200);
 if(confirmed)assert.equal((await request('/wallet/receipts',{user:buyer,method:'POST',body:{id_pedido:row.id_pedido,id_vendedor:shop.id_vendedor}})).status,200);
 return row;
}
async function withdrawal(cents,key=randomUUID()){return request('/wallet/withdrawals',{method:'POST',body:{id_destino:destination,monto:(cents/100).toFixed(2),clave:key}});}
async function processWithdrawal(id,estado='simulado'){return request(`/wallet/admin/withdrawals/${id}/process`,{user:admin,method:'POST',body:{estado,nota:'Resultado de una prueba aislada sin dinero real.'}});}
test('Solo la tienda ve su monedero; el pago aprobado crea saldo pendiente sin flete ni duplicados',async()=>{
 assert.equal((await request('/wallet',{user:null})).status,401);assert.equal((await request('/wallet',{user:buyer})).status,403);
 const first=await order();const data=await wallet();assert.equal(data.balance.pendiente,2500000);assert.equal(data.balance.disponible,0);assert.equal(data.realWithdrawalsEnabled,false);
 for(let i=0;i<3;i++)await wallet();assert.equal((await db.query("SELECT id FROM monedero_movimientos WHERE clave LIKE 'venta:%' AND id_pedido=$1",[first.id_pedido])).rowCount,1);
 assert.equal((await wallet(seller2)).balance.pendiente,0);
 const pending=await order({paid:false});await db.query("UPDATE pagos SET estado_pago='rechazado' WHERE id_pedido=$1",[pending.id_pedido]);assert.equal((await wallet()).balance.pendiente,2500000);
});
test('Solo el comprador puede confirmar una entrega finalizada y libera saldo una sola vez',async()=>{
 const row=await order({delivered:true}),body={id_pedido:row.id_pedido,id_vendedor:shop.id_vendedor};
 assert.equal((await request('/wallet/receipts',{user:other,method:'POST',body})).status,404);assert.equal((await wallet()).balance.disponible,0);
 for(let i=0;i<2;i++)assert.equal((await request('/wallet/receipts',{user:buyer,method:'POST',body})).status,200);
 const data=await wallet();assert.equal(data.balance.disponible,2500000);assert.equal(data.balance.pendiente,2500000);
 const detail=(await request('/orders/'+row.id_pedido,{user:buyer})).data;assert.ok(detail.shipments[0].recepcion_confirmada);
 const early=await order();assert.equal((await request('/wallet/receipts',{user:buyer,method:'POST',body:{...body,id_pedido:early.id_pedido}})).status,409);
});
test('Los destinos son ficticios, privados y no aceptan números de cuenta reales',async()=>{
 assert.equal((await request('/wallet/destinations',{method:'POST',body:{tipo:'banco',alias:'Banco real',numero:'1234567890'}})).status,400);
 assert.equal((await request('/wallet/destinations',{method:'POST',body:{tipo:'nequi',alias:'Nequi de prueba'}})).status,201);
 const own=(await wallet()).destinations;destination=own[0].id;assert.equal(own[0].ultimos,'1111');assert.equal(own[0].numero,undefined);assert.equal((await wallet(seller2)).destinations.length,0);
 assert.equal((await request('/wallet/destinations/'+destination,{user:seller2,method:'DELETE'})).status,404);
 assert.equal((await request('/wallet/withdrawals',{user:seller2,method:'POST',body:{id_destino:destination,monto:'1000',clave:randomUUID()}})).status,404);
});
test('Retiros concurrentes no pueden reservar dos veces el mismo saldo; cancelar libera exactamente la reserva',async()=>{
 const available=(await wallet()).balance.disponible;
 const results=await Promise.all([withdrawal(available),withdrawal(available)]);assert.deepEqual(results.map(row=>row.status).sort(),[201,409]);
 const row=results.find(row=>row.status===201).data.withdrawal;assert.equal((await wallet()).balance.en_retiro,available);assert.equal((await wallet()).balance.disponible,0);
 assert.equal((await request('/wallet/destinations/'+destination,{method:'DELETE'})).status,409);
 assert.equal((await request('/wallet/withdrawals/'+row.id+'/cancel',{user:seller2,method:'POST',body:{}})).status,404);
 for(let i=0;i<2;i++)assert.equal((await request('/wallet/withdrawals/'+row.id+'/cancel',{method:'POST',body:{}})).status,200);
 assert.equal((await wallet()).balance.disponible,available);assert.equal((await wallet()).balance.en_retiro,0);
});
test('Reintentos con la misma clave no duplican retiros; solo administración simula el abono',async()=>{
 const key=randomUUID(),available=(await wallet()).balance.disponible;
 const [first,second]=await Promise.all([withdrawal(100000,key),withdrawal(100000,key)]);assert.equal(first.status,201);assert.equal(second.status,201);assert.equal(first.data.withdrawal.id,second.data.withdrawal.id);
 assert.equal((await withdrawal(200000,key)).status,409);
 const row=first.data.withdrawal;
 assert.equal((await request(`/wallet/admin/withdrawals/${row.id}/process`,{method:'POST',body:{estado:'simulado',nota:'Intento sin permisos.'}})).status,403);
 for(let i=0;i<2;i++)assert.equal((await processWithdrawal(row.id)).status,200);
 const funds=(await wallet()).balance;assert.equal(funds.retirado,100000);assert.equal(funds.en_retiro,0);assert.equal(funds.disponible,available-100000);
 assert.equal((await request('/wallet/withdrawals/'+row.id+'/cancel',{method:'POST',body:{}})).status,409);
 assert.equal((await db.query("SELECT id FROM monedero_movimientos WHERE clave=$1",[`retiro:${row.id}:simulado`])).rowCount,1);
});
test('Una postventa retiene fondos y obliga a revisar un retiro reservado antes de procesarlo',async()=>{
 const row=await order({delivered:true,confirmed:true}),funds=(await wallet()).balance;
 const reserved=await withdrawal(funds.disponible);assert.equal(reserved.status,201);
 const item=(await request('/orders/'+row.id_pedido,{user:buyer})).data.items[0];
 const created=await request('/after-sales',{user:buyer,method:'POST',body:{id_detalle:item.id_detalle,cantidad:1,motivo:'defectuoso',descripcion:'Prueba: una pieza presenta una fisura.'}});assert.equal(created.status,201);
 const held=await wallet();assert.equal(held.balance.retenido,2500000);assert.ok(held.balance.ajuste_pendiente>0);
 assert.equal((await processWithdrawal(reserved.data.withdrawal.id)).status,409);assert.equal((await processWithdrawal(reserved.data.withdrawal.id,'rechazado')).status,200);assert.equal((await wallet()).balance.en_retiro,0);
 const caseId=created.data.case.id;
 async function step(estado,extra={}){const detail=(await request('/after-sales/'+caseId,{user:admin})).data.case;const result=await request('/after-sales/'+caseId,{user:admin,method:'PATCH',body:{estado,version:detail.version,mensaje:'Decisión de prueba para conciliar la solicitud.',...extra}});assert.equal(result.status,200,JSON.stringify(result.data));}
 await step('en_revision');await step('aprobada',{solucion:'reembolso',requiere_devolucion:false});await step('reembolso_pendiente');
 assert.equal((await request(`/after-sales/${caseId}/refund`,{user:admin,method:'POST',body:{monto:10000,referencia:'REEMBOLSO-'+randomUUID(),mensaje:'Registro simulado de reembolso para comprobar ajuste.',confirmado:true}})).status,200);
 await step('resuelta');
 const after=(await wallet()).balance;assert.equal(after.retenido,0);assert.equal(after.disponible,funds.disponible-1000000);assert.ok((await wallet()).movements.some(item=>item.tipo==='reembolso'&&Number(item.monto_centavos)===-1000000));
});
test('Montos inválidos y producción bloquean la simulación; las ventas prod no generan fondos ficticios',async()=>{
 for(const monto of ['-1','1e4','999','1000.123',1000])assert.equal((await request('/wallet/withdrawals',{method:'POST',body:{monto,id_destino:destination,clave:randomUUID()}})).status,400);
 const before=(await wallet()).balance.pendiente;const row=await order();await db.query("UPDATE pagos SET ambiente='prod' WHERE id_pedido=$1",[row.id_pedido]);assert.equal((await wallet()).balance.pendiente,before);
 const previous=process.env.WOMPI_ENVIRONMENT;try{process.env.WOMPI_ENVIRONMENT='prod';assert.equal((await request('/wallet/destinations',{method:'POST',body:{tipo:'banco',alias:'Prueba'}})).status,409);assert.equal((await withdrawal(100000)).status,409);assert.equal((await wallet()).simulationEnabled,false);}finally{process.env.WOMPI_ENVIRONMENT=previous;}
});
test('Cambiar el dueño de un producto no transfiere ventas, saldo ni destinatarios históricos a otra tienda',async()=>{
 const purchase=await order({delivered:true,confirmed:true}),before=(await wallet()).balance;
 const another=(await db.query('SELECT id_vendedor FROM vendedores WHERE id_usuario=$1',[seller2.id_usuario])).rows[0];
 try{
  await db.query('UPDATE productos SET id_vendedor=$1 WHERE id_producto=$2',[another.id_vendedor,product.id_producto]);
  assert.deepEqual((await wallet()).balance,before);assert.equal((await wallet(seller2)).balance.disponible,0);assert.equal((await wallet(seller2)).balance.pendiente,0);
  assert.equal((await request('/seller/orders/'+purchase.id_pedido)).status,200);assert.equal((await request('/seller/orders/'+purchase.id_pedido,{user:seller2})).status,404);
  const detail=(await request('/orders/'+purchase.id_pedido,{user:buyer})).data;assert.equal(detail.shipments[0].id_vendedor,shop.id_vendedor);
  await db.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
  assert.equal((await db.query('SELECT id_vendedor_compra FROM detalle_pedido WHERE id_pedido=$1',[purchase.id_pedido])).rows[0].id_vendedor_compra,shop.id_vendedor);
  await assert.rejects(db.query('UPDATE detalle_pedido SET id_vendedor_compra=$1 WHERE id_pedido=$2',[another.id_vendedor,purchase.id_pedido]),/no se puede cambiar/);
 }finally{await db.query('UPDATE productos SET id_vendedor=$1 WHERE id_producto=$2',[shop.id_vendedor,product.id_producto]);}
});
