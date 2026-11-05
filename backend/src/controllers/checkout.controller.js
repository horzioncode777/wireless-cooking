import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import pool from '../config/db.js';
import { fail } from '../utils/http.js';
import { settlePayment } from '../services/orders.js';
import { paymentReceiptState } from '../../../shared/paymentReceipt.js';
import { wompiSettings, fetchWompiTransaction, validateTransactionId, wompiRedirectUrl } from '../services/wompi.js';
import { validateContact,shipmentsFor } from '../services/shipments.js';
export function paymentConfig(req,res) {
 const {mode,environment,configured}=wompiSettings();
 res.json({ok:true,mode,environment,configured,shipping:12000});
}
export async function createOrder(req,res) {
 const {direccion_entrega,metodo_pago,entrega,clave_idempotencia}=req.body;
 const contact=req.body.contacto===undefined?null:validateContact(req.body.contacto);
 if(typeof direccion_entrega!=='string' || direccion_entrega.trim().length<8 || direccion_entrega.length>500) throw fail(400,'Ingresa una dirección de entrega completa.');
 if(!['CARD','PSE','NEQUI'].includes(metodo_pago) || !['envio','recogida'].includes(entrega)) throw fail(400,'Selecciona entrega y método de pago.');
 if(typeof clave_idempotencia!=='string' || !/^[\w-]{16,100}$/.test(clave_idempotencia)) throw fail(400,'Identificador de compra inválido.');
 const config=wompiSettings();
 if(config.mode!=='demo' && !config.configured) throw fail(503,'La pasarela de pagos aún no está configurada para este ambiente.');
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query("SELECT set_config('app.checkout_user',$1,true)",[String(req.user.id)]);
  // Serialize checkout per customer, including retries from different tabs.
  // Serialize this customer's checkouts while allowing notification FK checks
  // for other recipients (who may be checking out at the same time).
  await client.query('SELECT id_usuario FROM usuarios WHERE id_usuario=$1 FOR NO KEY UPDATE',[req.user.id]);
  const previous=await client.query('SELECT * FROM pedidos WHERE id_usuario=$1 AND clave_idempotencia=$2',[req.user.id,clave_idempotencia]);
  if(previous.rows.length) {await client.query('COMMIT');return res.json({ok:true,order:previous.rows[0]});}
  const cart=(await client.query("SELECT id_carrito FROM carritos WHERE id_usuario=$1 AND estado='activo' FOR UPDATE",[req.user.id])).rows[0];
  if(!cart) throw fail(400,'El carrito está vacío.');
  const {rows:items}=await client.query(`SELECT p.*,ci.cantidad,(p.id_vendedor IS NULL OR su.estado='activo') AS comercio_activo FROM carrito_items ci JOIN productos p ON p.id_producto=ci.id_producto LEFT JOIN vendedores v ON v.id_vendedor=p.id_vendedor LEFT JOIN usuarios su ON su.id_usuario=v.id_usuario WHERE ci.id_carrito=$1 ORDER BY p.id_producto FOR UPDATE OF p,ci`,[cart.id_carrito]);
  if(!items.length) throw fail(400,'El carrito está vacío.');
  let cents=entrega==='envio'?1200000:0;
  for(const item of items) {
   if(!item.comercio_activo || item.estado.toLowerCase()!=='activo' || item.stock<item.cantidad) throw fail(409,`Stock insuficiente o producto no disponible: ${item.nombre}. Revisa tu carrito.`);
   cents+=Math.round(Number(item.precio)*100)*item.cantidad;
  }
  const reference=`WC-${randomUUID()}`;
  const order=(await client.query(`INSERT INTO pedidos(id_usuario,total,direccion_entrega,metodo_pago,envio,referencia,clave_idempotencia,tipo_entrega) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[req.user.id,cents/100,direccion_entrega.trim(),metodo_pago,entrega==='envio'?12000:0,reference,clave_idempotencia,entrega])).rows[0];
  const snapshot=(await client.query("UPDATE pedidos SET nombre_destinatario=COALESCE($2,trim(concat_ws(' ',u.nombre,u.apellido))),telefono_entrega=COALESCE($3,u.telefono) FROM usuarios u WHERE pedidos.id_pedido=$1 AND u.id_usuario=pedidos.id_usuario RETURNING pedidos.*",[order.id_pedido,contact?.nombre||null,contact?.telefono||null])).rows[0];
  Object.assign(order,snapshot);
  for(const item of items) {
   await client.query('INSERT INTO detalle_pedido(id_pedido,id_producto,nombre_producto,cantidad,precio_unitario,subtotal) VALUES($1,$2,$3,$4,$5,$6)',[order.id_pedido,item.id_producto,item.nombre,item.cantidad,item.precio,Math.round(Number(item.precio)*100)*item.cantidad/100]);
   await client.query('UPDATE productos SET stock=stock-$1,fecha_actualizacion=now() WHERE id_producto=$2',[item.cantidad,item.id_producto]);
  }
  await client.query('INSERT INTO pagos(id_pedido,monto,metodo_pago,referencia,ambiente) VALUES($1,$2,$3,$4,$5)',[order.id_pedido,order.total,metodo_pago,reference,config.mode==='demo'?'demo':config.environment]);
  await client.query('DELETE FROM carrito_items WHERE id_carrito=$1',[cart.id_carrito]);
  await client.query('COMMIT');res.status(201).json({ok:true,order});
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export async function getOrder(req,res) {
 const {rows}=await pool.query('SELECT * FROM pedidos WHERE id_pedido=$1 AND id_usuario=$2',[req.params.id,req.user.id]);
 if(!rows.length) throw fail(404,'Pedido no encontrado.');
 const items=await pool.query('SELECT d.*,COALESCE(d.nombre_producto,p.nombre) AS nombre,p.imagen,v.nombre_tienda FROM detalle_pedido d LEFT JOIN productos p ON p.id_producto=d.id_producto LEFT JOIN vendedores v ON v.id_vendedor=d.id_vendedor_compra WHERE id_pedido=$1 ORDER BY d.id_detalle',[req.params.id]);
 const payment=await pool.query('SELECT estado_pago,metodo_pago,referencia,transaccion,fecha_pago,ambiente,monto FROM pagos WHERE id_pedido=$1',[req.params.id]);
 const history=await pool.query('SELECT id,estado,tipo,mensaje,fecha FROM pedido_historial WHERE id_pedido=$1 ORDER BY fecha,id',[req.params.id]);
 res.set('Cache-Control','no-store');
 const receiptState=paymentReceiptState(rows[0],payment.rows[0]);
 const shipments=receiptState==='confirmed'?await shipmentsFor(pool,rows[0]):[];
 res.json({ok:true,order:rows[0],items:items.rows,payment:payment.rows[0],history:history.rows,shipments,receiptState,receiptAllowed:receiptState==='confirmed'});
}
export async function paymentSession(req,res) {
 const {rows}=await pool.query('SELECT * FROM pedidos WHERE id_pedido=$1 AND id_usuario=$2',[req.params.id,req.user.id]);
 const order=rows[0];if(!order) throw fail(404,'Pedido no encontrado.');
 if(order.estado!=='pendiente') throw fail(409,'Este pedido ya no está pendiente de pago.');
 const config=wompiSettings();
 const payment=(await pool.query('SELECT ambiente,transaccion FROM pagos WHERE id_pedido=$1',[order.id_pedido])).rows[0];
 const currentEnvironment=config.mode==='demo'?'demo':config.environment;
 if(payment?.ambiente && payment.ambiente!==currentEnvironment) throw fail(409,'Este pedido pertenece a otro ambiente de pago. Consulta con soporte.');
 if(config.mode==='demo') return res.json({ok:true,mode:'demo'});
 const publicKey=config.publicKey, secret=config.integritySecret;
 if(!config.configured) throw fail(503,'Configura las llaves de Wompi para este ambiente.');
 if(payment?.transaccion) throw fail(409,'Este pedido ya tiene una transacción en curso. Consulta su estado antes de intentar otro pago.');
 const amount=Math.round(Number(order.total)*100);
 const signature=createHash('sha256').update(`${order.referencia}${amount}COP${secret}`).digest('hex');
 const params=new URLSearchParams({'public-key':publicKey,currency:'COP','amount-in-cents':String(amount),reference:order.referencia,'signature:integrity':signature,'customer-data:email':req.user.correo});
 const redirectUrl=wompiRedirectUrl(process.env.FRONTEND_URL,order.id_pedido);
 if(redirectUrl)params.set('redirect-url',redirectUrl);
 // No redirectUrl in the widget: its official callback returns the transaction ID
 // to the local app, which verifies it on the server before confirming the order.
 const checkout={publicKey,currency:'COP',amountInCents:amount,reference:order.referencia,signature:{integrity:signature},customerData:{email:req.user.correo}};
 res.json({ok:true,mode:'wompi',url:`https://checkout.wompi.co/p/?${params}`,checkout});
}
export async function demoPayment(req,res) {
 if(process.env.PAYMENT_MODE!=='demo' || process.env.NODE_ENV==='production') throw fail(404,'Ruta no disponible.');
 const {rows}=await pool.query('SELECT * FROM pedidos WHERE id_pedido=$1 AND id_usuario=$2',[req.params.id,req.user.id]);
 if(!rows.length) throw fail(404,'Pedido no encontrado.');
 const order=rows[0];
 await settlePayment({id:`demo-${order.id_pedido}`,reference:order.referencia,currency:'COP',amount_in_cents:Math.round(Number(order.total)*100),status:'APPROVED'},{environment:'demo'});
 res.json({ok:true,message:'Pago de demostración confirmado. No se ha cobrado dinero.'});
}
export async function wompiWebhook(req,res) {
 const event=req.body,secret=process.env.WOMPI_EVENTS_SECRET;
 if(!secret) throw fail(503,'Eventos de pago sin configurar.');
 const properties=event.signature?.properties;
 if(!Array.isArray(properties) || !properties.length || properties.length>20 || properties.some(path=>typeof path!=='string'||!/^\w+(?:\.\w+){1,8}$/.test(path)||path.length>150) || !Number.isInteger(event.timestamp)) throw fail(400,'Evento inválido.');
 const signed=properties.map(path=>String(path.split('.').reduce((obj,key)=>obj&&Object.hasOwn(obj,key)?obj[key]:undefined,event.data)??'')).join('');
 const expected=createHash('sha256').update(`${signed}${event.timestamp}${secret}`).digest('hex');
 const checksum=String(req.get('x-event-checksum')||event.signature.checksum||'').toLowerCase();
 if(!/^[0-9a-f]{64}$/.test(checksum) || !timingSafeEqual(Buffer.from(expected),Buffer.from(checksum))) throw fail(401,'Firma inválida.');
 if(event.environment!==(process.env.WOMPI_ENVIRONMENT||'test')) throw fail(400,'Ambiente de pago incorrecto.');
 if(event.event==='transaction.updated') {
  if(!['transaction.id','transaction.status','transaction.amount_in_cents'].every(p=>properties.includes(p))) throw fail(400,'Faltan propiedades firmadas.');
  // Verify the entire transaction with Wompi; reference/currency may not be signed.
  const verified=await fetchWompiTransaction(event.data?.transaction?.id);
  await settlePayment(verified,{environment:event.environment});
  console.info('Wompi webhook processed',JSON.stringify({transactionId:verified.id,environment:event.environment,status:verified.status}));
 }
 res.json({ok:true});
}

export async function verifyWompiPayment(req,res) {
 const {rows}=await pool.query('SELECT o.referencia,p.transaccion,p.ambiente FROM pedidos o JOIN pagos p USING(id_pedido) WHERE o.id_pedido=$1 AND o.id_usuario=$2',[req.params.id,req.user.id]);
 if(!rows.length) throw fail(404,'Pedido no encontrado.');
 const payment=rows[0],config=wompiSettings();
 if(config.mode!=='wompi'||!config.configured) throw fail(503,'La consulta de Wompi no está configurada.');
 if(payment.ambiente && payment.ambiente!==config.environment) throw fail(409,'El pedido pertenece a otro ambiente de pago.');
 const id=validateTransactionId(req.body.transactionId||payment.transaccion);
 if(payment.transaccion && payment.transaccion!==id) throw fail(409,'El pedido ya tiene otra transacción asociada.');
 const transaction=await fetchWompiTransaction(id);
 if(transaction.reference!==payment.referencia) throw fail(400,'La transacción no corresponde a este pedido.');
 await settlePayment(transaction,{environment:config.environment});
 res.set('Cache-Control','no-store');
 res.json({ok:true,status:transaction.status});
}
