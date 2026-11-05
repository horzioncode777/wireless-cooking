import pkg from "pg";
import dotenv from "dotenv";
import { databaseOptions } from './databaseOptions.js';

dotenv.config();

// Tests must choose their isolated schema before importing any module that opens a pool.
if (process.env.NODE_TEST_CONTEXT && !/^test_[a-z0-9_]+$/.test(process.env.TEST_SCHEMA || '')) {
  throw new Error('Las pruebas deben configurar TEST_SCHEMA antes de importar la base de datos.');
}

const { Pool } = pkg;

const pool = new Pool(databaseOptions());

// An idle connection can disappear while local PostgreSQL restarts; keep the API alive.
pool.on('error', error => console.error('PostgreSQL: conexión interrumpida.', error.code || error.name));

export default pool;
