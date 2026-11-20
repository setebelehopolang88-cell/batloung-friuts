// Part D - business calculations (the administrator never types a total).
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const calculateLineTotal = (quantity, price) => round2(quantity * price);

// lines: [{ quantity, unit_price }]
const calculateSaleTotal = (lines) =>
  round2(lines.reduce((sum, l) => sum + calculateLineTotal(l.quantity, l.unit_price), 0));

// items: [{ quantity, unit_cost }]
const calculatePurchaseTotal = (items) =>
  round2(items.reduce((sum, i) => sum + calculateLineTotal(i.quantity, i.unit_cost), 0));

const derivePaymentStatus = (total, paid) => {
  if (paid <= 0) return 'UNPAID';
  if (paid >= total) return 'PAID';
  return 'PARTIALLY_PAID';
};

const outstandingBalance = (total, paid) => round2(Math.max(total - paid, 0));

module.exports = { round2, calculateLineTotal, calculateSaleTotal, calculatePurchaseTotal, derivePaymentStatus, outstandingBalance };
