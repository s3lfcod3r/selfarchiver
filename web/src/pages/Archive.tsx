import { useEffect, useState } from 'react';
import { PageHeader } from '../components/Layout.js';
import { Badge, Button, Card, EmptyState, Input, Select, Spinner } from '../components/ui.js';
import { api, type ArchivedEmail, type Source } from '../lib/api.js';
import { formatBytes, formatDate } from '../lib/format.js';
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

export default function Archive() {
    const { t } = useI18n();
    const [sources, setSources] = useState<Source[]>([]);
    const [folders, setFolders] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const [sourceId, setSourceId] = useState('');
    const [folder, setFolder] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [items, setItems] = useState<ArchivedEmail[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        void api.listSources().then(setSources);
    }, []);

    // Folder options depend on the selected mailbox; reset folder when it changes.
    useEffect(() => {
        setFolder('');
        api.archiveFolders(sourceId || undefined)
            .then(setFolders)
            .catch(() => setFolders([]));
    }, [sourceId]);

    const query = (offset: number, append: boolean) => {
        setLoading(true);
        api.listEmails({
            search: search || undefined,
            sourceId: sourceId || undefined,
            folder: folder || undefined,
            from: startOfDayMs(fromDate),
            to: endOfDayMs(toDate),
            limit: PAGE,
            offset,
        })
            .then((res) => {
                setTotal(res.total);
                setItems((prev) => (append ? [...prev, ...res.items] : res.items));
            })
            .finally(() => setLoading(false));
    };

    // Debounced reload whenever any filter changes.
    useEffect(() => {
        const timer = setTimeout(() => query(0, false), 250);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, sourceId, folder, fromDate, toDate]);

    return (
        <>
            <PageHeader title={t('nav.archive')} subtitle={t('arch.subtitle', { n: total.toLocaleString() })} />

            <div className="mb-5 flex flex-col gap-3">
                <Input placeholder={t('arch.searchPh')} value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="flex flex-wrap gap-3">
                    <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="max-w-[14rem]">
                        <option value="">{t('arch.allMailboxes')}</option>
                        {sources.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </Select>
                    <Select value={folder} onChange={(e) => setFolder(e.target.value)} className="max-w-[14rem]">
                        <option value="">{t('arch.allFolders')}</option>
                        {folders.map((f) => (
                            <option key={f} value={f}>
                                {f}
                            </option>
                        ))}
                    </Select>
                    <label className="flex items-center gap-2 text-xs text-muted">
                        {t('arch.from')}
                        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-auto" />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-muted">
                        {t('arch.to')}
                        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-auto" />
                    </label>
                </div>
            </div>

            {items.length === 0 && !loading ? (
                <EmptyState title={t('arch.nothing')} description={t('arch.nothingDesc')} />
            ) : (
                <Card className="overflow-hidden">
                    <ul className="divide-y divide-line">
                        {items.map((email) => (
                            <li key={email.id} className="flex items-center gap-4 px-5 py-3.5">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-medium">{email.subject || t('arch.noSubject')}</span>
                                        {email.hasAttachments && <Badge tone="accent">📎 {email.attachmentNames.length}</Badge>}
                                    </div>
                                    <div className="truncate font-mono text-xs text-muted">
                                        {email.fromAddr || t('arch.unknown')} · {email.folder}
                                    </div>
                                </div>
                                <div className="hidden text-right font-mono text-xs text-muted sm:block">
                                    <div>{formatDate(email.sentAt)}</div>
                                    <div>{formatBytes(email.size)}</div>
                                </div>
                                <a href={api.downloadUrl(email.id)} className="text-sm font-medium text-accent hover:underline">
                                    .eml
                                </a>
                            </li>
                        ))}
                    </ul>
                    {items.length < total && (
                        <div className="flex justify-center border-t border-line p-4">
                            <Button onClick={() => query(items.length, true)} disabled={loading}>
                                {loading ? <Spinner /> : t('arch.loadMore', { n: total - items.length })}
                            </Button>
                        </div>
                    )}
                </Card>
            )}
        </>
    );
}
