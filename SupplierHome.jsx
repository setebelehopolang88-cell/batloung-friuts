import { api, day, money, SIZE_LABEL } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, IconBtn, PageHead, useLoad } from '../components/ui.jsx';
import FruitPic, { PicStrip } from '../components/FruitPic.jsx';
import { useState } from 'react';

export default function SupplierHome({ go }) {
  const { profile } = useAuth();
  const { data, error, reload } = useLoad(() => api.get('/supplier/overview'));
  const [msg, setMsg] = useState('');
  const [shown, setShown] = useState(null);   // fruit_id whose details are open
  const sold = data?.purchases.reduce((s, p) => s + p.total_amount, 0) || 0;

  const remove = async (f) => {
    if (!window.confirm(`Remove ${f.fruit_name} from your list?`)) return;
    try { await api.del(`/supplier/fruits/${f.fruit_id}`); reload(); } catch (e) { setMsg(e.message); }
  };

  return (
    <>
      <PageHead title={`Welcome, ${profile?.business_name || 'supplier'}`} hint="The fruit you have registered, and what Batloung Farm has bought from you." />
      <Alert>{error}</Alert><Alert onClose={() => setMsg('')}>{msg}</Alert>
      {data && (
        <>
          <section className="kpis three">
            <div className="kpi"><b>{data.fruits.length}</b><span>fruits registered</span></div>
            <div className="kpi"><b>{data.purchases.length}</b><span>farm purchases from you</span></div>
            <div className="kpi"><b>{money(sold)}</b><span>total bought from you</span></div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>My fruits</h2><button className="primary" onClick={() => go('Register fruit')}>Register a fruit</button></div>
            {!data.fruits.length && <p className="muted">You have not registered any fruit yet.</p>}
            <div className="fruit-grid compact">
              {data.fruits.map((f) => (
                <figure key={f.fruit_id} className="fruit-tile">
                  <FruitPic name={f.fruit_name} src={f.image_url} size="card" />
                  <figcaption><b>{f.fruit_name}</b><small>{f.boxes_in_stock} boxes at the farm</small>
                    {shown === f.fruit_id && <small>{f.description || 'No description'} &middot; registered {day(f.registered_at)}</small>}
                    <span className="row-actions">
                      <IconBtn icon="view" tone="view" iconOnly label={`View ${f.fruit_name}`} onClick={() => setShown(shown === f.fruit_id ? null : f.fruit_id)} />
                      <IconBtn icon="send" tone="edit" iconOnly label={`Send boxes of ${f.fruit_name}`} onClick={() => go('Send stock')} />
                      <IconBtn icon="trash" tone="delete" iconOnly label={`Remove ${f.fruit_name}`} onClick={() => remove(f)} />
                    </span></figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Bought from you</h2>
            {!data.purchases.length && <p className="muted">No purchases yet.</p>}
            <ul className="history">
              {data.purchases.map((p) => (
                <li key={p.purchase_id}>
                  <PicStrip items={p.items} />
                  <span><b>Purchase #{p.purchase_id}</b><small>{day(p.purchase_date)} &middot; {p.items.map((i) => `${i.quantity} ${SIZE_LABEL[i.packaging_size].toLowerCase()} ${i.fruit_name}`).join(', ')}</small></span>
                  <b className="num">{money(p.total_amount)}</b>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
