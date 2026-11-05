import { createChatHandler } from '../services/chat.js';
import { recommendationsFor } from "../services/recommendations.js";
import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken, isAdmin, verifySeller } from '../middlewares/auth.middleware.js';
import { asyncRoute, fail } from '../utils/http.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { getSellerOrder,getOrdersToDispatch } from '../controllers/sellerOrders.controller.js';
import { savePacking } from '../controllers/packing.controller.js';
import { saveShipment } from '../services/shipments.js';
import { listPublicStores, getPublicStore } from '../controllers/publicStores.controller.js';
const router=Router();
router.get('/pqr',verifyToken,asyncRoute(async(req,res)=>{
 const admin=req.user.rol==='admin';
 const {rows}=await pool.query(`SELECT p.*,u.nombre,u.correo FROM pqr p JOIN usuarios u USING(id_usuario) ${admin?'':'WHERE p.id_usuario=$1'} ORDER BY p.fecha_creacion DESC LIMIT 200`,admin?[]:[req.user.id]);
 res.json({ok:true,requests:rows});
}));
router.post('/pqr',verifyToken,rateLimit(10),asyncRoute(async(req,res)=>{
 const {tipo,asunto,descripcion}=req.body;
 if(!['peticion','queja','reclamo'].includes(tipo) || typeof asunto!=='string' || asunto.trim().length<5 || asunto.length>150 || typeof descripcion!=='string' || descripcion.trim().length<10 || descripcion.length>5000) throw fail(400,'Selecciona un tipo, asunto de 5 a 150 caracteres y descripción de 10 a 5000 caracteres.');
 const {rows}=await pool.query('INSERT INTO pqr(id_usuario,tipo,asunto,descripcion) VALUES($1,$2,$3,$4) RETURNING *',[req.user.id,tipo,asunto.trim(),descripcion.trim()]);res.status(201).json({ok:true,request:rows[0]});
}));
router.patch('/pqr/:id',verifyToken,isAdmin,asyncRoute(async(req,res)=>{
 const {estado,respuesta}=req.body;
 if(!['abierta','en_proceso','resuelta'].includes(estado) || typeof respuesta!=='string' || respuesta.length>5000 || (estado==='resuelta' && respuesta.trim().length<5)) throw fail(400,'Estado o respuesta inválidos. Para resolver una PQR debes responderla.');
 const {rows}=await pool.query('UPDATE pqr SET estado=$1,respuesta=$2,fecha_actualizacion=now() WHERE id_pqr=$3 RETURNING *',[estado,respuesta.trim(),req.params.id]);
 if(!rows.length) throw fail(404,'Solicitud no encontrada.'); res.json({ok:true,request:rows[0]});
}));
router.get('/marketplace',asyncRoute(listPublicStores));
router.get('/marketplace/:id',asyncRoute(getPublicStore));
router.post('/history',verifyToken,rateLimit(60),asyncRoute(async(req,res)=>{
 const id=Number(req.body.id_producto);if(!Number.isInteger(id)||id<1) throw fail(400,'Producto inválido.');
 await pool.query('INSERT INTO historial_navegacion(id_usuario,id_producto) SELECT $1,id_producto FROM productos WHERE id_producto=$2',[req.user.id,id]);res.json({ok:true});
}));
router.get('/recommendations',verifyToken,asyncRoute(async(req,res)=>{
  res.set('Cache-Control','no-store');
  res.json({ok:true,...await recommendationsFor(req.user.id)});
}));
router.get('/seller/orders/to-dispatch',verifyToken,verifySeller,asyncRoute(getOrdersToDispatch));
router.get('/seller/orders/:id',verifyToken,verifySeller,asyncRoute(getSellerOrder));
router.put('/seller/orders/:id/packing',verifyToken,verifySeller,asyncRoute(savePacking));
router.put('/seller/orders/:id/delivery',verifyToken,verifySeller,asyncRoute(saveShipment));
router.get('/seller/overview',verifyToken,verifySeller,asyncRoute(async(req,res)=>{
 const seller=(await pool.query('SELECT id_vendedor FROM vendedores WHERE id_usuario=$1',[req.user.id])).rows[0];
 if(!seller) throw fail(404,'Perfil de comerciante no encontrado.');
 const id=seller.id_vendedor;
 const [products,orders,monthly,today]=await Promise.all([
  pool.query('SELECT p.*,c.nombre AS categoria FROM productos p JOIN categorias c USING(id_categoria) WHERE id_vendedor=$1 ORDER BY p.fecha_creacion DESC',[id]),
  pool.query(`SELECT o.id_pedido,o.estado,o.tipo_entrega,o.fecha_creacion,(SELECT ambiente FROM pagos WHERE id_pedido=o.id_pedido) AS ambiente,SUM(d.subtotal) AS total, json_agg(json_build_object('nombre',d.nombre_producto,'cantidad',d.cantidad,'subtotal',d.subtotal)) AS items FROM pedidos o JOIN detalle_pedido d USING(id_pedido) JOIN productos p USING(id_producto) WHERE d.id_vendedor_compra=$1 GROUP BY o.id_pedido ORDER BY o.fecha_creacion DESC LIMIT 100`,[id]),
  pool.query(`SELECT to_char(date_trunc('month',o.fecha_creacion),'YYYY-MM') AS mes,SUM(d.subtotal) AS total FROM pedidos o JOIN detalle_pedido d USING(id_pedido) JOIN productos p USING(id_producto) WHERE d.id_vendedor_compra=$1 AND o.estado IN ('pagado','empacando','enviado','entregado') GROUP BY 1 ORDER BY 1`,[id]),
  pool.query(`SELECT COALESCE(SUM(d.subtotal),0) AS ingresos,COUNT(DISTINCT o.id_pedido)::int AS pedidos FROM pedidos o JOIN detalle_pedido d USING(id_pedido) JOIN productos p USING(id_producto) WHERE d.id_vendedor_compra=$1 AND o.estado IN ('pagado','empacando','enviado','entregado') AND (o.fecha_creacion AT TIME ZONE 'America/Bogota')::date=(now() AT TIME ZONE 'America/Bogota')::date`,[id])
 ]);
 res.json({ok:true,products:products.rows,orders:orders.rows,monthly:monthly.rows,today:today.rows[0]});
}));
router.post('/chat',rateLimit(6),asyncRoute(createChatHandler({db:pool})));
export default router;
