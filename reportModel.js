const { pool } = require('../config/db');
const stockModel = require('./stockModel');
const { round2 } = require('../utils/calc');

// 1. Five most frequently sold fruits (by boxes sold)
exports.topFruits = async () =>
  (await pool.query(`SELECT f.fruit_id, f.fruit_name, SUM(sd.quantity) AS boxes_sold, COUNT(DISTINCT sd.sale_id) AS times_sold
                     FROM sales_details sd JOIN fruits f ON f.fruit_id = sd.fruit_id
                     GROUP BY f.fruit_id, f.fruit_name ORDER BY boxes_sold DESC LIMIT 5`))[0];

// 2. Total revenue between two dates (inclusive)
exports.revenue = async (from, to) =>
  (await pool.query(`SELECT COALESCE(SUM(total_amount),0) AS total_revenue, COUNT(*) AS number_of_sales
                     FROM sales WHERE sale_date >= ? AND sale_date < DATE_ADD(?, INTERVAL 1 DAY)`, [from, to]))[0][0];

// 3. Vendor who bought the most boxes
exports.topVendor = async () =>
  (await pool.query(`SELECT v.vendor_id, v.vendor_name, SUM(sd.quantity) AS total_boxes
                     FROM sales_details sd JOIN sales s ON s.sale_id = sd.sale_id JOIN vendors v ON v.vendor_id = s.vendor_id
                     GROUP BY v.vendor_id, v.vendor_name ORDER BY total_boxes DESC LIMIT 1`))[0][0] || null;

// 4. Current stock per fruit and packaging size
exports.stockLevels = stockModel.findAll;

// 5. Stock bought vs sold, stock left and profit / loss - per fruit and box size, with totals.
//    stock left = boxes bought - boxes sold
//    cost of boxes sold = boxes sold x average cost per box bought (total spent / boxes bought)
//    profit (or loss) = sales revenue - cost of boxes sold
exports.profitLoss = async () => {
  const [rows] = await pool.query(
    `SELECT s.fruit_id, f.fruit_name, f.image_url, s.packaging_size,
            COALESCE(b.qty,0) AS bought_qty, COALESCE(b.cost,0) AS bought_cost,
            COALESCE(d.qty,0) AS sold_qty,   COALESCE(d.revenue,0) AS sold_revenue
     FROM stock s
     JOIN fruits f ON f.fruit_id = s.fruit_id
     LEFT JOIN (SELECT fruit_id, packaging_size, SUM(quantity) AS qty, SUM(quantity * unit_cost) AS cost
                FROM purchase_details GROUP BY fruit_id, packaging_size) b
            ON b.fruit_id = s.fruit_id AND b.packaging_size = s.packaging_size
     LEFT JOIN (SELECT fruit_id, packaging_size, SUM(quantity) AS qty, SUM(quantity * unit_price) AS revenue
                FROM sales_details GROUP BY fruit_id, packaging_size) d
            ON d.fruit_id = s.fruit_id AND d.packaging_size = s.packaging_size
     ORDER BY f.fruit_name, FIELD(s.packaging_size,'SMALL','MEDIUM','LARGE')`);

  const lines = rows.map((r) => {
    const bought_qty = Number(r.bought_qty), sold_qty = Number(r.sold_qty);
    const bought_cost = round2(r.bought_cost), sold_revenue = round2(r.sold_revenue);
    const avg_cost = bought_qty ? bought_cost / bought_qty : 0;
    const stock_left = bought_qty - sold_qty;
    const cost_of_sold = round2(avg_cost * sold_qty);
    return {
      fruit_id: r.fruit_id, fruit_name: r.fruit_name, image_url: r.image_url, packaging_size: r.packaging_size,
      bought_qty, bought_cost, avg_cost: round2(avg_cost), sold_qty, sold_revenue, stock_left,
      stock_left_value: round2(avg_cost * stock_left), cost_of_sold, profit: round2(sold_revenue - cost_of_sold),
    };
  }).filter((l) => l.bought_qty || l.sold_qty);

  const sum = (key) => round2(lines.reduce((t, l) => t + l[key], 0));
  const totals = {
    bought_qty: sum('bought_qty'), bought_cost: sum('bought_cost'), sold_qty: sum('sold_qty'), sold_revenue: sum('sold_revenue'),
    stock_left: sum('stock_left'), stock_left_value: sum('stock_left_value'), cost_of_sold: sum('cost_of_sold'), profit: sum('profit'),
  };
  // Money in the till view: everything sold minus everything spent on buying (stock still on the shelf counts as spent).
  totals.cash_result = round2(totals.sold_revenue - totals.bought_cost);
  return { lines, totals };
};
