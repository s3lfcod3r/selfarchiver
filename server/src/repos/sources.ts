import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import type { Source } from '../types.js';

/** Persistence for mailbox sources. Passwords are stored already-encrypted. */

interface SourceRow {
    id: string;
    name: string;
    host: string;
    port: number;
    secure: number;
    allow_self_signed: number;
    username: string;
    password_enc: string;
    status: string;
    last_checked_at: number | null;
    last_error: string | null;
    created_at: number;
    updated_at: number;
}

function rowToSource(r: SourceRow): Source {
    return {
        id: r.id,
        name: r.name,
        host: r.host,
        port: r.port,
        secure: r.secure === 1,
        allowSelfSigned: r.allow_self_signed === 1,
        username: r.username,
        status: r.status as Source['status'],
        lastCheckedAt: r.last_checked_at,
        lastError: r.last_error,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

const insertStmt = db.prepare(`
    INSERT INTO sources (id, name, host, port, secure, allow_self_signed, username, password_enc, status, created_at, updated_at)
    VALUES (@id, @name, @host, @port, @secure, @allow_self_signed, @username, @password_enc, 'unknown', @now, @now)
`);

export function createSource(input: {
    name: string;
    host: string;
    port: number;
    secure: boolean;
    allowSelfSigned: boolean;
    username: string;
    passwordEnc: string;
}): Source {
    const id = randomUUID();
    const now = Date.now();
    insertStmt.run({
        id,
        name: input.name,
        host: input.host,
        port: input.port,
        secure: input.secure ? 1 : 0,
        allow_self_signed: input.allowSelfSigned ? 1 : 0,
        username: input.username,
        password_enc: input.passwordEnc,
        now,
    });
    return getSource(id)!;
}

export function updateSource(
    id: string,
    fields: {
        name: string;
        host: string;
        port: number;
        secure: boolean;
        allowSelfSigned: boolean;
        username: string;
        passwordEnc?: string;
    },
): Source | null {
    const existing = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as SourceRow | undefined;
    if (!existing) return null;
    db.prepare(
        `UPDATE sources SET name=@name, host=@host, port=@port, secure=@secure, allow_self_signed=@allow_self_signed,
         username=@username, password_enc=@password_enc, updated_at=@now WHERE id=@id`,
    ).run({
        id,
        name: fields.name,
        host: fields.host,
        port: fields.port,
        secure: fields.secure ? 1 : 0,
        allow_self_signed: fields.allowSelfSigned ? 1 : 0,
        username: fields.username,
        password_enc: fields.passwordEnc ?? existing.password_enc,
        now: Date.now(),
    });
    return getSource(id);
}

export function setSourceStatus(id: string, status: Source['status'], error: string | null): void {
    db.prepare('UPDATE sources SET status=?, last_error=?, last_checked_at=?, updated_at=? WHERE id=?').run(
        status,
        error,
        Date.now(),
        Date.now(),
        id,
    );
}

export function getSource(id: string): Source | null {
    const row = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as SourceRow | undefined;
    return row ? rowToSource(row) : null;
}

export function getSourcePasswordEnc(id: string): string | null {
    const row = db.prepare('SELECT password_enc FROM sources WHERE id = ?').get(id) as
        | { password_enc: string }
        | undefined;
    return row?.password_enc ?? null;
}

export function listSources(): Source[] {
    const rows = db.prepare('SELECT * FROM sources ORDER BY created_at DESC').all() as SourceRow[];
    return rows.map(rowToSource);
}

export function deleteSource(id: string): boolean {
    const info = db.prepare('DELETE FROM sources WHERE id = ?').run(id);
    return info.changes > 0;
}
