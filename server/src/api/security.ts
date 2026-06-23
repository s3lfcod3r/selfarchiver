import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';

/**
 * Baseline HTTP security headers applied to every response. Kept as a small
 * hand-rolled hook instead of pulling in a dependency (e.g. helmet) — for a
 * handful of static headers that suits the project's single-container,
 * minimal-dependency philosophy.
 *
 * The CSP allows inline styles (React style props + Tailwind) but no inline or
 * eval'd scripts. The archived-email viewer renders untrusted HTML inside a
 * sandboxed `srcdoc` iframe that carries its own, far stricter CSP, so
 * `frame-src 'self'` here only has to permit that same-origin iframe.
 */
const CSP = [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
    "font-src 'self' data:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
].join('; ');

export function registerSecurityHeaders(app: FastifyInstance): void {
    app.addHook('onSend', async (_req, reply, payload) => {
        reply.header('Content-Security-Policy', CSP);
        reply.header('X-Content-Type-Options', 'nosniff');
        reply.header('X-Frame-Options', 'DENY');
        reply.header('Referrer-Policy', 'no-referrer');
        reply.header('X-DNS-Prefetch-Control', 'off');
        reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        // HSTS only makes sense once traffic is actually HTTPS (behind a TLS proxy).
        if (env.cookieSecure) {
            reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }
        return payload;
    });
}
