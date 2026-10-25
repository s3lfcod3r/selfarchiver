<div align="center">

<img src="assets/logo.png" width="240" alt="SelfArchiver logo" />

**Self-hosted email archiver that keeps your mailbox small and your mail safe — with the controls other archivers are missing.**<br>
*Selbstgehosteter E-Mail-Archivierer, der dein Postfach klein und deine Mails sicher hält — mit den Stellschrauben, die anderen Archivierern fehlen.*

[![Build](https://github.com/s3lfcod3r/selfarchiver/actions/workflows/docker.yml/badge.svg)](https://github.com/s3lfcod3r/selfarchiver/actions/workflows/docker.yml)
![Version](https://img.shields.io/badge/version-1.0.0-33A78C)
[![License](https://img.shields.io/badge/license-All%20rights%20reserved-8A9CAA)](LICENSE)
![Backend](https://img.shields.io/badge/backend-Node%20%2B%20Fastify-1F7763)
![Web](https://img.shields.io/badge/web-React%20%2B%20Vite-43D3AD)
[![Deploy](https://img.shields.io/badge/deploy-GHCR%20%2B%20Unraid-6F95AD)](https://github.com/s3lfcod3r/selfarchiver/pkgs/container/selfarchiver)

**[🇬🇧 English](#-english) · [🇩🇪 Deutsch](#-deutsch)**

📰 **What's new / Neuigkeiten** → [CHANGELOG.md](CHANGELOG.md)

</div>

---

<a id="-english"></a>

## 🇬🇧 English

Most archivers can only mirror a whole account. SelfArchiver connects to your **IMAP** mailboxes and archives **only what your rules select** — and can then delete it from the mailbox, so a free mailbox quota is enough. It is **not** a full-account mirror or mail server, and an independent implementation, not a fork of other archivers ([NOTICE.md](NOTICE.md)).

Part of the **Self** family (SelfMailer, SelfStream, SelfDashboard …) — same design system, same deploy style (GHCR → Unraid).

> **TL;DR** — selective folders · rule-based filters · per-rule schedules · archive-then-delete · full-text search · single container · no external DB.

### 📑 Table of contents

[Features](#en-features) · [How it works](#en-how-it-works) · [Architecture](#en-architecture) · [Quick start](#en-quick-start) · [Unraid](#en-unraid) · [Configuration](#en-configuration) · [API](#en-api) · [Security](#en-security) · [Tech stack](#en-tech-stack) · [Development](#en-development) · [Roadmap](#en-roadmap)

<a id="en-features"></a>

### ✨ Features

**📂 Archiving**
- **Selective folders** — archive *only* the folders you choose (e.g. `Invoices`, `Insurance`), never the spam-filled inbox; **Refresh** button and an option to **include new subfolders**
- **Rule-based filters** — `From` / `Subject` / `To` contains-any, require attachment, only-read, exclude-flagged — so important or unread mail is never touched
- **Age** — only act on mail older than *N* **days or hours**
- **Per-rule schedules** — builder for hourly / daily / weekly / monthly (time, weekdays, day of month) or a custom **cron**, with a live "next run" preview; every rule runs independently
- **Archive-then-delete retention** — *Archive only* or *Archive, then delete from mailbox*; deletion only happens after a **confirmed archive**
- **Idempotent** — a stable per-message key prevents duplicates, re-running a rule is always safe

**🔎 Archive**
- Browse + **full-text search** (subject, sender, recipients, body); filter by mailbox, folder and sent date
- Click an archived email to **read it inline**; download any message as `.eml` or single **attachments**
- **Delete** single archived emails or a whole folder (with confirmation)

**📊 Activity**
- **Run history** with scanned / archived / deleted counts and errors, filterable
- See **which emails a run archived**; delete single runs or clear the whole history; configurable history retention

**🔐 Security & platform**
- Mailbox credentials **encrypted at rest** (AES-256-GCM); self-signed certificates (local servers) can be allowed per mailbox
- Optional **single-password login** for the whole UI
- Dark or light UI, **12 languages** (dropdown), collapsible navigation, mobile layout with hamburger drawer
- **Single container** — SQLite (with full-text search) and `.eml` files on one volume; no Postgres, Redis, search engine or Tika sidecars

<a id="en-how-it-works"></a>

### 🔁 How it works

1. You add an **IMAP mailbox** (source).
2. You create one or more **rules**: pick folders, set a filter, choose an age threshold, a schedule and whether to delete after archiving.
3. On schedule (or **Run now**), SelfArchiver lists messages older than the threshold in each selected folder, archives the ones matching the filter (full `.eml` incl. attachments) into the database + disk, and — if enabled — deletes those messages from the mailbox.

<a id="en-architecture"></a>

### 🧭 Architecture

```text
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
└─────────────────────────────────────────────────────────────────────┘
```

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

<a id="en-quick-start"></a>

### 🚀 Quick start (Docker)

```bash
git clone https://github.com/s3lfcod3r/selfarchiver.git
cd selfarchiver
cp .env.example .env
# set APP_SECRET (openssl rand -hex 32) and AUTH_PASSWORD
docker compose up -d
```

Open `http://<host>:3000` → add a mailbox → create a rule.

> **⚠️ Without `AUTH_PASSWORD`** the server only listens on `127.0.0.1` inside the container (the open API stays unreachable from the network). Binding elsewhere without a password requires setting `HOST` explicitly — not recommended.
>
> **⚠️ Archive-then-delete** permanently removes mail from your mailbox once archived — test with *Archive only* first and keep backups of anything irreplaceable.

<a id="en-unraid"></a>

### 📦 Unraid

Add the template from
`https://raw.githubusercontent.com/s3lfcod3r/selfarchiver/main/unraid/selfarchiver.xml`
or import it under *Docker → Add Container → Template*. Set **APP_SECRET** and **AUTH_PASSWORD** and map `/data` to e.g. `/mnt/user/appdata/selfarchiver`.

The image is published to GHCR: `ghcr.io/s3lfcod3r/selfarchiver:latest`.

> **⚠️ APP_SECRET:** set it once and keep it — changing it makes stored mailbox passwords undecryptable.
>
> **⚠️ Permissions:** the container starts as root only to `chown` the `/data` volume, then drops to the unprivileged `node` user (uid `1000`) via `gosu`.

<a id="en-configuration"></a>

### ⚙️ Configuration

Environment variables (no common prefix).

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | – | `3000` | HTTP port |
| `APP_SECRET` | – | *(auto)* | Encrypts mailbox passwords + signs sessions (≥ 32 chars). Empty = generated once and stored in `/data/.secret`. **Set and keep stable.** |
| `AUTH_PASSWORD` | – | *(empty)* | Optional UI password. Empty = no auth, server binds to `127.0.0.1` only |
| `HOST` | – | `0.0.0.0` | Bind address; without `AUTH_PASSWORD` only honoured if set explicitly |
| `COOKIE_SECURE` | – | `false` | Set to `true` when serving over HTTPS (behind a TLS proxy) so the session cookie is only sent over secure connections (also enables HSTS) |
| `TZ` / `CRON_TZ` | – | `Europe/Berlin` | Timezone for cron schedules (compose/Unraid default; without Docker the code falls back to `UTC`) |
| `DATA_DIR` | – | `/data` | SQLite DB + `.eml` archive location |
| `DB_PATH` | – | `$DATA_DIR/selfarchiver.sqlite` | SQLite file |
| `ARCHIVE_DIR` | – | `$DATA_DIR/archive` | `.eml` archive directory |
| `LOG_LEVEL` | – | `info` | `trace` … `error` |

<a id="en-api"></a>

### 🔌 API overview

Base path `/api`, authentication via session cookie (only when `AUTH_PASSWORD` is set). Health check: `GET /api/health`.

| Group | Endpoints (excerpt) |
|---|---|
| **Auth** | `login`, `logout`, `session` |
| **Sources** | `sources` (CRUD), `sources/test-connection`, `sources/{id}/test`, `sources/{id}/folders` |
| **Rules** | `rules` (CRUD), `rules/validate-cron`, `rules/{id}/run` |
| **Archive** | `emails`, `emails/folders`, `emails/{id}`, `…/download`, `…/content`, `…/attachment/{index}`, `emails/delete-folder` |
| **Activity** | `runs`, `runs/{id}/emails`, `settings` |
| **Dashboard** | `dashboard`, `health` |

<a id="en-security"></a>

### 🛡️ Security

- Mailbox passwords **AES-256-GCM-encrypted** with a key derived from `APP_SECRET` — losing/changing the secret makes them unrecoverable
- **Server-side sessions** (random id, HMAC-signed cookie, `HttpOnly`, `SameSite=Lax`), revocable on logout; login **rate limit** (10 attempts / 15 min) with constant-time password check
- **CSRF guard**: state-changing requests with a foreign `Origin` are rejected
- Without `AUTH_PASSWORD` the server binds to **loopback only**
- Security headers (CSP, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, HSTS with `COOKIE_SECURE`); archived HTML is rendered in a **sandboxed iframe** with its own strict CSP
- **Crash-safe archiving**: the `.eml` is written + fsynced before the DB insert; deleting from the mailbox only happens for messages that exist in the archive; deleting an archive folder requires the expected count
- Run behind HTTPS (reverse proxy) if exposed beyond a trusted LAN
- **Deliberate trade-offs** (documented): single shared password (no user accounts); sessions live in memory and end on restart; *Archive, then delete* is irreversible on the mailbox side — the archive copy remains, treat it like any retention policy

Security update history → [CHANGELOG.md](CHANGELOG.md) (entries marked 🔒).

<a id="en-tech-stack"></a>

### 🧱 Tech stack

| Part | Tech |
|---|---|
| Backend | Node 22 · Fastify · better-sqlite3 (SQLite WAL + FTS5) · imapflow · mailparser · node-cron · cron-parser · zod · pino |
| Web | React · Vite · TypeScript · Tailwind CSS · React Router |
| Deploy | Docker (multi-stage, runs as `node` via gosu) · GHCR · Unraid |

<a id="en-development"></a>

### 🛠️ Development

```bash
npm install
npm run dev       # backend on :3000 (tsx watch)
npm run dev:web   # frontend on :5173 (Vite, proxies /api)
npm run build     # build web + prepare server
```

**Checks** (no automated tests yet):

```bash
npm run typecheck # type-check both workspaces
```

<a id="en-roadmap"></a>

### 🗺️ Roadmap

- [x] IMAP sources · folder picker · self-signed certificates
- [x] Rules: filters · age in days/hours · per-rule schedules · archive-then-delete
- [x] Archive: full-text search · inline reader · `.eml` + attachment download · delete emails/folders
- [x] Activity: filterable run history · archived emails per run · history retention
- [x] Security hardening (sessions, headers, non-root, CSRF, crash-safe archiving)
- [x] 12 UI languages · mobile layout

<p align="right"><a href="#-english">⬆ back to top</a></p>

---

<a id="-deutsch"></a>

## 🇩🇪 Deutsch

Die meisten Archivierer können nur ein ganzes Konto spiegeln. SelfArchiver verbindet sich mit deinen **IMAP**-Postfächern und archiviert **nur, was deine Regeln auswählen** — und kann es danach aus dem Postfach löschen, sodass ein kostenloses Postfach-Kontingent reicht. Es ist **kein** Komplett-Spiegel und kein Mailserver, sondern eine eigenständige Implementierung, kein Fork anderer Archivierer ([NOTICE.md](NOTICE.md)).

Teil der **Self**-Familie (SelfMailer, SelfStream, SelfDashboard …) — gleiches Design-System, gleicher Deploy-Stil (GHCR → Unraid).

> **Kurz** — gezielte Ordner · regelbasierte Filter · Zeitplan pro Regel · archivieren, dann löschen · Volltextsuche · ein Container · keine externe DB.

### 📑 Inhaltsverzeichnis

[Funktionen](#de-funktionen) · [Funktionsweise](#de-funktionsweise) · [Architektur](#de-architektur) · [Schnellstart](#de-schnellstart) · [Unraid](#de-unraid) · [Konfiguration](#de-konfiguration) · [API](#de-api) · [Sicherheit](#de-sicherheit) · [Tech-Stack](#de-tech-stack) · [Entwicklung](#de-entwicklung) · [Roadmap](#de-roadmap)

<a id="de-funktionen"></a>

### ✨ Funktionen

**📂 Archivierung**
- **Gezielte Ordner** — archiviere *nur* die Ordner, die du wählst (z. B. `Rechnungen`, `Versicherung`), nie den Spam-vollen Posteingang; **Aktualisieren**-Button und Option **neue Unterordner einbeziehen**
- **Regelbasierte Filter** — `Von` / `Betreff` / `An` enthält, Anhang nötig, nur gelesene, geflaggte ausschließen — damit Wichtiges oder Ungelesenes nie angetastet wird
- **Alter** — nur Mails älter als *N* **Tage oder Stunden** verarbeiten
- **Zeitplan pro Regel** — Baukasten für stündlich / täglich / wöchentlich / monatlich (Uhrzeit, Wochentage, Tag im Monat) oder eigener **Cron**, mit Live-Vorschau „nächster Lauf“; jede Regel läuft unabhängig
- **Archivieren, dann löschen** — *Nur archivieren* oder *Archivieren, dann aus Postfach löschen*; gelöscht wird nur nach **bestätigter Archivierung**
- **Idempotent** — ein stabiler Schlüssel pro Nachricht verhindert Duplikate, ein erneuter Lauf ist immer sicher

**🔎 Archiv**
- Durchsuchen + **Volltextsuche** (Betreff, Absender, Empfänger, Inhalt); Filter nach Postfach, Ordner und Sende-Datum
- Archivierte Mail anklicken, um sie **direkt zu lesen**; jede Mail als `.eml` oder einzelne **Anhänge** herunterladen
- Einzelne archivierte Mails oder einen ganzen Ordner **löschen** (mit Bestätigung)

**📊 Aktivität**
- **Lauf-Historie** mit Anzahl geprüft / archiviert / gelöscht und Fehlern, filterbar
- Sehen, **welche Mails ein Lauf archiviert hat**; einzelne Läufe löschen oder die ganze Historie leeren; Aufbewahrung der Historie einstellbar

**🔐 Sicherheit & Plattform**
- Postfach-Zugangsdaten **verschlüsselt gespeichert** (AES-256-GCM); selbstsignierte Zertifikate (lokale Server) je Postfach zulassen
- Optionaler **Ein-Passwort-Login** für die gesamte Oberfläche
- Dunkles oder helles UI, **12 Sprachen** (Dropdown), ein-/ausklappbare Navigation, Handy-Ansicht mit Seitenmenü
- **Ein Container** — SQLite (mit Volltextsuche) und `.eml`-Dateien auf einem Volume; kein Postgres, Redis, keine Suchmaschine oder Tika-Beiwagen

<a id="de-funktionsweise"></a>

### 🔁 Funktionsweise

1. Du fügst ein **IMAP-Postfach** (Quelle) hinzu.
2. Du erstellst eine oder mehrere **Regeln**: Ordner wählen, Filter setzen, Altersgrenze, Zeitplan und ob nach dem Archivieren gelöscht wird.
3. Nach Zeitplan (oder **Jetzt ausführen**) listet SelfArchiver in den gewählten Ordnern die Mails, die älter als die Grenze sind, archiviert die zum Filter passenden (vollständige `.eml` inkl. Anhängen) in Datenbank + Datei und löscht sie — falls aktiviert — aus dem Postfach.

<a id="de-architektur"></a>

### 🧭 Architektur

```text
┌──────────────────────────── Container ────────────────────────────┐
│  Fastify (HTTP)                                                     │
│   ├── /api/*           REST-API (Quellen, Regeln, Mails, Läufe)     │
│   └── /*               statische React-SPA (web/dist)               │
│                                                                     │
│  Scheduler (node-cron)        Runner                                │
│   └── ein Task je Regel  ───▶  holen → filtern → archiv. → löschen  │
│                                                                     │
│  imapflow ─────────────▶ IMAP-Postfach (TLS)                        │
│                                                                     │
│  SQLite (better-sqlite3)      Festplatte                            │
│   ├── sources                  /data/archive/<source>/<yyyy>/<mm>/  │
│   ├── rules                        *.eml                            │
│   ├── archived_emails                                               │
│   ├── emails_fts (FTS5)                                             │
│   └── runs                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

<a id="de-schnellstart"></a>

### 🚀 Schnellstart (Docker)

```bash
git clone https://github.com/s3lfcod3r/selfarchiver.git
cd selfarchiver
cp .env.example .env
# APP_SECRET (openssl rand -hex 32) und AUTH_PASSWORD setzen
docker compose up -d
```

`http://<host>:3000` öffnen → Postfach hinzufügen → Regel anlegen.

> **⚠️ Ohne `AUTH_PASSWORD`** lauscht der Server im Container nur auf `127.0.0.1` (die offene API ist vom Netz aus nicht erreichbar). Ohne Passwort anders zu binden geht nur, wenn du `HOST` ausdrücklich setzt — nicht empfohlen.
>
> **⚠️ Archivieren, dann löschen** entfernt Mails endgültig aus dem Postfach, sobald sie archiviert sind — teste zuerst mit *Nur archivieren* und behalte Backups von allem Unwiederbringlichen.

<a id="de-unraid"></a>

### 📦 Unraid

Vorlage von
`https://raw.githubusercontent.com/s3lfcod3r/selfarchiver/main/unraid/selfarchiver.xml`
hinzufügen oder unter *Docker → Add Container → Template* importieren. **APP_SECRET** und **AUTH_PASSWORD** setzen und `/data` z. B. auf `/mnt/user/appdata/selfarchiver` mappen.

Das Image liegt auf GHCR: `ghcr.io/s3lfcod3r/selfarchiver:latest`.

> **⚠️ APP_SECRET:** einmal setzen und behalten — eine Änderung macht die gespeicherten Postfach-Passwörter unlesbar.
>
> **⚠️ Rechte:** der Container startet nur als root, um das Volume `/data` per `chown` vorzubereiten, und wechselt dann per `gosu` zum Nutzer `node` (uid `1000`) ohne Root-Rechte.

<a id="de-konfiguration"></a>

### ⚙️ Konfiguration

Umgebungsvariablen (ohne gemeinsames Präfix).

| Variable | Pflicht | Standard | Zweck |
|---|---|---|---|
| `PORT` | – | `3000` | HTTP-Port |
| `APP_SECRET` | – | *(auto)* | Verschlüsselt die Postfach-Passwörter + signiert Sitzungen (≥ 32 Zeichen). Leer = wird einmal erzeugt und in `/data/.secret` gespeichert. **Setzen und stabil halten.** |
| `AUTH_PASSWORD` | – | *(leer)* | Optionales UI-Passwort. Leer = keine Anmeldung, Server bindet nur an `127.0.0.1` |
| `HOST` | – | `0.0.0.0` | Bind-Adresse; ohne `AUTH_PASSWORD` nur wirksam, wenn ausdrücklich gesetzt |
| `COOKIE_SECURE` | – | `false` | Auf `true` setzen, wenn über HTTPS (hinter einem TLS-Proxy) bereitgestellt, damit das Sitzungs-Cookie nur über sichere Verbindungen gesendet wird (aktiviert auch HSTS) |
| `TZ` / `CRON_TZ` | – | `Europe/Berlin` | Zeitzone für die Zeitpläne (Standard in compose/Unraid; ohne Docker fällt der Code auf `UTC` zurück) |
| `DATA_DIR` | – | `/data` | Ort der SQLite-DB + des `.eml`-Archivs |
| `DB_PATH` | – | `$DATA_DIR/selfarchiver.sqlite` | SQLite-Datei |
| `ARCHIVE_DIR` | – | `$DATA_DIR/archive` | Ordner des `.eml`-Archivs |
| `LOG_LEVEL` | – | `info` | `trace` … `error` |

<a id="de-api"></a>

### 🔌 API-Übersicht

Basispfad `/api`, Anmeldung per Sitzungs-Cookie (nur wenn `AUTH_PASSWORD` gesetzt ist). Health-Check: `GET /api/health`.

| Bereich | Endpunkte (Auszug) |
|---|---|
| **Auth** | `login`, `logout`, `session` |
| **Quellen** | `sources` (CRUD), `sources/test-connection`, `sources/{id}/test`, `sources/{id}/folders` |
| **Regeln** | `rules` (CRUD), `rules/validate-cron`, `rules/{id}/run` |
| **Archiv** | `emails`, `emails/folders`, `emails/{id}`, `…/download`, `…/content`, `…/attachment/{index}`, `emails/delete-folder` |
| **Aktivität** | `runs`, `runs/{id}/emails`, `settings` |
| **Dashboard** | `dashboard`, `health` |

<a id="de-sicherheit"></a>

### 🛡️ Sicherheit

- Postfach-Passwörter **AES-256-GCM-verschlüsselt** mit einem aus `APP_SECRET` abgeleiteten Schlüssel — Verlust/Änderung des Secrets macht sie unwiederbringlich
- **Serverseitige Sitzungen** (Zufalls-ID, HMAC-signiertes Cookie, `HttpOnly`, `SameSite=Lax`), beim Abmelden widerrufen; **Rate-Limit** beim Login (10 Versuche / 15 Min) mit zeitkonstantem Passwortvergleich
- **CSRF-Schutz**: ändernde Anfragen mit fremdem `Origin` werden abgelehnt
- Ohne `AUTH_PASSWORD` bindet der Server **nur an Loopback**
- Sicherheits-Header (CSP, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, HSTS mit `COOKIE_SECURE`); archiviertes HTML wird in einem **abgeschotteten iframe** mit eigener strenger CSP angezeigt
- **Absturzsicheres Archivieren**: die `.eml` wird geschrieben + per fsync gesichert, bevor der DB-Eintrag folgt; aus dem Postfach gelöscht werden nur Mails, die im Archiv liegen; das Löschen eines Archiv-Ordners verlangt die erwartete Anzahl
- Hinter HTTPS (Reverse Proxy) betreiben, wenn über ein vertrauenswürdiges LAN hinaus erreichbar
- **Bewusste Kompromisse** (dokumentiert): ein gemeinsames Passwort (keine Benutzerkonten); Sitzungen liegen im Speicher und enden beim Neustart; *Archivieren, dann löschen* ist auf Postfach-Seite unumkehrbar — die Archivkopie bleibt, behandle es wie jede Aufbewahrungsrichtlinie

Verlauf der Sicherheitsupdates → [CHANGELOG.md](CHANGELOG.md) (Einträge mit 🔒).

<a id="de-tech-stack"></a>

### 🧱 Tech-Stack

| Teil | Technik |
|---|---|
| Backend | Node 22 · Fastify · better-sqlite3 (SQLite WAL + FTS5) · imapflow · mailparser · node-cron · cron-parser · zod · pino |
| Web | React · Vite · TypeScript · Tailwind CSS · React Router |
| Deploy | Docker (Multi-Stage, läuft als `node` per gosu) · GHCR · Unraid |

<a id="de-entwicklung"></a>

### 🛠️ Entwicklung

```bash
npm install
npm run dev       # Backend auf :3000 (tsx watch)
npm run dev:web   # Frontend auf :5173 (Vite, leitet /api weiter)
npm run build     # Web bauen + Server vorbereiten
```

**Prüfungen** (noch keine automatischen Tests):

```bash
npm run typecheck # beide Workspaces typprüfen
```

<a id="de-roadmap"></a>

### 🗺️ Roadmap

- [x] IMAP-Quellen · Ordnerauswahl · selbstsignierte Zertifikate
- [x] Regeln: Filter · Alter in Tagen/Stunden · Zeitplan pro Regel · archivieren, dann löschen
- [x] Archiv: Volltextsuche · Mail-Ansicht · `.eml`- + Anhang-Download · Mails/Ordner löschen
- [x] Aktivität: filterbare Lauf-Historie · archivierte Mails je Lauf · Aufbewahrung der Historie
- [x] Sicherheits-Härtung (Sitzungen, Header, ohne Root, CSRF, absturzsicheres Archivieren)
- [x] 12 Oberflächen-Sprachen · Handy-Ansicht

<p align="right"><a href="#-deutsch">⬆ nach oben</a></p>

---

## ⚖️ Lizenz / License

**🇩🇪 Alle Rechte vorbehalten.** © 2026 s3lfcod3r / SelfCoder

Du darfst die Software **privat und nicht-kommerziell** installieren und benutzen (z. B. im Homelab, über Docker oder Unraid).

**Ohne schriftliche Erlaubnis verboten:** kommerzielle Nutzung · Kopieren · Verändern · Weitergeben · Einbauen in eigene Projekte (auch Closed Source) · Verkaufen.

Details: [LICENSE](LICENSE)

**🇬🇧 All rights reserved.** © 2026 s3lfcod3r / SelfCoder

You may install and use the software **privately and non-commercially** (e.g. in your home lab, via Docker or Unraid).

**Not permitted without written permission:** commercial use · copying · modifying · redistributing · incorporating into other projects (including closed source) · selling.

Details: [LICENSE](LICENSE)

---

<div align="center">

**SelfArchiver** · part of the Self family · Teil der Self-Familie<br>
made with 🗄️ for self-hosting

</div>
