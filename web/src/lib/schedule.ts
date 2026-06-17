import type { TFunc } from './i18n.js';

/**
 * Friendly schedule builder that compiles to / parses from a 5-field cron
 * expression (the backend keeps using cron + node-cron). Covers the common
 * cases; anything else stays as a raw "custom" cron string.
 */

export type Frequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface SchedulePlan {
    frequency: Frequency;
    minute: number; // 0–59
    hour: number; // 0–23
    weekdays: number[]; // cron dow, 0=Sun … 6=Sat
    dayOfMonth: number; // 1–28
    cron: string; // raw expression (source of truth for 'custom')
}

/** Weekday values in display order (Mon first), cron numbering (Sun=0). */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function clamp(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) return min;
    return Math.max(min, Math.min(max, Math.trunc(value)));
}

export function buildCron(p: Omit<SchedulePlan, 'cron'>): string {
    const m = clamp(p.minute, 0, 59);
    const h = clamp(p.hour, 0, 23);
    switch (p.frequency) {
        case 'hourly':
            return `${m} * * * *`;
        case 'daily':
            return `${m} ${h} * * *`;
        case 'weekly': {
            const days = p.weekdays.length ? [...new Set(p.weekdays)].sort((a, b) => a - b).join(',') : '1';
            return `${m} ${h} * * ${days}`;
        }
        case 'monthly':
            return `${m} ${h} ${clamp(p.dayOfMonth, 1, 28)} * *`;
        default:
            return '';
    }
}

const DEFAULT_PLAN: SchedulePlan = {
    frequency: 'custom',
    minute: 0,
    hour: 3,
    weekdays: [1],
    dayOfMonth: 1,
    cron: '0 3 * * *',
};

export function parseCron(cron: string): SchedulePlan {
    const base = { ...DEFAULT_PLAN, cron };
    const parts = (cron ?? '').trim().split(/\s+/);
    if (parts.length !== 5) return base;
    const [mi, ho, dom, mon, dow] = parts;
    const isNum = (s: string) => /^\d+$/.test(s);
    const m = Number(mi);
    const h = Number(ho);

    if (isNum(mi) && ho === '*' && dom === '*' && mon === '*' && dow === '*') {
        return { ...base, frequency: 'hourly', minute: m };
    }
    if (isNum(mi) && isNum(ho) && dom === '*' && mon === '*' && dow === '*') {
        return { ...base, frequency: 'daily', minute: m, hour: h };
    }
    if (isNum(mi) && isNum(ho) && dom === '*' && mon === '*' && dow !== '*') {
        const weekdays = dow
            .split(',')
            .map(Number)
            .filter((n) => Number.isInteger(n) && n >= 0 && n <= 7)
            .map((n) => (n === 7 ? 0 : n));
        if (weekdays.length) return { ...base, frequency: 'weekly', minute: m, hour: h, weekdays };
    }
    if (isNum(mi) && isNum(ho) && isNum(dom) && mon === '*' && dow === '*') {
        return { ...base, frequency: 'monthly', minute: m, hour: h, dayOfMonth: Number(dom) };
    }
    return base;
}

function hhmm(hour: number, minute: number): string {
    return `${String(clamp(hour, 0, 23)).padStart(2, '0')}:${String(clamp(minute, 0, 59)).padStart(2, '0')}`;
}

/** Human-readable summary of a cron expression for the rules list. */
export function describeSchedule(cron: string, t: TFunc): string {
    const p = parseCron(cron);
    switch (p.frequency) {
        case 'hourly':
            return t('sched.descHourly', { m: String(p.minute).padStart(2, '0') });
        case 'daily':
            return t('sched.descDaily', { time: hhmm(p.hour, p.minute) });
        case 'weekly': {
            const days = [...p.weekdays]
                .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
                .map((d) => t(`wd.${d}`))
                .join(', ');
            return t('sched.descWeekly', { days, time: hhmm(p.hour, p.minute) });
        }
        case 'monthly':
            return t('sched.descMonthly', { day: p.dayOfMonth, time: hhmm(p.hour, p.minute) });
        default:
            return cron;
    }
}
