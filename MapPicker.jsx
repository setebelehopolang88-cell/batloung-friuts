import { useEffect, useRef, useState } from 'react';

// Leaflet + OpenStreetMap, loaded from a CDN the first time a map is shown (no extra install needed).
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
let loading = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: CDN + 'leaflet.min.css' });
    document.head.appendChild(css);
    const js = Object.assign(document.createElement('script'), { src: CDN + 'leaflet.min.js' });
    js.onload = () => resolve(window.L);
    js.onerror = () => { loading = null; reject(new Error('The map could not load. Check your internet connection.')); };
    document.head.appendChild(js);
  });
  return loading;
}

// A map with one marker. When editable, the admin clicks the map or drags the marker and onPick(lat, lng) is called.
export default function MapPicker({ lat, lng, editable = false, onPick, height = 360 }) {
  const box = useRef(null), map = useRef(null), marker = useRef(null), pick = useRef(onPick);
  const [error, setError] = useState('');
  pick.current = onPick;

  useEffect(() => {
    let dead = false;
    loadLeaflet().then((L) => {
      if (dead || !box.current) return;
      map.current = L.map(box.current).setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map.current);
      marker.current = L.marker([lat, lng], { draggable: editable }).addTo(map.current);
      if (editable) {
        marker.current.on('dragend', () => { const p = marker.current.getLatLng(); pick.current?.(p.lat, p.lng); });
        map.current.on('click', (e) => { marker.current.setLatLng(e.latlng); pick.current?.(e.latlng.lat, e.latlng.lng); });
      }
    }).catch((e) => !dead && setError(e.message));
    return () => { dead = true; map.current?.remove(); map.current = null; marker.current = null; };
  }, [editable]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the coordinates when they change from outside (place search, "use my location", typing).
  useEffect(() => {
    if (!map.current || !marker.current) return;
    marker.current.setLatLng([lat, lng]);
    if (!map.current.getBounds().contains([lat, lng])) map.current.setView([lat, lng], map.current.getZoom());
  }, [lat, lng]);

  return error
    ? <p className="alert error" role="alert">{error}</p>
    : <div ref={box} className="map" style={{ height }} role="application" aria-label="Map showing the business location" />;
}
