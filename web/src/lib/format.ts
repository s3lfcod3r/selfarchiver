import { detectLang } from './i18n.js';

/** Small presentation helpers shared across pages. Date/relative output follows
 *  the active language (read from the same source as the i18n provider). */

const LOCALE: Record<string, string> = { en: 'en-US', de: 'de-DE' };

export function formatBytes(bytes: number | null): string {
    if (bytes === null || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(ms: number | null): string {
    if (!ms) return '—';
    return new Date(ms).toLocaleString(LOCALE[detectLang()], {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function relativeTime(ms: number | null): string {
    if (!ms) return '—';
    const de = detectLang() === 'de';
    const diff = Date.now() - ms;
    const abs = Math.abs(diff);
    const units: [number, string][] = [
        [86400000, 'd'],
        [3600000, 'h'],
        [60000, 'min'],
        [1000, 's'],
    ];
    for (const [unit, label] of units) {
        if (abs >= unit) {
            const value = Math.round(diff / unit);
            if (diff >= 0) return de ? `vor ${value}${label}` : `${value}${label} ago`;
            return de ? `in ${-value}${label}` : `in ${-value}${label}`;
        }
    }
    return de ? 'gerade eben' : 'just now';
}
