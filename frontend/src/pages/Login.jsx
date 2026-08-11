import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, FolderTree, ShieldCheck, ScrollText, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { AuthShell, AuthHeading } from '@/components/layout/AuthShell';
import { Button } from '@/components/ui/Button';
import { Field, Input, PasswordInput } from '@/components/ui/Field';

const POINTS = [
  {
    icon: FolderTree,
    label: 'Shares that validate before they go live',
    hint: 'Every change is written, checked with testparm, then reloaded.',
  },
  {
    icon: ShieldCheck,
    label: 'Per-user permissions on disk',
    hint: 'Read, write and inheritance applied as real POSIX ACLs.',
  },
  {
    icon: ScrollText,
    label: 'A record of every privileged action',
    hint: 'Who changed what, when, and whether it succeeded.',
  },
];

export default function LoginPage() {
  const { login, user, initialised, loading } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (loading) return null;
  if (!initialised) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to={loc.state?.from?.pathname || '/'} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      toast.success('Signed in', `Welcome back, ${username}`);
      nav(loc.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(err.message || 'Check your username and password, then try again.');
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="AR Samba"
      heading="Your file server, under control."
      blurb="Manage Samba shares, users and permissions from one place — without opening smb.conf over SSH."
      points={POINTS}
      footer="AR Smart Home · arsmarthome.co.za"
    >
      <AuthHeading
        title="Sign in"
        description="Use your AR Samba administrator account."
      />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-crit/30 bg-crit/10 px-3.5 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-crit" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-crit">Sign-in failed</div>
              <div className="mt-0.5 text-2xs leading-relaxed text-ink-muted">{error}</div>
            </div>
          </div>
        )}

        <Field label="Username" htmlFor="login-username">
          <Input
            id="login-username"
            autoFocus
            autoComplete="username"
            spellCheck={false}
            mono
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
          />
        </Field>

        <Field label="Password" htmlFor="login-password">
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
          />
        </Field>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          loading={submitting}
          icon={ArrowRight}
          disabled={!username || !password}
          className="!mt-6"
        >
          {submitting ? 'Signing in' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  );
}
