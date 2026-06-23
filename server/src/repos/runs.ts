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

export interface RunQuery {
    ruleId?: string;
    status?: RunStatus;
    trigger?: RunTrigger;
    /** Inclusive started_at range, epoch ms. */
    from?: number;
    to?: number;
    /** Free-text match against the rule name or the run's error message. */
    search?: string;
    limit: number;
    offset: number;
}

/**
 * Paginated, filterable run history. Joins `rules` (LEFT, since a run can
 * outlive its rule) so the free-text search can match the rule name as well as
 * the error text.
 */
export function queryRuns(q: RunQuery): { items: Run[]; total: number } {
    const conds: string[] = [];
    const params: Record<string, unknown> = {};
    if (q.ruleId) {
        conds.push('r.rule_id = @ruleId');
        params.ruleId = q.ruleId;
    }
    if (q.status) {
        conds.push('r.status = @status');
        params.status = q.status;
    }
    if (q.trigger) {
        conds.push('r.trigger = @trigger');
        params.trigger = q.trigger;
    }
    if (q.from != null) {
        conds.push('r.started_at >= @from');
        params.from = q.from;
    }
    if (q.to != null) {
        conds.push('r.started_at <= @to');
        params.to = q.to;
    }
    if (q.search && q.search.trim()) {
        conds.push('(ru.name LIKE @like OR r.error LIKE @like)');
        params.like = `%${q.search.trim().replace(/[%_\\]/g, '\\$&')}%`;
    }

    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const fromSql = 'runs r LEFT JOIN rules ru ON ru.id = r.rule_id';

    const rows = db
        .prepare(
            `SELECT r.* FROM ${fromSql} ${whereSql} ORDER BY r.started_at DESC LIMIT @limit OFFSET @offset`,
        )
        .all({ ...params, limit: q.limit, offset: q.offset }) as RunRow[];

    const countStmt = db.prepare(`SELECT COUNT(*) AS c FROM ${fromSql} ${whereSql}`);
    const total = (Object.keys(params).length ? countStmt.get(params) : countStmt.get()) as { c: number };

    return { items: rows.map(rowToRun), total: total.c };
}

/** Delete a single run from the history. Returns true if a row was removed. */
export function deleteRun(id: string): boolean {
    return db.prepare('DELETE FROM runs WHERE id = ?').run(id).changes > 0;
}

/** Clear the entire run history. Returns the number of rows removed. */
export function deleteAllRuns(): number {
    return db.prepare('DELETE FROM runs').run().changes;
}

/** Trim the run history to the newest `max` rows. `max <= 0` keeps everything. */
export function pruneRuns(max: number): number {
    if (max <= 0) return 0;
    const info = db
        .prepare('DELETE FROM runs WHERE id NOT IN (SELECT id FROM runs ORDER BY started_at DESC LIMIT ?)')
        .run(max);
    return info.changes;
}
