const User = require('../models/userModel');
const { verifyPassword, signToken } = require('../utils/auth');
const { HttpError } = require('../middleware/errorHandler');
const { DELETED_MSG } = require('../middleware/auth');
const { pool } = require('../config/db');

const publicUser = (u) => ({ user_id: u.user_id, username: u.username, role: u.role, vendor_id: u.vendor_id, supplier_id: u.supplier_id });
const session = async (u) => ({ token: signToken(publicUser(u)), user: publicUser(u), profile: await User.profile(u) });

exports.login = async (req, res, next) => {
  try {
    const user = await User.findByUsername(req.body.username);
    if (!user || !verifyPassword(req.body.password, user.password_hash)) throw new HttpError(401, 'Incorrect username or password');
    if (user.role === 'VENDOR') {
      const [[v]] = await pool.query('SELECT status FROM vendors WHERE vendor_id = ?', [user.vendor_id]);
      if (v?.status === 'DELETED') throw new HttpError(403, DELETED_MSG);
    }
    if (user.role !== 'ADMIN' && !user.password_enc) await User.rememberPassword(user.user_id, req.body.password).catch(() => {});
    res.status(200).json(await session(user));
  } catch (e) { next(e); }
};

exports.register = async (req, res, next) => {
  try {
    const id = req.body.role === 'VENDOR' ? await User.registerVendor(req.body) : await User.registerSupplier(req.body);
    const user = (await require('../config/db').pool.query('SELECT * FROM users WHERE user_id = ?', [id]))[0][0];
    res.status(201).json(await session(user));
  } catch (e) { next(e); }
};

exports.me = async (req, res, next) => {
  try {
    const user = await User.findByUsername(req.user.username);
    if (!user) throw new HttpError(401, 'This account no longer exists');
    res.status(200).json({ user: publicUser(user), profile: await User.profile(user) });
  } catch (e) { next(e); }
};
