import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, KeyRound, ShieldCheck, UserCog } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { AuthShell, AuthHeading } from '@/components/layout/AuthShell';
import { Button } from '@/components/ui/Button';
import { Field, Input, PasswordInput } from '@/components/ui/Field';
import { cn } from '@/lib/utils';

const POINTS = [
  {
    icon: UserCog,
    label: 'This account administers the server',
    hint: 'It signs in to AR Samba. It is not a Samba file-share account.',
  },
  {
    icon: KeyRound,
    label: 'Choose a password you can recover',
    hint: 'There is no email reset — recovery means server access.',
  },
  {
    icon: ShieldCheck,
    label: 'Everything after this is logged',
    hint: 'Actions are attributed to the account that performed them.',
  },
];

/** Strength is advisory only — the server enforces the 8-character minimum. */
function scorePassword(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 14) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

const STRENGTH = [
  { label: '',          bar: '',           text: '' },
  { label: 'Weak',      bar: 'bg-crit',    text: 'text-crit' },
  { label: 'Fair',      bar: 'bg-warn',    text: 'text-warn' },
  { label: 'Good',      bar: 'bg-signal-400', text: 'text-signal-400' },
  { label: 'Strong',    bar: 'bg-ok',      text: 'text-ok' },
];

function Requirement({ met, children }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={cn(
          'grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors duration-200',
          met ? 'border-ok/40 bg-ok/15 text-ok' : 'border-line bg-raised text-transparent',
        )}
      >
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
      <span className={cn('text-2xs transition-colors', met ? 'text-ink-muted' : 'text-ink-ghost')}>
        {children}
      </span>
    </li>
  );
}

export default function SetupPage() {
  const { initialised, loading, firstRunSetup } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  const [username, setUsername] = useState('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const score = useMemo(() => scorePassword(password), [password]);

  if (loading) return null;
  if (initialised) return <Navigate to="/login" replace />;

  const longEnough = password.length >= 8;
  const matches = !!password && password === confirm;
  const mismatch = !!confirm && password !== confirm;
  const canSubmit = !!username && longEnough && matches && !submitting;

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await firstRunSetup({ username, password, email });
      toast.success('Setup complete', 'Your administrator account is ready.');
      nav('/', { replace: true });
    } catch (err) {
      toast.error('Setup failed', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const strength = STRENGTH[score] || STRENGTH[0];

  return (
    <AuthShell
      eyebrow="First run"
      heading="Let's set up your server."
      blurb="Create the administrator account that manages shares, users and permissions on this machine."
      points={POINTS}
      footer="AR Smart Home · arsmarthome.co.za"
    >
      <AuthHeading
        title="Create administrator"
        description="This is a one-time step. You'll sign in with these details from now on."
      />

      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Username"
          htmlFor="setup-username"
          required
          hint="Used to sign in to this control panel."
        >
          <Input
            id="setup-username"
            data-autofocus
            autoFocus
            mono
            spellCheck={false}
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>

        <Field label="Email" htmlFor="setup-email" hint="Optional. Stored for your reference only.">
          <Input
            id="setup-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Password" htmlFor="setup-password" required>
          <PasswordInput
            id="setup-password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {password && (
            <div className="mt-2.5 flex items-center gap-3">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors duration-300',
                      i <= score ? strength.bar : 'bg-line',
                    )}
                  />
                ))}
              </div>
              <span className={cn('w-12 text-right text-2xs font-medium', strength.text)}>
                {strength.label}
              </span>
            </div>
          )}
        </Field>

        <Field
          label="Confirm password"
          htmlFor="setup-confirm"
          required
          error={mismatch ? 'Passwords do not match.' : null}
        >
          <PasswordInput
            id="setup-confirm"
            autoComplete="new-password"
            required
            invalid={mismatch}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>

        <ul className="space-y-2 rounded-xl border border-line/70 bg-hull/50 px-4 py-3.5">
          <Requirement met={longEnough}>At least 8 characters</Requirement>
          <Requirement met={matches}>Both entries match</Requirement>
        </ul>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          loading={submitting}
          icon={ArrowRight}
          disabled={!canSubmit}
          className="!mt-6"
        >
          {submitting ? 'Creating account' : 'Create account and continue'}
        </Button>
      </form>
    </AuthShell>
  );
}
