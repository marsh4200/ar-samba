import { useEffect, useRef, useState } from 'react';
import {
  Download, RefreshCw, CheckCircle2, AlertCircle, GitBranch, ExternalLink,
  Sparkles, Clock, Network, UserCog, Info, ShieldCheck, Terminal, ArrowRight, Check,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { useSystem } from '@/context/SystemContext';
import { cn, initials, toneForName, formatUptime, bytesToHuman } from '@/lib/utils';
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, NumberStepper } from '@/components/ui/Field';
import { Progress } from '@/components/ui/Progress';
import { Spinner } from '@/components/ui/Spinner';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog, DialogContent } from '@/components/ui/Dialog';

/**
 * Settings is organised as anchored sections with a sticky index on desktop.
 * The page is short enough that tabs would hide content for no benefit, but
 * long enough that a jump list earns its place.
 */
const SECTIONS = [
  { id: 'account',  label: 'Account',   icon: UserCog },
  { id: 'sessions', label: 'Sessions',  icon: Clock },
  { id: 'updates',  label: 'Updates',   icon: GitBranch },
  { id: 'about',    label: 'About',     icon: Info },
];

function SectionNav({ active, adminOnly }) {
  const visible = SECTIONS.filter((s) => (s.id === 'sessions' ? adminOnly : true));
  return (
    <nav className="sticky top-24 hidden xl:block">
      <div className="mb-3 px-3 eyebrow">On this page</div>
      <ul className="space-y-1">
        {visible.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.id;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-signal-500/12 text-signal-300'
                    : 'text-ink-faint hover:bg-raised hover:text-ink',
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', isActive && 'text-signal-400')} />
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { metrics, dashboard } = useSystem();
  const [version, setVersion] = useState(null);
  const [checking, setChecking] = useState(false);
  const [updaterOpen, setUpdaterOpen] = useState(false);
  const [active, setActive] = useState('account');
  const toast = useToast();

  async function checkVersion(announce = false) {
    setChecking(true);
    try {
      const v = await api.get('/updates/version');
      setVersion(v);
      if (announce) {
        if (v.update_available) toast.info('Update available', `Version ${v.latest} is ready to install.`);
        else toast.success('Up to date', `You're running the latest version.`);
      }
    } catch (e) {
      toast.error('Could not check for updates', e.message);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => { checkVersion(); }, []);

  // Highlight the section currently in view
  useEffect(() => {
    const ids = SECTIONS.map((s) => s.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6 stagger">
      <PageHeader
        title="Settings"
        description="Your account, session behaviour and software updates."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_13rem] xl:gap-8">
        <div className="min-w-0 space-y-6">
          {/* ── Account ──────────────────────────────────────────── */}
          <section id="account" className="scroll-mt-24">
            <Card>
              <CardHeader
                icon={UserCog}
                title="Account"
                description="The administrator account you're signed in with."
              />
              <CardBody>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <span
                    className={cn(
                      'grid h-16 w-16 shrink-0 place-items-center rounded-2xl border font-display text-lg font-bold',
                      toneForName(user?.username),
                    )}
                  >
                    {initials(user?.username)}
                  </span>

                  <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                    <div className="min-w-0">
                      <dt className="eyebrow">Username</dt>
                      <dd className="mt-1.5 truncate font-mono text-xs text-ink">{user?.username}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="eyebrow">Email</dt>
                      <dd className="mt-1.5 truncate text-xs text-ink-muted">
                        {user?.email || 'Not set'}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="eyebrow">Role</dt>
                      <dd className="mt-1.5">
                        <Badge tone={isAdmin ? 'signal' : 'neutral'} icon={ShieldCheck}>
                          {user?.role}
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                </div>
              </CardBody>
              <CardFooter>
                <span className="text-2xs text-ink-faint">
                  This account signs in to AR Samba. It is separate from your Samba file-share users.
                </span>
              </CardFooter>
            </Card>
          </section>

          {/* ── Sessions (admin only) ────────────────────────────── */}
          {isAdmin && (
            <section id="sessions" className="scroll-mt-24 space-y-6">
              <IdleTimeoutCard toast={toast} />
              <SmbDeadtimeCard toast={toast} />
            </section>
          )}

          {/* ── Updates ──────────────────────────────────────────── */}
          <section id="updates" className="scroll-mt-24">
            <UpdatesCard
              version={version}
              checking={checking}
              onCheck={() => checkVersion(true)}
              onInstall={() => setUpdaterOpen(true)}
              isAdmin={isAdmin}
            />
          </section>

          {/* ── About ────────────────────────────────────────────── */}
          <section id="about" className="scroll-mt-24">
            <Card>
              <CardHeader
                icon={Info}
                title="About this server"
                description="Details you may be asked for when reporting a problem."
              />
              <CardBody flush>
                <dl className="grid grid-cols-1 gap-px bg-line/60 sm:grid-cols-2">
                  {[
                    { label: 'AR Samba version', value: dashboard?.version ? `v${dashboard.version}` : '—' },
                    { label: 'Hostname',  value: metrics?.hostname || '—' },
                    { label: 'Kernel',    value: metrics?.kernel || '—' },
                    { label: 'Uptime',    value: metrics ? formatUptime(metrics.uptime_seconds) : '—' },
                    { label: 'Processors', value: metrics ? `${metrics.cpu_cores} cores / ${metrics.cpu_threads} threads` : '—' },
                    { label: 'Memory',    value: metrics ? bytesToHuman(metrics.memory_total) : '—' },
                    { label: 'Shares',    value: dashboard?.share_count ?? '—' },
                    { label: 'Samba users', value: dashboard?.user_count ?? '—' },
                  ].map((r) => (
                    <div key={r.label} className="bg-panel px-5 py-3.5">
                      <dt className="eyebrow">{r.label}</dt>
                      <dd className="mt-1.5 truncate font-mono text-xs text-ink-muted" title={String(r.value)}>
                        {r.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
              <CardFooter>
                <span className="font-mono text-2xs text-ink-ghost">marsh4200/ar-samba</span>
                <ButtonLink
                  variant="ghost"
                  size="sm"
                  icon={Terminal}
                  href="/api/docs"
                  target="_blank"
                  rel="noreferrer"
                >
                  API reference
                </ButtonLink>
              </CardFooter>
            </Card>
          </section>
        </div>

        <SectionNav active={active} adminOnly={isAdmin} />
      </div>

      <UpdaterModal
        open={updaterOpen}
        onOpenChange={setUpdaterOpen}
        target={version?.latest}
        onFinished={() => checkVersion()}
      />
    </div>
  );
}

/* ─── Auto-logout ───────────────────────────────────────────────────── */

function IdleTimeoutCard({ toast }) {
  const { setIdleMinutes } = useAuth();
  const [minutes, setMinutes] = useState(15);
  const [initial, setInitial] = useState(15);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/system/idle-timeout')
      .then((res) => {
        if (cancelled) return;
        const v = res?.minutes ?? 15;
        setMinutes(v);
        setInitial(v);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function save(e) {
    e?.preventDefault?.();
    const v = Math.max(0, Math.min(1440, Number(minutes) || 0));
    setSaving(true);
    try {
      const res = await api.put('/system/idle-timeout', { minutes: v });
      const saved = res?.minutes ?? v;
      setMinutes(saved);
      setInitial(saved);
      setIdleMinutes(saved); // update the live timer in AuthContext
      toast.success(
        saved === 0 ? 'Auto sign-out turned off' : 'Auto sign-out updated',
        saved === 0
          ? 'You will stay signed in until you sign out.'
          : `You'll be signed out after ${saved} minutes of inactivity.`,
      );
    } catch (err) {
      toast.error('Could not save', err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  const dirty = Number(minutes) !== Number(initial);
  const off = Number(minutes) === 0;

  return (
    <Card>
      <CardHeader
        icon={Clock}
        title="Sign out when inactive"
        description="Applies to this control panel. Set to 0 to stay signed in indefinitely."
      />
      <CardBody>
        {loading ? (
          <Skeleton className="h-11 w-52" />
        ) : (
          <form onSubmit={save} className="flex flex-wrap items-end gap-4">
            <Field label="Inactivity limit" htmlFor="idle-minutes">
              <NumberStepper
                id="idle-minutes"
                value={minutes}
                onChange={setMinutes}
                disabled={saving}
                suffix="minutes"
              />
            </Field>
            <Button
              type="submit"
              variant={dirty ? 'primary' : 'outline'}
              icon={dirty ? undefined : Check}
              loading={saving}
              disabled={!dirty}
            >
              {dirty ? 'Save changes' : 'Saved'}
            </Button>
          </form>
        )}
      </CardBody>
      {!loading && off && (
        <CardFooter>
          <span className="text-2xs text-warn">
            Auto sign-out is off. Anyone with access to this browser stays signed in.
          </span>
        </CardFooter>
      )}
    </Card>
  );
}

/* ─── SMB deadtime ──────────────────────────────────────────────────── */

function SmbDeadtimeCard({ toast }) {
  const [minutes, setMinutes] = useState(0);
  const [initial, setInitial] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/system/smb-deadtime')
      .then((res) => {
        if (cancelled) return;
        const v = res?.minutes ?? 0;
        setMinutes(v);
        setInitial(v);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function save(e) {
    e?.preventDefault?.();
    const v = Math.max(0, Math.min(1440, Number(minutes) || 0));
    setSaving(true);
    try {
      const res = await api.put('/system/smb-deadtime', { minutes: v });
      const saved = res?.minutes ?? v;
      setMinutes(saved);
      setInitial(saved);
      toast.success(
        saved === 0 ? 'Idle disconnect turned off' : 'Idle disconnect updated',
        saved === 0
          ? 'Connections stay open until the client closes them.'
          : `Idle connections drop after ${saved} minutes.`,
      );
    } catch (err) {
      toast.error('Could not save', err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  const dirty = Number(minutes) !== Number(initial);

  return (
    <Card>
      <CardHeader
        icon={Network}
        title="Disconnect idle network drives"
        description="Tells Samba to drop connections that have gone quiet. Set to 0 to leave them open."
      />
      <CardBody>
        {loading ? (
          <Skeleton className="h-11 w-52" />
        ) : (
          <form onSubmit={save} className="flex flex-wrap items-end gap-4">
            <Field label="Idle limit" htmlFor="deadtime-minutes">
              <NumberStepper
                id="deadtime-minutes"
                value={minutes}
                onChange={setMinutes}
                disabled={saving}
                suffix="minutes"
              />
            </Field>
            <Button
              type="submit"
              variant={dirty ? 'primary' : 'outline'}
              icon={dirty ? undefined : Check}
              loading={saving}
              disabled={!dirty}
            >
              {dirty ? 'Save changes' : 'Saved'}
            </Button>
          </form>
        )}
      </CardBody>
      <CardFooter>
        <span className="text-2xs leading-relaxed text-ink-faint">
          Only connections with no open files are dropped. Windows reconnects silently
          on the next access, so people rarely notice.
        </span>
      </CardFooter>
    </Card>
  );
}

/* ─── Updates ───────────────────────────────────────────────────────── */

function UpdatesCard({ version, checking, onCheck, onInstall, isAdmin }) {
  const available = !!version?.update_available;

  return (
    <Card>
      <CardHeader
        icon={GitBranch}
        title="Software updates"
        description="AR Samba checks GitHub for new releases."
        action={
          <Button variant="outline" icon={RefreshCw} onClick={onCheck} loading={checking} size="sm">
            Check now
          </Button>
        }
      />
      <CardBody>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="well px-4 py-3.5">
            <div className="eyebrow">Installed</div>
            <div className="mt-1.5 font-display text-lg font-semibold text-ink tnum">
              {version?.current ? `v${version.current}` : <Skeleton className="h-6 w-20" />}
            </div>
          </div>
          <div
            className={cn(
              'rounded-xl border px-4 py-3.5',
              available ? 'border-signal-500/30 bg-signal-500/10' : 'well',
            )}
          >
            <div className={cn('eyebrow', available && 'text-signal-400')}>Latest release</div>
            <div
              className={cn(
                'mt-1.5 font-display text-lg font-semibold tnum',
                available ? 'text-signal-300' : 'text-ink',
              )}
            >
              {version ? (version.latest ? `v${version.latest}` : 'Unknown') : <Skeleton className="h-6 w-20" />}
            </div>
          </div>
        </div>

        {available ? (
          <div className="mt-4 rounded-xl border border-signal-500/25 bg-signal-500/[.07] p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-signal-400" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-ink">
                  Version {version.latest} is ready to install
                </div>

                {version.release_notes && (
                  <pre className="mt-2.5 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-line/70 bg-abyss/60 p-3 font-sans text-2xs leading-relaxed text-ink-muted">
                    {version.release_notes}
                  </pre>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    icon={Download}
                    onClick={onInstall}
                    disabled={!isAdmin}
                    title={isAdmin ? undefined : 'Only administrators can install updates'}
                  >
                    Install update
                  </Button>
                  {version.release_url && (
                    <ButtonLink
                      variant="ghost"
                      icon={ExternalLink}
                      href={version.release_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Release notes
                    </ButtonLink>
                  )}
                </div>

                {!isAdmin && (
                  <p className="hint">Ask an administrator to install this update.</p>
                )}
              </div>
            </div>
          </div>
        ) : version ? (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-ok/25 bg-ok/[.08] px-4 py-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />
            <span className="text-xs text-ink-muted">
              You&rsquo;re running the latest version.
            </span>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* ─── Updater ───────────────────────────────────────────────────────── */

const UPDATE_STEPS = [
  'Snapshot the current install',
  'Download and extract the new release',
  'Install dependencies and run migrations',
  'Restart services',
  'Roll back automatically if any step fails',
];

function UpdaterModal({ open, onOpenChange, target, onFinished }) {
  const [job, setJob] = useState(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef(null);
  const logEndRef = useRef(null);
  const toast = useToast();

  async function start() {
    setStarting(true);
    try {
      const qs = target ? `?target=${encodeURIComponent(target)}` : '';
      const j = await api.post(`/updates/start${qs}`);
      setJob(j);
    } catch (e) {
      toast.error('Could not start the update', e.message);
    } finally {
      setStarting(false);
    }
  }

  // Poll status while open and not finished
  useEffect(() => {
    if (!open) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return undefined;
    }

    (async () => {
      try {
        const s = await api.get('/updates/status');
        if (s) setJob(s);
      } catch { /* ignore */ }
    })();

    pollRef.current = setInterval(async () => {
      try {
        const s = await api.get('/updates/status');
        if (s) {
          setJob(s);
          if (s.state === 'success' || s.state === 'error') {
            clearInterval(pollRef.current);
            pollRef.current = null;
            if (s.state === 'success') {
              toast.success('Update installed', 'Reload the page to pick up the new version.');
              onFinished?.();
            } else {
              toast.error('Update failed', s.error || 'See the log output for details.');
            }
          }
        }
      } catch { /* ignore */ }
    }, 1500);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [job?.logs?.length]);

  const isRunning = job?.state === 'running';
  const isDone = job?.state === 'success';
  const isError = job?.state === 'error';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && isRunning) return; onOpenChange(v); }}>
      <DialogContent
        size="lg"
        icon={Download}
        hideClose={isRunning}
        title="Install update"
        description={target ? `Installing version ${target}` : 'Pull and install the latest release.'}
        footer={
          !job ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="primary" icon={ArrowRight} loading={starting} onClick={start}>
                Start update
              </Button>
            </>
          ) : (
            <>
              {!isRunning && (
                <Button variant="ghost" onClick={() => { setJob(null); onOpenChange(false); }}>
                  Close
                </Button>
              )}
              {isRunning && (
                <span className="mr-auto text-2xs text-ink-faint">
                  Keep this window open until the update finishes.
                </span>
              )}
              {isDone && (
                <Button variant="primary" icon={RefreshCw} onClick={() => window.location.reload()}>
                  Reload page
                </Button>
              )}
            </>
          )
        }
      >
        {!job ? (
          <div className="rounded-xl border border-line/70 bg-hull/50 p-4">
            <div className="mb-3 text-xs font-medium text-ink">Here&rsquo;s what will happen:</div>
            <ol className="space-y-2.5">
              {UPDATE_STEPS.map((s, i) => (
                <li key={s} className="flex items-start gap-3">
                  <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-md border border-line bg-raised font-mono text-[10px] text-ink-faint">
                    {i + 1}
                  </span>
                  <span className="text-2xs leading-relaxed text-ink-muted">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-ink">
                  {isRunning && <Spinner className="h-3.5 w-3.5 shrink-0 text-signal-400" />}
                  {isDone && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-ok" />}
                  {isError && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-crit" />}
                  <span className="truncate">{job.step || 'Working'}</span>
                </div>
                <span className="shrink-0 font-mono text-2xs text-ink-faint tnum">
                  {job.progress}%
                </span>
              </div>
              <Progress
                value={job.progress}
                animated={isRunning}
                tone={isError ? 'crit' : isDone ? 'ok' : 'signal'}
              />
            </div>

            <div className="h-64 overflow-y-auto rounded-xl border border-line/70 bg-abyss/80 p-3.5 font-mono text-[11px] leading-relaxed">
              {job.logs?.length ? (
                job.logs.map((l, i) => (
                  <div
                    key={i}
                    className={cn(
                      'whitespace-pre-wrap break-words',
                      /^\[(ERROR|error)\]/.test(l) ? 'text-crit'
                        : l.startsWith('==>') ? 'text-signal-400'
                        : 'text-ink-muted',
                    )}
                  >
                    {l}
                  </div>
                ))
              ) : (
                <div className="italic text-ink-ghost">Waiting for output…</div>
              )}
              <div ref={logEndRef} />
            </div>

            {isError && (
              <div className="rounded-xl border border-crit/30 bg-crit/[.08] p-3.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-crit">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Update failed — rolling back
                </div>
                {job.error && (
                  <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-2xs text-ink-muted">
                    {job.error}
                  </pre>
                )}
              </div>
            )}

            {isDone && (
              <div className="flex items-center gap-2.5 rounded-xl border border-ok/25 bg-ok/[.08] px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />
                <span className="text-xs text-ink-muted">
                  Update installed. Reload the page to pick up the new version.
                </span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
