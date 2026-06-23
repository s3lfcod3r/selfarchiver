import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../components/Layout.js';
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Spinner } from '../components/ui.js';
import { api, type Rule, type Run } from '../lib/api.js';
import { formatDate, relativeTime } from '../lib/format.js';
import { useI18n } from '../lib/i18n.js';

const PAGE = 50;

function startOfDayMs(value: string): number | undefined {
    if (!value) return undefined;
    const ms = new Date(`${value}T00:00:00`).getTime();
    return Number.isFinite(ms) ? ms : undefined;
}
function endOfDayMs(value: string): number | undefined {
    if (!value) return undefined;
    const ms = new Date(`${value}T23:59:59.999`).getTime();
    return Number.isFinite(ms) ? ms : undefined;
}

export default function Runs() {
    const { t } = useI18n();
    const [runs, setRuns] = useState<Run[]>([]);
    const [total, setTotal] = useState(0);
    const [rules, setRules] = useState<Rule[]>([]);
    const [loading, setLoading] = useState(true);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Filters
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<'' | Run['status']>('');
    const [trigger, setTrigger] = useState<'' | Run['trigger']>('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    // Auto-refresh keeps running jobs fresh, but only while viewing the first
    // page — once the user pages further we pause it so the list isn't reset.
    const pagedRef = useRef(false);

    const query = (offset: number, append: boolean) => {
        setLoading(true);
        return api
            .listRuns({
                search: search || undefined,
                status: status || undefined,
                trigger: trigger || undefined,
                from: startOfDayMs(fromDate),
                to: endOfDayMs(toDate),
                limit: PAGE,
                offset,
            })
            .then((res) => {
                setTotal(res.total);
                setRuns((prev) => (append ? [...prev, ...res.runs] : res.runs));
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        void api.listRules().then(setRules);
    }, []);

    // Debounced reload whenever a filter changes; resets to the first page.
    const reloadRef = useRef<() => void>(() => undefined);
    reloadRef.current = () => void query(0, false);
    useEffect(() => {
        pagedRef.current = false;
        const timer = setTimeout(() => reloadRef.current(), 250);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, status, trigger, fromDate, toDate]);

    // Live refresh of the first page only.
    useEffect(() => {
        const timer = setInterval(() => {
            if (!pagedRef.current) reloadRef.current();
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    const loadMore = () => {
        pagedRef.current = true;
        void query(runs.length, true);
    };

    const removeRun = async (run: Run) => {
        if (!confirm(t('runs.deleteConfirm'))) return;
        await api.deleteRun(run.id);
        pagedRef.current = false;
        void query(0, false);
    };

    const clearAll = async () => {
        if (!confirm(t('runs.clearAllConfirm'))) return;
        await api.clearRuns();
        pagedRef.current = false;
        void query(0, false);
    };

    const hasFilters = Boolean(search || status || trigger || fromDate || toDate);
    const clearFilters = () => {
        setSearch('');
        setStatus('');
        setTrigger('');
        setFromDate('');
        setToDate('');
    };

    const triggerLabel = (tr: Run['trigger']) => (tr === 'manual' ? t('runs.triggerManual') : t('runs.triggerSchedule'));

    return (
        <>
            <PageHeader
                title={t('nav.activity')}
                subtitle={t('runs.count', { n: total.toLocaleString() })}
                action={
                    <div className="flex items-center gap-2">
                        {total > 0 && (
                            <Button variant="ghost" onClick={() => void clearAll()}>
                                🗑 {t('runs.clearAll')}
                            </Button>
                        )}
                        <Button variant="ghost" onClick={() => setSettingsOpen(true)}>
                            ⚙ {t('runs.settings')}
                        </Button>
                    </div>
                }
            />

            <div className="mb-5 flex flex-col gap-3">
                <Input placeholder={t('runs.searchPh')} value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="flex flex-wrap items-center gap-3">
                    <Select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as '' | Run['status'])}
                        className="max-w-[12rem]"
                    >
                        <option value="">{t('runs.statusAll')}</option>
                        <option value="success">{t('run.done')}</option>
                        <option value="error">{t('run.error')}</option>
                        <option value="running">{t('run.running')}</option>
                    </Select>
                    <Select
                        value={trigger}
                        onChange={(e) => setTrigger(e.target.value as '' | Run['trigger'])}
                        className="max-w-[12rem]"
                    >
                        <option value="">{t('runs.triggerAll')}</option>
                        <option value="schedule">{t('runs.triggerSchedule')}</option>
                        <option value="manual">{t('runs.triggerManual')}</option>
                    </Select>
                    <label className="flex items-center gap-2 text-xs text-muted">
                        {t('arch.from')}
                        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-auto" />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-muted">
                        {t('arch.to')}
                        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-auto" />
                    </label>
                    {hasFilters && (
                        <Button variant="ghost" onClick={clearFilters}>
                            {t('runs.clear')}
                        </Button>
                    )}
                </div>
            </div>

            {loading && runs.length === 0 ? (
                <div className="flex justify-center py-20 text-muted">
                    <Spinner />
                </div>
            ) : runs.length === 0 ? (
                hasFilters ? (
                    <EmptyState title={t('runs.noMatch')} description={t('runs.noMatchDesc')} />
                ) : (
                    <EmptyState title={t('runs.none')} description={t('runs.noneDesc')} />
                )
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
                                        <div className="font-mono text-xs text-muted">{triggerLabel(run.trigger)}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <RunBadge status={run.status} />
                                    </div>
                                    <div className="col-span-4 font-mono text-xs text-muted">
                                        {run.error ? (
                                            <span className="break-words text-danger" title={run.error}>
                                                {run.error}
                                            </span>
                                        ) : (
                                            t('runs.resultLine', { s: run.scanned, a: run.archived, d: run.deleted })
                                        )}
                                    </div>
                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                        <span className="text-right text-muted" title={formatDate(run.startedAt)}>
                                            {relativeTime(run.startedAt)}
                                        </span>
                                        <button
                                            onClick={() => void removeRun(run)}
                                            className="shrink-0 text-muted transition-colors hover:text-danger"
                                            title={t('runs.delete')}
                                            aria-label={t('runs.delete')}
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    {runs.length < total && (
                        <div className="flex justify-center border-t border-line p-4">
                            <Button onClick={loadMore} disabled={loading}>
                                {loading ? <Spinner /> : t('arch.loadMore', { n: total - runs.length })}
                            </Button>
                        </div>
                    )}
                </Card>
            )}

            {settingsOpen && <RetentionModal onClose={() => setSettingsOpen(false)} />}
        </>
    );
}

function RetentionModal({ onClose }: { onClose: () => void }) {
    const { t } = useI18n();
    const [value, setValue] = useState<string>('');
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        api.getSettings()
            .then((s) => setValue(String(s.runsMax)))
            .finally(() => setLoaded(true));
    }, []);

    const save = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const res = await api.updateSettings(Math.max(0, Math.floor(Number(value) || 0)));
            setValue(String(res.runsMax));
            setSaved(true);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            title={t('runs.retentionTitle')}
            onClose={onClose}
            footer={
                <>
                    <Button onClick={onClose}>{t('common.close')}</Button>
                    <Button variant="primary" onClick={() => void save()} disabled={!loaded || saving}>
                        {saving ? <Spinner /> : t('common.save')}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium">{t('runs.retentionLabel')}</span>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            min={0}
                            step={1}
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                                setSaved(false);
                            }}
                            className="w-32"
                            disabled={!loaded}
                        />
                        <span className="text-sm text-muted">{t('runs.retentionUnit')}</span>
                    </div>
                </label>
                <p className="text-xs text-muted">{t('runs.retentionHint')}</p>
                {saved && <p className="text-xs text-teal">{t('runs.retentionSaved')}</p>}
            </div>
        </Modal>
    );
}

function RunBadge({ status }: { status: 'running' | 'success' | 'error' }) {
    const { t } = useI18n();
    if (status === 'running') return <Badge tone="accent">{t('run.running')}</Badge>;
    if (status === 'error') return <Badge tone="danger">{t('run.error')}</Badge>;
    return <Badge tone="teal">{t('run.done')}</Badge>;
}
