import type { FastifyInstance } from 'fastify';
import { registerArchiveRoutes } from './archive.js';
import { registerDashboardRoutes } from './dashboard.js';
import { registerRuleRoutes } from './rules.js';
import { registerRunRoutes } from './runs.js';
import { registerSourceRoutes } from './sources.js';

/** Mount every API route group on the Fastify instance. */
export function registerRoutes(app: FastifyInstance): void {
    registerDashboardRoutes(app);
    registerSourceRoutes(app);
    registerRuleRoutes(app);
    registerArchiveRoutes(app);
    registerRunRoutes(app);
}
