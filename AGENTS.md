# AGENTS.md — selfarchiver

Kurze Orientierung fuer KI-Assistenten (Bonsai/Claude). **Diese Datei zuerst lesen, nicht die grosse README.**
Zum Finden: `rg -n "BEGRIFF"`. Fuer Symbole: Serena `get_symbols_overview`/`find_symbol`. Grosse Dateien nur zeilenweise (`sed -n`).

## Typ & Stack

- Node/JS-TS: `package.json`

## Bauen / Testen / Starten

```bash
npm run dev   # npm run dev --workspace=server
npm run build   # npm run build --workspace=web && npm run build --workspace=server
npm run start   # npm run start --workspace=server
```

## Struktur (oberste Ebenen)

- `.github/` — CI/Workflows
- `Logo/`
- `assets/`
- `docs/` — Dokumentation
- `server/`
- `unraid/`
- `web/`

---
*Automatisch erzeugt als Navigationshilfe. Bei Bedarf von Hand praeziser machen.*
