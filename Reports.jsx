import { useState } from 'react';
import { api, SIZE_LABEL, downloadCsv, fixed, money } from '../api.js';
import { Alert, Field, IconBtn, Kpis, PageHead, Table, useLoad } from '../components/ui.jsx';
import StockGrid from '../components/StockGrid.jsx';

const todayStr = new Date().toISOString().slice(0, 10);
const verdict = (n) => (n > 0 ? 'Profit' : n < 0 ? 'Loss' : 'Break-even');
const tone = (n) => (n > 0 ? 'profit' : n < 0 ? 'loss' : '');
// Profit / loss shown as a coloured badge plus the amount (a loss is written with a minus sign)
const Result = ({ n }) => <span className={`pl ${tone(n)}`}><span className={`badge ${tone(n)}`}>{verdict(n)}</span> {money(Math.abs(n))}</span>;
const signed = (n) => (n < 0 ? '-' : '') + fixed(Math.abs(n));

export default function Reports() {
  const { data, error } = useLoad(async () => ({
    top: await api.get('/reports/top-fruits'), vendor: await api.get('/reports/top-vendor'), stock: await api.get('/reports/stock-levels'),
    balances: await api.get('/vendors/balances'), pl: await api.get('/reports/profit-loss'),
  }));
  const [range, setRange] = useState({ from: todayStr.slice(0, 8) + '01', to: todayStr });
  const [rev, setRev] = useState(null);
  const [msg, setMsg] = useState('');
  const [view, setView] = useState('fruit');   // fruit | size

  const run = async (e) => {
    e.preventDefault();
    try { setMsg(''); setRev(await api.get(`/reports/revenue?from=${range.from}&to=${range.to}`)); } catch (err) { setMsg(err.message); setRev(null); }
  };

  const t = data?.pl.totals;
  // "By fruit": the three box sizes of each fruit added together
  const byFruit = data && Object.values(data.pl.lines.reduce((m, l) => {
    const r = m[l.fruit_id] || (m[l.fruit_id] = { id: l.fruit_id, fruit_name: l.fruit_name, bought_qty: 0, bought_cost: 0, sold_qty: 0, sold_revenue: 0, stock_left: 0, cost_of_sold: 0, profit: 0 });
    ['bought_qty', 'bought_cost', 'sold_qty', 'sold_revenue', 'stock_left', 'cost_of_sold', 'profit'].forEach((k) => { r[k] += l[k]; });
    return m;
  }, {}));
  const rows = data && (view === 'fruit' ? byFruit : data.pl.lines.map((l) => ({ ...l, id: `${l.fruit_id}-${l.packaging_size}` })));

  const columns = [
    { label: 'Fruit', key: 'fruit_name' },
    ...(view === 'size' ? [{ label: 'Box size', render: (r) => SIZE_LABEL[r.packaging_size] }] : []),
    { label: 'Bought', num: true, key: 'bought_qty' }, { label: 'Sold', num: true, key: 'sold_qty' },
    { label: 'Left', num: true, render: (r) => <b className={r.stock_left <= 0 ? 'owing' : ''}>{r.stock_left}</b> },
    { label: 'Spent buying', num: true, render: (r) => money(r.bought_cost) },
    { label: 'Sales', num: true, render: (r) => money(r.sold_revenue) },
    { label: 'Cost of sold', num: true, render: (r) => money(r.cost_of_sold) },
    { label: 'Profit / loss', num: true, render: (r) => <span className={`pl ${tone(r.profit)}`}>{r.profit < 0 ? '-' : ''}{money(Math.abs(r.profit))}</span> },
  ];

  const download = () => {
    const out = [
      ['Batloung Farm report', todayStr], [],
      ['PROFIT AND LOSS'],
      ['Sales (money from boxes sold) (M)', fixed(t.sold_revenue)], ['Cost of the boxes sold (M)', fixed(t.cost_of_sold)],
      [`${verdict(t.profit)} (M)`, signed(t.profit)], ['Spent on buying all fruit (M)', fixed(t.bought_cost)],
      ['Sales minus everything spent on buying (M)', signed(t.cash_result)], [],
      ['STOCK BOUGHT, SOLD AND LEFT'],
      ['Fruit', 'Box size', 'Bought', 'Sold', 'Left (bought - sold)', 'Average cost per box (M)', 'Spent buying (M)', 'Sales (M)', 'Cost of boxes sold (M)', 'Profit / loss (M)', 'Value of stock left at cost (M)'],
      ...data.pl.lines.map((l) => [l.fruit_name, SIZE_LABEL[l.packaging_size], l.bought_qty, l.sold_qty, l.stock_left, fixed(l.avg_cost), fixed(l.bought_cost), fixed(l.sold_revenue), fixed(l.cost_of_sold), signed(l.profit), fixed(l.stock_left_value)]),
      ['TOTAL', '', t.bought_qty, t.sold_qty, t.stock_left, '', fixed(t.bought_cost), fixed(t.sold_revenue), fixed(t.cost_of_sold), signed(t.profit), fixed(t.stock_left_value)], [],
      ['FIVE MOST FREQUENTLY SOLD FRUITS'], ['Fruit', 'Boxes sold', 'Sales'], ...data.top.map((f) => [f.fruit_name, f.boxes_sold, f.times_sold]), [],
      ['VENDOR WITH THE MOST BOXES'], [data.vendor ? `${data.vendor.vendor_name} - ${data.vendor.total_boxes} boxes` : 'No sales yet'], [],
      ['OUTSTANDING BALANCE PER VENDOR'], ['Vendor', 'Billed (M)', 'Paid (M)', 'Outstanding (M)'], ...data.balances.map((b) => [b.vendor_name, fixed(b.total_billed), fixed(b.total_paid), fixed(b.outstanding_balance)]),
    ];
    if (rev) out.splice(2, 0, [`Sales revenue ${rev.from} to ${rev.to} (M)`, fixed(rev.total_revenue), `${rev.number_of_sales} sale(s)`], []);
    downloadCsv(`batloung-report-${todayStr}.csv`, out);
  };

  return (
    <>
      <PageHead title="Reports" hint="Stock bought and sold, what is left, and whether the farm is making a profit or a loss." />
      <Alert>{error}</Alert>
      {data && (
        <div className="report-tools no-print">
          <IconBtn icon="download" tone="download" label="Download report" onClick={download} />
          <IconBtn icon="print" tone="plain" label="Print / save as PDF" onClick={() => window.print()} />
        </div>
      )}

      {data && (
        <>
          <section className="panel pl-panel">
            <h2>Profit and loss</h2>
            <p className="result"><Result n={t.profit} /></p>
            <p className="muted small">Profit = money from boxes sold minus what those boxes cost us (boxes sold x the average price paid per box).</p>
            <Kpis items={[
              { value: money(t.sold_revenue), label: `sales (${t.sold_qty} boxes sold)` },
              { value: money(t.cost_of_sold), label: 'cost of the boxes sold' },
              { value: money(t.bought_cost), label: `spent buying ${t.bought_qty} boxes` },
              { value: `${t.stock_left} boxes`, label: `stock left, worth ${money(t.stock_left_value)} at cost` },
            ]} />
            <p className="muted small">Sales minus everything spent on buying (including the stock still on the shelf): <b className={`pl ${tone(t.cash_result)}`}>{t.cash_result < 0 ? '-' : ''}{money(Math.abs(t.cash_result))}</b></p>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Stock bought, sold and left</h2>
              <span className="seg no-print" role="group" aria-label="Group the table">
                <button className={view === 'fruit' ? 'on' : ''} onClick={() => setView('fruit')}>By fruit</button>
                <button className={view === 'size' ? 'on' : ''} onClick={() => setView('size')}>By fruit and box size</button>
              </span>
            </div>
            <p className="muted small">Left = boxes bought minus boxes sold.</p>
            <Table empty="Nothing bought or sold yet." columns={columns} rows={rows} />
            {rows.length > 0 && (
              <div className="grand">
                <span>Bought: <b>{t.bought_qty}</b></span><span>Sold: <b>{t.sold_qty}</b></span><span>Left: <b>{t.stock_left}</b></span>
                <span>Total: <Result n={t.profit} /></span>
              </div>
            )}
          </section>
        </>
      )}

      <section className="panel no-print">
        <h2>Sales revenue for a period</h2>
        <form className="item-row pay" onSubmit={run}>
          <Field label="From"><input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} required /></Field>
          <Field label="To"><input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} required /></Field>
          <button className="primary">Show revenue</button>
        </form>
        <Alert>{msg}</Alert>
        {rev && <p className="result"><b>{money(rev.total_revenue)}</b> from {rev.number_of_sales} sale(s), {rev.from} to {rev.to}</p>}
      </section>
      {data && (
        <>
          <div className="two">
            <section className="panel"><h2>Five most frequently sold fruits</h2>
              <Table columns={[{ label: 'Fruit', key: 'fruit_name' }, { label: 'Boxes sold', num: true, key: 'boxes_sold' }, { label: 'Sales', num: true, key: 'times_sold' }]} rows={data.top} /></section>
            <section className="panel"><h2>Vendor with the most boxes</h2>
              {data.vendor ? <p className="result"><b>{data.vendor.vendor_name}</b> bought {data.vendor.total_boxes} boxes</p> : <p className="muted">No sales yet.</p>}</section>
          </div>
          <section className="panel"><h2>Current stock</h2><StockGrid stock={data.stock} /></section>
          <section className="panel"><h2>Outstanding balance per vendor</h2>
            <Table columns={[{ label: 'Vendor', key: 'vendor_name' }, { label: 'Billed', num: true, render: (r) => money(r.total_billed) }, { label: 'Paid', num: true, render: (r) => money(r.total_paid) },
              { label: 'Outstanding', num: true, render: (r) => <b className={r.outstanding_balance > 0 ? 'owing' : ''}>{money(r.outstanding_balance)}</b> }]} rows={data.balances} /></section>
        </>
      )}
    </>
  );
}
