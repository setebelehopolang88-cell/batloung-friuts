import { useState } from 'react';

const EMOJI = { apple: '🍎', banana: '🍌', orange: '🍊', mango: '🥭', grape: '🍇', watermelon: '🍉', litchi: '🍒', pear: '🍐', peach: '🍑', lemon: '🍋', strawberr: '🍓', pineapple: '🍍', avocado: '🥑' };
const emojiFor = (name = '') => Object.entries(EMOJI).find(([k]) => name.toLowerCase().includes(k))?.[1] || '🍓';

// The fruit's picture. If it has none (or it fails to load) a tidy emoji tile is shown instead.
export default function FruitPic({ name, src, size = 'md' }) {
  const [failed, setFailed] = useState(false);
  return src && !failed
    ? <img className={`pic ${size}`} src={src} alt={name} loading="lazy" onError={() => setFailed(true)} />
    : <span className={`pic ${size} fallback`} role="img" aria-label={name}>{emojiFor(name)}</span>;
}

// Overlapping row of pictures for an order / purchase.
export const PicStrip = ({ items }) => (
  <span className="strip">
    {items.slice(0, 5).map((i, k) => <FruitPic key={k} name={i.fruit_name} src={i.image_url} size="xs" />)}
    {items.length > 5 && <span className="pic xs fallback">+{items.length - 5}</span>}
  </span>
);
