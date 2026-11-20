import { useState } from 'react';
import { api, SIZES, SIZE_LABEL, ORDER_LABEL, day, downloadCsv, downloadOrder, fixed, money, today } from '../api.js';
import { Alert, Badge, Field, IconBtn, Kpis, PageHead, Table, useLoad } from '../components/ui.jsx';
import ProofBox from '../components/ProofBox.jsx';

const NOTICES = { READY: 'Come to take the order', DELAYED: 'Order is delayed', REJECTED: 'Reject the order' };

const blank = () => ({ fruit_id: '', packaging_size: 'MEDIUM', quantity: '' });
const HEAD = ['Sale #', 'Date', 'Vendor', 'Fruit', 'Box size', 'Boxes', 'Price per box (M)', 'Line total (M)', 'Sale total (M)', 'Paid (M)', 'Balance (M)', 'Status'];
// One CSV row per fruit line (every fruit added with "Add another fruit"); sale totals are written once per sale so Excel sums stay right.
const lines = (s) => s.items.map((i, k) => [s.sale_id, day(s.sale_date), s.vendor_name, i.fruit_name, SIZE_LABEL[i.packaging_size], i.quantity, fixed(i.unit_price), fixed(i.line_total),
  k === 0 ? fixed(s.total_amount) : '', k === 0 ? fixed(s.amount_paid) : '', k === 0 ? fixed(s.outstanding_balance) : '', k === 0 ? s.payment_status.replace('_', ' ') : '']);

export default function Sales() {
  const { data, error, reload } = useLoad(async () => {
    const [vendors, fruits, stock, sales] = await Promise.all([api.get('/vendors'), api.get('/fruits?status=ACTIVE'), api.get('/stock'), api.get('/sales/export')]);
    return { vendors, fruits, stock, sales };
  });
  const [vendor, setVendor] = useState('');
  const [items, setItems] = useState([blank()]);
  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState('');
  const [editing, setEditing] = useState(null);   // sale being edited
  const [open, setOpen] = useState(null);
  const [pay, setPay] = useState({ method: 'CASH', amount: '' });
  const [notice, setNotice] = useState(null);   // { sale, type, note } - message to the vendor about an order
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const say = (type, text) => setMsg({ type, text });
  const setItem = (idx, k, v) => setItems(items.map((it, i) => (i === idx ? { ...it, [k]: v } : it)));

  const rowStock = (it) => data?.stock.find((s) => s.fruit_id === Number(it.fruit_id) && s.packaging_size === it.packaging_size);
  // While editing, lines that were already on the sale keep the price they were sold at.
  const priceFor = (it) => editing?.items.find((o) => o.fruit_id === Number(it.fruit_id) && o.packaging_size === it.packaging_size)?.unit_price ?? rowStock(it)?.selling_price ?? 0;
  const lineTotal = (it) => priceFor(it) * (Number(it.quantity) || 0);
  const total = items.reduce((s, it) => s + lineTotal(it), 0);

  const sales = data?.sales || [];
  const sum = (k) => sales.reduce((t, s) => t + s[k], 0);
  const totalSales = sum('total_amount'), totalPaid = sum('amount_paid'), totalOwing = sum('outstanding_balance');

  const reset = () => { setVendor(''); setItems([blank()]); setAmount(''); setMethod('CASH'); setEditing(null); };
  const submit = async (e) => {
    e.preventDefault();
    const body = { vendor_id: Number(vendor), items: items.map((i) => ({ ...i, fruit_id: Number(i.fruit_id), quantity: Number(i.quantity) })) };
    try {
      if (editing) {
        const s = await api.put(`/sales/${editing.sale_id}`, body);
        say('success', `Sale #${s.sale_id} updated: ${money(s.total_amount)}. Stock was adjusted.${s.notified ? ' The vendor was notified.' : ''}`); setOpen(null);
      } else {
        const payment = method === 'CREDIT' ? { method } : { method, ...(amount !== '' ? { amount: Number(amount) } : {}) };
        const s = await api.post('/sales', { ...body, payment });
        say('success', `Sale #${s.sale_id} recorded: ${money(s.total_amount)} - ${s.payment_status.replace('_', ' ').toLowerCase()}.`);
      }
      reset(); reload();
    } catch (err) { say('error', err.message); } // e.g. "Insufficient stock ... Sale rejected." - nothing was saved
  };
  const edit = (s) => {
    setEditing(s); setVendor(String(s.vendor_id));
    setItems(s.items.map((i) => ({ fruit_id: String(i.fruit_id), packaging_size: i.packaging_size, quantity: String(i.quantity) })));
    window.scrollTo(0, 0);
  };
  const remove = async (s) => {
    if (!window.confirm(`Delete sale #${s.sale_id} for ${s.vendor_name} (${money(s.total_amount)})? Its boxes go back into stock and its payments are removed. This cannot be undone.`)) return;
    try { await api.del(`/sales/${s.sale_id}`); say('success', `Sale #${s.sale_id} deleted and its boxes returned to stock.`); if (editing?.sale_id === s.sale_id) reset(); setOpen(null); reload(); }
    catch (err) { say('error', err.message); }
  };

  const toggle = async (id) => {
    if (open?.sale_id === id) return setOpen(null);
    try { setOpen(await api.get(`/sales/${id}`)); setPay({ method: 'CASH', amount: '' }); } catch (err) { say('error', err.message); }
  };
  const addPayment = async (e) => {
    e.preventDefault();
    try {
      setOpen(await api.post(`/sales/${open.sale_id}/payments`, { method: pay.method, amount: Number(pay.amount) }));
      say('success', 'Payment recorded.'); setPay({ method: 'CASH', amount: '' }); reload();
    } catch (err) { say('error', err.message); }
  };
  const sendNotice = async (e) => {
    e.preventDefault();
    const { sale, type, note } = notice;
    if (type === 'REJECTED' && !window.confirm(`Reject order #${sale.sale_id}? It is cancelled, its boxes go back into stock and its payments are removed.`)) return;
    try {
      const r = await api.post(`/sales/${sale.sale_id}/notice`, { type, note });
      say('success', `${NOTICES[type]}: sent for order #${sale.sale_id}.${r.notified ? ' The vendor was notified.' : ' (This vendor has no log in, so no notification was sent.)'}${type === 'REJECTED' ? ' The order was cancelled.' : ''}`);
      setNotice(null); if (type === 'REJECTED') setOpen(null); reload();
    } catch (err) { say('error', err.message); }
  };
  const downloadAll = () => downloadCsv(`sales-${today()}.csv`, [
    ['Batloung Farm sales', today()], [], HEAD, ...sales.flatMap(lines),
    [], ['TOTAL', '', '', '', '', sales.reduce((n, s) => n + s.items.reduce((b, i) => b + i.quantity, 0), 0), '', '', fixed(totalSales), fixed(totalPaid), fixed(totalOwing), ''],
  ]);
  const vendorOptions = data && editing && !data.vendors.some((v) => v.vendor_id === editing.vendor_id)
    ? [...data.vendors, { vendor_id: editing.vendor_id, vendor_name: `${editing.vendor_name} (deleted)`, phone_number: '' }] : data?.vendors;

  return (
    <>
      <PageHead title="Sales" hint="Sell boxes to a vendor. Prices come from the box size, the total is calculated, and stock goes down only if every item is available." />
      <Alert>{error}</Alert>
      <Alert type={msg.type} onClose={() => say('error', '')}>{msg.text}</Alert>
      {data && <Kpis items={[{ value: money(totalSales), label: `total of all ${sales.length} sale(s)` }, { value: money(totalPaid), label: 'total payments received' }, { value: money(totalOwing), label: 'still owed by vendors', warn: totalOwing > 0 }, { value: sales.reduce((n, s) => n + s.items.reduce((b, i) => b + i.quantity, 0), 0), label: 'boxes sold' }]} />}
      {notice && (
        <form className="panel form notice-box" onSubmit={sendNotice}>
          <h2>Notify {notice.sale.vendor_name} about order #{notice.sale.sale_id}</h2>
          <div className="grid-form">
            <Field label="Message"><select value={notice.type} onChange={(e) => setNotice({ ...notice, type: e.target.value })}>
              {Object.entries(NOTICES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label={notice.type === 'REJECTED' ? 'Reason (optional)' : 'Extra note (optional), e.g. when to come'}><input value={notice.note} maxLength={150} onChange={(e) => setNotice({ ...notice, note: e.target.value })} /></Field>
          </div>
          {notice.type === 'REJECTED' && <p className="muted small">Rejecting cancels the order: its boxes go back into stock and the vendor is told.</p>}
          <div className="actions"><button type="button" onClick={() => setNotice(null)}>Cancel</button><button className={notice.type === 'REJECTED' ? 'danger' : 'primary'}>Send notification</button></div>
        </form>
      )}
      {data && (
        <form className="panel form" onSubmit={submit}>
          <h2>{editing ? `Edit sale #${editing.sale_id}` : 'New sale'}</h2>
          {editing && <p className="muted small">Boxes already on the sale keep their price. Payments already recorded stay as they are. Stock is adjusted by the difference.</p>}
          <Field label="Vendor"><select value={vendor} onChange={(e) => setVendor(e.target.value)} required>
            <option value="">Choose a vendor</option>{vendorOptions.map((v) => <option key={v.vendor_id} value={v.vendor_id}>{v.vendor_name}{v.phone_number ? ` - ${v.phone_number}` : ''}</option>)}</select></Field>
          {items.map((it, i) => {
            const st = rowStock(it);
            return (
              <div className="item-row" key={i}>
                <Field label="Fruit"><select value={it.fruit_id} onChange={(e) => setItem(i, 'fruit_id', e.target.value)} required>
                  <option value="">Choose</option>{data.fruits.map((f) => <option key={f.fruit_id} value={f.fruit_id}>{f.fruit_name}</option>)}</select></Field>
                <Field label="Box size"><select value={it.packaging_size} onChange={(e) => setItem(i, 'packaging_size', e.target.value)}>{SIZES.map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Field label={st ? `Boxes (${st.available_quantity} in stock)` : 'Boxes'}><input type="number" min="1" step="1" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} required /></Field>
                <div className="line-total">{st ? <>{money(priceFor(it))} each<br /><b>{money(lineTotal(it))}</b></> : '-'}</div>
                {items.length > 1 && <IconBtn icon="trash" tone="delete" label="Remove" onClick={() => setItems(items.filter((_, x) => x !== i))} />}
              </div>
            );
          })}
          {!editing && (
            <div className="item-row pay">
              <Field label="Payment"><select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile money</option><option value="CREDIT">Credit (pay later)</option></select></Field>
              {method !== 'CREDIT' && <Field label="Amount paid now (M) - blank = in full"><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>}
            </div>
          )}
          <div className="actions">
            <IconBtn icon="plus" tone="view" label="Add another fruit" onClick={() => setItems([...items, blank()])} />
            <span className="total">Total {money(total)}</span>
            {editing && <button type="button" onClick={reset}>Cancel</button>}
            <button className="primary">{editing ? 'Save changes' : 'Record sale'}</button>
          </div>
        </form>
      )}
      <section className="panel">
        <div className="panel-head"><h2>Sales history</h2><IconBtn icon="download" tone="download" label="Download list" onClick={downloadAll} disabled={!sales.length} /></div>
        <Table columns={[{ label: '#', key: 'sale_id' }, { label: 'Date', render: (s) => day(s.sale_date) }, { label: 'Vendor', key: 'vendor_name' },
          { label: 'Total', num: true, render: (s) => money(s.total_amount) }, { label: 'Paid', num: true, render: (s) => money(s.amount_paid) },
          { label: 'Balance', num: true, render: (s) => (s.outstanding_balance > 0 ? <b className="owing">{money(s.outstanding_balance)}</b> : money(0)) },
          { label: 'Status', render: (s) => <Badge value={s.payment_status} /> },
          { label: 'Order', render: (s) => (s.order_status && s.order_status !== 'PLACED' ? <span className={`badge order-${s.order_status.toLowerCase()}`}>{ORDER_LABEL[s.order_status]}</span> : <span className="muted small">Placed</span>) },
          { label: 'Slip', render: (s) => (s.proofs?.length ? <span className="badge">{s.proofs.length} PDF</span> : <span className="muted small">-</span>) },
          { label: 'Actions', render: (s) => (<span className="row-actions">
            <IconBtn icon="view" tone="view" iconOnly label={open?.sale_id === s.sale_id ? `Hide sale ${s.sale_id}` : `View sale ${s.sale_id}`} onClick={() => toggle(s.sale_id)} />
            <IconBtn icon="edit" tone="edit" iconOnly label={`Edit sale ${s.sale_id}`} onClick={() => edit(s)} />
            <IconBtn icon="trash" tone="delete" iconOnly label={`Delete sale ${s.sale_id}`} onClick={() => remove(s)} />
            <IconBtn icon="bell" tone="plain" iconOnly label={`Send a notice about sale ${s.sale_id}`} onClick={() => { setNotice({ sale: s, type: 'READY', note: '' }); window.scrollTo(0, 0); }} />
            <IconBtn icon="download" tone="download" iconOnly label={`Download sale ${s.sale_id}`} onClick={() => downloadOrder(s)} /></span>) }]}
          rows={data && sales.map((s) => ({ ...s, id: s.sale_id }))} />
        {data && sales.length > 0 && (
          <div className="grand">
            <span>Total sales: <b>{money(totalSales)}</b></span>
            <span>Total payments: <b>{money(totalPaid)}</b></span>
            <span>Balance: <b className={totalOwing > 0 ? 'owing' : ''}>{money(totalOwing)}</b></span>
          </div>
        )}
        {open && (
          <div className="detail">
            <h3>Sale #{open.sale_id} - {open.vendor_name}</h3>
            <Table columns={[{ label: 'Fruit', key: 'fruit_name' }, { label: 'Size', key: 'packaging_size' }, { label: 'Boxes', num: true, key: 'quantity' },
              { label: 'Price / box', num: true, render: (i) => money(i.unit_price) }, { label: 'Line total', num: true, render: (i) => money(i.line_total) }]} rows={open.items} />
            <ProofBox order={sales.find((x) => x.sale_id === open.sale_id) || {}} />
            <h3>Payments</h3>
            <Table empty="No payments." columns={[{ label: 'Date', render: (p) => day(p.payment_date) }, { label: 'Method', render: (p) => p.payment_method.replace('_', ' ') },
              { label: 'Amount', num: true, render: (p) => money(p.amount) }]} rows={open.payments} />
            {open.outstanding_balance > 0 && (
              <form className="item-row pay" onSubmit={addPayment}>
                <Field label="Method"><select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile money</option></select></Field>
                <Field label={`Amount (balance ${money(open.outstanding_balance)})`}><input type="number" min="0.01" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} required /></Field>
                <button className="primary">Record payment</button>
              </form>
            )}
          </div>
        )}
      </section>
    </>
  );
}
