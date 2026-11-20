// Brings an existing database up to date (safe to run on every start) and makes sure both admin log ins exist.
const { pool } = require('../config/db');
const { hashPassword } = require('./auth');

const hasColumn = async (table, column) => {
  const [r] = await pool.query(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?', [table, column]);
  return r.length > 0;
};

exports.ensureSchema = async () => {
  if (!(await hasColumn('vendors', 'status')))
    await pool.query("ALTER TABLE vendors ADD COLUMN status ENUM('ACTIVE','DELETED') NOT NULL DEFAULT 'ACTIVE'");
  if (!(await hasColumn('vendors', 'deleted_at')))
    await pool.query('ALTER TABLE vendors ADD COLUMN deleted_at DATETIME NULL');

  // Reversible copy of vendor / supplier passwords so the farm desk can view them (see utils/vault.js)
  if (!(await hasColumn('users', 'password_enc')))
    await pool.query('ALTER TABLE users ADD COLUMN password_enc VARCHAR(500) NULL');

  await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    kind       VARCHAR(20)  NOT NULL DEFAULT 'INFO',
    message    VARCHAR(255) NOT NULL,
    created_by VARCHAR(30) NULL,
    is_read    TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
  // Older databases had a fixed list of kinds; widen it so orders, offers, payment slips and notices can be told apart.
  const [[kindCol]] = await pool.query(
    "SELECT DATA_TYPE AS t FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'notifications' AND column_name = 'kind'");
  if (kindCol && kindCol.t === 'enum')
    await pool.query("ALTER TABLE notifications MODIFY COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'INFO'");

  // Order progress set by the farm desk's notices (ready to collect / delayed)
  if (!(await hasColumn('sales', 'order_status')))
    await pool.query("ALTER TABLE sales ADD COLUMN order_status ENUM('PLACED','READY','DELAYED') NOT NULL DEFAULT 'PLACED'");

  // Stock the suppliers offer to send to the business
  await pool.query(`CREATE TABLE IF NOT EXISTS supplier_offers (
    offer_id       INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id    INT NOT NULL,
    fruit_id       INT NOT NULL,
    packaging_size ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
    boxes          INT NOT NULL,
    price_per_box  DECIMAL(10,2) NOT NULL,
    note           VARCHAR(255) NULL,
    status         ENUM('PENDING','ACCEPTED','REJECTED') NOT NULL DEFAULT 'PENDING',
    admin_note     VARCHAR(255) NULL,
    purchase_id    INT NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_offer_boxes CHECK (boxes > 0),
    CONSTRAINT chk_offer_price CHECK (price_per_box > 0),
    CONSTRAINT fk_offer_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
    CONSTRAINT fk_offer_fruit    FOREIGN KEY (fruit_id)    REFERENCES fruits(fruit_id)       ON DELETE CASCADE
  ) ENGINE=InnoDB`);

  // Proof-of-payment slips (PDF) sent by vendors
  await pool.query(`CREATE TABLE IF NOT EXISTS payment_proofs (
    proof_id    INT AUTO_INCREMENT PRIMARY KEY,
    sale_id     INT NOT NULL,
    vendor_id   INT NOT NULL,
    file_name   VARCHAR(150) NOT NULL,
    stored_name VARCHAR(80)  NOT NULL,
    uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_proof_sale   FOREIGN KEY (sale_id)   REFERENCES sales(sale_id)     ON DELETE CASCADE,
    CONSTRAINT fk_proof_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);

  await pool.query(`CREATE TABLE IF NOT EXISTS business_info (
    business_id INT PRIMARY KEY,
    description TEXT NOT NULL,
    latitude    DECIMAL(9,6) NOT NULL,
    longitude   DECIMAL(9,6) NOT NULL,
    place_label VARCHAR(150) NULL,
    updated_by  VARCHAR(30) NULL,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  // The photo on the Batloung Fruits page (the admin can change it)
  if (!(await hasColumn('business_info', 'image_url')))
    await pool.query('ALTER TABLE business_info ADD COLUMN image_url VARCHAR(255) NULL');
  await pool.query(
    `INSERT IGNORE INTO business_info (business_id, description, latitude, longitude, place_label) VALUES (1, ?, -29.3167, 27.4833, 'Maseru, Lesotho')`,
    [exports.DEFAULT_DESCRIPTION]);
};

exports.DEFAULT_DESCRIPTION =
  'Batloung Fruits supplies fresh, boxed fruit to street vendors and small retailers across Maseru. ' +
  'We buy directly from trusted suppliers, pack every order in small, medium or large boxes and deliver it fresh. ' +
  'Vendors order boxes online, suppliers register the fruit they grow, and our farm desk keeps stock, payments and deliveries moving.';

// Two admin (farm desk) log ins: admin and admin2. Missing ones are created; existing ones are left alone.
exports.ensureAdmins = async () => {
  const pw = process.env.ADMIN_PASSWORD || 'admin123';
  for (const username of ['admin', 'admin2']) {
    const [r] = await pool.query('SELECT 1 FROM users WHERE username = ?', [username]);
    if (!r.length) {
      await pool.query('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)', [username, hashPassword(pw), 'ADMIN']);
      console.log(`[AUTH] Admin log in created: ${username} / ${pw}`);
    }
  }
};
