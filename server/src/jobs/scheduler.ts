import cronParser from 'cron-parser';
import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { getRule, listEnabledRules, setRuleScheduleTimestamps } from '../repos/rules.js';
import type { Rule } from '../types.js';
import { runRule } from './runner.js';

/**
 * Per-rule scheduling. Each enabled rule owns one node-cron task running on its
 * own cron expression, so different folders can be archived on completely
 * independent schedules.
 */

const tasks = new Map<string, ScheduledTask>();

export function isValidCron(expression: string): boolean {
    return cron.validate(expression);
}

/** Next fire time for a cron expression, in epoch ms, or null if invalid. */
export function nextRun(expression: string): number | null {
    try {
        return cronParser.parseExpression(expression, { tz: env.cronTimezone }).next().getTime();
    } catch {
        return null;
    }
}

/** (Re)schedule a single rule. Removes any existing task first. */
export function scheduleRule(rule: Rule): void {
    unscheduleRule(rule.id);
    if (!rule.enabled) return;
    if (!cron.validate(rule.scheduleCron)) {
        logger.warn({ ruleId: rule.id, cron: rule.scheduleCron }, 'invalid cron expression; rule not scheduled');
        return;
    }

    const task = cron.schedule(
        rule.scheduleCron,
        () => {
            void fireRule(rule.id);
        },
        { timezone: env.cronTimezone },
    );
    tasks.set(rule.id, task);
    setRuleScheduleTimestamps(rule.id, rule.lastRunAt, nextRun(rule.scheduleCron));
    logger.info({ ruleId: rule.id, cron: rule.scheduleCron }, 'rule scheduled');
}

export function unscheduleRule(id: string): void {
    const task = tasks.get(id);
    if (task) {
        task.stop();
        tasks.delete(id);
    }
}

/** Look the rule up fresh on every fire so edits take effect without a restart. */
async function fireRule(ruleId: string): Promise<void> {
    const rule = getRule(ruleId);
    if (!rule || !rule.enabled) {
        unscheduleRule(ruleId);
        return;
    }
    try {
        await runRule(rule, 'schedule');
    } catch (err) {
        logger.error({ ruleId, err: err instanceof Error ? err.message : String(err) }, 'scheduled run error');
    } finally {
        setRuleScheduleTimestamps(ruleId, Date.now(), nextRun(rule.scheduleCron));
    }
}

/** Load all enabled rules and schedule them. Call once at startup. */
export function initScheduler(): void {
    for (const rule of listEnabledRules()) {
        scheduleRule(rule);
    }
    logger.info({ count: tasks.size }, 'scheduler initialised');
}
