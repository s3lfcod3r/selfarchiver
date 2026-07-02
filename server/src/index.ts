import { existsSync } from 'node:fs';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { registerAuth } from './api/auth.js';
import { registerRoutes } from './api/index.js';
import { registerSecurityHeaders } from './api/security.js';
import { db, initSchema } from './db.js';
import { env } from './env.js';
import { initScheduler } from './jobs/scheduler.js';
import { logger } from './logger.js';

/**
 * Application entry point: prepare the database, build the HTTP server (API +
 * static SPA), start the per-rule scheduler and listen.
 */
async function main(): Promise<void> {
    initSchema();

    // trustProxy so req.ip reflects the real client (via X-Forwarded-For) when
    // behind a reverse proxy — otherwise the login rate-limit would bucket every
    // request under the single proxy IP.
    const app = Fastify({ logger: { level: env.logLevel }, bodyLimit: 8 * 1024 * 1024, trustProxy: true });
    await app.register(cookie, { secret: env.secret });

    registerSecurityHeaders(app);
    registerAuth(app);
    registerRoutes(app);

    // Serve the built frontend when present (single-container deployment).
    if (existsSync(env.webDir)) {
        await app.register(fastifyStatic, { root: env.webDir });
        app.setNotFoundHandler((req, reply) => {
            if (req.url.startsWith('/api/')) {
                return reply.code(404).send({ error: 'Not found' });
            }
            return reply.sendFile('index.html');
        });
        logger.info({ webDir: env.webDir }, 'serving frontend');
    } else {
        logger.warn({ webDir: env.webDir }, 'frontend build not found; running API-only');
    }

    initScheduler();

    // Fail safe when the API is unauthenticated: if no AUTH_PASSWORD is set we must
    // not expose an open API on all interfaces. Unless the operator *explicitly*
    // chose a HOST, bind to loopback only so the open API is unreachable from the
    // network. An explicit HOST is respected but loudly warned about.
    const hostExplicit = Boolean(process.env.HOST?.trim());
    let host = env.host;
    if (!env.authPassword) {
        if (!hostExplicit) {
            host = '127.0.0.1';
            logger.warn(
                'No AUTH_PASSWORD set — the API has no authentication. Binding to 127.0.0.1 (loopback) only. ' +
                    'Set AUTH_PASSWORD to enable auth, or set HOST explicitly to bind elsewhere (not recommended without auth).',
            );
        } else if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
            logger.warn(
                `DANGER: listening on ${host} with NO AUTH_PASSWORD set — the API is OPEN to anyone who can reach it. ` +
                    'Set AUTH_PASSWORD (and put it behind HTTPS) before exposing it beyond a trusted network.',
            );
        }
    }

    await app.listen({ port: env.port, host });

    const shutdown = async (): Promise<void> => {
        logger.info('shutting down');
        await app.close();
        db.close();
        process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown());
    process.on('SIGINT', () => void shutdown());
}

main().catch((err) => {
    logger.error(err, 'failed to start');
    process.exit(1);
});
