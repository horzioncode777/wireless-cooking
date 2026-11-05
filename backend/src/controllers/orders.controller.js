import pool from '../config/db.js';
import { fail } from '../utils/http.js';

export const getOrders=async(req,res,next)=>{
 try {
  const {q='',estado='',page='1'}=req.query;
  if(typeof q!=='string'||q.length>120||typeof estado!=='string'||!['','pendiente','pagado','empacando','enviado','entregado','cancelado'].includes(estado)||typeof page!=='string'||!/^\d{1,6}$/.test(page)||Number(page)<1)throw fail(400,'Los filtros de pedidos no son válidos.');
  const query=q.trim().replace(/^#/,'');
  const values=[req.user.id,estado,query,`%${query}%`];
  const where=`o.id_usuario=$1 AND ($2='' OR o.estado=$2) AND ($3='' OR o.id_pedido::text=$3 OR o.referencia ILIKE $4 OR EXISTS(SELECT 1 FROM detalle_pedido d WHERE d.id_pedido=o.id_pedido AND d.nombre_producto ILIKE $4))`;
  const count=await pool.query(`SELECT COUNT(*)::int AS total FROM pedidos o WHERE ${where}`,values);
  const summary=await pool.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE estado='pendiente')::int AS pendientes,COUNT(*) FILTER(WHERE estado IN ('pagado','empacando','enviado'))::int AS en_curso,COUNT(*) FILTER(WHERE estado='entregado')::int AS entregados FROM pedidos WHERE id_usuario=$1`,[req.user.id]);
  const {rows}=await pool.query(`SELECT o.*,p.estado_pago,p.ambiente,p.transaccion,
    COALESCE((SELECT SUM(d.cantidad)::int FROM detalle_pedido d WHERE d.id_pedido=o.id_pedido),0) AS unidades,
    COALESCE((SELECT json_agg(item ORDER BY item.id_detalle) FROM (SELECT d.id_detalle,d.id_producto,COALESCE(d.nombre_producto,pr.nombre,'Producto') AS nombre,d.cantidad,pr.imagen,v.nombre_tienda FROM detalle_pedido d LEFT JOIN productos pr USING(id_producto) LEFT JOIN vendedores v ON v.id_vendedor=pr.id_vendedor WHERE d.id_pedido=o.id_pedido ORDER BY d.id_detalle LIMIT 3) item),'[]'::json) AS productos
    FROM pedidos o LEFT JOIN pagos p USING(id_pedido) WHERE ${where} ORDER BY o.fecha_creacion DESC,o.id_pedido DESC LIMIT 12 OFFSET $5`,[...values,(Number(page)-1)*12]);
  res.set('Cache-Control','no-store');
  res.json({ok:true,orders:rows,summary:summary.rows[0],pagination:{page:Number(page),pageSize:12,total:count.rows[0].total,pages:Math.ceil(count.rows[0].total/12)}});
 }catch(error){next(error);}
};
