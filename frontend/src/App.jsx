import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AppLayout from '@/components/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { BrandMark } from '@/components/brand/Logo';
import { Spinner } from '@/components/ui/Spinner';
import Login from '@/pages/Login';
import Setup from '@/pages/Setup';
import Dashboard from '@/pages/Dashboard';
import Users from '@/pages/Users';
import Shares from '@/pages/Shares';
import ImportPage from '@/pages/Import';
import Logs from '@/pages/Logs';
import Settings from '@/pages/Settings';

function BootScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-abyss px-6">
      <div className="flex flex-col items-center gap-5">
        <BrandMark size={52} />
        <div className="flex items-center gap-2.5 text-sm text-ink-faint">
          <Spinner className="h-4 w-4 text-signal-400" />
          Connecting to AR Samba
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { initialised, loading, user } = useAuth();
  const location = useLocation();

  if (loading || initialised === null) return <BootScreen />;

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
          <Route path="import"   element={<ImportPage />} />
          <Route path="logs"     element={<Logs />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
