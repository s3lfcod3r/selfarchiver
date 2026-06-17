/** Small presentation helpers shared across pages. */

export function formatBytes(bytes: number | null): string {
    if (bytes === null || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(ms: number | null): string {
    if (!ms) return '—';
    return new Date(ms).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function relativeTime(ms: number | null): string {
    if (!ms) return '—';
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
            return diff >= 0 ? `${value}${label} ago` : `in ${-value}${label}`;
        }
    }
    return 'just now';
}

const CRON_PRESETS: Record<string, string> = {
    '0 3 * * *': 'Every day at 03:00',
    '0 4 * * *': 'Every day at 04:00',
    '0 3 * * 0': 'Every Sunday at 03:00',
    '0 3 1 * *': 'On the 1st each month at 03:00',
    '0 * * * *': 'Every hour',
    '*/30 * * * *': 'Every 30 minutes',
};

export function describeCron(cron: string): string {
    return CRON_PRESETS[cron] ?? cron;
}

export const CRON_OPTIONS = Object.entries(CRON_PRESETS).map(([value, label]) => ({ value, label }));
