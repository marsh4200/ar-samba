import { useEffect, useMemo, useState } from 'react';
import {
  ScanSearch, RefreshCw, Download, FolderTree, Users as UsersIcon,
  AlertTriangle, CheckCircle2, XCircle, MinusCircle, Inbox, Lock, Unlock, UserRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PanelLoader } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/Table';

const RESULT_TONE = {
  imported: { tone: 'ok', icon: CheckCircle2, label: 'Imported' },
  skipped: { tone: 'neutral', icon: MinusCircle, label: 'Skipped' },
  error: { tone: 'crit', icon: XCircle, label: 'Failed' },
};

function ResultRow({ item }) {
  const meta = RESULT_TONE[item.status] || RESULT_TONE.skipped;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Badge tone={meta.tone} icon={meta.icon} className="mt-0.5 shrink-0">{meta.label}</Badge>
      <div className="min-w-0">
        <div className="truncate font-mono text-xs font-medium text-ink">{item.name}</div>
        {item.detail && (
          <div className="mt-0.5 text-2xs leading-relaxed text-ink-faint">{item.detail}</div>
        )}
      </div>
    </li>
  );
}

export default function ImportPage() {
  const [loading, setLoading] = useState(true);
  const [scan, setScan] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState(() => new Set());
  const [selectedShares, setSelectedShares] = useState(() => new Set());
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const toast = useToast();

  async function runScan({ silent = false } = {}) {
    setLoading(true);
    try {
      const result = await api.get('/discovery/scan');
      setScan(result);
      setSelectedUsers(new Set(result.users.map((u) => u.username)));
      setSelectedShares(new Set(result.shares.map((s) => s.name)));
      if (!silent) {
        const total = result.users.length + result.shares.length;
        if (total > 0) {
          toast.info(
            'Found existing Samba config',
            `${result.users.length} user(s) and ${result.shares.length} share(s) aren't managed here yet.`,
          );
        }
      }
    } catch (e) {
      toast.error('Scan failed', e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { runScan({ silent: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(set, setSet, key) {
    setSet((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const totalSelected = selectedUsers.size + selectedShares.size;
  const hasFindings = !!scan && (scan.users.length > 0 || scan.shares.length > 0);
  const nothingFound = !!scan && !hasFindings && !scan.users_error && !scan.shares_error;

  async function doImport() {
    setImporting(true);
    try {
      const result = await api.post('/discovery/import', {
        usernames: [...selectedUsers],
        share_names: [...selectedShares],
      });
      setLastResult(result);
      const imported = [...result.users, ...result.shares].filter((r) => r.status === 'imported').length;
      const failed = [...result.users, ...result.shares].filter((r) => r.status === 'error').length;
      if (imported > 0) {
        toast.success('Import complete', `Brought ${imported} item(s) under management.${failed ? ` ${failed} failed.` : ''}`);
      } else if (failed > 0) {
        toast.error('Import failed', `${failed} item(s) could not be imported.`);
      } else {
        toast.info('Nothing imported', 'Everything selected was already tracked or no longer found.');
      }
      await runScan({ silent: true });
    } catch (e) {
      toast.error('Import failed', e.message);
    } finally {
      setImporting(false);
    }
  }

  const allUsersSelected = useMemo(
    () => !!scan && scan.users.length > 0 && scan.users.every((u) => selectedUsers.has(u.username)),
    [scan, selectedUsers],
  );
  const allSharesSelected = useMemo(
    () => !!scan && scan.shares.length > 0 && scan.shares.every((s) => selectedShares.has(s.name)),
    [scan, selectedShares],
  );

  return (
    <div className="space-y-6 stagger">
      <PageHeader
        title="Import existing config"
        description="If Samba was set up by hand — smb.conf edited over SSH, users added with smbpasswd — those shares and accounts won't show up on the Shares or Users pages yet. Scan to find them and bring them under management here."
        actions={
          <Button variant="outline" icon={RefreshCw} onClick={() => runScan()} loading={loading}>
            <span className="hidden sm:inline">Scan again</span>
          </Button>
        }
      />

      {(scan?.shares_error || scan?.users_error) && (
        <Card className="border-warn/25 bg-warn/5">
          <CardBody className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
            <div className="text-xs leading-relaxed text-ink-muted">
              {scan.shares_error && <p>Couldn't scan shares: {scan.shares_error}</p>}
              {scan.users_error && <p>Couldn't scan users: {scan.users_error}</p>}
            </div>
          </CardBody>
        </Card>
      )}

      {loading && !scan ? (
        <Card><PanelLoader label="Scanning smb.conf and the Samba password database…" /></Card>
      ) : nothingFound ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title="Nothing to import"
            description="Every share and Samba user this server currently knows about is already tracked here."
          />
        </Card>
      ) : hasFindings ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Users */}
            <Card>
              <CardHeader
                icon={UsersIcon}
                title={`Unmanaged users (${scan.users.length})`}
                description="Existing Samba accounts — their passwords are left exactly as they are."
                action={scan.users.length > 0 && (
                  <button
                    type="button"
                    className="text-2xs font-medium text-signal-400 hover:text-signal-300"
                    onClick={() => setSelectedUsers(allUsersSelected ? new Set() : new Set(scan.users.map((u) => u.username)))}
                  >
                    {allUsersSelected ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              />
              <CardBody flush>
                {scan.users.length === 0 ? (
                  <EmptyState icon={UsersIcon} title="No unmanaged users found" className="!py-10" />
                ) : (
                  <ul className="divide-y divide-line/50">
                    {scan.users.map((u) => (
                      <li key={u.username} className="flex items-center gap-3 px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 rounded border-line bg-raised accent-signal-500"
                          checked={selectedUsers.has(u.username)}
                          onChange={() => toggle(selectedUsers, setSelectedUsers, u.username)}
                          aria-label={`Import ${u.username}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-xs font-medium text-ink">{u.username}</div>
                          {u.display_name && (
                            <div className="mt-0.5 truncate text-2xs text-ink-faint">{u.display_name}</div>
                          )}
                        </div>
                        {!u.enabled && <Badge tone="warn">Disabled</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            {/* Shares */}
            <Card>
              <CardHeader
                icon={FolderTree}
                title={`Unmanaged shares (${scan.shares.length})`}
                description="Folders already published over SMB — their files and permissions are left untouched."
                action={scan.shares.length > 0 && (
                  <button
                    type="button"
                    className="text-2xs font-medium text-signal-400 hover:text-signal-300"
                    onClick={() => setSelectedShares(allSharesSelected ? new Set() : new Set(scan.shares.map((s) => s.name)))}
                  >
                    {allSharesSelected ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              />
              <CardBody flush>
                {scan.shares.length === 0 ? (
                  <EmptyState icon={FolderTree} title="No unmanaged shares found" className="!py-10" />
                ) : (
                  <ul className="divide-y divide-line/50">
                    {scan.shares.map((s) => (
                      <li key={s.name} className="flex items-start gap-3 px-4 py-3">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line bg-raised accent-signal-500"
                          checked={selectedShares.has(s.name)}
                          onChange={() => toggle(selectedShares, setSelectedShares, s.name)}
                          aria-label={`Import ${s.name}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-xs font-medium text-ink">{s.name}</div>
                          <div className="mt-0.5 truncate font-mono text-2xs text-ink-faint" title={s.path}>
                            {s.path}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge tone={s.read_only ? 'neutral' : 'ok'} icon={s.read_only ? Lock : Unlock}>
                              {s.read_only ? 'Read only' : 'Writable'}
                            </Badge>
                            {s.guest_ok && <Badge tone="warn" icon={UserRound}>Guest access</Badge>}
                            {s.valid_users.length > 0 && (
                              <Badge tone="outline">{s.valid_users.length} user(s) listed</Badge>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardFooter className="!justify-between">
              <div className="text-2xs text-ink-faint">
                {totalSelected === 0 ? 'Nothing selected' : `${totalSelected} item(s) selected`}
              </div>
              <Button
                variant="primary"
                icon={Download}
                loading={importing}
                disabled={totalSelected === 0}
                onClick={doImport}
              >
                Import selected
              </Button>
            </CardFooter>
          </Card>
        </>
      ) : null}

      {lastResult && (lastResult.users.length > 0 || lastResult.shares.length > 0) && (
        <Card>
          <CardHeader icon={ScanSearch} title="Last import" description="What happened with each item you selected." />
          <CardBody flush>
            <ul className="divide-y divide-line/50">
              {[...lastResult.users, ...lastResult.shares].map((item) => (
                <ResultRow key={item.name} item={item} />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
