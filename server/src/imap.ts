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

const CONNECT_TIMEOUT_MS = 20000;

export function createClient(conn: ImapConnection): ImapFlow {
    return new ImapFlow({
        host: conn.host,
        port: conn.port,
        secure: conn.secure,
        auth: { user: conn.user, pass: conn.pass },
        logger: false,
        emitLogs: false,
        socketTimeout: 120000,
        greetingTimeout: CONNECT_TIMEOUT_MS,
        connectionTimeout: CONNECT_TIMEOUT_MS,
    });
}

/** Connect, run `fn`, and always log out afterwards. */
export async function withClient<T>(conn: ImapConnection, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = createClient(conn);
    await client.connect();
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
