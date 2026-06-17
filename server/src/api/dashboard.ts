import type { FastifyInstance } from 'fastify';
import { emailStats } from '../repos/emails.js';
import { listRules } from '../repos/rules.js';
import { listRuns } from '../repos/runs.js';
import { listSources } from '../repos/sources.js';

/** Aggregated overview for the dashboard plus a liveness probe. */

export function registerDashboardRoutes(app: FastifyInstance): void {
    app.get('/api/health', async () => ({ status: 'ok' }));

    app.get('/api/dashboard', async () => {
        return {
            sources: listSources(),
            rules: listRules(),
            stats: emailStats(),
            recentRuns: listRuns(10),
        };
    });
}
