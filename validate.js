const { HttpError } = require('./errorHandler');

const SIZES = ['SMALL', 'MEDIUM', 'LARGE'];
const PROVINCES = ['Gauteng', 'Free State', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West'];
const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
const isPosInt = (v) => !isBlank(v) && Number.isInteger(Number(v)) && Number(v) > 0;
const isNum = (v) => !isBlank(v) && Number.isFinite(Number(v));
const phoneOk = (v) => /^\+?[0-9][0-9\s-]{6,18}$/.test(String(v).trim());
const dateOk = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !Number.isNaN(Date.parse(v));

const usernameOk = (v) => /^[a-z0-9_.]{3,30}$/.test(String(v));
const imageOk = (v) => /^(\/(uploads|fruits)\/[A-Za-z0-9_.-]+|https?:\/\/\S+)$/.test(String(v)) && String(v).length <= 255;

const finish = (errors, next) => (errors.length ? next(new HttpError(400, errors.join('; '))) : next());
const trimStrings = (b) => Object.keys(b).forEach((k) => { if (typeof b[k] === 'string') b[k] = b[k].trim(); });

const validateId = (req, res, next) => {
  if (!isPosInt(req.params.id)) return next(new HttpError(400, 'ID must be a positive whole number'));
  req.params.id = Number(req.params.id);
  next();
};

const needBody = (req) => { req.body = req.body || {}; trimStrings(req.body); return req.body; };

const supplierRules = (partial) => (req, res, next) => {
  const b = needBody(req); const e = [];
  if (!partial) ['business_name', 'contact_person', 'phone', 'province', 'address'].forEach((f) => isBlank(b[f]) && e.push(`${f} is required`));
  if (b.phone !== undefined && !phoneOk(b.phone)) e.push('phone is not a valid phone number');
  if (b.province !== undefined && !PROVINCES.includes(b.province)) e.push(`province must be one of: ${PROVINCES.join(', ')}`);
  finish(e, next);
};

const priceCheck = (prices, e) => {
  if (prices === undefined) return null;
  if (typeof prices !== 'object' || prices === null) { e.push('prices must be an object like {"SMALL":50,"MEDIUM":70,"LARGE":90}'); return null; }
  const out = {};
  Object.keys(prices).forEach((k) => {
    const size = k.toUpperCase();
    if (!SIZES.includes(size)) e.push(`prices: unknown packaging size "${k}"`);
    else if (!isNum(prices[k]) || Number(prices[k]) < 0) e.push(`prices.${size} must be a number >= 0`);
    else out[size] = Number(prices[k]);
  });
  return out;
};

const fruitRules = (partial) => (req, res, next) => {
  const b = needBody(req); const e = [];
  if (!partial && isBlank(b.fruit_name)) e.push('fruit_name is required');
  if (partial && b.fruit_name !== undefined && isBlank(b.fruit_name)) e.push('fruit_name cannot be empty');
  if (b.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(b.status)) e.push('status must be ACTIVE or INACTIVE');
  if (!isBlank(b.image_url) && !imageOk(b.image_url)) e.push('image_url is not a valid picture address');
  const prices = priceCheck(b.prices, e);
  if (prices) b.prices = prices;
  finish(e, next);
};

const loginRules = (req, res, next) => {
  const b = needBody(req); const e = [];
  b.username = String(b.username || '').toLowerCase();
  if (isBlank(b.username)) e.push('username is required');
  if (isBlank(b.password)) e.push('password is required');
  finish(e, next);
};

const registerRules = (req, res, next) => {
  const b = needBody(req); const e = [];
  b.username = String(b.username || '').toLowerCase();
  if (!usernameOk(b.username)) e.push('username must be 3-30 characters: letters, numbers, dot or underscore');
  if (isBlank(b.password) || String(b.password).length < 6) e.push('password must be at least 6 characters');
  if (b.role === 'VENDOR') {
    ['vendor_name', 'phone_number', 'location'].forEach((f) => isBlank(b[f]) && e.push(`${f} is required`));
    if (!isBlank(b.phone_number) && !phoneOk(b.phone_number)) e.push('phone_number is not a valid phone number');
  } else if (b.role === 'SUPPLIER') {
    ['business_name', 'contact_person', 'phone', 'province', 'address'].forEach((f) => isBlank(b[f]) && e.push(`${f} is required`));
    if (!isBlank(b.phone) && !phoneOk(b.phone)) e.push('phone is not a valid phone number');
    if (!isBlank(b.province) && !PROVINCES.includes(b.province)) e.push(`province must be one of: ${PROVINCES.join(', ')}`);
  } else e.push('role must be VENDOR or SUPPLIER');
  finish(e, next);
};

const supplierFruitRules = (req, res, next) => {
  const b = needBody(req); const e = [];
  if (b.fruit_id !== undefined && b.fruit_id !== '' && !isPosInt(b.fruit_id)) e.push('fruit_id must be a positive whole number');
  if (isBlank(b.fruit_id) && isBlank(b.fruit_name)) e.push('Choose an existing fruit or type the name of a new one');
  if (!isBlank(b.image_url) && !imageOk(b.image_url)) e.push('image_url is not a valid picture address');
  finish(e, next);
};

const stockRules = (req, res, next) => {
  const b = needBody(req); const e = [];
  if (b.selling_price === undefined && b.low_stock_threshold === undefined) e.push('Provide selling_price and/or low_stock_threshold');
  if (b.selling_price !== undefined && (!isNum(b.selling_price) || Number(b.selling_price) < 0)) e.push('selling_price must be a number >= 0');
  if (b.low_stock_threshold !== undefined && (isBlank(b.low_stock_threshold) || !Number.isInteger(Number(b.low_stock_threshold)) || Number(b.low_stock_threshold) < 0))
    e.push('low_stock_threshold must be a whole number >= 0');
  finish(e, next);
};

const vendorRules = (partial) => (req, res, next) => {
  const b = needBody(req); const e = [];
  if (!partial) ['vendor_name', 'phone_number', 'location'].forEach((f) => isBlank(b[f]) && e.push(`${f} is required`));
  if (b.phone_number !== undefined && !phoneOk(b.phone_number)) e.push('phone_number is not a valid phone number');
  if (b.registration_date !== undefined && !dateOk(b.registration_date)) e.push('registration_date must be YYYY-MM-DD');
  finish(e, next);
};

const checkItems = (b, e, priceField) => {
  if (!Array.isArray(b.items) || b.items.length === 0) { e.push('items must be a non-empty array'); return; }
  b.items.forEach((it, i) => {
    const n = `Item ${i + 1}`;
    if (!isPosInt(it.fruit_id)) e.push(`${n}: fruit_id must be a positive whole number`);
    it.packaging_size = String(it.packaging_size || '').toUpperCase();
    if (!SIZES.includes(it.packaging_size)) e.push(`${n}: packaging_size must be SMALL, MEDIUM or LARGE`);
    if (!isPosInt(it.quantity)) e.push(`${n}: quantity must be a positive whole number`);
    if (priceField && (!isNum(it[priceField]) || Number(it[priceField]) <= 0)) e.push(`${n}: ${priceField} must be a number greater than 0`);
    it.fruit_id = Number(it.fruit_id); it.quantity = Number(it.quantity);
    if (priceField) it[priceField] = Number(it[priceField]);
  });
};

const purchaseRules = (req, res, next) => {
  const b = needBody(req); const e = [];
  if (!isPosInt(b.supplier_id)) e.push('supplier_id is required and must be a positive whole number');
  b.supplier_id = Number(b.supplier_id);
  checkItems(b, e, 'unit_cost');
  finish(e, next);
};

const paymentCheck = (p, e, allowCredit) => {
  const methods = allowCredit ? ['CASH', 'MOBILE_MONEY', 'CREDIT'] : ['CASH', 'MOBILE_MONEY'];
  p.method = String(p.method || '').toUpperCase();
  if (!methods.includes(p.method)) e.push(`payment method must be one of: ${methods.join(', ')}`);
  if (p.amount !== undefined && p.amount !== '' && (!isNum(p.amount) || Number(p.amount) < 0)) e.push('payment amount must be a number >= 0');
  if (!allowCredit && (!isNum(p.amount) || Number(p.amount) <= 0)) e.push('payment amount must be greater than 0');
  p.amount = isNum(p.amount) ? Number(p.amount) : undefined;
};

const saleRules = (req, res, next) => {
  const b = needBody(req); const e = [];
  if (!isPosInt(b.vendor_id)) e.push('vendor_id is required and must be a positive whole number');
  b.vendor_id = Number(b.vendor_id);
  checkItems(b, e, null);
  if (b.payment !== undefined && b.payment !== null) paymentCheck(b.payment, e, true);
  finish(e, next);
};

const saleEditRules = (req, res, next) => {
  const b = needBody(req); const e = [];
  if (!isPosInt(b.vendor_id)) e.push('vendor_id is required and must be a positive whole number');
  b.vendor_id = Number(b.vendor_id);
  checkItems(b, e, null);
  finish(e, next);
};

const paymentRules = (req, res, next) => {
  const b = needBody(req); const e = [];
  paymentCheck(b, e, false);
  finish(e, next);
};

const dateRangeRules = (req, res, next) => {
  const { from, to } = req.query; const e = [];
  if (!dateOk(from)) e.push('from must be a date in YYYY-MM-DD format');
  if (!dateOk(to)) e.push('to must be a date in YYYY-MM-DD format');
  if (!e.length && from > to) e.push('from must not be after to');
  finish(e, next);
};

const offerRules = (req, res, next) => {
  const b = needBody(req); const e = [];
  if (!isPosInt(b.fruit_id)) e.push('fruit_id is required (choose a fruit)');
  b.packaging_size = String(b.packaging_size || '').toUpperCase();
  if (!SIZES.includes(b.packaging_size)) e.push(`packaging_size must be one of: ${SIZES.join(', ')}`);
  if (!isPosInt(b.boxes) || Number(b.boxes) > 100000) e.push('boxes must be a whole number from 1 to 100000');
  if (!isNum(b.price_per_box) || Number(b.price_per_box) <= 0) e.push('price_per_box must be a number greater than 0');
  if (!isBlank(b.note) && String(b.note).length > 255) e.push('note must be 255 characters or fewer');
  b.fruit_id = Number(b.fruit_id); b.boxes = Number(b.boxes); b.price_per_box = Number(b.price_per_box);
  finish(e, next);
};

const decisionRules = (req, res, next) => {
  const b = needBody(req); const e = [];
  if (!isBlank(b.note) && String(b.note).length > 150) e.push('note must be 150 characters or fewer');
  if (!isBlank(b.unit_cost) && (!isNum(b.unit_cost) || Number(b.unit_cost) <= 0)) e.push('unit_cost must be a number greater than 0');
  finish(e, next);
};

const noticeRules = (req, res, next) => {
  const b = needBody(req); const e = [];
  b.type = String(b.type || '').toUpperCase();
  if (!['REJECTED', 'READY', 'DELAYED'].includes(b.type)) e.push('type must be REJECTED, READY or DELAYED');
  if (!isBlank(b.note) && String(b.note).length > 150) e.push('note must be 150 characters or fewer');
  finish(e, next);
};

module.exports = { offerRules, decisionRules, noticeRules, loginRules, registerRules, supplierFruitRules, isBlank, isPosInt, validateId, supplierRules, fruitRules, stockRules, vendorRules, purchaseRules, saleRules, saleEditRules, paymentRules, dateRangeRules, SIZES };
