import { useState } from 'react';
import { Button, Card, Input } from '../components/ui.js';
import { api } from '../lib/api.js';

export default function Login({ onSuccess }: { onSuccess: () => void }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await api.login(password);
            onSuccess();
        } catch {
            setError('Wrong password.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex min-h-full items-center justify-center px-4">
            <Card className="w-full max-w-sm p-8">
                <div className="mb-6 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-white">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 7l2-3h14l2 3v12a1 1 0 01-1 1H4a1 1 0 01-1-1V7z" />
                            <path d="M3 7h18M9 12h6" strokeLinecap="round" />
                        </svg>
                    </span>
                    <div>
                        <div className="text-lg font-semibold">SelfArchiver</div>
                        <div className="font-mono text-xs text-muted">sign in to continue</div>
                    </div>
                </div>
                <form onSubmit={submit} className="flex flex-col gap-4">
                    <Input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                    />
                    {error && <p className="text-sm text-danger">{error}</p>}
                    <Button variant="primary" type="submit" disabled={busy || !password}>
                        Sign in
                    </Button>
                </form>
            </Card>
        </div>
    );
}
