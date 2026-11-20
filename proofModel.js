const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

// Payment slips are private: they live outside the public /uploads folder and are only sent to the admin or the vendor who owns them.
const DIR = path.join(__dirname, '..', '..', 'private', 'proofs');
exports.DIR = DIR;
exports.pathOf = (stored) => path.join(DIR, path.basename(stored));

exports.forSale = async (saleId) =>
  (await pool.query('SELECT proof_id, sale_id, vendor_id, file_name, uploaded_at FROM payment_proofs WHERE sale_id = ? ORDER BY proof_id', [saleId]))[0];
exports.findById = async (id) => (await pool.query('SELECT * FROM payment_proofs WHERE proof_id = ?', [id]))[0][0];
exports.add = async ({ sale_id, vendor_id, file_name, stored_name }) =>
  (await pool.query('INSERT INTO payment_proofs (sale_id, vendor_id, file_name, stored_name) VALUES (?,?,?,?)', [sale_id, vendor_id, file_name, stored_name]))[0].insertId;
exports.remove = async (id) => (await pool.query('DELETE FROM payment_proofs WHERE proof_id = ?', [id]))[0];

// Stored file names of a sale's slips (read before the sale is deleted, so the files can be removed too).
exports.storedNamesForSale = async (saleId) =>
  (await pool.query('SELECT stored_name FROM payment_proofs WHERE sale_id = ?', [saleId]))[0].map((r) => r.stored_name);
exports.deleteFiles = (names) => names.forEach((n) => { try { fs.unlinkSync(exports.pathOf(n)); } catch { /* already gone */ } });
