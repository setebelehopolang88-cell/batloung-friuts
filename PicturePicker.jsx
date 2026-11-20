import { useState } from 'react';
import { uploadPicture } from '../api.js';
import FruitPic from './FruitPic.jsx';

// Choose a picture file: it is uploaded straight away and shown as a preview. onChange(url).
export default function PicturePicker({ name, value, onChange, onError }) {
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    setBusy(true);
    try { onChange(await uploadPicture(file)); } catch (err) { onError?.(err.message); }
    setBusy(false);
  };
  return (
    <div className="picker">
      <FruitPic name={name || 'Fruit'} src={value} size="md" />
      <div>
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pick} aria-label="Fruit picture" />
        <small className="muted">{busy ? 'Uploading...' : value ? 'Picture saved. Choose another to replace it.' : 'PNG or JPEG, up to 2 MB.'}</small>
      </div>
    </div>
  );
}
