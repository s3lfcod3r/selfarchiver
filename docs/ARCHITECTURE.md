# Architecture

SelfArchiver is a single Node process that serves a REST API and a static React
SPA, backed by one SQLite database and a directory of `.eml` files. There are no
external services.

```
┌──────────────────────────── container ────────────────────────────┐
│  Fastify (HTTP)                                                     │
│   ├── /api/*           REST API (sources, rules, emails, runs)      │
│   └── /*               static React SPA (web/dist)                  │
│                                                                     │
│  Scheduler (node-cron)        Runner                                │
│   └── one task per rule  ───▶  fetch → filter → archive → delete    │
│                                                                     │
│  imapflow ─────────────▶ IMAP mailbox (TLS)                         │
│                                                                     │
│  SQLite (better-sqlite3)      Disk                                  │
│   ├── sources                  /data/archive/<source>/<yyyy>/<mm>/  │
│   ├── rules                        *.eml                            │
│   ├── archived_emails                                               │
│   ├── emails_fts (FTS5)                                             │
│   └── runs                                                          │
└─────────────────────────────────────────────────────────────────┘
```

## Components

- **`env.ts`** — resolves config from the environment; ensures `DATA_DIR` and the
  archive directory exist; persists an auto-generated `APP_SECRET` if none given.
- **`db.ts`** — opens SQLite (WAL, foreign keys) and creates the schema
  idempotently at startup. FTS5 is a standalone virtual table whose `rowid`
  matches `archived_emails.rowid`.
- **`crypto.ts`** — AES-256-GCM for mailbox passwords at rest; HMAC for signing
  session cookies.
- **`imap.ts`** — imapflow wrapper: list folders, two-pass fetch (cheap envelope
  summaries first, full source only for matches), and delete (`\Deleted` + expunge).
- **`rules/engine.ts`** — pure filter evaluation against an envelope summary.
- **`archive.ts`** — parses the message, writes the `.eml`, and inserts metadata +
  FTS row in one transaction. Idempotent via a stable dedupe key.
- **`jobs/runner.ts`** — executes a rule: per folder, list candidates older than
  the age threshold, archive matches, then (optionally) delete the
  confirmed-archived ones. Guards against overlapping runs of the same rule.
- **`jobs/scheduler.ts`** — registers one node-cron task per enabled rule and
  computes the next run time with `cron-parser`.
- **`api/*`** — thin Fastify route groups over the repositories + jobs.

## Data flow of a run

1. Scheduler fires (or the user hits **Run now**) → `runner.runRule(rule)`.
2. Connect to the source mailbox (password decrypted in memory only).
3. For each selected folder:
   - Pass 1: stream envelope summaries for messages `BEFORE now - minAgeDays`
     (optionally `SEEN`), released from the mailbox lock before pass 2.
   - Pass 2: for each summary matching the filter, fetch the full source and
     archive it. Collect UIDs that are now safely archived.
   - If the action is `archive_delete`, delete those UIDs from the folder.
4. Persist a `runs` record with scanned / archived / deleted counters.

## Safety properties

- **No accidental sweeps** — a folder is only touched if explicitly selected; the
  filter ANDs all populated conditions; flagged and unread mail are excluded by
  default.
- **Delete is archive-gated** — a message is only removed from the mailbox after
  it exists in the archive (freshly archived or a confirmed prior duplicate).
- **Idempotent** — re-running never stores duplicates.
