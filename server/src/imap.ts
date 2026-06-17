import { ImapFlow, type ListResponse, type MailboxObject } from 'imapflow';
import type { MailboxFolder } from './types.js';

/**
 * Thin wrapper around imapflow. All IMAP-specific behaviour lives here so the
 * rest of the app deals only with plain data. Connections are short-lived: we
 * connect, do the work, and log out.
 */

export interface ImapConnection {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    /** Accept self-signed / untrusted TLS certificates (local mail servers). */
    allowSelfSigned?: boolean;
}

export interface EnvelopeSummary {
    uid: number;
    messageId: string | null;
    subject: string | null;
    from: string | null;
    to: string | null;
    date: number | null;
    size: number | null;
    flags: string[];
    hasAttachment: boolean;
}

const CONNECT_TIMEOUT_MS = 45000;
const CONNECT_ATTEMPTS = 3;

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A host field must not carry a `:port` (people often paste `host:5000`, the
 * Synology/DSM web port, instead of the IMAP port). Strip it, handle IPv6 in
 * brackets, trim, and clamp the port. Adopted from the SelfDashboard mail plugin.
 */
export function normalizeHostPort(hostInput: string, portInput: number): { host: string; port: number } {
    let host = (hostInput ?? '').trim();
    let port = portInput;
    if (!host) return { host: '', port };

    const bracket = host.match(/^\[([^\]]+)\](?::(\d+))?$/);
    if (bracket) {
        host = bracket[1];
        if (bracket[2]) port = parseInt(bracket[2], 10) || port;
        return { host, port: Math.max(1, Math.min(65535, port)) };
    }

    const colon = host.lastIndexOf(':');
    if (colon > 0 && /^\d+$/.test(host.slice(colon + 1))) {
        const parsed = parseInt(host.slice(colon + 1), 10);
        host = host.slice(0, colon);
        if (parsed >= 1 && parsed <= 65535) port = parsed;
    }
    return { host: host.trim(), port: Math.max(1, Math.min(65535, port)) };
}

export function createClient(conn: ImapConnection): ImapFlow {
    const { host, port } = normalizeHostPort(conn.host, conn.port);
    return new ImapFlow({
        host,
        port,
        secure: conn.secure,
        auth: { user: conn.user, pass: conn.pass },
        logger: false,
        emitLogs: false,
        socketTimeout: 120000,
        greetingTimeout: CONNECT_TIMEOUT_MS,
        connectionTimeout: CONNECT_TIMEOUT_MS,
        tls: { rejectUnauthorized: !conn.allowSelfSigned },
    });
}

/**
 * Connect, run `fn`, and always log out afterwards. The connect step is retried
 * a few times: slow mail servers (e.g. Synology MailPlus) occasionally miss the
 * greeting window or briefly refuse rapid reconnects, which is transient.
 */
export async function withClient<T>(conn: ImapConnection, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt++) {
        const client = createClient(conn);
        try {
            await client.connect();
        } catch (err) {
            lastError = err;
            try {
                client.close();
            } catch {
                // ignore
            }
            if (attempt < CONNECT_ATTEMPTS) {
                await delay(1500 * attempt);
                continue;
            }
            throw err;
        }

        try {
            return await fn(client);
        } finally {
            try {
                await client.logout();
            } catch {
                // best-effort close; nothing actionable if logout fails
            }
        }
    }
    throw lastError;
}

/** Verify credentials by connecting and immediately logging out. */
export async function testConnection(conn: ImapConnection): Promise<void> {
    await withClient(conn, async () => {
        // connecting successfully is the test
    });
}

function specialUseOf(box: ListResponse): string | null {
    if (box.specialUse) return box.specialUse;
    const flags = box.flags;
    if (!flags) return null;
    for (const flag of flags) {
        if (['\\Junk', '\\Trash', '\\Sent', '\\Drafts', '\\Archive', '\\All'].includes(flag)) return flag;
    }
    return null;
}

export async function listFolders(conn: ImapConnection): Promise<MailboxFolder[]> {
    return withClient(conn, async (client) => {
        const boxes = await client.list();
        return boxes.map((box) => ({
            path: box.path,
            name: box.name,
            specialUse: specialUseOf(box),
            selectable: !box.flags?.has('\\Noselect'),
        }));
    });
}

/** Walk the BODYSTRUCTURE tree looking for any part marked as an attachment. */
function structureHasAttachment(node: unknown): boolean {
    if (!node || typeof node !== 'object') return false;
    const n = node as { disposition?: string; childNodes?: unknown[] };
    if (typeof n.disposition === 'string' && n.disposition.toLowerCase() === 'attachment') return true;
    if (Array.isArray(n.childNodes)) {
        return n.childNodes.some((child) => structureHasAttachment(child));
    }
    return false;
}

function formatAddress(list: { name?: string; address?: string }[] | undefined): string | null {
    if (!list || list.length === 0) return null;
    return list
        .map((a) => (a.name ? `${a.name} <${a.address ?? ''}>` : (a.address ?? '')))
        .filter(Boolean)
        .join(', ');
}

/**
 * Stream lightweight envelope summaries for every message in `folder` older
 * than `before`. This is the cheap first pass used to decide which messages a
 * rule will actually archive.
 */
export async function* fetchEnvelopes(
    client: ImapFlow,
    folder: string,
    before: Date,
    seenOnly: boolean,
): AsyncGenerator<EnvelopeSummary> {
    const lock = await client.getMailboxLock(folder);
    try {
        const search: Record<string, unknown> = { before };
        if (seenOnly) search.seen = true;
        for await (const msg of client.fetch(search, {
            uid: true,
            envelope: true,
            flags: true,
            size: true,
            internalDate: true,
            bodyStructure: true,
        })) {
            yield {
                uid: msg.uid,
                messageId: msg.envelope?.messageId ?? null,
                subject: msg.envelope?.subject ?? null,
                from: formatAddress(msg.envelope?.from),
                to: formatAddress(msg.envelope?.to),
                date: msg.envelope?.date
                    ? new Date(msg.envelope.date).getTime()
                    : msg.internalDate
                      ? new Date(msg.internalDate).getTime()
                      : null,
                size: msg.size ?? null,
                flags: msg.flags ? [...msg.flags] : [],
                hasAttachment: structureHasAttachment(msg.bodyStructure),
            };
        }
    } finally {
        lock.release();
    }
}

/** Download the full RFC 5322 source of a single message by UID. */
export async function fetchSource(client: ImapFlow, folder: string, uid: number): Promise<Buffer | null> {
    const lock = await client.getMailboxLock(folder);
    try {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg || !msg.source) return null;
        return msg.source;
    } finally {
        lock.release();
    }
}

/**
 * Permanently remove messages from the source mailbox (sets \Deleted and
 * expunges). Only ever called after the messages have been safely archived.
 */
export async function deleteMessages(client: ImapFlow, folder: string, uids: number[]): Promise<void> {
    if (uids.length === 0) return;
    const lock = await client.getMailboxLock(folder);
    try {
        await client.messageDelete(uids, { uid: true });
    } finally {
        lock.release();
    }
}

export type { MailboxObject };
