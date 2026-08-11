import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

/**
 * SystemContext — one poller for the whole shell.
 *
 * The sidebar, the topbar status pill and the dashboard all want the same
 * live system state. Polling it once here keeps them in sync and avoids
 * three overlapping request loops.
 */

const SystemContext = createContext(null);

export function useSystem() {
  const ctx = useContext(SystemContext);
  if (!ctx) throw new Error('useSystem must be used inside <SystemProvider>');
  return ctx;
}

const DASHBOARD_MS = 15000;
const METRICS_MS = 5000;

export function SystemProvider({ children }) {
  const [dashboard, setDashboard] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Older backends don't expose /system/metrics. Probe once, then stop asking.
  const metricsAvailable = useRef(true);
  const [metricsSupported, setMetricsSupported] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const d = await api.get('/system/dashboard');
      setDashboard(d);
      setError(null);
      return d;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    if (!metricsAvailable.current) return null;
    try {
      const m = await api.get('/system/metrics');
      setMetrics(m);
      return m;
    } catch (e) {
      if (e?.status === 404) {
        metricsAvailable.current = false;
        setMetricsSupported(false);
      }
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    const [d] = await Promise.allSettled([loadDashboard(), loadMetrics()]);
    if (d.status === 'rejected') throw d.reason;
    return d.value;
  }, [loadDashboard, loadMetrics]);

  useEffect(() => {
    let alive = true;

    loadDashboard().catch(() => {});
    loadMetrics();

    const dashId = setInterval(() => { if (alive) loadDashboard().catch(() => {}); }, DASHBOARD_MS);
    const metId = setInterval(() => { if (alive) loadMetrics(); }, METRICS_MS);

    // Pull fresh numbers the moment the tab comes back into view rather than
    // showing whatever was on screen when the user switched away.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && alive) {
        loadDashboard().catch(() => {});
        loadMetrics();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      alive = false;
      clearInterval(dashId);
      clearInterval(metId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadDashboard, loadMetrics]);

  const smbd = dashboard?.services?.find((s) => s.name === 'smbd');

  return (
    <SystemContext.Provider
      value={{
        dashboard, metrics, loading, error,
        metricsSupported,
        smbActive: !!smbd?.active,
        smbState: smbd?.state,
        version: dashboard?.version,
        refresh, loadDashboard, loadMetrics,
      }}
    >
      {children}
    </SystemContext.Provider>
  );
}
