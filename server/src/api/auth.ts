import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { sign, unsign } from '../crypto.js';
import { env } from '../env.js';

/**
 * Optional single-admin authentication. When AUTH_PASSWORD is set, every /api
 * route (except the auth/health endpoints) requires a valid signed session
 * cookie. When it is empty the API is left open for trusted private networks.
 *
 * Sessions are random, server-side tokens: the cookie only carries an opaque
 * (HMAC-signed) session id, the actual session lives in memory. This makes a
 * session revocable (logout drops it) and ensures it does not survive a
 * restart — a leaked cookie cannot be replayed forever.
 */

const COOKIE = 'sa_session';
const OPEN_PATHS = new Set(['/api/login', '/api/logout', '/api/session', '/api/health']);

const SESSION_TTL_MS = 60 * 60 * 24 * 30 * 1000; // 30 days
/** Active sessions: opaque id → expiry (epoch ms). In memory only, by design. */
const sessions = new Map<string, number>();

function createSession(): string {
    const id = randomBytes(32).toString('base64url');
    sessions.set(id, Date.now() + SESSION_TTL_MS);
    return id;
}

function sessionValid(id: string): boolean {
    const expiresAt = sessions.get(id);
    if (expiresAt == null) return false;
    if (Date.now() > expiresAt) {
        sessions.delete(id);
        return false;
    }
    return true;
}

function sessionIdFromCookie(cookie: string | undefined): string | null {
    if (!cookie) return null;
    return unsign(cookie);
}

// Simple in-memory brute-force guard for the login endpoint.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function loginRateLimited(ip: string): boolean {
    const now = Date.now();
    const rec = loginAttempts.get(ip);
    if (!rec || now > rec.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
        return false;
    }
    rec.count += 1;
    return rec.count > LOGIN_MAX_ATTEMPTS;
}

/** Periodically evict expired sessions and stale rate-limit buckets. */
function startCleanup(): void {
    const timer = setInterval(
        () => {
            const now = Date.now();
            for (const [id, expiresAt] of sessions) if (now > expiresAt) sessions.delete(id);
            for (const [ip, rec] of loginAttempts) if (now > rec.resetAt) loginAttempts.delete(ip);
        },
        60 * 60 * 1000, // hourly
    );
    timer.unref(); // never keep the process alive just for housekeeping
}

function passwordMatches(input: string): boolean {
    const a = Buffer.from(input);
    const b = Buffer.from(env.authPassword);
    return a.length === b.length && timingSafeEqual(a, b);
}

function isAuthenticated(cookie: string | undefined): boolean {
    const id = sessionIdFromCookie(cookie);
    return Boolean(id && sessionValid(id));
}

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Lightweight CSRF guard. Cookie-based sessions are otherwise only protected by
 * SameSite=Lax, which does not stop every cross-site request. For state-changing
 * methods we additionally require that, IF an Origin header is present, its host
 * matches the request's own Host. Requests without an Origin (curl, the native
 * app, server-to-server) are left untouched, so this never breaks legitimate
 * non-browser clients.
 */
function crossOriginRequest(req: {
    method: string;
    headers: Record<string, unknown>;
}): boolean {
    if (!STATE_CHANGING.has(req.method)) return false;
    const origin = req.headers.origin;
    if (typeof origin !== 'string' || origin === '') return false; // no Origin → allow
    let originHost: string;
    try {
        originHost = new URL(origin).host;
    } catch {
        return true; // malformed Origin → treat as cross-origin and reject
    }
    const host = typeof req.headers.host === 'string' ? req.headers.host : '';
    return originHost !== host;
}

export function registerAuth(app: FastifyInstance): void {
    startCleanup();

    app.addHook('preHandler', async (req, reply) => {
        const path = req.url.split('?')[0];
        if (!path.startsWith('/api/')) return;

        // CSRF guard for browser-driven, state-changing requests. Runs regardless
        // of whether AUTH_PASSWORD is set, and before the auth check.
        if (crossOriginRequest({ method: req.method, headers: req.headers as Record<string, unknown> })) {
            await reply.code(403).send({ error: 'Cross-origin request rejected' });
            return;
        }

        if (!env.authPassword) return;
        if (OPEN_PATHS.has(path)) return;
        if (isAuthenticated(req.cookies?.[COOKIE])) return;
        await reply.code(401).send({ error: 'Unauthorized' });
    });

    app.post('/api/login', async (req, reply) => {
        if (!env.authPassword) return { authenticated: true };
        if (loginRateLimited(req.ip)) {
            return reply.code(429).send({ error: 'Too many attempts. Try again later.' });
        }
        const body = (req.body ?? {}) as { password?: string };
        if (!body.password || !passwordMatches(body.password)) {
            return reply.code(401).send({ error: 'Invalid password' });
        }
        loginAttempts.delete(req.ip); // reset on success
        reply.setCookie(COOKIE, sign(createSession()), {
            httpOnly: true,
            secure: env.cookieSecure,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
        });
        return { authenticated: true };
    });

    app.post('/api/logout', async (req, reply) => {
        const id = sessionIdFromCookie(req.cookies?.[COOKIE]);
        if (id) sessions.delete(id);
        reply.clearCookie(COOKIE, { path: '/' });
        return { ok: true };
    });

    app.get('/api/session', async (req) => {
        const authRequired = Boolean(env.authPassword);
        const authenticated = !authRequired || isAuthenticated(req.cookies?.[COOKIE]);
        return { authRequired, authenticated };
    });
}
