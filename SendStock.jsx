import { useState } from 'react';
import { api, SIZES, SIZE_LABEL, day, money } from '../api.js';
import { Alert, Badge, Field, IconBtn, Kpis, PageHead, Table, useLoad } from '../components/ui.jsx';
import FruitPic from '../components/FruitPic.jsx';

const EMPTY = { fruit_id: '', packaging_size: 'MEDIUM', boxes: '', price_per_box: '', note: '' };

// Supplier: say how many boxes you are selling to the business, then view, edit or delete what you sent while the farm desk has not decided.
export default function SendStock({ go }) {
  const { data, error, reload } = useLoad(async () => {
    const [overview, offers] = await Promise.all([api.get('/supplier/overview'), api.get('/supplier/offers')]);
    return { fruits: overview.fruits, offers };
  });
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const say = (type, text) => setMsg({ type, text });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const offers = data?.offers || [];
  const pending = offers.filter((o) => o.status === 'PENDING');
  const accepted = offers.filter((o) => o.status === 'ACCEPTED');
  const reset = () => { setForm(EMPTY); setEditing(null); };
  const viewed = offers.find((o) => o.offer_id === viewing);

  const submit = async (e) => {
    e.preventDefault();
    const body = { ...form, fruit_id: Number(form.fruit_id), boxes: Number(form.boxes), price_per_box: Number(form.price_per_box) };
    try {
      if (editing) { await api.put(`/supplier/offers/${editing}`, body); say('success', 'Your stock offer was updated and the farm desk was told.'); }
      else { await api.post('/supplier/offers', body); say('success', 'Sent! The farm desk was notified and will accept or reject it.'); }
      reset(); reload();
    } catch (err) { say('error', err.message); }
  };
  const edit = (o) => {
    setEditing(o.offer_id); setViewing(null);
    setForm({ fruit_id: String(o.fruit_id), packaging_size: o.packaging_size, boxes: String(o.boxes), price_per_box: String(o.price_per_box), note: o.note || '' });
    window.scrollTo(0, 0);
  };
  const remove = async (o) => {
    if (!window.confirm(`Delete your offer #${o.offer_id} (${o.boxes} boxes of ${o.fruit_name})?`)) return;
    try { await api.del(`/supplier/offers/${o.offer_id}`); say('success', 'Offer deleted.'); if (editing === o.offer_id) reset(); if (viewing === o.offer_id) setViewing(null); reload(); }
    catch (err) { say('error', err.message); }
  };

  return (
    <>
      <PageHead title="Send stock" hint="Tell Batloung Farm how many boxes you are selling. You can view, edit or delete an offer until the farm desk decides on it." />
      <Alert>{error}</Alert>
      <Alert type={msg.type} onClose={() => say('error', '')}>{msg.text}</Alert>
      {data && <Kpis items={[{ value: offers.length, label: 'offers sent' }, { value: pending.length, label: 'waiting for the farm desk', warn: pending.length > 0 }, { value: accepted.reduce((n, o) => n + o.boxes, 0), label: 'boxes accepted' }]} />}
      {data && !data.fruits.length && <section className="panel"><p className="muted">Register a fruit first, then you can send boxes of it.</p><button className="primary" onClick={() => go('Register fruit')}>Register a fruit</button></section>}
      {data && data.fruits.length > 0 && (
        <form className="panel form" onSubmit={submit}>
          <h2>{editing ? `Edit offer #${editing}` : 'New stock offer'}</h2>
          <div className="grid-form">
            <Field label="Fruit"><select value={form.fruit_id} onChange={set('fruit_id')} required>
              <option value="">Choose one of your fruits</option>{data.fruits.map((f) => <option key={f.fruit_id} value={f.fruit_id}>{f.fruit_name}</option>)}</select></Field>
            <Field label="Box size"><select value={form.packaging_size} onChange={set('packaging_size')}>{SIZES.map((s) => <option key={s} value={s}>{SIZE_LABEL[s]}</option>)}</select></Field>
            <Field label="Number of boxes"><input type="number" min="1" step="1" value={form.boxes} onChange={set('boxes')} required /></Field>
            <Field label="Your price per box (M)"><input type="number" min="0.01" step="0.01" value={form.price_per_box} onChange={set('price_per_box')} required /></Field>
            <Field label="Note (optional)"><input value={form.note} maxLength={255} onChange={set('note')} placeholder="e.g. ready on Friday" /></Field>
          </div>
          <div className="actions">
            <span className="total">Total {money((Number(form.boxes) || 0) * (Number(form.price_per_box) || 0))}</span>
            {editing && <button type="button" onClick={reset}>Cancel</button>}
            <button className="primary">{editing ? 'Save changes' : 'Send to the farm'}</button>
          </div>
        </form>
      )}

      {viewed && (
        <section className="panel detail-card">
          <div className="panel-head"><h2>Offer #{viewed.offer_id} <Badge value={viewed.status} /></h2><IconBtn icon="close" label="Close" onClick={() => setViewing(null)} /></div>
          <div className="with-pic"><FruitPic name={viewed.fruit_name} src={viewed.image_url} size="card" /></div>
          <dl className="facts">
            <div><dt>Fruit</dt><dd>{viewed.fruit_name}</dd></div>
            <div><dt>Box size</dt><dd>{SIZE_LABEL[viewed.packaging_size]}</dd></div>
            <div><dt>Boxes</dt><dd>{viewed.boxes}</dd></div>
            <div><dt>Price per box</dt><dd>{money(viewed.price_per_box)}</dd></div>
            <div><dt>Total</dt><dd>{money(viewed.total)}</dd></div>
            <div><dt>Sent</dt><dd>{day(viewed.created_at)}</dd></div>
            {viewed.note && <div><dt>Your note</dt><dd>{viewed.note}</dd></div>}
            {viewed.admin_note && <div><dt>Farm desk note</dt><dd>{viewed.admin_note}</dd></div>}
            {viewed.purchase_id && <div><dt>Purchase</dt><dd>#{viewed.purchase_id}</dd></div>}
          </dl>
          {viewed.status === 'PENDING' && <div className="actions"><IconBtn icon="edit" tone="edit" label="Edit" onClick={() => edit(viewed)} /><IconBtn icon="trash" tone="delete" label="Delete" onClick={() => remove(viewed)} /></div>}
        </section>
      )}

      <section className="panel">
        <h2>Stock I have sent</h2>
        <Table empty="You have not sent any stock yet." columns={[{ label: '#', key: 'offer_id' }, { label: 'Date', render: (o) => day(o.created_at) },
          { label: 'Fruit', render: (o) => <span className="with-pic"><FruitPic name={o.fruit_name} src={o.image_url} size="xs" />{o.fruit_name}</span> },
          { label: 'Size', render: (o) => SIZE_LABEL[o.packaging_size] }, { label: 'Boxes', num: true, key: 'boxes' },
          { label: 'Price / box', num: true, render: (o) => money(o.price_per_box) }, { label: 'Total', num: true, render: (o) => money(o.total) },
          { label: 'Status', render: (o) => <Badge value={o.status} /> },
          { label: 'Actions', render: (o) => (<span className="row-actions">
            <IconBtn icon="view" tone="view" iconOnly label={`View offer ${o.offer_id}`} onClick={() => { setViewing(o.offer_id); window.scrollTo(0, 0); }} />
            {o.status === 'PENDING' && <IconBtn icon="edit" tone="edit" iconOnly label={`Edit offer ${o.offer_id}`} onClick={() => edit(o)} />}
            {o.status !== 'ACCEPTED' && <IconBtn icon="trash" tone="delete" iconOnly label={`Delete offer ${o.offer_id}`} onClick={() => remove(o)} />}</span>) }]}
          rows={data && offers.map((o) => ({ ...o, id: o.offer_id }))} />
      </section>
    </>
  );
}
