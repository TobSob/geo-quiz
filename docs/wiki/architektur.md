# Architektur

> **Stand:** 2026-08-30 · **Verifiziert:** `package.json`, Quellbaum, `src/App.tsx`

## Stack

React 18.3 · TypeScript 6 · Vite 8 · Zustand 5 (State) · React Router 7
(HashRouter) · MapLibre GL 6 (Karten) · d3-geo + topojson-client (Umrisse) ·
supabase-js 2 · Capacitor 8 (Android) · Vitest 4 · oxlint.

## Schichtenregel

Die Quiz-Logik ist **pures TypeScript ohne React und ohne DOM**
(`src/features/quiz-engine/`). Deshalb ist sie ohne Browser testbar — das ist
der Grund, warum 148 Tests in unter einer Sekunde durchlaufen. Alles, was den
DOM oder MapLibre braucht, liegt in `components/` oder `routes/`.

Dieselbe Trennung wurde beim Basemap-Umbau nachgezogen: die Auflöse-Geometrie
liegt frei von MapLibre-Typen in `features/geo/pinMapGeometry.ts`.

## Ordner (`frontend/src/`)

| Ordner | Inhalt |
|---|---|
| `api/` | Supabase-Zugriff: `supabaseClient`, `authApi`, `scoreApi`, `leaderboardApi`, `gamificationApi`, `groupApi`, `avatarApi` |
| `components/` | Geteilte UI: `QuizView`, `ArcadeQuizView`, `MapPicker`/`PinMap`, `CountryOutline`, `PlayerCard`, `TrophyShelf`, … |
| `features/quiz-engine/` | Pure Logik: Fragen, Scoring, Sessions, Sampler |
| `features/` (übrige) | `audio`, `auth`, `avatars`, `gamification`, `geo`, `leaderboard`, `progress` |
| `hooks/` | `useQuizSession` (Training), `useArcadeSession` (Zeitmodi) |
| `routes/` | Ein Screen je Route |
| `state/` | Zustand-Stores, teils `persist` |
| `data/` | Ausgelieferte JSON-Daten + Zugriffs-Helfer |

## Routen (`src/App.tsx`)

`/` Home · `/play/:mode` · `/cup` · `/training` · `/scores` ·
`/achievements` · `/profile` · `/credits` (lazy) · `/dev` (nur Dev-Build) ·
alles andere leitet auf `/profile` um.

**HashRouter**, weil Capacitor die App von `file://` lädt. Folge: echte
URL-Pfade (`/datenschutz`) bedient der Router **nicht** — solche Seiten liegen
als statisches HTML in `frontend/public/`, siehe
[recht-und-nachweise.md](recht-und-nachweise.md).

## Bundle

Hauptbundle ~194 KB gzip; die Karte liegt als eigener Chunk (~253 KB) hinter
`lazy()` und wird aus dem Menü vorgeladen. `/credits` und die Landmark-
Nachweise (33 KB JSON) sind ebenfalls eigene Chunks.

## Vertiefung

- [../DEVELOPMENT.md](../DEVELOPMENT.md) §1–2 — Architekturprinzipien, Stack im Detail
- [../../DESIGN-PERF-MOBILE.md](../../DESIGN-PERF-MOBILE.md) — warum Performance hier ein Thema ist
