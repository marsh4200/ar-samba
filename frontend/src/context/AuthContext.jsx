import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, clearTokens, getAccessToken, setTokens } from '@/lib/api';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initialised, setInitialised] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idleMinutes, setIdleMinutes] = useState(15);

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

  // ─── Idle-logout: fetch the configured timeout once logged in ────────────
  useEffect(() => {
    if (!user) return;
    api.get('/system/idle-timeout')
      .then((res) => setIdleMinutes(res?.minutes ?? 15))
      .catch(() => {});
  }, [user]);

  // ─── Idle-logout: reset timer on user activity, fire after N minutes ────
  const timerRef = useRef(null);
  useEffect(() => {
    if (!user) return undefined;

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (idleMinutes <= 0) return;            // 0 disables auto-logout
      timerRef.current = setTimeout(() => {
        console.warn(`Idle for ${idleMinutes} minutes — logging out`);
        logout();
      }, idleMinutes * 60 * 1000);
    };

    reset();
    // NOTE: deliberately exclude 'mousemove' and 'scroll' — they fire near-continuously
    // (cursor drift, momentum scroll) and would keep resetting the timer so it never
    // reaches the deadline, effectively disabling auto-logout. Use discrete intent events.
    const events = ['mousedown', 'keydown', 'touchstart', 'wheel', 'visibilitychange'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user, idleMinutes, logout]);

  return (
    <AuthContext.Provider value={{
      user, initialised, loading, login, firstRunSetup, logout, refreshSelf,
      idleMinutes, setIdleMinutes,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
