import { useEffect, useState } from 'react';
import { PROVINCES, api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Field } from '../components/ui.jsx';

const VENDOR0 = { vendor_name: '', phone_number: '', location: '' };
const SUPPLIER0 = { business_name: '', contact_person: '', phone: '', province: PROVINCES[0], address: '' };

export default function Login() {
  const { login, register, notice } = useAuth();
  const [about, setAbout] = useState('');            // business description (set by the admin), shown instead of pictures
  const [mode, setMode] = useState('signin');           // signin | register
  const [role, setRole] = useState('VENDOR');           // used when registering
  const [cred, setCred] = useState({ username: '', password: '' });
  const [extra, setExtra] = useState({ ...VENDOR0, ...SUPPLIER0 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/business').then((b) => setAbout(b.description)).catch(() => {}); }, []);
  const setC = (k) => (e) => setCred({ ...cred, [k]: e.target.value });
  const setX = (k) => (e) => setExtra({ ...extra, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (mode === 'signin') await login(cred.username.trim(), cred.password);
      else {
        const fields = role === 'VENDOR' ? Object.keys(VENDOR0) : Object.keys(SUPPLIER0);
        await register({ role, ...cred, username: cred.username.trim(), ...Object.fromEntries(fields.map((f) => [f, extra[f]])) });
      }
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="brand">Batloung<br />Farm</div>
        <h2 className="about-title">About us</h2>
        <p className="about">{about || 'Fresh fruit, boxed and delivered across Maseru. Vendors order boxes, suppliers register their fruit, and the farm desk keeps it all moving.'}</p>
      </section>

      <section className="login-card">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => { setMode('signin'); setError(''); }}>Sign in</button>
          <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setError(''); }}>Create account</button>
        </div>
        <Alert>{notice}</Alert>
        <Alert>{error}</Alert>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="role-pick" role="radiogroup" aria-label="Account type">
              {[['VENDOR', 'I am a vendor', 'I buy boxes of fruit'], ['SUPPLIER', 'I am a supplier', 'I grow and supply fruit']].map(([r, t, d]) => (
                <label key={r} className={role === r ? 'on' : ''}><input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} /><b>{t}</b><small>{d}</small></label>
              ))}
            </div>
          )}
          <div className="stack">
            <Field label="Username"><input value={cred.username} onChange={setC('username')} autoComplete="username" required autoFocus /></Field>
            <Field label={mode === 'register' ? 'Password (6+ characters)' : 'Password'}>
              <input type="password" value={cred.password} onChange={setC('password')} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? 6 : undefined} />
            </Field>
            {mode === 'register' && role === 'VENDOR' && <>
              <Field label="Stall / business name"><input value={extra.vendor_name} onChange={setX('vendor_name')} required /></Field>
              <Field label="Phone number"><input value={extra.phone_number} onChange={setX('phone_number')} placeholder="+266..." required /></Field>
              <Field label="Location"><input value={extra.location} onChange={setX('location')} placeholder="Maseru - Thetsane" required /></Field>
            </>}
            {mode === 'register' && role === 'SUPPLIER' && <>
              <Field label="Business name"><input value={extra.business_name} onChange={setX('business_name')} required /></Field>
              <Field label="Contact person"><input value={extra.contact_person} onChange={setX('contact_person')} required /></Field>
              <Field label="Phone"><input value={extra.phone} onChange={setX('phone')} placeholder="+27..." required /></Field>
              <Field label="Province"><select value={extra.province} onChange={setX('province')}>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select></Field>
              <Field label="Address"><input value={extra.address} onChange={setX('address')} required /></Field>
            </>}
          </div>
          <button className="primary wide" disabled={busy}>{busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>
        {mode === 'signin' && (
          <p className="demo muted">Demo accounts: <code>admin</code> / <code>admin123</code> &middot; <code>vendor1</code> or <code>supplier1</code> / <code>password123</code></p>
        )}
      </section>
    </div>
  );
}
