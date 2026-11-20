import { useRef, useState } from 'react';
import { api, day, openProof, sendProof } from '../api.js';
import { IconBtn } from './ui.jsx';

// Payment slips (PDF only) for one order. Vendor (canSend): upload, view, download and delete. Admin: view and download.
export default function ProofBox({ order, canSend, onChange }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const proofs = order.proofs || [];

  const pick = async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    setBusy(true); setMsg('');
    try { await sendProof(order.sale_id, file); onChange?.(); } catch (err) { setMsg(err.message); }
    setBusy(false);
  };
  const open = async (p, save) => { try { setMsg(''); await openProof(p, save); } catch (err) { setMsg(err.message); } };
  const remove = async (p) => {
    if (!window.confirm(`Delete ${p.file_name}?`)) return;
    try { await api.del(`/proofs/${p.proof_id}`); onChange?.(); } catch (err) { setMsg(err.message); }
  };
  if (!canSend && !proofs.length) return null;

  return (
    <div className="proofs">
      <b className="small">Proof of payment (PDF)</b>
      {!proofs.length && <small className="muted">No slip sent yet.</small>}
      <ul>
        {proofs.map((p) => (
          <li key={p.proof_id}>
            <span><b>{p.file_name}</b><small>{day(p.uploaded_at)}</small></span>
            <span className="row-actions">
              <IconBtn icon="view" tone="view" iconOnly label={`View ${p.file_name}`} onClick={() => open(p, false)} />
              <IconBtn icon="download" tone="download" iconOnly label={`Download ${p.file_name}`} onClick={() => open(p, true)} />
              {canSend && <IconBtn icon="trash" tone="delete" iconOnly label={`Delete ${p.file_name}`} onClick={() => remove(p)} />}
            </span>
          </li>
        ))}
      </ul>
      {canSend && (
        <>
          <input ref={ref} type="file" accept="application/pdf,.pdf" hidden onChange={pick} aria-label="Choose a PDF payment slip" />
          <IconBtn icon="upload" tone="edit" label={busy ? 'Sending...' : 'Send payment slip (PDF)'} disabled={busy} onClick={() => ref.current?.click()} />
        </>
      )}
      {msg && <small className="owing" role="alert">{msg}</small>}
    </div>
  );
}
