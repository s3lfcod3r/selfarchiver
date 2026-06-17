import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/Layout.js';
import { Badge, Card, EmptyState, Spinner } from '../components/ui.js';
import { api, type DashboardData } from '../lib/api.js';
import { formatBytes, relativeTime } from '../lib/format.js';
import { useI18n } from '../lib/i18n.js';

export default function Dashboard() {
    const { t } = useI18n();
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
            <PageHeader title={t('nav.overview')} subtitle={t('dash.subtitle')} />

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat label={t('dash.archivedEmails')} value={data.stats.total.toLocaleString()} sub={formatBytes(data.stats.totalSize)} />
                <Stat label={t('nav.mailboxes')} value={String(data.sources.length)} sub={t('dash.connected', { n: okSources })} />
                <Stat label={t('dash.activeRules')} value={String(enabledRules)} sub={t('dash.totalRules', { n: data.rules.length })} />
                <Stat label={t('dash.recentlyDeleted')} value={String(deletedTotal)} sub={t('dash.fromSource')} accent />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <Card className="p-6">
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('dash.recentActivity')}</h2>
                    {data.recentRuns.length === 0 ? (
                        <p className="text-sm text-muted">{t('dash.noRuns')}</p>
                    ) : (
                        <ul className="flex flex-col divide-y divide-line">
                            {data.recentRuns.map((run) => {
                                const rule = data.rules.find((r) => r.id === run.ruleId);
                                return (
                                    <li key={run.id} className="flex items-center justify-between gap-3 py-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium">{rule?.name ?? t('runs.deletedRule')}</div>
                                            <div className="font-mono text-xs text-muted">
                                                {t('dash.runLine', { a: run.archived, d: run.deleted })} · {relativeTime(run.startedAt)}
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
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('nav.mailboxes')}</h2>
                    {data.sources.length === 0 ? (
                        <EmptyState
                            title={t('dash.noMailbox')}
                            description={t('dash.noMailboxDesc')}
                            action={
                                <Link to="/sources" className="text-sm font-medium text-accent hover:underline">
                                    {t('dash.addMailboxLink')}
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
    const { t } = useI18n();
    if (status === 'running') return <Badge tone="accent">{t('run.running')}</Badge>;
    if (status === 'error') return <Badge tone="danger">{t('run.error')}</Badge>;
    return <Badge tone="teal">{t('run.done')}</Badge>;
}
