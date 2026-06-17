import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../lib/api.js';

/** App shell: branded sidebar + routed content area. */

const NAV: { to: string; label: string; icon: ReactNode }[] = [
    { to: '/', label: 'Overview', icon: <IconGrid /> },
    { to: '/sources', label: 'Mailboxes', icon: <IconMail /> },
    { to: '/rules', label: 'Rules', icon: <IconRules /> },
    { to: '/archive', label: 'Archive', icon: <IconArchive /> },
    { to: '/runs', label: 'Activity', icon: <IconClock /> },
];

export default function Layout({ authRequired }: { authRequired: boolean }) {
    return (
        <div className="mx-auto flex min-h-full max-w-[1400px] flex-col md:flex-row">
            <aside className="flex shrink-0 flex-col border-line md:h-screen md:w-64 md:border-r md:py-6">
                <div className="flex items-center gap-3 px-5 py-4 md:py-2">
                    <Logo />
                    <div className="leading-tight">
                        <div className="font-semibold tracking-tight">SelfArchiver</div>
                        <div className="font-mono text-[11px] text-muted">mailbox keeper</div>
                    </div>
                </div>
                <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:mt-6 md:flex-col md:overflow-visible md:pb-0">
                    {NAV.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            className={({ isActive }) =>
                                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                    isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-line/40 hover:text-ink'
                                }`
                            }
                        >
                            <span className="shrink-0">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
                {authRequired && (
                    <div className="mt-auto hidden px-3 md:block">
                        <button
                            onClick={() => void api.logout().then(() => window.location.reload())}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-line/40 hover:text-ink"
                        >
                            <IconLogout /> Sign out
                        </button>
                    </div>
                )}
            </aside>
            <main className="flex-1 px-5 py-6 md:px-10 md:py-10">
                <Outlet />
            </main>
        </div>
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

function Logo() {
    return (
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7l2-3h14l2 3v12a1 1 0 01-1 1H4a1 1 0 01-1-1V7z" />
                <path d="M3 7h18M9 12h6" strokeLinecap="round" />
            </svg>
        </span>
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
