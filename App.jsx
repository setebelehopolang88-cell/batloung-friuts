import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { AuthProvider, useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Fruits from './pages/Fruits.jsx';
import Stock from './pages/Stock.jsx';
import Vendors from './pages/Vendors.jsx';
import Purchases from './pages/Purchases.jsx';
import Sales from './pages/Sales.jsx';
import Reports from './pages/Reports.jsx';
import VendorHome from './pages/VendorHome.jsx';
import OrderBoxes from './pages/OrderBoxes.jsx';
import MyOrders from './pages/MyOrders.jsx';
import SupplierHome from './pages/SupplierHome.jsx';
import RegisterFruit from './pages/RegisterFruit.jsx';
import Business from './pages/Business.jsx';
import Notifications from './pages/Notifications.jsx';
import Offers from './pages/Offers.jsx';
import SendStock from './pages/SendStock.jsx';
import Icon from './components/Icon.jsx';

// Each role sees only its own menu.
// [name, page, symbol]
const MENUS = {
  ADMIN: [['Dashboard', Dashboard, 'dashboard'], ['Sales', Sales, 'sales'], ['Purchases', Purchases, 'purchases'], ['Stock', Stock, 'stock'], ['Fruits', Fruits, 'fruits'], ['Vendors', Vendors, 'vendors'], ['Suppliers', Suppliers, 'suppliers'], ['Offers', Offers, 'list'], ['Reports', Reports, 'reports'], ['Notifications', Notifications, 'bell'], ['Batloung Fruits', Business, 'business']],
  VENDOR: [['Dashboard', VendorHome, 'dashboard'], ['Order boxes', OrderBoxes, 'stock'], ['My orders', MyOrders, 'list'], ['Notifications', Notifications, 'bell'], ['Batloung Fruits', Business, 'business']],
  SUPPLIER: [['Dashboard', SupplierHome, 'dashboard'], ['Register fruit', RegisterFruit, 'fruits'], ['Send stock', SendStock, 'stock'], ['Notifications', Notifications, 'bell'], ['Batloung Fruits', Business, 'business']],
};
const ROLE_LABEL = { ADMIN: 'Farm desk', VENDOR: 'Vendor', SUPPLIER: 'Supplier' };

function Shell() {
  const { user, profile, checking, logout } = useAuth();
  const [page, setPage] = useState('Dashboard');
  const [unread, setUnread] = useState(0);
  // Everyone sees a count of new notifications (orders, offers, payment slips, notices); checked every 30 seconds.
  const refreshUnread = useCallback(() => {
    if (user) api.get('/notifications/unread').then((r) => setUnread(r.unread)).catch(() => {});
  }, [user?.user_id, user?.role]);
  useEffect(() => { refreshUnread(); const t = setInterval(refreshUnread, 30000); return () => clearInterval(t); }, [refreshUnread]);
  if (checking) return <p className="boot muted">Loading...</p>;
  if (!user) return <Login />;

  const menu = MENUS[user.role];
  const Page = (menu.find(([n]) => n === page) || menu[0])[1];
  const name = profile?.vendor_name || profile?.business_name || user.username;
  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => setPage('Dashboard')} title="Back to Batloung Farm" aria-label="Back to Batloung Farm (dashboard)"><Icon name="home" size={22} />Batloung Farm</button>
        <nav aria-label="Main menu">
          {menu.map(([n, , icon]) => <button key={n} className={n === page ? 'active' : ''} aria-current={n === page ? 'page' : undefined} onClick={() => setPage(n)}><Icon name={icon} size={17} />{n}{n === 'Notifications' && unread > 0 && <span className="dot" aria-label={`${unread} new`}>{unread}</span>}</button>)}
        </nav>
        <div className="who"><span><b>{name}</b><small>{ROLE_LABEL[user.role]}</small></span><button onClick={() => { logout(); setPage('Dashboard'); }}>Sign out</button></div>
      </header>
      <main className="main"><Page key={page} go={setPage} onChange={refreshUnread} /></main>
    </div>
  );
}

export default function App() { return <AuthProvider><Shell /></AuthProvider>; }
