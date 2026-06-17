import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { ruleFilterSchema, type Rule, type RuleInput } from '../types.js';

/** Persistence for archiving rules. `folders` and `filter` are stored as JSON. */

interface RuleRow {
    id: string;
    source_id: string;
    name: string;
    enabled: number;
    folders: string;
    include_subfolders: number;
    filter: string;
    min_age_days: number;
    min_age_unit: string;
    action: string;
    schedule_cron: string;
    last_run_at: number | null;
    next_run_at: number | null;
    created_at: number;
    updated_at: number;
}

function rowToRule(r: RuleRow): Rule {
    return {
        id: r.id,
        sourceId: r.source_id,
        name: r.name,
        enabled: r.enabled === 1,
        folders: JSON.parse(r.folders) as string[],
        includeSubfolders: r.include_subfolders === 1,
        filter: ruleFilterSchema.parse(JSON.parse(r.filter)),
        minAge: r.min_age_days,
        minAgeUnit: r.min_age_unit as Rule['minAgeUnit'],
        action: r.action as Rule['action'],
        scheduleCron: r.schedule_cron,
        lastRunAt: r.last_run_at,
        nextRunAt: r.next_run_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

export function createRule(input: RuleInput): Rule {
    const id = randomUUID();
    const now = Date.now();
    db.prepare(
        `INSERT INTO rules (id, source_id, name, enabled, folders, include_subfolders, filter, min_age_days, min_age_unit, action, schedule_cron, created_at, updated_at)
         VALUES (@id, @source_id, @name, @enabled, @folders, @include_subfolders, @filter, @min_age_days, @min_age_unit, @action, @schedule_cron, @now, @now)`,
    ).run({
        id,
        source_id: input.sourceId,
        name: input.name,
        enabled: input.enabled ? 1 : 0,
        folders: JSON.stringify(input.folders),
        include_subfolders: input.includeSubfolders ? 1 : 0,
        filter: JSON.stringify(input.filter),
        min_age_days: input.minAge,
        min_age_unit: input.minAgeUnit,
        action: input.action,
        schedule_cron: input.scheduleCron,
        now,
    });
    return getRule(id)!;
}

export function updateRule(id: string, input: RuleInput): Rule | null {
    const existing = getRule(id);
    if (!existing) return null;
    db.prepare(
        `UPDATE rules SET source_id=@source_id, name=@name, enabled=@enabled, folders=@folders, include_subfolders=@include_subfolders,
         filter=@filter, min_age_days=@min_age_days, min_age_unit=@min_age_unit, action=@action, schedule_cron=@schedule_cron, updated_at=@now WHERE id=@id`,
    ).run({
        id,
        source_id: input.sourceId,
        name: input.name,
        enabled: input.enabled ? 1 : 0,
        folders: JSON.stringify(input.folders),
        include_subfolders: input.includeSubfolders ? 1 : 0,
        filter: JSON.stringify(input.filter),
        min_age_days: input.minAge,
        min_age_unit: input.minAgeUnit,
        action: input.action,
        schedule_cron: input.scheduleCron,
        now: Date.now(),
    });
    return getRule(id);
}

export function setRuleScheduleTimestamps(id: string, lastRunAt: number | null, nextRunAt: number | null): void {
    db.prepare('UPDATE rules SET last_run_at=?, next_run_at=?, updated_at=? WHERE id=?').run(
        lastRunAt,
        nextRunAt,
        Date.now(),
        id,
    );
}

export function getRule(id: string): Rule | null {
    const row = db.prepare('SELECT * FROM rules WHERE id = ?').get(id) as RuleRow | undefined;
    return row ? rowToRule(row) : null;
}

export function listRules(): Rule[] {
    const rows = db.prepare('SELECT * FROM rules ORDER BY created_at DESC').all() as RuleRow[];
    return rows.map(rowToRule);
}

export function listEnabledRules(): Rule[] {
    const rows = db.prepare('SELECT * FROM rules WHERE enabled = 1').all() as RuleRow[];
    return rows.map(rowToRule);
}

export function deleteRule(id: string): boolean {
    const info = db.prepare('DELETE FROM rules WHERE id = ?').run(id);
    return info.changes > 0;
}
