// Reversible (AES-256-GCM) storage for the passwords the farm desk is allowed to look up.
// The normal scrypt hash is still what protects sign-in; this copy only exists so the admin can view a password.
// The key comes from PASSWORD_VAULT_KEY (or JWT_SECRET) in backend/.env - keep that value private and do not change it,
// otherwise saved passwords can no longer be read (the admin can then just set a new one).
require('dotenv').config();
const crypto = require('crypto');

const KEY = crypto.createHash('sha256').update(String(process.env.PASSWORD_VAULT_KEY || process.env.JWT_SECRET || 'batloung-farm-vault')).digest();

exports.seal = (text) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join('$');
};

// Returns the password, or null if nothing is saved / it cannot be read with the current key.
exports.open = (stored) => {
  try {
    const [v, iv, tag, enc] = String(stored || '').split('$');
    if (v !== 'v1' || !iv || !tag || !enc) return null;
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
  } catch { return null; }
};
