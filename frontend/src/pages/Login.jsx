import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Server, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/ui/Spinner';

export default function LoginPage() {
  const { login, user, initialised, loading } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (!initialised) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to={loc.state?.from?.pathname || '/'} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password);
      toast.success('Welcome back', `Signed in as ${username}`);
      nav(loc.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      toast.error('Login failed', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-bg via-bg to-[#0c0b18]">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-glass">
            <Server className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-xl font-semibold">SambaControl</div>
            <div className="text-xs uppercase tracking-widest text-neutral-500">Sign in</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4">
          <div>
            <label className="label">Username</label>
            <input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPw ? 'text' : 'password'}
                className="input pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200"
                aria-label="Toggle password visibility"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !username || !password}
            className="btn-primary w-full"
          >
            {submitting ? <Spinner /> : <LogIn className="w-4 h-4" />}
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-neutral-600">
          Self-hosted Samba + ACL management
        </p>
      </div>
    </div>
  );
}
