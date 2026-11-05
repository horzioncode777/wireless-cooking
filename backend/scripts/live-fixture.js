import 'dotenv/config';
import pool from '../src/config/db.js';
import { readFile,writeFile,mkdir,unlink } from 'node:fs/promises';
const file=new URL('../../verification/live-fixture.json',import.meta.url);
const name='Prueba temporal de sincronización · no comprar';
if(process.env.NODE_ENV!=='development'||!['localhost','127.0.0.1'].includes(process.env.DB_HOST))throw new Error('Solo disponible en desarrollo local.');
try{
 const action=process.argv[2];
 if(action==='create'){
  const seller=(await pool.query("SELECT v.id_vendedor FROM vendedores v JOIN usuarios u USING(id_usuario) WHERE u.correo='artesano@wireless.local'")).rows[0];
  if(!seller)throw new Error('No existe el comerciante de demostración.');
  const category=(await pool.query('SELECT id_categoria FROM categorias ORDER BY id_categoria LIMIT 1')).rows[0];
  const {rows}=await pool.query('INSERT INTO productos(id_vendedor,id_categoria,nombre,descripcion,precio,stock,material,imagen) VALUES($1,$2,$3,$4,1000,5,$5,$6) RETURNING id_producto',[seller.id_vendedor,category.id_categoria,name,'Producto ficticio temporal para verificar actualización sin recargar. No es una oferta comercial.','Cerámica','/product-placeholder.svg']);
  await mkdir(new URL('../../verification/',import.meta.url),{recursive:true});
  await writeFile(file,JSON.stringify({id:rows[0].id_producto,name}));
  console.log(JSON.stringify({id:rows[0].id_producto,stock:5}));
 }else{
  const fixture=JSON.parse(await readFile(file,'utf8'));
  if(action==='reset') {await pool.query('UPDATE productos SET stock=5,precio=1000 WHERE id_producto=$1 AND nombre=$2',[fixture.id,name]);console.log(JSON.stringify({id:fixture.id,stock:5,price:1000}));}
  else if(action==='change') {await pool.query('UPDATE productos SET stock=2,precio=1500 WHERE id_producto=$1 AND nombre=$2',[fixture.id,name]);console.log(JSON.stringify({id:fixture.id,stock:2,price:1500}));}
  else if(action==='cleanup'){await pool.query("UPDATE productos SET estado='eliminado' WHERE id_producto=$1 AND nombre=$2",[fixture.id,name]);await unlink(file);console.log('Producto temporal retirado del catálogo.');}
  else throw new Error('Usa create, change o cleanup.');
 }
}finally{await pool.end();}
