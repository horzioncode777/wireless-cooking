import pool from '../config/db.js';
import { fail } from '../utils/http.js';
import { paymentReceiptState } from '../../../shared/paymentReceipt.js';
import { shipmentsFor } from '../services/shipments.js';

export async function getOrdersToDispatch(req,res){
 const page=Number(req.query.page||1),limit=12;
 if(!Number.isInteger(page)||page<1||page>100000)throw fail(400,'Página inválida.');
 const seller=(await pool.query('SELECT id_vendedor,nombre_tienda FROM vendedores WHERE id_usuario=$1',[req.user.id])).rows[0];
 if(!seller)throw fail(404,'Perfil de comerciante no encontrado.');
 const source=`FROM pedidos o JOIN pagos pa USING(id_pedido) LEFT JOIN pedido_entregas s ON s.id_pedido=o.id_pedido AND s.id_vendedor=$1
 WHERE o.estado IN ('pagado','empacando') AND COALESCE(s.estado,o.estado) IN ('pagado','empacando')
 AND pa.estado_pago='aprobado' AND pa.monto=o.total AND pa.referencia=o.referencia AND NULLIF(trim(o.referencia),'') IS NOT NULL AND NULLIF(trim(pa.transaccion),'') IS NOT NULL
 AND EXISTS(SELECT 1 FROM detalle_pedido d WHERE d.id_pedido=o.id_pedido AND d.id_vendedor_compra=$1)`;
 const [count,orders]=await Promise.all([
  pool.query(`SELECT COUNT(*)::int total ${source}`,[seller.id_vendedor]),
  pool.query(`SELECT o.id_pedido,o.tipo_entrega,o.fecha_creacion,COALESCE(s.estado,o.estado) AS estado,pa.ambiente,
   (SELECT SUM(d.subtotal) FROM detalle_pedido d WHERE d.id_pedido=o.id_pedido AND d.id_vendedor_compra=$1) AS total,
   (SELECT json_agg(json_build_object('nombre',d.nombre_producto,'cantidad',d.cantidad) ORDER BY d.id_detalle) FROM detalle_pedido d WHERE d.id_pedido=o.id_pedido AND d.id_vendedor_compra=$1) AS items
   ${source} ORDER BY o.fecha_creacion,o.id_pedido LIMIT $2 OFFSET $3`,[seller.id_vendedor,limit,(page-1)*limit])
 ]);
 res.set('Cache-Control','no-store');res.json({ok:true,seller,orders:orders.rows,pagination:{page,limit,total:count.rows[0].total,pages:Math.ceil(count.rows[0].total/limit)}});
}

export async function getSellerOrder(req,res){
 const id=Number(req.params.id);
 if(!Number.isInteger(id)||id<1||id>2147483647)throw fail(400,'Pedido inválido.');
 const seller=(await pool.query(`SELECT v.id_vendedor,v.nombre_tienda,v.ciudad,u.telefono,u.direccion FROM vendedores v JOIN usuarios u USING(id_usuario) WHERE v.id_usuario=$1`,[req.user.id])).rows[0];
 if(!seller)throw fail(404,'Perfil de comerciante no encontrado.');
 const order=(await pool.query(`SELECT o.id_pedido,o.estado,o.total,o.referencia,o.tipo_entrega,o.fecha_creacion,o.direccion_entrega,o.transportadora,o.guia,o.fecha_estimada,o.nota_entrega,
   COALESCE(o.nombre_destinatario,trim(concat_ws(' ',u.nombre,u.apellido))) AS destinatario,COALESCE(o.telefono_entrega,u.telefono) AS telefono,
   (SELECT ambiente FROM pagos WHERE id_pedido=o.id_pedido) AS ambiente,
   EXISTS(SELECT 1 FROM detalle_pedido d JOIN productos p USING(id_producto) WHERE d.id_pedido=o.id_pedido AND d.id_vendedor_compra IS DISTINCT FROM $2::int) AS varias_tiendas
   FROM pedidos o JOIN usuarios u USING(id_usuario) WHERE o.id_pedido=$1 AND EXISTS(SELECT 1 FROM detalle_pedido d JOIN productos p USING(id_producto) WHERE d.id_pedido=o.id_pedido AND d.id_vendedor_compra=$2)`,[id,seller.id_vendedor])).rows[0];
 if(!order)throw fail(404,'Pedido no encontrado.');
 const items=(await pool.query(`SELECT d.id_detalle,d.id_producto,COALESCE(d.nombre_producto,p.nombre) AS nombre,d.cantidad,d.precio_unitario,d.subtotal,p.imagen FROM detalle_pedido d JOIN productos p USING(id_producto) WHERE d.id_pedido=$1 AND d.id_vendedor_compra=$2 ORDER BY d.id_detalle`,[id,seller.id_vendedor])).rows;
 const payment=(await pool.query('SELECT estado_pago,monto,referencia,transaccion FROM pagos WHERE id_pedido=$1',[id])).rows[0];
 const dispatchAllowed=paymentReceiptState(order,payment)==='confirmed';
 const recipient=dispatchAllowed?{nombre:order.destinatario,telefono:order.telefono,direccion:order.tipo_entrega==='recogida'?null:order.direccion_entrega}:null;
 const shipment=dispatchAllowed?(await shipmentsFor(pool,order)).find(row=>row.id_vendedor===seller.id_vendedor)||null:null;
 if(shipment){order.estado_general=order.estado;order.estado=shipment.estado;for(const field of ['transportadora','guia','fecha_estimada','nota_entrega'])order[field]=shipment[field];}
 delete order.destinatario;delete order.telefono;delete order.direccion_entrega;delete order.total;delete order.referencia;
 // Delivery instructions may contain contact data; reveal them only after payment.
 if(!dispatchAllowed){order.nota_entrega=null;order.guia=null;order.transportadora=null;order.fecha_estimada=null;}
 const history=(await pool.query(`SELECT id,estado,tipo,mensaje,fecha FROM pedido_historial WHERE id_pedido=$1 ORDER BY fecha,id`,[id])).rows;
 res.set('Cache-Control','no-store');
 const packing=dispatchAllowed?(await pool.query('SELECT * FROM pedido_empaque WHERE id_pedido=$1 AND id_vendedor=$2',[id,seller.id_vendedor])).rows[0]||null:null;
 res.json({ok:true,order,seller,recipient,items,history,dispatchAllowed,shipment,packing,total:items.reduce((sum,item)=>sum+Number(item.subtotal),0)});
}
