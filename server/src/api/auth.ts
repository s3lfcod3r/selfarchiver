import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { sign, unsign } from '../crypto.js';
import { env } from '../env.js';

/**
 * Optional single-admin authentication. When AUTH_PASSWORD is set, every /api
 * route (except the auth/health endpoints) requires a valid signed session
 * cookie. When it is empty the API is left open for trusted private networks.
 */

const COOKIE = 'sa_session';
const OPEN_PATHS = new Set(['/api/login', '/api/logout', '/api/session', '/api/health']);

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

function passwordMatches(input: string): boolean {
    const a = Buffer.from(input);
    const b = Buffer.from(env.authPassword);
    return a.length === b.length && timingSafeEqual(a, b);
}

function isAuthenticated(cookie: string | undefined): boolean {
    return Boolean(cookie && unsign(cookie) === 'ok');
}

export function registerAuth(app: FastifyInstance): void {
    app.addHook('preHandler', async (req, reply) => {
        if (!env.authPassword) return;
        const path = req.url.split('?')[0];
        if (!path.startsWith('/api/')) return;
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
        reply.setCookie(COOKIE, sign('ok'), {
            httpOnly: true,
            secure: env.cookieSecure,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
        });
        return { authenticated: true };
    });

    app.post('/api/logout', async (_req, reply) => {
        reply.clearCookie(COOKIE, { path: '/' });
        return { ok: true };
    });

    app.get('/api/session', async (req) => {
        const authRequired = Boolean(env.authPassword);
        const authenticated = !authRequired || isAuthenticated(req.cookies?.[COOKIE]);
        return { authRequired, authenticated };
    });
}
