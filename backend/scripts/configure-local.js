import { randomBytes } from 'node:crypto';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import pg from 'pg';
const root=new URL('../../',import.meta.url);
const localPassword=randomBytes(32).toString('hex');
const client=new pg.Client({host:'127.0.0.1',port:5433,user:'wireless_local',database:'postgres'});
await client.connect();
try {
 await client.query(`ALTER ROLE wireless_local PASSWORD '${localPassword}'`);
 const exists=await client.query("SELECT 1 FROM pg_database WHERE datname='wireless_cooking'");
 if(!exists.rowCount) await client.query('CREATE DATABASE wireless_cooking');
}finally{await client.end();}
const old=await readFile(new URL('../.env',import.meta.url),'utf8').catch(()=>'');
await copyFile(new URL('../.env',import.meta.url),new URL('../.env.before-local',import.meta.url)).catch(()=>{});
const retained=old.split(/\r?\n/).filter(line=>!/^(DB_|PORT=|JWT_SECRET=|FRONTEND_URL=|PAYMENT_MODE=|IMAGE_STORAGE=|NODE_ENV=)/.test(line));
await writeFile(new URL('../.env',import.meta.url),retained.join('\n')+`\nDB_HOST=127.0.0.1\nDB_PORT=5433\nDB_NAME=wireless_cooking\nDB_USER=wireless_local\nDB_PASSWORD=${localPassword}\nDB_SSL=false\nPORT=6001\nJWT_SECRET=${randomBytes(48).toString('hex')}\nFRONTEND_URL=http://localhost:5173\nPAYMENT_MODE=demo\nIMAGE_STORAGE=local\nNODE_ENV=development\n`);
await writeFile(new URL('.postgres-local/pg_hba.conf',root),'host all all 127.0.0.1/32 scram-sha-256\nhost all all ::1/128 scram-sha-256\n');
await writeFile(new URL('frontend/.env.local',root),'VITE_API_URL=http://localhost:6001\n');
console.log('Base local configurada en 127.0.0.1:5433. Credenciales guardadas en backend/.env.');
