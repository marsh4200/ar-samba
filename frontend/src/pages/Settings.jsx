import { useEffect, useRef, useState } from 'react';
import {
  Download, RefreshCw, CheckCircle2, AlertCircle, GitBranch, ExternalLink, Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui/Spinner';
import { Progress } from '@/components/ui/Progress';
import { Dialog, DialogContent } from '@/components/ui/Dialog';

export default function SettingsPage() {
  const { user } = useAuth();
  const [version, setVersion] = useState(null);
  const [checking, setChecking] = useState(false);
  const [updaterOpen, setUpdaterOpen] = useState(false);
  const toast = useToast();

  async function checkVersion() {
    setChecking(true);
    try {
      const v = await api.get('/updates/version');
      setVersion(v);
    } catch (e) {
      toast.error('Version check failed', e.message);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => { checkVersion(); }, []);

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-neutral-400 mt-1">System maintenance &amp; updates.</p>
      </header>

      {/* Account */}
      <section className="card">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">Account</h2>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <dt className="text-neutral-500">Username</dt>
          <dd className="col-span-2 font-mono">{user?.username}</dd>
          <dt className="text-neutral-500">Email</dt>
          <dd className="col-span-2 text-neutral-300">{user?.email || '—'}</dd>
          <dt className="text-neutral-500">Role</dt>
          <dd className="col-span-2"><span className="badge-muted">{user?.role}</span></dd>
        </dl>
      </section>

      {/* Updates */}
      <section className="card">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-brand-400" />
              Updates
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              SambaControl checks <code className="text-xs">marsh4200/ar-samba</code> on GitHub for new releases.
            </p>
          </div>
          <button className="btn-outline" onClick={checkVersion} disabled={checking}>
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            Check
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg bg-bg-soft border border-white/5 p-3">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500">Installed</div>
            <div className="text-lg font-mono mt-1">{version?.current || '—'}</div>
          </div>
          <div className="rounded-lg bg-bg-soft border border-white/5 p-3">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500">Latest on GitHub</div>
            <div className="text-lg font-mono mt-1">{version?.latest || '—'}</div>
          </div>
        </div>

        {version?.update_available ? (
          <div className="mt-4 rounded-lg border border-brand/30 bg-brand/10 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">Update available — v{version.latest}</div>
                {version.release_notes && (
                  <pre className="text-xs text-neutral-400 mt-2 whitespace-pre-wrap max-h-32 overflow-y-auto font-sans">
                    {version.release_notes}
                  </pre>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    className="btn-primary"
                    onClick={() => setUpdaterOpen(true)}
                    disabled={!isAdmin}
                    title={isAdmin ? '' : 'Only admins can install updates'}
                  >
                    <Download className="w-4 h-4" />
                    Update Now
                  </button>
                  {version.release_url && (
                    <a className="btn-ghost" href={version.release_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-4 h-4" />
                      Release notes
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : version ? (
          <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3 flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-success" />
            You're on the latest version.
          </div>
        ) : null}
      </section>

      <UpdaterModal open={updaterOpen} onOpenChange={setUpdaterOpen} target={version?.latest} onFinished={checkVersion} />
    </div>
  );
}

// --------------------------------------------------------------------------- Updater

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
      toast.error('Could not start update', e.message);
    } finally {
      setStarting(false);
    }
  }

  // Poll status while open and not finished
  useEffect(() => {
    if (!open) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    // Fetch current status on open
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
              toast.success('Update completed successfully');
              onFinished?.();
            } else {
              toast.error('Update failed', s.error || 'See log output for details.');
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
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [job?.logs?.length]);

  const isRunning = job?.state === 'running';
  const isDone = job?.state === 'success';
  const isError = job?.state === 'error';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && isRunning) return; onOpenChange(v); }}>
      <DialogContent
        className="!w-[min(720px,calc(100vw-2rem))]"
        title="Update SambaControl"
        description={target ? `Target version: v${target}` : 'Pull and install the latest release.'}
      >
        {!job && (
          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-bg-soft p-4 text-sm space-y-2">
              <p className="text-neutral-300">The updater will:</p>
              <ul className="list-disc list-inside text-neutral-400 text-xs space-y-1">
                <li>Snapshot the current install</li>
                <li>Download and extract the new release</li>
                <li>Install dependencies and run database migrations</li>
                <li>Restart services</li>
                <li>Automatically roll back if any step fails</li>
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => onOpenChange(false)}>Cancel</button>
              <button className="btn-primary" onClick={start} disabled={starting}>
                {starting ? <Spinner /> : <Download className="w-4 h-4" />}
                Start update
              </button>
            </div>
          </div>
        )}

        {job && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium flex items-center gap-2">
                  {isRunning && <Spinner className="text-brand-400" />}
                  {isDone && <CheckCircle2 className="w-4 h-4 text-success" />}
                  {isError && <AlertCircle className="w-4 h-4 text-danger" />}
                  {job.step || 'Working...'}
                </div>
                <div className="text-xs text-neutral-500 font-mono">{job.progress}%</div>
              </div>
              <Progress value={job.progress} animated={isRunning} tone={isError ? 'danger' : isDone ? 'success' : 'brand'} />
            </div>

            <div className="rounded-lg border border-white/5 bg-black/40 p-3 font-mono text-[11px] text-neutral-300 h-64 overflow-y-auto">
              {job.logs?.length ? job.logs.map((l, i) => (
                <div key={i} className={l.startsWith('[ERROR]') || l.startsWith('[error]') ? 'text-danger' :
                                          l.startsWith('==>') ? 'text-brand-400' : ''}>
                  {l}
                </div>
              )) : <div className="text-neutral-500 italic">waiting for output...</div>}
              <div ref={logEndRef} />
            </div>

            {isError && (
              <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm">
                <div className="font-medium text-danger flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Update failed — rolling back
                </div>
                {job.error && <pre className="text-xs text-neutral-400 mt-2 whitespace-pre-wrap">{job.error}</pre>}
              </div>
            )}

            {isDone && (
              <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Update completed successfully — reload the page to see the new version.
              </div>
            )}

            <div className="flex justify-end gap-2">
              {!isRunning && (
                <button className="btn-ghost" onClick={() => { setJob(null); onOpenChange(false); }}>
                  Close
                </button>
              )}
              {isDone && (
                <button className="btn-primary" onClick={() => window.location.reload()}>
                  <RefreshCw className="w-4 h-4" />
                  Reload page
                </button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
