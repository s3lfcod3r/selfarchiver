import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { simpleParser } from 'mailparser';
import { env } from '../env.js';
import { distinctFolders, getEmail, queryEmails } from '../repos/emails.js';

function safeArchivePath(emlPath: string): string | null {
    const abs = resolve(env.archiveDir, emlPath);
    if (abs !== env.archiveDir && !abs.startsWith(env.archiveDir + sep)) return null;
    return abs;
}

/** REST endpoints for browsing, searching and downloading archived emails. */

const MAX_LIMIT = 200;

export function registerArchiveRoutes(app: FastifyInstance): void {
    app.get('/api/emails', async (req) => {
        const q = req.query as {
            search?: string;
            sourceId?: string;
            folder?: string;
            from?: string;
            to?: string;
            limit?: string;
            offset?: string;
        };
        const limit = Math.min(Number(q.limit ?? 50) || 50, MAX_LIMIT);
        const offset = Math.max(Number(q.offset ?? 0) || 0, 0);
        const result = queryEmails({
            search: q.search,
            sourceId: q.sourceId,
            folder: q.folder,
            sentFrom: q.from ? Number(q.from) || undefined : undefined,
            sentTo: q.to ? Number(q.to) || undefined : undefined,
            limit,
            offset,
        });
        return { ...result, limit, offset };
    });

    app.get('/api/emails/folders', async (req) => {
        const { sourceId } = req.query as { sourceId?: string };
        return { folders: distinctFolders(sourceId) };
    });

    app.get('/api/emails/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const email = getEmail(id);
        if (!email) return reply.code(404).send({ error: 'Email not found' });
        return { email };
    });

    app.get('/api/emails/:id/download', async (req, reply) => {
        const { id } = req.params as { id: string };
        const email = getEmail(id);
        if (!email) return reply.code(404).send({ error: 'Email not found' });

        const absPath = safeArchivePath(email.emlPath);
        if (!absPath) return reply.code(400).send({ error: 'Invalid archive path' });

        const fileName = `${(email.subject ?? 'email').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)}.eml`;
        reply.header('Content-Type', 'message/rfc822');
        reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
        return reply.send(createReadStream(absPath));
    });

    // Parsed content of one archived email (headers + text/HTML body), for the viewer.
    app.get('/api/emails/:id/content', async (req, reply) => {
        const { id } = req.params as { id: string };
        const email = getEmail(id);
        if (!email) return reply.code(404).send({ error: 'Email not found' });
        const absPath = safeArchivePath(email.emlPath);
        if (!absPath) return reply.code(400).send({ error: 'Invalid archive path' });

        try {
            const parsed = await simpleParser(await readFile(absPath));
            const atts = (parsed.attachments ?? []).filter((a) => a.filename || a.contentDisposition === 'attachment');
            return {
                subject: parsed.subject ?? email.subject,
                from: parsed.from?.text ?? email.fromAddr,
                to: Array.isArray(parsed.to) ? parsed.to.map((a) => a.text).join(', ') : (parsed.to?.text ?? email.toAddr),
                date: parsed.date ? parsed.date.getTime() : email.sentAt,
                text: parsed.text ?? null,
                html: typeof parsed.html === 'string' ? parsed.html : null,
                attachments: atts.map((a, i) => ({
                    index: i,
                    filename: a.filename ?? `attachment-${i + 1}`,
                    size: typeof a.size === 'number' ? a.size : null,
                    contentType: a.contentType ?? null,
                })),
            };
        } catch (err) {
            return reply.code(500).send({ error: err instanceof Error ? err.message : 'Failed to read email' });
        }
    });

    // Download a single attachment (decoded from the stored .eml).
    app.get('/api/emails/:id/attachment/:index', async (req, reply) => {
        const { id, index } = req.params as { id: string; index: string };
        const email = getEmail(id);
        if (!email) return reply.code(404).send({ error: 'Email not found' });
        const absPath = safeArchivePath(email.emlPath);
        if (!absPath) return reply.code(400).send({ error: 'Invalid archive path' });
        try {
            const parsed = await simpleParser(await readFile(absPath));
            const atts = (parsed.attachments ?? []).filter((a) => a.filename || a.contentDisposition === 'attachment');
            const att = atts[Number(index)];
            if (!att || !att.content) return reply.code(404).send({ error: 'Attachment not found' });
            const fileName = (att.filename ?? `attachment-${Number(index) + 1}`).replace(/[\r\n"]/g, '_');
            reply.header('Content-Type', att.contentType || 'application/octet-stream');
            reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
            return reply.send(att.content);
        } catch (err) {
            return reply.code(500).send({ error: err instanceof Error ? err.message : 'Failed to read attachment' });
        }
    });
}
