import type { EnvelopeSummary } from '../imap.js';
import type { RuleFilter } from '../types.js';

/**
 * Decide whether a single message matches a rule's filter.
 *
 * Semantics (deliberately conservative so spam is never swept up by accident):
 *   - all populated conditions must hold (logical AND between condition types)
 *   - a `*Contains` list matches if ANY entry is a case-insensitive substring
 *   - flagged/important mail is excluded by default
 *   - only already-read mail is considered by default, giving the user time to
 *     read new mail before it is archived/deleted
 */
export function matchesFilter(env: EnvelopeSummary, filter: RuleFilter): boolean {
    if (filter.excludeFlagged && env.flags.includes('\\Flagged')) return false;
    if (filter.seenOnly && !env.flags.includes('\\Seen')) return false;
    if (filter.requireAttachment && !env.hasAttachment) return false;
    if (filter.fromContains.length > 0 && !anyContains(env.from, filter.fromContains)) return false;
    if (filter.toContains.length > 0 && !anyContains(env.to, filter.toContains)) return false;
    if (filter.subjectContains.length > 0 && !anyContains(env.subject, filter.subjectContains)) return false;
    return true;
}

function anyContains(haystack: string | null, needles: string[]): boolean {
    if (!haystack) return false;
    const lower = haystack.toLowerCase();
    return needles.some((n) => lower.includes(n.toLowerCase()));
}
