import pool from '../config/db.js';
import { fail } from '../utils/http.js';

// Only deliberately public fields leave this endpoint, including within JSON metadata.
const textFields=['lema','especialidad','historia','responsable_publico','direccion_publica','horario','correo_publico','telefono_publico','color','preparacion','politica_envio'];
export function publicProfile(value){
  const source=value && typeof value==='object' && !Array.isArray(value)?value:{};
  const profile={es_demo:source.es_demo===true};
  for(const field of textFields)if(typeof source[field]==='string')profile[field]=source[field].slice(0,6000);
  for(const field of ['valores','servicios','cobertura'])if(Array.isArray(source[field]))profile[field]=source[field].filter(item=>typeof item==='string').slice(0,20).map(item=>item.slice(0,250));
  if(Number.isInteger(source.fundacion))profile.fundacion=source.fundacion;
  return profile;
}
const storeQuery=`SELECT v.id_vendedor,v.nombre_tienda,v.descripcion,v.logo,v.banner_url,v.ciudad,v.verificado,v.perfil_publico,
 COUNT(DISTINCT p.id_producto)::int AS productos,COUNT(r.id_resena)::int AS resenas,
 COALESCE(ROUND(AVG(r.puntuacion)::numeric,1),0) AS calificacion
 FROM vendedores v JOIN usuarios u ON u.id_usuario=v.id_usuario
 LEFT JOIN productos p ON p.id_vendedor=v.id_vendedor AND lower(p.estado)='activo'
 LEFT JOIN resenas_producto r ON r.id_producto=p.id_producto
 WHERE u.estado='activo' AND u.rol='vendedor'`;
const serializeStore=row=>({...row,perfil_publico:publicProfile(row.perfil_publico)});

export async function listPublicStores(req,res){
  const {rows}=await pool.query(`${storeQuery} GROUP BY v.id_vendedor ORDER BY v.nombre_tienda`);
  res.set('Cache-Control','no-cache').json({ok:true,sellers:rows.map(serializeStore)});
}

export async function getPublicStore(req,res){
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<1)throw fail(400,'Tienda inválida.');
  const {rows}=await pool.query(`${storeQuery} AND v.id_vendedor=$1 GROUP BY v.id_vendedor`,[id]);
  if(!rows.length)throw fail(404,'Esta tienda no está disponible.');
  const products=await pool.query(`SELECT p.id_producto,p.nombre,p.descripcion,p.precio,p.stock,p.material,p.imagen,p.galeria,p.ficha,
   c.nombre AS categoria,COALESCE(ROUND(AVG(r.puntuacion)::numeric,1),0) AS calificacion,COUNT(r.id_resena)::int AS resenas
   FROM productos p JOIN categorias c USING(id_categoria) LEFT JOIN resenas_producto r USING(id_producto)
   WHERE p.id_vendedor=$1 AND lower(p.estado)='activo'
   GROUP BY p.id_producto,c.nombre ORDER BY p.fecha_creacion DESC,p.id_producto DESC LIMIT 100`,[id]);
  res.set('Cache-Control','no-cache').json({ok:true,seller:serializeStore(rows[0]),products:products.rows});
}
