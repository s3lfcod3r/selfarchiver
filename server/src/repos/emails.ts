import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import type { ArchivedEmail } from '../types.js';

/**
 * Persistence + full-text search for archived emails. The FTS5 row is written
 * in the same transaction and shares the archived_emails integer rowid, so a
 * MATCH lookup maps straight back to the metadata row.
 */

interface EmailRow {
    id: string;
    source_id: string;
    rule_id: string | null;
    message_id: string | null;
    folder: string;
    subject: string | null;
    from_addr: string | null;
    to_addr: string | null;
    sent_at: number | null;
    size: number | null;
    has_attachments: number;
    attachment_names: string;
    eml_path: string;
    archived_at: number;
}

function rowToEmail(r: EmailRow): ArchivedEmail {
    return {
        id: r.id,
        sourceId: r.source_id,
        ruleId: r.rule_id,
        messageId: r.message_id,
        folder: r.folder,
        subject: r.subject,
        fromAddr: r.from_addr,
        toAddr: r.to_addr,
        sentAt: r.sent_at,
        size: r.size,
        hasAttachments: r.has_attachments === 1,
        attachmentNames: JSON.parse(r.attachment_names) as string[],
        emlPath: r.eml_path,
        archivedAt: r.archived_at,
    };
}

export function emailExists(dedupeKey: string): boolean {
    const row = db.prepare('SELECT 1 FROM archived_emails WHERE dedupe_key = ?').get(dedupeKey);
    return row !== undefined;
}

export interface InsertEmailInput {
    sourceId: string;
    ruleId: string | null;
    runId: string | null;
    messageId: string | null;
    folder: string;
    subject: string | null;
    fromAddr: string | null;
    toAddr: string | null;
    sentAt: number | null;
    size: number | null;
    hasAttachments: boolean;
    attachmentNames: string[];
    emlPath: string;
    dedupeKey: string;
    bodyText: string;
}

const insertEmailStmt = db.prepare(`
    INSERT OR IGNORE INTO archived_emails
        (id, source_id, rule_id, run_id, message_id, folder, subject, from_addr, to_addr, sent_at, size,
         has_attachments, attachment_names, eml_path, archived_at, dedupe_key)
    VALUES
        (@id, @source_id, @rule_id, @run_id, @message_id, @folder, @subject, @from_addr, @to_addr, @sent_at, @size,
         @has_attachments, @attachment_names, @eml_path, @archived_at, @dedupe_key)
`);
const insertFtsStmt = db.prepare(
    'INSERT INTO emails_fts (rowid, subject, sender, recipients, body) VALUES (?, ?, ?, ?, ?)',
);

/**
 * Insert metadata + FTS row atomically. Returns the new email id, or null when
 * the message is already archived (dedupe_key conflict) — this makes archiving
 * race-safe even if two rules target the same folder concurrently.
 */
export const insertEmail = db.transaction((input: InsertEmailInput): string | null => {
    const id = randomUUID();
    const info = insertEmailStmt.run({
        id,
        source_id: input.sourceId,
        rule_id: input.ruleId,
        run_id: input.runId,
        message_id: input.messageId,
        folder: input.folder,
        subject: input.subject,
        from_addr: input.fromAddr,
        to_addr: input.toAddr,
        sent_at: input.sentAt,
        size: input.size,
        has_attachments: input.hasAttachments ? 1 : 0,
        attachment_names: JSON.stringify(input.attachmentNames),
        eml_path: input.emlPath,
        archived_at: Date.now(),
        dedupe_key: input.dedupeKey,
    });
    if (info.changes === 0) return null;
    insertFtsStmt.run(
        info.lastInsertRowid as number,
        input.subject ?? '',
        input.fromAddr ?? '',
        input.toAddr ?? '',
        input.bodyText,
    );
    return id;
});

export interface EmailQuery {
    sourceId?: string;
    folder?: string;
    search?: string;
    /** Inclusive sent-date range, epoch ms. */
    sentFrom?: number;
    sentTo?: number;
    limit: number;
    offset: number;
}

export function queryEmails(q: EmailQuery): { items: ArchivedEmail[]; total: number } {
    // Shared metadata conditions (alias `e`), used by both the plain and FTS paths.
    const conds: string[] = [];
    const filter: Record<string, unknown> = {};
    if (q.sourceId) {
        conds.push('e.source_id = @sourceId');
        filter.sourceId = q.sourceId;
    }
    if (q.folder) {
        conds.push('e.folder = @folder');
        filter.folder = q.folder;
    }
    if (q.sentFrom) {
        conds.push('e.sent_at >= @sentFrom');
        filter.sentFrom = q.sentFrom;
    }
    if (q.sentTo) {
        conds.push('e.sent_at <= @sentTo');
        filter.sentTo = q.sentTo;
    }

    const hasSearch = Boolean(q.search && q.search.trim());
    if (hasSearch) filter.match = ftsQuery(q.search!);

    const whereParts = hasSearch ? ['emails_fts MATCH @match', ...conds] : conds;
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const fromSql = hasSearch
        ? 'emails_fts f JOIN archived_emails e ON e.rowid = f.rowid'
        : 'archived_emails e';
    const orderSql = hasSearch ? 'ORDER BY rank' : 'ORDER BY e.sent_at DESC NULLS LAST, e.archived_at DESC';

    const rows = db
        .prepare(`SELECT e.* FROM ${fromSql} ${whereSql} ${orderSql} LIMIT @limit OFFSET @offset`)
        .all({ ...filter, limit: q.limit, offset: q.offset }) as EmailRow[];

    // Count statement must not receive @limit/@offset (better-sqlite3 rejects
    // object keys a statement doesn't use), and no params at all when unfiltered.
    const countStmt = db.prepare(`SELECT COUNT(*) AS c FROM ${fromSql} ${whereSql}`);
    const total = (Object.keys(filter).length ? countStmt.get(filter) : countStmt.get()) as { c: number };

    return { items: rows.map(rowToEmail), total: total.c };
}

/** Distinct folders that have archived mail (optionally scoped to one source). */
export function distinctFolders(sourceId?: string): string[] {
    const rows = sourceId
        ? (db.prepare('SELECT DISTINCT folder FROM archived_emails WHERE source_id = ? ORDER BY folder').all(sourceId) as {
              folder: string;
          }[])
        : (db.prepare('SELECT DISTINCT folder FROM archived_emails ORDER BY folder').all() as { folder: string }[]);
    return rows.map((r) => r.folder);
}

export function getEmail(id: string): ArchivedEmail | null {
    const row = db.prepare('SELECT * FROM archived_emails WHERE id = ?').get(id) as EmailRow | undefined;
    return row ? rowToEmail(row) : null;
}

/** Archived emails produced by a single run (newest first). */
export function emailsByRun(runId: string, limit: number, offset: number): { items: ArchivedEmail[]; total: number } {
    const rows = db
        .prepare('SELECT * FROM archived_emails WHERE run_id = ? ORDER BY archived_at DESC, sent_at DESC LIMIT ? OFFSET ?')
        .all(runId, limit, offset) as EmailRow[];
    const total = (
        db.prepare('SELECT COUNT(*) AS c FROM archived_emails WHERE run_id = ?').get(runId) as { c: number }
    ).c;
    return { items: rows.map(rowToEmail), total };
}

/** Remove an archived email row. The FTS row is dropped by an AFTER DELETE trigger. */
export function deleteArchivedEmail(id: string): void {
    db.prepare('DELETE FROM archived_emails WHERE id = ?').run(id);
}

/** The id + on-disk path of every archived email in a folder (optionally one source). */
export function emailsInFolder(folder: string, sourceId?: string): { id: string; emlPath: string }[] {
    const rows = sourceId
        ? (db
              .prepare('SELECT id, eml_path AS emlPath FROM archived_emails WHERE folder = ? AND source_id = ?')
              .all(folder, sourceId) as { id: string; emlPath: string }[])
        : (db.prepare('SELECT id, eml_path AS emlPath FROM archived_emails WHERE folder = ?').all(folder) as {
              id: string;
              emlPath: string;
          }[]);
    return rows;
}

/** Bulk-delete all archived emails in a folder (FTS rows dropped via trigger). */
export function deleteEmailsInFolder(folder: string, sourceId?: string): number {
    const info = sourceId
        ? db.prepare('DELETE FROM archived_emails WHERE folder = ? AND source_id = ?').run(folder, sourceId)
        : db.prepare('DELETE FROM archived_emails WHERE folder = ?').run(folder);
    return info.changes;
}

export function emailStats(): { total: number; totalSize: number; bySource: { sourceId: string; count: number }[] } {
    const total = (db.prepare('SELECT COUNT(*) AS c FROM archived_emails').get() as { c: number }).c;
    const totalSize = (db.prepare('SELECT COALESCE(SUM(size),0) AS s FROM archived_emails').get() as { s: number }).s;
    const bySource = db
        .prepare('SELECT source_id AS sourceId, COUNT(*) AS count FROM archived_emails GROUP BY source_id')
        .all() as { sourceId: string; count: number }[];
    return { total, totalSize, bySource };
}

/**
 * Turn a free-text query into a safe FTS5 MATCH expression. Each whitespace
 * token becomes a prefix term, quoted to neutralise FTS operators in user
 * input.
 */
function ftsQuery(input: string): string {
    return input
        .trim()
        .split(/\s+/)
        .map((t) => `"${t.replace(/"/g, '""')}"*`)
        .join(' ');
}
