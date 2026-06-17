import { useEffect, useState } from 'react';
import { Badge, Button, Field, Input, Modal, Select, Spinner, TagInput, Toggle } from '../components/ui.js';
import { api, defaultFilter, type MailboxFolder, type Rule, type RuleInput, type Source } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { CRON_PRESETS, useI18n } from '../lib/i18n.js';

/**
 * The full rule editor. This is where the four headline features live:
 * folder selection, the filter, the per-rule schedule and the
 * archive-then-delete retention action.
 */

function blankRule(sourceId: string): RuleInput {
    return {
        sourceId,
        name: '',
        enabled: true,
        folders: [],
        filter: defaultFilter(),
        minAgeDays: 30,
        action: 'archive',
        scheduleCron: '0 3 * * *',
    };
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
    const [folders, setFolders] = useState<MailboxFolder[] | null>(null);
    const [folderError, setFolderError] = useState<string | null>(null);
    const [cronInfo, setCronInfo] = useState<{ valid: boolean; nextRun: number | null }>({ valid: true, nextRun: null });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cronOptions = CRON_PRESETS.map((p) => ({ value: p.value, label: t(p.key) }));

    const set = <K extends keyof RuleInput>(key: K, value: RuleInput[K]) => setForm((f) => ({ ...f, [key]: value }));
    const setFilter = <K extends keyof RuleInput['filter']>(key: K, value: RuleInput['filter'][K]) =>
        setForm((f) => ({ ...f, filter: { ...f.filter, [key]: value } }));

    // Load the mailbox's folders whenever the selected source changes.
    useEffect(() => {
        if (!form.sourceId) return;
        setFolders(null);
        setFolderError(null);
        api.folders(form.sourceId)
            .then((list) => setFolders(list.filter((f) => f.selectable)))
            .catch((err) => setFolderError(err instanceof Error ? err.message : 'Could not list folders'));
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
                    <div className="mb-1.5 text-sm font-medium text-ink">{t('rf.foldersTitle')}</div>
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
                                value={form.minAgeDays}
                                onChange={(e) => set('minAgeDays', Math.max(0, Number(e.target.value)))}
                                className="w-28"
                            />
                            <span className="text-sm text-muted">{t('rf.days')}</span>
                        </div>
                    </Field>
                    <Field label={t('rf.whatToDo')} hint={form.action === 'archive_delete' ? t('rf.deleteHint') : t('rf.keepHint')}>
                        <Select value={form.action} onChange={(e) => set('action', e.target.value as RuleInput['action'])}>
                            <option value="archive">{t('rf.archiveOnlyOpt')}</option>
                            <option value="archive_delete">{t('rf.archiveDeleteOpt')}</option>
                        </Select>
                    </Field>
                </div>

                {/* Schedule */}
                <Field label={t('rf.schedule')} hint={cronInfo.valid ? t('rf.nextRun', { time: formatDate(cronInfo.nextRun) }) : t('rf.invalidCron')}>
                    <div className="flex flex-wrap gap-2">
                        <Select
                            value={cronOptions.some((o) => o.value === form.scheduleCron) ? form.scheduleCron : ''}
                            onChange={(e) => e.target.value && set('scheduleCron', e.target.value)}
                            className="max-w-[18rem]"
                        >
                            <option value="">{t('rf.custom')}</option>
                            {cronOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </Select>
                        <Input
                            value={form.scheduleCron}
                            onChange={(e) => set('scheduleCron', e.target.value)}
                            className={`max-w-[14rem] font-mono ${cronInfo.valid ? '' : 'border-danger'}`}
                        />
                    </div>
                </Field>

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
        filter: rule.filter,
        minAgeDays: rule.minAgeDays,
        action: rule.action,
        scheduleCron: rule.scheduleCron,
    };
}
