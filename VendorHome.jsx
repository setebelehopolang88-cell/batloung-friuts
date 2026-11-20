import { api, money } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, PageHead, useLoad } from '../components/ui.jsx';
import FruitPic from '../components/FruitPic.jsx';
import OrderCard from '../components/OrderCard.jsx';

export default function VendorHome({ go }) {
  const { profile } = useAuth();
  const { data, error, reload } = useLoad(async () => ({ orders: await api.get('/orders'), fruits: await api.get('/fruits?status=ACTIVE'), me: await api.get('/auth/me') }));
  const owed = data?.me.profile.outstanding_balance ?? profile?.outstanding_balance ?? 0;
  const boxes = data?.orders.reduce((s, o) => s + o.items.reduce((n, i) => n + i.quantity, 0), 0) || 0;

  return (
    <>
      <PageHead title={`Welcome, ${profile?.vendor_name || 'vendor'}`} hint="Order fresh boxes from Batloung Farm and follow your orders here." />
      <Alert>{error}</Alert>
      {data && (
        <>
          <section className="kpis three">
            <div className="kpi"><b>{data.orders.length}</b><span>orders placed</span></div>
            <div className="kpi"><b>{boxes}</b><span>boxes ordered</span></div>
            <div className={`kpi ${owed > 0 ? 'warn' : ''}`}><b>{money(owed)}</b><span>still to pay</span></div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Fruit on offer</h2><button className="primary" onClick={() => go('Order boxes')}>Order boxes</button></div>
            <div className="fruit-grid compact">
              {data.fruits.map((f) => (
                <figure key={f.fruit_id} className="fruit-tile"><FruitPic name={f.fruit_name} src={f.image_url} size="card" /><figcaption><b>{f.fruit_name}</b><small>{f.description}</small></figcaption></figure>
              ))}
            </div>
          </section>
          <section>
            <div className="panel-head"><h2>Latest orders</h2><button className="link" onClick={() => go('My orders')}>See all</button></div>
            {!data.orders.length && <p className="muted">You have not ordered yet.</p>}
            <div className="order-grid">{data.orders.slice(0, 3).map((o) => <OrderCard key={o.sale_id} order={o} canSend onChange={reload} />)}</div>
          </section>
        </>
      )}
    </>
  );
}
