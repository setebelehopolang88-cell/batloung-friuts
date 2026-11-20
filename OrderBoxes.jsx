import { useMemo, useState } from 'react';
import { api, money, SIZE_LABEL, SIZES } from '../api.js';
import { Alert, PageHead, useLoad } from '../components/ui.jsx';
import FruitPic from '../components/FruitPic.jsx';
import OrderCard from '../components/OrderCard.jsx';

const BOX_NOTE = { SMALL: 'A few kilos - a quiet day', MEDIUM: 'The everyday stall box', LARGE: 'Stock up for the weekend' };

// Vendor: 1) pick a box size  2) pick fruits  - the fruits you pick appear inside your box on the right.
export default function OrderBoxes({ go }) {
  const { data, error, reload } = useLoad(() => api.get('/stock'));
  const [size, setSize] = useState('MEDIUM');
  const [lines, setLines] = useState([]);          // { fruit_id, packaging_size, quantity }
  const [msg, setMsg] = useState('');
  const [placed, setPlaced] = useState(null);
  const [busy, setBusy] = useState(false);

  // one entry per active fruit, with its stock row for each box size
  const fruits = useMemo(() => {
    const map = new Map();
    (data || []).filter((r) => r.fruit_status === 'ACTIVE').forEach((r) => {
      if (!map.has(r.fruit_id)) map.set(r.fruit_id, { fruit_id: r.fruit_id, fruit_name: r.fruit_name, image_url: r.image_url, sizes: {} });
      map.get(r.fruit_id).sizes[r.packaging_size] = r;
    });
    return [...map.values()];
  }, [data]);

  const rowOf = (fruit_id, packaging_size) => fruits.find((f) => f.fruit_id === fruit_id)?.sizes[packaging_size];
  const maxOf = (l) => rowOf(l.fruit_id, l.packaging_size)?.available_quantity || 0;
  const total = lines.reduce((s, l) => s + (rowOf(l.fruit_id, l.packaging_size)?.selling_price || 0) * l.quantity, 0);
  const boxes = lines.reduce((s, l) => s + l.quantity, 0);
  const inBox = (f) => lines.find((l) => l.fruit_id === f.fruit_id && l.packaging_size === size)?.quantity || 0;

  const add = (f) => {
    const row = f.sizes[size];
    if (!row || row.selling_price <= 0 || row.available_quantity <= 0) return;
    setPlaced(null); setMsg('');
    setLines((ls) => {
      const have = ls.find((l) => l.fruit_id === f.fruit_id && l.packaging_size === size);
      if (!have) return [...ls, { fruit_id: f.fruit_id, packaging_size: size, quantity: 1 }];
      return ls.map((l) => (l === have ? { ...l, quantity: Math.min(l.quantity + 1, row.available_quantity) } : l));
    });
  };
  const change = (l, q) => setLines((ls) => ls.flatMap((x) => (x !== l ? [x] : q < 1 ? [] : [{ ...x, quantity: Math.min(q, maxOf(l)) }])));

  const place = async () => {
    setBusy(true); setMsg('');
    try {
      setPlaced(await api.post('/orders', { items: lines }));
      setLines([]); reload();
    } catch (err) { setMsg(err.message); reload(); }
    setBusy(false);
  };

  return (
    <>
      <PageHead title="Order boxes" hint="Choose a box size, then tap the fruits you want. They appear in your box on the right." />
      <Alert>{error}</Alert>
      <Alert onClose={() => setMsg('')}>{msg}</Alert>

      {placed && (
        <section className="panel placed">
          <div className="panel-head"><h2>Order #{placed.sale_id} placed</h2><button className="link" onClick={() => setPlaced(null)}>Dismiss</button></div>
          <p className="muted">The farm desk will prepare your boxes. Payment is recorded when you collect them.</p>
          <OrderCard order={placed} />
          <div className="actions"><button className="primary" onClick={() => go('My orders')}>See my orders</button></div>
        </section>
      )}

      {data && (
        <div className="order-layout">
          <div>
            <section className="panel">
              <h2>1. Choose a box size</h2>
              <div className="size-pick" role="radiogroup" aria-label="Box size">
                {SIZES.map((s) => (
                  <label key={s} className={`size-card ${s.toLowerCase()} ${size === s ? 'on' : ''}`}>
                    <input type="radio" name="size" checked={size === s} onChange={() => setSize(s)} />
                    <span className="crate" aria-hidden="true" />
                    <b>{SIZE_LABEL[s]} box</b><small>{BOX_NOTE[s]}</small>
                  </label>
                ))}
              </div>
            </section>

            <section className="panel">
              <h2>2. Choose fruits for your {SIZE_LABEL[size].toLowerCase()} box</h2>
              <div className="fruit-grid">
                {fruits.map((f) => {
                  const row = f.sizes[size]; const ok = row && row.selling_price > 0 && row.available_quantity > 0; const n = inBox(f);
                  return (
                    <button type="button" key={f.fruit_id} className={`fruit-card ${n ? 'picked' : ''}`} disabled={!ok} onClick={() => add(f)}
                      aria-label={`${f.fruit_name}, ${SIZE_LABEL[size]} box${ok ? '' : ', not available'}`}>
                      <FruitPic name={f.fruit_name} src={f.image_url} size="card" />
                      {n > 0 && <span className="count">{n} in box</span>}
                      <b>{f.fruit_name}</b>
                      <small>{!row || row.selling_price <= 0 ? 'Price not set yet' : row.available_quantity <= 0 ? 'Sold out' : `${money(row.selling_price)} / box · ${row.available_quantity} left`}</small>
                      {ok && <span className="add">{n ? '+ Add another' : '+ Add to box'}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="panel box-panel" aria-label="Your boxes">
            <h2>Your boxes</h2>
            {!lines.length ? (
              <div className="empty-box"><span className="crate big" aria-hidden="true" /><p className="muted">Your box is empty. Pick a fruit and it will appear here.</p></div>
            ) : (
              <ul className="box-lines">
                {lines.map((l) => {
                  const f = fruits.find((x) => x.fruit_id === l.fruit_id); const row = rowOf(l.fruit_id, l.packaging_size);
                  return (
                    <li key={`${l.fruit_id}-${l.packaging_size}`}>
                      <FruitPic name={f.fruit_name} src={f.image_url} size="sm" />
                      <span className="what"><b>{f.fruit_name}</b><small>{SIZE_LABEL[l.packaging_size]} box &middot; {money(row.selling_price)}</small></span>
                      <span className="stepper">
                        <button type="button" aria-label={`Fewer ${f.fruit_name}`} onClick={() => change(l, l.quantity - 1)}>&minus;</button>
                        <output>{l.quantity}</output>
                        <button type="button" aria-label={`More ${f.fruit_name}`} disabled={l.quantity >= row.available_quantity} onClick={() => change(l, l.quantity + 1)}>+</button>
                      </span>
                      <b className="num">{money(row.selling_price * l.quantity)}</b>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="box-total"><span>{boxes} box{boxes === 1 ? '' : 'es'}</span><b>{money(total)}</b></div>
            <button className="primary wide" disabled={!lines.length || busy} onClick={place}>{busy ? 'Placing order...' : 'Place order'}</button>
            {!!lines.length && <button className="link" onClick={() => setLines([])}>Empty the box</button>}
          </aside>
        </div>
      )}
    </>
  );
}
