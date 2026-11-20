const { pool } = require('../config/db');

exports.get = async () => (await pool.query('SELECT description, latitude, longitude, place_label, image_url, updated_by, updated_at FROM business_info WHERE business_id = 1'))[0][0];
// image_url: undefined = leave the photo alone, null/'' = back to the default photo, otherwise the new photo address.
exports.update = async ({ description, latitude, longitude, place_label, image_url }, adminName) => {
  const sets = ['description = ?', 'latitude = ?', 'longitude = ?', 'place_label = ?', 'updated_by = ?'];
  const params = [description, latitude, longitude, place_label || null, adminName];
  if (image_url !== undefined) { sets.push('image_url = ?'); params.push(image_url || null); }
  return pool.query(`UPDATE business_info SET ${sets.join(', ')} WHERE business_id = 1`, params);
};
