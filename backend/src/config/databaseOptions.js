import { readFileSync } from 'node:fs';

export function databaseOptions(env = process.env) {
  const ssl = env.DB_SSL === 'true' ? {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
    ...(env.DB_SSL_CA_FILE ? { ca: readFileSync(env.DB_SSL_CA_FILE, 'utf8') } : {}),
  } : false;
  return {
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5432),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl,
    connectionTimeoutMillis: 5000,
    max: 20,
    ...(env.TEST_SCHEMA && /^test_[a-z0-9_]+$/.test(env.TEST_SCHEMA) ? { options: `-c search_path=${env.TEST_SCHEMA}` } : {}),
  };
}
