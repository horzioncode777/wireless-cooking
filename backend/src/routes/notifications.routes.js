import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { asyncRoute, fail } from '../utils/http.js';

const router=Router();
router.use(verifyToken);
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/',asyncRoute(async(req,res)=>{
 const before=req.query.before;
 if(before && (!/^[1-9]\d{0,17}$/.test(before))) throw fail(400,'Cursor inválido.');
 const [list,count]=await Promise.all([
  pool.query(`SELECT id,tipo,titulo,mensaje,destino,nivel,leida_en,fecha_creacion FROM notificaciones WHERE id_usuario=$1 ${before?'AND id<$2':''} ORDER BY id DESC LIMIT 41`,before?[req.user.id,before]:[req.user.id]),
  pool.query('SELECT count(*)::int AS total FROM notificaciones WHERE id_usuario=$1 AND leida_en IS NULL',[req.user.id]),
 ]);
 const notifications=list.rows.slice(0,40);
 res.json({ok:true,notifications,unread:count.rows[0].total,nextCursor:list.rows.length>40?notifications.at(-1).id:null});
}));
router.patch('/read-all',asyncRoute(async(req,res)=>{
 // Only mark what the client has seen, preserving concurrently arriving events.
 const through=String(req.body.through||'');
 if(!/^[1-9]\d{0,17}$/.test(through)) throw fail(400,'Notificación inválida.');
 await pool.query('UPDATE notificaciones SET leida_en=now() WHERE id_usuario=$1 AND id<=$2 AND leida_en IS NULL',[req.user.id,through]);
 res.json({ok:true});
}));
router.patch('/:id/read',asyncRoute(async(req,res)=>{
 if(!/^[1-9]\d{0,17}$/.test(req.params.id)) throw fail(400,'Notificación inválida.');
 const {rows}=await pool.query('UPDATE notificaciones SET leida_en=COALESCE(leida_en,now()) WHERE id=$1 AND id_usuario=$2 RETURNING id,leida_en',[req.params.id,req.user.id]);
 if(!rows.length) throw fail(404,'Notificación no encontrada.');
 res.json({ok:true,notification:rows[0]});
}));
export default router;
