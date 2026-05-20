import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AppLayout from '@/components/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Spinner } from '@/components/ui/Spinner';
import Login from '@/pages/Login';
import Setup from '@/pages/Setup';
import Dashboard from '@/pages/Dashboard';
import Users from '@/pages/Users';
import Shares from '@/pages/Shares';
import Logs from '@/pages/Logs';
import Settings from '@/pages/Settings';

export default function App() {
  const { initialised, loading, user } = useAuth();
  const location = useLocation();

  if (loading || initialised === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-bg">
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <Spinner className="w-6 h-6 text-brand-400" />
          <div className="text-sm">Loading SambaControl…</div>
        </div>
      </div>
    );
  }

  // First-run: force /setup
  if (!initialised) {
    if (location.pathname !== '/setup') return <Navigate to="/setup" replace />;
    return (
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/setup" element={<Navigate to="/" replace />} />

      {/* Protected */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="users"    element={<Users />} />
          <Route path="shares"   element={<Shares />} />
          <Route path="logs"     element={<Logs />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
