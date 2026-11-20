import { useRef, useState } from 'react';
import { api, uploadPicture } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Field, IconBtn, PageHead, useLoad } from '../components/ui.jsx';
import MapPicker from '../components/MapPicker.jsx';

// "Batloung Fruits" menu page: about the business + where to find us. Everyone can read it; only the admin can edit it.
export default function Business() {
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const { data, error, reload } = useLoad(() => api.get('/business'));
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState({ type: 'error', text: '' });
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const say = (type, text) => setMsg({ type, text });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const move = (latitude, longitude) => setForm((f) => ({ ...f, latitude: +latitude.toFixed(6), longitude: +longitude.toFixed(6) }));

  // Admin: change the photo on this page straight away (everyone sees the new one). null = back to the default photo.
  const savePhoto = async (image_url) => {
    try {
      await api.put('/business', { description: data.description, latitude: data.latitude, longitude: data.longitude, place_label: data.place_label || '', image_url });
      say('success', image_url ? 'Photo changed. Everyone now sees the new photo.' : 'The original photo is back.'); reload();
    } catch (err) { say('error', err.message); }
  };
  const pickPhoto = async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    setBusy(true);
    try { await savePhoto(await uploadPicture(file)); } catch (err) { say('error', err.message); }
    setBusy(false);
  };

  const startEdit = () => { setForm({ description: data.description, latitude: data.latitude, longitude: data.longitude, place_label: data.place_label || '' }); say('error', ''); };
  const save = async (e) => {
    e.preventDefault();
    try { await api.put('/business', form); say('success', 'Saved. Everyone now sees the new description and location.'); setForm(null); reload(); }
    catch (err) { say('error', err.message); }
  };
  const findPlace = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    try {
      const r = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(search.trim())}`)).json();
      if (!r.length) return say('error', 'No place found. Try a different name, or click the map.');
      move(Number(r[0].lat), Number(r[0].lon));
      setForm((f) => ({ ...f, place_label: f.place_label || r[0].display_name.split(',').slice(0, 3).join(',').slice(0, 150) }));
      say('success', 'Place found. Drag the marker to fine-tune it, then save.');
    } catch { say('error', 'Could not search for places right now. Click the map instead.'); }
  };
  const here = () => {
    if (!navigator.geolocation) return say('error', 'This browser cannot share your location. Click the map instead.');
    navigator.geolocation.getCurrentPosition((p) => move(p.coords.latitude, p.coords.longitude), () => say('error', 'Location permission was refused. Click the map instead.'));
  };

  return (
    <>
      <PageHead title="Batloung Fruits" hint="Who we are and where to find us." />
      <Alert>{error}</Alert>
      <Alert type={msg.type} onClose={() => say('error', '')}>{msg.text}</Alert>
      {data && (
        <>
          <div className="banner">
            <img src={data.image_url || '/fruits/basket.jpg'} alt="Batloung Fruits" onError={(e) => { if (!e.target.src.endsWith('/fruits/basket.jpg')) e.target.src = '/fruits/basket.jpg'; }} />
            <h2>Fresh fruit, boxed and delivered across Maseru</h2>
            {isAdmin && (
              <div className="banner-tools">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pickPhoto} hidden aria-label="Choose a new photo" />
                <IconBtn icon="camera" tone="edit" label={busy ? 'Uploading...' : 'Change photo'} disabled={busy} onClick={() => fileRef.current?.click()} />
                {data.image_url && <IconBtn icon="restore" tone="plain" label="Use original photo" disabled={busy} onClick={() => savePhoto(null)} />}
              </div>
            )}
          </div>

          {!form ? (
            <>
              <section className="panel">
                <div className="panel-head"><h2>About the business</h2>{isAdmin && <IconBtn icon="edit" tone="edit" label="Edit description and location" onClick={startEdit} />}</div>
                <p className="about">{data.description}</p>
              </section>
              <section className="panel">
                <h2>Where to find us</h2>
                <p className="muted">{data.place_label || 'Location set by the farm desk'}</p>
                <MapPicker lat={data.latitude} lng={data.longitude} />
                <p className="muted small"><a href={`https://www.openstreetmap.org/?mlat=${data.latitude}&mlon=${data.longitude}#map=16/${data.latitude}/${data.longitude}`} target="_blank" rel="noreferrer">Open in OpenStreetMap</a>
                  {' '}&middot;{' '}<a href={`https://www.google.com/maps/dir/?api=1&destination=${data.latitude},${data.longitude}`} target="_blank" rel="noreferrer">Get directions</a></p>
              </section>
            </>
          ) : (
            <form className="panel form" onSubmit={save}>
              <h2>Edit description and location</h2>
              <Field label="Description of the business"><textarea rows={6} maxLength={2000} value={form.description} onChange={set('description')} required /></Field>
              <h3>Choose the business location</h3>
              <div className="grid-form">
                <Field label="Place name (shown to everyone)"><input value={form.place_label} onChange={set('place_label')} maxLength={150} placeholder="Maseru, Lesotho" /></Field>
              </div>
              <div className="search">
                <input placeholder="Search for a place, e.g. Maseru Mall" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search for a place" />
                <button type="button" onClick={findPlace}>Find on map</button>
                <button type="button" onClick={here}>Use my current location</button>
              </div>
              <MapPicker lat={form.latitude} lng={form.longitude} editable onPick={move} />
              <p className="muted small">Click the map or drag the marker. Selected: {form.latitude}, {form.longitude}</p>
              <div className="actions"><button className="primary">Save</button><button type="button" onClick={() => setForm(null)}>Cancel</button></div>
            </form>
          )}
          {data.updated_by && <p className="muted small">Last updated by {data.updated_by}.</p>}
        </>
      )}
    </>
  );
}
