import pool from '../config/db.js';
import { fail } from '../utils/http.js';
import { paymentReceiptState } from '../../../shared/paymentReceipt.js';
import { validateDelivery } from './orders.js';
export const deliveryStates=['pagado','empacando','enviado','entregado'];
const idOf=value=>{const id=Number(value);if(!Number.isInteger(id)||id<1||id>2147483647)throw fail(400,'Pedido o tienda inválidos.');return id;};
const effectiveState=(order,state)=>deliveryStates[Math.max(deliveryStates.indexOf(order.estado),deliveryStates.indexOf(state))]||order.estado;
export function validateContact(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.nombre!=='string'||body.nombre.trim().length<2||body.nombre.length>150||typeof body.telefono!=='string'||!/^\+?[0-9 ()-]{7,25}$/.test(body.telefono)||body.telefono.replace(/\D/g,'').length<7||body.telefono.replace(/\D/g,'').length>15)throw fail(400,'Indica el nombre del destinatario y un teléfono válido de 7 a 15 dígitos.');
 return {nombre:body.nombre.trim(),telefono:body.telefono.trim()};
}
export async function shipmentsFor(db,order){
 const rows=(await db.query(`SELECT v.id_vendedor,v.nombre_tienda,s.estado,s.transportadora,s.guia,s.fecha_estimada,s.nota_entrega,s.version,s.fecha_actualizacion,r.fecha AS recepcion_confirmada FROM vendedores v LEFT JOIN pedido_entregas s ON s.id_vendedor=v.id_vendedor AND s.id_pedido=$1 LEFT JOIN monedero_recepciones r ON r.id_pedido=$1 AND r.id_vendedor=v.id_vendedor WHERE EXISTS(SELECT 1 FROM detalle_pedido d JOIN productos p USING(id_producto) WHERE d.id_pedido=$1 AND d.id_vendedor_compra=v.id_vendedor) ORDER BY v.id_vendedor`,[order.id_pedido])).rows;
 return rows.map(row=>({...row,estado:effectiveState(order,row.estado),version:row.version||0,...(row.version===null&&rows.length===1?{transportadora:order.transportadora,guia:order.guia,fecha_estimada:order.fecha_estimada,nota_entrega:order.nota_entrega}:{}),tipo_entrega:order.tipo_entrega}));
}
async function notify(db,order,shop,message){
 await db.query("SELECT avisar_usuario($1,'pedido',$2,$3,$4,'info')",[order.id_usuario,`Entrega · ${shop.nombre_tienda}`,message,`/pedido/${order.id_pedido}`]);
 const admins=(await db.query("SELECT id_usuario FROM usuarios WHERE rol='admin' AND estado='activo'")).rows;
 for(const admin of admins)await db.query("SELECT avisar_usuario($1,'pedido',$2,$3,'/admin/pedidos','info')",[admin.id_usuario,`Despacho del pedido #${order.id_pedido}`,message]);
}
export async function saveShipment(req,res){
 const id=idOf(req.params.id),fields=validateDelivery(req.body),state=req.body.estado,version=req.body.version;
 if(!deliveryStates.includes(state)||!Number.isInteger(version)||version<0)throw fail(400,'Revisa el estado de entrega.');
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const order=(await db.query('SELECT * FROM pedidos WHERE id_pedido=$1 FOR UPDATE',[id])).rows[0];
  const seller=req.user.rol==='admin'&&req.params.seller?(await db.query('SELECT id_vendedor,nombre_tienda FROM vendedores WHERE id_vendedor=$1',[idOf(req.params.seller)])).rows[0]:(await db.query('SELECT id_vendedor,nombre_tienda FROM vendedores WHERE id_usuario=$1',[req.user.id])).rows[0];
  if(!order||!seller||!(await db.query('SELECT 1 FROM detalle_pedido d JOIN productos p USING(id_producto) WHERE d.id_pedido=$1 AND d.id_vendedor_compra=$2',[id,seller.id_vendedor])).rowCount)throw fail(404,'Pedido no encontrado.');
  const payment=(await db.query('SELECT * FROM pagos WHERE id_pedido=$1',[id])).rows[0];
  if(paymentReceiptState(order,payment)!=='confirmed')throw fail(409,'Primero debe confirmarse el pago de este pedido.');
  const shipments=await shipmentsFor(db,order),old=shipments.find(row=>row.id_vendedor===seller.id_vendedor);
  if(version!==old.version)throw fail(409,'Otra sesión cambió la entrega. Actualiza el pedido antes de guardar.');
  const previousIndex=deliveryStates.indexOf(old.estado),nextIndex=deliveryStates.indexOf(state);
  const directDispatch=old.estado==='pagado'&&state==='enviado';
  if(nextIndex<previousIndex||nextIndex>previousIndex+1&&!directDispatch)throw fail(409,'Confirma primero el pago, después el envío y finalmente la recepción.');
  if(old.estado==='entregado')throw fail(409,'La entrega ya está finalizada.');
  if(order.tipo_entrega==='recogida'&&(fields.guia||fields.transportadora))throw fail(400,'En recogida registra el punto y horario, sin transportadora ni guía.');
  if(nextIndex>=2&&(!fields.fecha_estimada||(order.tipo_entrega==='recogida'?!fields.nota_entrega:!fields.transportadora||!fields.guia)))throw fail(400,order.tipo_entrega==='recogida'?'Indica fecha, punto y horario de recogida antes de marcarla lista.':'Registra transportadora, guía y fecha antes de marcar el envío.');
  if(nextIndex>=2){const buyer=(await db.query("SELECT COALESCE($2,trim(concat_ws(' ',nombre,apellido))) AS nombre,COALESCE($3,telefono) AS telefono FROM usuarios WHERE id_usuario=$1",[order.id_usuario,order.nombre_destinatario,order.telefono_entrega])).rows[0];try{validateContact(buyer);}catch{throw fail(409,'El comprador debe completar su nombre y teléfono de entrega antes del despacho.');}}
  if(old.estado===state&&['transportadora','guia','nota_entrega'].every(key=>(old[key]||null)===fields[key])&&(old.fecha_estimada?new Date(old.fecha_estimada).toISOString().slice(0,10):null)===fields.fecha_estimada){await db.query('COMMIT');return res.json({ok:true,shipment:old,message:'La entrega ya estaba guardada.'});}
  await db.query(`INSERT INTO pedido_entregas(id_pedido,id_vendedor,estado,transportadora,guia,fecha_estimada,nota_entrega,version) VALUES($1,$2,$3,$4,$5,$6,$7,1) ON CONFLICT(id_pedido,id_vendedor) DO UPDATE SET estado=$3,transportadora=$4,guia=$5,fecha_estimada=$6,nota_entrega=$7,version=pedido_entregas.version+1,fecha_actualizacion=now()`,[id,seller.id_vendedor,state,fields.transportadora,fields.guia,fields.fecha_estimada,fields.nota_entrega]);
  const all=await shipmentsFor(db,order);
  // Merchandise without a merchant remains under central administration.
  const central=(await db.query('SELECT 1 FROM detalle_pedido d JOIN productos p USING(id_producto) WHERE d.id_pedido=$1 AND d.id_vendedor_compra IS NULL',[id])).rowCount;
  const index=Math.min(...all.map(row=>deliveryStates.indexOf(row.estado)),...(central?[deliveryStates.indexOf(order.estado)]:[]));
  if(index>deliveryStates.indexOf(order.estado))await db.query('UPDATE pedidos SET estado=$2,fecha_actualizacion=now() WHERE id_pedido=$1',[id,deliveryStates[index]]);
  const message=`Pedido #${id} · ${seller.nombre_tienda}: ${state==='enviado'&&order.tipo_entrega==='recogida'?'listo para recoger':state}. Consulta fecha, guía e instrucciones en el pedido.`;
  await db.query("INSERT INTO pedido_historial(id_pedido,estado,tipo,mensaje) VALUES($1,$2,'entrega',$3)",[id,state,message]);
  await notify(db,order,seller,message);await db.query('COMMIT');res.json({ok:true,shipment:all.find(row=>row.id_vendedor===seller.id_vendedor)});
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
export async function saveContact(req,res){
 const id=idOf(req.params.id),contact=validateContact(req.body),address=req.body.direccion;
 if(typeof address!=='string'||address.trim().length<8||address.length>500)throw fail(400,'Indica la dirección completa o el punto acordado.');
 const db=await pool.connect();try{
  await db.query('BEGIN');const order=(await db.query('SELECT * FROM pedidos WHERE id_pedido=$1 AND id_usuario=$2 FOR UPDATE',[id,req.user.id])).rows[0];
  if(!order)throw fail(404,'Pedido no encontrado.');
  if(!['pendiente','pagado','empacando'].includes(order.estado)||(await db.query("SELECT 1 FROM pedido_entregas WHERE id_pedido=$1 AND estado IN ('enviado','entregado')",[id])).rowCount)throw fail(409,'El pedido ya está en entrega. Contacta con soporte para cambiar los datos.');
  const changed=await db.query('UPDATE pedidos SET nombre_destinatario=$2,telefono_entrega=$3,direccion_entrega=$4,fecha_actualizacion=now() WHERE id_pedido=$1 AND ROW(nombre_destinatario,telefono_entrega,direccion_entrega) IS DISTINCT FROM ROW($2::text,$3::text,$4::text) RETURNING id_pedido',[id,contact.nombre,contact.telefono,address.trim()]);
  if(changed.rowCount){
   await db.query("INSERT INTO pedido_historial(id_pedido,estado,tipo,mensaje) VALUES($1,$2,'entrega','El comprador actualizó el contacto de entrega.')",[id,order.estado]);
   const sellers=(await db.query('SELECT DISTINCT v.id_usuario FROM detalle_pedido d JOIN productos p USING(id_producto) JOIN vendedores v ON v.id_vendedor=d.id_vendedor_compra WHERE d.id_pedido=$1',[id])).rows;
   for(const seller of sellers)await db.query("SELECT avisar_usuario($1,'venta','Contacto de entrega actualizado',$2,$3,'info')",[seller.id_usuario,`Pedido #${id}: revisa el contacto antes de despachar.`,`/vendedor/pedido/${id}`]);
  }await db.query('COMMIT');res.json({ok:true});
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
