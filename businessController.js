const Business = require('../models/businessModel');
const { HttpError } = require('../middleware/errorHandler');

exports.get = async (req, res, next) => {
  try { res.status(200).json(await Business.get()); } catch (e) { next(e); }
};

// Admin only (the route is protected). Description plus the location picked on the map.
exports.update = async (req, res, next) => {
  try {
    const b = req.body || {};
    const description = String(b.description ?? '').trim();
    const latitude = Number(b.latitude), longitude = Number(b.longitude);
    const errors = [];
    if (!description) errors.push('description is required');
    if (description.length > 2000) errors.push('description must be 2000 characters or fewer');
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.push('latitude must be between -90 and 90');
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.push('longitude must be between -180 and 180');
    const place_label = b.place_label == null ? '' : String(b.place_label).trim();
    if (place_label.length > 150) errors.push('place_label must be 150 characters or fewer');
    let image_url;
    if (b.image_url !== undefined) {
      image_url = b.image_url == null ? '' : String(b.image_url).trim();
      if (image_url && !(/^\/(uploads|fruits)\/[A-Za-z0-9_.-]+$/.test(image_url) && image_url.length <= 255)) errors.push('image_url must be a picture uploaded through the site');
    }
    if (errors.length) throw new HttpError(400, errors.join('; '));
    await Business.update({ description, latitude, longitude, place_label, image_url }, req.user.username);
    res.status(200).json(await Business.get());
  } catch (e) { next(e); }
};
