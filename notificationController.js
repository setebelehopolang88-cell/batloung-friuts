const N = require('../models/notificationModel');

exports.list = async (req, res, next) => {
  try { res.status(200).json({ unread: await N.unreadCount(req.user.user_id), items: await N.listFor(req.user.user_id) }); } catch (e) { next(e); }
};
exports.unread = async (req, res, next) => {
  try { res.status(200).json({ unread: await N.unreadCount(req.user.user_id) }); } catch (e) { next(e); }
};
exports.readOne = async (req, res, next) => {
  try { await N.markRead(req.user.user_id, req.params.id); res.status(200).json({ ok: true }); } catch (e) { next(e); }
};
exports.readAll = async (req, res, next) => {
  try { await N.markAllRead(req.user.user_id); res.status(200).json({ ok: true }); } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try { await N.remove(req.user.user_id, req.params.id); res.status(200).json({ ok: true }); } catch (e) { next(e); }
};
exports.removeAll = async (req, res, next) => {
  try { await N.removeAll(req.user.user_id); res.status(200).json({ ok: true }); } catch (e) { next(e); }
};
