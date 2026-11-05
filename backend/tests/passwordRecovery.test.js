import 'dotenv/config';
import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID,createHmac,createHash } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const schema=`test_recovery_${randomUUID().replaceAll('-','')}`;
const owner=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
const signingSecret='recovery-fixture-secret-only-for-tests-2026';
const originalPassword='OriginalPassword!2026';
let db,handlers,verifyToken,gmailConfiguration,recoveryEmail,passwordHash,sequence=0,failDelivery=false;
const messages=[];
before(async()=>{
 await owner.connect();await owner.query(`CREATE SCHEMA ${schema}`);
 process.env.TEST_SCHEMA=schema;process.env.NODE_ENV='test';
 db=(await import('../src/config/db.js')).default;
 await db.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
 const {createPasswordHandlers}=await import('../src/controllers/password.controller.js');
 ({gmailConfiguration,recoveryEmail}=await import('../src/services/recoveryMail.js'));
 ({verifyToken}=await import('../src/middlewares/auth.middleware.js'));
 handlers=createPasswordHandlers({db,mailReady:()=>true,secret:()=>signingSecret,deliverCode:async(to,code)=>{if(failDelivery)throw Object.assign(Error('fake delivery failure'),{code:'EAUTH'});messages.push({to,code});}});
 passwordHash=await bcrypt.hash(originalPassword,10);
});
after(async()=>{if(db)await db.end();await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await owner.end();});
async function account(){sequence++;return (await db.query("INSERT INTO usuarios(nombre,correo,contrasena_hash) VALUES($1,$2,$3) RETURNING *",[`Prueba ${sequence}`,`persona${sequence}@pruebas.local`,passwordHash])).rows[0];}
function response(){return {statusCode:200,body:null,headers:{},status(code){this.statusCode=code;return this;},set(key,value){this.headers[key]=value;return this;},json(body){this.body=body;return this;}};}
async function call(name,body,user){const res=response();try{await handlers[name]({body,user},res);}catch(error){res.statusCode=error.status||500;res.body={message:error.message};}return res;}
async function ask(user){return call('forgotPassword',{correo:user.correo});}
async function verify(user){const request=await ask(user);return call('verifyResetCode',{challengeId:request.body.challengeId,code:messages.at(-1).code});}

test('El correo desconocido recibe la misma respuesta pública sin exponer códigos ni contraseñas',async()=>{
 const user=await account(),before=messages.length;
 const known=await call('forgotPassword',{correo:` ${user.correo.toUpperCase()} `});
 const unknown=await call('forgotPassword',{correo:'desconocido@pruebas.local'});
 assert.equal(known.statusCode,200);assert.equal(unknown.statusCode,200);
 assert.equal(known.body.message,unknown.body.message);assert.deepEqual(Object.keys(known.body),Object.keys(unknown.body));
 assert.equal(messages.length,before+1);assert.match(messages.at(-1).code,/^\d{6}$/);
 assert.equal(known.headers['Cache-Control'],'no-store');assert.equal(known.body.token,undefined);assert.equal(known.body.code,undefined);
 const stored=(await db.query('SELECT *,extract(epoch FROM (expira-creado_en)) AS seconds FROM password_recovery_codes WHERE id=$1',[known.body.challengeId])).rows[0];
 assert.equal(stored.codigo_hash,createHmac('sha256',signingSecret).update(`${known.body.challengeId}:${messages.at(-1).code}`).digest('hex'));
 assert.notEqual(stored.codigo_hash,messages.at(-1).code);assert.equal(Number(stored.seconds),600);
});

test('Validación de correo y falta de configuración no envían mensajes',async()=>{
 assert.equal((await call('forgotPassword',{correo:'no-es-un-correo'})).statusCode,400);
 assert.equal((await call('forgotPassword',{correo:'a'.repeat(151)+'@correo.com'})).statusCode,400);
 const {createPasswordHandlers}=await import('../src/controllers/password.controller.js');
 const unavailable=createPasswordHandlers({db,mailReady:()=>false});
 await assert.rejects(unavailable.forgotPassword({body:{correo:'persona@gmail.com'}},response()),{status:503});
});

test('Reenvíos respetan 60 segundos y el nuevo código reemplaza al anterior',async()=>{
 const user=await account(),first=await ask(user),oldCode=messages.at(-1).code,before=messages.length;
 const duplicate=await ask(user);
 assert.equal(duplicate.body.challengeId,first.body.challengeId);assert.equal(messages.length,before);
 await db.query("UPDATE password_recovery_codes SET creado_en=now()-interval '61 seconds' WHERE id=$1",[first.body.challengeId]);
 const next=await ask(user);assert.notEqual(next.body.challengeId,first.body.challengeId);assert.equal(messages.length,before+1);
 assert.equal((await call('verifyResetCode',{challengeId:first.body.challengeId,code:oldCode})).statusCode,400);
 assert.equal((await call('verifyResetCode',{challengeId:next.body.challengeId,code:messages.at(-1).code})).statusCode,200);
});

test('Cinco códigos incorrectos bloquean el desafío incluso si después se escribe el correcto',async()=>{
 const user=await account(),request=await ask(user),correct=messages.at(-1).code;
 const wrong=correct==='000000'?'111111':'000000';
 for(let i=0;i<5;i++)assert.equal((await call('verifyResetCode',{challengeId:request.body.challengeId,code:wrong})).statusCode,400);
 assert.equal((await db.query('SELECT intentos FROM password_recovery_codes WHERE id=$1',[request.body.challengeId])).rows[0].intentos,5);
 assert.equal((await call('verifyResetCode',{challengeId:request.body.challengeId,code:correct})).statusCode,400);
 const before=messages.length;await ask(user);assert.equal(messages.length,before);
});

test('Un código vencido, con correo cambiado o de cuenta desactivada no autoriza el cambio',async()=>{
 for(const mutation of ['expired','email','inactive','version']){
  const user=await account(),request=await ask(user),code=messages.at(-1).code;
  if(mutation==='expired')await db.query("UPDATE password_recovery_codes SET expira=now()-interval '1 second' WHERE id=$1",[request.body.challengeId]);
  if(mutation==='email')await db.query("UPDATE usuarios SET correo='cambiado-'||correo WHERE id_usuario=$1",[user.id_usuario]);
  if(mutation==='inactive')await db.query("UPDATE usuarios SET estado='inactivo' WHERE id_usuario=$1",[user.id_usuario]);
  if(mutation==='version')await db.query('UPDATE usuarios SET token_version=token_version+1 WHERE id_usuario=$1',[user.id_usuario]);
  assert.equal((await call('verifyResetCode',{challengeId:request.body.challengeId,code})).statusCode,400,mutation);
 }
});

test('Recuperación completa cambia el hash, consume código y autorización y revoca las sesiones previas',async()=>{
 const user=await account(),request=await ask(user),code=messages.at(-1).code;
 const grant=await call('verifyResetCode',{challengeId:request.body.challengeId,code});
 assert.equal(grant.statusCode,200);assert.match(grant.body.token,/^[a-f\d]{64}$/);assert.equal(grant.body.expiresIn,300);
 assert.equal((await call('verifyResetCode',{challengeId:request.body.challengeId,code})).statusCode,400);
 const stored=(await db.query('SELECT * FROM password_resets WHERE id_usuario=$1',[user.id_usuario])).rows[0];
 assert.equal(stored.token_hash,createHash('sha256').update(grant.body.token).digest('hex'));
 const newPassword='NuevaPassword!2026';
 assert.equal((await call('resetPassword',{token:grant.body.token,password:newPassword})).statusCode,200);
 assert.equal((await call('resetPassword',{token:grant.body.token,password:newPassword})).statusCode,400);
 const updated=(await db.query('SELECT contrasena_hash,token_version FROM usuarios WHERE id_usuario=$1',[user.id_usuario])).rows[0];
 assert.equal(await bcrypt.compare(newPassword,updated.contrasena_hash),true);assert.equal(await bcrypt.compare(originalPassword,updated.contrasena_hash),false);assert.equal(updated.token_version,1);
 const oldSession=jwt.sign({id_usuario:user.id_usuario,version:0},process.env.JWT_SECRET);
 const auth=response();await verifyToken({headers:{authorization:`Bearer ${oldSession}`}},auth,()=>assert.fail('La sesión anterior debe estar revocada'));
 assert.equal(auth.statusCode,401);
});

test('La autorización corta también vence y no permite contraseñas truncadas por bytes',async()=>{
 const user=await account(),grant=await verify(user);
 assert.equal((await call('resetPassword',{token:grant.body.token,password:'🔐'.repeat(19)})).statusCode,400);
 assert.equal((await call('resetPassword',{token:grant.body.token,password:'corta'})).statusCode,400);
 await db.query("UPDATE password_resets SET expira=now()-interval '1 second' WHERE id_usuario=$1",[user.id_usuario]);
 assert.equal((await call('resetPassword',{token:grant.body.token,password:'NuevaPassword!2026'})).statusCode,400);
});

test('Cambiar la contraseña desde la cuenta elimina las autorizaciones de recuperación',async()=>{
 const user=await account(),grant=await verify(user);
 assert.equal((await call('changePassword',{actual:originalPassword,nueva:'CambioDesdeCuenta!2026'},{id:user.id_usuario,token_version:0})).statusCode,200);
 assert.equal((await call('resetPassword',{token:grant.body.token,password:'OtraPassword!2026'})).statusCode,400);
});

test('Verificaciones y guardados simultáneos solo tienen un ganador y no causan bloqueos mutuos',async()=>{
 const user=await account(),request=await ask(user),code=messages.at(-1).code;
 const results=await Promise.all([1,2].map(()=>call('verifyResetCode',{challengeId:request.body.challengeId,code})));
 assert.deepEqual(results.map(result=>result.statusCode).sort(),[200,400]);
 const token=results.find(result=>result.statusCode===200).body.token;
 const saves=await Promise.all([1,2].map(()=>call('resetPassword',{token,password:'ConcurrentePassword!2026'})));
 assert.deepEqual(saves.map(result=>result.statusCode).sort(),[200,400]);
});

test('Una falla de Gmail no filtra existencia ni invalida el código previamente enviado',async()=>{
 const user=await account(),first=await ask(user),oldCode=messages.at(-1).code;
 await db.query("UPDATE password_recovery_codes SET creado_en=now()-interval '61 seconds' WHERE id=$1",[first.body.challengeId]);
 failDelivery=true;
 try{
  const result=await ask(user),unknown=await call('forgotPassword',{correo:'ausente@pruebas.local'});
  assert.equal(result.statusCode,200);assert.equal(result.body.message,unknown.body.message);
  assert.equal((await db.query('SELECT id FROM password_recovery_codes WHERE id_usuario=$1',[user.id_usuario])).rows[0].id,first.body.challengeId);
 }finally{failDelivery=false;}
 assert.equal((await call('verifyResetCode',{challengeId:first.body.challengeId,code:oldCode})).statusCode,200);
});

test('Gmail usa TLS, contraseña de aplicación y un correo con código sin enlaces ni contraseña',()=>{
 const config=gmailConfiguration({GMAIL_USER:' prueba@gmail.com ',GMAIL_APP_PASSWORD:'abcd efgh ijkl mnop'});
 assert.equal(config.host,'smtp.gmail.com');assert.equal(config.port,465);assert.equal(config.secure,true);assert.equal(config.auth.pass,'abcdefghijklmnop');assert.equal(config.logger,false);
 assert.equal(gmailConfiguration({GMAIL_USER:'prueba@gmail.com',GMAIL_APP_PASSWORD:'habitual'}),null);
 const email=recoveryEmail('003142');assert.ok(email.text.includes('003142'));assert.ok(email.html.includes('003142'));assert.ok(email.text.includes('10 minutos'));assert.ok(!email.html.includes('href='));
 assert.throws(()=>recoveryEmail('<script>'));
});
