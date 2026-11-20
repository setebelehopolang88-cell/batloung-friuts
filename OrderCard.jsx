import { day, downloadOrder, money, ORDER_LABEL, SIZE_LABEL } from '../api.js';
import { Badge, IconBtn } from './ui.jsx';
import FruitPic from './FruitPic.jsx';
import ProofBox from './ProofBox.jsx';

// One order: what was ordered (with fruit pictures and box sizes), the total, the payment status and the PDF payment slips.
// Vendors (canSend) can send a slip; onChange reloads the list afterwards.
export default function OrderCard({ order, showVendor, canSend, onChange }) {
  const boxes = order.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <article className="order-card">
      <header>
        <div>
          <h3>Order #{order.sale_id}{showVendor && <> &middot; {order.vendor_name}</>}</h3>
          <span className="muted">{day(order.sale_date)} &middot; {boxes} box{boxes === 1 ? '' : 'es'}</span>
          {order.order_status && order.order_status !== 'PLACED' && <div><span className={`badge order-${order.order_status.toLowerCase()}`}>{ORDER_LABEL[order.order_status]}</span></div>}
        </div>
        <Badge value={order.payment_status} />
      </header>
      <ul className="order-lines">
        {order.items.map((i, k) => (
          <li key={k}>
            <FruitPic name={i.fruit_name} src={i.image_url} size="sm" />
            <span><b>{i.fruit_name}</b><small>{SIZE_LABEL[i.packaging_size]} box &times; {i.quantity}</small></span>
            <span className="num">{money(i.line_total)}</span>
          </li>
        ))}
      </ul>
      <ProofBox order={order} canSend={canSend} onChange={onChange} />
      <footer>
        <span><b>{money(order.total_amount)}</b>{order.outstanding_balance > 0 && <small className="owing"> &middot; {money(order.outstanding_balance)} to pay</small>}</span>
        <IconBtn icon="download" tone="download" label="Download order" onClick={() => downloadOrder(order)} />
      </footer>
    </article>
  );
}
