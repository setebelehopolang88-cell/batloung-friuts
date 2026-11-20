import { useState } from 'react';
import { api, SIZE_LABEL, day, money } from '../api.js';
import { Alert, Badge, Field, IconBtn, Kpis, PageHead, Table, useLoad } from '../components/ui.jsx';
import FruitPic from '../components/FruitPic.jsx';

// Admin: stock the suppliers offer to send. Accepting records a purchase (stock goes up) and tells the supplier; rejecting tells them too.
export default function Offers() {
  const { data, error, reload } = useLoad(() => api.get('/offers'));
  const [open, setOpen] = useState(null);       // offer shown
  const [decide, setDecide] = useState(null);   // { offer, action: 'accept' | 'reject', cost, note }
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const say = (type, text) => setMsg({ type, text });
  const offers = data || [];
  const pending = offers.filter((o) => o.status === 'PENDING');
  const told = (r) => (r.notified ? ' The supplier was notified.' : ' (This supplier has no log in, so no notification was sent.)');

  const send = async (e) => {
    e.preventDefault();
    const { offer, action, cost, note } = decide;
    try {
      const r = await api.post(`/offers/${offer.offer_id}/${action}`, action === 'accept' ? { unit_cost: cost, note } : { note });
      say('success', action === 'accept' ? `Offer #${offer.offer_id} accepted: purchase #${r.purchase_id} recorded and stock increased.${told(r)}` : `Offer #${offer.offer_id} rejected.${told(r)}`);
      setDecide(null); setOpen(null); reload();
    } catch (err) { say('error', err.message); }
  };
  const remove = async (o) => {
    if (!window.confirm(`Delete rejected offer #${o.offer_id}?`)) return;
    try { await api.del(`/offers/${o.offer_id}`); say('success', 'Offer deleted.'); setOpen(null); reload(); } catch (err) { say('error', err.message); }
  };
  const start = (o, action) => { setDecide({ offer: o, action, cost: String(o.price_per_box), note: '' }); window.scrollTo(0, 0); };

  return (
    <>
      <PageHead title="Supplier offers" hint="Boxes that suppliers offer to send. Accept an offer to record the purchase and add the boxes to stock." />
      <Alert>{error}</Alert>
      <Alert type={msg.type} onClose={() => say('error', '')}>{msg.text}</Alert>
      {data && <Kpis items={[{ value: pending.length, label: 'waiting for a decision', warn: pending.length > 0 }, { value: offers.filter((o) => o.status === 'ACCEPTED').length, label: 'accepted' }, { value: offers.filter((o) => o.status === 'REJECTED').length, label: 'rejected' }]} />}

      {decide && (
        <form className="panel form" onSubmit={send}>
          <h2>{decide.action === 'accept' ? 'Accept' : 'Reject'} offer #{decide.offer.offer_id} - {decide.offer.business_name}</h2>
          <p className="muted">{decide.offer.boxes} {SIZE_LABEL[decide.offer.packaging_size].toLowerCase()} box(es) of {decide.offer.fruit_name}.</p>
          <div className="grid-form">
            {decide.action === 'accept' && <Field label="Cost per box (M) - from the supplier's price"><input type="number" min="0.01" step="0.01" value={decide.cost} onChange={(e) => setDecide({ ...decide, cost: e.target.value })} required /></Field>}
            <Field label={decide.action === 'accept' ? 'Note to the supplier (optional)' : 'Reason (optional)'}><input value={decide.note} maxLength={150} onChange={(e) => setDecide({ ...decide, note: e.target.value })} /></Field>
          </div>
          <div className="actions"><button type="button" onClick={() => setDecide(null)}>Cancel</button><button className={decide.action === 'accept' ? 'primary' : 'danger'}>{decide.action === 'accept' ? 'Accept offer' : 'Reject offer'}</button></div>
        </form>
      )}

      {open && (
        <section className="panel detail-card">
          <div className="panel-head"><h2>Offer #{open.offer_id} <Badge value={open.status} /></h2><IconBtn icon="close" label="Close" onClick={() => setOpen(null)} /></div>
          <div className="with-pic"><FruitPic name={open.fruit_name} src={open.image_url} size="card" /></div>
          <dl className="facts">
            <div><dt>Supplier</dt><dd>{open.business_name}</dd></div><div><dt>Fruit</dt><dd>{open.fruit_name}</dd></div>
            <div><dt>Box size</dt><dd>{SIZE_LABEL[open.packaging_size]}</dd></div><div><dt>Boxes</dt><dd>{open.boxes}</dd></div>
            <div><dt>Price per box</dt><dd>{money(open.price_per_box)}</dd></div><div><dt>Total</dt><dd>{money(open.total)}</dd></div>
            <div><dt>Sent</dt><dd>{day(open.created_at)}</dd></div>
            {open.note && <div><dt>Supplier note</dt><dd>{open.note}</dd></div>}
            {open.admin_note && <div><dt>Your note</dt><dd>{open.admin_note}</dd></div>}
            {open.purchase_id && <div><dt>Purchase</dt><dd>#{open.purchase_id}</dd></div>}
          </dl>
        </section>
      )}

      <section className="panel">
        <h2>All offers</h2>
        <Table empty="No suppliers have sent an offer yet." columns={[{ label: '#', key: 'offer_id' }, { label: 'Date', render: (o) => day(o.created_at) }, { label: 'Supplier', key: 'business_name' },
          { label: 'Fruit', render: (o) => <span className="with-pic"><FruitPic name={o.fruit_name} src={o.image_url} size="xs" />{o.fruit_name}</span> },
          { label: 'Size', render: (o) => SIZE_LABEL[o.packaging_size] }, { label: 'Boxes', num: true, key: 'boxes' },
          { label: 'Price / box', num: true, render: (o) => money(o.price_per_box) }, { label: 'Total', num: true, render: (o) => money(o.total) },
          { label: 'Status', render: (o) => <Badge value={o.status} /> },
          { label: 'Actions', render: (o) => (<span className="row-actions">
            <IconBtn icon="view" tone="view" iconOnly label={`View offer ${o.offer_id}`} onClick={() => { setOpen(o); window.scrollTo(0, 0); }} />
            {o.status === 'PENDING' && <IconBtn icon="check" tone="restore" iconOnly label={`Accept offer ${o.offer_id}`} onClick={() => start(o, 'accept')} />}
            {o.status === 'PENDING' && <IconBtn icon="close" tone="delete" iconOnly label={`Reject offer ${o.offer_id}`} onClick={() => start(o, 'reject')} />}
            {o.status === 'REJECTED' && <IconBtn icon="trash" tone="delete" iconOnly label={`Delete offer ${o.offer_id}`} onClick={() => remove(o)} />}</span>) }]}
          rows={data && offers.map((o) => ({ ...o, id: o.offer_id }))} />
      </section>
    </>
  );
}
