import { api } from '../api.js';
import { Alert, PageHead, useLoad } from '../components/ui.jsx';
import OrderCard from '../components/OrderCard.jsx';

export default function MyOrders({ go }) {
  const { data, error, reload } = useLoad(() => api.get('/orders'));
  return (
    <>
      <PageHead title="My orders" hint="Every box you have ordered, with its fruit, price and payment status." />
      <Alert>{error}</Alert>
      {data && !data.length && <section className="panel"><p className="muted">No orders yet.</p><button className="primary" onClick={() => go('Order boxes')}>Order your first box</button></section>}
      <div className="order-grid">{data?.map((o) => <OrderCard key={o.sale_id} order={o} canSend onChange={reload} />)}</div>
    </>
  );
}
