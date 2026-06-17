import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/Layout.js';
import { Badge, Card, EmptyState, Spinner } from '../components/ui.js';
import { api, type DashboardData } from '../lib/api.js';
import { formatBytes, relativeTime } from '../lib/format.js';

export default function Dashboard() {
    const [data, setData] = useState<DashboardData | null>(null);

    useEffect(() => {
        api.dashboard()
            .then(setData)
            .catch(() => setData(null));
    }, []);

    if (!data) {
        return (
            <div className="flex justify-center py-20 text-muted">
                <Spinner />
            </div>
        );
    }

    const okSources = data.sources.filter((s) => s.status === 'ok').length;
    const enabledRules = data.rules.filter((r) => r.enabled).length;
    const deletedTotal = data.recentRuns.reduce((sum, r) => sum + r.deleted, 0);

    return (
        <>
            <PageHeader title="Overview" subtitle="What SelfArchiver is keeping safe and small." />

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat label="Archived emails" value={data.stats.total.toLocaleString()} sub={formatBytes(data.stats.totalSize)} />
                <Stat label="Mailboxes" value={String(data.sources.length)} sub={`${okSources} connected`} />
                <Stat label="Active rules" value={String(enabledRules)} sub={`${data.rules.length} total`} />
                <Stat label="Recently deleted" value={String(deletedTotal)} sub="from source mailboxes" accent />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <Card className="p-6">
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Recent activity</h2>
                    {data.recentRuns.length === 0 ? (
                        <p className="text-sm text-muted">No rule has run yet.</p>
                    ) : (
                        <ul className="flex flex-col divide-y divide-line">
                            {data.recentRuns.map((run) => {
                                const rule = data.rules.find((r) => r.id === run.ruleId);
                                return (
                                    <li key={run.id} className="flex items-center justify-between gap-3 py-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium">{rule?.name ?? 'Deleted rule'}</div>
                                            <div className="font-mono text-xs text-muted">
                                                {run.archived} archived · {run.deleted} deleted · {relativeTime(run.startedAt)}
                                            </div>
                                        </div>
                                        <RunBadge status={run.status} />
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>

                <Card className="p-6">
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Mailboxes</h2>
                    {data.sources.length === 0 ? (
                        <EmptyState
                            title="No mailbox yet"
                            description="Connect an IMAP mailbox to start archiving."
                            action={
                                <Link to="/sources" className="text-sm font-medium text-accent hover:underline">
                                    Add a mailbox →
                                </Link>
                            }
                        />
                    ) : (
                        <ul className="flex flex-col divide-y divide-line">
                            {data.sources.map((s) => (
                                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium">{s.name}</div>
                                        <div className="truncate font-mono text-xs text-muted">{s.username}</div>
                                    </div>
                                    <Badge tone={s.status === 'ok' ? 'teal' : s.status === 'error' ? 'danger' : 'neutral'}>
                                        {s.status}
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>
        </>
    );
}

function Stat({ label, value, sub, accent = false }: { label: string; value: string; sub: string; accent?: boolean }) {
    return (
        <Card className={`p-5 ${accent ? 'border-accent/30 bg-accent-soft/40' : ''}`}>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
            <div className="mt-2 font-mono text-3xl font-bold text-ink">{value}</div>
            <div className="mt-1 text-xs text-muted">{sub}</div>
        </Card>
    );
}

function RunBadge({ status }: { status: 'running' | 'success' | 'error' }) {
    if (status === 'running') return <Badge tone="accent">running</Badge>;
    if (status === 'error') return <Badge tone="danger">error</Badge>;
    return <Badge tone="teal">done</Badge>;
}
