import { useEffect, useState } from 'react';
import { PageHeader } from '../components/Layout.js';
import { Badge, Button, Card, EmptyState, Input, Select, Spinner } from '../components/ui.js';
import { api, type ArchivedEmail, type Source } from '../lib/api.js';
import { formatBytes, formatDate } from '../lib/format.js';

const PAGE = 50;

export default function Archive() {
    const [sources, setSources] = useState<Source[]>([]);
    const [search, setSearch] = useState('');
    const [sourceId, setSourceId] = useState('');
    const [items, setItems] = useState<ArchivedEmail[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        void api.listSources().then(setSources);
    }, []);

    const query = (offset: number, append: boolean) => {
        setLoading(true);
        api.listEmails({ search: search || undefined, sourceId: sourceId || undefined, limit: PAGE, offset })
            .then((res) => {
                setTotal(res.total);
                setItems((prev) => (append ? [...prev, ...res.items] : res.items));
            })
            .finally(() => setLoading(false));
    };

    // Debounced search whenever the query or source filter changes.
    useEffect(() => {
        const t = setTimeout(() => query(0, false), 250);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, sourceId]);

    return (
        <>
            <PageHeader title="Archive" subtitle={`${total.toLocaleString()} emails stored and searchable.`} />

            <div className="mb-5 flex flex-wrap gap-3">
                <div className="min-w-[16rem] flex-1">
                    <Input
                        placeholder="Search subject, sender, recipient, body…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="max-w-[16rem]">
                    <option value="">All mailboxes</option>
                    {sources.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </Select>
            </div>

            {items.length === 0 && !loading ? (
                <EmptyState
                    title="Nothing here yet"
                    description="Once a rule archives mail, it shows up here — full-text searchable, downloadable as .eml."
                />
            ) : (
                <Card className="overflow-hidden">
                    <ul className="divide-y divide-line">
                        {items.map((email) => (
                            <li key={email.id} className="flex items-center gap-4 px-5 py-3.5">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-medium">{email.subject || '(no subject)'}</span>
                                        {email.hasAttachments && <Badge tone="accent">📎 {email.attachmentNames.length}</Badge>}
                                    </div>
                                    <div className="truncate font-mono text-xs text-muted">
                                        {email.fromAddr || 'unknown'} · {email.folder}
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
                                {loading ? <Spinner /> : `Load more (${total - items.length} left)`}
                            </Button>
                        </div>
                    )}
                </Card>
            )}
        </>
    );
}
