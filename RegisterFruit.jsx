import { useState } from 'react';
import { api } from '../api.js';
import { Alert, Field, PageHead, useLoad } from '../components/ui.jsx';
import PicturePicker from '../components/PicturePicker.jsx';

const EMPTY = { fruit_id: '', fruit_name: '', description: '', image_url: '' };

// Supplier: register a fruit you supply. It then shows, with its picture, on your dashboard and the farm's.
export default function RegisterFruit({ go }) {
  const { data, error } = useLoad(() => api.get('/fruits'));
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const say = (type, text) => setMsg({ type, text });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const existing = form.fruit_id ? data?.find((f) => String(f.fruit_id) === form.fruit_id) : null;

  const submit = async (e) => {
    e.preventDefault();
    try {
      const body = form.fruit_id ? { fruit_id: Number(form.fruit_id), image_url: form.image_url || undefined }
        : { fruit_name: form.fruit_name, description: form.description, image_url: form.image_url || undefined };
      const r = await api.post('/supplier/fruits', body);
      say('success', r.already_registered ? 'That fruit is already on your list.' : 'Fruit registered. It now appears on your dashboard.');
      setForm(EMPTY);
    } catch (err) { say('error', err.message); }
  };

  return (
    <>
      <PageHead title="Register a fruit" hint="Pick a fruit the farm already sells, or add a new one with its picture. The farm desk sets the selling prices." />
      <Alert>{error}</Alert>
      <Alert type={msg.type} onClose={() => say('error', '')}>{msg.text}</Alert>
      {msg.type === 'success' && msg.text && <p><button className="link" onClick={() => go('Dashboard')}>View it on my dashboard</button></p>}
      <form className="panel form" onSubmit={submit}>
        <div className="grid-form">
          <Field label="Fruit already sold by the farm">
            <select value={form.fruit_id} onChange={(e) => setForm({ ...EMPTY, fruit_id: e.target.value })}>
              <option value="">- or add a new fruit below -</option>
              {data?.map((f) => <option key={f.fruit_id} value={f.fruit_id}>{f.fruit_name}</option>)}
            </select>
          </Field>
          {!form.fruit_id && <>
            <Field label="New fruit name"><input value={form.fruit_name} onChange={set('fruit_name')} required /></Field>
            <Field label="Description"><input value={form.description} onChange={set('description')} /></Field>
          </>}
        </div>
        {(!form.fruit_id || (existing && !existing.image_url)) && (
          <Field label="Picture"><PicturePicker name={form.fruit_name || existing?.fruit_name} value={form.image_url} onChange={(u) => setForm({ ...form, image_url: u })} onError={(t) => say('error', t)} /></Field>
        )}
        <div className="actions"><button className="primary">Register fruit</button></div>
      </form>
    </>
  );
}
