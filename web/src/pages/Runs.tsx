import { useEffect, useState } from 'react';
import { PageHeader } from '../components/Layout.js';
import { Badge, Card, EmptyState, Spinner } from '../components/ui.js';
import { api, type Rule, type Run } from '../lib/api.js';
import { formatDate, relativeTime } from '../lib/format.js';
import { useI18n } from '../lib/i18n.js';

export default function Runs() {
    const { t } = useI18n();
    const [runs, setRuns] = useState<Run[] | null>(null);
    const [rules, setRules] = useState<Rule[]>([]);

    const load = () => {
        void Promise.all([api.listRuns(), api.listRules()]).then(([r, rl]) => {
            setRuns(r);
            setRules(rl);
        });
    };

    useEffect(() => {
        load();
        const timer = setInterval(load, 5000); // keep running jobs fresh
        return () => clearInterval(timer);
    }, []);

    if (!runs) {
        return (
            <div className="flex justify-center py-20 text-muted">
                <Spinner />
            </div>
        );
    }

    return (
        <>
            <PageHeader title={t('nav.activity')} subtitle={t('runs.subtitle')} />
            {runs.length === 0 ? (
                <EmptyState title={t('runs.none')} description={t('runs.noneDesc')} />
            ) : (
                <Card className="overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 border-b border-line bg-paper/50 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted">
                        <div className="col-span-4">{t('runs.colRule')}</div>
                        <div className="col-span-2">{t('runs.colStatus')}</div>
                        <div className="col-span-4">{t('runs.colResult')}</div>
                        <div className="col-span-2 text-right">{t('runs.colWhen')}</div>
                    </div>
                    <ul className="divide-y divide-line">
                        {runs.map((run) => {
                            const rule = rules.find((r) => r.id === run.ruleId);
                            return (
                                <li key={run.id} className="grid grid-cols-12 items-center gap-2 px-5 py-3 text-sm">
                                    <div className="col-span-4 min-w-0">
                                        <div className="truncate font-medium">{rule?.name ?? t('runs.deletedRule')}</div>
                                        <div className="font-mono text-xs text-muted">{run.trigger}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <RunBadge status={run.status} />
                                    </div>
                                    <div className="col-span-4 font-mono text-xs text-muted">
                                        {run.error ? (
                                            <span className="text-danger">{run.error}</span>
                                        ) : (
                                            t('runs.resultLine', { s: run.scanned, a: run.archived, d: run.deleted })
                                        )}
                                    </div>
                                    <div className="col-span-2 text-right" title={formatDate(run.startedAt)}>
                                        {relativeTime(run.startedAt)}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </Card>
            )}
        </>
    );
}

function RunBadge({ status }: { status: 'running' | 'success' | 'error' }) {
    const { t } = useI18n();
    if (status === 'running') return <Badge tone="accent">{t('run.running')}</Badge>;
    if (status === 'error') return <Badge tone="danger">{t('run.error')}</Badge>;
    return <Badge tone="teal">{t('run.done')}</Badge>;
}
