import pool from '../config/db.js';
import { fail } from '../utils/http.js';
import { paymentReceiptState } from '../../../shared/paymentReceipt.js';

export async function savePacking(req,res){
 const id=Number(req.params.id),body=req.body;
 if(!Number.isInteger(id)||id<1||id>2147483647)throw fail(400,'Pedido inválido.');
 if(!Number.isInteger(body.bultos)||body.bultos<1||body.bultos>100||!Number.isInteger(body.version)||body.version<0||typeof body.fragil!=='boolean')throw fail(400,'Revisa bultos y datos del empaque.');
 for(const name of ['peso','alto','ancho','largo'])if(body[name]!==null&&(typeof body[name]!=='number'||!Number.isFinite(body[name])||body[name]<=0||body[name]>99999))throw fail(400,'Peso y medidas deben ser positivos o quedar vacíos.');
 for(const [name,max]of [['preparado_por',100],['notas',1000]])if(typeof body[name]!=='string'||body[name].length>max)throw fail(400,'Revisa el responsable y las notas.');
 if(!Array.isArray(body.revisados)||body.revisados.length>200||body.revisados.some(value=>!Number.isInteger(value)))throw fail(400,'La revisión de productos no es válida.');
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const seller=(await db.query('SELECT id_vendedor FROM vendedores WHERE id_usuario=$1',[req.user.id])).rows[0];
  if(!seller)throw fail(404,'Tienda no encontrada.');
  const order=(await db.query('SELECT * FROM pedidos WHERE id_pedido=$1 FOR UPDATE',[id])).rows[0];
  const items=(await db.query('SELECT d.id_detalle FROM detalle_pedido d JOIN productos p USING(id_producto) WHERE d.id_pedido=$1 AND d.id_vendedor_compra=$2',[id,seller.id_vendedor])).rows;
  if(!order||!items.length)throw fail(404,'Pedido no encontrado.');
  const payment=(await db.query('SELECT * FROM pagos WHERE id_pedido=$1',[id])).rows[0];
  if(paymentReceiptState(order,payment)!=='confirmed'||!['pagado','empacando'].includes(order.estado))throw fail(409,'El empaque solo se edita con pago confirmado y antes del envío.');
  if((await db.query("SELECT 1 FROM pedido_entregas WHERE id_pedido=$1 AND id_vendedor=$2 AND estado IN ('enviado','entregado')",[id,seller.id_vendedor])).rowCount)throw fail(409,'Los productos de tu tienda ya están en entrega; el empaque queda en consulta.');
  if(body.revisados.some(value=>!items.some(item=>item.id_detalle===value)))throw fail(400,'Solo puedes revisar productos de tu tienda.');
  const existing=(await db.query('SELECT version FROM pedido_empaque WHERE id_pedido=$1 AND id_vendedor=$2',[id,seller.id_vendedor])).rows[0];
  if(body.version!==(existing?.version||0))throw fail(409,'Otra sesión actualizó el empaque. Recarga antes de guardar.');
  const packing=(await db.query(`INSERT INTO pedido_empaque(id_pedido,id_vendedor,bultos,peso,alto,ancho,largo,preparado_por,notas,fragil,revisados,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1) ON CONFLICT(id_pedido,id_vendedor) DO UPDATE SET bultos=$3,peso=$4,alto=$5,ancho=$6,largo=$7,preparado_por=$8,notas=$9,fragil=$10,revisados=$11,version=pedido_empaque.version+1,fecha_actualizacion=now() RETURNING *`,[id,seller.id_vendedor,body.bultos,body.peso,body.alto,body.ancho,body.largo,body.preparado_por.trim(),body.notas.trim(),body.fragil,JSON.stringify([...new Set(body.revisados)])])).rows[0];
  await db.query('COMMIT');res.json({ok:true,packing});
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
