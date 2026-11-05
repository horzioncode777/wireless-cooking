import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import upload from '../middlewares/upload.middleware.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { asyncRoute,fail } from '../utils/http.js';
import { paymentReceiptState } from '../../../shared/paymentReceipt.js';

const router=Router();
router.use(verifyToken,(req,res,next)=>{res.set('Cache-Control','no-store');next();});
const integer=value=>{const id=Number(value);if(!Number.isInteger(id)||id<1||id>2147483647)throw fail(400,'Identificador inválido.');return id;};
const text=(value,min,max,label)=>{if(typeof value!=='string'||value.trim().length<min||value.length>max)throw fail(400,`Revisa ${label} (${min} a ${max} caracteres).`);return value.trim();};
const select=`SELECT c.*,d.nombre_producto AS producto,d.precio_unitario,v.nombre_tienda FROM postventa c JOIN detalle_pedido d ON d.id_detalle=c.id_detalle JOIN vendedores v ON v.id_vendedor=c.id_vendedor`;
async function access(db,id,user,lock=false){
 const row=(await db.query(`SELECT c.*,v.id_usuario AS vendedor_usuario FROM postventa c JOIN vendedores v USING(id_vendedor) WHERE c.id=$1 ${lock?'FOR UPDATE OF c':''}`,[integer(id)])).rows[0];
 if(!row||!(user.rol==='admin'||row.id_usuario===Number(user.id)||row.vendedor_usuario===Number(user.id)))throw fail(404,'Solicitud no encontrada.');return row;
}
async function event(db,row,user,message){
 await db.query('INSERT INTO postventa_historial(id_postventa,id_usuario,rol,estado,mensaje) VALUES($1,$2,$3,$4,$5)',[row.id,user.id,user.rol,row.estado,message]);
 const people=await db.query(`SELECT id_usuario FROM usuarios WHERE estado='activo' AND (rol='admin' OR id_usuario=$1 OR id_usuario=(SELECT id_usuario FROM vendedores WHERE id_vendedor=$2))`,[row.id_usuario,row.id_vendedor]);
 for(const person of people.rows)if(person.id_usuario!==Number(user.id))await db.query("SELECT avisar_usuario($1,'pqr',$2,$3,'/postventa?caso=' || $4::text,'info')",[person.id_usuario,`Postventa #${row.id} · Pedido #${row.id_pedido}`,message.slice(0,300),row.id]);
}
async function transaction(callback){const db=await pool.connect();try{await db.query('BEGIN');const result=await callback(db);await db.query('COMMIT');return result;}catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}}

router.get('/',asyncRoute(async(req,res)=>{
 const order=req.query.pedido===undefined?null:integer(req.query.pedido);
 const rows=await pool.query(`${select} WHERE ($1='admin' OR c.id_usuario=$2 OR v.id_usuario=$2) AND ($3::int IS NULL OR c.id_pedido=$3) ORDER BY c.fecha_actualizacion DESC,c.id DESC LIMIT 200`,[req.user.rol,req.user.id,order]);
 res.json({ok:true,cases:rows.rows});
}));
router.post('/',rateLimit(12),asyncRoute(async(req,res)=>{
 const detail=integer(req.body.id_detalle),quantity=integer(req.body.cantidad);
 const reason=req.body.motivo;if(!['defectuoso','incorrecto','incompleto','devolucion','garantia','otro'].includes(reason))throw fail(400,'Selecciona el motivo de tu solicitud.');
 const description=text(req.body.descripcion,10,3000,'la descripción');
 const row=await transaction(async db=>{
  const item=(await db.query(`SELECT d.*,d.id_vendedor_compra AS id_vendedor FROM detalle_pedido d JOIN productos p USING(id_producto) WHERE d.id_detalle=$1`,[detail])).rows[0];
  if(!item)throw fail(404,'Producto comprado no encontrado.');
  const order=(await db.query('SELECT * FROM pedidos WHERE id_pedido=$1 AND id_usuario=$2 FOR UPDATE',[item.id_pedido,req.user.id])).rows[0];
  if(!order)throw fail(404,'Producto comprado no encontrado.');
  const payment=(await db.query('SELECT * FROM pagos WHERE id_pedido=$1',[order.id_pedido])).rows[0];
  if(paymentReceiptState(order,payment)!=='confirmed')throw fail(409,'La postventa requiere un pedido con pago confirmado. Para pagos rechazados o pendientes utiliza PQR.');
  if(quantity>item.cantidad)throw fail(400,'La cantidad supera las unidades compradas.');
  if((await db.query('SELECT id FROM postventa WHERE id_detalle=$1',[detail])).rowCount)throw fail(409,'Este producto ya tiene una solicitud. Continúa en el caso existente.');
  const created=(await db.query('INSERT INTO postventa(id_pedido,id_detalle,id_usuario,id_vendedor,cantidad,motivo,descripcion,ambiente) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[item.id_pedido,detail,req.user.id,item.id_vendedor,quantity,reason,description,payment.ambiente||'sin_registrar'])).rows[0];
  await event(db,created,req.user,'Solicitud registrada. Motivo: '+reason+'.');return created;
 });res.status(201).json({ok:true,case:row});
}));
router.get('/:id',asyncRoute(async(req,res)=>{
 const row=await access(pool,req.params.id,req.user);
 const detail=(await pool.query(`${select} WHERE c.id=$1`,[row.id])).rows[0];
 const history=(await pool.query('SELECT id,rol,estado,mensaje,fecha FROM postventa_historial WHERE id_postventa=$1 ORDER BY id',[row.id])).rows;
 const evidence=(await pool.query('SELECT id,mime,fecha FROM postventa_evidencias WHERE id_postventa=$1 ORDER BY id',[row.id])).rows;
 res.json({ok:true,case:detail,history,evidence,canManage:req.user.rol==='admin',isBuyer:row.id_usuario===Number(req.user.id)});
}));
router.post('/:id/messages',rateLimit(30),asyncRoute(async(req,res)=>{
 const message=text(req.body.mensaje,5,3000,'el mensaje');
 await transaction(async db=>{const row=await access(db,req.params.id,req.user,true);if(['resuelta','rechazada'].includes(row.estado))throw fail(409,'El caso está cerrado. Solicita reapertura a soporte mediante PQR.');await event(db,row,req.user,message);await db.query('UPDATE postventa SET fecha_actualizacion=now() WHERE id=$1',[row.id]);});res.json({ok:true});
}));
router.patch('/:id',asyncRoute(async(req,res)=>{
 if(req.user.rol!=='admin')throw fail(403,'Solo administración puede decidir o conciliar una solicitud.');
 const message=text(req.body.mensaje,10,3000,'la respuesta');
 await transaction(async db=>{
  const row=await access(db,req.params.id,req.user,true);
  if(req.body.version!==row.version)throw fail(409,'La solicitud cambió. Actualiza antes de guardar.');
  const state=req.body.estado;
  const transitions={abierta:['en_revision'],en_revision:['aprobada','rechazada'],aprobada:row.requiere_devolucion?[]:['reembolso_pendiente','resuelta'],en_devolucion:['recibida'],recibida:['reembolso_pendiente','resuelta'],reembolso_pendiente:['resuelta'],resuelta:[],rechazada:['en_revision']};
  if(!transitions[row.estado]?.includes(state))throw fail(409,'Ese cambio no corresponde al paso actual.');
  let solution=row.solucion,required=row.requiere_devolucion;
  if(state==='aprobada'){
   solution=req.body.solucion;required=req.body.requiere_devolucion;
   if(!['reembolso','cambio','garantia','orientacion'].includes(solution)||typeof required!=='boolean')throw fail(400,'Indica la solución y si requiere devolución física.');
  }
  if(state==='reembolso_pendiente'&&solution!=='reembolso')throw fail(409,'La solución aprobada no es un reembolso.');
  if(state==='resuelta'&&solution==='reembolso'&&!row.referencia_reembolso)throw fail(409,'Registra la conciliación del reembolso antes de cerrar.');
  const updated=(await db.query('UPDATE postventa SET estado=$2,solucion=$3,requiere_devolucion=$4,version=version+1,fecha_actualizacion=now() WHERE id=$1 RETURNING *',[row.id,state,solution,required])).rows[0];await event(db,updated,req.user,message);
 });res.json({ok:true});
}));
router.post('/:id/return',asyncRoute(async(req,res)=>{
 const carrier=text(req.body.transportadora,2,100,'la transportadora o entrega acordada'),guide=text(req.body.guia,3,100,'la guía o referencia de entrega');
 await transaction(async db=>{const row=await access(db,req.params.id,req.user,true);
  if(row.id_usuario!==Number(req.user.id)&&req.user.rol!=='admin')throw fail(403,'Solo el comprador o administración puede registrar la devolución.');
  if(row.estado!=='aprobada'||!row.requiere_devolucion)throw fail(409,'La devolución debe estar aprobada y pendiente de envío.');
  const updated=(await db.query("UPDATE postventa SET estado='en_devolucion',transportadora=$2,guia=$3,version=version+1,fecha_actualizacion=now() WHERE id=$1 RETURNING *",[row.id,carrier,guide])).rows[0];await event(db,updated,req.user,`Devolución registrada: ${carrier}, referencia ${guide}. Pendiente de recepción.`);
 });res.json({ok:true});
}));
router.post('/:id/refund',asyncRoute(async(req,res)=>{
 if(req.user.rol!=='admin')throw fail(403,'Solo administración puede registrar la conciliación.');
 const reference=text(req.body.referencia,5,120,'la referencia externa'),note=text(req.body.mensaje,15,3000,'el soporte de conciliación');
 const amount=req.body.monto;
 if(typeof amount!=='number'||!Number.isFinite(amount)||amount<=0||Math.abs(amount*100-Math.round(amount*100))>0.00001||req.body.confirmado!==true)throw fail(400,'Indica un monto válido y confirma la conciliación externa.');
 await transaction(async db=>{
  const row=await access(db,req.params.id,req.user,true);
  if(row.referencia_reembolso)throw fail(409,'La conciliación ya fue registrada.');
  if(row.estado!=='reembolso_pendiente'||row.solucion!=='reembolso')throw fail(409,'El caso todavía no está pendiente de reembolso.');
  const item=(await db.query('SELECT precio_unitario FROM detalle_pedido WHERE id_detalle=$1',[row.id_detalle])).rows[0];
  const cents=Math.round(amount*100),limit=Math.round(Number(item.precio_unitario)*row.cantidad*100);
  if(cents>limit)throw fail(400,'El reembolso supera el valor de los productos reclamados. El flete se concilia por separado con soporte.');
  const payment=(await db.query('SELECT estado_pago FROM pagos WHERE id_pedido=$1',[row.id_pedido])).rows[0];
  if(payment?.estado_pago!=='aprobado')throw fail(409,'Revisa el pago antes de conciliar.');
  const ref=(row.ambiente==='prod'?'PROD:':'PRUEBA:')+reference;
  if((await db.query('SELECT id FROM postventa WHERE referencia_reembolso=$1',[ref])).rowCount)throw fail(409,'La referencia ya está registrada en otro caso.');
  await db.query('UPDATE postventa SET monto_reembolso=$2,referencia_reembolso=$3,fecha_reembolso=now(),version=version+1,fecha_actualizacion=now() WHERE id=$1',[row.id,amount,ref]);
  await event(db,row,req.user,`${row.ambiente==='prod'?'Conciliación externa registrada por administración':'SIMULACIÓN de conciliación; no se devolvió dinero real'}: ${amount} COP. Referencia: ${reference}. ${note}`);
 });res.json({ok:true});
}));
router.post('/:id/evidence',rateLimit(20),asyncRoute(async(req,res,next)=>{await access(pool,req.params.id,req.user);next();}),upload.single('imagen'),asyncRoute(async(req,res)=>{
 const file=req.file;if(!file)throw fail(400,'Selecciona una imagen.');
 const bytes=file.buffer;
 const valid=file.mimetype==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):file.mimetype==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
 if(!valid)throw fail(400,'El contenido no corresponde a una imagen permitida.');
 await transaction(async db=>{const row=await access(db,req.params.id,req.user,true);
  if(['resuelta','rechazada'].includes(row.estado))throw fail(409,'No se pueden adjuntar evidencias a un caso cerrado.');
  const count=(await db.query('SELECT COUNT(*)::int total FROM postventa_evidencias WHERE id_postventa=$1',[row.id])).rows[0].total;
  if(count>=6)throw fail(409,'Cada caso admite hasta seis imágenes.');
  await db.query('INSERT INTO postventa_evidencias(id_postventa,id_usuario,mime,datos) VALUES($1,$2,$3,$4)',[row.id,req.user.id,file.mimetype,bytes]);await event(db,row,req.user,'Se adjuntó una fotografía como evidencia privada.');
 });res.status(201).json({ok:true});
}));
router.get('/:id/evidence/:evidence',asyncRoute(async(req,res)=>{
 await access(pool,req.params.id,req.user);
 const row=(await pool.query('SELECT mime,datos FROM postventa_evidencias WHERE id=$1 AND id_postventa=$2',[integer(req.params.evidence),integer(req.params.id)])).rows[0];
 if(!row)throw fail(404,'Evidencia no encontrada.');res.set({'Content-Type':row.mime,'Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'"}).send(row.datos);
}));
export default router;
