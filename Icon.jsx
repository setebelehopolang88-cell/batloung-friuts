// Small outline symbols (no extra library needed). <Icon name="edit" />
const PATHS = {
  view: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  hide: <><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.2 6.2A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4.2-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></>,
  download: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 21h16" /></>,
  home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h5v-6h4v6h5V10" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9" /><path d="M16 7l3 3" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="4" /></>,
  print: <><path d="M6 9V3h12v6" /><rect x="4" y="9" width="16" height="8" rx="1" /><path d="M7 14h10v7H7z" /></>,
  restore: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  sales: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  purchases: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6" /></>,
  stock: <><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  fruits: <><path d="M12 7c-4-3-9 0-8 6 1 5 5 8 8 6 3 2 7-1 8-6 1-6-4-9-8-6z" /><path d="M12 7c0-2 1-4 3-5" /></>,
  vendors: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-4 3-6 7-6s7 2 7 6" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.5.7 4 2.5 4 6" /></>,
  suppliers: <><path d="M2 6h12v10H2z" /><path d="M14 9h4l4 4v3h-8z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  reports: <><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 16v-5M12 16V8M16 16v-8" /></>,
  business: <><path d="M3 9l2-5h14l2 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21h4" /></>,
  upload: <><path d="M12 15V3" /><path d="M7 8l5-5 5 5" /><path d="M4 21h16" /></>,
  file: <><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6" /><path d="M9 14h6M9 18h6" /></>,
  check: <><path d="M4 12l5 5L20 6" /></>,
  send: <><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></>,
};

export default function Icon({ name, size = 18 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name] || PATHS.list}
    </svg>
  );
}
