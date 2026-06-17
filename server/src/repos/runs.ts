import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import type { Run, RunStatus, RunTrigger } from '../types.js';

/** Persistence for rule run history (audit trail of what was archived/deleted). */

interface RunRow {
    id: string;
    rule_id: string;
    trigger: string;
    status: string;
    started_at: number;
    finished_at: number | null;
    scanned: number;
    archived: number;
    deleted: number;
    error: string | null;
}

function rowToRun(r: RunRow): Run {
    return {
        id: r.id,
        ruleId: r.rule_id,
        trigger: r.trigger as RunTrigger,
        status: r.status as RunStatus,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
        scanned: r.scanned,
        archived: r.archived,
        deleted: r.deleted,
        error: r.error,
    };
}

export function createRun(ruleId: string, trigger: RunTrigger): Run {
    const id = randomUUID();
    db.prepare(
        `INSERT INTO runs (id, rule_id, trigger, status, started_at, scanned, archived, deleted)
         VALUES (?, ?, ?, 'running', ?, 0, 0, 0)`,
    ).run(id, ruleId, trigger, Date.now());
    return getRun(id)!;
}

export function finishRun(
    id: string,
    result: { status: RunStatus; scanned: number; archived: number; deleted: number; error: string | null },
): void {
    db.prepare(
        'UPDATE runs SET status=?, finished_at=?, scanned=?, archived=?, deleted=?, error=? WHERE id=?',
    ).run(result.status, Date.now(), result.scanned, result.archived, result.deleted, result.error, id);
}

export function getRun(id: string): Run | null {
    const row = db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as RunRow | undefined;
    return row ? rowToRun(row) : null;
}

export function listRuns(limit = 50, ruleId?: string): Run[] {
    const rows = ruleId
        ? (db.prepare('SELECT * FROM runs WHERE rule_id = ? ORDER BY started_at DESC LIMIT ?').all(ruleId, limit) as RunRow[])
        : (db.prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT ?').all(limit) as RunRow[]);
    return rows.map(rowToRun);
}
