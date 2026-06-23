import { db } from '../db.js';

/**
 * Tiny key/value settings store. Used for operator preferences that have no
 * natural home on another entity — currently just the run-history retention cap.
 */

/** Default number of rule runs kept in the activity history. 0 = unlimited. */
export const DEFAULT_RUNS_MAX = 1000;
/** Upper bound so a typo can't ask SQLite to keep an absurd amount. */
export const MAX_RUNS_MAX = 100000;

const RUNS_MAX_KEY = 'runs_max';

export function getSetting(key: string): string | null {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
    db.prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ).run(key, value);
}

/** Configured run-history cap, clamped to a sane range. 0 means unlimited. */
export function getRunsMax(): number {
    const raw = getSetting(RUNS_MAX_KEY);
    if (raw == null) return DEFAULT_RUNS_MAX;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return DEFAULT_RUNS_MAX;
    return Math.min(Math.floor(n), MAX_RUNS_MAX);
}

export function setRunsMax(value: number): number {
    const clamped = Math.min(Math.max(Math.floor(value), 0), MAX_RUNS_MAX);
    setSetting(RUNS_MAX_KEY, String(clamped));
    return clamped;
}
