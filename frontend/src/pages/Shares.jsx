import { useEffect, useMemo, useState } from 'react';
import {
  FolderPlus, FolderTree, Trash2, Settings2, Users as UsersIcon, RefreshCw, ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/ui/Spinner';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Switch } from '@/components/ui/Switch';
import { formatDate } from '@/lib/utils';

export default function SharesPage() {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Shares</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Manage Samba shares. Every change re-renders <code className="text-xs">smb.conf</code>,
            validates it with <code className="text-xs">testparm</code>, and reloads the service.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
            <FolderPlus className="w-4 h-4" />
            New Share
          </button>
        </div>
      </header>

      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Spinner className="w-5 h-5 text-brand-400" /></div>
        ) : shares.length === 0 ? (
          <div className="p-10 text-center text-neutral-500">
            <FolderTree className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <div className="text-sm">No shares yet.</div>
            <div className="text-xs mt-1">Click <strong>New Share</strong> to create one.</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-bg-soft/60 text-neutral-400">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Path</th>
                <th className="px-4 py-3 font-medium">Flags</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shares.map((s) => (
                <tr key={s.id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="font-mono text-neutral-100">[{s.name}]</div>
                    {s.comment && <div className="text-xs text-neutral-500 mt-0.5">{s.comment}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-400 break-all">{s.path}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span className={s.read_only ? 'badge-muted' : 'badge-success'}>
                        {s.read_only ? 'read-only' : 'writable'}
                      </span>
                      {s.browseable ? <span className="badge-muted">browseable</span> : <span className="badge-muted">hidden</span>}
                      {s.guest_ok && <span className="badge-danger">guest</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">{formatDate(s.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        className="btn-ghost !px-2 !py-1"
                        title="Permissions / ACL"
                        onClick={() => setAclShare(s)}
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                      <button
                        className="btn-ghost !px-2 !py-1"
                        title="Edit"
                        onClick={() => setEditShare(s)}
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                      <button
                        className="btn-ghost !px-2 !py-1 hover:!text-danger"
                        title="Delete"
                        onClick={() => setDelShare(s)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
      <AclDialog
        share={aclShare}
        onClose={() => setAclShare(null)}
      />
    </div>
  );
}

// --------------------------------------------------------------------------- Create

function CreateShareDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState({
    name: '', path: '', comment: '',
    browseable: true, read_only: false, guest_ok: false,
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  function reset() {
    setForm({ name: '', path: '', comment: '', browseable: true, read_only: false, guest_ok: false });
  }

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
      toast.success('Share created', s.name);
      onCreated(s);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error('Create failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent
        title="Create share"
        description="A directory will be created if it doesn't exist. Paths are jailed inside the configured shares root."
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Share name</label>
              <input
                autoFocus className="input font-mono" placeholder="cncserver" required
                pattern="^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Path (relative or absolute)</label>
              <input
                className="input font-mono" placeholder="cncserver"
                value={form.path}
                onChange={(e) => setForm({ ...form, path: e.target.value })}
              />
              <div className="text-[11px] text-neutral-500 mt-1">Defaults to the share name.</div>
            </div>
          </div>
          <div>
            <label className="label">Comment</label>
            <input
              className="input"
              placeholder="CNC machine drop folder"
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <Switch id="brw" checked={form.browseable}
                    onCheckedChange={(v) => setForm({ ...form, browseable: v })}
                    label="Browseable" />
            <Switch id="ro" checked={form.read_only}
                    onCheckedChange={(v) => setForm({ ...form, read_only: v })}
                    label="Read-only" />
            <Switch id="go" checked={form.guest_ok}
                    onCheckedChange={(v) => setForm({ ...form, guest_ok: v })}
                    label="Guest OK" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => onOpenChange(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Spinner /> : <FolderPlus className="w-4 h-4" />}
              Create share
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------- Edit

function EditShareDialog({ share, onClose, onUpdated }) {
  const [form, setForm] = useState({ comment: '', browseable: true, read_only: false, guest_ok: false });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (share) setForm({
      comment: share.comment || '',
      browseable: share.browseable,
      read_only: share.read_only,
      guest_ok: share.guest_ok,
    });
  }, [share]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const s = await api.patch(`/shares/${share.id}`, {
        comment: form.comment.trim() || null,
        browseable: form.browseable,
        read_only: form.read_only,
        guest_ok: form.guest_ok,
      });
      toast.success('Share updated', s.name);
      onUpdated(s);
      onClose();
    } catch (e) {
      toast.error('Update failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!share} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent title={`Edit share — ${share?.name || ''}`}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Comment</label>
            <input
              className="input"
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Switch id="e-brw" checked={form.browseable}
                    onCheckedChange={(v) => setForm({ ...form, browseable: v })} label="Browseable" />
            <Switch id="e-ro" checked={form.read_only}
                    onCheckedChange={(v) => setForm({ ...form, read_only: v })} label="Read-only" />
            <Switch id="e-go" checked={form.guest_ok}
                    onCheckedChange={(v) => setForm({ ...form, guest_ok: v })} label="Guest OK" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Spinner /> : <Settings2 className="w-4 h-4" />}
              Save changes
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------- Delete

function DeleteShareDialog({ share, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function go() {
    setBusy(true);
    try {
      await api.del(`/shares/${share.id}`);
      toast.success('Share deleted', share.name);
      onDeleted(share.id);
      onClose();
    } catch (e) {
      toast.error('Delete failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!share} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        title={`Delete share "${share?.name || ''}"?`}
        description="Removes the share from Samba and all access grants. The directory on disk is NOT deleted."
      >
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-danger" onClick={go} disabled={busy}>
            {busy ? <Spinner /> : <Trash2 className="w-4 h-4" />}
            Delete share
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------- ACL editor

const PERM_FIELDS = [
  { key: 'can_read',           label: 'Read' },
  { key: 'can_write',          label: 'Write' },
  { key: 'can_execute',        label: 'Execute' },
  { key: 'can_delete',         label: 'Delete' },
  { key: 'can_create_files',   label: 'Create files' },
  { key: 'can_create_folders', label: 'Create folders' },
];

const DEFAULT_PERMS = {
  can_read: true, can_write: false, can_execute: true, can_delete: false,
  can_create_files: false, can_create_folders: false,
  recursive: true, default_acl: true,
};

function AclDialog({ share, onClose }) {
  const [grants, setGrants] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState(null);
  const [pendingUserId, setPendingUserId] = useState('');
  const toast = useToast();

  // Fetch BOTH grants and the live user list each time this dialog opens.
  // (Previously we used a stale prop from page-mount, which meant users
  // created after the Shares page first loaded didn't show up.)
  useEffect(() => {
    if (!share) { setGrants([]); setUsers([]); return; }
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

  async function persist(userId, payload) {
    setBusyUserId(userId);
    try {
      const updated = await api.put(`/shares/${share.id}/access`, { user_id: userId, ...payload });
      setGrants((cur) => {
        const exists = cur.find((g) => g.user_id === userId);
        if (exists) return cur.map((g) => (g.user_id === userId ? updated : g));
        return [...cur, updated];
      });
      toast.success('Permissions saved');
    } catch (e) {
      toast.error('Save failed', e.message);
    } finally {
      setBusyUserId(null);
    }
  }

  async function addUser() {
    if (!pendingUserId) return;
    const id = parseInt(pendingUserId, 10);
    await persist(id, DEFAULT_PERMS);
    setPendingUserId('');
  }

  async function revoke(userId, username) {
    setBusyUserId(userId);
    try {
      await api.del(`/shares/${share.id}/access/${userId}`);
      setGrants((cur) => cur.filter((g) => g.user_id !== userId));
      toast.success('Access revoked', username);
    } catch (e) {
      toast.error('Revoke failed', e.message);
    } finally {
      setBusyUserId(null);
    }
  }

  function userName(id) {
    return users.find((u) => u.id === id)?.username || `#${id}`;
  }

  return (
    <Dialog open={!!share} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="!w-[min(820px,calc(100vw-2rem))]"
        title={`Permissions — ${share?.name || ''}`}
        description="Per-user ACLs are applied via setfacl. Recursive + default ACL ensures inheritance for new files."
      >
        {/* Add user */}
        <div className="flex gap-2 mb-4">
          <select
            className="input"
            value={pendingUserId}
            onChange={(e) => setPendingUserId(e.target.value)}
          >
            <option value="">— select user to grant —</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.username}</option>
            ))}
          </select>
          <button className="btn-primary" onClick={addUser} disabled={!pendingUserId}>
            <UsersIcon className="w-4 h-4" />
            Grant
          </button>
        </div>

        {/* Grants list */}
        {loading ? (
          <div className="py-10 flex justify-center"><Spinner /></div>
        ) : grants.length === 0 ? (
          <div className="py-8 text-center text-sm text-neutral-500">
            No users granted access to this share yet.
          </div>
        ) : (
          <div className="space-y-3">
            {grants.map((g) => (
              <div key={g.id} className="rounded-lg border border-white/5 bg-bg-soft p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-mono text-sm">{userName(g.user_id)}</div>
                  <button
                    className="btn-ghost !px-2 !py-1 hover:!text-danger text-xs"
                    onClick={() => revoke(g.user_id, userName(g.user_id))}
                    disabled={busyUserId === g.user_id}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Revoke
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PERM_FIELDS.map((p) => (
                    <Switch
                      key={p.key}
                      id={`p-${g.id}-${p.key}`}
                      checked={!!g[p.key]}
                      onCheckedChange={(v) => persist(g.user_id, { ...g, [p.key]: v })}
                      disabled={busyUserId === g.user_id}
                      label={<span className="text-xs">{p.label}</span>}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/5">
                  <Switch
                    id={`p-${g.id}-rec`}
                    checked={!!g.recursive}
                    onCheckedChange={(v) => persist(g.user_id, { ...g, recursive: v })}
                    disabled={busyUserId === g.user_id}
                    label={<span className="text-xs text-neutral-400">Apply recursively</span>}
                  />
                  <Switch
                    id={`p-${g.id}-def`}
                    checked={!!g.default_acl}
                    onCheckedChange={(v) => persist(g.user_id, { ...g, default_acl: v })}
                    disabled={busyUserId === g.user_id}
                    label={<span className="text-xs text-neutral-400">Default ACL (inherit)</span>}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
