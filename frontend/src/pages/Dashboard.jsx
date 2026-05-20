import { useEffect, useState } from 'react';
import {
  Users, FolderTree, Server, HardDrive, Activity, RefreshCw, CircleDot,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { bytesToHuman, relativeTime } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Progress } from '@/components/ui/Progress';

function StatCard({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold">{value}</div>
          {hint && <div className="text-xs text-neutral-500 mt-1">{hint}</div>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center
                         ${tone === 'success' ? 'bg-success/15 text-success' :
                           tone === 'danger'  ? 'bg-danger/15 text-danger'  :
                                                'bg-brand/15 text-brand-400'}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const toast = useToast();

  async function load() {
    try {
      const d = await api.get('/system/dashboard');
      setData(d);
    } catch (e) {
      toast.error('Could not load dashboard', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function reloadSamba() {
    setReloading(true);
    try {
      await api.post('/system/samba/reload');
      toast.success('Samba reloaded');
      load();
    } catch (e) {
      toast.error('Reload failed', e.message);
    } finally {
      setReloading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  const smbd = data.services.find((s) => s.name === 'smbd');
  const smbActive = smbd?.active;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">
            SambaControl v{data.version}
          </p>
        </div>
        <button onClick={reloadSamba} disabled={reloading} className="btn-outline">
          {reloading ? <Spinner /> : <RefreshCw className="w-4 h-4" />}
          Reload Samba
        </button>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Users" value={data.user_count} hint="Samba accounts" />
        <StatCard icon={FolderTree} label="Shares" value={data.share_count} hint="Active shares" />
        <StatCard
          icon={Server}
          label="Samba"
          value={smbActive ? 'Online' : 'Offline'}
          hint={smbd?.state ?? 'unknown'}
          tone={smbActive ? 'success' : 'danger'}
        />
        <StatCard
          icon={HardDrive}
          label="Storage"
          value={data.storage[0] ? `${data.storage[0].percent.toFixed(0)}%` : '—'}
          hint={data.storage[0] ? `${bytesToHuman(data.storage[0].used_bytes)} of ${bytesToHuman(data.storage[0].total_bytes)}` : ''}
        />
      </div>

      {/* Two-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Services */}
        <div className="card lg:col-span-1">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-brand-400" /> Services
          </h2>
          <ul className="space-y-3">
            {data.services.map((s) => (
              <li key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CircleDot className={`w-3.5 h-3.5 ${s.active ? 'text-success' : 'text-danger'}`} />
                  <span className="font-mono text-sm">{s.name}</span>
                </div>
                <span className={s.active ? 'badge-success' : 'badge-danger'}>{s.state}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Storage */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-brand-400" /> Storage
          </h2>
          {data.storage.map((s) => (
            <div key={s.path} className="space-y-2 mb-4 last:mb-0">
              <div className="flex justify-between text-sm">
                <span className="font-mono text-neutral-400 truncate">{s.path}</span>
                <span className="text-neutral-300">
                  {bytesToHuman(s.used_bytes)} / {bytesToHuman(s.total_bytes)}
                </span>
              </div>
              <Progress value={s.percent} animated={false} />
              <div className="text-xs text-neutral-500">
                {bytesToHuman(s.free_bytes)} free
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="card">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand-400" /> Recent activity
        </h2>
        {data.recent_activity.length === 0 ? (
          <p className="text-sm text-neutral-500">No activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-2 py-2">When</th>
                  <th className="px-2 py-2">Actor</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Action</th>
                  <th className="px-2 py-2">Target</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_activity.map((a) => (
                  <tr key={a.id} className="table-row">
                    <td className="px-2 py-2 text-neutral-400 whitespace-nowrap">{relativeTime(a.ts)}</td>
                    <td className="px-2 py-2 font-medium">{a.actor}</td>
                    <td className="px-2 py-2">
                      <span className="badge-muted">{a.category}</span>
                    </td>
                    <td className="px-2 py-2">{a.action}</td>
                    <td className="px-2 py-2 text-neutral-400 font-mono text-xs">{a.target || '—'}</td>
                    <td className="px-2 py-2">
                      <span className={a.status === 'ok' ? 'badge-success' : 'badge-danger'}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
