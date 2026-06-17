import { useEffect, useState } from 'react';
import { Badge, Button, Field, Input, Modal, Select, Spinner, TagInput, Toggle } from '../components/ui.js';
import { api, defaultFilter, type MailboxFolder, type Rule, type RuleInput, type Source } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { useI18n } from '../lib/i18n.js';
import { buildCron, parseCron, WEEKDAY_ORDER, type Frequency, type SchedulePlan } from '../lib/schedule.js';

/**
 * The full rule editor. Headline features: folder selection, the filter, the
 * age threshold (days or hours), the schedule builder and the
 * archive-then-delete retention action.
 */

function blankRule(sourceId: string): RuleInput {
    return {
        sourceId,
        name: '',
        enabled: true,
        folders: [],
        includeSubfolders: false,
        filter: defaultFilter(),
        minAge: 30,
        minAgeUnit: 'days',
        action: 'archive',
        scheduleCron: '0 3 * * *',
    };
}

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

export default function RuleForm({
    sources,
    rule,
    onClose,
    onSaved,
}: {
    sources: Source[];
    rule: Rule | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { t } = useI18n();
    const [form, setForm] = useState<RuleInput>(rule ? toInput(rule) : blankRule(sources[0]?.id ?? ''));
    const [plan, setPlanState] = useState<SchedulePlan>(parseCron(rule ? rule.scheduleCron : '0 3 * * *'));
    const [folders, setFolders] = useState<MailboxFolder[] | null>(null);
    const [folderError, setFolderError] = useState<string | null>(null);
    const [cronInfo, setCronInfo] = useState<{ valid: boolean; nextRun: number | null }>({ valid: true, nextRun: null });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const set = <K extends keyof RuleInput>(key: K, value: RuleInput[K]) => setForm((f) => ({ ...f, [key]: value }));
    const setFilter = <K extends keyof RuleInput['filter']>(key: K, value: RuleInput['filter'][K]) =>
        setForm((f) => ({ ...f, filter: { ...f.filter, [key]: value } }));

    // Update the schedule plan and keep form.scheduleCron in sync (the cron is
    // what the backend stores and the scheduler uses).
    const updatePlan = (patch: Partial<SchedulePlan>) => {
        const next = { ...plan, ...patch };
        const cron = next.frequency === 'custom' ? next.cron : buildCron(next);
        setPlanState({ ...next, cron });
        set('scheduleCron', cron);
    };

    // (Re)load the mailbox's folders. Called when the source changes and via the
    // refresh button, so newly created folders show up without reopening.
    const loadFolders = (sourceId: string) => {
        if (!sourceId) return;
        setFolders(null);
        setFolderError(null);
        api.folders(sourceId)
            .then((list) => setFolders(list.filter((f) => f.selectable)))
            .catch((err) => setFolderError(err instanceof Error ? err.message : 'Could not list folders'));
    };
    useEffect(() => {
        loadFolders(form.sourceId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.sourceId]);

    // Validate the cron expression (and compute the next run) as it changes.
    useEffect(() => {
        const timer = setTimeout(() => {
            api.validateCron(form.scheduleCron).then(setCronInfo).catch(() => setCronInfo({ valid: false, nextRun: null }));
        }, 300);
        return () => clearTimeout(timer);
    }, [form.scheduleCron]);

    const toggleFolder = (path: string) => {
        set('folders', form.folders.includes(path) ? form.folders.filter((p) => p !== path) : [...form.folders, path]);
    };

    const toggleWeekday = (day: number) => {
        const has = plan.weekdays.includes(day);
        const weekdays = has ? plan.weekdays.filter((d) => d !== day) : [...plan.weekdays, day];
        updatePlan({ weekdays: weekdays.length ? weekdays : [day] });
    };

    const timeValue = `${pad2(plan.hour)}:${pad2(plan.minute)}`;
    const onTimeChange = (value: string) => {
        const [h, m] = value.split(':').map(Number);
        updatePlan({ hour: Number.isFinite(h) ? h : plan.hour, minute: Number.isFinite(m) ? m : plan.minute });
    };

    const save = async () => {
        setError(null);
        if (!form.sourceId) return setError(t('rf.errChooseMailbox'));
        if (!form.name.trim()) return setError(t('rf.errName'));
        if (form.folders.length === 0) return setError(t('rf.errFolder'));
        if (!cronInfo.valid) return setError(t('rf.errCron'));
        setBusy(true);
        try {
            if (rule) await api.updateRule(rule.id, form);
            else await api.createRule(form);
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('rf.errSave'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            wide
            title={rule ? t('rf.edit') : t('rf.new')}
            onClose={onClose}
            footer={
                <>
                    <Button onClick={onClose}>{t('common.cancel')}</Button>
                    <Button variant="primary" onClick={() => void save()} disabled={busy}>
                        {busy ? <Spinner /> : t('rf.saveRule')}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t('rf.mailbox')}>
                        <Select value={form.sourceId} onChange={(e) => set('sourceId', e.target.value)}>
                            {sources.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label={t('rf.ruleName')}>
                        <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('rf.ruleNamePh')} />
                    </Field>
                </div>

                {/* Folder selection */}
                <div>
                    <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-sm font-medium text-ink">{t('rf.foldersTitle')}</span>
                        <button
                            type="button"
                            onClick={() => loadFolders(form.sourceId)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                            title={t('rf.refreshFolders')}
                        >
                            ↻ {t('rf.refreshFolders')}
                        </button>
                    </div>
                    {folderError ? (
                        <p className="text-sm text-danger">{folderError}</p>
                    ) : !folders ? (
                        <div className="flex items-center gap-2 text-sm text-muted">
                            <Spinner /> {t('rf.loadingFolders')}
                        </div>
                    ) : (
                        <div className="max-h-44 overflow-y-auto rounded-lg border border-line bg-paper/40 p-2">
                            {folders.map((folder) => (
                                <label key={folder.path} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-line/40">
                                    <input
                                        type="checkbox"
                                        className="accent-[var(--color-accent)]"
                                        checked={form.folders.includes(folder.path)}
                                        onChange={() => toggleFolder(folder.path)}
                                    />
                                    <span className="text-sm">{folder.path}</span>
                                    {folder.specialUse && <Badge tone="neutral">{folder.specialUse.replace('\\', '')}</Badge>}
                                </label>
                            ))}
                        </div>
                    )}
                    <p className="mt-1 text-xs text-muted">{t('rf.foldersHint')}</p>
                    <div className="mt-2">
                        <Toggle
                            checked={form.includeSubfolders}
                            onChange={(v) => set('includeSubfolders', v)}
                            label={t('rf.includeSubfolders')}
                        />
                        <p className="mt-1 text-xs text-muted">{t('rf.includeSubfoldersHint')}</p>
                    </div>
                </div>

                {/* Filter */}
                <fieldset className="rounded-lg border border-line p-4">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">{t('rf.filterLegend')}</legend>
                    <div className="flex flex-col gap-3">
                        <Field label={t('rf.fromContains')}>
                            <TagInput values={form.filter.fromContains} onChange={(v) => setFilter('fromContains', v)} placeholder={t('rf.fromPh')} />
                        </Field>
                        <Field label={t('rf.subjectContains')}>
                            <TagInput values={form.filter.subjectContains} onChange={(v) => setFilter('subjectContains', v)} placeholder={t('rf.subjectPh')} />
                        </Field>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                            <Toggle checked={form.filter.requireAttachment} onChange={(v) => setFilter('requireAttachment', v)} label={t('rf.onlyAttachment')} />
                            <Toggle checked={form.filter.seenOnly} onChange={(v) => setFilter('seenOnly', v)} label={t('rf.onlyRead')} />
                            <Toggle checked={form.filter.excludeFlagged} onChange={(v) => setFilter('excludeFlagged', v)} label={t('rf.neverFlagged')} />
                        </div>
                    </div>
                </fieldset>

                {/* Age + action (retention) */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t('rf.olderThan')} hint={t('rf.olderThanHint')}>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                min={0}
                                value={form.minAge}
                                onChange={(e) => set('minAge', Math.max(0, Number(e.target.value)))}
                                className="w-24"
                            />
                            <Select
                                value={form.minAgeUnit}
                                onChange={(e) => set('minAgeUnit', e.target.value as RuleInput['minAgeUnit'])}
                                className="w-32"
                            >
                                <option value="days">{t('rf.days')}</option>
                                <option value="hours">{t('rf.hours')}</option>
                            </Select>
                        </div>
                    </Field>
                    <Field label={t('rf.whatToDo')} hint={form.action === 'archive_delete' ? t('rf.deleteHint') : t('rf.keepHint')}>
                        <Select value={form.action} onChange={(e) => set('action', e.target.value as RuleInput['action'])}>
                            <option value="archive">{t('rf.archiveOnlyOpt')}</option>
                            <option value="archive_delete">{t('rf.archiveDeleteOpt')}</option>
                        </Select>
                    </Field>
                </div>

                {/* Schedule builder */}
                <fieldset className="rounded-lg border border-line p-4">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">{t('rf.schedule')}</legend>
                    <div className="flex flex-col gap-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Field label={t('rf.frequency')}>
                                <Select
                                    value={plan.frequency}
                                    onChange={(e) => updatePlan({ frequency: e.target.value as Frequency })}
                                >
                                    <option value="hourly">{t('rf.freqHourly')}</option>
                                    <option value="daily">{t('rf.freqDaily')}</option>
                                    <option value="weekly">{t('rf.freqWeekly')}</option>
                                    <option value="monthly">{t('rf.freqMonthly')}</option>
                                    <option value="custom">{t('rf.freqCustom')}</option>
                                </Select>
                            </Field>

                            {plan.frequency === 'hourly' && (
                                <Field label={t('rf.minute')}>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={59}
                                        value={plan.minute}
                                        onChange={(e) => updatePlan({ minute: Math.max(0, Math.min(59, Number(e.target.value))) })}
                                        className="w-24"
                                    />
                                </Field>
                            )}

                            {(plan.frequency === 'daily' || plan.frequency === 'weekly' || plan.frequency === 'monthly') && (
                                <Field label={t('rf.time')}>
                                    <Input type="time" value={timeValue} onChange={(e) => onTimeChange(e.target.value)} className="w-32" />
                                </Field>
                            )}

                            {plan.frequency === 'monthly' && (
                                <Field label={t('rf.dayOfMonth')}>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={28}
                                        value={plan.dayOfMonth}
                                        onChange={(e) => updatePlan({ dayOfMonth: Math.max(1, Math.min(28, Number(e.target.value))) })}
                                        className="w-24"
                                    />
                                </Field>
                            )}
                        </div>

                        {plan.frequency === 'weekly' && (
                            <div>
                                <div className="mb-1.5 text-sm font-medium text-ink">{t('rf.weekdays')}</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {WEEKDAY_ORDER.map((day) => (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => toggleWeekday(day)}
                                            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                                                plan.weekdays.includes(day)
                                                    ? 'border-accent bg-accent text-white'
                                                    : 'border-line text-muted hover:text-ink'
                                            }`}
                                            aria-pressed={plan.weekdays.includes(day)}
                                        >
                                            {t(`wd.${day}`)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {plan.frequency === 'custom' && (
                            <Field label={t('rf.cronExpr')}>
                                <Input
                                    value={form.scheduleCron}
                                    onChange={(e) => updatePlan({ cron: e.target.value })}
                                    className={`font-mono ${cronInfo.valid ? '' : 'border-danger'}`}
                                />
                            </Field>
                        )}

                        <p className="text-xs text-muted">
                            {cronInfo.valid ? t('rf.nextRun', { time: formatDate(cronInfo.nextRun) }) : t('rf.invalidCron')}
                            <span className="ml-2 font-mono opacity-60">{form.scheduleCron}</span>
                        </p>
                    </div>
                </fieldset>

                <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} label={t('rf.enabled')} />

                {error && <p className="text-sm text-danger">{error}</p>}
            </div>
        </Modal>
    );
}

function toInput(rule: Rule): RuleInput {
    return {
        sourceId: rule.sourceId,
        name: rule.name,
        enabled: rule.enabled,
        folders: rule.folders,
        includeSubfolders: rule.includeSubfolders,
        filter: rule.filter,
        minAge: rule.minAge,
        minAgeUnit: rule.minAgeUnit,
        action: rule.action,
        scheduleCron: rule.scheduleCron,
    };
}
