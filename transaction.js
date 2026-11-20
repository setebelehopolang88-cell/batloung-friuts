const { pool } = require('../config/db');

// Runs `work(conn)` inside BEGIN ... COMMIT. Any error => ROLLBACK, so the operation is all-or-nothing.
async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.query('BEGIN');
    const result = await work(conn);
    await conn.query('COMMIT');
    return result;
  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch (_) { /* connection already gone */ }
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { withTransaction };
