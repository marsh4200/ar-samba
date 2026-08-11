import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollText, RefreshCw, CheckCircle2, AlertCircle, Search, ChevronDown, Play, Pause,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { formatDateParts, relativeTime, cn } from '@/lib/utils';
import { CATEGORIES, categoryMeta, humaniseAction } from '@/lib/activity';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { InputWithIcon } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TableWrap, THead, TBody, TH, TR, TD, EmptyState } from '@/components/ui/Table';

const PAGE_SIZE = 100;
const POLL_MS = 10000;

/** One row, expandable when the backend recorded failure details. */
function LogRow({ row }) {
  const [open, setOpen] = useState(false);
  const meta = categoryMeta(row.category);
  const Icon = meta.icon;
  const failed = row.status !== 'ok';
  const { date, time } = formatDateParts(row.ts);
  const expandable = failed && !!row.details;

  return (
    <>
      <TR
        className={cn(expandable && 'cursor-pointer', open && 'bg-signal-500/[.04]')}
        onClick={expandable ? () => setOpen((o) => !o) : undefined}
      >
        <TD>
          <div className="whitespace-nowrap">
            <div className="font-mono text-2xs text-ink-muted tnum">{time}</div>
            <div className="mt-0.5 text-2xs text-ink-ghost">{date}</div>
          </div>
        </TD>

        <TD>
          <Badge tone={meta.tone} icon={Icon}>{meta.label}</Badge>
        </TD>

        <TD>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink">{humaniseAction(row.action)}</span>
            {expandable && (
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 shrink-0 text-ink-ghost transition-transform duration-200',
                  open && 'rotate-180',
                )}
              />
            )}
          </div>
          <div className="mt-0.5 text-2xs text-ink-ghost">{relativeTime(row.ts)}</div>
        </TD>

        <TD>
          <span className="block max-w-[32ch] truncate font-mono text-2xs text-ink-muted" title={row.target || ''}>
            {row.target || '—'}
          </span>
        </TD>

        <TD className="hidden md:table-cell">
          <span className="font-mono text-2xs text-ink-muted">{row.actor}</span>
        </TD>

        <TD align="right">
          {failed ? (
            <Badge tone="crit" icon={AlertCircle}>Failed</Badge>
          ) : (
            <Badge tone="ok" icon={CheckCircle2}>OK</Badge>
          )}
        </TD>
      </TR>

      {open && expandable && (
        <tr className="border-b border-line/50">
          <td colSpan={6} className="bg-abyss/50 px-4 pb-4 pt-1">
            <div className="rounded-xl border border-crit/25 bg-crit/[.06] p-3.5">
              <div className="eyebrow mb-2 text-crit">Failure details</div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-2xs leading-relaxed text-ink-muted">
                {row.details}
              </pre>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function LogsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [live, setLive] = useState(false);
  const toast = useToast();
  const reqId = useRef(0);

  const load = useCallback(async ({ quiet = false } = {}) => {
    const id = ++reqId.current;
    if (!quiet) setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: '0' });
      if (category !== 'all') params.set('category', category);
      const data = await api.get(`/logs?${params}`);
      if (id !== reqId.current) return; // a newer request already won
      setRows(data);
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      if (id === reqId.current && !quiet) toast.error('Could not load activity', e.message);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [category]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(rows.length),
      });
      if (category !== 'all') params.set('category', category);
      const data = await api.get(`/logs?${params}`);
      setRows((cur) => [...cur, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      toast.error('Could not load more', e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => { load(); }, [load]);

  // Live mode re-fetches the newest page quietly, without a loading flash.
  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => load({ quiet: true }), POLL_MS);
    return () => clearInterval(id);
  }, [live, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.action, r.target, r.actor, r.category, r.details]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const failures = useMemo(() => rows.filter((r) => r.status !== 'ok').length, [rows]);

  return (
    <div className="space-y-6 stagger">
      <PageHeader
        title="Activity"
        description="Every privileged action AR Samba performs is recorded here — who did it, what changed, and whether it worked."
        actions={
          <>
            <Button
              variant={live ? 'secondary' : 'outline'}
              icon={live ? Pause : Play}
              onClick={() => setLive((l) => !l)}
            >
              {live ? 'Pause live' : 'Go live'}
            </Button>
            <Button variant="outline" icon={RefreshCw} onClick={() => load()} disabled={loading}>
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </>
        }
      />

      {failures > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-crit/25 bg-crit/[.07] px-4 py-3.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-crit" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-ink">
              {failures} {failures === 1 ? 'action' : 'actions'} failed in this view
            </div>
            <div className="mt-0.5 text-2xs text-ink-muted">
              Select a failed row to see what the server reported.
            </div>
          </div>
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-line/60 p-4 xl:flex-row xl:items-center xl:justify-between">
          <InputWithIcon
            icon={Search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search activity"
            className="xl:max-w-xs"
            aria-label="Search activity"
          />
          <div className="flex items-center gap-3">
            {live && (
              <span className="hidden items-center gap-1.5 text-2xs text-ok sm:inline-flex">
                <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-ok" />
                Live
              </span>
            )}
            <Segmented
              value={category}
              onChange={setCategory}
              options={CATEGORIES.map((c) => ({
                value: c,
                label: c === 'all' ? 'All' : categoryMeta(c).label,
              }))}
            />
          </div>
        </div>

        <CardBody flush>
          {loading ? (
            <SkeletonRows rows={7} cols={5} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="Nothing recorded yet"
              description={
                category === 'all'
                  ? 'Actions appear here as soon as you create a share or add a user.'
                  : `No ${categoryMeta(category).label.toLowerCase()} activity has been recorded.`
              }
              action={
                category !== 'all' && (
                  <Button variant="outline" onClick={() => setCategory('all')}>
                    Show all activity
                  </Button>
                )
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches"
              description={`Nothing on this page matches "${query}".`}
              action={<Button variant="outline" onClick={() => setQuery('')}>Clear search</Button>}
            />
          ) : (
            <>
              <ul className="divide-y divide-line/50 md:hidden">
                {filtered.map((r) => {
                  const meta = categoryMeta(r.category);
                  const Icon = meta.icon;
                  const failed = r.status !== 'ok';
                  return (
                    <li key={r.id} className="px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border',
                            failed
                              ? 'border-crit/30 bg-crit/10 text-crit'
                              : 'border-line bg-raised text-ink-muted',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-medium text-ink">
                              {humaniseAction(r.action)}
                            </span>
                            {failed
                              ? <Badge tone="crit">Failed</Badge>
                              : <Badge tone="ok">OK</Badge>}
                          </div>
                          {r.target && (
                            <div className="mt-1 break-all font-mono text-2xs text-ink-muted">
                              {r.target}
                            </div>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-ink-faint">
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                            <span>{r.actor}</span>
                            <span className="text-ink-ghost">{relativeTime(r.ts)}</span>
                          </div>
                          {failed && r.details && (
                            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-crit/25 bg-crit/[.06] p-2.5 font-mono text-2xs leading-relaxed text-ink-muted">
                              {r.details}
                            </pre>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden md:block">
              <TableWrap>
                <THead>
                  <tr>
                    <TH className="w-28">Time</TH>
                    <TH className="w-28">Area</TH>
                    <TH>Action</TH>
                    <TH>Target</TH>
                    <TH className="hidden w-32 md:table-cell">By</TH>
                    <TH align="right" className="w-24">Result</TH>
                  </tr>
                </THead>
                <TBody>
                  {filtered.map((r) => <LogRow key={r.id} row={r} />)}
                </TBody>
              </TableWrap>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-line/60 px-4 py-3.5">
                <span className="text-2xs text-ink-faint">
                  Showing {filtered.length}
                  {filtered.length !== rows.length && ` of ${rows.length}`} entries
                </span>
                {hasMore && (
                  <Button variant="outline" size="sm" loading={loadingMore} onClick={loadMore}>
                    Load older
                  </Button>
                )}
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
