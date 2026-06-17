import { useState } from 'react';
import { LanguageToggle, ThemeToggle } from '../components/Layout.js';
import { Button, Card, Input } from '../components/ui.js';
import { api } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';

export default function Login({ onSuccess }: { onSuccess: () => void }) {
    const { t } = useI18n();
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
            setError(t('login.wrong'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4">
            <Card className="w-full max-w-sm p-8">
                <div className="mb-6 flex flex-col items-center gap-2 text-center">
                    <img src="/logo-wide.png" alt="SelfArchiver" className="h-12 w-auto" />
                    <div className="font-mono text-xs text-muted">{t('login.subtitle')}</div>
                </div>
                <form onSubmit={submit} className="flex flex-col gap-4">
                    <Input
                        type="password"
                        placeholder={t('login.password')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                    />
                    {error && <p className="text-sm text-danger">{error}</p>}
                    <Button variant="primary" type="submit" disabled={busy || !password}>
                        {t('login.signIn')}
                    </Button>
                </form>
            </Card>
            <div className="flex gap-2">
                <ThemeToggle />
                <LanguageToggle />
            </div>
        </div>
    );
}
