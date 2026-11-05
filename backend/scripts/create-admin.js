import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../src/config/db.js';
const correo=process.env.ADMIN_EMAIL, password=process.env.ADMIN_PASSWORD;
try {
 if(!correo || !password || password.length<12) throw new Error('Define ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 12 caracteres).');
 const hash=await bcrypt.hash(password,12);
 await pool.query("INSERT INTO usuarios(nombre,correo,contrasena_hash,rol) VALUES('Administrador',$1,$2,'admin') ON CONFLICT(correo) DO NOTHING",[correo.trim().toLowerCase(),hash]);
 console.log('Cuenta administrativa creada si no existía.');
} catch(error) { console.error(error.message); process.exitCode=1; } finally {await pool.end();}
