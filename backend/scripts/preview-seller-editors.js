// Disposable browser verification: never connects the application pool to public tables.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const schema=`test_editor_ui_${randomUUID().replaceAll('-','')}`;
const owner=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
await owner.connect();await owner.query(`CREATE SCHEMA ${schema}`);
Object.assign(process.env,{TEST_SCHEMA:schema,NODE_ENV:'test',IMAGE_STORAGE:'local',PAYMENT_MODE:'demo',OPENAI_API_KEY:'',GMAIL_USER:'',GMAIL_APP_PASSWORD:'',FRONTEND_URL:'http://localhost:5174'});
const db=(await import('../src/config/db.js')).default;
if((await db.query('SELECT current_schema() AS name')).rows[0].name!==schema)throw new Error('Isolation check failed');
await db.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
const data=JSON.parse(await readFile(new URL('../data/tiendas-sabana.json',import.meta.url),'utf8'))[0];
const user=(await db.query("INSERT INTO usuarios(nombre,apellido,correo,contrasena_hash,rol,telefono,direccion) VALUES('Taller','Prueba','editor@verification.test',$1,'vendedor','3000000000','Datos privados de prueba') RETURNING *",[await bcrypt.hash('EditorLocal!2026',10)])).rows[0];
await db.query("INSERT INTO usuarios(nombre,correo,contrasena_hash,rol) VALUES('Administración de prueba','admin@verification.test',$1,'admin')",[user.contrasena_hash]);
const store=(await db.query('INSERT INTO vendedores(id_usuario,nombre_tienda,descripcion,ciudad,logo,perfil_publico) VALUES($1,$2,$3,$4,$5,$6) RETURNING id_vendedor',[user.id_usuario,'Taller de verificación','Cerámica para tu mesa.','Tabio',`/demo-assets/brands/${data.slug}.png`,JSON.stringify({es_demo:true,historia:'Una historia por contar.',lema:'Hecho con calma',color:'#a34d1b',cobertura:['Tabio']})])).rows[0].id_vendedor;
const category=(await db.query('SELECT id_categoria FROM categorias LIMIT 1')).rows[0].id_categoria;
const images=[1,2].map(i=>`/demo-assets/brands/catalog/${data.productos[0].slug}-${i}.png`);
await db.query('INSERT INTO productos(id_vendedor,id_categoria,nombre,descripcion,precio,stock,imagen,galeria) VALUES($1,$2,$3,$4,45000,8,$5,$6)',[store,category,'Cuenco de verificación','Un cuenco para comprobar la galería.',images[0],JSON.stringify(images)]);
const app=(await import('../src/app.js')).default;
const server=app.listen(6002,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
console.log('Vista aislada lista: API 6002, tienda 1, producto 1.');
const stop=new URL('../../verification/.seller-preview-stop',import.meta.url);
await unlink(stop).catch(()=>{});
const started=Date.now();
const timer=setInterval(async()=>{
  let done=Date.now()-started>30*60*1000;
  try{await readFile(stop);done=true;}catch{}
  if(!done)return;
  clearInterval(timer);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  const photos=(await db.query('SELECT galeria FROM productos')).rows.flatMap(row=>row.galeria||[]);
  const {removeUploadedImage}=await import('../src/services/images.js');
  await Promise.all(photos.filter(url=>url.startsWith('/uploads/')).map(secure_url=>removeUploadedImage({secure_url})));
  await db.end();await owner.query(`DROP SCHEMA ${schema} CASCADE`);await owner.end();await unlink(stop).catch(()=>{});
  console.log('Verificación finalizada; esquema y archivos temporales retirados.');
},1000);
