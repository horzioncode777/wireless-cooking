import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pool from '../src/config/db.js';
const client = await pool.connect();
try {
 await client.query('BEGIN');
 await client.query(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
 await client.query('COMMIT');
 console.log('Esquema actualizado.');
} catch(error) { await client.query('ROLLBACK'); console.error(error.message); process.exitCode=1; }
finally { client.release(); await pool.end(); }
