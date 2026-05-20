import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/ui/Spinner';

export default function SetupPage() {
  const { initialised, loading, firstRunSetup } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  const [username, setUsername] = useState('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (initialised) return <Navigate to="/login" replace />;

  const mismatch = confirm && password !== confirm;
  const tooShort = password && password.length < 8;
  const canSubmit = username && password && password === confirm && !tooShort && !submitting;

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await firstRunSetup({ username, password, email });
      toast.success('Setup complete', 'Welcome to SambaControl');
      nav('/', { replace: true });
    } catch (err) {
      toast.error('Setup failed', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-bg via-bg to-[#0c0b18]">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-brand-400" />
          <h1 className="text-xl font-semibold">First-run setup</h1>
        </div>
        <p className="text-center text-sm text-neutral-400 mb-6">
          Create the first admin account for your SambaControl instance.
        </p>

        <form onSubmit={onSubmit} className="card space-y-4">
          <div>
            <label className="label">Admin username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label">Email (optional)</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              type="email"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="input"
              required
            />
            {tooShort && <p className="text-xs text-warning mt-1">Use at least 8 characters.</p>}
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              type="password"
              className="input"
              required
            />
            {mismatch && <p className="text-xs text-danger mt-1">Passwords don't match.</p>}
          </div>

          <ul className="text-xs text-neutral-500 space-y-1 pt-2">
            <li className="flex items-center gap-2">
              <Check className={`w-3.5 h-3.5 ${password.length >= 8 ? 'text-success' : 'text-neutral-600'}`} />
              At least 8 characters
            </li>
            <li className="flex items-center gap-2">
              <Check className={`w-3.5 h-3.5 ${password && password === confirm ? 'text-success' : 'text-neutral-600'}`} />
              Passwords match
            </li>
          </ul>

          <button type="submit" disabled={!canSubmit} className="btn-primary w-full">
            {submitting ? <Spinner /> : <ArrowRight className="w-4 h-4" />}
            Create admin & continue
          </button>
        </form>
      </div>
    </div>
  );
}
