import { SIZES, money } from '../api.js';
import FruitPic from './FruitPic.jsx';

// One row per fruit, one column per packaging size - highlights anything at or below its low-stock level.
export default function StockGrid({ stock }) {
  const fruits = [...new Set(stock.map((s) => s.fruit_name))];
  if (!fruits.length) return <p className="muted">No stock records.</p>;
  return (
    <div className="table-wrap">
      <table className="grid">
        <thead><tr><th>Fruit</th>{SIZES.map((s) => <th key={s} className="num">{s[0] + s.slice(1).toLowerCase()}</th>)}</tr></thead>
        <tbody>
          {fruits.map((name) => (
            <tr key={name}>
              <td><span className="with-pic"><FruitPic name={name} src={stock.find((s) => s.fruit_name === name)?.image_url} size="xs" />{name}</span></td>
              {SIZES.map((size) => {
                const r = stock.find((s) => s.fruit_name === name && s.packaging_size === size);
                return (
                  <td key={size} className={`num cell ${r?.is_low ? 'low' : ''}`}>
                    {r ? <><b>{r.available_quantity}</b><small>{money(r.selling_price)} / box</small></> : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
