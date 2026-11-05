import pool from '../config/db.js';
import { fail } from '../utils/http.js';

function productId(value){const id=Number(value);if(!Number.isInteger(id)||id<1||id>2147483647)throw fail(400,'Producto inválido.');return id;}
async function findProduct(id){
 const product=(await pool.query(`SELECT p.id_producto,v.id_usuario AS propietario FROM productos p LEFT JOIN vendedores v USING(id_vendedor) LEFT JOIN usuarios u ON u.id_usuario=v.id_usuario WHERE p.id_producto=$1 AND lower(p.estado)='activo' AND (p.id_vendedor IS NULL OR u.estado='activo')`,[id])).rows[0];
 if(!product)throw fail(404,'Producto no disponible.');return product;
}
export async function upsertReview(req,res){
 const id=productId(req.body.productId),rating=req.body.puntuacion,comment=req.body.comentario;
 if(typeof rating!=='number'||!Number.isInteger(rating)||rating<1||rating>5)throw fail(400,'Selecciona entre 1 y 5 estrellas enteras.');
 if(comment!==undefined&&comment!==null&&(typeof comment!=='string'||comment.length>2000))throw fail(400,'El comentario debe ser texto de máximo 2000 caracteres.');
 const product=await findProduct(id);
 if(product.propietario===req.user.id)throw fail(403,'No puedes calificar los productos de tu propia tienda.');
 const values=[id,req.user.id,rating,typeof comment==='string'?comment.trim()||null:null];
 const result=await pool.query(`INSERT INTO resenas_producto(id_producto,id_usuario,puntuacion,comentario) VALUES($1,$2,$3,$4)
  ON CONFLICT(id_producto,id_usuario) DO UPDATE SET puntuacion=EXCLUDED.puntuacion,comentario=EXCLUDED.comentario,fecha_actualizacion=now()
  WHERE ROW(resenas_producto.puntuacion,resenas_producto.comentario) IS DISTINCT FROM ROW(EXCLUDED.puntuacion,EXCLUDED.comentario) RETURNING *`,values);
 const review=result.rows[0]||(await pool.query('SELECT * FROM resenas_producto WHERE id_producto=$1 AND id_usuario=$2',[id,req.user.id])).rows[0];
 res.set('Cache-Control','no-store');res.json({ok:true,message:'Tu calificación se guardó correctamente.',review});
}
export async function getMyProductReview(req,res){
 const id=productId(req.params.id),product=await findProduct(id);
 const review=(await pool.query('SELECT id_resena,puntuacion,comentario,fecha_actualizacion FROM resenas_producto WHERE id_producto=$1 AND id_usuario=$2',[id,req.user.id])).rows[0]||null;
 res.set('Cache-Control','no-store');res.json({ok:true,review,canReview:product.propietario!==req.user.id});
}
export async function getProductReviews(req,res){
 const id=productId(req.params.id);await findProduct(id);
 const {rows}=await pool.query(`SELECT r.id_resena,r.id_producto,r.id_usuario,r.puntuacion,r.comentario,r.fecha_creacion,r.fecha_actualizacion,u.nombre,u.apellido,u.foto FROM resenas_producto r JOIN usuarios u USING(id_usuario) WHERE r.id_producto=$1 ORDER BY r.fecha_actualizacion DESC,r.id_resena DESC LIMIT 50`,[id]);
 const summary=(await pool.query('SELECT COUNT(*)::int AS total,COALESCE(ROUND(AVG(puntuacion)::numeric,1),0) AS average FROM resenas_producto WHERE id_producto=$1',[id])).rows[0];
 res.set('Cache-Control','no-store');res.json({ok:true,reviews:rows,summary});
}
