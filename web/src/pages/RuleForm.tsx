import { useEffect, useState } from 'react';
import { Badge, Button, Field, Input, Modal, Select, Spinner, TagInput, Toggle } from '../components/ui.js';
import { api, defaultFilter, type MailboxFolder, type Rule, type RuleInput, type Source } from '../lib/api.js';
import { CRON_OPTIONS, formatDate } from '../lib/format.js';

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
    const [form, setForm] = useState<RuleInput>(rule ? toInput(rule) : blankRule(sources[0]?.id ?? ''));
    const [folders, setFolders] = useState<MailboxFolder[] | null>(null);
    const [folderError, setFolderError] = useState<string | null>(null);
    const [cronInfo, setCronInfo] = useState<{ valid: boolean; nextRun: number | null }>({ valid: true, nextRun: null });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        const t = setTimeout(() => {
            api.validateCron(form.scheduleCron).then(setCronInfo).catch(() => setCronInfo({ valid: false, nextRun: null }));
        }, 300);
        return () => clearTimeout(t);
    }, [form.scheduleCron]);

    const toggleFolder = (path: string) => {
        set('folders', form.folders.includes(path) ? form.folders.filter((p) => p !== path) : [...form.folders, path]);
    };

    const save = async () => {
        setError(null);
        if (!form.sourceId) return setError('Choose a mailbox.');
        if (!form.name.trim()) return setError('Give the rule a name.');
        if (form.folders.length === 0) return setError('Select at least one folder.');
        if (!cronInfo.valid) return setError('The schedule is not a valid cron expression.');
        setBusy(true);
        try {
            if (rule) await api.updateRule(rule.id, form);
            else await api.createRule(form);
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save rule');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            wide
            title={rule ? 'Edit rule' : 'New rule'}
            onClose={onClose}
            footer={
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={() => void save()} disabled={busy}>
                        {busy ? <Spinner /> : 'Save rule'}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Mailbox">
                        <Select value={form.sourceId} onChange={(e) => set('sourceId', e.target.value)}>
                            {sources.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Rule name">
                        <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Archive invoices" />
                    </Field>
                </div>

                {/* Folder selection */}
                <div>
                    <div className="mb-1.5 text-sm font-medium text-ink">Folders to archive</div>
                    {folderError ? (
                        <p className="text-sm text-danger">{folderError}</p>
                    ) : !folders ? (
                        <div className="flex items-center gap-2 text-sm text-muted">
                            <Spinner /> Loading folders…
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
                    <p className="mt-1 text-xs text-muted">Only the folders you tick are touched — the rest of the mailbox (incl. spam) is left alone.</p>
                </div>

                {/* Filter */}
                <fieldset className="rounded-lg border border-line p-4">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Filter (all conditions must match)</legend>
                    <div className="flex flex-col gap-3">
                        <Field label="From contains any of">
                            <TagInput values={form.filter.fromContains} onChange={(v) => setFilter('fromContains', v)} placeholder="e.g. rechnung@, @amazon.de — press Enter" />
                        </Field>
                        <Field label="Subject contains any of">
                            <TagInput values={form.filter.subjectContains} onChange={(v) => setFilter('subjectContains', v)} placeholder="e.g. Rechnung, Invoice — press Enter" />
                        </Field>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                            <Toggle checked={form.filter.requireAttachment} onChange={(v) => setFilter('requireAttachment', v)} label="Only with attachment" />
                            <Toggle checked={form.filter.seenOnly} onChange={(v) => setFilter('seenOnly', v)} label="Only already-read mail" />
                            <Toggle checked={form.filter.excludeFlagged} onChange={(v) => setFilter('excludeFlagged', v)} label="Never touch flagged mail" />
                        </div>
                    </div>
                </fieldset>

                {/* Age + action (retention) */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Only mails older than" hint="Days. Younger mail is left in place.">
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                min={0}
                                value={form.minAgeDays}
                                onChange={(e) => set('minAgeDays', Math.max(0, Number(e.target.value)))}
                                className="w-28"
                            />
                            <span className="text-sm text-muted">days</span>
                        </div>
                    </Field>
                    <Field label="What to do" hint={form.action === 'archive_delete' ? '⚠ Deletes from the mailbox after archiving.' : 'Keeps the original in the mailbox.'}>
                        <Select value={form.action} onChange={(e) => set('action', e.target.value as RuleInput['action'])}>
                            <option value="archive">Archive only</option>
                            <option value="archive_delete">Archive, then delete from mailbox</option>
                        </Select>
                    </Field>
                </div>

                {/* Schedule */}
                <Field label="Schedule" hint={cronInfo.valid ? `Next run: ${formatDate(cronInfo.nextRun)}` : 'Invalid cron expression'}>
                    <div className="flex flex-wrap gap-2">
                        <Select
                            value={CRON_OPTIONS.some((o) => o.value === form.scheduleCron) ? form.scheduleCron : ''}
                            onChange={(e) => e.target.value && set('scheduleCron', e.target.value)}
                            className="max-w-[18rem]"
                        >
                            <option value="">Custom…</option>
                            {CRON_OPTIONS.map((o) => (
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

                <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} label="Rule enabled" />

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
