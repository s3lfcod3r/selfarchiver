import type { FastifyInstance } from 'fastify';
import { emailsByRun } from '../repos/emails.js';
import { deleteAllRuns, deleteRun, queryRuns } from '../repos/runs.js';
import { getRunsMax, setRunsMax } from '../repos/settings.js';
import type { RunStatus, RunTrigger } from '../types.js';

/** REST endpoints for rule run history + activity-related settings. */

const MAX_LIMIT = 200;
const VALID_STATUS = new Set<RunStatus>(['running', 'success', 'error']);
const VALID_TRIGGER = new Set<RunTrigger>(['schedule', 'manual']);

export function registerRunRoutes(app: FastifyInstance): void {
    app.get('/api/runs', async (req) => {
        const q = req.query as {
            ruleId?: string;
            status?: string;
            trigger?: string;
            from?: string;
            to?: string;
            search?: string;
            limit?: string;
            offset?: string;
        };
        const limit = Math.min(Number(q.limit ?? 50) || 50, MAX_LIMIT);
        const offset = Math.max(Number(q.offset ?? 0) || 0, 0);
        const status = q.status && VALID_STATUS.has(q.status as RunStatus) ? (q.status as RunStatus) : undefined;
        const trigger = q.trigger && VALID_TRIGGER.has(q.trigger as RunTrigger) ? (q.trigger as RunTrigger) : undefined;
        const result = queryRuns({
            ruleId: q.ruleId,
            status,
            trigger,
            from: q.from ? Number(q.from) || undefined : undefined,
            to: q.to ? Number(q.to) || undefined : undefined,
            search: q.search,
            limit,
            offset,
        });
        return { runs: result.items, total: result.total, limit, offset };
    });

    // The emails a single run archived (linked via run_id).
    app.get('/api/runs/:id/emails', async (req) => {
        const { id } = req.params as { id: string };
        const q = req.query as { limit?: string; offset?: string };
        const limit = Math.min(Number(q.limit ?? 100) || 100, MAX_LIMIT);
        const offset = Math.max(Number(q.offset ?? 0) || 0, 0);
        const result = emailsByRun(id, limit, offset);
        return { items: result.items, total: result.total, limit, offset };
    });

    // Delete every run from the history.
    app.delete('/api/runs', async () => ({ deleted: deleteAllRuns() }));

    // Delete a single run.
    app.delete('/api/runs/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        if (!deleteRun(id)) return reply.code(404).send({ error: 'Run not found' });
        return { ok: true };
    });

    app.get('/api/settings', async () => ({ runsMax: getRunsMax() }));

    app.put('/api/settings', async (req, reply) => {
        const body = (req.body ?? {}) as { runsMax?: unknown };
        const n = Number(body.runsMax);
        if (!Number.isFinite(n) || n < 0) {
            return reply.code(400).send({ error: 'runsMax must be a number >= 0 (0 = unlimited)' });
        }
        return { runsMax: setRunsMax(n) };
    });
}
