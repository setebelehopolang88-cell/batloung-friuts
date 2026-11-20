import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon.jsx';

// Loads data from the API; exposes reload() so pages can refresh after changes.
export function useLoad(fn) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try { setError(''); setData(await fn()); } catch (e) { setError(e.message); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload };
}

export const Alert = ({ type = 'error', children, onClose }) =>
  children ? (
    <div className={`alert ${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && <button className="link" onClick={onClose}>Dismiss</button>}
    </div>
  ) : null;

export const Badge = ({ value }) => <span className={`badge ${String(value).toLowerCase()}`}>{String(value).replace('_', ' ')}</span>;

export function Table({ columns, rows, empty = 'Nothing here yet.' }) {
  if (!rows) return <p className="muted">Loading...</p>;
  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{columns.map((c) => <th key={c.label} className={c.num ? 'num' : ''}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className={r._className || ''}>
              {columns.map((c) => <td key={c.label} className={c.num ? 'num' : ''}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Field = ({ label, children }) => <label className="field"><span>{label}</span>{children}</label>;

export const PageHead = ({ title, hint }) => (
  <header className="page-head"><h1>{title}</h1>{hint && <p>{hint}</p>}</header>
);

// Soft-coloured button with a symbol. tone: view | edit | delete | download | restore | plain
export const IconBtn = ({ icon, label, tone = 'plain', onClick, disabled, iconOnly = false, type = 'button' }) => (
  <button type={type} className={`ib ${tone}${iconOnly ? ' only' : ''}`} onClick={onClick} disabled={disabled} title={label} aria-label={label}>
    <Icon name={icon} size={16} />{!iconOnly && <span>{label}</span>}
  </button>
);

// The big number tiles at the top of a page. items: [{ value, label, warn }]
export const Kpis = ({ items }) => (
  <section className={`kpis ${items.length === 3 ? 'three' : ''}`}>
    {items.map((k) => <div key={k.label} className={`kpi ${k.warn ? 'warn' : ''}`}><b>{k.value}</b><span>{k.label}</span></div>)}
  </section>
);
