import { useEffect, useState } from 'react';
import { PageHeader } from '../components/Layout.js';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Spinner, Toggle } from '../components/ui.js';
import { api, type Source, type SourceFormValues } from '../lib/api.js';
import { relativeTime } from '../lib/format.js';

const BLANK: SourceFormValues = { name: '', host: '', port: 993, secure: true, username: '', password: '' };

export default function Sources() {
    const [sources, setSources] = useState<Source[] | null>(null);
    const [editing, setEditing] = useState<{ id: string | null; values: SourceFormValues } | null>(null);
    const [testing, setTesting] = useState<string | null>(null);

    const load = () => api.listSources().then(setSources);
    useEffect(() => {
        void load();
    }, []);

    const onTest = async (id: string) => {
        setTesting(id);
        try {
            const result = await api.testSource(id);
            alert(result.ok ? 'Connection OK' : `Failed: ${result.error}`);
            await load();
        } finally {
            setTesting(null);
        }
    };

    const onDelete = async (s: Source) => {
        if (!confirm(`Delete mailbox "${s.name}"? Rules using it are removed too. Archived emails are kept.`)) return;
        await api.deleteSource(s.id);
        await load();
    };

    return (
        <>
            <PageHeader
                title="Mailboxes"
                subtitle="IMAP accounts SelfArchiver connects to."
                action={
                    <Button variant="primary" onClick={() => setEditing({ id: null, values: { ...BLANK } })}>
                        + Add mailbox
                    </Button>
                }
            />

            {!sources ? (
                <div className="flex justify-center py-20 text-muted">
                    <Spinner />
                </div>
            ) : sources.length === 0 ? (
                <EmptyState
                    title="No mailboxes"
                    description="Add an IMAP mailbox (host, username, password) to start archiving from it."
                    action={
                        <Button variant="primary" onClick={() => setEditing({ id: null, values: { ...BLANK } })}>
                            + Add mailbox
                        </Button>
                    }
                />
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {sources.map((s) => (
                        <Card key={s.id} className="p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-semibold">{s.name}</div>
                                    <div className="truncate font-mono text-xs text-muted">
                                        {s.username} · {s.host}:{s.port}
                                    </div>
                                </div>
                                <Badge tone={s.status === 'ok' ? 'teal' : s.status === 'error' ? 'danger' : 'neutral'}>
                                    {s.status}
                                </Badge>
                            </div>
                            {s.lastError && <p className="mt-2 text-xs text-danger">{s.lastError}</p>}
                            <div className="mt-4 flex items-center justify-between">
                                <span className="font-mono text-xs text-muted">checked {relativeTime(s.lastCheckedAt)}</span>
                                <div className="flex gap-2">
                                    <Button onClick={() => void onTest(s.id)} disabled={testing === s.id}>
                                        {testing === s.id ? <Spinner /> : 'Test'}
                                    </Button>
                                    <Button
                                        onClick={() =>
                                            setEditing({
                                                id: s.id,
                                                values: { name: s.name, host: s.host, port: s.port, secure: s.secure, username: s.username, password: '' },
                                            })
                                        }
                                    >
                                        Edit
                                    </Button>
                                    <Button variant="ghost" onClick={() => void onDelete(s)}>
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {editing && (
                <SourceModal
                    id={editing.id}
                    initial={editing.values}
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

function SourceModal({
    id,
    initial,
    onClose,
    onSaved,
}: {
    id: string | null;
    initial: SourceFormValues;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [values, setValues] = useState<SourceFormValues>(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const set = <K extends keyof SourceFormValues>(key: K, value: SourceFormValues[K]) =>
        setValues((v) => ({ ...v, [key]: value }));

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            const result = id ? await api.updateSource(id, values) : await api.createSource(values);
            if (!result.connectionOk) {
                setError(`Saved, but connection failed: ${result.error}`);
                setTimeout(onSaved, 1200);
                return;
            }
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            title={id ? 'Edit mailbox' : 'Add mailbox'}
            onClose={onClose}
            footer={
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={() => void save()} disabled={busy}>
                        {busy ? <Spinner /> : 'Save & test'}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <Field label="Name">
                    <Input value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="Private Gmail" />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                        <Field label="IMAP host">
                            <Input value={values.host} onChange={(e) => set('host', e.target.value)} placeholder="imap.example.com" />
                        </Field>
                    </div>
                    <Field label="Port">
                        <Input type="number" value={values.port} onChange={(e) => set('port', Number(e.target.value))} />
                    </Field>
                </div>
                <Toggle checked={values.secure} onChange={(v) => set('secure', v)} label="Use TLS (recommended)" />
                <Field label="Username">
                    <Input value={values.username} onChange={(e) => set('username', e.target.value)} placeholder="you@example.com" />
                </Field>
                <Field label="Password" hint={id ? 'Leave empty to keep the current password.' : 'Use an app password where available.'}>
                    <Input type="password" value={values.password ?? ''} onChange={(e) => set('password', e.target.value)} />
                </Field>
                {error && <p className="text-sm text-danger">{error}</p>}
            </div>
        </Modal>
    );
}
