import { useEffect, useState } from 'react';
import {
  UserPlus, Trash2, KeyRound, Power, Users as UsersIcon, RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/ui/Spinner';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Switch } from '@/components/ui/Switch';
import { formatDate } from '@/lib/utils';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [pwUser, setPwUser] = useState(null);
  const [delUser, setDelUser] = useState(null);
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
    try {
      const updated = await api.patch(`/users/${u.id}`, { enabled: !u.enabled });
      setUsers((cur) => cur.map((x) => (x.id === u.id ? updated : x)));
      toast.success(`User ${updated.enabled ? 'enabled' : 'disabled'}`, u.username);
    } catch (e) {
      toast.error('Update failed', e.message);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Samba Users</h1>
          <p className="text-sm text-neutral-400 mt-1">
            These are no-shell, no-SSH Linux accounts used only by Samba.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
            <UserPlus className="w-4 h-4" />
            New User
          </button>
        </div>
      </header>

      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Spinner className="w-5 h-5 text-brand-400" /></div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-neutral-500">
            <UsersIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <div className="text-sm">No Samba users yet.</div>
            <div className="text-xs mt-1">Click <strong>New User</strong> above to create one.</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-bg-soft/60 text-neutral-400">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Username</th>
                <th className="px-4 py-3 font-medium">Display name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="table-row">
                  <td className="px-4 py-3 font-mono text-neutral-200">{u.username}</td>
                  <td className="px-4 py-3 text-neutral-400">{u.display_name || '—'}</td>
                  <td className="px-4 py-3">
                    <Switch
                      id={`u-${u.id}`}
                      checked={u.enabled}
                      onCheckedChange={() => toggleEnabled(u)}
                      label={u.enabled ? <span className="text-success">Enabled</span> : <span className="text-neutral-500">Disabled</span>}
                    />
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        className="btn-ghost !px-2 !py-1"
                        title="Reset password"
                        onClick={() => setPwUser(u)}
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        className="btn-ghost !px-2 !py-1 hover:!text-danger"
                        title="Delete"
                        onClick={() => setDelUser(u)}
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

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(u) => { setUsers((c) => [...c, u].sort((a, b) => a.username.localeCompare(b.username))); }}
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

// --------------------------------------------------------------------------- Create

function CreateUserDialog({ open, onOpenChange, onCreated }) {
  const [form, setForm] = useState({ username: '', display_name: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  function reset() { setForm({ username: '', display_name: '', password: '', confirm: '' }); }

  async function submit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const u = await api.post('/users', {
        username: form.username.trim(),
        display_name: form.display_name.trim() || null,
        password: form.password,
      });
      toast.success('User created', u.username);
      onCreated(u);
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
      <DialogContent title="Create Samba user"
                     description="A no-shell Linux account will be created and added to Samba.">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Username</label>
            <input
              autoFocus
              className="input font-mono"
              placeholder="raymond"
              pattern="^[a-z_][a-z0-9_-]{0,31}$"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
            />
            <div className="text-[11px] text-neutral-500 mt-1">
              Lowercase. Letters, digits, <code>_</code>, <code>-</code>. Max 32 chars.
            </div>
          </div>
          <div>
            <label className="label">Display name (optional)</label>
            <input
              className="input"
              placeholder="Raymond Marsh"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Confirm</label>
              <input
                type="password"
                className="input"
                required
                minLength={6}
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => onOpenChange(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Spinner /> : <UserPlus className="w-4 h-4" />}
              Create user
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------- Reset PW

function ResetPasswordDialog({ user, onClose }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit(e) {
    e.preventDefault();
    if (pw !== confirm) { toast.error('Passwords do not match'); return; }
    setBusy(true);
    try {
      await api.post(`/users/${user.id}/password`, { password: pw });
      toast.success('Password reset', user.username);
      setPw(''); setConfirm('');
      onClose();
    } catch (e) {
      toast.error('Reset failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        title={`Reset password — ${user?.username || ''}`}
        description="The new password takes effect immediately for this Samba user."
      >
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">New password</label>
            <input
              type="password" className="input" autoFocus required minLength={6}
              value={pw} onChange={(e) => setPw(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Confirm</label>
            <input
              type="password" className="input" required minLength={6}
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Spinner /> : <KeyRound className="w-4 h-4" />}
              Update password
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------- Delete

function DeleteUserDialog({ user, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function confirm() {
    setBusy(true);
    try {
      await api.del(`/users/${user.id}`);
      toast.success('User deleted', user.username);
      onDeleted(user.id);
      onClose();
    } catch (e) {
      toast.error('Delete failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        title={`Delete user "${user?.username || ''}"?`}
        description="Removes the Samba user, the Linux account, and all ACLs they hold on managed shares. This cannot be undone."
      >
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-danger" onClick={confirm} disabled={busy}>
            {busy ? <Spinner /> : <Trash2 className="w-4 h-4" />}
            Permanently delete
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
