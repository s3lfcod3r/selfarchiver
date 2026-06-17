import { useEffect, useState } from 'react';
import { PageHeader } from '../components/Layout.js';
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Spinner } from '../components/ui.js';
import { api, type ArchivedEmail, type Source } from '../lib/api.js';
import { formatBytes, formatDate } from '../lib/format.js';
import { useI18n } from '../lib/i18n.js';
import { useTheme } from '../lib/theme.js';

/**
 * Render archived HTML inside a document whose base colours follow the app
 * theme, so plain emails (no own styling) blend into dark mode instead of
 * showing a glaring white box. Emails with their own colours keep them.
 */
function wrapEmailHtml(html: string, dark: boolean): string {
    const bg = dark ? '#0d1117' : '#ffffff';
    const fg = dark ? '#e6edf3' : '#111827';
    const link = dark ? '#2dd4bf' : '#0f766e';
    return `<!doctype html><html><head><meta charset="utf-8"><style>
        html,body{margin:0;padding:14px;background:${bg};color:${fg};
            font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;}
        a{color:${link};} img{max-width:100%;height:auto;}
    </style></head><body>${html}</body></html>`;
}

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
    const [viewing, setViewing] = useState<ArchivedEmail | null>(null);

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

    const removeEmail = async (email: ArchivedEmail) => {
        if (!confirm(t('arch.deleteConfirm'))) return;
        await api.deleteEmail(email.id);
        query(0, false);
    };

    const removeFolder = async () => {
        if (!folder || !confirm(t('arch.deleteFolderConfirm', { folder }))) return;
        await api.deleteFolder(folder, sourceId || undefined);
        setFolder(''); // resets selection and triggers a reload via the effect
    };

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
                    {folder && (
                        <Button variant="danger" onClick={() => void removeFolder()}>
                            {t('arch.deleteFolder')}
                        </Button>
                    )}
                </div>
            </div>

            {items.length === 0 && !loading ? (
                <EmptyState title={t('arch.nothing')} description={t('arch.nothingDesc')} />
            ) : (
                <Card className="overflow-hidden">
                    <ul className="divide-y divide-line">
                        {items.map((email) => (
                            <li key={email.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-line/30">
                                <button onClick={() => setViewing(email)} className="min-w-0 flex-1 text-left">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-medium hover:text-accent">
                                            {email.subject || t('arch.noSubject')}
                                        </span>
                                        {email.hasAttachments && <Badge tone="accent">📎 {email.attachmentNames.length}</Badge>}
                                    </div>
                                    <div className="truncate font-mono text-xs text-muted">
                                        {email.fromAddr || t('arch.unknown')} · {email.folder}
                                    </div>
                                </button>
                                <div className="hidden text-right font-mono text-xs text-muted sm:block">
                                    <div>{formatDate(email.sentAt)}</div>
                                    <div>{formatBytes(email.size)}</div>
                                </div>
                                <a href={api.downloadUrl(email.id)} className="text-sm font-medium text-accent hover:underline">
                                    .eml
                                </a>
                                <button
                                    onClick={() => void removeEmail(email)}
                                    className="text-muted transition-colors hover:text-danger"
                                    title={t('arch.delete')}
                                    aria-label={t('arch.delete')}
                                >
                                    🗑
                                </button>
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

            {viewing && <EmailViewer email={viewing} onClose={() => setViewing(null)} />}
        </>
    );
}

function EmailViewer({ email, onClose }: { email: ArchivedEmail; onClose: () => void }) {
    const { t } = useI18n();
    const { theme } = useTheme();
    const [content, setContent] = useState<Awaited<ReturnType<typeof api.emailContent>> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'text' | 'html'>('text');

    useEffect(() => {
        api.emailContent(email.id)
            .then((c) => {
                setContent(c);
                setMode(c.text ? 'text' : c.html ? 'html' : 'text');
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'error'));
    }, [email.id]);

    return (
        <Modal
            wide
            title={email.subject || t('arch.noSubject')}
            onClose={onClose}
            footer={
                <>
                    <a href={api.downloadUrl(email.id)} className="mr-auto text-sm font-medium text-accent hover:underline">
                        .eml
                    </a>
                    <Button onClick={onClose}>{t('common.close')}</Button>
                </>
            }
        >
            <div className="flex flex-col gap-3">
                <div className="rounded-lg border border-line bg-paper/40 p-3 font-mono text-xs text-muted">
                    <div>{email.fromAddr || t('arch.unknown')}</div>
                    <div>
                        {email.folder} · {formatDate(email.sentAt)} · {formatBytes(email.size)}
                    </div>
                    {email.attachmentNames.length > 0 && <div className="mt-1">📎 {email.attachmentNames.length}</div>}
                </div>

                {content && content.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {content.attachments.map((a) => (
                            <a
                                key={a.index}
                                href={api.attachmentUrl(email.id, a.index)}
                                download
                                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper/40 px-2.5 py-1.5 text-xs text-accent hover:border-accent/50"
                            >
                                📎 {a.filename}
                                {a.size ? <span className="text-muted">· {formatBytes(a.size)}</span> : null}
                            </a>
                        ))}
                    </div>
                )}

                {error ? (
                    <p className="text-sm text-danger">{error}</p>
                ) : !content ? (
                    <div className="flex justify-center py-10 text-muted">
                        <Spinner />
                    </div>
                ) : content.text || content.html ? (
                    <>
                        {content.text && content.html && (
                            <div className="inline-flex w-fit items-center gap-1 rounded-lg border border-line bg-surface p-1 text-xs font-medium">
                                <button
                                    onClick={() => setMode('text')}
                                    className={`rounded-md px-2.5 py-1 ${mode === 'text' ? 'bg-accent text-white' : 'text-muted'}`}
                                >
                                    {t('arch.plain')}
                                </button>
                                <button
                                    onClick={() => setMode('html')}
                                    className={`rounded-md px-2.5 py-1 ${mode === 'html' ? 'bg-accent text-white' : 'text-muted'}`}
                                >
                                    {t('arch.formatted')}
                                </button>
                            </div>
                        )}
                        {mode === 'html' && content.html ? (
                            // Sandboxed (no scripts) so archived HTML can't run anything.
                            <iframe
                                sandbox=""
                                srcDoc={wrapEmailHtml(content.html, theme === 'dark')}
                                title="email"
                                className="h-[55vh] w-full rounded-lg border border-line bg-surface"
                            />
                        ) : (
                            <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-paper/40 p-3 text-sm">
                                {content.text || ''}
                            </pre>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-muted">{t('arch.noContent')}</p>
                )}
            </div>
        </Modal>
    );
}
