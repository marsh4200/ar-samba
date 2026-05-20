import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { FullScreenLoader } from '@/components/ui/Spinner';

export default function ProtectedRoute() {
  const { user, loading, initialised } = useAuth();
  const loc = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!initialised) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  return <Outlet />;
}
