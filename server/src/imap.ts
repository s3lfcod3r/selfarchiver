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
    // Port 993 is implicit TLS (IMAPS) by definition — always use TLS there,
    // even if the stored flag says otherwise, to avoid plaintext-on-993 hangs.
    const secure = conn.secure || port === 993;
    return new ImapFlow({
        host,
        port,
        secure,
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
            try {
                client.close();
            } catch {
                // ensure the socket is released so we don't exhaust server slots
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

/**
 * Turn an imapflow / socket error into a message that actually says what went
 * wrong. imapflow collapses most server rejections into a bare "Command failed"
 * and hides the real reason in `responseText` / `serverResponseCode`; network
 * problems surface a Node `code` instead. We unwrap both so the activity log and
 * the connection test show something actionable (e.g. "IMAP access not enabled")
 * rather than "Command failed".
 */
export function describeImapError(err: unknown): string {
    if (!err || typeof err !== 'object') return String(err);
    const e = err as {
        message?: string;
        responseText?: string;
        response?: string;
        serverResponseCode?: string;
        authenticationFailed?: boolean;
        code?: string;
    };

    // Authentication / authorization — by far the most common and confusing case.
    if (e.authenticationFailed || e.serverResponseCode === 'AUTHENTICATIONFAILED') {
        const detail = (e.responseText || e.response || '').trim();
        return `Login refused by the mail server — wrong username/password, or IMAP access is not enabled for this mailbox${detail ? ` (server said: ${detail})` : ''}.`;
    }

    // Network / TLS layer — these carry a Node error code, not a server response.
    const NET_HINTS: Record<string, string> = {
        ENOTFOUND: 'host not found — check the IMAP host',
        EAI_AGAIN: 'DNS lookup failed — check the IMAP host / network',
        ECONNREFUSED: 'connection refused — check host and port',
        ETIMEDOUT: 'connection timed out — check host, port and firewall',
        ECONNRESET: 'connection reset by the server',
        DEPTH_ZERO_SELF_SIGNED_CERT: 'self-signed certificate — enable "Accept self-signed certificate"',
        SELF_SIGNED_CERT_IN_CHAIN: 'self-signed certificate in chain — enable "Accept self-signed certificate"',
        ERR_TLS_CERT_ALTNAME_INVALID: 'TLS certificate does not match the host name',
    };
    if (e.code && NET_HINTS[e.code]) return NET_HINTS[e.code];
    if (e.code) return `${e.code}${e.message ? ` (${e.message})` : ''}`;

    // Generic command failure: surface the server's own response text, which is
    // exactly what imapflow buries behind "Command failed".
    const serverText = (e.responseText || e.response || '').trim();
    if (serverText && serverText !== e.message) {
        return `${e.message ?? 'IMAP error'}: ${serverText}`;
    }
    return e.message ?? 'IMAP error';
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
    cutoffMs: number,
    seenOnly: boolean,
): AsyncGenerator<EnvelopeSummary> {
    const lock = await client.getMailboxLock(folder);
    try {
        // Use SENTBEFORE (the message's Date header), not BEFORE (the server's
        // internal/received date) — otherwise imported archives, whose internal
        // date is the import time, are wrongly excluded. Add a day because the
        // search is date-granular; the runner then filters by exact timestamp.
        const search: Record<string, unknown> = { sentBefore: new Date(cutoffMs + 86400000) };
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
