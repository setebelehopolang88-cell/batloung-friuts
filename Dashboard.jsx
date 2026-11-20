import { api, money } from '../api.js';
import { Alert, PageHead, Table, useLoad, Badge } from '../components/ui.jsx';
import StockGrid from '../components/StockGrid.jsx';
import FruitPic from '../components/FruitPic.jsx';
import OrderCard from '../components/OrderCard.jsx';

export default function Dashboard({ go }) {
  const { data, error } = useLoad(async () => {
    const [stock, low, balances, topFruits, topVendor, fruits, orders] = await Promise.all([
      api.get('/stock'), api.get('/stock/low'), api.get('/vendors/balances'),
      api.get('/reports/top-fruits'), api.get('/reports/top-vendor'),
      api.get('/fruits?status=ACTIVE'), api.get('/orders?limit=6'),
    ]);
    return { stock, low, balances, topFruits, topVendor, fruits, orders };
  });
  const owing = data?.balances.filter((b) => b.outstanding_balance > 0) || [];
  const totalOwed = owing.reduce((s, b) => s + b.outstanding_balance, 0);

  return (
    <>
      <PageHead title="Today at the farm" hint="Stock by box size, who owes money, and what is selling." />
      <Alert>{error}</Alert>
      {data && (
        <>
          <section className="kpis">
            <div className="kpi"><b>{data.stock.reduce((s, r) => s + r.available_quantity, 0)}</b><span>boxes in stock</span></div>
            <div className={`kpi ${data.low.length ? 'warn' : ''}`}><b>{data.low.length}</b><span>fruit sizes running low</span></div>
            <div className={`kpi ${totalOwed ? 'warn' : ''}`}><b>{money(totalOwed)}</b><span>owed by {owing.length} vendor(s)</span></div>
            <div className="kpi"><b>{data.topVendor?.vendor_name || '-'}</b><span>biggest buyer ({data.topVendor?.total_boxes || 0} boxes)</span></div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Fruits and their suppliers</h2><button className="link" onClick={() => go('Fruits')}>Manage fruits</button></div>
            <div className="fruit-grid compact">
              {data.fruits.map((f) => (
                <figure key={f.fruit_id} className="fruit-tile">
                  <FruitPic name={f.fruit_name} src={f.image_url} size="card" />
                  <figcaption><b>{f.fruit_name}</b><small>{f.suppliers ? `Supplied by ${f.suppliers}` : 'No supplier registered'}</small></figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section>
            <div className="panel-head"><h2>Latest vendor orders</h2><button className="link" onClick={() => go('Sales')}>All sales</button></div>
            {!data.orders.length && <p className="muted">No orders yet.</p>}
            <div className="order-grid">{data.orders.map((o) => <OrderCard key={o.sale_id} order={o} showVendor />)}</div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Stock by packaging size</h2><button className="link" onClick={() => go('Stock')}>Manage stock</button></div>
            <StockGrid stock={data.stock} />
          </section>

          <div className="two">
            <section className="panel">
              <h2>Low stock</h2>
              <Table empty="Every size is above its low-stock level."
                columns={[{ label: 'Fruit', key: 'fruit_name' }, { label: 'Size', render: (r) => <Badge value={r.packaging_size} /> },
                  { label: 'Left', num: true, key: 'available_quantity' }]} rows={data.low} />
            </section>
            <section className="panel">
              <h2>Best-selling fruits</h2>
              <Table columns={[{ label: 'Fruit', key: 'fruit_name' }, { label: 'Boxes sold', num: true, key: 'boxes_sold' },
                { label: 'Sales', num: true, key: 'times_sold' }]} rows={data.topFruits} />
            </section>
          </div>

          <section className="panel">
            <div className="panel-head"><h2>Vendors who owe money</h2><button className="link" onClick={() => go('Sales')}>Record a payment</button></div>
            <Table empty="No outstanding payments."
              columns={[{ label: 'Vendor', key: 'vendor_name' }, { label: 'Phone', key: 'phone_number' },
                { label: 'Billed', num: true, render: (r) => money(r.total_billed) }, { label: 'Paid', num: true, render: (r) => money(r.total_paid) },
                { label: 'Outstanding', num: true, render: (r) => <b>{money(r.outstanding_balance)}</b> }]} rows={owing} />
          </section>
        </>
      )}
    </>
  );
}
