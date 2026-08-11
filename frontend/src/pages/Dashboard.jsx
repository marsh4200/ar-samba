import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, FolderTree, HardDrive, Activity, RefreshCw, Server, Cpu,
  MemoryStick, ArrowUpRight, Gauge as GaugeIcon, Clock, CircleSlash,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { useSystem } from '@/context/SystemContext';
import { bytesToHuman, formatUptime, relativeTime } from '@/lib/utils';
import { categoryMeta, humaniseAction } from '@/lib/activity';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Gauge } from '@/components/ui/Gauge';
import { Badge, StatusDot } from '@/components/ui/Badge';
import { Button, buttonVariants } from '@/components/ui/Button';
import { Progress, toneForPercent } from '@/components/ui/Progress';
import { EmptyState } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardPage() {
  const { dashboard: data, metrics, metricsSupported, loading, refresh } = useSystem();
  const [reloading, setReloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  async function reloadSamba() {
    setReloading(true);
    try {
      await api.post('/system/samba/reload');
      toast.success('Samba reloaded', 'Configuration re-applied to the running service.');
      await refresh();
    } catch (e) {
      toast.error('Reload failed', e.message);
    } finally {
      setReloading(false);
    }
  }

  async function manualRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } catch (e) {
      toast.error('Could not refresh', e.message);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <EmptyState
          icon={CircleSlash}
          title="Can't reach the server"
          description="The dashboard could not load system status. Check that the AR Samba backend service is running."
          action={<Button variant="primary" icon={RefreshCw} onClick={manualRefresh} loading={refreshing}>Try again</Button>}
        />
      </Card>
    );
  }

  const smbd = data.services.find((s) => s.name === 'smbd');
  const smbActive = !!smbd?.active;
  const storage = data.storage[0];
  const storagePct = storage ? storage.percent : 0;

  return (
    <div className="space-y-6 stagger">
      <PageHeader
        title="Dashboard"
        description={
          metrics?.hostname
            ? `Live status for ${metrics.hostname}.`
            : 'Live status for this file server.'
        }
        actions={
          <>
            <Button icon={RefreshCw} onClick={manualRefresh} loading={refreshing} variant="outline">
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button icon={Server} onClick={reloadSamba} loading={reloading} variant="secondary">
              Reload Samba
            </Button>
          </>
        }
      />

      {/* ── Status row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Server}
          label="Samba service"
          value={smbActive ? 'Running' : 'Stopped'}
          tone={smbActive ? 'ok' : 'crit'}
          hint={smbd?.state || 'state unknown'}
          trailing={
            <div className="flex items-center gap-2">
              <StatusDot tone={smbActive ? 'ok' : 'crit'} pulse={smbActive} />
              <span className="text-2xs text-ink-faint">
                {metrics ? `Up ${formatUptime(metrics.uptime_seconds)}` : `Version ${data.version}`}
              </span>
            </div>
          }
        />

        <StatCard
          icon={FolderTree}
          label="Shares"
          value={data.share_count}
          tone="signal"
          hint={data.share_count === 1 ? '1 share published' : `${data.share_count} shares published`}
          trailing={
            <Link
              to="/shares"
              className="inline-flex items-center gap-1 text-2xs font-medium text-signal-400 transition-colors hover:text-signal-300"
            >
              Manage shares <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
        />

        <StatCard
          icon={Users}
          label="Samba users"
          value={data.user_count}
          tone="info"
          hint="Samba-only, no shell access"
          trailing={
            <Link
              to="/users"
              className="inline-flex items-center gap-1 text-2xs font-medium text-signal-400 transition-colors hover:text-signal-300"
            >
              Manage users <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
        />

        <StatCard
          icon={HardDrive}
          label="Storage used"
          value={storage ? `${storagePct.toFixed(0)}%` : '—'}
          tone={storagePct >= 90 ? 'crit' : storagePct >= 75 ? 'warn' : 'ok'}
          hint={
            storage
              ? `${bytesToHuman(storage.used_bytes)} of ${bytesToHuman(storage.total_bytes)}`
              : 'No volume reported'
          }
          trailing={storage && <Progress value={storagePct} tone={toneForPercent(storagePct)} size="xs" animated={false} />}
        />
      </div>

      {/* ── Detail: main column + stacked side column ──────────────── */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
          <CardHeader
            icon={GaugeIcon}
            title="Resources"
            description={
              metricsSupported
                ? 'Host utilisation, sampled every five seconds.'
                : 'Disk capacity for the shares volume.'
            }
            action={
              metrics && (
                <div className="hidden items-center gap-2 rounded-lg border border-line bg-hull/60 px-2.5 py-1.5 sm:flex">
                  <Clock className="h-3.5 w-3.5 text-ink-ghost" />
                  <span className="font-mono text-2xs text-ink-muted">
                    load {metrics.load_1.toFixed(2)}
                  </span>
                </div>
              )
            }
          />
          <CardBody>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {metricsSupported && (
                <>
                  <Gauge
                    value={metrics?.cpu_percent ?? 0}
                    label="CPU"
                    sublabel={metrics ? `${metrics.cpu_threads} threads` : ''}
                    tone={toneForPercent(metrics?.cpu_percent ?? 0)}
                    loading={!metrics}
                  />
                  <Gauge
                    value={metrics?.memory_percent ?? 0}
                    label="Memory"
                    sublabel={metrics ? bytesToHuman(metrics.memory_total) : ''}
                    tone={toneForPercent(metrics?.memory_percent ?? 0)}
                    loading={!metrics}
                  />
                </>
              )}
              <Gauge
                value={storagePct}
                label="Storage"
                sublabel={storage ? bytesToHuman(storage.free_bytes) + ' free' : ''}
                tone={toneForPercent(storagePct)}
              />
            </div>

            {/* Host facts strip */}
            {metrics ? (
              <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line/70 bg-line/70 sm:grid-cols-4">
                {[
                  { icon: Server,       label: 'Host',   value: metrics.hostname },
                  { icon: Cpu,          label: 'Cores',  value: `${metrics.cpu_cores} / ${metrics.cpu_threads}` },
                  { icon: MemoryStick,  label: 'Memory', value: `${bytesToHuman(metrics.memory_used)} used` },
                  { icon: Clock,        label: 'Uptime', value: formatUptime(metrics.uptime_seconds) },
                ].map((f) => (
                  <div key={f.label} className="bg-panel px-4 py-3">
                    <div className="flex items-center gap-1.5 eyebrow">
                      <f.icon className="h-3 w-3" /> {f.label}
                    </div>
                    <div className="mt-1.5 truncate font-mono text-xs text-ink" title={String(f.value)}>
                      {f.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !metricsSupported && (
                <p className="mt-6 rounded-xl border border-line/70 bg-hull/50 px-4 py-3 text-2xs leading-relaxed text-ink-faint">
                  CPU and memory readings need a newer backend. Update AR Samba from
                  Settings to enable them.
                </p>
              )
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            icon={Activity}
            title="Recent activity"
            description="The last ten privileged actions on this server."
            action={
              <Link
                to="/logs"
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            }
          />
          <CardBody flush>
            {data.recent_activity.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Nothing has happened yet"
                description="Create a share or add a user and it will show up here."
                action={
                  <Link to="/shares" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
                    <FolderTree className="h-4 w-4" />
                    Create a share
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-line/50">
                {data.recent_activity.map((a) => {
                  const meta = categoryMeta(a.category);
                  const Icon = meta.icon;
                  const failed = a.status !== 'ok';
                  return (
                    <li key={a.id} className="flex items-start gap-3.5 px-5 py-3.5 transition-colors hover:bg-signal-500/[.03]">
                      <span
                        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
                          failed
                            ? 'border-crit/30 bg-crit/10 text-crit'
                            : 'border-line bg-raised text-ink-muted'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-xs font-medium text-ink">
                            {humaniseAction(a.action)}
                          </span>
                          {a.target && (
                            <span className="truncate font-mono text-2xs text-ink-faint">
                              {a.target}
                            </span>
                          )}
                          {failed && <Badge tone="crit">failed</Badge>}
                        </div>
                        <div className="mt-1 text-2xs text-ink-ghost">
                          {a.actor} · {relativeTime(a.ts)}
                        </div>
                      </div>

                      <Badge tone={meta.tone} className="mt-0.5 hidden sm:inline-flex">
                        {meta.label}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          {/* Services */}
          <Card>
          <CardHeader icon={Server} title="Services" description="Samba daemons on this host." />
          <CardBody className="p-3">
            <ul className="space-y-1">
              {data.services.map((s) => (
                <li
                  key={s.name}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-raised"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <StatusDot tone={s.active ? 'ok' : 'crit'} pulse={s.active} />
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-medium text-ink">{s.name}</div>
                      <div className="mt-0.5 truncate text-2xs text-ink-faint">
                        {s.pid ? `pid ${s.pid}` : 'not running'}
                      </div>
                    </div>
                  </div>
                  <Badge tone={s.active ? 'ok' : 'crit'}>{s.state}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        {/* Volumes */}
        <Card>
          <CardHeader
            icon={HardDrive}
            title="Volumes"
            description="Disk backing the shares directory."
          />
          <CardBody>
            {data.storage.length === 0 ? (
              <p className="py-6 text-center text-2xs text-ink-faint">
                No volume reported for the shares directory.
              </p>
            ) : (
              <div className="space-y-5">
                {data.storage.map((s) => {
                  const tone = toneForPercent(s.percent);
                  return (
                    <div key={s.path}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="truncate font-mono text-2xs text-ink-muted" title={s.path}>
                          {s.path}
                        </span>
                        <Badge tone={tone === 'signal' ? 'ok' : tone}>
                          {s.percent.toFixed(0)}%
                        </Badge>
                      </div>
                      <Progress value={s.percent} tone={tone} animated={false} />
                      <div className="mt-2.5 flex items-center justify-between text-2xs text-ink-faint">
                        <span>{bytesToHuman(s.used_bytes)} used</span>
                        <span>{bytesToHuman(s.free_bytes)} free</span>
                      </div>
                      <div className="mt-3 border-t border-line/60 pt-3 text-2xs text-ink-ghost">
                        Capacity {bytesToHuman(s.total_bytes)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
