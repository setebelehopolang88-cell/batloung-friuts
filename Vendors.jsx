import { useState } from 'react';
import { api, day, money } from '../api.js';
import { Alert, Badge, Field, IconBtn, PageHead, Table, useLoad } from '../components/ui.jsx';
import PasswordCell from '../components/PasswordCell.jsx';

const EMPTY = { vendor_name: '', phone_number: '', location: '' };

// Admin: view, edit and delete vendors. The vendor is notified of each of those actions.
export default function Vendors() {
  const { data, error, reload } = useLoad(async () => {
    const [vendors, balances, accounts] = await Promise.all([api.get('/vendors?include=deleted'), api.get('/vendors/balances'), api.get('/accounts')]);
    return vendors.map((v) => ({ ...v, id: v.vendor_id, account: accounts.find((a) => a.vendor_id === v.vendor_id), outstanding: balances.find((b) => b.vendor_id === v.vendor_id)?.outstanding_balance || 0 }));
  });
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [showDeleted, setShowDeleted] = useState(true);
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const say = (type, text) => setMsg({ type, text });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const told = (r) => (r.notified ? ' The vendor was notified.' : ' (This vendor has no log in, so no notification was sent.)');

  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = editing ? await api.put(`/vendors/${editing}`, form) : await api.post('/vendors', form);
      say('success', editing ? `Vendor updated.${r.notified ? ' The vendor was notified of the change.' : ''}` : 'Vendor registered.');
      setForm(EMPTY); setEditing(null); reload();
    } catch (err) { say('error', err.message); }
  };
  const view = async (v) => {
    try { const r = await api.post(`/vendors/${v.vendor_id}/view`); setViewing(r); say('success', `Showing ${r.vendor_name}.${told(r)}`); }
    catch (err) { say('error', err.message); }
  };
  const remove = async (v) => {
    if (!window.confirm(`Delete ${v.vendor_name}? They will be notified, can no longer sign in or order, and their past sales stay in the records.`)) return;
    try { const r = await api.del(`/vendors/${v.vendor_id}`); say('success', `${v.vendor_name} was deleted.${told(r)}`); setViewing(null); reload(); }
    catch (err) { say('error', err.message); }
  };
  const restore = async (v) => {
    try { const r = await api.post(`/vendors/${v.vendor_id}/restore`); say('success', `${v.vendor_name} was restored.${told(r)}`); setViewing(null); reload(); }
    catch (err) { say('error', err.message); }
  };
  const edit = (v) => { setEditing(v.vendor_id); setForm({ vendor_name: v.vendor_name, phone_number: v.phone_number, location: v.location }); window.scrollTo(0, 0); };
  const search = async (e) => {
    e.preventDefault();
    if (!q.trim()) { setFound(null); return; }
    try { setFound(await api.get(`/vendors/search?q=${encodeURIComponent(q.trim())}`)); } catch (err) { say('error', err.message); }
  };
  let rows = data;
  if (rows && found) rows = rows.filter((v) => found.some((f) => f.vendor_id === v.vendor_id));
  if (rows && !showDeleted) rows = rows.filter((v) => v.status !== 'DELETED');
  if (rows) rows = rows.map((v) => ({ ...v, _className: v.status === 'DELETED' ? 'gone' : '' }));

  return (
    <>
      <PageHead title="Vendors" hint="Street vendors and small retailers we sell to. Viewing, editing or deleting a vendor sends them a notification." />
      <Alert>{error}</Alert>
      <Alert type={msg.type} onClose={() => say('error', '')}>{msg.text}</Alert>
      <form className="panel form" onSubmit={submit}>
        <h2>{editing ? 'Edit vendor' : 'Register vendor'}</h2>
        <div className="grid-form">
          <Field label="Vendor name"><input value={form.vendor_name} onChange={set('vendor_name')} required /></Field>
          <Field label="Phone number"><input value={form.phone_number} onChange={set('phone_number')} required placeholder="+266..." /></Field>
          <Field label="Location"><input value={form.location} onChange={set('location')} required /></Field>
        </div>
        <div className="actions">
          <button className="primary">{editing ? 'Save changes' : 'Register vendor'}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancel</button>}
        </div>
      </form>

      {viewing && (
        <section className="panel detail-card">
          <div className="panel-head"><h2>{viewing.vendor_name} <Badge value={viewing.status} /></h2><IconBtn icon="close" label="Close" onClick={() => setViewing(null)} /></div>
          <dl className="facts">
            <div><dt>Phone</dt><dd>{viewing.phone_number}</dd></div>
            <div><dt>Location</dt><dd>{viewing.location}</dd></div>
            <div><dt>Registered</dt><dd>{day(viewing.registration_date)}</dd></div>
            <div><dt>Billed</dt><dd>{money(viewing.total_billed)}</dd></div>
            <div><dt>Paid</dt><dd>{money(viewing.total_paid)}</dd></div>
            <div><dt>Owes</dt><dd>{viewing.outstanding_balance > 0 ? <b className="owing">{money(viewing.outstanding_balance)}</b> : money(0)}</dd></div>
            {viewing.deleted_at && <div><dt>Deleted</dt><dd>{day(viewing.deleted_at)}</dd></div>}
          </dl>
          <h3>Log in</h3>
          <PasswordCell account={data?.find((v) => v.vendor_id === viewing.vendor_id)?.account} onSaved={reload} />
          <div className="actions">
            <IconBtn icon="edit" tone="edit" label="Edit" onClick={() => edit(viewing)} />
            {viewing.status === 'DELETED' ? <IconBtn icon="restore" tone="restore" label="Restore" onClick={() => restore(viewing)} /> : <IconBtn icon="trash" tone="delete" label="Delete" onClick={() => remove(viewing)} />}
          </div>
        </section>
      )}

      <section className="panel">
        <form className="search" onSubmit={search}>
          <input placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
          <button>Search</button>
          {found && <button type="button" className="link" onClick={() => { setFound(null); setQ(''); }}>Show all</button>}
          <label className="check"><input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} /> Show deleted vendors</label>
        </form>
        <Table empty="No vendors match." columns={[{ label: 'Vendor', key: 'vendor_name' }, { label: 'Phone', key: 'phone_number' }, { label: 'Location', key: 'location' },
          { label: 'Registered', render: (v) => day(v.registration_date) },
          { label: 'Status', render: (v) => <Badge value={v.status} /> },
          { label: 'Owes', num: true, render: (v) => (v.outstanding > 0 ? <b className="owing">{money(v.outstanding)}</b> : money(0)) },
          { label: 'Log in', render: (v) => <PasswordCell account={v.account} onSaved={reload} /> },
          { label: 'Actions', render: (v) => (
            <span className="row-actions">
              <IconBtn icon="view" tone="view" iconOnly label={`View ${v.vendor_name}`} onClick={() => view(v)} />
              <IconBtn icon="edit" tone="edit" iconOnly label={`Edit ${v.vendor_name}`} onClick={() => edit(v)} />
              {v.status === 'DELETED' ? <IconBtn icon="restore" tone="restore" iconOnly label={`Restore ${v.vendor_name}`} onClick={() => restore(v)} /> : <IconBtn icon="trash" tone="delete" iconOnly label={`Delete ${v.vendor_name}`} onClick={() => remove(v)} />}
            </span>) }]}
          rows={rows} />
      </section>
    </>
  );
}
