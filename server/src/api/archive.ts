import { createReadStream } from 'node:fs';
import { resolve, sep } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';
import { getEmail, queryEmails } from '../repos/emails.js';

/** REST endpoints for browsing, searching and downloading archived emails. */

const MAX_LIMIT = 200;

export function registerArchiveRoutes(app: FastifyInstance): void {
    app.get('/api/emails', async (req) => {
        const q = req.query as { search?: string; sourceId?: string; folder?: string; limit?: string; offset?: string };
        const limit = Math.min(Number(q.limit ?? 50) || 50, MAX_LIMIT);
        const offset = Math.max(Number(q.offset ?? 0) || 0, 0);
        const result = queryEmails({
            search: q.search,
            sourceId: q.sourceId,
            folder: q.folder,
            limit,
            offset,
        });
        return { ...result, limit, offset };
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

        // Defense in depth: ensure the stored path cannot escape the archive root.
        const absPath = resolve(env.archiveDir, email.emlPath);
        if (absPath !== env.archiveDir && !absPath.startsWith(env.archiveDir + sep)) {
            return reply.code(400).send({ error: 'Invalid archive path' });
        }

        const fileName = `${(email.subject ?? 'email').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)}.eml`;
        reply.header('Content-Type', 'message/rfc822');
        reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
        return reply.send(createReadStream(absPath));
    });
}
