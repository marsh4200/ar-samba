import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearTokens, getAccessToken, setTokens } from '@/lib/api';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initialised, setInitialised] = useState(null); // null=loading, true/false
  const [loading, setLoading] = useState(true);

  const refreshSelf = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      return null;
    }
    try {
      const me = await api.get('/auth/me');
      setUser(me);
      return me;
    } catch {
      clearTokens();
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.get('/auth/setup-status');
        setInitialised(!!s.initialised);
        if (s.initialised) await refreshSelf();
      } catch (e) {
        setInitialised(false);
        console.error('setup-status failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshSelf]);

  const login = useCallback(async (username, password) => {
    const tokens = await api.post('/auth/login-json', { username, password });
    setTokens(tokens);
    await refreshSelf();
  }, [refreshSelf]);

  const firstRunSetup = useCallback(async ({ username, password, email }) => {
    const tokens = await api.post('/auth/setup', { username, password, email: email || null });
    setTokens(tokens);
    setInitialised(true);
    await refreshSelf();
  }, [refreshSelf]);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, initialised, loading, login, firstRunSetup, logout, refreshSelf }}>
      {children}
    </AuthContext.Provider>
  );
}
