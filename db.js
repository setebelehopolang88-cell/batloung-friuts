require('dotenv').config();
const mysql = require('mysql2/promise');

// Credentials come ONLY from environment variables (.env) - nothing is hardcoded.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, // return DECIMAL columns as numbers
});

// Never throws: a failed connection is logged, and the server keeps running.
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    conn.release();
    console.log('[DB] MySQL connection OK');
    return true;
  } catch (err) {
    console.error(`[DB] Could not connect to MySQL (${err.code || 'ERROR'}): ${err.message}`);
    console.error('[DB] Check DB_HOST / DB_USER / DB_PASSWORD / DB_NAME in backend/.env and that MySQL is running.');
    return false;
  }
}

module.exports = { pool, testConnection };
