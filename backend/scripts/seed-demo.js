import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import pool from '../src/config/db.js';
if(process.env.NODE_ENV==='production') throw new Error('Los datos de demostración no se crean en producción.');
const client=await pool.connect();
try {
 const existing=await client.query("SELECT 1 FROM usuarios WHERE correo='admin@wireless.local'");
 if(existing.rowCount) {console.log('La demostración ya está creada. Consulta ACCESOS.local.md.');}
 else {
  await client.query('BEGIN');
  const accounts=[];
  for(const [rol,nombre,correo] of [['admin','Administrador','admin@wireless.local'],['vendedor','Artesano de Cajicá','artesano@wireless.local'],['comprador','Cliente','cliente@wireless.local']]) {
   const password=randomBytes(12).toString('base64url');
   const {rows}=await client.query('INSERT INTO usuarios(nombre,apellido,correo,contrasena_hash,rol,direccion) VALUES($1,$2,$3,$4,$5,$6) RETURNING id_usuario',[nombre,'Demo',correo,await bcrypt.hash(password,12),rol,'Calle 5 # 4-20, Cajicá']);
   accounts.push({rol,correo,password,id:rows[0].id_usuario});
  }
  const seller=(await client.query("INSERT INTO vendedores(id_usuario,nombre_tienda,descripcion,verificado) VALUES($1,'Taller Cocina Cajicá','Tienda de demostración de utensilios artesanales de Cajicá.',true) RETURNING id_vendedor",[accounts[1].id])).rows[0];
  const category=(await client.query('SELECT id_categoria,nombre FROM categorias')).rows;
  for(const [nombre,descripcion,precio,stock,cat,material] of [
   ['Olla de cerámica artesanal','Pieza de demostración en cerámica para cocina tradicional.',85000,12,'Cerámica','Cerámica'],
   ['Sartén de acero inoxidable','Producto de demostración para el catálogo del comerciante.',119000,8,'Acero inoxidable','Acero inoxidable'],
   ['Vajilla artesanal de cuatro piezas','Juego de demostración en cerámica elaborado en Cajicá.',135000,4,'Vajillas','Cerámica'],
   ['Cucharón de acero inoxidable','Utensilio de demostración para servir alimentos.',25000,20,'Utensilios','Acero inoxidable'],
  ]) await client.query('INSERT INTO productos(id_vendedor,id_categoria,nombre,descripcion,precio,stock,material,imagen) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[seller.id_vendedor,category.find(c=>c.nombre===cat).id_categoria,nombre,descripcion,precio,stock,material,'/product-placeholder.svg']);
  await client.query('COMMIT');
  await writeFile(new URL('../../ACCESOS.local.md',import.meta.url),'# Accesos locales de demostración\n\nAbre http://localhost:5173 e inicia sesión. Estas cuentas usan datos ficticios y pagos de demostración.\n\n'+accounts.map(a=>`- ${a.rol}: ${a.correo}\n  Contraseña: ${a.password}`).join('\n\n')+'\n\nNo publiques este archivo ni lo compartas en un repositorio.\n');
  console.log('Demostración creada. Accesos guardados en ACCESOS.local.md.');
 }
}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
