import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useI18n, LANGS, type Lang } from '../lib/i18n.js';
import { useTheme } from '../lib/theme.js';

/** App shell: branded, collapsible sidebar + routed content area. */

const APP_VERSION = 'v1.0';
const WEBSITE_URL = 'https://selfcoder.de';
const REPO_URL = 'https://github.com/s3lfcod3r/selfarchiver';

const NAV: { to: string; key: string; icon: ReactNode }[] = [
    { to: '/', key: 'nav.overview', icon: <IconGrid /> },
    { to: '/sources', key: 'nav.mailboxes', icon: <IconMail /> },
    { to: '/rules', key: 'nav.rules', icon: <IconRules /> },
    { to: '/archive', key: 'nav.archive', icon: <IconArchive /> },
    { to: '/runs', key: 'nav.activity', icon: <IconClock /> },
];

function readCollapsed(): boolean {
    try {
        return localStorage.getItem('sa_sidebar') === '1';
    } catch {
        return false;
    }
}

export default function Layout({ authRequired }: { authRequired: boolean }) {
    const { t } = useI18n();
    const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);

    const toggleCollapsed = () => {
        setCollapsed((c) => {
            const next = !c;
            try {
                localStorage.setItem('sa_sidebar', next ? '1' : '0');
            } catch {
                // ignore
            }
            return next;
        });
    };

    const [mobileOpen, setMobileOpen] = useState(false);

    // `collapsed` only narrows the sidebar on md+; on mobile the nav stays full.
    const hideWhenCollapsed = collapsed ? 'md:hidden' : '';

    return (
        <div className="flex min-h-full flex-col md:flex-row">
            {/* Mobile top bar */}
            <header className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
                <img src="/logo-wide.png" alt="SelfArchiver" className="h-8 w-auto" />
                <button
                    type="button"
                    onClick={() => setMobileOpen((o) => !o)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line text-lg text-muted hover:text-ink"
                    aria-label="Menu"
                    aria-expanded={mobileOpen}
                >
                    {mobileOpen ? '✕' : '☰'}
                </button>
            </header>

            {/* Mobile drawer */}
            {mobileOpen && (
                <div className="flex flex-col gap-1 border-b border-line px-3 py-3 md:hidden">
                    {NAV.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            onClick={() => setMobileOpen(false)}
                            className={({ isActive }) =>
                                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                                    isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-accent-soft hover:text-accent'
                                }`
                            }
                        >
                            <span className="shrink-0">{item.icon}</span>
                            {t(item.key)}
                        </NavLink>
                    ))}
                    <div className="mt-2 flex items-center gap-2 px-1">
                        <ThemeToggle />
                        <LanguageToggle />
                        <span className="ml-auto font-mono text-[10px] text-muted">SelfArchiver {APP_VERSION}</span>
                    </div>
                    <div className="flex items-center gap-3 px-1 text-[10px] text-muted">
                        <a href={WEBSITE_URL} target="_blank" rel="noreferrer" className="hover:text-accent">
                            Website
                        </a>
                        <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-accent">
                            GitHub
                        </a>
                    </div>
                    {authRequired && (
                        <button
                            onClick={() => void api.logout().then(() => window.location.reload())}
                            className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-accent-soft hover:text-accent"
                        >
                            <IconLogout /> {t('action.signOut')}
                        </button>
                    )}
                </div>
            )}

            {/* Desktop sidebar */}
            <aside
                className={`hidden shrink-0 flex-col border-line md:flex md:h-screen md:border-r md:py-6 ${
                    collapsed ? 'md:w-[4.5rem]' : 'md:w-56'
                }`}
            >
                <div className={`flex items-center px-5 py-4 md:px-3 md:py-2 ${collapsed ? 'md:justify-center' : ''}`}>
                    <img src="/logo-wide.png" alt="SelfArchiver" className={`h-12 w-auto md:h-auto md:w-full ${hideWhenCollapsed}`} />
                    {collapsed && <img src="/icon.png" alt="SelfArchiver" className="hidden h-8 w-8 md:block" />}
                </div>

                <div className={`hidden px-3 md:flex ${collapsed ? 'md:justify-center' : 'md:justify-end'}`}>
                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line text-muted hover:border-accent/50 hover:text-ink"
                        title={collapsed ? t('nav.expand') : t('nav.collapse')}
                        aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
                    >
                        {collapsed ? '»' : '«'}
                    </button>
                </div>

                <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:mt-4 md:flex-col md:overflow-visible md:pb-0">
                    {NAV.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            title={t(item.key)}
                            className={({ isActive }) =>
                                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                    collapsed ? 'md:justify-center md:px-0' : ''
                                } ${isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-accent-soft hover:text-accent'}`
                            }
                        >
                            <span className="shrink-0">{item.icon}</span>
                            <span className={hideWhenCollapsed}>{t(item.key)}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="mt-auto flex flex-col gap-3 px-3 pb-3 md:pb-0">
                    <div className={`flex items-center gap-2 ${hideWhenCollapsed}`}>
                        <ThemeToggle />
                        <LanguageToggle />
                    </div>
                    <div className={`px-1 font-mono text-[10px] text-muted ${hideWhenCollapsed}`}>SelfArchiver {APP_VERSION}</div>
                    <div className={`flex items-center gap-3 px-1 text-[10px] text-muted ${hideWhenCollapsed}`}>
                        <a href={WEBSITE_URL} target="_blank" rel="noreferrer" className="hover:text-accent">
                            Website
                        </a>
                        <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-accent">
                            GitHub
                        </a>
                    </div>
                    {authRequired && (
                        <button
                            onClick={() => void api.logout().then(() => window.location.reload())}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-accent-soft hover:text-accent ${
                                collapsed ? 'md:justify-center md:px-0' : ''
                            }`}
                            title={t('action.signOut')}
                        >
                            <IconLogout /> <span className={hideWhenCollapsed}>{t('action.signOut')}</span>
                        </button>
                    )}
                </div>
            </aside>
            <main className="flex-1 px-5 py-6 md:px-10 md:py-10">
                <Outlet />
            </main>
        </div>
    );
}

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const options: { value: 'light' | 'dark'; glyph: string; label: string }[] = [
        { value: 'light', glyph: '☀', label: 'Light' },
        { value: 'dark', glyph: '☾', label: 'Dark' },
    ];
    return (
        <div className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-1 text-xs font-medium">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={`rounded-md px-2.5 py-1 transition-colors ${
                        theme === opt.value ? 'bg-accent text-white' : 'text-muted hover:text-ink'
                    }`}
                    title={opt.label}
                    aria-label={opt.label}
                    aria-pressed={theme === opt.value}
                >
                    {opt.glyph}
                </button>
            ))}
        </div>
    );
}

export function LanguageToggle() {
    const { lang, setLang, t } = useI18n();
    return (
        <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            aria-label={t('lang.language')}
            title={t('lang.language')}
            className="cursor-pointer rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink outline-none hover:border-accent focus:border-accent"
        >
            {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                    {l.label}
                </option>
            ))}
        </select>
    );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
    return (
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
            </div>
            {action}
        </div>
    );
}

function IconGrid() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
    );
}
function IconMail() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 7l9 6 9-6" strokeLinecap="round" />
        </svg>
    );
}
function IconRules() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h10M4 18h7" strokeLinecap="round" />
            <circle cx="18" cy="16" r="3" />
        </svg>
    );
}
function IconArchive() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="4" rx="1" />
            <path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8M10 12h4" strokeLinecap="round" />
        </svg>
    );
}
function IconClock() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
        </svg>
    );
}
function IconLogout() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
                d="M15 12H4m0 0l4-4m-4 4l4 4M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
