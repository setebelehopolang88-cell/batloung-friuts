// Picture upload: the browser sends { data: "data:image/png;base64,..." }; the file is saved in backend/uploads.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = require('express').Router();
const { HttpError } = require('../middleware/errorHandler');

const DIR = path.join(__dirname, '..', '..', 'uploads');
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

router.post('/', (req, res, next) => {
  try {
    const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.data || ''));
    if (!m) throw new HttpError(400, 'Upload a PNG, JPEG, WEBP or GIF picture');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 2 * 1024 * 1024) throw new HttpError(400, 'The picture must be 2 MB or smaller');
    fs.mkdirSync(DIR, { recursive: true });
    const name = `${crypto.randomBytes(12).toString('hex')}.${EXT[m[1]]}`;
    fs.writeFileSync(path.join(DIR, name), buf);
    res.status(201).json({ url: `/uploads/${name}` });
  } catch (e) { next(e); }
});
module.exports = router;
