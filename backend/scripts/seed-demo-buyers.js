import 'dotenv/config';
import {readFile,writeFile,appendFile,unlink} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import bcrypt from 'bcryptjs';
import pool from '../src/config/db.js';
import {wompiSettings} from '../src/services/wompi.js';

const people=JSON.parse(await readFile(new URL('../data/compradores-demo.json',import.meta.url),'utf8'));
const credentialFile=new URL('../../ACCESOS-COMPRADORES.local.md',import.meta.url);
const assetDirectory=new URL('../demo-assets/buyers/',import.meta.url);
let client,credentialsChanged=false,previousCredentials=null;
try{
  if(process.env.NODE_ENV==='production'||wompiSettings().environment!=='test')throw Error('Estas cuentas ficticias solo se pueden cargar en desarrollo y Sandbox.');
  if(people.length!==30||new Set(people.map(p=>p.correo)).size!==30||new Set(people.map(p=>p.slug)).size!==30)throw Error('Se requieren exactamente 30 compradores distintos.');
  const photoHashes=new Set();
  for(const person of people){
    if(!/^[-a-z0-9]+$/.test(person.slug)||person.correo!==`${person.slug}@compradores.wireless.example`||person.rol!=='comprador'||person.es_demo!==true||!person.nombre||!person.apellido||!person.ciudad||!person.direccion||!/^000\d{7}$/.test(person.telefono)||person.foto!==`/demo-assets/buyers/${person.slug}.png`)throw Error('Perfil de demostración incompleto o inválido.');
    const photo=await readFile(new URL(`${person.slug}.png`,assetDirectory));
    if(!photo.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error(`La foto de ${person.slug} no es un PNG válido.`);
    photoHashes.add(createHash('sha256').update(photo).digest('hex'));
  }
  if(photoHashes.size!==30)throw Error('Cada comprador debe tener un retrato diferente.');
  if(!process.argv.includes('--apply')){
    console.log('Validados 30 compradores y 30 fotografías distintas. Usa --apply para cargarlos.');
  }else{
    client=await pool.connect();await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('wireless-demo-buyers'))");
    const credentials=[];let inserted=0;
    for(const person of people){
      const existing=(await client.query('SELECT id_usuario,rol,estado FROM usuarios WHERE correo=$1',[person.correo])).rows[0];
      if(existing){
        if(existing.rol!=='comprador'||existing.estado!=='activo')throw Error('Una cuenta de la colección ya existe con otro rol o estado. No se cambió.');
        continue; // Preserve all existing profile edits, passwords and activity.
      }
      const password=`Wc!${randomBytes(15).toString('base64url')}9`;
      const hash=await bcrypt.hash(password,12);
      await client.query("INSERT INTO usuarios(nombre,apellido,correo,contrasena_hash,telefono,direccion,foto,rol,estado) VALUES($1,$2,$3,$4,$5,$6,$7,'comprador','activo')",[person.nombre,person.apellido,person.correo,hash,person.telefono,person.direccion,person.foto]);
      credentials.push({nombre:`${person.nombre} ${person.apellido}`,correo:person.correo,password,ciudad:person.ciudad});inserted++;
    }
    if(credentials.length){
      const entries=credentials.map(p=>`## ${p.nombre}\n\n- Correo: ${p.correo}\n- Contraseña: ${p.password}\n- Municipio: ${p.ciudad}\n`).join('\n');
      try{previousCredentials=await readFile(credentialFile,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
      if(previousCredentials!==null){credentialsChanged=true;await appendFile(credentialFile,`\n${entries}`);}
      else{
        const heading='# Accesos locales · 30 compradores de demostración\n\nDatos y retratos ficticios. Los correos .example y teléfonos con prefijo 000 no reciben mensajes ni llamadas. Las direcciones no son puntos reales de entrega. Cada cuenta tiene una contraseña independiente. No publicar este archivo.\n\nIngresa en http://localhost:5173/login y abre Mi perfil para ver los datos y la foto. La recuperación por correo no funciona con estas direcciones ficticias; para probar el envío de correos se requiere una cuenta con un correo real propio.\n\n';
        await writeFile(credentialFile,heading+entries,{flag:'wx',mode:0o600});credentialsChanged=true;
      }
    }
    await client.query('COMMIT');credentialsChanged=false;
    console.log(JSON.stringify({ok:true,compradoresNuevos:inserted,compradoresExistentes:people.length-inserted,fotos:30,accesosLocales:fileURLToPath(credentialFile)}));
  }
}catch(error){
  if(client)await client.query('ROLLBACK');
  if(credentialsChanged){if(previousCredentials!==null)await writeFile(credentialFile,previousCredentials);else await unlink(credentialFile);}
  console.error(error.message);process.exitCode=1;
}finally{client?.release();await pool.end();}
