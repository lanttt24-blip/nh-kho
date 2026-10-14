import pg from 'pg';
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url);
const g = globalThis;
export const pool = g.__iwmsPool || (g.__iwmsPool = new pg.Pool({
  connectionString: url, max: 3,
  ssl: local ? false : { rejectUnauthorized: false },
}));
export const query = (text, params) => pool.query(text, params);
export async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { c.release(); }
}
