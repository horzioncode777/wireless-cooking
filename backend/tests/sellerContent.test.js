import 'dotenv/config';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { galleryForm, testPhoto } from './helpers/productFixture.js';
import { fixtureToken } from './helpers/authFixture.js';

const schema=`test_content_${randomUUID().replaceAll('-','')}`;
const owner=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
let db,server,origin,category,seller,other,buyer,product,removeUploadedImage;
const uploads=new Set();
async function request(path,{method='GET',body,token=seller?.token}={}) {
  const multipart=body instanceof FormData;
  const response=await fetch(`${origin}/api${path}`,{method,headers:{...(multipart?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:multipart?body:JSON.stringify(body)}:{})});
  const data=await response.json();
  if(data.product?.galeria) for(const url of data.product.galeria) if(url.startsWith('/uploads/')) uploads.add(url);
  return {status:response.status,data};
}
before(async()=>{
  await owner.connect();await owner.query(`CREATE SCHEMA ${schema}`);
  Object.assign(process.env,{TEST_SCHEMA:schema,NODE_ENV:'test',IMAGE_STORAGE:'local',PAYMENT_MODE:'demo',OPENAI_API_KEY:'',GMAIL_USER:'',GMAIL_APP_PASSWORD:''});
  db=(await import('../src/config/db.js')).default;
  assert.equal((await db.query('SELECT current_schema() AS name')).rows[0].name,schema);
  await db.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
  const accounts=(await db.query("INSERT INTO usuarios(nombre,correo,contrasena_hash,rol) VALUES('Vendedora','seller@content.test','unused','vendedor'),('Otra','other@content.test','unused','vendedor'),('Comprador','buyer@content.test','unused','comprador') RETURNING *")).rows;
  [seller,other,buyer]=await Promise.all(accounts.map(async user=>({...user,token:await fixtureToken(db,user)})));
  for(const user of [seller,other]) user.store=(await db.query("INSERT INTO vendedores(id_usuario,nombre_tienda,ciudad,perfil_publico) VALUES($1,$2,'Tabio',$3) RETURNING id_vendedor",[user.id_usuario,user.nombre,JSON.stringify({es_demo:true,historia:'Historia anterior',valores:['Origen'],correo_publico:'public@content.test'})])).rows[0].id_vendedor;
  category=(await db.query('SELECT id_categoria FROM categorias LIMIT 1')).rows[0].id_categoria;
  ({removeUploadedImage}=await import('../src/services/images.js'));
  const app=(await import('../src/app.js')).default;
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  await Promise.all([...uploads].map(secure_url=>removeUploadedImage({secure_url})));
  if(db)await db.end();
  await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await owner.end();
});

test('El vendedor edita todos sus datos públicos; cambios visibles sin exponer datos de la cuenta',async()=>{
  const perfil_publico={historia:'Una historia nueva\n\nHecha en la Sabana.',lema:'Hecho a mano',especialidad:'Cerámica',responsable_publico:'Equipo del taller',direccion_publica:'Centro de Chía',horario:'Lunes a viernes',correo_publico:'hola@tienda.test',telefono_publico:'+57 300 123 4567',valores:['Oficio','Calidad'],servicios:['Asesoría'],cobertura:['Chía','Cajicá'],fundacion:2020,color:'#293b32',preparacion:'Dos días',politica_envio:'Despachamos con la transportadora elegida.'};
  const result=await request('/seller/profile',{method:'PUT',body:{nombre_tienda:'Taller nuevo',ciudad:'Chía',descripcion:'Descripción nueva',perfil_publico,id_usuario:other.id_usuario}});
  assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.seller.ciudad,'Chía');
  const privateResult=await request('/seller/profile');assert.equal(privateResult.data.seller.perfil_publico.es_demo,true);
  const publicResult=await request(`/marketplace/${seller.store}`,{token:null});
  for(const [key,value] of Object.entries(perfil_publico)) assert.deepEqual(publicResult.data.seller.perfil_publico[key],value);
  assert.equal(publicResult.data.seller.nombre_tienda,'Taller nuevo');assert.equal(publicResult.data.seller.correo,undefined);
  assert.equal((await request('/seller/profile',{token:other.token})).data.seller.nombre_tienda,'Otra');
});
test('Cambios parciales y campos vacíos conservan metadatos y permiten retirar datos públicos',async()=>{
  const result=await request('/seller/profile',{method:'PUT',body:{perfil_publico:{correo_publico:'',telefono_publico:'',valores:[],fundacion:null}}});
  assert.equal(result.status,200);assert.equal(result.data.seller.perfil_publico.historia,'Una historia nueva\n\nHecha en la Sabana.');
  const profile=(await request(`/marketplace/${seller.store}`,{token:null})).data.seller.perfil_publico;
  assert.equal(profile.correo_publico,'');assert.deepEqual(profile.valores,[]);assert.equal(profile.fundacion,undefined);
});
test('Validación y permisos rechazan datos inválidos sin cambios parciales en la cuenta',async()=>{
  for(const body of [
    {perfil_publico:{correo_publico:'mal correo'}},{perfil_publico:{telefono_publico:'javascript:alert(1)'}},
    {perfil_publico:{historia:'x'.repeat(6001)}},{perfil_publico:{cobertura:Array(21).fill('Chía')}},
    {perfil_publico:{color:'red'}},{perfil_publico:{fundacion:9999}},{perfil_publico:{es_demo:false}},
    {perfil_publico:[]},{ciudad:''},{nombre_tienda:42},
  ]) assert.equal((await request('/seller/profile',{method:'PUT',body:{nombre:'No guardar',...body}})).status,400);
  assert.equal((await request('/seller/profile')).data.seller.nombre,'Vendedora');
  assert.equal((await request('/seller/profile',{method:'PUT',body:{nombre:'No guardar',correo:other.correo,nombre_tienda:'No guardar'}})).status,409);
  assert.equal((await request('/seller/profile')).data.seller.nombre_tienda,'Taller nuevo');
  assert.equal((await request('/seller/profile',{method:'PUT',token:buyer.token,body:{ciudad:'Chía'}})).status,403);
  assert.equal((await request('/seller/profile',{method:'PUT',token:null,body:{ciudad:'Chía'}})).status,401);
});
test('Creación con dos fotos guarda portada y galería pública y en inventario',async()=>{
  const result=await request('/seller/products',{method:'POST',body:galleryForm({nombre:'Cuenco nuevo',descripcion:'Producto de prueba',precio:12000,stock:3,id_categoria:category})});
  assert.equal(result.status,201,JSON.stringify(result.data));product=result.data.product;
  assert.equal(product.galeria.length,2);assert.equal(product.imagen,product.galeria[0]);
  assert.deepEqual((await request(`/seller/products/mine/${product.id_producto}`)).data.product.galeria,product.galeria);
  assert.deepEqual((await request(`/seller/products/${product.id_producto}?view=0`,{token:null})).data.product.galeria,product.galeria);
});
test('Edición combina fotos anteriores y nuevas; reordena, reemplaza y elimina sin perder ficha',async()=>{
  await db.query('UPDATE productos SET ficha=$1 WHERE id_producto=$2',[JSON.stringify({contenido:'Un cuenco'}),product.id_producto]);
  const body=new FormData();body.append('imagenes',new Blob([testPhoto],{type:'image/png'}),'detalle.png');
  body.append('galeria_orden',JSON.stringify([{archivo:0},{url:product.galeria[1]},{url:product.galeria[0]}]));
  let result=await request(`/seller/products/${product.id_producto}`,{method:'PUT',body});assert.equal(result.status,200,JSON.stringify(result.data));
  assert.equal(result.data.product.galeria.length,3);assert.equal(result.data.product.imagen,result.data.product.galeria[0]);
  const reordered=[result.data.product.galeria[1],result.data.product.galeria[0]];
  result=await request(`/seller/products/${product.id_producto}`,{method:'PUT',body:{galeria_orden:JSON.stringify(reordered.map(url=>({url})))}});
  assert.equal(result.status,200);assert.deepEqual(result.data.product.galeria,reordered);assert.equal(result.data.product.imagen,reordered[0]);
  assert.equal(result.data.product.ficha.contenido,'Un cuenco');
  result=await request(`/seller/products/${product.id_producto}`,{method:'PUT',body:{stock:4}});
  assert.deepEqual(result.data.product.galeria,reordered);assert.equal(result.data.product.imagen,reordered[0]);product=result.data.product;
});
test('No permite apropiarse de fotos, duplicarlas ni editar galerías ajenas',async()=>{
  const path=`/seller/products/${product.id_producto}`;
  assert.equal((await request(path,{method:'PUT',token:other.token,body:{galeria_orden:JSON.stringify(product.galeria.map(url=>({url})))}})).status,403);
  for(const entries of [[{url:'/uploads/otra-tienda.png'},{url:product.imagen}],[{url:product.imagen},{url:product.imagen}],[{archivo:0},{archivo:1}]]) {
    assert.equal((await request(path,{method:'PUT',body:{nombre:'No guardar',galeria_orden:JSON.stringify(entries)}})).status,400);
  }
  assert.equal((await request(`/seller/products/mine/${product.id_producto}`)).data.product.nombre,'Cuenco nuevo');
});
test('Límites de 2–5, tipo y tamaño rechazan toda la operación antes de subir archivos',async()=>{
  const fields={nombre:'No crear',descripcion:'Prueba',precio:1000,stock:1,id_categoria:category};
  const countBefore=(await db.query('SELECT count(*)::int AS n FROM productos')).rows[0].n;
  const filesBefore=await readdir(new URL('../uploads/',import.meta.url));
  for(const n of [0,1,6]) assert.equal((await request('/seller/products',{method:'POST',body:galleryForm(fields,n)})).status,400);
  const bad=galleryForm(fields,1);bad.append('imagenes',new Blob(['fake'],{type:'image/png'}),'fake.png');bad.set('galeria_orden','[{"archivo":0},{"archivo":1}]');
  assert.equal((await request('/seller/products',{method:'POST',body:bad})).status,400);
  const huge=galleryForm(fields,1);huge.append('imagenes',new Blob([new Uint8Array(5*1024*1024+1)],{type:'image/png'}),'huge.png');
  assert.equal((await request('/seller/products',{method:'POST',body:huge})).status,400);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM productos')).rows[0].n,countBefore);
  assert.deepEqual(await readdir(new URL('../uploads/',import.meta.url)),filesBefore);
  const path=`/seller/products/${product.id_producto}`;
  assert.equal((await request(path,{method:'PUT',body:{galeria_orden:'[]'}})).status,400);
});
test('Cinco fotos se aceptan y un fallo SQL posterior limpia todas las nuevas imágenes',async()=>{
  const fields={nombre:'Cinco fotos',descripcion:'Prueba',precio:1000,stock:1,id_categoria:category};
  assert.equal((await request('/seller/products',{method:'POST',body:galleryForm(fields,5)})).status,201);
  const before=await readdir(new URL('../uploads/',import.meta.url));
  assert.notEqual((await request('/seller/products',{method:'POST',body:galleryForm({...fields,id_categoria:99999999})})).status,201);
  assert.deepEqual(await readdir(new URL('../uploads/',import.meta.url)),before);
});
