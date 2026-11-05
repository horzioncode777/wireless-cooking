import pool from '../config/db.js';
import { fail } from '../utils/http.js';

const defaults={pedidos:true,resenas:true,novedades:true};
export async function getSettings(req,res){
 const {rows}=await pool.query('SELECT pedidos,resenas,novedades FROM preferencias_usuario WHERE id_usuario=$1',[req.user.id]);
 res.set('Cache-Control','no-store');res.json({ok:true,preferences:rows[0]||defaults});
}
export async function updateSettings(req,res){
 const body=req.body;
 if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).length!==3||Object.keys(defaults).some(key=>typeof body[key]!=='boolean'))throw fail(400,'Selecciona las tres preferencias de notificaciones.');
 const {rows}=await pool.query(`INSERT INTO preferencias_usuario(id_usuario,pedidos,resenas,novedades) VALUES($1,$2,$3,$4) ON CONFLICT(id_usuario) DO UPDATE SET pedidos=EXCLUDED.pedidos,resenas=EXCLUDED.resenas,novedades=EXCLUDED.novedades,fecha_actualizacion=now() RETURNING pedidos,resenas,novedades`,[req.user.id,body.pedidos,body.resenas,body.novedades]);
 res.set('Cache-Control','no-store');res.json({ok:true,message:'Preferencias de notificaciones guardadas.',preferences:rows[0]});
}
