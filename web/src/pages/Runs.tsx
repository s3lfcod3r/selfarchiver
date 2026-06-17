import { useEffect, useState } from 'react';
import { PageHeader } from '../components/Layout.js';
import { Badge, Card, EmptyState, Spinner } from '../components/ui.js';
import { api, type Rule, type Run } from '../lib/api.js';
import { formatDate, relativeTime } from '../lib/format.js';

export default function Runs() {
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
            <PageHeader title="Activity" subtitle="Every rule run, what it archived, and what it removed from source." />
            {runs.length === 0 ? (
                <EmptyState title="No activity yet" description="Runs appear here once a rule executes — on schedule or run manually." />
            ) : (
                <Card className="overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 border-b border-line bg-paper/50 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted">
                        <div className="col-span-4">Rule</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-4">Result</div>
                        <div className="col-span-2 text-right">When</div>
                    </div>
                    <ul className="divide-y divide-line">
                        {runs.map((run) => {
                            const rule = rules.find((r) => r.id === run.ruleId);
                            return (
                                <li key={run.id} className="grid grid-cols-12 items-center gap-2 px-5 py-3 text-sm">
                                    <div className="col-span-4 min-w-0">
                                        <div className="truncate font-medium">{rule?.name ?? 'Deleted rule'}</div>
                                        <div className="font-mono text-xs text-muted">{run.trigger}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <RunBadge status={run.status} />
                                    </div>
                                    <div className="col-span-4 font-mono text-xs text-muted">
                                        {run.error ? (
                                            <span className="text-danger">{run.error}</span>
                                        ) : (
                                            <>
                                                scanned {run.scanned} · archived {run.archived} · deleted {run.deleted}
                                            </>
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
    if (status === 'running') return <Badge tone="accent">running</Badge>;
    if (status === 'error') return <Badge tone="danger">error</Badge>;
    return <Badge tone="teal">done</Badge>;
}
