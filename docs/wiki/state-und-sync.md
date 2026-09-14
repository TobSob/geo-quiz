# State, Persistenz & Sync

> **Stand:** 2026-08-30 · **Verifiziert:** `src/state/*.ts`, `src/features/progress/progressSync.ts`

## Stores (Zustand)

| Store | Persistiert | Schlüssel |
|---|---|---|
| `progressStore` | ✅ `persist` **mit Versions-Migration** | `geo-quiz-progress` |
| `avatarStore` | ✅ | `geo-quiz-avatar` |
| `settingsStore` | ✅ | `geo-quiz-settings` |
| `gamificationStore` | ❌ bewusst nicht — Stand des angemeldeten Accounts, kommt vom Server | — |
| `userStore` | ❌ — Sitzung liegt bei supabase-js | — |

`geo-quiz-settings` (Ton an/aus) ist eine **Geräte**-Einstellung, kein
Kontodatum: Beim Konto-Löschen wird sie deshalb absichtlich **nicht** geleert.

Auf Android liegt die Auth-Session nicht im localStorage, sondern über
`@capacitor/preferences` in nativen SharedPreferences — deshalb überlebt die
anonyme Identität einen Force-Stop.

## Delta-Sync statt „Zustand hochladen"

Der Lernfortschritt wird als **Delta-Queue** in localStorage gesammelt und über
die RPC `sync_progress` geflusht (App-Start und Sitzungsende). Grund: Zwei
Geräte, die je ihren kompletten Zustand hochladen, überschreiben sich
gegenseitig; Deltas addieren sich. Gäste synchronisieren mit — nur die globalen
Bestenlisten sind Accounts vorbehalten.

## Offline

Fehlen die Supabase-Env-Variablen oder ist das Netz weg, degradiert die App
sichtbar (`● ONLINE`-Anzeige) und bleibt spielbar: lokale Rekorde, Training und
Fortschritt laufen weiter, die Queue flusht später.

## Vertiefung

- [../DEVELOPMENT.md](../DEVELOPMENT.md) §4 — Stores, Delta-Sync, Session-State-Machine
