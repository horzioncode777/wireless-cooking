import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken,isAdmin,verifySeller } from '../middlewares/auth.middleware.js';
import { asyncRoute,fail } from '../utils/http.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { paymentReceiptState } from '../../../shared/paymentReceipt.js';
import { shipmentsFor } from '../services/shipments.js';
const router=Router();router.use(verifyToken,(req,res,next)=>{res.set('Cache-Control','no-store');next();});
const id=value=>{const n=Number(value);if(!Number.isInteger(n)||n<1||n>2147483647)throw fail(400,'Identificador inválido.');return n;};
const sandbox=()=>{if(process.env.WOMPI_ENVIRONMENT==='prod'||process.env.NODE_ENV==='production')throw fail(409,'Los retiros reales aún no están habilitados. Este monedero solo permite simulaciones en Sandbox.');};
async function transaction(fn){const db=await pool.connect();try{await db.query('BEGIN');const result=await fn(db);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
async function merchant(db,user,lock=true){const seller=(await db.query(`SELECT * FROM vendedores WHERE id_usuario=$1 ${lock?'FOR NO KEY UPDATE':''}`,[user.id])).rows[0];if(!seller)throw fail(404,'Tienda no encontrada.');return seller;}
async function movement(db,seller,key,type,cents,description,order=null){await db.query('INSERT INTO monedero_movimientos(id_vendedor,clave,tipo,monto_centavos,descripcion,id_pedido) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id_vendedor,clave) DO NOTHING',[seller,key,type,cents,description,order]);}
async function notice(db,user,title,message,destination='/vendedor/monedero'){await db.query("SELECT avisar_usuario($1,'pago',$2,$3,$4,'info')",[user,title,message,destination]);}
async function balance(db,seller){
 const rows=(await db.query(`SELECT d.id_detalle,d.id_pedido,d.nombre_producto,round(d.subtotal*100)::bigint AS bruto,
  COALESCE((SELECT round(SUM(c.monto_reembolso)*100)::bigint FROM postventa c WHERE c.id_detalle=d.id_detalle AND c.referencia_reembolso IS NOT NULL),0) AS devuelto,
  EXISTS(SELECT 1 FROM postventa c WHERE c.id_detalle=d.id_detalle AND c.estado NOT IN ('resuelta','rechazada')) AS retenido,
  EXISTS(SELECT 1 FROM monedero_recepciones r WHERE r.id_pedido=d.id_pedido AND r.id_vendedor=$1) AS confirmado,
  (o.estado='entregado' OR s.estado='entregado') AS entregado
  FROM detalle_pedido d JOIN productos p USING(id_producto) JOIN pedidos o USING(id_pedido) JOIN pagos pay USING(id_pedido)
  LEFT JOIN pedido_entregas s ON s.id_pedido=d.id_pedido AND s.id_vendedor=$1
  WHERE d.id_vendedor_compra=$1 AND pay.ambiente IN ('test','demo') AND o.estado IN ('pagado','empacando','enviado','entregado')
  AND pay.estado_pago='aprobado' AND pay.referencia=o.referencia AND length(trim(o.referencia))>0 AND pay.monto=o.total AND o.total>0 AND pay.transaccion IS NOT NULL AND length(trim(pay.transaccion))>0 ORDER BY d.id_detalle`,[seller])).rows;
 let pending=0,held=0,eligible=0;
 for(const row of rows){
  const gross=Number(row.bruto),refunded=Number(row.devuelto),net=Math.max(0,gross-refunded);
  if(!Number.isSafeInteger(gross)||!Number.isSafeInteger(refunded))throw fail(409,'El importe requiere revisión administrativa.');
  await movement(db,seller,`venta:${row.id_detalle}`,'venta',gross,`Venta de prueba · ${row.nombre_producto}`,row.id_pedido);
  if(refunded)await movement(db,seller,`ajuste:${row.id_detalle}`,'reembolso',-refunded,'Reembolso de prueba conciliado.',row.id_pedido);
  if(row.retenido)held+=net;else if(row.confirmado&&row.entregado){eligible+=net;await movement(db,seller,`liberacion:${row.id_detalle}`,'liberacion',net,'Venta de prueba disponible tras recepción confirmada.',row.id_pedido);}else pending+=net;
 }
 const totals=(await db.query("SELECT COALESCE(SUM(monto_centavos) FILTER(WHERE estado='solicitado'),0) AS reservado,COALESCE(SUM(monto_centavos) FILTER(WHERE estado='simulado'),0) AS retirado FROM monedero_retiros WHERE id_vendedor=$1",[seller])).rows[0];
 const reserved=Number(totals.reservado),withdrawn=Number(totals.retirado),raw=eligible-reserved-withdrawn;
 if(![pending,held,eligible,reserved,withdrawn,raw].every(Number.isSafeInteger))throw fail(409,'El saldo requiere revisión.');
 return {pendiente:pending,retenido:held,disponible:Math.max(0,raw),en_retiro:reserved,retirado:withdrawn,ajuste_pendiente:Math.max(0,-raw)};
}
function amount(value){if(typeof value!=='string'||!/^\d{1,12}(?:\.\d{1,2})?$/.test(value))throw fail(400,'Ingresa un monto válido en pesos, con hasta dos decimales.');const cents=Math.round(Number(value)*100);if(!Number.isSafeInteger(cents)||cents<100000)throw fail(400,'El mínimo de esta simulación es $1.000 COP.');return cents;}

router.post('/receipts',asyncRoute(async(req,res)=>{
 const orderId=id(req.body.id_pedido),sellerId=id(req.body.id_vendedor);
 await transaction(async db=>{
  const order=(await db.query('SELECT * FROM pedidos WHERE id_pedido=$1 AND id_usuario=$2 FOR NO KEY UPDATE',[orderId,req.user.id])).rows[0];if(!order)throw fail(404,'Pedido no encontrado.');
  const payment=(await db.query('SELECT * FROM pagos WHERE id_pedido=$1',[orderId])).rows[0];
  if(paymentReceiptState(order,payment)!=='confirmed')throw fail(409,'El pago no está confirmado.');
  const shipment=(await shipmentsFor(db,order)).find(row=>row.id_vendedor===sellerId);if(!shipment)throw fail(404,'Entrega no encontrada.');
  if(shipment.estado!=='entregado')throw fail(409,'La tienda debe registrar la entrega antes de confirmar su recepción.');
  const seller=(await db.query('SELECT id_usuario FROM vendedores WHERE id_vendedor=$1 FOR NO KEY UPDATE',[sellerId])).rows[0];
  const inserted=await db.query('INSERT INTO monedero_recepciones(id_pedido,id_vendedor,id_usuario) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id_pedido',[orderId,sellerId,req.user.id]);
  if(inserted.rowCount){await db.query("INSERT INTO pedido_historial(id_pedido,estado,tipo,mensaje) VALUES($1,'entregado','entrega','El comprador confirmó la recepción de los productos de la tienda.')",[orderId]);await notice(db,seller.id_usuario,'Recepción confirmada',`Pedido #${orderId}: el comprador confirmó que recibió los productos.`);}
 });res.json({ok:true});
}));
router.get('/',verifySeller,asyncRoute(async(req,res)=>{
 const result=await transaction(async db=>{const seller=await merchant(db,req.user);return {seller:{id:seller.id_vendedor,nombre:seller.nombre_tienda},balance:await balance(db,seller.id_vendedor),destinations:(await db.query('SELECT id,tipo,alias,ultimos FROM monedero_destinos WHERE id_vendedor=$1 AND activo ORDER BY id',[seller.id_vendedor])).rows,withdrawals:(await db.query('SELECT id,monto_centavos,estado,tipo_destino,alias_destino,ultimos,nota,fecha,fecha_actualizacion FROM monedero_retiros WHERE id_vendedor=$1 ORDER BY id DESC LIMIT 100',[seller.id_vendedor])).rows,movements:(await db.query('SELECT id,tipo,monto_centavos,descripcion,id_pedido,fecha FROM monedero_movimientos WHERE id_vendedor=$1 ORDER BY id DESC LIMIT 100',[seller.id_vendedor])).rows};});
 res.json({ok:true,...result,mode:'sandbox',realWithdrawalsEnabled:false,simulationEnabled:process.env.WOMPI_ENVIRONMENT!=='prod'&&process.env.NODE_ENV!=='production',minimumCents:100000});
}));
router.post('/destinations',verifySeller,rateLimit(20),asyncRoute(async(req,res)=>{
 sandbox();const {tipo,alias}=req.body;if(!['nequi','banco'].includes(tipo)||typeof alias!=='string'||alias.trim().length<2||alias.length>60||Object.keys(req.body).some(key=>!['tipo','alias'].includes(key)))throw fail(400,'Elige un destino de prueba y un alias de 2 a 60 caracteres. No envíes datos bancarios reales.');
 await transaction(async db=>{const seller=await merchant(db,req.user);if((await db.query('SELECT id FROM monedero_destinos WHERE id_vendedor=$1 AND activo',[seller.id_vendedor])).rowCount>=5)throw fail(409,'Puedes guardar hasta cinco destinos de prueba.');await db.query('INSERT INTO monedero_destinos(id_vendedor,tipo,alias,ultimos) VALUES($1,$2,$3,$4)',[seller.id_vendedor,tipo,alias.trim(),tipo==='nequi'?'1111':'0000']);});res.status(201).json({ok:true});
}));
router.delete('/destinations/:id',verifySeller,asyncRoute(async(req,res)=>{
 sandbox();await transaction(async db=>{const seller=await merchant(db,req.user),destination=id(req.params.id);if((await db.query("SELECT id FROM monedero_retiros WHERE id_destino=$1 AND id_vendedor=$2 AND estado='solicitado'",[destination,seller.id_vendedor])).rowCount)throw fail(409,'Este destino tiene un retiro en proceso.');const updated=await db.query('UPDATE monedero_destinos SET activo=false WHERE id=$1 AND id_vendedor=$2 AND activo RETURNING id',[destination,seller.id_vendedor]);if(!updated.rowCount)throw fail(404,'Destino no encontrado.');});res.json({ok:true});
}));
router.post('/withdrawals',verifySeller,rateLimit(20),asyncRoute(async(req,res)=>{
 sandbox();const cents=amount(req.body.monto),destination=id(req.body.id_destino),key=req.body.clave;if(typeof key!=='string'||!/^[\w-]{16,100}$/.test(key))throw fail(400,'Identificador de retiro inválido.');
 const result=await transaction(async db=>{
  const seller=await merchant(db,req.user),existing=(await db.query('SELECT * FROM monedero_retiros WHERE id_vendedor=$1 AND clave=$2',[seller.id_vendedor,key])).rows[0];
  if(existing){if(Number(existing.monto_centavos)!==cents||existing.id_destino!==destination)throw fail(409,'Este identificador ya corresponde a otro retiro.');return {id:existing.id,estado:existing.estado};}
  const target=(await db.query('SELECT * FROM monedero_destinos WHERE id=$1 AND id_vendedor=$2 AND activo',[destination,seller.id_vendedor])).rows[0];if(!target)throw fail(404,'Destino no encontrado.');
  const funds=await balance(db,seller.id_vendedor);if(cents>funds.disponible)throw fail(409,'El monto supera tu saldo disponible.');
  const withdrawal=(await db.query('INSERT INTO monedero_retiros(id_vendedor,id_destino,monto_centavos,clave,tipo_destino,alias_destino,ultimos) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,estado',[seller.id_vendedor,destination,cents,key,target.tipo,target.alias,target.ultimos])).rows[0];
  await movement(db,seller.id_vendedor,`retiro:${withdrawal.id}:solicitado`,'reserva',cents,'Retiro de prueba solicitado. Saldo reservado.');await notice(db,req.user.id,'Retiro de prueba solicitado',`Solicitud #${withdrawal.id}: reservamos el importe hasta su revisión. No se envió dinero real.`);
  for(const admin of (await db.query("SELECT id_usuario FROM usuarios WHERE rol='admin' AND estado='activo'")).rows)await notice(db,admin.id_usuario,'Retiro de prueba por revisar',`La tienda ${seller.nombre_tienda} solicitó el retiro #${withdrawal.id}.`,'/admin/monederos');
  return withdrawal;
 });res.status(201).json({ok:true,withdrawal:result});
}));
router.post('/withdrawals/:id/cancel',verifySeller,asyncRoute(async(req,res)=>{
 sandbox();await transaction(async db=>{const seller=await merchant(db,req.user),row=(await db.query('SELECT * FROM monedero_retiros WHERE id=$1 AND id_vendedor=$2 FOR NO KEY UPDATE',[id(req.params.id),seller.id_vendedor])).rows[0];if(!row)throw fail(404,'Retiro no encontrado.');if(row.estado==='cancelado')return;if(row.estado!=='solicitado')throw fail(409,'Este retiro ya fue procesado.');await db.query("UPDATE monedero_retiros SET estado='cancelado',fecha_actualizacion=now() WHERE id=$1",[row.id]);await movement(db,seller.id_vendedor,`retiro:${row.id}:cancelado`,'cancelacion',Number(row.monto_centavos),'Retiro de prueba cancelado. Reserva liberada.');await notice(db,req.user.id,'Retiro cancelado',`La solicitud #${row.id} fue cancelada y se liberó su reserva.`);});res.json({ok:true});
}));
router.get('/admin/withdrawals',isAdmin,asyncRoute(async(req,res)=>{res.json({ok:true,withdrawals:(await pool.query('SELECT r.id,r.id_vendedor,r.monto_centavos,r.estado,r.tipo_destino,r.alias_destino,r.ultimos,r.nota,r.fecha,v.nombre_tienda FROM monedero_retiros r JOIN vendedores v USING(id_vendedor) ORDER BY r.id DESC LIMIT 200')).rows});}));
router.post('/admin/withdrawals/:id/process',isAdmin,asyncRoute(async(req,res)=>{
 sandbox();const status=req.body.estado,note=req.body.nota;if(!['simulado','rechazado'].includes(status)||typeof note!=='string'||note.trim().length<10||note.length>1000)throw fail(400,'Indica el resultado y una observación de 10 a 1.000 caracteres.');
 await transaction(async db=>{
  const withdrawalId=id(req.params.id),snapshot=(await db.query('SELECT id_vendedor FROM monedero_retiros WHERE id=$1',[withdrawalId])).rows[0];if(!snapshot)throw fail(404,'Retiro no encontrado.');
  const seller=(await db.query('SELECT id_usuario FROM vendedores WHERE id_vendedor=$1 FOR NO KEY UPDATE',[snapshot.id_vendedor])).rows[0];
  const row=(await db.query('SELECT * FROM monedero_retiros WHERE id=$1 FOR NO KEY UPDATE',[withdrawalId])).rows[0];if(row.estado===status)return;if(row.estado!=='solicitado')throw fail(409,'El retiro ya fue procesado.');
  if(status==='simulado'){const funds=await balance(db,row.id_vendedor);if(funds.ajuste_pendiente>0)throw fail(409,'El saldo cambió o hay una postventa abierta. Rechaza esta solicitud para liberar la reserva y revisa los movimientos.');}
  await db.query('UPDATE monedero_retiros SET estado=$2,nota=$3,fecha_actualizacion=now() WHERE id=$1',[row.id,status,note.trim()]);await movement(db,row.id_vendedor,`retiro:${row.id}:${status}`,status,status==='simulado'?-Number(row.monto_centavos):Number(row.monto_centavos),status==='simulado'?'Retiro simulado completado. No se transfirió dinero real.':'Retiro rechazado. Reserva liberada.');await notice(db,seller.id_usuario,status==='simulado'?'Retiro simulado completado':'Retiro de prueba rechazado',`Solicitud #${row.id}. ${note.trim()} No se transfirió dinero real.`);
 });res.json({ok:true});
}));
export default router;
