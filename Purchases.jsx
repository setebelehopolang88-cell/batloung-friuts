import { useState } from 'react';
import { api, SIZES, SIZE_LABEL, day, downloadCsv, fixed, money, today } from '../api.js';
import { Alert, Field, IconBtn, Kpis, PageHead, Table, useLoad } from '../components/ui.jsx';

const blank = () => ({ fruit_id: '', packaging_size: 'MEDIUM', quantity: '', unit_cost: '' });
const HEAD = ['Purchase #', 'Date', 'Supplier', 'Province', 'Fruit', 'Box size', 'Boxes', 'Cost per box (M)', 'Line total (M)', 'Purchase total (M)'];
// One CSV row per fruit line; the purchase total is written once per purchase so Excel sums stay right.
const lines = (p) => p.items.map((i, k) => [p.purchase_id, day(p.purchase_date), p.business_name, p.province, i.fruit_name, SIZE_LABEL[i.packaging_size], i.quantity, fixed(i.unit_cost), fixed(i.line_total), k === 0 ? fixed(p.total_amount) : '']);

export default function Purchases() {
  const { data, error, reload } = useLoad(async () => {
    const [suppliers, fruits, purchases] = await Promise.all([api.get('/suppliers'), api.get('/fruits?status=ACTIVE'), api.get('/purchases/export')]);
    return { suppliers, fruits, purchases };
  });
  const [supplier, setSupplier] = useState('');
  const [items, setItems] = useState([blank()]);
  const [editing, setEditing] = useState(null);   // purchase being edited
  const [open, setOpen] = useState(null);         // purchase whose items are shown
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const say = (type, text) => setMsg({ type, text });
  const total = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_cost) || 0), 0);
  const setItem = (idx, k, v) => setItems(items.map((it, i) => (i === idx ? { ...it, [k]: v } : it)));

  const purchases = data?.purchases || [];
  const grandTotal = purchases.reduce((t, p) => t + p.total_amount, 0);
  const boxes = purchases.reduce((t, p) => t + p.items.reduce((n, i) => n + i.quantity, 0), 0);

  const reset = () => { setSupplier(''); setItems([blank()]); setEditing(null); };
  const submit = async (e) => {
    e.preventDefault();
    const body = { supplier_id: Number(supplier), items: items.map((i) => ({ ...i, fruit_id: Number(i.fruit_id), quantity: Number(i.quantity), unit_cost: Number(i.unit_cost) })) };
    try {
      if (editing) {
        await api.put(`/purchases/${editing.purchase_id}`, body);
        say('success', `Purchase #${editing.purchase_id} updated. Stock was adjusted.`); setOpen(null);
      } else {
        const p = await api.post('/purchases', body);
        say('success', `Purchase #${p.purchase_id} recorded (${money(p.total_amount)}). Stock increased.`);
      }
      reset(); reload();
    } catch (err) { say('error', err.message); }
  };
  const edit = (p) => {
    setEditing(p); setSupplier(String(p.supplier_id));
    setItems(p.items.map((i) => ({ fruit_id: String(i.fruit_id), packaging_size: i.packaging_size, quantity: String(i.quantity), unit_cost: String(i.unit_cost) })));
    window.scrollTo(0, 0);
  };
  const remove = async (p) => {
    if (!window.confirm(`Delete purchase #${p.purchase_id} from ${p.business_name} (${money(p.total_amount)})? Its boxes are taken out of stock again.`)) return;
    try { await api.del(`/purchases/${p.purchase_id}`); say('success', `Purchase #${p.purchase_id} deleted and its boxes taken out of stock.`); if (editing?.purchase_id === p.purchase_id) reset(); setOpen(null); reload(); }
    catch (err) { say('error', err.message); }
  };
  const downloadOne = (p) => downloadCsv(`purchase-${p.purchase_id}-${today()}.csv`, [
    ['Batloung Farm purchase #' + p.purchase_id], ['Supplier', p.business_name], ['Date', day(p.purchase_date)], [], HEAD.slice(4, 9), ...lines(p).map((r) => r.slice(4, 9)), [], ['Total (M)', '', '', '', fixed(p.total_amount)],
  ]);
  const downloadAll = () => downloadCsv(`purchases-${today()}.csv`, [
    ['Batloung Farm purchases', today()], [], HEAD, ...purchases.flatMap(lines), [], ['TOTAL', '', '', '', '', '', boxes, '', '', fixed(grandTotal)],
  ]);

  return (
    <>
      <PageHead title="Purchases" hint="Record fruit bought from a supplier. The total is worked out for you and stock goes up." />
      <Alert>{error}</Alert>
      <Alert type={msg.type} onClose={() => say('error', '')}>{msg.text}</Alert>
      {data && <Kpis items={[{ value: purchases.length, label: 'purchases made' }, { value: boxes, label: 'boxes bought' }, { value: money(grandTotal), label: 'total paid for all purchases' }]} />}
      {data && (
        <form className="panel form" onSubmit={submit}>
          <h2>{editing ? `Edit purchase #${editing.purchase_id}` : 'New purchase'}</h2>
          {editing && <p className="muted small">Stock is adjusted by the difference. If some of these boxes were already sold, they cannot be taken away.</p>}
          <Field label="Supplier">
            <select value={supplier} onChange={(e) => setSupplier(e.target.value)} required>
              <option value="">Choose a supplier</option>
              {data.suppliers.map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.business_name} ({s.province})</option>)}
            </select>
          </Field>
          {items.map((it, i) => (
            <div className="item-row" key={i}>
              <Field label="Fruit"><select value={it.fruit_id} onChange={(e) => setItem(i, 'fruit_id', e.target.value)} required>
                <option value="">Choose</option>{data.fruits.map((f) => <option key={f.fruit_id} value={f.fruit_id}>{f.fruit_name}</option>)}</select></Field>
              <Field label="Box size"><select value={it.packaging_size} onChange={(e) => setItem(i, 'packaging_size', e.target.value)}>{SIZES.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Boxes"><input type="number" min="1" step="1" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} required /></Field>
              <Field label="Cost per box (M)"><input type="number" min="0.01" step="0.01" value={it.unit_cost} onChange={(e) => setItem(i, 'unit_cost', e.target.value)} required /></Field>
              <div className="line-total">{money((Number(it.quantity) || 0) * (Number(it.unit_cost) || 0))}</div>
              {items.length > 1 && <IconBtn icon="trash" tone="delete" label="Remove" onClick={() => setItems(items.filter((_, x) => x !== i))} />}
            </div>
          ))}
          <div className="actions">
            <IconBtn icon="plus" tone="view" label="Add another fruit" onClick={() => setItems([...items, blank()])} />
            <span className="total">Total {money(total)}</span>
            {editing && <button type="button" onClick={reset}>Cancel</button>}
            <button className="primary">{editing ? 'Save changes' : 'Record purchase'}</button>
          </div>
        </form>
      )}
      <section className="panel">
        <div className="panel-head"><h2>Purchase history</h2><IconBtn icon="download" tone="download" label="Download list" onClick={downloadAll} disabled={!purchases.length} /></div>
        <Table columns={[{ label: '#', key: 'purchase_id' }, { label: 'Date', render: (p) => day(p.purchase_date) }, { label: 'Supplier', key: 'business_name' }, { label: 'Province', key: 'province' },
          { label: 'Boxes', num: true, render: (p) => p.items.reduce((n, i) => n + i.quantity, 0) },
          { label: 'Total', num: true, render: (p) => money(p.total_amount) },
          { label: 'Actions', render: (p) => (<span className="row-actions">
            <IconBtn icon="view" tone="view" iconOnly label={open?.purchase_id === p.purchase_id ? `Hide purchase ${p.purchase_id}` : `View purchase ${p.purchase_id}`} onClick={() => setOpen(open?.purchase_id === p.purchase_id ? null : p)} />
            <IconBtn icon="edit" tone="edit" iconOnly label={`Edit purchase ${p.purchase_id}`} onClick={() => edit(p)} />
            <IconBtn icon="trash" tone="delete" iconOnly label={`Delete purchase ${p.purchase_id}`} onClick={() => remove(p)} />
            <IconBtn icon="download" tone="download" iconOnly label={`Download purchase ${p.purchase_id}`} onClick={() => downloadOne(p)} /></span>) }]}
          rows={data && purchases.map((p) => ({ ...p, id: p.purchase_id }))} />
        {data && purchases.length > 0 && <p className="grand">Total paid for all purchases: <b>{money(grandTotal)}</b></p>}
        {open && <div className="detail"><h3>Purchase #{open.purchase_id} - {open.business_name}</h3>
          <Table columns={[{ label: 'Fruit', key: 'fruit_name' }, { label: 'Size', key: 'packaging_size' }, { label: 'Boxes', num: true, key: 'quantity' },
            { label: 'Cost / box', num: true, render: (i) => money(i.unit_cost) }, { label: 'Line total', num: true, render: (i) => money(i.line_total) }]} rows={open.items} /></div>}
      </section>
    </>
  );
}
