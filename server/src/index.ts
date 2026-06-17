import { existsSync } from 'node:fs';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { registerAuth } from './api/auth.js';
import { registerRoutes } from './api/index.js';
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

    const app = Fastify({ logger: { level: env.logLevel }, bodyLimit: 8 * 1024 * 1024 });
    await app.register(cookie, { secret: env.secret });

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

    if (!env.authPassword && env.host !== '127.0.0.1') {
        logger.warn(
            `SelfArchiver is listening on ${env.host} with NO AUTH_PASSWORD set — the API is open. ` +
                'Set AUTH_PASSWORD (and ideally put it behind HTTPS) before exposing it beyond a trusted network.',
        );
    }

    await app.listen({ port: env.port, host: env.host });

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
