import { useEffect, type ReactNode } from 'react';

/** Shared UI primitives. Styling leans on the design tokens in index.css. */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-white hover:bg-accent/90 border border-transparent',
    secondary: 'bg-surface text-ink border border-line hover:border-accent/50',
    ghost: 'bg-transparent text-muted hover:text-ink hover:bg-line/40 border border-transparent',
    danger: 'bg-danger text-white hover:bg-danger/90 border border-transparent',
};

export function Button({
    variant = 'secondary',
    className = '',
    children,
    ...props
}: { variant?: ButtonVariant } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
    return (
        <div
            className={`rounded-[var(--radius-card)] border border-line bg-surface shadow-[0_1px_2px_rgba(28,26,23,0.04),0_8px_24px_-16px_rgba(28,26,23,0.18)] ${className}`}
        >
            {children}
        </div>
    );
}

type BadgeTone = 'neutral' | 'accent' | 'teal' | 'danger';
const BADGE_TONES: Record<BadgeTone, string> = {
    neutral: 'bg-line/50 text-muted',
    accent: 'bg-accent-soft text-accent',
    teal: 'bg-teal-soft text-teal',
    danger: 'bg-danger-soft text-danger',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs font-medium ${BADGE_TONES[tone]}`}
        >
            {children}
        </span>
    );
}

export function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{label}</span>
            {children}
            {hint && <span className="text-xs text-muted">{hint}</span>}
        </label>
    );
}

const INPUT_CLASS =
    'w-full rounded-lg border border-line bg-paper/60 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:bg-surface';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return <input className={`${INPUT_CLASS} ${props.className ?? ''}`} {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return <select className={`${INPUT_CLASS} ${props.className ?? ''}`} {...props} />;
}

export function Toggle({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className="flex items-center gap-2.5 text-left"
            aria-pressed={checked}
        >
            <span
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-teal' : 'bg-line'}`}
            >
                <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
            </span>
            <span className="text-sm text-ink">{label}</span>
        </button>
    );
}

export function Spinner({ className = '' }: { className?: string }) {
    return (
        <svg className={`h-4 w-4 animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
    );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 px-6 py-14 text-center">
            <h3 className="text-base font-semibold text-ink">{title}</h3>
            <p className="max-w-sm text-sm text-muted">{description}</p>
            {action}
        </div>
    );
}

export function Modal({
    title,
    onClose,
    children,
    footer,
    wide = false,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    wide?: boolean;
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:p-8"
            onMouseDown={onClose}
        >
            <Card className={`my-4 w-full ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
                <div onMouseDown={(e) => e.stopPropagation()}>
                    <header className="flex items-center justify-between border-b border-line px-5 py-4">
                        <h2 className="text-lg font-semibold text-ink">{title}</h2>
                        <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close">
                            ✕
                        </button>
                    </header>
                    <div className="px-5 py-5">{children}</div>
                    {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</footer>}
                </div>
            </Card>
        </div>
    );
}

/** Editable list of substrings (used for filter "contains" conditions). */
export function TagInput({
    values,
    onChange,
    placeholder,
}: {
    values: string[];
    onChange: (v: string[]) => void;
    placeholder?: string;
}) {
    return (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-paper/60 p-1.5">
            {values.map((value, i) => (
                <span
                    key={`${value}-${i}`}
                    className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-1 font-mono text-xs text-accent"
                >
                    {value}
                    <button
                        type="button"
                        onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                        className="text-accent/70 hover:text-accent"
                        aria-label={`Remove ${value}`}
                    >
                        ✕
                    </button>
                </span>
            ))}
            <input
                className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted/60"
                placeholder={placeholder}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const value = e.currentTarget.value.trim();
                        if (value && !values.includes(value)) onChange([...values, value]);
                        e.currentTarget.value = '';
                    }
                }}
            />
        </div>
    );
}
