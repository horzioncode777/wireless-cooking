// Disposable browser test server. All records live in a separate test_* schema.
import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import {randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {createServer} from 'node:http';
const file=new URL('../../verification/checkout-preview.json',import.meta.url);
if(process.argv[2]==='stop'){
 const state=JSON.parse(await readFile(file,'utf8'));
 const response=await fetch('http://127.0.0.1:6002/__preview/finish',{method:'POST',headers:{'x-preview-key':state.controlKey}});
 if(!response.ok)throw Error('No se pudo cerrar la prueba.');console.log(await response.text());
}else{
 if(process.env.NODE_ENV==='production'||!['localhost','127.0.0.1'].includes(process.env.DB_HOST))throw Error('Solo pruebas locales.');
 const schema='test_checkout_preview_'+randomBytes(8).toString('hex');
 const owner=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
 await owner.connect();await owner.query('CREATE SCHEMA '+schema);
 process.env.TEST_SCHEMA=schema;process.env.NODE_ENV='test';process.env.PAYMENT_MODE='demo';process.env.FRONTEND_URL='http://localhost:5174';
 process.env.JWT_SECRET=randomBytes(40).toString('base64url');process.env.OPENAI_API_KEY='';process.env.RESEND_API_KEY='';process.env.WOMPI_EVENTS_SECRET='';process.env.WOMPI_PUBLIC_KEY='';process.env.WOMPI_INTEGRITY_SECRET='';
 const pool=(await import('../src/config/db.js')).default;
 let server;
 async function cleanup(){
  if(server){server.close();server.closeAllConnections();}
  await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();await unlink(file).catch(()=>{});
 }
 try{
  await pool.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
  const password=randomBytes(15).toString('base64url'),correo='checkout@pruebas.local',controlKey=randomBytes(24).toString('hex');
  const user=(await pool.query("INSERT INTO usuarios(nombre,correo,contrasena_hash,rol) VALUES('Cliente de pruebas',$1,$2,'comprador') RETURNING id_usuario",[correo,await bcrypt.hash(password,10)])).rows[0];
  const category=(await pool.query("SELECT id_categoria FROM categorias WHERE nombre='Cerámica'")).rows[0].id_categoria;
  const cart=(await pool.query('INSERT INTO carritos(id_usuario) VALUES($1) RETURNING id_carrito',[user.id_usuario])).rows[0];
  for(const [name,price,slug,quantity] of [['Olla de cerámica artesanal',85000,'ceramic-pot',2],['Sartén de acero inoxidable',119000,'steel-pan',1]]){
   const product=(await pool.query('INSERT INTO productos(id_categoria,nombre,descripcion,precio,stock,material,imagen) VALUES($1,$2,$3,$4,10,$5,$6) RETURNING id_producto',[category,name,'Producto aislado de prueba visual.',price,'Utensilio de cocina','/demo-assets/products/'+slug+'.png'])).rows[0];
   await pool.query('INSERT INTO carrito_items(id_carrito,id_producto,cantidad) VALUES($1,$2,$3)',[cart.id_carrito,product.id_producto,quantity]);
  }
  const app=(await import('../src/app.js')).default;
  server=createServer((req,res)=>{
   if(req.url==='/__preview/finish'&&req.method==='POST'&&req.headers['x-preview-key']===controlKey){res.end('Prueba finalizada; esquema aislado retirado.');cleanup().catch(error=>{console.error(error.message);process.exitCode=1;});}
   else app(req,res);
  });
  server.listen(6002,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  await mkdir(new URL('../../verification/',import.meta.url),{recursive:true});await writeFile(file,JSON.stringify({schema,correo,password,controlKey}));
  console.log('Servidor de prueba en 6002. Credenciales temporales en verification/checkout-preview.json. No usa los pedidos ni cuentas de la aplicación.');
 }catch(error){await cleanup();throw error;}
}
