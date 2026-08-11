import { useEffect, useMemo, useState } from 'react';
import {
  FolderPlus, FolderTree, Trash2, Settings2, RefreshCw, ShieldCheck, Search,
  MoreHorizontal, Lock, Unlock, EyeOff, Eye, UserRound, Users as UsersIcon,
  AlertTriangle, Check, Plus,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { formatDateShort, relativeTime, initials, toneForName } from '@/lib/utils';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, InputWithIcon, Select } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Spinner, PanelLoader } from '@/components/ui/Spinner';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TableWrap, THead, TBody, TH, TR, TD, EmptyState } from '@/components/ui/Table';
import {
  DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator,
} from '@/components/ui/DropdownMenu';

export default function SharesPage() {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editShare, setEditShare] = useState(null);
  const [delShare, setDelShare] = useState(null);
  const [aclShare, setAclShare] = useState(null);
  const toast = useToast();

  async function load() {
    try {
      setLoading(true);
      setShares(await api.get('/shares'));
    } catch (e) {
      toast.error('Could not load shares', e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shares;
    return shares.filter((s) =>
      [s.name, s.path, s.comment].filter(Boolean).some((v) => v.toLowerCase().includes(q)),
    );
  }, [shares, query]);

  return (
    <div className="space-y-6 stagger">
      <PageHeader
        title="Shares"
        description="Folders published over SMB. Saving a change rewrites the Samba config, validates it, and reloads the service."
        actions={
          <>
            <Button variant="outline" icon={RefreshCw} onClick={load} disabled={loading}>
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="primary" icon={FolderPlus} onClick={() => setCreateOpen(true)}>
              New share
            </Button>
          </>
        }
      />

      <Card>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-line/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <InputWithIcon
            icon={Search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shares"
            className="sm:max-w-xs"
            aria-label="Search shares"
          />
          <div className="text-2xs text-ink-faint">
            {loading
              ? 'Loading'
              : `${filtered.length}${filtered.length !== shares.length ? ` of ${shares.length}` : ''} ${shares.length === 1 ? 'share' : 'shares'}`}
          </div>
        </div>

        <CardBody flush>
          {loading ? (
            <SkeletonRows rows={4} cols={5} />
          ) : shares.length === 0 ? (
            <EmptyState
              icon={FolderTree}
              title="No shares yet"
              description="A share publishes a folder on this server to your network. Create one to get started."
              action={
                <Button variant="primary" icon={FolderPlus} onClick={() => setCreateOpen(true)}>
                  New share
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches"
              description={`Nothing matches "${query}". Try a shorter search.`}
              action={<Button variant="outline" onClick={() => setQuery('')}>Clear search</Button>}
            />
          ) : (
            <>
            {/* Phones: one card per share. A 5-column table can't be read on
                a 390px screen without sideways scrolling. */}
            <ul className="divide-y divide-line/50 md:hidden">
              {filtered.map((s) => (
                <li key={s.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-signal-500/25 bg-signal-500/10 text-signal-300">
                      <FolderTree className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-xs font-medium text-ink">{s.name}</div>
                      <div className="mt-0.5 truncate text-2xs text-ink-faint">
                        {s.comment || 'No description'}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.name}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownTrigger>
                      <DropdownContent>
                        <DropdownItem icon={ShieldCheck} onSelect={() => setAclShare(s)}>
                          Permissions
                        </DropdownItem>
                        <DropdownItem icon={Settings2} onSelect={() => setEditShare(s)}>
                          Edit share
                        </DropdownItem>
                        <DropdownSeparator />
                        <DropdownItem icon={Trash2} tone="danger" onSelect={() => setDelShare(s)}>
                          Delete share
                        </DropdownItem>
                      </DropdownContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3 break-all rounded-lg border border-line/60 bg-abyss/50 px-2.5 py-2 font-mono text-2xs text-ink-muted">
                    {s.path}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Badge tone={s.read_only ? 'neutral' : 'ok'} icon={s.read_only ? Lock : Unlock}>
                      {s.read_only ? 'Read only' : 'Writable'}
                    </Badge>
                    <Badge tone="outline" icon={s.browseable ? Eye : EyeOff}>
                      {s.browseable ? 'Visible' : 'Hidden'}
                    </Badge>
                    {s.guest_ok && <Badge tone="warn" icon={UserRound}>Guest access</Badge>}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    icon={ShieldCheck}
                    block
                    className="mt-3"
                    onClick={() => setAclShare(s)}
                  >
                    Permissions
                  </Button>
                </li>
              ))}
            </ul>

            <div className="hidden md:block">
            <TableWrap>
              <THead>
                <tr>
                  <TH>Share</TH>
                  <TH>Path</TH>
                  <TH>Access</TH>
                  <TH className="hidden lg:table-cell">Created</TH>
                  <TH align="right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {filtered.map((s) => (
                  <TR key={s.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-signal-500/25 bg-signal-500/10 text-signal-300">
                          <FolderTree className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-mono text-xs font-medium text-ink">
                            {s.name}
                          </div>
                          <div className="mt-0.5 truncate text-2xs text-ink-faint">
                            {s.comment || 'No description'}
                          </div>
                        </div>
                      </div>
                    </TD>

                    <TD>
                      <span className="block max-w-[34ch] truncate font-mono text-2xs text-ink-muted" title={s.path}>
                        {s.path}
                      </span>
                    </TD>

                    <TD>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={s.read_only ? 'neutral' : 'ok'} icon={s.read_only ? Lock : Unlock}>
                          {s.read_only ? 'Read only' : 'Writable'}
                        </Badge>
                        <Badge tone="outline" icon={s.browseable ? Eye : EyeOff}>
                          {s.browseable ? 'Visible' : 'Hidden'}
                        </Badge>
                        {s.guest_ok && (
                          <Badge tone="warn" icon={UserRound}>Guest access</Badge>
                        )}
                      </div>
                    </TD>

                    <TD className="hidden lg:table-cell">
                      <div className="whitespace-nowrap">
                        <div className="text-2xs text-ink-faint">{formatDateShort(s.created_at)}</div>
                        <div className="mt-0.5 text-2xs text-ink-ghost">{relativeTime(s.created_at)}</div>
                      </div>
                    </TD>

                    <TD align="right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={ShieldCheck}
                          onClick={() => setAclShare(s)}
                          className="hidden md:inline-flex"
                        >
                          Permissions
                        </Button>

                        <DropdownMenu>
                          <DropdownTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.name}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownTrigger>
                          <DropdownContent>
                            <DropdownItem icon={ShieldCheck} onSelect={() => setAclShare(s)}>
                              Permissions
                            </DropdownItem>
                            <DropdownItem icon={Settings2} onSelect={() => setEditShare(s)}>
                              Edit share
                            </DropdownItem>
                            <DropdownSeparator />
                            <DropdownItem icon={Trash2} tone="danger" onSelect={() => setDelShare(s)}>
                              Delete share
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

      <CreateShareDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(s) => setShares((c) => [...c, s].sort((a, b) => a.name.localeCompare(b.name)))}
      />
      <EditShareDialog
        share={editShare}
        onClose={() => setEditShare(null)}
        onUpdated={(s) => setShares((c) => c.map((x) => (x.id === s.id ? s : x)))}
      />
      <DeleteShareDialog
        share={delShare}
        onClose={() => setDelShare(null)}
        onDeleted={(id) => setShares((c) => c.filter((s) => s.id !== id))}
      />
      <AclDialog share={aclShare} onClose={() => setAclShare(null)} />
    </div>
  );
}

/* ─── Shared form controls ──────────────────────────────────────────── */

function ShareOptions({ form, setForm, idPrefix }) {
  return (
    <div className="space-y-1 rounded-xl border border-line/70 bg-hull/50 p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Switch
          id={`${idPrefix}-browseable`}
          checked={form.browseable}
          onCheckedChange={(v) => setForm({ ...form, browseable: v })}
          label="Show in network"
          description="Appears when browsing this server"
        />
        <Switch
          id={`${idPrefix}-readonly`}
          checked={form.read_only}
          onCheckedChange={(v) => setForm({ ...form, read_only: v })}
          label="Read only"
          description="Nobody can write, whatever their ACL"
        />
        <Switch
          id={`${idPrefix}-guest`}
          checked={form.guest_ok}
          onCheckedChange={(v) => setForm({ ...form, guest_ok: v })}
          label="Allow guests"
          description="Access without a password"
        />
      </div>

      {form.guest_ok && (
        <div className="!mt-4 flex items-start gap-2.5 rounded-lg border border-warn/25 bg-warn/10 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
          <p className="text-2xs leading-relaxed text-ink-muted">
            Guest access lets anyone on the network open this share without signing in.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Create ────────────────────────────────────────────────────────── */

const BLANK = {
  name: '', path: '', comment: '',
  browseable: true, read_only: false, guest_ok: false,
};

function CreateShareDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const reset = () => setForm(BLANK);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const s = await api.post('/shares', {
        name: form.name.trim(),
        path: form.path.trim() || form.name.trim(),
        comment: form.comment.trim() || null,
        browseable: form.browseable,
        read_only: form.read_only,
        guest_ok: form.guest_ok,
      });
      toast.success('Share created', `${s.name} is now published.`);
      onCreated(s);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error('Could not create share', err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent
        icon={FolderPlus}
        title="New share"
        description="The folder is created if it doesn't exist. Paths stay inside the configured shares root."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="primary"
              icon={FolderPlus}
              loading={busy}
              disabled={!form.name.trim()}
              onClick={submit}
            >
              Create share
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Share name"
              htmlFor="share-name"
              required
              hint="How it appears on the network."
            >
              <Input
                id="share-name"
                data-autofocus
                mono
                required
                spellCheck={false}
                placeholder="workshop-drop"
                pattern="^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>

            <Field
              label="Folder path"
              htmlFor="share-path"
              hint="Leave blank to use the share name."
            >
              <Input
                id="share-path"
                mono
                spellCheck={false}
                placeholder={form.name || 'workshop-drop'}
                value={form.path}
                onChange={(e) => setForm({ ...form, path: e.target.value })}
              />
            </Field>
          </div>

          <Field
            label="Description"
            htmlFor="share-comment"
            hint="Shown to people browsing the server."
          >
            <Input
              id="share-comment"
              placeholder="Drop folder for the CNC machine"
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
            />
          </Field>

          <ShareOptions form={form} setForm={setForm} idPrefix="new" />
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Edit ──────────────────────────────────────────────────────────── */

function EditShareDialog({ share, onClose, onUpdated }) {
  const [form, setForm] = useState({ comment: '', browseable: true, read_only: false, guest_ok: false });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (share) {
      setForm({
        comment: share.comment || '',
        browseable: share.browseable,
        read_only: share.read_only,
        guest_ok: share.guest_ok,
      });
    }
  }, [share]);

  async function submit(e) {
    e?.preventDefault?.();
    setBusy(true);
    try {
      const s = await api.patch(`/shares/${share.id}`, {
        comment: form.comment.trim() || null,
        browseable: form.browseable,
        read_only: form.read_only,
        guest_ok: form.guest_ok,
      });
      toast.success('Share updated', `${s.name} saved and reloaded.`);
      onUpdated(s);
      onClose();
    } catch (err) {
      toast.error('Could not save share', err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!share} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        icon={Settings2}
        title={share ? `Edit ${share.name}` : 'Edit share'}
        description="Name and path are fixed once a share exists. Delete and recreate to change them."
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" icon={Check} loading={busy} onClick={submit}>
              Save changes
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="well px-4 py-3">
            <div className="eyebrow">Folder path</div>
            <div className="mt-1 break-all font-mono text-xs text-ink-muted">{share?.path}</div>
          </div>

          <Field label="Description" htmlFor="edit-comment">
            <Input
              id="edit-comment"
              data-autofocus
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder="What this share is for"
            />
          </Field>

          <ShareOptions form={form} setForm={setForm} idPrefix="edit" />
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Delete ────────────────────────────────────────────────────────── */

function DeleteShareDialog({ share, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function go() {
    setBusy(true);
    try {
      await api.del(`/shares/${share.id}`);
      toast.success('Share deleted', `${share.name} is no longer published.`);
      onDeleted(share.id);
      onClose();
    } catch (e) {
      toast.error('Could not delete share', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!share} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        size="sm"
        tone="danger"
        icon={AlertTriangle}
        title={share ? `Delete ${share.name}?` : 'Delete share?'}
        description="This unpublishes the share and removes every access grant on it."
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="danger" icon={Trash2} loading={busy} onClick={go}>
              Delete share
            </Button>
          </>
        }
      >
        <div className="rounded-xl border border-ok/25 bg-ok/10 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
            <p className="text-2xs leading-relaxed text-ink-muted">
              The folder and its files stay on disk. Only the Samba share is removed.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── ACL editor ────────────────────────────────────────────────────── */

const PERM_FIELDS = [
  { key: 'can_read',           label: 'Read' },
  { key: 'can_write',          label: 'Write' },
  { key: 'can_execute',        label: 'Browse folders' },
  { key: 'can_delete',         label: 'Delete' },
  { key: 'can_create_files',   label: 'Add files' },
  { key: 'can_create_folders', label: 'Add folders' },
];

const DEFAULT_PERMS = {
  can_read: true, can_write: false, can_execute: true, can_delete: false,
  can_create_files: false, can_create_folders: false,
  recursive: true, default_acl: true,
};

/**
 * Presets cover the three grants that actually get used. They only set the
 * existing permission flags — there's no separate concept stored anywhere.
 */
const PRESETS = [
  {
    id: 'read', label: 'Read only',
    perms: { can_read: true, can_write: false, can_execute: true, can_delete: false,
             can_create_files: false, can_create_folders: false },
  },
  {
    id: 'contribute', label: 'Add files',
    perms: { can_read: true, can_write: true, can_execute: true, can_delete: false,
             can_create_files: true, can_create_folders: true },
  },
  {
    id: 'full', label: 'Full control',
    perms: { can_read: true, can_write: true, can_execute: true, can_delete: true,
             can_create_files: true, can_create_folders: true },
  },
];

function matchPreset(grant) {
  return PRESETS.find((p) =>
    Object.entries(p.perms).every(([k, v]) => !!grant[k] === v),
  )?.id || 'custom';
}

function GrantCard({ grant, username, busy, onChange, onRevoke }) {
  const preset = matchPreset(grant);

  return (
    <div className="rounded-xl border border-line/70 bg-hull/40 transition-colors hover:border-line">
      <div className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border font-display text-2xs font-bold ${toneForName(username)}`}>
            {initials(username)}
          </span>
          <div className="min-w-0">
            <div className="truncate font-mono text-xs font-medium text-ink">{username}</div>
            <div className="mt-0.5 text-2xs text-ink-faint">
              {preset === 'custom' ? 'Custom permissions' : PRESETS.find((p) => p.id === preset)?.label}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {busy && <Spinner className="h-3.5 w-3.5 text-signal-400" />}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRevoke}
            disabled={busy}
            aria-label={`Remove ${username}`}
            className="hover:!text-crit"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={busy}
              onClick={() => onChange(p.perms)}
              className={`rounded-lg border px-2.5 py-1 text-2xs font-medium transition-colors ${
                preset === p.id
                  ? 'border-signal-500/40 bg-signal-500/15 text-signal-300'
                  : 'border-line bg-raised text-ink-faint hover:text-ink'
              } disabled:opacity-50`}
            >
              {p.label}
            </button>
          ))}
          {preset === 'custom' && <Badge tone="outline" className="self-center">Custom</Badge>}
        </div>

        {/* Individual permissions */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PERM_FIELDS.map((p) => (
            <Switch
              key={p.key}
              size="sm"
              id={`p-${grant.id}-${p.key}`}
              checked={!!grant[p.key]}
              onCheckedChange={(v) => onChange({ [p.key]: v })}
              disabled={busy}
              label={p.label}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-line/60 pt-3.5 sm:grid-cols-2">
          <Switch
            size="sm"
            id={`p-${grant.id}-rec`}
            checked={!!grant.recursive}
            onCheckedChange={(v) => onChange({ recursive: v })}
            disabled={busy}
            label="Apply to existing contents"
            description="Updates files already in the folder"
          />
          <Switch
            size="sm"
            id={`p-${grant.id}-def`}
            checked={!!grant.default_acl}
            onCheckedChange={(v) => onChange({ default_acl: v })}
            disabled={busy}
            label="Apply to new items"
            description="New files inherit these permissions"
          />
        </div>
      </div>
    </div>
  );
}

function AclDialog({ share, onClose }) {
  const [grants, setGrants] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState(null);
  const [pendingUserId, setPendingUserId] = useState('');
  const toast = useToast();

  // Fetch BOTH grants and the live user list each time this dialog opens, so
  // users created after the Shares page first loaded still show up.
  useEffect(() => {
    if (!share) { setGrants([]); setUsers([]); setPendingUserId(''); return; }
    (async () => {
      setLoading(true);
      try {
        const [g, u] = await Promise.all([
          api.get(`/shares/${share.id}/access`),
          api.get('/users'),
        ]);
        setGrants(g);
        setUsers(u);
      } catch (e) {
        toast.error('Could not load permissions', e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [share]);

  const grantedIds = useMemo(() => new Set(grants.map((g) => g.user_id)), [grants]);
  const availableUsers = useMemo(
    () => users.filter((u) => !grantedIds.has(u.id)),
    [users, grantedIds],
  );

  function userName(id) {
    return users.find((u) => u.id === id)?.username || `#${id}`;
  }

  async function persist(userId, payload) {
    setBusyUserId(userId);
    try {
      const updated = await api.put(`/shares/${share.id}/access`, { user_id: userId, ...payload });
      setGrants((cur) => {
        const exists = cur.find((g) => g.user_id === userId);
        if (exists) return cur.map((g) => (g.user_id === userId ? updated : g));
        return [...cur, updated];
      });
      toast.success('Permissions saved', userName(userId));
    } catch (e) {
      toast.error('Could not save permissions', e.message);
    } finally {
      setBusyUserId(null);
    }
  }

  async function addUser() {
    if (!pendingUserId) return;
    const id = parseInt(pendingUserId, 10);
    setPendingUserId('');
    await persist(id, DEFAULT_PERMS);
  }

  async function revoke(userId) {
    const name = userName(userId);
    setBusyUserId(userId);
    try {
      await api.del(`/shares/${share.id}/access/${userId}`);
      setGrants((cur) => cur.filter((g) => g.user_id !== userId));
      toast.success('Access removed', name);
    } catch (e) {
      toast.error('Could not remove access', e.message);
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <Dialog open={!!share} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        size="lg"
        icon={ShieldCheck}
        title={share ? `Who can use ${share.name}` : 'Permissions'}
        description="Permissions are written to the folder as POSIX ACLs. Changes save as you make them."
      >
        {/* Grant a user */}
        <div className="mb-5 rounded-xl border border-line/70 bg-hull/50 p-4">
          <div className="field-label">Give someone access</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={pendingUserId}
              onChange={(e) => setPendingUserId(e.target.value)}
              disabled={loading || availableUsers.length === 0}
              aria-label="Select a user to grant access"
            >
              <option value="">
                {availableUsers.length === 0
                  ? 'Everyone already has access'
                  : 'Choose a user'}
              </option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}{u.display_name ? ` — ${u.display_name}` : ''}
                </option>
              ))}
            </Select>
            <Button
              variant="primary"
              icon={Plus}
              onClick={addUser}
              disabled={!pendingUserId}
              className="sm:shrink-0"
            >
              Grant access
            </Button>
          </div>
          <p className="hint">New grants start as read only. Adjust them below.</p>
        </div>

        {loading ? (
          <PanelLoader label="Loading permissions" />
        ) : grants.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="Nobody has access yet"
            description="Choose a user above to let them open this share."
            className="!py-10"
          />
        ) : (
          <div className="space-y-3 pb-1">
            {grants.map((g) => (
              <GrantCard
                key={g.id}
                grant={g}
                username={userName(g.user_id)}
                busy={busyUserId === g.user_id}
                onChange={(patch) => persist(g.user_id, { ...g, ...patch })}
                onRevoke={() => revoke(g.user_id)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
