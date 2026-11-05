import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { asyncRoute,fail } from '../utils/http.js';
import { paymentReceiptState } from '../../../shared/paymentReceipt.js';
import { shipmentsFor } from '../services/shipments.js';

const router=Router();
router.use(verifyToken,(req,res,next)=>{res.set('Cache-Control','no-store');next();});
const id=value=>{const result=Number(value);if(!Number.isInteger(result)||result<1||result>2147483647)throw fail(400,'Referencia de guía inválida.');return result;};
const reference=(kind,value,seller)=>`WC-${kind}-${String(value).padStart(6,'0')}-T${seller}`;

async function guide(req,returning){
 return pool.connect().then(async db=>{
  try{
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   let claim;
   if(returning){claim=(await db.query('SELECT * FROM postventa WHERE id=$1',[id(req.params.id)])).rows[0];if(!claim)throw fail(404,'Guía no encontrada.');}
   const orderId=claim?.id_pedido||id(req.params.id),sellerId=claim?.id_vendedor||id(req.params.seller);
   const order=(await db.query(`SELECT o.*,COALESCE(o.nombre_destinatario,trim(concat_ws(' ',u.nombre,u.apellido))) AS destinatario,COALESCE(o.telefono_entrega,u.telefono) AS telefono FROM pedidos o JOIN usuarios u USING(id_usuario) WHERE o.id_pedido=$1`,[orderId])).rows[0];
   const seller=(await db.query('SELECT v.id_vendedor,v.id_usuario,v.nombre_tienda,v.ciudad,u.direccion,u.telefono FROM vendedores v JOIN usuarios u USING(id_usuario) WHERE v.id_vendedor=$1',[sellerId])).rows[0];
   if(!order||!seller||![order.id_usuario,seller.id_usuario].includes(Number(req.user.id))&&req.user.rol!=='admin')throw fail(404,'Guía no encontrada.');
   const items=(await db.query(`SELECT d.id_detalle,d.nombre_producto AS nombre,d.cantidad FROM detalle_pedido d WHERE d.id_pedido=$1 AND d.id_vendedor_compra=$2 AND ($3::int IS NULL OR d.id_detalle=$3) ORDER BY d.id_detalle`,[orderId,sellerId,claim?.id_detalle||null])).rows;
   if(!items.length)throw fail(404,'Guía no encontrada.');
   const payment=(await db.query('SELECT * FROM pagos WHERE id_pedido=$1',[orderId])).rows[0];
   if(paymentReceiptState(order,payment)!=='confirmed')throw fail(409,'La guía requiere un pago confirmado.');
   if(returning&&(!claim.requiere_devolucion||!['aprobada','en_devolucion','recibida','reembolso_pendiente','resuelta'].includes(claim.estado)))throw fail(409,'La guía de devolución se habilita cuando se aprueba el envío del producto.');
   if(!returning&&order.tipo_entrega==='recogida')throw fail(409,'Este pedido se recoge en tienda y no requiere una guía de envío.');
   const shipment=returning?claim:(await shipmentsFor(db,order)).find(row=>row.id_vendedor===sellerId);
   const buyerContact={nombre:order.destinatario,telefono:order.telefono,direccion:order.direccion_entrega};
   const shopContact={nombre:seller.nombre_tienda,telefono:seller.telefono,direccion:[seller.direccion,seller.ciudad].filter(Boolean).join(', ')};
   const missing=[];
   if(!seller.direccion?.trim())missing.push('La tienda debe completar su dirección en el perfil.');
   if(!seller.telefono?.trim())missing.push('La tienda debe completar su teléfono en el perfil.');
   if(!buyerContact.nombre?.trim()||!buyerContact.telefono?.trim()||!buyerContact.direccion?.trim())missing.push('Completa el nombre, teléfono y dirección del comprador antes del envío.');
   const result={reference:reference(returning?'DEV':'ENV',returning?claim.id:orderId,sellerId),kind:returning?'devolucion':'envio',orderId,caseId:claim?.id||null,sellerId,environment:payment.ambiente||'sin_registrar',sender:returning?buyerContact:shopContact,recipient:returning?shopContact:buyerContact,items:items.map(item=>({...item,cantidad:returning?claim.cantidad:item.cantidad})),carrier:shipment?.transportadora||null,tracking:shipment?.guia||null,missing,ready:missing.length===0};
   await db.query('COMMIT');return result;
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 });
}
router.get('/orders/:id/:seller',asyncRoute(async(req,res)=>res.json({ok:true,guide:await guide(req,false)})));
router.get('/returns/:id',asyncRoute(async(req,res)=>res.json({ok:true,guide:await guide(req,true)})));
export default router;
