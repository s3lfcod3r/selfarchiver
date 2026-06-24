import Database from 'better-sqlite3';
import { env } from './env.js';

/**
 * Single SQLite database for the whole app. We deliberately avoid a migration
 * toolchain: the schema is created idempotently at startup with
 * `CREATE TABLE IF NOT EXISTS`, which is plenty for a single-file,
 * single-instance self-hosted service and keeps the container dependency-free.
 */

export const db = new Database(env.dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

export function initSchema(): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS sources (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            host            TEXT NOT NULL,
            port            INTEGER NOT NULL,
            secure          INTEGER NOT NULL DEFAULT 1,
            allow_self_signed INTEGER NOT NULL DEFAULT 0,
            username        TEXT NOT NULL,
            password_enc    TEXT NOT NULL,
            status          TEXT NOT NULL DEFAULT 'unknown',
            last_checked_at INTEGER,
            last_error      TEXT,
            created_at      INTEGER NOT NULL,
            updated_at      INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS rules (
            id            TEXT PRIMARY KEY,
            source_id     TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
            name          TEXT NOT NULL,
            enabled       INTEGER NOT NULL DEFAULT 1,
            folders       TEXT NOT NULL DEFAULT '[]',
            include_subfolders INTEGER NOT NULL DEFAULT 0,
            filter        TEXT NOT NULL DEFAULT '{}',
            min_age_days  INTEGER NOT NULL DEFAULT 30,
            min_age_unit  TEXT NOT NULL DEFAULT 'days',
            action        TEXT NOT NULL DEFAULT 'archive',
            schedule_cron TEXT NOT NULL DEFAULT '0 3 * * *',
            last_run_at   INTEGER,
            next_run_at   INTEGER,
            created_at    INTEGER NOT NULL,
            updated_at    INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_rules_source ON rules(source_id);

        CREATE TABLE IF NOT EXISTS archived_emails (
            id               TEXT PRIMARY KEY,
            source_id        TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
            rule_id          TEXT,
            run_id           TEXT,
            message_id       TEXT,
            folder           TEXT NOT NULL,
            subject          TEXT,
            from_addr        TEXT,
            to_addr          TEXT,
            sent_at          INTEGER,
            size             INTEGER,
            has_attachments  INTEGER NOT NULL DEFAULT 0,
            attachment_names TEXT NOT NULL DEFAULT '[]',
            eml_path         TEXT NOT NULL,
            archived_at      INTEGER NOT NULL,
            dedupe_key       TEXT NOT NULL UNIQUE
        );
        CREATE INDEX IF NOT EXISTS idx_emails_source ON archived_emails(source_id);
        CREATE INDEX IF NOT EXISTS idx_emails_archived_at ON archived_emails(archived_at);
        CREATE INDEX IF NOT EXISTS idx_emails_run ON archived_emails(run_id);

        CREATE VIRTUAL TABLE IF NOT EXISTS emails_fts USING fts5(
            subject, sender, recipients, body
        );

        -- Keep the FTS index in sync when archived emails are removed, including
        -- ON DELETE CASCADE when a source is deleted. Inserts are handled in code.
        CREATE TRIGGER IF NOT EXISTS archived_emails_fts_delete
        AFTER DELETE ON archived_emails BEGIN
            DELETE FROM emails_fts WHERE rowid = old.rowid;
        END;

        CREATE TABLE IF NOT EXISTS runs (
            id          TEXT PRIMARY KEY,
            rule_id     TEXT NOT NULL,
            trigger     TEXT NOT NULL DEFAULT 'schedule',
            status      TEXT NOT NULL DEFAULT 'running',
            started_at  INTEGER NOT NULL,
            finished_at INTEGER,
            scanned     INTEGER NOT NULL DEFAULT 0,
            archived    INTEGER NOT NULL DEFAULT 0,
            deleted     INTEGER NOT NULL DEFAULT 0,
            error       TEXT,
            note        TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_runs_rule ON runs(rule_id);
        CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);

    // Lightweight migrations for databases created before a column existed.
    ensureColumn('sources', 'allow_self_signed', 'INTEGER NOT NULL DEFAULT 0');
    ensureColumn('rules', 'min_age_unit', "TEXT NOT NULL DEFAULT 'days'");
    ensureColumn('rules', 'include_subfolders', 'INTEGER NOT NULL DEFAULT 0');
    ensureColumn('runs', 'note', 'TEXT');
    ensureColumn('archived_emails', 'run_id', 'TEXT');
}

/** Add a column to an existing table if it is not already present. */
function ensureColumn(table: string, column: string, definition: string): void {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!columns.some((c) => c.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

// Create the schema at module load. Repositories (e.g. repos/emails.ts) prepare
// statements at import time — which runs before main() — so the tables must
// exist as soon as this module is imported. CREATE ... IF NOT EXISTS keeps this
// safe and idempotent even though main() also calls initSchema().
initSchema();
