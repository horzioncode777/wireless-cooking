import pool from '../config/db.js';
import { fail } from '../utils/http.js';
function validOrderId(value){const id=Number(value);if(!Number.isInteger(id)||id<1||id>2147483647)throw fail(400,'Pedido inválido.');return id;}

export function validateDelivery(body={}){
 if(!body||typeof body!=='object'||Array.isArray(body))throw fail(400,'Datos de entrega inválidos.');
 const result={};
 for(const [field,max] of [['transportadora',100],['guia',100],['nota_entrega',1000]]){
  const value=body[field];
  if(value!==undefined&&value!==null&&(typeof value!=='string'||value.length>max))throw fail(400,`Revisa el campo ${field.replace('_',' ')} (máximo ${max} caracteres).`);
  result[field]=typeof value==='string'?value.trim()||null:null;
 }
 const date=body.fecha_estimada;
 if(date!==undefined&&date!==null&&date!==''){
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw fail(400,'La fecha estimada debe tener formato AAAA-MM-DD.');
  const parsed=new Date(`${date}T12:00:00Z`);
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw fail(400,'La fecha estimada no es válida.');
  result.fecha_estimada=date;
 }else result.fecha_estimada=null;
 if(result.guia&&!result.transportadora)throw fail(400,'Indica la transportadora de esta guía.');
 return result;
}

export async function updateDelivery(id,body){
 id=validOrderId(id);const fields=validateDelivery(body),client=await pool.connect();
 try{
  await client.query('BEGIN');
  const order=(await client.query('SELECT * FROM pedidos WHERE id_pedido=$1 FOR UPDATE',[id])).rows[0];
  if(!order)throw fail(404,'Pedido no encontrado.');
  if(!['pagado','empacando','enviado'].includes(order.estado))throw fail(409,'Los datos de entrega solo se editan en pedidos pagados, empacando o en camino.');
  if(order.tipo_entrega==='recogida'&&(fields.transportadora||fields.guia))throw fail(400,'Para recogida, registra el punto y horario en las instrucciones, sin guía de envío.');
  const updated=await client.query(`UPDATE pedidos SET transportadora=$2,guia=$3,fecha_estimada=$4,nota_entrega=$5,fecha_actualizacion=now() WHERE id_pedido=$1 AND ROW(transportadora,guia,fecha_estimada,nota_entrega) IS DISTINCT FROM ROW($2::varchar,$3::varchar,$4::date,$5::varchar) RETURNING *`,[id,fields.transportadora,fields.guia,fields.fecha_estimada,fields.nota_entrega]);
  await client.query('COMMIT');return updated.rows[0]||order;
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export async function restoreStock(client,id) {
 await client.query(`UPDATE productos p SET stock=p.stock+d.cantidad,fecha_actualizacion=now() FROM detalle_pedido d WHERE d.id_pedido=$1 AND d.id_producto=p.id_producto`,[id]);
}
export async function transitionOrder(id,status) {
 id=validOrderId(id);
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  const {rows}=await client.query('SELECT * FROM pedidos WHERE id_pedido=$1 FOR UPDATE',[id]);
  const order=rows[0]; if(!order) throw fail(404,'Pedido no encontrado.');
  const transitions={pendiente:['cancelado'],pagado:['empacando'],empacando:['enviado'],enviado:['entregado'],entregado:[],cancelado:[]};
  if(status!==order.estado && !transitions[order.estado]?.includes(status)) throw fail(409,'Transición inválida. Los pagos se confirman desde la pasarela.');
  if(status!==order.estado&&['empacando','enviado','entregado'].includes(status)&&(await client.query('SELECT 1 FROM pedido_entregas WHERE id_pedido=$1',[id])).rowCount){
   const stores=(await client.query('SELECT DISTINCT d.id_vendedor_compra AS id_vendedor,s.estado FROM detalle_pedido d JOIN productos p USING(id_producto) LEFT JOIN pedido_entregas s ON s.id_pedido=d.id_pedido AND s.id_vendedor=d.id_vendedor_compra WHERE d.id_pedido=$1 AND d.id_vendedor_compra IS NOT NULL',[id])).rows;
   const sequence=['pagado','empacando','enviado','entregado'];
   if(stores.some(store=>sequence.indexOf(store.estado)<sequence.indexOf(status)))throw fail(409,'Actualiza cada entrega por tienda antes de avanzar el pedido completo.');
  }
  if(status==='cancelado' && order.estado!=='cancelado') {
   await restoreStock(client,id);
   await client.query("UPDATE pagos SET estado_pago='cancelado' WHERE id_pedido=$1",[id]);
  }
  const result=await client.query('UPDATE pedidos SET estado=$1,fecha_actualizacion=now() WHERE id_pedido=$2 RETURNING *',[status,id]);
  await client.query('COMMIT'); return result.rows[0];
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export async function settlePayment(transaction,{environment}={}) {
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  const {rows}=await client.query('SELECT * FROM pedidos WHERE referencia=$1 FOR UPDATE',[transaction.reference]);
  const order=rows[0]; if(!order) throw fail(404,'Referencia no encontrada.');
  if(transaction.currency!=='COP' || Number(transaction.amount_in_cents)!==Math.round(Number(order.total)*100)) throw fail(400,'Monto o moneda no coinciden.');
  const payment=(await client.query('SELECT * FROM pagos WHERE id_pedido=$1 FOR UPDATE',[order.id_pedido])).rows[0];
  if(environment && payment.ambiente && payment.ambiente!==environment) throw fail(400,'Ambiente de pago incorrecto para este pedido.');
  if(payment.transaccion && payment.transaccion!==transaction.id) throw fail(409,'Referencia asociada a otra transacción.');
  if(['pagado','empacando','enviado','entregado'].includes(order.estado)) {
   await client.query('COMMIT');return;
  }
  if(order.estado==='cancelado') {
   if(transaction.status==='APPROVED') throw fail(409,'Pago aprobado sobre pedido cancelado: requiere conciliación y devolución.');
   await client.query('COMMIT');return;
  }
  if(transaction.status==='APPROVED') {
   await client.query("UPDATE pedidos SET estado='pagado',fecha_actualizacion=now() WHERE id_pedido=$1",[order.id_pedido]);
   await client.query('UPDATE productos p SET ventas=p.ventas+d.cantidad FROM detalle_pedido d WHERE d.id_pedido=$1 AND d.id_producto=p.id_producto',[order.id_pedido]);
  } else if(['DECLINED','VOIDED','ERROR'].includes(transaction.status)) {
   await restoreStock(client,order.id_pedido);
   await client.query("UPDATE pedidos SET estado='cancelado',fecha_actualizacion=now() WHERE id_pedido=$1",[order.id_pedido]);
  } else {
   if(transaction.status==='PENDING') await client.query('UPDATE pagos SET transaccion=$1 WHERE id_pedido=$2',[transaction.id,order.id_pedido]);
   await client.query('COMMIT');return;
  }
  const actualMethod=/^[A-Z_]{2,40}$/.test(transaction.payment_method_type||'')?transaction.payment_method_type:payment.metodo_pago;
  await client.query('UPDATE pedidos SET metodo_pago=$1 WHERE id_pedido=$2',[actualMethod,order.id_pedido]);
  await client.query('UPDATE pagos SET metodo_pago=$1 WHERE id_pedido=$2',[actualMethod,order.id_pedido]);
  await client.query('UPDATE pagos SET estado_pago=$1,transaccion=$2,fecha_pago=now() WHERE id_pedido=$3',[transaction.status==='APPROVED'?'aprobado':'rechazado',transaction.id,order.id_pedido]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
