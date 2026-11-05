import { randomBytes, randomInt, randomUUID, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { fail } from '../utils/http.js';
import { gmailConfiguration, sendRecoveryCode } from '../services/recoveryMail.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
const acceptedMessage='Si el correo pertenece a una cuenta activa, recibirás un código de recuperación. Revisa también Spam.';
const invalidCode=()=>fail(400,'El código no es válido o ya venció. Revísalo o solicita uno nuevo.');
const validPassword=value=>typeof value==='string'&&value.length>=8&&Buffer.byteLength(value,'utf8')<=72;
const validChallenge=value=>typeof value==='string'&&/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value);

// Inject mail only in isolated tests. The application always uses Gmail SMTP.
export function createPasswordHandlers({db=pool,mailReady=()=>!!gmailConfiguration(),deliverCode=sendRecoveryCode,secret=()=>process.env.JWT_SECRET}={}){
 const codeHash=(id,code)=>{
  const key=secret();
  if(typeof key!=='string'||key.length<32)throw fail(503,'La recuperación no está disponible. Contacta con soporte.');
  return createHmac('sha256',key).update(`${id}:${code}`).digest('hex');
 };
 async function forgotPassword(req,res){
  const correo=typeof req.body.correo==='string'?req.body.correo.trim().toLowerCase():'';
  if(correo.length>150||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))throw fail(400,'Ingresa un correo electrónico válido.');
  if(!mailReady())throw fail(503,'El envío de códigos aún no está configurado. Contacta con soporte.');
  let challengeId=randomUUID();
  const client=await db.connect();
  try{
   await client.query('BEGIN');
   // All recovery operations lock the account before a challenge or grant.
   const user=(await client.query("SELECT id_usuario,correo,token_version FROM usuarios WHERE lower(correo)=$1 AND estado='activo' FOR NO KEY UPDATE",[correo])).rows[0];
   if(user){
    const recent=(await client.query("SELECT id FROM password_recovery_codes WHERE id_usuario=$1 AND creado_en>now()-interval '60 seconds' AND expira>now() AND version_cuenta=$2 AND correo_cuenta=$3 ORDER BY creado_en DESC LIMIT 1",[user.id_usuario,user.token_version,user.correo])).rows[0];
    if(recent)challengeId=recent.id;
    else{
     const code=String(randomInt(0,1000000)).padStart(6,'0');
     await client.query('DELETE FROM password_recovery_codes WHERE id_usuario=$1',[user.id_usuario]);
     await client.query("INSERT INTO password_recovery_codes(id,id_usuario,codigo_hash,correo_cuenta,version_cuenta,expira) VALUES($1,$2,$3,$4,$5,now()+interval '10 minutes')",[challengeId,user.id_usuario,codeHash(challengeId,code),user.correo,user.token_version]);
     await deliverCode(user.correo,code);
    }
   }
   await client.query('COMMIT');
  }catch(error){
   await client.query('ROLLBACK');
   // SMTP failures must not reveal account existence or revoke a code that
   // was already delivered. Never log the recipient, code or credentials.
   console.error('Recovery mail could not be processed:',error.code==='EAUTH'?'GMAIL_AUTH':error.code==='ETIMEDOUT'?'GMAIL_TIMEOUT':'RECOVERY_UNAVAILABLE');
  }finally{client.release();}
  res.set('Cache-Control','no-store');
  res.json({ok:true,message:acceptedMessage,challengeId,retryAfter:60});
 }
 async function verifyResetCode(req,res){
  const {challengeId,code}=req.body;
  if(!validChallenge(challengeId)||typeof code!=='string'||!/^\d{6}$/.test(code))throw invalidCode();
  const client=await db.connect();
  let committed=false;
  try{
   await client.query('BEGIN');
   const owner=(await client.query('SELECT id_usuario FROM password_recovery_codes WHERE id=$1',[challengeId])).rows[0];
   if(!owner)throw invalidCode();
   const user=(await client.query('SELECT id_usuario,correo,estado,token_version FROM usuarios WHERE id_usuario=$1 FOR NO KEY UPDATE',[owner.id_usuario])).rows[0];
   const challenge=(await client.query('SELECT *,expira>now() AS vigente FROM password_recovery_codes WHERE id=$1 AND id_usuario=$2 FOR UPDATE',[challengeId,owner.id_usuario])).rows[0];
   if(!user||user.estado!=='activo'||!challenge||!challenge.vigente||challenge.intentos>=5||challenge.version_cuenta!==user.token_version||challenge.correo_cuenta!==user.correo)throw invalidCode();
   const expected=codeHash(challengeId,code);
   if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(challenge.codigo_hash,'hex'))){
    await client.query('UPDATE password_recovery_codes SET intentos=intentos+1 WHERE id=$1',[challengeId]);
    await client.query('COMMIT');committed=true;
    throw invalidCode();
   }
   const token=randomBytes(32).toString('hex');
   await client.query('DELETE FROM password_recovery_codes WHERE id_usuario=$1',[user.id_usuario]);
   await client.query('DELETE FROM password_resets WHERE id_usuario=$1',[user.id_usuario]);
   await client.query("INSERT INTO password_resets(id_usuario,token_hash,expira,version_cuenta,correo_cuenta) VALUES($1,$2,now()+interval '5 minutes',$3,$4)",[user.id_usuario,hash(token),user.token_version,user.correo]);
   await client.query('COMMIT');committed=true;
   res.set('Cache-Control','no-store');
   res.json({ok:true,token,expiresIn:300,message:'Código verificado. Elige tu nueva contraseña.'});
  }catch(error){if(!committed)await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 async function resetPassword(req,res){
  const {token,password}=req.body;
  if(!validPassword(password))throw fail(400,'La contraseña debe tener al menos 8 caracteres y como máximo 72 bytes.');
  if(typeof token!=='string'||!/^[\w-]{16,128}$/.test(token))throw fail(400,'La autorización no es válida o ya venció. Solicita otro código.');
  const client=await db.connect();
  try{
   await client.query('BEGIN');
   const owner=(await client.query('SELECT id_usuario FROM password_resets WHERE token_hash=$1',[hash(token)])).rows[0];
   if(!owner)throw fail(400,'La autorización no es válida o ya venció. Solicita otro código.');
   const user=(await client.query('SELECT id_usuario,correo,estado,token_version FROM usuarios WHERE id_usuario=$1 FOR NO KEY UPDATE',[owner.id_usuario])).rows[0];
   const grant=(await client.query('SELECT *,expira>now() AS vigente FROM password_resets WHERE token_hash=$1 AND id_usuario=$2 FOR UPDATE',[hash(token),owner.id_usuario])).rows[0];
   if(!user||user.estado!=='activo'||!grant||!grant.vigente||grant.version_cuenta!==user.token_version||(grant.correo_cuenta&&grant.correo_cuenta!==user.correo))throw fail(400,'La autorización no es válida o ya venció. Solicita otro código.');
   await client.query('UPDATE usuarios SET contrasena_hash=$1,token_version=token_version+1,fecha_actualizacion=now() WHERE id_usuario=$2',[await bcrypt.hash(password,12),user.id_usuario]);
   await client.query('DELETE FROM password_resets WHERE id_usuario=$1',[user.id_usuario]);
   await client.query('DELETE FROM password_recovery_codes WHERE id_usuario=$1',[user.id_usuario]);
   await client.query('COMMIT');
   res.set('Cache-Control','no-store');
   res.json({ok:true,message:'Contraseña actualizada. Inicia sesión con tu nueva contraseña.'});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 async function changePassword(req,res){
  const {actual,nueva}=req.body;
  if(!validPassword(nueva)||typeof actual!=='string'||!actual||Buffer.byteLength(actual,'utf8')>512)throw fail(400,'Revisa la contraseña actual y una nueva de al menos 8 caracteres y máximo 72 bytes.');
  if(actual===nueva)throw fail(400,'Elige una contraseña diferente de la actual.');
  const client=await db.connect();
  try{
   await client.query('BEGIN');
   const user=(await client.query('SELECT contrasena_hash,token_version FROM usuarios WHERE id_usuario=$1 FOR NO KEY UPDATE',[req.user.id])).rows[0];
   if(!user||!await bcrypt.compare(actual,user.contrasena_hash))throw fail(400,'La contraseña actual es incorrecta.');
   if(req.user.token_version!==undefined&&req.user.token_version!==user.token_version)throw fail(401,'La sesión cambió. Inicia sesión nuevamente.');
   await client.query('UPDATE usuarios SET contrasena_hash=$1,token_version=token_version+1,fecha_actualizacion=now() WHERE id_usuario=$2',[await bcrypt.hash(nueva,12),req.user.id]);
   await client.query('DELETE FROM password_resets WHERE id_usuario=$1',[req.user.id]);
   await client.query('DELETE FROM password_recovery_codes WHERE id_usuario=$1',[req.user.id]);
   await client.query('COMMIT');res.json({ok:true,message:'Contraseña actualizada. Inicia sesión nuevamente.'});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 return {forgotPassword,verifyResetCode,resetPassword,changePassword};
}
export const {forgotPassword,verifyResetCode,resetPassword,changePassword}=createPasswordHandlers();
