// The sign-in token lives in localStorage so a refresh keeps you signed in.
const KEY = 'batloung_token';
export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* storage blocked */ } };
let onSignedOut = () => {};
export const setSignedOutHandler = (fn) => { onSignedOut = fn; };

// Thin wrapper around fetch. Throws Error(message) using the API's { error } message.
async function request(path, method = 'GET', body) {
  let res;
  const token = getToken();
  try {
    res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach the server. Is the backend running on port 5000?');
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 401 && token && path !== '/auth/login') { setToken(null); onSignedOut(data?.error); } // token expired
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, b) => request(p, 'POST', b),
  put: (p, b) => request(p, 'PUT', b),
  del: (p) => request(p, 'DELETE'),
};

export const SIZES = ['SMALL', 'MEDIUM', 'LARGE'];
export const PROVINCES = ['Gauteng', 'Free State', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West'];
export const money = (n) => 'M ' + Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const day = (d) => (d ? String(d).slice(0, 10) : '');

export const SIZE_LABEL = { SMALL: 'Small', MEDIUM: 'Medium', LARGE: 'Large' };

// Reads a picture file and uploads it; resolves to the saved address (e.g. /uploads/abc.jpg).
export function uploadPicture(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Choose a picture first'));
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return reject(new Error('Use a PNG, JPEG, WEBP or GIF picture'));
    if (file.size > 2 * 1024 * 1024) return reject(new Error('The picture must be 2 MB or smaller'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => api.post('/uploads', { data: reader.result }).then((r) => resolve(r.url), reject);
    reader.readAsDataURL(file);
  });
}

// Downloads an order as a CSV file (opens in Excel).
export function downloadOrder(order) {
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [
    ['Batloung Farm order #' + order.sale_id], ['Vendor', order.vendor_name], ['Date', day(order.sale_date)], [],
    ['Fruit', 'Box size', 'Boxes', 'Price per box (M)', 'Line total (M)'],
    ...order.items.map((i) => [i.fruit_name, SIZE_LABEL[i.packaging_size], i.quantity, i.unit_price.toFixed(2), i.line_total.toFixed(2)]),
    [], ['Total (M)', '', '', '', Number(order.total_amount).toFixed(2)],
    ['Paid (M)', '', '', '', Number(order.amount_paid).toFixed(2)],
    ['Balance (M)', '', '', '', Number(order.outstanding_balance).toFixed(2)],
  ];
  const blob = new Blob(['\ufeff' + rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `batloung-order-${order.sale_id}.csv` });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
}

// Downloads rows as a CSV file (opens in Excel). rows: array of arrays.
export function downloadCsv(filename, rows) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const blob = new Blob(['\ufeff' + rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
}
export const today = () => new Date().toISOString().slice(0, 10);
export const fixed = (n) => Number(n || 0).toFixed(2);

// ---- PDF payment slips (vendor sends, admin / vendor opens) ----
export function sendProof(saleId, file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Choose a PDF file first'));
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return reject(new Error('Only PDF documents can be sent as proof of payment'));
    if (file.size > 2 * 1024 * 1024) return reject(new Error('The PDF must be 2 MB or smaller'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => api.post(`/orders/${saleId}/proofs`, { data: String(reader.result).replace(/^data:[^;]*;/, 'data:application/pdf;'), file_name: file.name }).then(resolve, reject);
    reader.readAsDataURL(file);
  });
}
// The slip is private, so it is fetched with the sign-in token and then opened (or saved) from memory.
export async function openProof(proof, save = false) {
  const token = getToken();
  const res = await fetch(`/api/proofs/${proof.proof_id}/file`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) { let m = ''; try { m = (await res.json()).error; } catch { /* not json */ } throw new Error(m || 'Could not open that PDF'); }
  const url = URL.createObjectURL(await res.blob());
  if (save) {
    const a = Object.assign(document.createElement('a'), { href: url, download: proof.file_name });
    document.body.appendChild(a); a.click(); a.remove();
  } else window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export const ORDER_LABEL = { PLACED: 'Placed', READY: 'Ready to collect', DELAYED: 'Delayed' };
