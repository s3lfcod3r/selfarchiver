import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/Layout.js';
import { Badge, Button, Card, EmptyState, Spinner, Toggle } from '../components/ui.js';
import { api, type Rule, type Source } from '../lib/api.js';
import { describeCron, formatDate, relativeTime } from '../lib/format.js';
import RuleForm from './RuleForm.js';

export default function Rules() {
    const [rules, setRules] = useState<Rule[] | null>(null);
    const [sources, setSources] = useState<Source[]>([]);
    const [editing, setEditing] = useState<{ rule: Rule | null } | null>(null);

    const load = () =>
        Promise.all([api.listRules(), api.listSources()]).then(([r, s]) => {
            setRules(r);
            setSources(s);
        });
    useEffect(() => {
        void load();
    }, []);

    const sourceName = (id: string) => sources.find((s) => s.id === id)?.name ?? 'Unknown mailbox';

    const toggleEnabled = async (rule: Rule) => {
        await api.updateRule(rule.id, { ...rule, enabled: !rule.enabled });
        await load();
    };

    const runNow = async (rule: Rule) => {
        try {
            await api.runRule(rule.id);
            alert(`"${rule.name}" started. Watch progress under Activity.`);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Could not start rule');
        }
    };

    const remove = async (rule: Rule) => {
        if (!confirm(`Delete rule "${rule.name}"? Archived emails are kept.`)) return;
        await api.deleteRule(rule.id);
        await load();
    };

    const canAddRule = sources.length > 0;

    return (
        <>
            <PageHeader
                title="Rules"
                subtitle="Each rule archives chosen folders on its own schedule — optionally clearing them from the mailbox."
                action={
                    canAddRule ? (
                        <Button variant="primary" onClick={() => setEditing({ rule: null })}>
                            + New rule
                        </Button>
                    ) : undefined
                }
            />

            {!rules ? (
                <div className="flex justify-center py-20 text-muted">
                    <Spinner />
                </div>
            ) : !canAddRule ? (
                <EmptyState
                    title="Add a mailbox first"
                    description="Rules act on a mailbox, so connect one before creating rules."
                    action={
                        <Link to="/sources" className="text-sm font-medium text-accent hover:underline">
                            Go to mailboxes →
                        </Link>
                    }
                />
            ) : rules.length === 0 ? (
                <EmptyState
                    title="No rules yet"
                    description="Create a rule to archive e.g. the Invoices folder every 30 days and keep your mailbox small."
                    action={
                        <Button variant="primary" onClick={() => setEditing({ rule: null })}>
                            + New rule
                        </Button>
                    }
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {rules.map((rule) => (
                        <Card key={rule.id} className="p-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold">{rule.name}</h3>
                                        {rule.action === 'archive_delete' ? (
                                            <Badge tone="danger">archive + delete</Badge>
                                        ) : (
                                            <Badge tone="teal">archive only</Badge>
                                        )}
                                        {!rule.enabled && <Badge tone="neutral">paused</Badge>}
                                    </div>
                                    <div className="mt-1 font-mono text-xs text-muted">
                                        {sourceName(rule.sourceId)} · older than {rule.minAgeDays}d · {describeCron(rule.scheduleCron)}
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {rule.folders.map((f) => (
                                            <span key={f} className="rounded-md bg-line/50 px-2 py-0.5 font-mono text-xs text-muted">
                                                {f}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <Toggle checked={rule.enabled} onChange={() => void toggleEnabled(rule)} label="" />
                            </div>

                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                                <div className="font-mono text-xs text-muted">
                                    last run {relativeTime(rule.lastRunAt)} · next {formatDate(rule.nextRunAt)}
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={() => void runNow(rule)}>Run now</Button>
                                    <Button onClick={() => setEditing({ rule })}>Edit</Button>
                                    <Button variant="ghost" onClick={() => void remove(rule)}>
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {editing && (
                <RuleForm
                    sources={sources}
                    rule={editing.rule}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        void load();
                    }}
                />
            )}
        </>
    );
}
