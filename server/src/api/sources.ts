import type { FastifyInstance } from 'fastify';
import { decryptSecret, encryptSecret } from '../crypto.js';
import { describeImapError, listFolders, testConnection, type ImapConnection } from '../imap.js';
import {
    createSource,
    deleteSource,
    getSource,
    getSourcePasswordEnc,
    listSources,
    setSourceStatus,
    updateSource,
} from '../repos/sources.js';
import { sourceInputSchema } from '../types.js';

/** REST endpoints for mailbox sources. */

function connFromSource(id: string): ImapConnection | null {
    const source = getSource(id);
    const enc = getSourcePasswordEnc(id);
    if (!source || !enc) return null;
    return {
        host: source.host,
        port: source.port,
        secure: source.secure,
        allowSelfSigned: source.allowSelfSigned,
        user: source.username,
        pass: decryptSecret(enc),
    };
}

async function safeTest(conn: ImapConnection): Promise<{ ok: boolean; error: string | null }> {
    try {
        await testConnection(conn);
        return { ok: true, error: null };
    } catch (err) {
        return { ok: false, error: describeImapError(err) };
    }
}

export function registerSourceRoutes(app: FastifyInstance): void {
    app.get('/api/sources', async () => ({ sources: listSources() }));

    app.post('/api/sources', async (req, reply) => {
        const parsed = sourceInputSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
        const d = parsed.data;
        if (!d.password) return reply.code(400).send({ error: 'Password is required' });

        const source = createSource({
            name: d.name,
            host: d.host,
            port: d.port,
            secure: d.secure,
            allowSelfSigned: d.allowSelfSigned,
            username: d.username,
            passwordEnc: encryptSecret(d.password),
        });
        const test = await safeTest({
            host: d.host,
            port: d.port,
            secure: d.secure,
            allowSelfSigned: d.allowSelfSigned,
            user: d.username,
            pass: d.password,
        });
        setSourceStatus(source.id, test.ok ? 'ok' : 'error', test.error);
        return reply.code(201).send({ source: getSource(source.id), connectionOk: test.ok, error: test.error });
    });

    app.put('/api/sources/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const parsed = sourceInputSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
        const d = parsed.data;
        const updated = updateSource(id, {
            name: d.name,
            host: d.host,
            port: d.port,
            secure: d.secure,
            allowSelfSigned: d.allowSelfSigned,
            username: d.username,
            passwordEnc: d.password ? encryptSecret(d.password) : undefined,
        });
        if (!updated) return reply.code(404).send({ error: 'Source not found' });
        const conn = connFromSource(id);
        const test = conn ? await safeTest(conn) : { ok: false, error: 'No credentials' };
        setSourceStatus(id, test.ok ? 'ok' : 'error', test.error);
        return { source: getSource(id), connectionOk: test.ok, error: test.error };
    });

    app.delete('/api/sources/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        if (!deleteSource(id)) return reply.code(404).send({ error: 'Source not found' });
        return { ok: true };
    });

    // Test arbitrary (unsaved) credentials straight from the form. On edit, an
    // empty password falls back to the stored one (via the optional id).
    app.post('/api/sources/test-connection', async (req, reply) => {
        const b = (req.body ?? {}) as {
            id?: string;
            host?: string;
            port?: number;
            secure?: boolean;
            allowSelfSigned?: boolean;
            username?: string;
            password?: string;
        };
        if (!b.host || !b.username) return reply.code(400).send({ ok: false, error: 'Host and username required' });
        let pass = b.password ?? '';
        if (!pass && b.id) {
            const enc = getSourcePasswordEnc(b.id);
            if (enc) pass = decryptSecret(enc);
        }
        if (!pass) return reply.code(400).send({ ok: false, error: 'Password required' });
        return safeTest({
            host: b.host,
            port: Number(b.port) || 993,
            secure: b.secure !== false,
            allowSelfSigned: Boolean(b.allowSelfSigned),
            user: b.username,
            pass,
        });
    });

    app.post('/api/sources/:id/test', async (req, reply) => {
        const { id } = req.params as { id: string };
        const conn = connFromSource(id);
        if (!conn) return reply.code(404).send({ error: 'Source not found' });
        const test = await safeTest(conn);
        setSourceStatus(id, test.ok ? 'ok' : 'error', test.error);
        return test;
    });

    app.get('/api/sources/:id/folders', async (req, reply) => {
        const { id } = req.params as { id: string };
        const conn = connFromSource(id);
        if (!conn) return reply.code(404).send({ error: 'Source not found' });
        try {
            return { folders: await listFolders(conn) };
        } catch (err) {
            return reply.code(502).send({ error: describeImapError(err) });
        }
    });
}
