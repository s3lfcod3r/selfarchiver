import { createHash } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { simpleParser } from 'mailparser';
import { env } from './env.js';
import { emailExists, insertEmail } from './repos/emails.js';
import type { EnvelopeSummary } from './imap.js';

/**
 * Turns a raw message into a stored .eml file plus a searchable metadata row.
 * Archiving is idempotent: a stable dedupe key prevents the same message from
 * being stored twice across runs.
 */

export interface ArchiveResult {
    archived: boolean;
    reason?: 'duplicate';
    id?: string;
}

// The folder is part of the key on purpose: the same Message-ID can live in two
// folders (e.g. a Gmail label + All Mail). Scoping per folder means every folder
// copy gets its own archived row + .eml, so an `archive_delete` rule never
// removes a folder's copy on the strength of a different folder's archive.
function dedupeKey(sourceId: string, folder: string, messageId: string | null, raw: Buffer): string {
    const basis = messageId && messageId.length > 0 ? messageId : createHash('sha256').update(raw).digest('hex');
    return createHash('sha256').update(`${sourceId}:${folder}:${basis}`).digest('hex');
}

function safeSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

export async function archiveMessage(params: {
    sourceId: string;
    ruleId: string | null;
    runId: string | null;
    folder: string;
    envelope: EnvelopeSummary;
    raw: Buffer;
}): Promise<ArchiveResult> {
    const { sourceId, ruleId, runId, folder, envelope, raw } = params;
    const key = dedupeKey(sourceId, folder, envelope.messageId, raw);
    if (emailExists(key)) {
        return { archived: false, reason: 'duplicate' };
    }

    const parsed = await simpleParser(raw);
    const attachmentNames = (parsed.attachments ?? [])
        .filter((a) => a.contentDisposition === 'attachment' || a.filename)
        .map((a) => a.filename ?? 'attachment');
    const bodyText = parsed.text ?? stripHtml(parsed.html || '') ?? '';

    const sentAt = envelope.date ?? (parsed.date ? parsed.date.getTime() : null);
    const dateForPath = sentAt ? new Date(sentAt) : new Date();
    const year = String(dateForPath.getUTCFullYear());
    const month = String(dateForPath.getUTCMonth() + 1).padStart(2, '0');

    const relDir = join(sourceId, year, month);
    const fileName = `${safeSegment(folder)}_${envelope.uid}_${key.slice(0, 12)}.eml`;
    const relPath = join(relDir, fileName);

    // Write the .eml to disk FIRST and fsync it, so the file is durably on disk
    // before any DB row claims the message is archived. This is the crash-safe
    // ordering: a crash between the two steps can only leave an orphan file (which
    // is harmless and gets reused on the next run via the identical path), never a
    // DB row without its file — which would let an `archive_delete` rule delete the
    // source mail even though the archived copy is missing.
    const absPath = join(env.archiveDir, relPath);
    await mkdir(join(env.archiveDir, relDir), { recursive: true });
    const handle = await open(absPath, 'w');
    try {
        await handle.writeFile(raw);
        await handle.sync(); // fsync: force the bytes to durable storage
    } finally {
        await handle.close();
    }

    // Now commit the metadata row. This is the atomic dedupe point: a null result
    // means a concurrent run already archived this message. The file we just wrote
    // has the same deterministic path/content as the winner's file, so we simply
    // leave it in place.
    const id = insertEmail({
        sourceId,
        ruleId,
        runId,
        messageId: envelope.messageId,
        folder,
        subject: envelope.subject,
        fromAddr: envelope.from,
        toAddr: envelope.to,
        sentAt,
        size: envelope.size ?? raw.byteLength,
        hasAttachments: attachmentNames.length > 0,
        attachmentNames,
        emlPath: relPath,
        dedupeKey: key,
        bodyText,
    });
    if (id === null) {
        return { archived: false, reason: 'duplicate' };
    }

    return { archived: true, id };
}

function stripHtml(html: string): string {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
