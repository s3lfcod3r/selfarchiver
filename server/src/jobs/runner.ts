import { archiveMessage } from '../archive.js';
import { decryptSecret } from '../crypto.js';
import {
    deleteMessages,
    describeImapError,
    fetchEnvelopes,
    fetchSource,
    withClient,
    type EnvelopeSummary,
    type ImapConnection,
} from '../imap.js';
import { logger } from '../logger.js';
import { getSource, getSourcePasswordEnc, setSourceStatus } from '../repos/sources.js';
import { createRun, finishRun, getRun, pruneRuns } from '../repos/runs.js';
import { getRunsMax } from '../repos/settings.js';
import { matchesFilter } from '../rules/engine.js';
import type { Rule, Run, RunTrigger } from '../types.js';

/**
 * Executes a single rule end to end:
 *   1. connect to the source mailbox
 *   2. for each selected folder, list messages older than `minAgeDays`
 *   3. archive the ones matching the filter (idempotent, with attachments)
 *   4. if the action is `archive_delete`, delete the archived ones from source
 *
 * Step 4 only ever deletes messages we have confirmed are in the archive, so a
 * mailbox can shrink safely without risking data loss.
 */

const HOUR_MS = 3600000;
const DAY_MS = 86400000;

/** Rules currently executing, to prevent overlapping runs of the same rule. */
const running = new Set<string>();

export function isRuleRunning(ruleId: string): boolean {
    return running.has(ruleId);
}

export async function runRule(rule: Rule, trigger: RunTrigger): Promise<Run> {
    if (running.has(rule.id)) {
        throw new Error('Rule is already running');
    }
    running.add(rule.id);
    const run = createRun(rule.id, trigger);
    let scanned = 0;
    let archived = 0;
    let deleted = 0;
    let connInfo = '';

    try {
        const source = getSource(rule.sourceId);
        const passwordEnc = getSourcePasswordEnc(rule.sourceId);
        if (!source || !passwordEnc) {
            throw new Error('Source not found for rule');
        }
        const conn: ImapConnection = {
            host: source.host,
            port: source.port,
            secure: source.secure,
            allowSelfSigned: source.allowSelfSigned,
            user: source.username,
            pass: decryptSecret(passwordEnc),
        };
        connInfo = ` [${conn.host}:${conn.port} TLS=${conn.secure} self-signed=${conn.allowSelfSigned}]`;
        const unitMs = rule.minAgeUnit === 'hours' ? HOUR_MS : DAY_MS;
        const cutoff = Date.now() - rule.minAge * unitMs;

        await withClient(conn, async (client) => {
            // Fetch the server's real folder list once. We use it both to expand
            // subfolders and to validate the rule's selection up front, so a
            // stale/renamed folder produces a precise, actionable error instead
            // of a bare "unknown folder" deep inside the fetch.
            const allPaths = (await client.list()).map((b) => b.path);
            const known = new Set(allPaths);

            // Optionally expand the selected folders with any (new) subfolders,
            // discovered fresh on this run.
            let folders = rule.folders;
            if (rule.includeSubfolders) {
                const selected = new Set(rule.folders);
                for (const sel of rule.folders) {
                    for (const path of allPaths) {
                        if (path !== sel && (path.startsWith(`${sel}.`) || path.startsWith(`${sel}/`))) {
                            selected.add(path);
                        }
                    }
                }
                folders = [...selected];
            }

            // Fail early and clearly if the rule points at folders the server
            // does not have — naming them and listing what is actually available.
            const missing = folders.filter((f) => !known.has(f));
            if (missing.length > 0) {
                throw new Error(
                    `Folder not found on the server: ${missing.map((m) => `"${m}"`).join(', ')}. ` +
                        `Available folders: ${allPaths.slice(0, 40).join(', ')}. ` +
                        `Edit the rule, refresh the folder list and pick from these.`,
                );
            }

            for (const folder of folders) {
                // First pass: collect light envelope summaries (lock released when done).
                const summaries: EnvelopeSummary[] = [];
                for await (const env of fetchEnvelopes(client, folder, cutoff, rule.filter.seenOnly)) {
                    summaries.push(env);
                }
                scanned += summaries.length;

                // Second pass: archive matches, then delete the confirmed-archived ones.
                const toDelete: number[] = [];
                for (const env of summaries) {
                    // Exact age check (IMAP BEFORE is only day-granular; supports hours).
                    if (env.date != null && env.date > cutoff) continue;
                    if (!matchesFilter(env, rule.filter)) continue;
                    const raw = await fetchSource(client, folder, env.uid);
                    if (!raw) continue;
                    const result = await archiveMessage({
                        sourceId: rule.sourceId,
                        ruleId: rule.id,
                        folder,
                        envelope: env,
                        raw,
                    });
                    if (result.archived) archived += 1;
                    // Safe to delete when the message is now (or already was) archived.
                    if (rule.action === 'archive_delete' && (result.archived || result.reason === 'duplicate')) {
                        toDelete.push(env.uid);
                    }
                }

                if (rule.action === 'archive_delete' && toDelete.length > 0) {
                    await deleteMessages(client, folder, toDelete);
                    deleted += toDelete.length;
                }
            }
        });

        setSourceStatus(rule.sourceId, 'ok', null);
        finishRun(run.id, { status: 'success', scanned, archived, deleted, error: null });
        logger.info({ ruleId: rule.id, scanned, archived, deleted }, 'rule run finished');
    } catch (err) {
        const message = describeImapError(err) + connInfo;
        if (rule.sourceId) setSourceStatus(rule.sourceId, 'error', message);
        finishRun(run.id, { status: 'error', scanned, archived, deleted, error: message });
        logger.error({ ruleId: rule.id, err: message }, 'rule run failed');
    } finally {
        running.delete(rule.id);
        // Trim the run history to the configured cap (newest kept).
        try {
            pruneRuns(getRunsMax());
        } catch {
            // history trimming is best-effort; never fail a run because of it
        }
    }

    // Return the finished record (status + counters), not the initial snapshot.
    return getRun(run.id) ?? run;
}
