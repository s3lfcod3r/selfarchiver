<p align="center">
  <img src="assets/selfarchiver-logo-wide.png" alt="SelfArchiver" width="440">
</p>

<p align="center">Selbst gehosteter E-Mail-Archivierer, der dein Postfach <strong>klein</strong> und deine Mails <strong>sicher</strong> hält — mit den Stellschrauben, die anderen Archivierern fehlen.</p>

<p align="center"><a href="README.md">English</a> · <strong>Deutsch</strong></p>

---

Die meisten Archivierer können nur ein ganzes Konto spiegeln. SelfArchiver ist um vier Dinge herum gebaut, die andere nicht können:

- **📂 Gezielte Ordner** — archiviere *nur* die Ordner, die du wählst (z. B. `Rechnungen`, `Versicherung`), nie den Spam-vollen Posteingang.
- **🎛 Regelbasierte Filter** — nach Absender, Betreff, Anhang und Alter; mit Schutz für gelesene/markierte Mails, damit Wichtiges oder Ungelesenes nie angetastet wird.
- **⏱ Zeitplan pro Regel** — jede Regel läuft nach ihrem eigenen Plan, völlig unabhängig von den anderen.
- **🧹 Archivieren-dann-löschen (Retention)** — Mails optional aus dem Quell-Postfach löschen, *nachdem* sie sicher archiviert wurden, sodass ein kostenloses Postfach-Kontingent reicht.

Alles steckt in **einem Container**: SQLite (mit Volltextsuche) und `.eml`-Dateien auf einem einzigen Volume. Kein Postgres, Redis, keine Suchmaschine oder Tika-Beiwagen.

> ⚠️ **Status:** frühe Version (v0.1). Die Aktion „Archivieren, dann löschen" entfernt Mails endgültig aus dem Postfach, sobald sie archiviert sind — teste zuerst mit *Nur archivieren* und behalte Backups von allem Unwiederbringlichen.

---

## Funktionen

| | |
|---|---|
| **Postfächer** | Beliebiges IMAP-Postfach verbinden. Zugangsdaten werden verschlüsselt gespeichert (AES-256-GCM). Selbstsignierte Zertifikate (lokale Server) optional zulassen. |
| **Ordnerauswahl** | Listet die Ordner des Postfachs; du hakst genau die an, die archiviert werden. „Aktualisieren"-Button + Option „neue Unterordner einbeziehen". |
| **Filter** | `Von`/`Betreff`/`An` enthält, Anhang nötig, nur gelesene, geflaggte ausschließen. |
| **Alter** | Nur Mails älter als *N* Tage **oder Stunden** verarbeiten. |
| **Zeitplan** | Baukasten: stündlich/täglich/wöchentlich/monatlich (Uhrzeit, Wochentage, Tag im Monat) oder eigener Cron — mit Live-Vorschau „nächster Lauf". |
| **Retention** | *Nur archivieren* oder *Archivieren, dann aus Postfach löschen*. Gelöscht wird nur nach bestätigter Archivierung. |
| **Archiv** | Durchsuchen + Volltextsuche (Betreff, Absender, Empfänger, Inhalt); Filter nach Postfach, Ordner und Sende-Datum. Jede Mail als `.eml` herunterladbar. |
| **Aktivität** | Lauf-Historie mit Anzahl geprüft / archiviert / gelöscht und Fehlern. |
| **Oberfläche** | Dunkles oder helles UI, Deutsch & Englisch (in der Sidebar umschaltbar), ein-/ausklappbare Navigation; archivierte Mail anklicken, um sie direkt zu lesen. |
| **Login** | Optionaler Ein-Passwort-Login für die gesamte Oberfläche. |

## Funktionsweise

1. Du fügst ein **IMAP-Postfach** (Quelle) hinzu.
2. Du erstellst eine oder mehrere **Regeln**: Ordner wählen, Filter setzen, Altersgrenze, Zeitplan und ob nach dem Archivieren gelöscht wird.
3. Nach Zeitplan (oder **Jetzt ausführen**) listet SelfArchiver in den gewählten Ordnern die Mails, die älter als die Grenze sind, archiviert die zum Filter passenden (vollständige `.eml` inkl. Anhängen) in Datenbank + Datei und löscht sie — falls aktiviert — aus dem Postfach.

Das Archivieren ist **idempotent**: ein stabiler Schlüssel pro Nachricht verhindert Duplikate, ein erneuter Lauf ist also immer sicher.

## Schnellstart

### Docker Compose

```bash
git clone https://github.com/kabelsalatundklartext/selfarchiver.git
cd selfarchiver
cp .env.example .env
# APP_SECRET setzen (openssl rand -hex 32) und optional AUTH_PASSWORD
docker compose up -d
```

Öffne `http://<host>:3000`.

### Unraid

Das Template liegt unter [`unraid/selfarchiver.xml`](unraid/selfarchiver.xml). Füge dieses Repo als Template-Quelle hinzu oder füge das XML als neues Container-Template ein. Setze **APP_SECRET** (und optional **AUTH_PASSWORD**) und mappe `/data` z. B. auf `/mnt/user/appdata/selfarchiver`.

Das Image liegt auf GHCR: `ghcr.io/kabelsalatundklartext/selfarchiver:latest`.

## Konfiguration

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `PORT` | `3000` | HTTP-Port. |
| `APP_SECRET` | _(auto)_ | Schlüssel zum Verschlüsseln der Postfach-Passwörter + Signieren der Sitzungen. **Setzen und stabil halten.** |
| `AUTH_PASSWORD` | _(leer)_ | Optionales UI-Passwort. Leer = offene Instanz. |
| `TZ` / `CRON_TZ` | `UTC` | Zeitzone für die Zeitpläne. |
| `DATA_DIR` | `/data` | Ort der SQLite-DB + des `.eml`-Archivs. |
| `LOG_LEVEL` | `info` | `trace`…`error`. |

## Entwicklung

```bash
npm install
npm run dev       # Backend auf :3000 (tsx watch)
npm run dev:web   # Frontend auf :5173 (Vite, proxyt /api)
npm run typecheck # beide Workspaces typprüfen
npm run build     # Web bauen + Server vorbereiten
```

Stack: Node + Fastify + better-sqlite3 (FTS5) + imapflow + node-cron im Backend; React + Vite + Tailwind im Frontend. Siehe [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Sicherheitshinweise

- Postfach-Passwörter werden mit einem aus `APP_SECRET` abgeleiteten Schlüssel verschlüsselt. Verlust/Änderung des Secrets macht sie unwiederbringlich.
- Hinter HTTPS (Reverse Proxy) betreiben, wenn über ein vertrauenswürdiges LAN hinaus erreichbar, und `AUTH_PASSWORD` setzen.
- Die Aktion *Archivieren, dann löschen* ist auf Postfach-Seite unumkehrbar. Die Archivkopie bleibt — behandle es wie jede Aufbewahrungsrichtlinie.

## Lizenz

MIT — siehe [`LICENSE`](LICENSE). SelfArchiver ist eine eigenständige Implementierung; siehe [`NOTICE.md`](NOTICE.md).
