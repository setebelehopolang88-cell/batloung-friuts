import { useState } from 'react';
import { api, SIZES, money } from '../api.js';
import { Alert, Badge, Field, IconBtn, PageHead, Table, useLoad } from '../components/ui.jsx';
import FruitPic from '../components/FruitPic.jsx';
import PicturePicker from '../components/PicturePicker.jsx';

const EMPTY = { fruit_name: '', description: '', image_url: '', status: 'ACTIVE', SMALL: '', MEDIUM: '', LARGE: '' };

export default function Fruits() {
  const { data, error, reload } = useLoad(async () => {
    const [fruits, stock] = await Promise.all([api.get('/fruits'), api.get('/stock')]);
    return fruits.map((f) => ({ ...f, id: f.fruit_id, prices: Object.fromEntries(stock.filter((s) => s.fruit_id === f.fruit_id).map((s) => [s.packaging_size, s.selling_price])) }));
  });
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);   // fruit_id
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const say = (type, text) => setMsg({ type, text });

  const submit = async (e) => {
    e.preventDefault();
    const prices = {};
    SIZES.forEach((s) => { if (form[s] !== '') prices[s] = Number(form[s]); });
    const body = { fruit_name: form.fruit_name, description: form.description, image_url: form.image_url, status: form.status, prices };
    try {
      if (editing) await api.put(`/fruits/${editing}`, body); else await api.post('/fruits', body);
      say('success', editing ? 'Fruit updated.' : 'Fruit registered with small, medium and large stock rows.');
      setForm(EMPTY); setEditing(null); reload();
    } catch (err) { say('error', err.message); }
  };
  const remove = async (f) => {
    if (!window.confirm(`Delete ${f.fruit_name}? Fruit that is already on purchases or sales cannot be deleted - set it to INACTIVE instead.`)) return;
    try { await api.del(`/fruits/${f.fruit_id}`); say('success', `${f.fruit_name} deleted.`); if (viewing === f.fruit_id) setViewing(null); reload(); }
    catch (err) { say('error', err.message); }
  };
  const viewed = data?.find((f) => f.fruit_id === viewing);
  const edit = (f) => {
    setEditing(f.fruit_id);
    setForm({ fruit_name: f.fruit_name, description: f.description || '', image_url: f.image_url || '', status: f.status, SMALL: f.prices.SMALL ?? '', MEDIUM: f.prices.MEDIUM ?? '', LARGE: f.prices.LARGE ?? '' });
    window.scrollTo(0, 0);
  };

  return (
    <>
      <PageHead title="Fruits" hint="Each fruit has its own selling price for small, medium and large boxes." />
      <Alert>{error}</Alert>
      <Alert type={msg.type} onClose={() => say('error', '')}>{msg.text}</Alert>
      <form className="panel form" onSubmit={submit}>
        <h2>{editing ? 'Edit fruit' : 'Register fruit'}</h2>
        <div className="grid-form">
          <Field label="Fruit name"><input value={form.fruit_name} onChange={set('fruit_name')} required /></Field>
          <Field label="Description"><input value={form.description} onChange={set('description')} /></Field>
          <Field label="Status"><select value={form.status} onChange={set('status')}><option>ACTIVE</option><option>INACTIVE</option></select></Field>
          {SIZES.map((s) => (
            <Field key={s} label={`Selling price - ${s.toLowerCase()} box (M)`}>
              <input type="number" min="0" step="0.01" value={form[s]} onChange={set(s)} />
            </Field>
          ))}
        </div>
        <Field label="Picture"><PicturePicker name={form.fruit_name} value={form.image_url} onChange={(u) => setForm({ ...form, image_url: u })} onError={(t) => say('error', t)} /></Field>
        <div className="actions">
          <button className="primary">{editing ? 'Save changes' : 'Register fruit'}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancel</button>}
        </div>
      </form>
      {viewed && (
        <section className="panel detail-card">
          <div className="panel-head"><h2>{viewed.fruit_name} <Badge value={viewed.status} /></h2><IconBtn icon="close" label="Close" onClick={() => setViewing(null)} /></div>
          <FruitPic name={viewed.fruit_name} src={viewed.image_url} size="card" />
          <dl className="facts">
            <div><dt>Description</dt><dd>{viewed.description || '-'}</dd></div>
            <div><dt>Supplied by</dt><dd>{viewed.suppliers || 'No supplier registered'}</dd></div>
            {SIZES.map((s) => <div key={s}><dt>{s[0] + s.slice(1).toLowerCase()} box price</dt><dd>{money(viewed.prices[s])}</dd></div>)}
          </dl>
          <div className="actions"><IconBtn icon="edit" tone="edit" label="Edit" onClick={() => edit(viewed)} /><IconBtn icon="trash" tone="delete" label="Delete" onClick={() => remove(viewed)} /></div>
        </section>
      )}
      <section className="panel">
        <Table columns={[{ label: '', render: (f) => <FruitPic name={f.fruit_name} src={f.image_url} size="xs" /> }, { label: 'Fruit', key: 'fruit_name' }, { label: 'Supplied by', key: 'suppliers' },
          { label: 'Status', render: (f) => <Badge value={f.status} /> },
          ...SIZES.map((s) => ({ label: s[0] + s.slice(1).toLowerCase() + ' price', num: true, render: (f) => money(f.prices[s]) })),
          { label: 'Actions', render: (f) => (<span className="row-actions">
            <IconBtn icon="view" tone="view" iconOnly label={`View ${f.fruit_name}`} onClick={() => { setViewing(f.fruit_id); window.scrollTo(0, 0); }} />
            <IconBtn icon="edit" tone="edit" iconOnly label={`Edit ${f.fruit_name}`} onClick={() => edit(f)} />
            <IconBtn icon="trash" tone="delete" iconOnly label={`Delete ${f.fruit_name}`} onClick={() => remove(f)} /></span>) }]} rows={data} />
      </section>
    </>
  );
}
