import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/Layout.js';
import { Badge, Button, Card, EmptyState, Spinner, Toggle } from '../components/ui.js';
import { api, type Rule, type Source } from '../lib/api.js';
import { formatDate, relativeTime } from '../lib/format.js';
import { useI18n } from '../lib/i18n.js';
import { describeSchedule } from '../lib/schedule.js';
import RuleForm from './RuleForm.js';

export default function Rules() {
    const { t } = useI18n();
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

    const sourceName = (id: string) => sources.find((s) => s.id === id)?.name ?? t('rules.unknownMailbox');
    const ageLabel = (rule: Rule) => `${rule.minAge} ${rule.minAgeUnit === 'hours' ? t('rf.hours') : t('rf.days')}`;

    const toggleEnabled = async (rule: Rule) => {
        await api.updateRule(rule.id, { ...rule, enabled: !rule.enabled });
        await load();
    };

    const runNow = async (rule: Rule) => {
        try {
            await api.runRule(rule.id);
            alert(t('rules.started', { name: rule.name }));
        } catch (err) {
            alert(err instanceof Error ? err.message : t('rules.couldNotStart'));
        }
    };

    const remove = async (rule: Rule) => {
        if (!confirm(t('rules.deleteConfirm', { name: rule.name }))) return;
        await api.deleteRule(rule.id);
        await load();
    };

    const canAddRule = sources.length > 0;

    return (
        <>
            <PageHeader
                title={t('nav.rules')}
                subtitle={t('rules.subtitle')}
                action={
                    canAddRule ? (
                        <Button variant="primary" onClick={() => setEditing({ rule: null })}>
                            {t('rules.new')}
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
                    title={t('rules.addMailboxFirst')}
                    description={t('rules.addMailboxFirstDesc')}
                    action={
                        <Link to="/sources" className="text-sm font-medium text-accent hover:underline">
                            {t('rules.goToMailboxes')}
                        </Link>
                    }
                />
            ) : rules.length === 0 ? (
                <EmptyState
                    title={t('rules.noRules')}
                    description={t('rules.noRulesDesc')}
                    action={
                        <Button variant="primary" onClick={() => setEditing({ rule: null })}>
                            {t('rules.new')}
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
                                            <Badge tone="danger">{t('rules.archiveDelete')}</Badge>
                                        ) : (
                                            <Badge tone="teal">{t('rules.archiveOnly')}</Badge>
                                        )}
                                        {!rule.enabled && <Badge tone="neutral">{t('rules.paused')}</Badge>}
                                    </div>
                                    <div className="mt-1 font-mono text-xs text-muted">
                                        {t('rules.metaLine', {
                                            source: sourceName(rule.sourceId),
                                            age: ageLabel(rule),
                                            schedule: describeSchedule(rule.scheduleCron, t),
                                        })}
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
                                    {t('rules.lastNext', { last: relativeTime(rule.lastRunAt), next: formatDate(rule.nextRunAt) })}
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={() => void runNow(rule)}>{t('common.runNow')}</Button>
                                    <Button onClick={() => setEditing({ rule })}>{t('common.edit')}</Button>
                                    <Button variant="ghost" onClick={() => void remove(rule)}>
                                        {t('common.delete')}
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
