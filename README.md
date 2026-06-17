<p align="center">
  <img src="assets/selfarchiver-logo-wide.png" alt="SelfArchiver" width="440">
</p>

<p align="center">Self-hosted email archiver that keeps your mailbox <strong>small</strong> and your mail <strong>safe</strong> — with the controls other archivers are missing.</p>

---

Most archivers can only mirror a whole account. SelfArchiver is built around four things they don't do:

- **📂 Selective folders** — archive *only* the folders you choose (e.g. `Invoices`, `Insurance`), never the spam-filled inbox.
- **🎛 Rule-based filters** — match by sender, subject, attachment presence and age, with read/flagged safeguards so important or unread mail is never touched.
- **⏱ Per-rule schedules** — every rule runs on its own cron schedule, completely independent of the others.
- **🧹 Archive-then-delete retention** — optionally delete mail from the source mailbox *after* it has been safely archived, so a free mailbox quota is enough.

Everything lives in **one container**: SQLite (with full-text search) and `.eml` files on a single volume. No Postgres, Redis, search engine or Tika sidecars to run.

> ⚠️ **Status:** early release (v0.1). The archive-then-delete action permanently removes mail from your mailbox once archived — test with *Archive only* first and keep backups of anything irreplaceable.

---

## Features

| | |
|---|---|
| **Sources** | Connect any IMAP mailbox. Credentials are encrypted at rest (AES-256-GCM). |
| **Folder picker** | Lists the mailbox's folders and lets you tick exactly which to archive. |
| **Filter** | `From`/`Subject`/`To` contains-any, require attachment, only-read, exclude-flagged. |
| **Age** | Only act on mail older than *N* days. |
| **Schedule** | Per-rule cron with presets, custom expressions and a live "next run" preview. |
| **Retention** | *Archive only* or *Archive, then delete from mailbox*. Deletion only happens after a confirmed archive. |
| **Archive** | Browse + full-text search (subject, sender, recipients, body). Download any message as `.eml`. |
| **Activity** | Run history with scanned / archived / deleted counts and errors. |
| **Language** | UI in English & German, switchable in the sidebar (remembers your choice). |
| **Auth** | Optional single-password login for the whole UI. |

## How it works

1. You add an **IMAP mailbox** (source).
2. You create one or more **rules**: pick folders, set a filter, choose an age threshold, a schedule and whether to delete after archiving.
3. On schedule (or **Run now**), SelfArchiver lists messages older than the threshold in each selected folder, archives the ones matching the filter (full `.eml` incl. attachments) into the database + disk, and — if enabled — deletes those messages from the mailbox.

Archiving is **idempotent**: a stable per-message key prevents duplicates, so re-running a rule is always safe.

## Quick start

### Docker Compose

```bash
git clone https://github.com/kabelsalatundklartext/selfarchiver.git
cd selfarchiver
cp .env.example .env
# set APP_SECRET (openssl rand -hex 32) and optionally AUTH_PASSWORD
docker compose up -d
```

Open `http://<host>:3000`.

### Unraid

The template lives at [`unraid/selfarchiver.xml`](unraid/selfarchiver.xml). Add this repo as a template source, or paste the XML into a new container template. Set **APP_SECRET** (and optionally **AUTH_PASSWORD**) and map `/data` to e.g. `/mnt/user/appdata/selfarchiver`.

The image is published to GHCR: `ghcr.io/kabelsalatundklartext/selfarchiver:latest`.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port. |
| `APP_SECRET` | _(auto)_ | Secret for encrypting mailbox passwords + signing sessions. **Set and keep stable.** |
| `AUTH_PASSWORD` | _(empty)_ | Optional UI password. Empty = open instance. |
| `TZ` / `CRON_TZ` | `UTC` | Timezone for cron schedules. |
| `DATA_DIR` | `/data` | SQLite DB + `.eml` archive location. |
| `LOG_LEVEL` | `info` | `trace`…`error`. |

## Development

```bash
npm install
npm run dev       # backend on :3000 (tsx watch)
npm run dev:web   # frontend on :5173 (Vite, proxies /api)
npm run typecheck # type-check both workspaces
npm run build     # build web + prepare server
```

Stack: Node + Fastify + better-sqlite3 (FTS5) + imapflow + node-cron on the backend; React + Vite + Tailwind on the frontend. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Security notes

- Mailbox passwords are encrypted with a key derived from `APP_SECRET`. Losing/changing the secret makes them unrecoverable.
- Run behind HTTPS (reverse proxy) if exposed beyond a trusted LAN, and set `AUTH_PASSWORD`.
- The *Archive, then delete* action is irreversible on the mailbox side. The archive copy remains, but treat it like any retention policy.

## License

MIT — see [`LICENSE`](LICENSE). SelfArchiver is an independent implementation; see [`NOTICE.md`](NOTICE.md).
