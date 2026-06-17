import type { FastifyInstance } from 'fastify';
import { isRuleRunning, runRule } from '../jobs/runner.js';
import { isValidCron, nextRun, scheduleRule, unscheduleRule } from '../jobs/scheduler.js';
import { createRule, deleteRule, getRule, listRules, updateRule } from '../repos/rules.js';
import { getSource } from '../repos/sources.js';
import { ruleInputSchema } from '../types.js';

/** REST endpoints for archiving rules, including manual run + cron validation. */

export function registerRuleRoutes(app: FastifyInstance): void {
    app.get('/api/rules', async (req) => {
        const { sourceId } = req.query as { sourceId?: string };
        const rules = listRules();
        return { rules: sourceId ? rules.filter((r) => r.sourceId === sourceId) : rules };
    });

    app.post('/api/rules/validate-cron', async (req) => {
        const { cron } = (req.body ?? {}) as { cron?: string };
        const expression = cron ?? '';
        const valid = isValidCron(expression);
        return { valid, nextRun: valid ? nextRun(expression) : null };
    });

    app.post('/api/rules', async (req, reply) => {
        const parsed = ruleInputSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
        if (!isValidCron(parsed.data.scheduleCron)) return reply.code(400).send({ error: 'Invalid cron expression' });
        if (!getSource(parsed.data.sourceId)) return reply.code(400).send({ error: 'Unknown source' });

        const rule = createRule(parsed.data);
        scheduleRule(rule);
        return reply.code(201).send({ rule: getRule(rule.id) });
    });

    app.put('/api/rules/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const parsed = ruleInputSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
        if (!isValidCron(parsed.data.scheduleCron)) return reply.code(400).send({ error: 'Invalid cron expression' });
        const rule = updateRule(id, parsed.data);
        if (!rule) return reply.code(404).send({ error: 'Rule not found' });
        scheduleRule(rule);
        return { rule: getRule(id) };
    });

    app.delete('/api/rules/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        unscheduleRule(id);
        if (!deleteRule(id)) return reply.code(404).send({ error: 'Rule not found' });
        return { ok: true };
    });

    app.post('/api/rules/:id/run', async (req, reply) => {
        const { id } = req.params as { id: string };
        const rule = getRule(id);
        if (!rule) return reply.code(404).send({ error: 'Rule not found' });
        if (isRuleRunning(id)) return reply.code(409).send({ error: 'Rule is already running' });
        // Fire and forget; progress is observable via the runs history.
        void runRule(rule, 'manual').catch(() => undefined);
        return reply.code(202).send({ started: true });
    });
}
