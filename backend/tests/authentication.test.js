import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const schema=`test_auth_${randomUUID().replaceAll('-','')}`;
const owner=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
const password='LocalAccess!2026';
let db,server,origin,users;
async function request(path,{method='GET',body,token}={}) {
  const response=await fetch(`${origin}/api${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,cache:response.headers.get('cache-control'),data:await response.json()};
}
const login=user=>request('/auth/login',{method:'POST',body:{correo:user.correo,password}});
before(async()=>{
  await owner.connect();await owner.query(`CREATE SCHEMA ${schema}`);
  Object.assign(process.env,{TEST_SCHEMA:schema,NODE_ENV:'test',PAYMENT_MODE:'demo',OPENAI_API_KEY:'',GMAIL_USER:'',GMAIL_APP_PASSWORD:''});
  db=(await import('../src/config/db.js')).default;
  assert.equal((await db.query('SELECT current_schema() AS name')).rows[0].name,schema);
  await db.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
  users=[];
  const hash=await bcrypt.hash(password,10);
  for(const role of ['comprador','vendedor','admin']) users.push((await db.query('INSERT INTO usuarios(nombre,correo,contrasena_hash,rol) VALUES($1,$2,$3,$4) RETURNING *',[role,`${role}@auth.test`,hash,role])).rows[0]);
  await db.query("INSERT INTO vendedores(id_usuario,nombre_tienda) VALUES($1,'Taller de prueba')",[users[1].id_usuario]);
  const app=(await import('../src/app.js')).default;
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(db)await db.end();await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await owner.end();});

test('Comprador, vendedor y administrador reciben sesión directamente con correo y contraseña',async()=>{
  for(const user of users) {
    const result=await login(user);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.cache,'no-store');
    assert.deepEqual(Object.keys(result.data).sort(),['message','ok','token','user']);
    const decoded=jwt.verify(result.data.token,process.env.JWT_SECRET,{algorithms:['HS256']});
    assert.equal(decoded.id_usuario,user.id_usuario);assert.equal(decoded.purpose,'session');
    assert.equal(result.data.user.rol,user.rol);assert.equal(result.data.user.contrasena_hash,undefined);
    assert.equal((await request('/user/profile',{token:result.data.token})).status,200);
  }
});
test('Registro de comprador y vendedor entrega sesión utilizable inmediatamente',async()=>{
  for(const role of ['buyer','seller']) {
    const result=await request(`/auth/register/${role}`,{method:'POST',body:{nombre:'Nueva cuenta',correo:`new-${role}@auth.test`,password,telefono:'3000000000',nombre_tienda:'Nueva tienda'}});
    assert.equal(result.status,201,JSON.stringify(result.data));assert.ok(result.data.token);
    assert.equal((await request(role==='seller'?'/seller/products/mine':'/user/profile',{token:result.data.token})).status,200);
  }
});
test('Contraseñas incorrectas no conceden sesión y las cuentas inactivas no pueden entrar',async()=>{
  for(const user of users) {
    const result=await request('/auth/login',{method:'POST',body:{correo:user.correo,password:'Incorrecta!2026'}});
    assert.equal(result.status,401);assert.equal(result.data.token,undefined);
  }
  await db.query("UPDATE usuarios SET estado='inactivo' WHERE id_usuario=$1",[users[0].id_usuario]);
  assert.equal((await login(users[0])).status,403);
  await db.query("UPDATE usuarios SET estado='activo' WHERE id_usuario=$1",[users[0].id_usuario]);
});
test('Los permisos siguen dependiendo del rol guardado y rechazan tokens caducados o de otro propósito',async()=>{
  const buyer=(await login(users[0])).data;
  assert.equal((await request('/seller/products/mine',{token:buyer.token})).status,403);
  assert.equal((await request('/admin/dashboard',{token:buyer.token})).status,403);
  const claims={id_usuario:users[0].id_usuario,version:0,rol:'admin',purpose:'session'};
  assert.equal((await request('/admin/dashboard',{token:jwt.sign(claims,process.env.JWT_SECRET)})).status,403);
  assert.equal((await request('/user/profile',{token:jwt.sign({...claims,purpose:'password-reset'},process.env.JWT_SECRET)})).status,401);
  assert.equal((await request('/user/profile',{token:jwt.sign(claims,process.env.JWT_SECRET,{expiresIn:-1})})).status,401);
});
test('Un vendedor conserva la recuperación de contraseña y se revocan sus sesiones anteriores',async()=>{
  const seller=users[1],session=(await login(seller)).data,token=randomUUID();
  await db.query("INSERT INTO password_resets(id_usuario,token_hash,expira,version_cuenta,correo_cuenta) VALUES($1,$2,now()+interval '10 minutes',0,$3)",[seller.id_usuario,createHash('sha256').update(token).digest('hex'),seller.correo]);
  const next='UpdatedLocal!2026';
  assert.equal((await request('/auth/reset-password',{method:'POST',body:{token,password:next}})).status,200);
  assert.equal((await request('/user/profile',{token:session.token})).status,401);
  const result=await request('/auth/login',{method:'POST',body:{correo:seller.correo,password:next}});
  assert.equal(result.status,200);assert.ok(result.data.token);assert.equal((await request('/seller/products/mine',{token:result.data.token})).status,200);
});
