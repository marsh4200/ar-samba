import { useEffect, useState } from 'react';
import { ScrollText, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';

const CATEGORIES = ['all', 'auth', 'user', 'share', 'acl', 'samba', 'update', 'system'];

const CAT_TONE = {
  auth: 'bg-brand/15 text-brand-400',
  user: 'bg-success/15 text-success',
  share: 'bg-warning/15 text-warning',
  acl: 'bg-warning/15 text-warning',
  samba: 'bg-brand/15 text-brand-400',
  update: 'bg-success/15 text-success',
  system: 'bg-white/10 text-neutral-300',
};

export default function LogsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const toast = useToast();

  async function load() {
    setLoading(true);
    try {
      const qs = category === 'all' ? '' : `?category=${category}`;
      setRows(await api.get(`/logs${qs}`));
    } catch (e) {
      toast.error('Could not load logs', e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [category]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Activity Log</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Every privileged action SambaControl takes is recorded here.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="input !w-auto"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button className="btn-outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Spinner className="w-5 h-5 text-brand-400" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-neutral-500">
            <ScrollText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <div className="text-sm">No activity yet.</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-bg-soft/60 text-neutral-400">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium w-44">Time</th>
                <th className="px-4 py-3 font-medium w-28">Category</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium w-32">Actor</th>
                <th className="px-4 py-3 font-medium w-20">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">{formatDate(r.ts)}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${CAT_TONE[r.category] || 'bg-white/5 text-neutral-400'}`}>
                      {r.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
                  <td className="px-4 py-3 text-neutral-400 text-xs font-mono break-all">{r.target || '—'}</td>
                  <td className="px-4 py-3 text-xs">{r.actor}</td>
                  <td className="px-4 py-3">
                    {r.status === 'ok' ? (
                      <span className="badge-success"><CheckCircle2 className="w-3 h-3" />ok</span>
                    ) : (
                      <span className="badge-danger" title={r.details || ''}><AlertCircle className="w-3 h-3" />error</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
