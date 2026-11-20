// Password hashing (scrypt) and signed log in tokens (HS256, JWT format) using only Node's built-in crypto.
require('dotenv').config();
const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET)
  console.warn('[AUTH] JWT_SECRET is not set in backend/.env - using a temporary secret, so everyone is signed out when the server restarts.');

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(String(password), salt, 64).toString('hex')}`;
};

const verifyPassword = (password, stored) => {
  const [alg, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(String(password), salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
};

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

const signToken = (payload, ttlSeconds = 8 * 3600) => {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds });
  return `${head}.${body}.${sign(`${head}.${body}`)}`;
};

// Returns the payload, or null if the token is malformed, tampered with or expired.
const verifyToken = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const given = Buffer.from(parts[2]);
  const wanted = Buffer.from(sign(`${parts[0]}.${parts[1]}`));
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch { return null; }
};

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
