import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Central runtime configuration, derived once from the environment.
 *
 * Everything the app persists (SQLite database, the .eml archive and the
 * auto-generated secret) lives under a single DATA_DIR so the whole state can
 * be mapped to one Docker / Unraid volume.
 */

const DATA_DIR = resolve(process.env.DATA_DIR ?? './data');
const ARCHIVE_DIR = process.env.ARCHIVE_DIR
    ? resolve(process.env.ARCHIVE_DIR)
    : join(DATA_DIR, 'archive');

function ensureDir(dir: string): void {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

ensureDir(DATA_DIR);
ensureDir(ARCHIVE_DIR);

/**
 * Resolve the application secret used to encrypt stored mailbox passwords and
 * sign session cookies. A stable value is mandatory (otherwise stored
 * passwords become undecryptable after a restart), so if the operator did not
 * provide APP_SECRET we generate one once and persist it next to the data.
 */
function resolveSecret(): string {
    const fromEnv = process.env.APP_SECRET?.trim();
    if (fromEnv && fromEnv.length >= 32) {
        return fromEnv;
    }
    if (fromEnv && fromEnv.length > 0) {
        // Too short to be safe — fall through to the generated 256-bit secret.
        console.warn('[selfarchiver] APP_SECRET is shorter than 32 chars; using the generated secret instead.');
    }
    const secretFile = join(DATA_DIR, '.secret');
    if (existsSync(secretFile)) {
        return readFileSync(secretFile, 'utf8').trim();
    }
    const generated = randomBytes(32).toString('hex');
    writeFileSync(secretFile, generated, { mode: 0o600 });
    return generated;
}

export const env = {
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? '0.0.0.0',
    dataDir: DATA_DIR,
    archiveDir: ARCHIVE_DIR,
    dbPath: process.env.DB_PATH ? resolve(process.env.DB_PATH) : join(DATA_DIR, 'selfarchiver.sqlite'),
    secret: resolveSecret(),
    /** Optional single-admin password. When empty, the UI/API is left open. */
    authPassword: process.env.AUTH_PASSWORD?.trim() ?? '',
    /** Send the session cookie only over HTTPS. Enable when behind a TLS proxy. */
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    /** Timezone used to evaluate per-rule cron schedules. */
    cronTimezone: process.env.CRON_TZ?.trim() || process.env.TZ?.trim() || 'UTC',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    /** Path to the built frontend; only served when present. */
    webDir: resolve(process.env.WEB_DIR ?? '../web/dist'),
} as const;

export type Env = typeof env;
