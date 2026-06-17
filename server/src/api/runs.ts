import type { FastifyInstance } from 'fastify';
import { listRuns } from '../repos/runs.js';

/** REST endpoints for rule run history. */

export function registerRunRoutes(app: FastifyInstance): void {
    app.get('/api/runs', async (req) => {
        const { ruleId, limit } = req.query as { ruleId?: string; limit?: string };
        const max = Math.min(Number(limit ?? 50) || 50, 200);
        return { runs: listRuns(max, ruleId) };
    });
}
