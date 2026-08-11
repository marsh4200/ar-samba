import { useEffect, useMemo, useState } from 'react';
import {
  UserPlus, Trash2, KeyRound, Users as UsersIcon, RefreshCw, Search,
  MoreHorizontal, AlertTriangle, Check, ShieldOff, ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { formatDateShort, relativeTime, initials, toneForName } from '@/lib/utils';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { StatusDot } from '@/components/ui/Badge';
import { Field, Input, InputWithIcon, PasswordInput } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { Segmented } from '@/components/ui/Segmented';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TableWrap, THead, TBody, TH, TR, TD, EmptyState } from '@/components/ui/Table';
import {
  DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator,
} from '@/components/ui/DropdownMenu';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [pwUser, setPwUser] = useState(null);
  const [delUser, setDelUser] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const toast = useToast();

  async function load() {
    try {
      setLoading(true);
      setUsers(await api.get('/users'));
    } catch (e) {
      toast.error('Could not load users', e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function toggleEnabled(u) {
    setBusyId(u.id);
    try {
      const updated = await api.patch(`/users/${u.id}`, { enabled: !u.enabled });
      setUsers((cur) => cur.map((x) => (x.id === u.id ? updated : x)));
      toast.success(
        updated.enabled ? 'User enabled' : 'User disabled',
        updated.enabled
          ? `${u.username} can sign in to shares again.`
          : `${u.username} can no longer connect.`,
      );
    } catch (e) {
      toast.error('Could not update user', e.message);
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => ({
    all: users.length,
    enabled: users.filter((u) => u.enabled).length,
    disabled: users.filter((u) => !u.enabled).length,
  }), [users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (status === 'enabled' && !u.enabled) return false;
      if (status === 'disabled' && u.enabled) return false;
      if (!q) return true;
      return [u.username, u.display_name].filter(Boolean).some((v) => v.toLowerCase().includes(q));
    });
  }, [users, query, status]);

  return (
    <div className="space-y-6 stagger">
      <PageHeader
        title="Users"
        description="Accounts that connect to shares. They have no shell and no SSH access — Samba only."
        actions={
          <>
            <Button variant="outline" icon={RefreshCw} onClick={load} disabled={loading}>
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="primary" icon={UserPlus} onClick={() => setCreateOpen(true)}>
              New user
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line/60 p-4 lg:flex-row lg:items-center lg:justify-between">
          <InputWithIcon
            icon={Search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users"
            className="lg:max-w-xs"
            aria-label="Search users"
          />
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all',      label: 'All',      count: counts.all },
              { value: 'enabled',  label: 'Enabled',  count: counts.enabled },
              { value: 'disabled', label: 'Disabled', count: counts.disabled },
            ]}
          />
        </div>

        <CardBody flush>
          {loading ? (
            <SkeletonRows rows={4} cols={5} />
          ) : users.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title="No users yet"
              description="Create an account for each person or machine that needs to reach your shares."
              action={
                <Button variant="primary" icon={UserPlus} onClick={() => setCreateOpen(true)}>
                  New user
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches"
              description="No users match the current search and filter."
              action={
                <Button variant="outline" onClick={() => { setQuery(''); setStatus('all'); }}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
            {/* Phones: one card per user rather than a sideways-scrolling table. */}
            <ul className="divide-y divide-line/50 md:hidden">
              {filtered.map((u) => (
                <li key={u.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border font-display text-xs font-bold ${toneForName(u.username)}`}>
                      {initials(u.username)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-xs font-medium text-ink">
                        {u.username}
                      </div>
                      <div className="mt-0.5 truncate text-2xs text-ink-faint">
                        {u.display_name || 'No display name'}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.username}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownTrigger>
                      <DropdownContent>
                        <DropdownItem icon={KeyRound} onSelect={() => setPwUser(u)}>
                          Set password
                        </DropdownItem>
                        <DropdownItem
                          icon={u.enabled ? ShieldOff : ShieldCheck}
                          onSelect={() => toggleEnabled(u)}
                        >
                          {u.enabled ? 'Disable user' : 'Enable user'}
                        </DropdownItem>
                        <DropdownSeparator />
                        <DropdownItem icon={Trash2} tone="danger" onSelect={() => setDelUser(u)}>
                          Delete user
                        </DropdownItem>
                      </DropdownContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-line/60 bg-abyss/40 px-3 py-2.5">
                    <span className="inline-flex items-center gap-2 text-2xs font-medium">
                      <StatusDot tone={u.enabled ? 'ok' : 'neutral'} />
                      <span className={u.enabled ? 'text-ok' : 'text-ink-faint'}>
                        {u.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </span>
                    <Switch
                      id={`m-u-${u.id}`}
                      size="sm"
                      checked={u.enabled}
                      disabled={busyId === u.id}
                      onCheckedChange={() => toggleEnabled(u)}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    icon={KeyRound}
                    block
                    className="mt-3"
                    onClick={() => setPwUser(u)}
                  >
                    Set password
                  </Button>
                </li>
              ))}
            </ul>

            <div className="hidden md:block">
            <TableWrap>
              <THead>
                <tr>
                  <TH>User</TH>
                  <TH>Status</TH>
                  <TH className="hidden lg:table-cell">Created</TH>
                  <TH align="right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {filtered.map((u) => (
                  <TR key={u.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border font-display text-xs font-bold ${toneForName(u.username)}`}>
                          {initials(u.username)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-mono text-xs font-medium text-ink">
                            {u.username}
                          </div>
                          <div className="mt-0.5 truncate text-2xs text-ink-faint">
                            {u.display_name || 'No display name'}
                          </div>
                        </div>
                      </div>
                    </TD>

                    <TD>
                      <div className="flex items-center gap-3">
                        <Switch
                          id={`u-${u.id}`}
                          size="sm"
                          checked={u.enabled}
                          disabled={busyId === u.id}
                          onCheckedChange={() => toggleEnabled(u)}
                        />
                        <span className="inline-flex items-center gap-1.5 text-2xs font-medium">
                          <StatusDot tone={u.enabled ? 'ok' : 'neutral'} />
                          <span className={u.enabled ? 'text-ok' : 'text-ink-faint'}>
                            {u.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </span>
                      </div>
                    </TD>

                    <TD className="hidden lg:table-cell">
                      <div className="whitespace-nowrap">
                        <div className="text-2xs text-ink-faint">{formatDateShort(u.created_at)}</div>
                        <div className="mt-0.5 text-2xs text-ink-ghost">{relativeTime(u.created_at)}</div>
                      </div>
                    </TD>

                    <TD align="right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={KeyRound}
                          onClick={() => setPwUser(u)}
                          className="hidden md:inline-flex"
                        >
                          Set password
                        </Button>

                        <DropdownMenu>
                          <DropdownTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.username}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownTrigger>
                          <DropdownContent>
                            <DropdownItem icon={KeyRound} onSelect={() => setPwUser(u)}>
                              Set password
                            </DropdownItem>
                            <DropdownItem
                              icon={u.enabled ? ShieldOff : ShieldCheck}
                              onSelect={() => toggleEnabled(u)}
                            >
                              {u.enabled ? 'Disable user' : 'Enable user'}
                            </DropdownItem>
                            <DropdownSeparator />
                            <DropdownItem icon={Trash2} tone="danger" onSelect={() => setDelUser(u)}>
                              Delete user
                            </DropdownItem>
                          </DropdownContent>
                        </DropdownMenu>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
            </div>
            </>
          )}
        </CardBody>
      </Card>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(u) =>
          setUsers((c) => [...c, u].sort((a, b) => a.username.localeCompare(b.username)))}
      />
      <ResetPasswordDialog user={pwUser} onClose={() => setPwUser(null)} />
      <DeleteUserDialog
        user={delUser}
        onClose={() => setDelUser(null)}
        onDeleted={(id) => setUsers((c) => c.filter((u) => u.id !== id))}
      />
    </div>
  );
}

/* ─── Create ────────────────────────────────────────────────────────── */

const BLANK = { username: '', display_name: '', password: '', confirm: '' };

function CreateUserDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const reset = () => setForm(BLANK);

  const mismatch = !!form.confirm && form.password !== form.confirm;
  const valid = form.username.trim() && form.password.length >= 6 && form.password === form.confirm;

  async function submit(e) {
    e?.preventDefault?.();
    if (!valid) return;
    setBusy(true);
    try {
      const u = await api.post('/users', {
        username: form.username.trim(),
        display_name: form.display_name.trim() || null,
        password: form.password,
      });
      toast.success('User created', `${u.username} can now be given access to shares.`);
      onCreated(u);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error('Could not create user', err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent
        icon={UserPlus}
        title="New user"
        description="Creates a Samba account backed by a no-shell Linux user."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="primary" icon={UserPlus} loading={busy} disabled={!valid} onClick={submit}>
              Create user
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <Field
            label="Username"
            htmlFor="user-name"
            required
            hint="Lowercase letters, digits, underscore and hyphen. Up to 32 characters."
          >
            <Input
              id="user-name"
              data-autofocus
              mono
              required
              spellCheck={false}
              autoComplete="off"
              placeholder="raymond"
              pattern="^[a-z_][a-z0-9_-]{0,31}$"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
            />
          </Field>

          <Field label="Display name" htmlFor="user-display" hint="Optional. Helps identify who this account belongs to.">
            <Input
              id="user-display"
              placeholder="Raymond Marsh"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password" htmlFor="user-pw" required hint="At least 6 characters.">
              <PasswordInput
                id="user-pw"
                required
                minLength={6}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Field
              label="Confirm password"
              htmlFor="user-pw2"
              required
              error={mismatch ? 'Passwords do not match.' : null}
            >
              <PasswordInput
                id="user-pw2"
                required
                minLength={6}
                autoComplete="new-password"
                invalid={mismatch}
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              />
            </Field>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-line/70 bg-hull/50 px-4 py-3">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
            <p className="text-2xs leading-relaxed text-ink-faint">
              After creating the user, open a share&rsquo;s permissions to give them access.
            </p>
          </div>

          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Set password ──────────────────────────────────────────────────── */

function ResetPasswordDialog({ user, onClose }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => { if (user) { setPw(''); setConfirm(''); } }, [user]);

  const mismatch = !!confirm && pw !== confirm;
  const valid = pw.length >= 6 && pw === confirm;

  async function submit(e) {
    e?.preventDefault?.();
    if (!valid) return;
    setBusy(true);
    try {
      await api.post(`/users/${user.id}/password`, { password: pw });
      toast.success('Password set', `${user.username} must use the new password from now on.`);
      onClose();
    } catch (e2) {
      toast.error('Could not set password', e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        size="sm"
        icon={KeyRound}
        title={user ? `Set password for ${user.username}` : 'Set password'}
        description="Takes effect immediately. Anyone connected with the old password will be asked to sign in again."
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" icon={KeyRound} loading={busy} disabled={!valid} onClick={submit}>
              Set password
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" htmlFor="pw-new" required hint="At least 6 characters.">
            <PasswordInput
              id="pw-new"
              data-autofocus
              required
              minLength={6}
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
          </Field>
          <Field
            label="Confirm password"
            htmlFor="pw-confirm"
            required
            error={mismatch ? 'Passwords do not match.' : null}
          >
            <PasswordInput
              id="pw-confirm"
              required
              minLength={6}
              autoComplete="new-password"
              invalid={mismatch}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Delete ────────────────────────────────────────────────────────── */

function DeleteUserDialog({ user, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function confirm() {
    setBusy(true);
    try {
      await api.del(`/users/${user.id}`);
      toast.success('User deleted', `${user.username} no longer exists on this server.`);
      onDeleted(user.id);
      onClose();
    } catch (e) {
      toast.error('Could not delete user', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        size="sm"
        tone="danger"
        icon={AlertTriangle}
        title={user ? `Delete ${user.username}?` : 'Delete user?'}
        description="This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="danger" icon={Trash2} loading={busy} onClick={confirm}>
              Delete user
            </Button>
          </>
        }
      >
        <ul className="space-y-2.5 rounded-xl border border-crit/25 bg-crit/[.07] px-4 py-3.5">
          {[
            'The Samba account and its Linux user are removed.',
            'Every permission they hold on managed shares is revoked.',
            'Files they created stay on disk, owned by a numeric ID.',
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-crit" />
              <span className="text-2xs leading-relaxed text-ink-muted">{t}</span>
            </li>
          ))}
        </ul>
        {user?.enabled && (
          <p className="hint mt-3">
            Prefer to keep the account? Disable it instead — access stops, the user stays.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
