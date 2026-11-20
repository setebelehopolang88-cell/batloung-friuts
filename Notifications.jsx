import { useEffect } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, IconBtn, PageHead, useLoad } from '../components/ui.jsx';

const KIND = { VIEWED: 'Viewed', EDITED: 'Edited', DELETED: 'Deleted', RESTORED: 'Restored', INFO: 'Info', ORDER: 'New order', OFFER: 'Stock offer', PAYMENT: 'Payment slip',
  REJECTED: 'Rejected', READY: 'Come and collect', DELAYED: 'Delayed', ACCEPTED: 'Accepted' };
const BADGE = { DELETED: 'deleted', REJECTED: 'rejected', EDITED: 'medium', DELAYED: 'order-delayed', READY: 'order-ready', ACCEPTED: 'accepted', RESTORED: 'restored' };
const HINT = {
  ADMIN: 'You are told here when a vendor orders or sends a payment slip, and when a supplier sends, changes or withdraws a stock offer.',
  VENDOR: 'You are told here when the farm desk views, edits or deletes your account, or rejects, delays or has finished your order.',
  SUPPLIER: 'You are told here when the farm desk accepts or rejects the stock you send.',
};

// Everyone: messages for your log in. Each can be marked as read or deleted.
export default function Notifications({ onChange }) {
  const { user } = useAuth();
  const { data, error, reload } = useLoad(() => api.get('/notifications'));
  // The page opens with the new ones highlighted, then they count as read.
  useEffect(() => {
    if (data?.unread) api.post('/notifications/read-all').then(() => onChange?.()).catch(() => {});
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const remove = async (n) => { try { await api.del(`/notifications/${n.notification_id}`); reload(); onChange?.(); } catch { /* shown on refresh */ } };
  const clear = async () => {
    if (!window.confirm('Delete all your notifications?')) return;
    try { await api.del('/notifications'); reload(); onChange?.(); } catch { /* shown on refresh */ }
  };
  return (
    <>
      <PageHead title="Notifications" hint={HINT[user.role]} />
      <Alert>{error}</Alert>
      {data && !data.items.length && <p className="muted">No notifications yet.</p>}
      <ul className="notes">
        {data?.items.map((n) => (
          <li key={n.notification_id} className={`${n.is_read ? '' : 'new'} ${n.kind.toLowerCase()}`}>
            <span className={`badge ${BADGE[n.kind] || ''}`}>{KIND[n.kind] || n.kind}</span>
            <span>{n.message}</span>
            <time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString()}</time>
            <IconBtn icon="trash" tone="delete" iconOnly label="Delete this notification" onClick={() => remove(n)} />
          </li>
        ))}
      </ul>
      {data?.items.length > 0 && <p><IconBtn icon="restore" tone="plain" label="Refresh" onClick={reload} /> <IconBtn icon="trash" tone="delete" label="Delete all" onClick={clear} /></p>}
    </>
  );
}
