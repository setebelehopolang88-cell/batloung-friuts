// Automated check of the Take-Home Test requirements (Parts A, C and D) against a RUNNING server.
//
//   1. Start the API:           cd backend && npm start
//   2. In another terminal:     cd backend && node --test tests/api.test.js
//
// It creates its own supplier, fruit and vendor (names start with "ZZ Test"), uses them, and removes them again,
// so your real data is not touched. Needs Node.js 18+.
require('dotenv').config();
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../src/config/db');

const BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
const ADMIN = { username: process.env.TEST_ADMIN_USER || 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' };
const stamp = String(Date.now()).slice(-7);
const names = { supplier: `ZZ Test Supplier ${stamp}`, fruit: `ZZ Test Fruit ${stamp}`, vendor: `ZZ Test Vendor ${stamp}` };
const phones = { supplier: `+2711${stamp}`, vendor: `+2662${stamp}` };

let token = null;
const call = async (method, path, body, useToken = true) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(useToken && token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null; try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, data };
};
const GET = (p) => call('GET', p);
const POST = (p, b) => call('POST', p, b);
const PUT = (p, b) => call('PUT', p, b);
const DEL = (p) => call('DELETE', p);

const state = { purchases: [], sales: [] };
const stockOf = async () => {
  const r = await GET(`/stock/fruit/${state.fruitId}`);
  assert.equal(r.status, 200);
  return Object.fromEntries(r.data.map((s) => [s.packaging_size, s.available_quantity]));
};
const count = async (table) => (await pool.query(`SELECT COUNT(*) AS n FROM ${table}`))[0][0].n;
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

before(async () => {
  const r = await call('POST', '/auth/login', ADMIN, false);
  assert.equal(r.status, 200, `Could not sign in as ${ADMIN.username}. Is the server running (npm start) and is the password right?`);
  token = r.data.token;
});

after(async () => {
  // Remove everything this test created. Sales and purchases go through the API so stock is moved back properly.
  for (const id of state.sales) await DEL(`/sales/${id}`);
  for (const id of state.purchases) await DEL(`/purchases/${id}`);
  await pool.query('DELETE FROM vendors WHERE phone_number = ?', [phones.vendor]);
  await pool.query('DELETE FROM fruits WHERE fruit_name = ?', [names.fruit]);   // its stock rows go with it
  await pool.query('DELETE FROM suppliers WHERE phone = ?', [phones.supplier]);
  await pool.end();
});

describe('Server, sign in and access', () => {
  it('GET /api/health answers 200', async () => {
    const res = await fetch(`${BASE}/api/health`);
    assert.equal(res.status, 200);
  });
  it('rejects a request with no token (401)', async () => assert.equal((await call('GET', '/suppliers', undefined, false)).status, 401));
  it('rejects a wrong password (401)', async () => assert.equal((await call('POST', '/auth/login', { username: ADMIN.username, password: 'wrong-password' }, false)).status, 401));
  it('a vendor cannot use admin endpoints (403)', async () => {
    const l = await call('POST', '/auth/login', { username: 'vendor1', password: 'password123' }, false);
    if (l.status !== 200) return; // demo vendor account not present
    const res = await fetch(`${BASE}/api/suppliers`, { headers: { Authorization: `Bearer ${l.data.token}` } });
    assert.equal(res.status, 403);
  });
  it('unknown route answers 404', async () => assert.equal((await GET('/does-not-exist')).status, 404));
  it('a bad ID answers 400', async () => assert.equal((await GET('/suppliers/abc')).status, 400));
});

describe('Part C - Supplier management', () => {
  const body = () => ({ business_name: names.supplier, contact_person: 'Test Person', phone: phones.supplier, province: 'Gauteng', address: '1 Test Road' });
  it('registers a supplier (201)', async () => {
    const r = await POST('/suppliers', body());
    assert.equal(r.status, 201); assert.equal(r.data.business_name, names.supplier);
    state.supplierId = r.data.supplier_id;
  });
  it('rejects missing fields and an invalid province (400)', async () => {
    assert.equal((await POST('/suppliers', { business_name: 'x' })).status, 400);
    assert.equal((await POST('/suppliers', { ...body(), business_name: 'Other', phone: '+27110000000', province: 'Atlantis' })).status, 400);
  });
  it('rejects a duplicate (409)', async () => assert.equal((await POST('/suppliers', body())).status, 409));
  it('retrieves all suppliers (200)', async () => {
    const r = await GET('/suppliers');
    assert.equal(r.status, 200); assert.ok(r.data.some((s) => s.supplier_id === state.supplierId));
  });
  it('retrieves one supplier by ID (200) and 404 for an unknown ID', async () => {
    assert.equal((await GET(`/suppliers/${state.supplierId}`)).status, 200);
    assert.equal((await GET('/suppliers/99999999')).status, 404);
  });
  it('updates a supplier (200)', async () => {
    const r = await PUT(`/suppliers/${state.supplierId}`, { contact_person: 'Changed Person' });
    assert.equal(r.status, 200); assert.equal(r.data.contact_person, 'Changed Person');
  });
});

describe('Part C - Fruit and stock management', () => {
  it('registers a fruit with prices for each packaging size (201)', async () => {
    const r = await POST('/fruits', { fruit_name: names.fruit, description: 'Test fruit', prices: { SMALL: 15, MEDIUM: 25, LARGE: 40 } });
    assert.equal(r.status, 201);
    state.fruitId = r.data.fruit_id;
  });
  it('rejects a fruit without a name (400)', async () => assert.equal((await POST('/fruits', { description: 'no name' })).status, 400));
  it('retrieves all fruits (200)', async () => {
    const r = await GET('/fruits');
    assert.equal(r.status, 200); assert.ok(r.data.some((f) => f.fruit_id === state.fruitId));
  });
  it('updates a fruit (200)', async () => {
    const r = await PUT(`/fruits/${state.fruitId}`, { description: 'Updated description' });
    assert.equal(r.status, 200); assert.equal(r.data.description, 'Updated description');
  });
  it('shows SEPARATE stock for small, medium and large, each with its own price', async () => {
    const r = await GET(`/stock/fruit/${state.fruitId}`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.map((s) => s.packaging_size).sort(), ['LARGE', 'MEDIUM', 'SMALL']);
    const price = Object.fromEntries(r.data.map((s) => [s.packaging_size, s.selling_price]));
    assert.deepEqual(price, { SMALL: 15, MEDIUM: 25, LARGE: 40 });
  });
  it('lists the fruit as low stock while it has no boxes', async () => {
    const r = await GET('/stock/low');
    assert.equal(r.status, 200);
    assert.ok(r.data.some((s) => s.fruit_id === state.fruitId), 'new fruit with 0 boxes should be listed as low stock');
  });
});

describe('Part C - Vendor management', () => {
  it('registers a vendor (201)', async () => {
    const r = await POST('/vendors', { vendor_name: names.vendor, phone_number: phones.vendor, location: 'Maseru - Test' });
    assert.equal(r.status, 201); state.vendorId = r.data.vendor_id;
  });
  it('rejects an invalid phone number (400) and a duplicate (409)', async () => {
    assert.equal((await POST('/vendors', { vendor_name: 'Bad', phone_number: 'abc', location: 'x' })).status, 400);
    assert.equal((await POST('/vendors', { vendor_name: 'Dup', phone_number: phones.vendor, location: 'x' })).status, 409);
  });
  it('retrieves all vendors (200)', async () => {
    const r = await GET('/vendors'); assert.equal(r.status, 200); assert.ok(r.data.some((v) => v.vendor_id === state.vendorId));
  });
  it('searches by NAME and by PHONE NUMBER (200)', async () => {
    const byName = await GET(`/vendors/search?q=${encodeURIComponent(names.vendor)}`);
    const byPhone = await GET(`/vendors/search?q=${encodeURIComponent(phones.vendor)}`);
    assert.equal(byName.status, 200); assert.equal(byPhone.status, 200);
    assert.ok(byName.data.some((v) => v.vendor_id === state.vendorId));
    assert.ok(byPhone.data.some((v) => v.vendor_id === state.vendorId));
  });
  it('updates vendor details (200) and answers 404 for an unknown vendor', async () => {
    const r = await PUT(`/vendors/${state.vendorId}`, { location: 'Maseru - Moved' });
    assert.equal(r.status, 200); assert.equal(r.data.location, 'Maseru - Moved');
    assert.equal((await PUT('/vendors/99999999', { location: 'x' })).status, 404);
  });
});

describe('Part C/D - Purchases: several fruits, automatic total, stock increases per packaging size', () => {
  it('records a purchase with 2 items; total is calculated and stock goes up (201)', async () => {
    const r = await POST('/purchases', { supplier_id: state.supplierId, items: [
      { fruit_id: state.fruitId, packaging_size: 'SMALL', quantity: 20, unit_cost: 10 },
      { fruit_id: state.fruitId, packaging_size: 'LARGE', quantity: 6, unit_cost: 30 },
    ] });
    assert.equal(r.status, 201);
    state.purchases.push(r.data.purchase_id);
    const p = await GET(`/purchases/${r.data.purchase_id}`);
    assert.equal(p.data.total_amount, 20 * 10 + 6 * 30);           // 380, never typed by the administrator
    assert.deepEqual(await stockOf(), { SMALL: 20, MEDIUM: 0, LARGE: 6 });
  });
  it('rejects the WHOLE purchase when one item is invalid: no purchase row, no stock change', async () => {
    const before = { purchases: await count('purchases'), stock: await stockOf() };
    const r = await POST('/purchases', { supplier_id: state.supplierId, items: [
      { fruit_id: state.fruitId, packaging_size: 'MEDIUM', quantity: 50, unit_cost: 20 },   // valid
      { fruit_id: 99999999, packaging_size: 'SMALL', quantity: 5, unit_cost: 10 },          // fruit does not exist
    ] });
    assert.equal(r.status, 404);
    assert.equal(await count('purchases'), before.purchases);
    assert.deepEqual(await stockOf(), before.stock);
  });
  it('validates input (400) and unknown supplier (404)', async () => {
    assert.equal((await POST('/purchases', { supplier_id: state.supplierId, items: [] })).status, 400);
    assert.equal((await POST('/purchases', { supplier_id: state.supplierId, items: [{ fruit_id: state.fruitId, packaging_size: 'HUGE', quantity: 1, unit_cost: 1 }] })).status, 400);
    assert.equal((await POST('/purchases', { supplier_id: 99999999, items: [{ fruit_id: state.fruitId, packaging_size: 'SMALL', quantity: 1, unit_cost: 1 }] })).status, 404);
  });
  it('a supplier with purchases cannot be deleted (409)', async () => assert.equal((await DEL(`/suppliers/${state.supplierId}`)).status, 409));
});

describe('Part C/D - Sales: atomic, stock checks, automatic totals', () => {
  it('NB scenario: 10 LARGE requested, only 6 available -> whole sale rejected, nothing changes', async () => {
    const before = { sales: await count('sales'), details: await count('sales_details'), stock: await stockOf() };
    assert.equal(before.stock.LARGE, 6);
    const r = await POST('/sales', { vendor_id: state.vendorId, items: [
      { fruit_id: state.fruitId, packaging_size: 'SMALL', quantity: 3 },     // valid item
      { fruit_id: state.fruitId, packaging_size: 'LARGE', quantity: 10 },    // only 6 available
    ] });
    assert.equal(r.status, 400); assert.match(r.data.error, /Insufficient stock/);
    assert.equal(await count('sales'), before.sales);
    assert.equal(await count('sales_details'), before.details);
    assert.deepEqual(await stockOf(), before.stock);                          // the valid SMALL item was rolled back too
  });
  it('rejects an unknown vendor (404) and bad input (400)', async () => {
    assert.equal((await POST('/sales', { vendor_id: 99999999, items: [{ fruit_id: state.fruitId, packaging_size: 'SMALL', quantity: 1 }] })).status, 404);
    assert.equal((await POST('/sales', { vendor_id: state.vendorId, items: [{ fruit_id: state.fruitId, packaging_size: 'SMALL', quantity: 0 }] })).status, 400);
  });
  it('sale A (CASH, 2 items): total from each size\'s own price, status PAID, stock reduced per size', async () => {
    const r = await POST('/sales', { vendor_id: state.vendorId, payment: { method: 'CASH' }, items: [
      { fruit_id: state.fruitId, packaging_size: 'SMALL', quantity: 5 },     // 5 x 15 = 75
      { fruit_id: state.fruitId, packaging_size: 'LARGE', quantity: 2 },     // 2 x 40 = 80
    ] });
    assert.equal(r.status, 201); state.sales.push(r.data.sale_id);
    const s = await GET(`/sales/${r.data.sale_id}`);
    assert.equal(s.data.total_amount, 155); assert.equal(s.data.payment_status, 'PAID'); assert.equal(s.data.outstanding_balance, 0);
    assert.deepEqual(await stockOf(), { SMALL: 15, MEDIUM: 0, LARGE: 4 });
  });
  it('sale B (MOBILE_MONEY part payment): status PARTIALLY_PAID, balance 10', async () => {
    const r = await POST('/sales', { vendor_id: state.vendorId, payment: { method: 'MOBILE_MONEY', amount: 50 }, items: [{ fruit_id: state.fruitId, packaging_size: 'SMALL', quantity: 4 }] });
    assert.equal(r.status, 201); state.sales.push(r.data.sale_id); state.saleB = r.data.sale_id;
    const s = await GET(`/sales/${r.data.sale_id}`);
    assert.equal(s.data.total_amount, 60); assert.equal(s.data.payment_status, 'PARTIALLY_PAID'); assert.equal(s.data.outstanding_balance, 10);
  });
  it('sale C (CREDIT): status UNPAID, balance 40', async () => {
    const r = await POST('/sales', { vendor_id: state.vendorId, payment: { method: 'CREDIT' }, items: [{ fruit_id: state.fruitId, packaging_size: 'LARGE', quantity: 1 }] });
    assert.equal(r.status, 201); state.sales.push(r.data.sale_id); state.saleC = r.data.sale_id;
    const s = await GET(`/sales/${r.data.sale_id}`);
    assert.equal(s.data.total_amount, 40); assert.equal(s.data.payment_status, 'UNPAID'); assert.equal(s.data.outstanding_balance, 40);
  });
  it('stock never goes negative: asking for more than is left is rejected', async () => {
    const left = (await stockOf()).LARGE;                                     // 3 boxes
    const r = await POST('/sales', { vendor_id: state.vendorId, items: [{ fruit_id: state.fruitId, packaging_size: 'LARGE', quantity: left + 1 }] });
    assert.equal(r.status, 400);
    assert.equal((await stockOf()).LARGE, left);
  });
});

describe('Part D - Vendor payments and outstanding balances', () => {
  const balanceOfVendor = async () => (await GET('/vendors/balances')).data.find((v) => v.vendor_id === state.vendorId);
  it('shows the vendor\'s outstanding balance (10 + 40 = 50)', async () => {
    const b = await balanceOfVendor();
    assert.equal(b.total_billed, 255); assert.equal(b.total_paid, 205); assert.equal(b.outstanding_balance, 50);
  });
  it('a later CASH payment on the credit sale turns it PAID and lowers the balance', async () => {
    const r = await POST(`/sales/${state.saleC}/payments`, { method: 'CASH', amount: 40 });
    assert.ok([200, 201].includes(r.status));
    assert.equal((await GET(`/sales/${state.saleC}`)).data.payment_status, 'PAID');
    assert.equal((await balanceOfVendor()).outstanding_balance, 10);
  });
  it('refuses a payment bigger than the balance (400) and a bad method (400)', async () => {
    assert.equal((await POST(`/sales/${state.saleB}/payments`, { method: 'CASH', amount: 999 })).status, 400);
    assert.equal((await POST(`/sales/${state.saleB}/payments`, { method: 'BITCOIN', amount: 5 })).status, 400);
  });
});

describe('Part D - SQL reports', () => {
  it('five most frequently sold fruits', async () => {
    const r = await GET('/reports/top-fruits');
    assert.equal(r.status, 200); assert.ok(r.data.length <= 5);
    const sold = r.data.map((x) => x.boxes_sold);
    assert.deepEqual(sold, [...sold].sort((a, b) => b - a));
  });
  it('total sales revenue for a date range (and 400 for a bad date)', async () => {
    const r = await GET(`/reports/revenue?from=${day(-1)}&to=${day(1)}`);
    assert.equal(r.status, 200); assert.ok(r.data.total_revenue >= 255);
    assert.equal((await GET('/reports/revenue?from=nonsense&to=2026-01-01')).status, 400);
  });
  it('vendor who purchased the highest number of boxes', async () => {
    const r = await GET('/reports/top-vendor');
    assert.equal(r.status, 200); assert.ok(r.data.vendor_name); assert.ok(r.data.total_boxes > 0);
  });
  it('current stock level for each fruit and packaging size', async () => {
    const r = await GET('/reports/stock-levels');
    assert.equal(r.status, 200);
    const mine = r.data.filter((s) => s.fruit_id === state.fruitId);
    assert.equal(mine.length, 3);
  });
});
