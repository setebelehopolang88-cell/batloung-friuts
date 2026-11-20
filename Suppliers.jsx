import { useState } from 'react';
import { api, PROVINCES, SIZE_LABEL, day, downloadCsv, fixed, money, today } from '../api.js';
import { Alert, Field, IconBtn, Kpis, PageHead, Table, useLoad } from '../components/ui.jsx';
import PasswordCell from '../components/PasswordCell.jsx';

const EMPTY = { business_name: '', contact_person: '', phone: '', province: PROVINCES[0], address: '' };
const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function Suppliers() {
  const { data, error, reload } = useLoad(async () => {
    const [suppliers, purchases, accounts] = await Promise.all([api.get('/suppliers'), api.get('/purchases/export'), api.get('/accounts')]);
    return { suppliers, purchases, accounts };
  });
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);   // supplier_id
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const say = (type, text) => setMsg({ type, text });

  const suppliers = data?.suppliers || [];
  const accountOf = (s) => data?.accounts.find((a) => a.supplier_id === s.supplier_id);
  const purchasesOf = (s) => (data?.purchases || []).filter((p) => p.supplier_id === s.supplier_id);
  const totalBought = suppliers.reduce((t, s) => t + s.total_bought, 0);
  const totalPurchases = suppliers.reduce((t, s) => t + s.purchase_count, 0);
  const viewed = suppliers.find((s) => s.supplier_id === viewing);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/suppliers/${editing}`, form); else await api.post('/suppliers', form);
      say('success', editing ? 'Supplier updated.' : 'Supplier registered.');
      setForm(EMPTY); setEditing(null); reload();
    } catch (err) { say('error', err.message); }
  };
  const remove = async (s) => {
    if (!window.confirm(`Delete ${s.business_name}?`)) return;
    try { await api.del(`/suppliers/${s.supplier_id}`); say('success', 'Supplier deleted.'); if (viewing === s.supplier_id) setViewing(null); reload(); }
    catch (err) { say('error', err.message); }
  };
  const edit = (s) => { setEditing(s.supplier_id); setForm({ ...EMPTY, ...s }); window.scrollTo(0, 0); };

  // One supplier: their details, every purchase with its fruit lines, and the total paid.
  const downloadOne = (s) => {
    const ps = purchasesOf(s);
    const rows = [
      ['Batloung Farm supplier'], ['Supplier', s.business_name], ['Contact person', s.contact_person], ['Phone', s.phone], ['Province', s.province], ['Address', s.address], [],
      ['Purchase #', 'Date', 'Fruit', 'Box size', 'Boxes', 'Cost per box (M)', 'Line total (M)', 'Purchase total (M)'],
    ];
    ps.forEach((p) => p.items.forEach((i, k) => rows.push([p.purchase_id, day(p.purchase_date), i.fruit_name, SIZE_LABEL[i.packaging_size], i.quantity, fixed(i.unit_cost), fixed(i.line_total), k === 0 ? fixed(p.total_amount) : ''])));
    rows.push([], ['Total paid to this supplier (M)', '', '', '', '', '', '', fixed(ps.reduce((t, p) => t + p.total_amount, 0))]);
    downloadCsv(`supplier-${slug(s.business_name)}-${today()}.csv`, rows);
  };
  const downloadAll = () => downloadCsv(`suppliers-${today()}.csv`, [
    ['Batloung Farm suppliers', today()], [],
    ['Business', 'Contact person', 'Phone', 'Province', 'Address', 'Purchases', 'Total bought (M)'],
    ...suppliers.map((s) => [s.business_name, s.contact_person, s.phone, s.province, s.address, s.purchase_count, fixed(s.total_bought)]),
    [], ['TOTAL', '', '', '', '', totalPurchases, fixed(totalBought)],
  ]);

  return (
    <>
      <PageHead title="Suppliers" hint="Growers in the South African provinces we buy from, and how much we have paid each of them." />
      <Alert>{error}</Alert>
      <Alert type={msg.type} onClose={() => say('error', '')}>{msg.text}</Alert>
      {data && <Kpis items={[{ value: suppliers.length, label: 'suppliers' }, { value: totalPurchases, label: 'purchases made' }, { value: money(totalBought), label: 'total paid to all suppliers' }]} />}

      <form className="panel form" onSubmit={submit}>
        <h2>{editing ? 'Edit supplier' : 'Register supplier'}</h2>
        <div className="grid-form">
          <Field label="Business name"><input value={form.business_name} onChange={set('business_name')} required /></Field>
          <Field label="Contact person"><input value={form.contact_person} onChange={set('contact_person')} required /></Field>
          <Field label="Phone"><input value={form.phone} onChange={set('phone')} required placeholder="+27..." /></Field>
          <Field label="Province"><select value={form.province} onChange={set('province')}>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Address"><input value={form.address} onChange={set('address')} required /></Field>
        </div>
        <div className="actions">
          <button className="primary">{editing ? 'Save changes' : 'Register supplier'}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancel</button>}
        </div>
      </form>

      {viewed && (
        <section className="panel detail-card">
          <div className="panel-head"><h2>{viewed.business_name}</h2><IconBtn icon="close" label="Close" onClick={() => setViewing(null)} /></div>
          <dl className="facts">
            <div><dt>Contact person</dt><dd>{viewed.contact_person}</dd></div>
            <div><dt>Phone</dt><dd>{viewed.phone}</dd></div>
            <div><dt>Province</dt><dd>{viewed.province}</dd></div>
            <div><dt>Address</dt><dd>{viewed.address}</dd></div>
            <div><dt>Purchases</dt><dd>{viewed.purchase_count}</dd></div>
            <div><dt>Total paid to this supplier</dt><dd>{money(viewed.total_bought)}</dd></div>
          </dl>
          <h3>Log in</h3>
          <PasswordCell account={accountOf(viewed)} onSaved={reload} />
          <h3>Purchases from this supplier</h3>
          <Table empty="No purchases from this supplier yet." columns={[{ label: '#', key: 'purchase_id' }, { label: 'Date', render: (p) => day(p.purchase_date) },
            { label: 'Fruits', render: (p) => p.items.map((i) => `${i.fruit_name} (${SIZE_LABEL[i.packaging_size]}) x${i.quantity}`).join(', ') },
            { label: 'Total', num: true, render: (p) => money(p.total_amount) }]} rows={purchasesOf(viewed).map((p) => ({ ...p, id: p.purchase_id }))} />
          <div className="actions">
            <IconBtn icon="edit" tone="edit" label="Edit" onClick={() => edit(viewed)} />
            <IconBtn icon="trash" tone="delete" label="Delete" onClick={() => remove(viewed)} />
            <IconBtn icon="download" tone="download" label="Download" onClick={() => downloadOne(viewed)} />
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><h2>All suppliers</h2><IconBtn icon="download" tone="download" label="Download list" onClick={downloadAll} disabled={!suppliers.length} /></div>
        <Table columns={[{ label: 'Business', key: 'business_name' }, { label: 'Contact', key: 'contact_person' }, { label: 'Phone', key: 'phone' },
          { label: 'Province', key: 'province' }, { label: 'Address', key: 'address' },
          { label: 'Total paid', num: true, render: (s) => money(s.total_bought) },
          { label: 'Log in', render: (s) => <PasswordCell account={accountOf(s)} onSaved={reload} /> },
          { label: 'Actions', render: (s) => (<span className="row-actions">
            <IconBtn icon="view" tone="view" iconOnly label={`View ${s.business_name}`} onClick={() => { setViewing(s.supplier_id); window.scrollTo(0, 0); }} />
            <IconBtn icon="edit" tone="edit" iconOnly label={`Edit ${s.business_name}`} onClick={() => edit(s)} />
            <IconBtn icon="trash" tone="delete" iconOnly label={`Delete ${s.business_name}`} onClick={() => remove(s)} />
            <IconBtn icon="download" tone="download" iconOnly label={`Download ${s.business_name}`} onClick={() => downloadOne(s)} /></span>) }]}
          rows={data && suppliers.map((s) => ({ ...s, id: s.supplier_id }))} />
        {data && suppliers.length > 0 && <p className="grand">Total paid to all suppliers: <b>{money(totalBought)}</b></p>}
      </section>
    </>
  );
}
