import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, setSignedOutHandler } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Holds who is signed in: { user: { role, username, ... }, profile: vendor/supplier record }
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(!!getToken());
  const [notice, setNotice] = useState('');      // e.g. "Your vendor account was deleted..."

  const start = ({ token, user, profile }) => { setToken(token); setNotice(''); setSession({ user, profile }); };
  const logout = () => { setToken(null); setSession(null); };
  const refresh = async () => { try { setSession(await api.get('/auth/me')); } catch { /* signed out handler deals with it */ } };

  useEffect(() => {
    setSignedOutHandler((msg) => { setSession(null); if (msg && !/please sign in/i.test(msg)) setNotice(msg); });
    if (!getToken()) return;
    api.get('/auth/me').then(setSession).catch((e) => { setToken(null); if (/deleted/i.test(e.message)) setNotice(e.message); }).finally(() => setChecking(false));
  }, []);

  const value = {
    ...session, checking, notice, refresh, logout,
    login: async (username, password) => start(await api.post('/auth/login', { username, password })),
    register: async (body) => start(await api.post('/auth/register', body)),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
