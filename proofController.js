const fs = require('fs');
const crypto = require('crypto');
const Proof = require('../models/proofModel');
const { pool } = require('../config/db');
const { notifyAdmins } = require('../models/notificationModel');
const { HttpError } = require('../middleware/errorHandler');

const MAX = 2 * 1024 * 1024; // 2 MB

// Vendor: POST /api/orders/:id/proofs   { data: "data:application/pdf;base64,...", file_name: "slip.pdf" }
exports.add = async (req, res, next) => {
  try {
    const [[sale]] = await pool.query('SELECT s.sale_id, s.vendor_id, v.vendor_name FROM sales s JOIN vendors v ON v.vendor_id = s.vendor_id WHERE s.sale_id = ?', [req.params.id]);
    if (!sale || sale.vendor_id !== req.user.vendor_id) throw new HttpError(404, `Order ${req.params.id} not found`);
    const m = /^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.data || ''));
    if (!m) throw new HttpError(400, 'Only PDF documents can be sent as proof of payment');
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length > MAX) throw new HttpError(400, 'The PDF must be 2 MB or smaller');
    if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new HttpError(400, 'That file is not a real PDF document');
    const rawName = String(req.body?.file_name || 'proof-of-payment.pdf').replace(/[^\w .()-]/g, '_').slice(0, 140);
    const file_name = /\.pdf$/i.test(rawName) ? rawName : `${rawName}.pdf`;
    const stored_name = `${crypto.randomBytes(16).toString('hex')}.pdf`;
    fs.mkdirSync(Proof.DIR, { recursive: true });
    fs.writeFileSync(Proof.pathOf(stored_name), buf);
    const id = await Proof.add({ sale_id: sale.sale_id, vendor_id: sale.vendor_id, file_name, stored_name });
    await notifyAdmins('PAYMENT', `${sale.vendor_name} sent a proof of payment (${file_name}) for order #${sale.sale_id}.`, req.user.username);
    res.status(201).json({ proof_id: id, proofs: await Proof.forSale(sale.sale_id) });
  } catch (e) { next(e); }
};

// Admin: any slip. Vendor: only their own. Sent as an inline PDF.
const allowed = async (req) => {
  const p = await Proof.findById(req.params.id);
  if (!p || (req.user.role === 'VENDOR' && p.vendor_id !== req.user.vendor_id)) throw new HttpError(404, 'Proof of payment not found');
  return p;
};
exports.file = async (req, res, next) => {
  try {
    const p = await allowed(req);
    const file = Proof.pathOf(p.stored_name);
    if (!fs.existsSync(file)) throw new HttpError(404, 'The PDF file is missing from the server');
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${p.file_name.replace(/"/g, '')}"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
    fs.createReadStream(file).pipe(res);
  } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try {
    const p = await allowed(req);
    await Proof.remove(p.proof_id);
    Proof.deleteFiles([p.stored_name]);
    res.status(200).json({ proofs: await Proof.forSale(p.sale_id) });
  } catch (e) { next(e); }
};
