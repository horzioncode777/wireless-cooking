import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,access,readFile} from 'node:fs/promises';
import pool from '../src/config/db.js';

if(process.env.NODE_ENV==='production') throw new Error('Este catálogo ficticio solo se carga en desarrollo.');
const assetRoot=new URL('../demo-assets/',import.meta.url);
const credentialsFile=new URL('../../ACCESOS-EMPRESAS.local.md',import.meta.url);
const names=['Alma de Barro','Bruma Cocina','Cobre y Trigo','Nido de Mesa','Raíz Serena','Lumbre Clara','Casa del Cuenco','Tierra y Cuchara','Oliva Taller','Miga Artesana','Fogón de Luna','Arcilla Viva','Roble y Sal','Mesa Aurora','Manos del Valle','Cántaro Azul','Savia Cocina','Horno de Alba','Hebra Natural','Laurel de Casa','Piedra y Miel','Estación Cerámica','Cocina Naranja','Ronda de Barro','Semilla y Mesa','Bambú Dorado','Espiga Hogar','Sierra Utensilios','Sol de Arcilla','Abrazo de Mesa','Taller del Cedro','Calma Vajillas','Bosque y Fuego','Lino de Cocina','Cuenco del Río','Sabores de Tierra','Patio de Olivo','Terracota Norte','Brasa y Madera','Flor de Fogón','Aura Inoxidable','Mestiza Mesa','Rincón del Mortero','Horizonte Artesano','Ritual del Café','Alero Cocina','Veta de Roble','Manto de Lino','Cosecha del Taller','Origen del Cuenco'];
const types=[
 ['ceramic-pot','Olla de cerámica con tapa','Cerámica','Cerámica terracota',85000,'Cocción y servicio','2 litros','3 litros','4 litros','5 litros'],
 ['steel-pan','Sartén de acero inoxidable','Acero inoxidable','Acero inoxidable',115000,'Cocción diaria','20 cm','24 cm','26 cm','28 cm'],
 ['dinnerware','Vajilla de cuatro piezas','Vajillas','Cerámica color marfil',78000,'Servicio de mesa','Clásica','Cotidiana','Mesa','Hogar'],
 ['wood-utensils','Set de cinco utensilios de madera','Utensilios','Madera natural',35000,'Preparación de alimentos','Esencial','Tradición','Chef','Familia'],
 ['steel-pot','Olla de acero inoxidable con tapa','Acero inoxidable','Acero inoxidable',135000,'Cocción diaria','3 litros','4 litros','5 litros','6 litros'],
 ['ceramic-mug','Taza artesanal moteada','Cerámica','Cerámica esmaltada crema',28000,'Bebidas calientes','250 ml','300 ml','350 ml','400 ml'],
 ['cutting-board','Tabla de cortar en acacia','Accesorios','Madera de acacia',48000,'Preparación y servicio','25 cm','30 cm','35 cm','40 cm'],
 ['ceramic-bowl','Cuenco de cerámica verde salvia','Vajillas','Cerámica esmaltada',39000,'Servicio de mesa','16 cm','20 cm','24 cm','28 cm'],
 ['steel-ladle','Cucharón de acero inoxidable','Utensilios','Acero inoxidable',22000,'Servir sopas y salsas','Esencial','Tradición','Chef','Familia'],
 ['woven-basket','Canasta tejida para pan','Artesanías','Fibra natural',32000,'Presentación de mesa','20 cm','24 cm','28 cm','32 cm'],
 ['ceramic-vase','Florero de terracota','Decoración','Cerámica terracota',44000,'Decoración del hogar','18 cm','22 cm','26 cm','30 cm'],
 ['kitchen-linen','Delantal y paño de cocina beige','Accesorios','Algodón',52000,'Textiles para cocina','Esencial','Tradición','Chef','Familia'],
];
const palettes=[['#733e2c','#fff1d7'],['#22564a','#ecf7ef'],['#34475d','#edf3fa'],['#854829','#fff4df'],['#654665','#f8eff8'],['#475b36','#f2f6e9'],['#985c23','#fff6d9'],['#355b6a','#eaf7fb'],['#723d48','#fff0f2'],['#54502e','#fffce7']];
const motifs=[
 '<path d="M42 52h44v18a22 22 0 0 1-44 0Z M38 51h52 M56 43q-8-8 0-16 M72 43q-8-8 0-16"/>',
 '<path d="M38 69h52a26 26 0 0 1-52 0Z M43 63h42 M54 50q-8-8 0-16 M71 50q-8-8 0-16"/>',
 '<ellipse cx="64" cy="62" rx="26" ry="26"/><ellipse cx="64" cy="62" rx="17" ry="17"/><path d="M29 38v47 M22 38v19h14V38 M100 38v47 M100 38q12 18 0 29"/>',
 '<path d="M64 91V42 M64 69q-32-5-20-29 23 3 20 29Z M64 58q29-3 21-27-23 2-21 27Z"/>',
 '<path d="M42 43h35v34a17 17 0 0 1-35 0Z M77 49h8q19 15 0 25h-8 M37 97h49 M53 34q-7-8 0-14 M66 34q-7-8 0-14"/>',
];
await mkdir(new URL('logos/',assetRoot),{recursive:true});
for(const [slug] of types) await access(new URL(`products/${slug}.png`,assetRoot));
const client=await pool.connect();
const added=[];
let createdProducts=0;
try {
 await client.query('BEGIN');
 // Serialize repeated seed runs without touching existing seller accounts or stock.
 await client.query("SELECT pg_advisory_xact_lock(hashtext('wireless-fictional-companies-v1'))");
 const categories=(await client.query('SELECT id_categoria,nombre FROM categorias')).rows;
 for(let i=0;i<names.length;i++) {
  const number=String(i+1).padStart(2,'0');
  const email=`empresa${number}@catalogo.wireless.example`;
  const existing=await client.query('SELECT id_usuario FROM usuarios WHERE correo=$1',[email]);
  if(existing.rowCount) continue;
  const name=names[i],password=randomBytes(15).toString('base64url');
  const [ink,paper]=palettes[i%palettes.length];
  const initials=name.split(' ').filter(w=>!['de','del','y','La'].includes(w)).slice(0,2).map(w=>w[0]).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><title>${name}</title><rect width="128" height="128" rx="26" fill="${paper}"/><g fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${motifs[Math.floor(i/10)]}</g><text x="64" y="117" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" font-size="17" fill="${ink}">${initials} · ${number}</text></svg>`;
  await writeFile(new URL(`logos/empresa-${number}.svg`,assetRoot),svg);
  const user=(await client.query('INSERT INTO usuarios(nombre,apellido,correo,contrasena_hash,rol) VALUES($1,$2,$3,$4,$5) RETURNING id_usuario',[name,'Demo',email,await bcrypt.hash(password,12),'vendedor'])).rows[0];
  const focus=types[i%types.length];
  const seller=(await client.query('INSERT INTO vendedores(id_usuario,nombre_tienda,descripcion,logo,banner_url,ciudad,verificado) VALUES($1,$2,$3,$4,$5,$6,false) RETURNING id_vendedor',[user.id_usuario,name,`Empresa ficticia de demostración en Cajicá. ${name} presenta una colección de utensilios, vajillas y accesorios, con especialidad en ${focus[5].toLowerCase()}. Catálogo de prueba con fotos generadas por IA; no representa un comercio real.`,`/demo-assets/logos/empresa-${number}.svg`,`/demo-assets/products/${focus[0]}.png`,'Cajicá'])).rows[0];
  for(let j=0;j<40;j++) {
   const type=types[(j+i)%types.length],variant=Math.floor(j/types.length);
   const [slug,title,category,material,basePrice,use,...variants]=type;
   const reference=`WC-${number}-${String(j+1).padStart(3,'0')}`;
   const description=`${title}, referencia ${reference}, colección ${name}. Variante: ${variants[variant]}. Uso: ${use}. Material: ${material}. Limpieza suave y secado después de usar. Producto ficticio para probar la aplicación; fotografía generada por IA compartida entre variantes, sin representar diferencias de tamaño. Precio y existencias de demostración.`;
   await client.query('INSERT INTO productos(id_vendedor,id_categoria,nombre,descripcion,precio,stock,material,imagen) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[seller.id_vendedor,categories.find(c=>c.nombre===category).id_categoria,`${title} · ${variants[variant]}`,description,basePrice+variant*6500+(i%7)*1500,12+(i*7+j*3)%79,material,`/demo-assets/products/${slug}.png`]);
   createdProducts++;
  }
  added.push({name,email,password});
 }
 // Save access details before committing so a failed file write leaves no inaccessible accounts.
 if(added.length) {
  const previous=await readFile(credentialsFile,'utf8').catch(error=>{if(error.code!=='ENOENT') throw error;return '# Accesos de las empresas ficticias\n\nSolo para pruebas locales. No publicar. Pagos en modo demostración.\n';});
  await writeFile(credentialsFile,previous+'\n'+added.map(a=>`## ${a.name}\nCorreo: ${a.email}\nContraseña: ${a.password}\n`).join('\n'));
 }
 await client.query('COMMIT');
 console.log(JSON.stringify({empresasCreadas:added.length,productosCreados:createdProducts,totalEmpresasFicticias:50,productosPorEmpresa:40,accesos:'ACCESOS-EMPRESAS.local.md'}));
} catch(error) {await client.query('ROLLBACK');throw error;}
finally {client.release();await pool.end();}
