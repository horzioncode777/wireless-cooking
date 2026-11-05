import 'dotenv/config';
import { readFile,writeFile,appendFile,unlink } from 'node:fs/promises';
import { randomBytes,createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pool from '../src/config/db.js';
import { wompiSettings } from '../src/services/wompi.js';

const root=new URL('../../',import.meta.url);
const credentialFile=new URL('ACCESOS-TIENDAS-SABANA.local.md',root);
const stores=(await Promise.all(['tiendas-sabana.json','tiendas-artesanias.json'].map(async filename=>JSON.parse(await readFile(new URL(`../data/${filename}`,import.meta.url),'utf8'))))).flat();
const assetRoot=new URL('../demo-assets/brands/',import.meta.url);
const assetUrl='/demo-assets/brands/';
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
let client,credentialsChanged=false,previousCredentials=null;
try{
  if(process.env.NODE_ENV==='production'||wompiSettings().environment!=='test')throw Error('Este catálogo ficticio solo se puede cargar en desarrollo y Sandbox.');
  if(!stores.length||new Set(stores.map(s=>s.slug)).size!==stores.length||stores.some(s=>!Array.isArray(s.productos)||s.productos.length!==2||!/^[-a-z0-9]+$/.test(s.slug)))throw Error('Se esperaban tiendas con referencias únicas y dos productos por tienda.');
  const productSlugs=stores.flatMap(s=>s.productos.map(p=>p.slug));
  if(new Set(productSlugs).size!==productSlugs.length||productSlugs.some(slug=>!/^[-a-z0-9]+$/.test(slug)))throw Error('Referencias de producto repetidas o inválidas.');
  for(const store of stores){
    await readFile(new URL(`${store.slug}.png`,assetRoot));
    for(const product of store.productos){
      const first=await readFile(new URL(`catalog/${product.slug}-1.png`,assetRoot));
      const second=await readFile(new URL(`catalog/${product.slug}-2.png`,assetRoot));
      if(digest(first)===digest(second))throw Error(`Las dos imágenes de ${product.slug} deben ser distintas.`);
    }
  }
  if(!process.argv.includes('--apply')){
    console.log(`Catálogo validado: ${stores.length} tiendas, ${productSlugs.length} productos y ${productSlugs.length*2} imágenes distintas. Usa --apply para cargarlo.`);
  }else{
    client=await pool.connect();await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('wireless-cooking-tiendas-sabana'))");
    const emails=stores.map(s=>`${s.slug}@tiendas.wireless.example`);
    const otherActive=await client.query("SELECT count(*)::int AS n FROM vendedores v JOIN usuarios u USING(id_usuario) WHERE u.estado='activo' AND NOT(u.correo=ANY($1::text[]))",[emails]);
    if(otherActive.rows[0].n)throw Error('Hay otros comercios activos. Este script no los elimina ni los reemplaza.');
    const credentials=[];
    let newStores=0,newProducts=0;
    for(const [index,store] of stores.entries()){
      const email=emails[index];
      let account=(await client.query('SELECT id_usuario,rol,estado FROM usuarios WHERE correo=$1',[email])).rows[0];
      if(account && (account.rol!=='vendedor'||account.estado!=='activo'))throw Error('La cuenta de demostración ya existe con otro estado o rol.');
      if(!account){
        const password=`Wc!${randomBytes(15).toString('base64url')}7`;
        const hash=await bcrypt.hash(password,12);
        account=(await client.query("INSERT INTO usuarios(nombre,correo,contrasena_hash,telefono,direccion,rol) VALUES($1,$2,$3,$4,$5,'vendedor') RETURNING id_usuario",[store.responsable,email,hash,`00000001${String(index+1).padStart(2,'0')}`,`${store.sector}, ${store.ciudad}. Dirección ficticia de demostración.`])).rows[0];
        credentials.push({name:store.nombre,email,password});
      }
      const profile={
        es_demo:true,slug:store.slug,lema:store.lema,especialidad:store.especialidad,historia:store.historia,
        responsable_publico:store.responsable,fundacion:store.fundacion,color:store.color,
        direccion_publica:`${store.sector}, ${store.ciudad}, Cundinamarca. Ubicación ficticia de demostración.`,
        horario:store.horario,correo_publico:`hola@${store.slug}.example`,telefono_publico:`00000001${String(index+1).padStart(2,'0')}`,
        valores:store.valores,servicios:store.servicios,cobertura:stores.map(s=>s.ciudad),
        preparacion:'En esta demostración, el vendedor confirma la preparación y registra el envío desde sus pedidos.',
        politica_envio:'El vendedor elige la transportadora y comparte la guía de seguimiento. La planilla de Wireless Cooking identifica el pedido; la guía oficial la emite la empresa transportadora.'
      };
      let seller=(await client.query('SELECT id_vendedor,perfil_publico FROM vendedores WHERE id_usuario=$1',[account.id_usuario])).rows[0];
      if(seller && seller.perfil_publico?.slug!==store.slug)throw Error('El perfil existente no pertenece a esta colección.');
      if(!seller){
        seller=(await client.query('INSERT INTO vendedores(id_usuario,nombre_tienda,descripcion,logo,banner_url,ciudad,perfil_publico,verificado) VALUES($1,$2,$3,$4,$5,$6,$7,false) RETURNING id_vendedor',[account.id_usuario,store.nombre,store.descripcion,`${assetUrl}${store.slug}.png`,`${assetUrl}catalog/${store.productos[0].slug}-1.png`,store.ciudad,JSON.stringify(profile)])).rows[0];
        newStores++;
      }
      for(const product of store.productos){
        const existing=(await client.query("SELECT id_producto FROM productos WHERE id_vendedor=$1 AND ficha->>'slug'=$2",[seller.id_vendedor,product.slug])).rows[0];
        if(existing)continue; // Reruns preserve inventory, edits and account passwords.
        const category=(await client.query('SELECT id_categoria FROM categorias WHERE nombre=$1',[product.categoria])).rows[0];
        if(!category)throw Error(`Categoría desconocida: ${product.categoria}`);
        const gallery=[1,2].map(n=>`${assetUrl}catalog/${product.slug}-${n}.png`);
        const ficha={es_demo:true,slug:product.slug,marca:store.nombre,contenido:product.contenido,medidas:product.medidas,color:product.color,cuidados:product.cuidados};
        await client.query('INSERT INTO productos(id_vendedor,id_categoria,nombre,descripcion,precio,stock,material,imagen,galeria,ficha) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[seller.id_vendedor,category.id_categoria,product.nombre,product.descripcion,product.precio,product.stock,product.material,gallery[0],JSON.stringify(gallery),JSON.stringify(ficha)]);
        newProducts++;
      }
    }
    if(credentials.length){
      const entries=credentials.map(c=>`## ${c.name}\n\n- Correo: ${c.email}\n- Contraseña: ${c.password}\n`).join('\n');
      try{previousCredentials=await readFile(credentialFile,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
      if(previousCredentials!==null){
        credentialsChanged=true;
        await appendFile(credentialFile,`\n${entries}`);
      }else{
        const heading='# Accesos locales · Tiendas de la Sabana\n\nCuentas ficticias de demostración. Los correos .example no reciben mensajes. Contraseñas locales; no publicar este archivo. Wompi permanece en Sandbox.\n\n';
        await writeFile(credentialFile,heading+entries,{flag:'wx',mode:0o600});credentialsChanged=true;
      }
    }
    await client.query('COMMIT');credentialsChanged=false;
    console.log(JSON.stringify({ok:true,tiendasNuevas:newStores,productosNuevos:newProducts,imagenes:productSlugs.length*2,accesosLocales:fileURLToPath(credentialFile)}));
  }
}catch(error){
  if(client)await client.query('ROLLBACK');
  if(credentialsChanged){if(previousCredentials!==null)await writeFile(credentialFile,previousCredentials);else await unlink(credentialFile);}
  console.error(error.message);process.exitCode=1;
}finally{client?.release();await pool.end();}
