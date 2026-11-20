import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { IconBtn } from './ui.jsx';

// Admin only: shows a vendor's / supplier's user name and lets the farm desk reveal their password
// (it hides itself again after 20 seconds) or set a new one.
export default function PasswordCell({ account, onSaved }) {
  const [shown, setShown] = useState(null);
  const [setting, setSetting] = useState(false);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { if (shown === null) return undefined; const t = setTimeout(() => setShown(null), 20000); return () => clearTimeout(t); }, [shown]);
  if (!account) return <span className="muted small">No log in</span>;

  const show = async () => {
    try { setMsg(''); setShown((await api.get(`/accounts/${account.user_id}/password`)).password); }
    catch (e) { setMsg(e.message); }
  };
  const save = async (e) => {
    e.preventDefault();
    try {
      const r = await api.put(`/accounts/${account.user_id}/password`, { password: pw });
      setShown(r.password); setSetting(false); setPw(''); setMsg(''); onSaved?.();
    } catch (err) { setMsg(err.message); }
  };

  return (
    <div className="pw">
      <div className="pw-line">
        <code title="User name">{account.username}</code>
        {shown !== null ? <code className="pw-val" title="Password">{shown}</code> : <code className="pw-dots" aria-hidden="true">••••••••</code>}
        {shown !== null
          ? <IconBtn icon="hide" iconOnly label="Hide password" tone="view" onClick={() => setShown(null)} />
          : <IconBtn icon="view" iconOnly label="Show password" tone="view" onClick={show} />}
        <IconBtn icon="key" iconOnly label="Set a new password" tone="edit" onClick={() => { setSetting(!setting); setMsg(''); }} />
      </div>
      {setting && (
        <form className="pw-form" onSubmit={save}>
          <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} required placeholder="New password (6+ characters)" aria-label="New password" autoComplete="off" />
          <button className="primary">Save</button>
        </form>
      )}
      {msg && <small className="pw-msg">{msg}</small>}
    </div>
  );
}
