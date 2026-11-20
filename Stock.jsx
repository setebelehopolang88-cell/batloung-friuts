import { useState } from 'react';
import { api } from '../api.js';
import { Alert, Badge, IconBtn, PageHead, Table, useLoad } from '../components/ui.jsx';
import StockGrid from '../components/StockGrid.jsx';
import { money } from '../api.js';

export default function Stock() {
  const { data, error, reload } = useLoad(async () => ({ stock: await api.get('/stock'), low: await api.get('/stock/low') }));
  const [edits, setEdits] = useState({});
  const [viewing, setViewing] = useState(null);   // stock_id
  const [msg, setMsg] = useState({ type: 'error', text: '' });

  const val = (r, k) => edits[r.stock_id]?.[k] ?? r[k];
  const change = (r, k, v) => setEdits({ ...edits, [r.stock_id]: { ...edits[r.stock_id], [k]: v } });
  const save = async (r) => {
    try {
      await api.put(`/stock/${r.stock_id}`, { selling_price: Number(val(r, 'selling_price')), low_stock_threshold: Number(val(r, 'low_stock_threshold')) });
      setEdits({ ...edits, [r.stock_id]: undefined });
      setMsg({ type: 'success', text: `${r.fruit_name} (${r.packaging_size.toLowerCase()}) saved.` });
      reload();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  };

  return (
    <>
      <PageHead title="Stock" hint="Boxes on hand for every fruit and packaging size. Stock rises with purchases and falls with sales." />
      <Alert>{error}</Alert>
      <Alert type={msg.type} onClose={() => setMsg({ type: 'error', text: '' })}>{msg.text}</Alert>
      {data && (
        <>
          <section className="panel"><h2>Overview</h2><StockGrid stock={data.stock} /></section>
          <section className="panel">
            <h2>Low stock ({data.low.length})</h2>
            <Table empty="Nothing is running low." columns={[{ label: 'Fruit', key: 'fruit_name' },
              { label: 'Size', render: (r) => <Badge value={r.packaging_size} /> }, { label: 'Boxes left', num: true, key: 'available_quantity' },
              { label: 'Alert level', num: true, key: 'low_stock_threshold' }]} rows={data.low} />
          </section>
          {data.stock.find((r) => r.stock_id === viewing) && (() => {
            const r = data.stock.find((x) => x.stock_id === viewing);
            return (
              <section className="panel detail-card">
                <div className="panel-head"><h2>{r.fruit_name} - {r.packaging_size.toLowerCase()} box</h2><IconBtn icon="close" label="Close" onClick={() => setViewing(null)} /></div>
                <dl className="facts">
                  <div><dt>Boxes on hand</dt><dd>{r.available_quantity}</dd></div>
                  <div><dt>Selling price</dt><dd>{money(r.selling_price)}</dd></div>
                  <div><dt>Alert at or below</dt><dd>{r.low_stock_threshold}</dd></div>
                  <div><dt>Status</dt><dd>{r.is_low ? 'Running low' : 'OK'}</dd></div>
                </dl>
              </section>
            );
          })()}
          <section className="panel">
            <h2>Prices and alert levels</h2>
            <Table columns={[{ label: 'Fruit', key: 'fruit_name' }, { label: 'Size', render: (r) => <Badge value={r.packaging_size} /> },
              { label: 'Boxes', num: true, key: 'available_quantity' },
              { label: 'Selling price (M)', num: true, render: (r) => <input className="mini" type="number" min="0" step="0.01" value={val(r, 'selling_price')} onChange={(e) => change(r, 'selling_price', e.target.value)} /> },
              { label: 'Alert at or below', num: true, render: (r) => <input className="mini" type="number" min="0" value={val(r, 'low_stock_threshold')} onChange={(e) => change(r, 'low_stock_threshold', e.target.value)} /> },
              { label: 'Actions', render: (r) => (<span className="row-actions">
                <IconBtn icon="view" tone="view" iconOnly label={`View ${r.fruit_name} ${r.packaging_size.toLowerCase()}`} onClick={() => setViewing(viewing === r.stock_id ? null : r.stock_id)} />
                {edits[r.stock_id] && <IconBtn icon="check" tone="edit" iconOnly label={`Save ${r.fruit_name} ${r.packaging_size.toLowerCase()}`} onClick={() => save(r)} />}
                {edits[r.stock_id] && <IconBtn icon="close" tone="plain" iconOnly label="Undo changes" onClick={() => setEdits({ ...edits, [r.stock_id]: undefined })} />}</span>) }]}
              rows={data.stock.map((r) => ({ ...r, id: r.stock_id }))} />
          </section>
        </>
      )}
    </>
  );
}
