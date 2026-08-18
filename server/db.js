import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '.env') });

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hal_procurement',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

// Helper for executing queries with parameters
export const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.DEBUG_SQL === 'true') {
    console.log('Executed SQL:', { text, duration, rows: res.rowCount });
  }
  return res;
};

// Returns all matching rows (array)
export const all = async (text, params) => {
  const res = await query(text, params);
  return res.rows;
};

// Returns a single matching row (or undefined)
export const get = async (text, params) => {
  const res = await query(text, params);
  return res.rows[0];
};

// Runs an INSERT/UPDATE/DELETE and returns { rowCount, rows }
export const run = async (text, params) => {
  const res = await query(text, params);
  return { rowCount: res.rowCount, rows: res.rows };
};

// Executes a multi-query callback within a single database transaction
export const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

export const nowISO = () => new Date().toISOString().slice(0, 10);
export const nowStamp = () => new Date().toISOString();

export default {
  pool,
  query,
  all,
  get,
  run,
  withTransaction,
  nowISO,
  nowStamp
};
