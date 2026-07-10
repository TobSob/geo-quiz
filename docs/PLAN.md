# geo-quiz — Geography Quiz Game (Web + Android)

## Context

The user wants to build a geography quiz game from scratch — flags, countries, capitals, city/landmark pin-location modes, a "Cup" that rotates through all modes, and an adaptive training mode that resurfaces wrong/rarely-seen questions more often. They're an experienced FastAPI/Python developer (day job on `cgs-assist`) but new to game dev, want a single codebase for Web + Android, and only need cloud sync for leaderboards/progress (no real-time multiplayer). This is a brand-new, standalone project — **not** part of the `cgs-assist` repo — to be created at `C:\Users\SobekTobias\PycharmProjects\geo-quiz`.

Given the genre (UI/quiz-driven, not a real-time action game), the plan reuses the user's existing FastAPI/SQLAlchemy expertise for the backend rather than introducing a new engine/language (Godot, Unity), and uses React + Capacitor for a single web+Android codebase.

## Tech Stack (decided)

- **Client:** React + TypeScript + Vite, packaged for Android via **Capacitor** (`npx cap add android`). Confirmed against current Capacitor docs: build web app → `npx cap init` → `npx cap add android` → `npx cap copy` → `npx cap run android`.
- **Maps:** `react-simple-maps` (SVG/topojson) for country-outline/click modes; `react-leaflet` + world GeoJSON for free-form pin-placement (city-pin, landmark-pin) with haversine distance scoring.
  - ⚠️ **Known conflict:** `react-simple-maps` has had no commits since mid-2023 and its peer deps cap at React 18. Decide upfront in Phase 1/2: pin the project to React 18, or use the community fork `@vnedyalk0v/react19-simple-maps`, or force via npm overrides. Must not be discovered mid-build.
- **State:** Zustand (lighter than Redux for this scale).
- **Backend:** **Supabase** (Postgres + Auth + auto-generated REST/RPC via PostgREST). No hand-rolled FastAPI app — the narrow need here (anonymous auth, leaderboard, progress sync) doesn't justify writing/maintaining routes/services/repositories/migrations/JWT from scratch. Start on Supabase's free cloud tier (fastest to stand up); it's open-source so self-hosting later is possible if needed.
- **Auth:** Supabase's built-in **anonymous sign-in** (`supabase.auth.signInAnonymously()`) issues a real user with `is_anonymous: true` on first launch — no custom device-id/JWT code needed. Upgrading to a permanent account later is a single `PUT /user` call with email+password (Supabase handles this natively — "convert anonymous to registered"). Session persistence in the Capacitor WebView needs a custom storage adapter (Capacitor Preferences or Secure Storage plugin) instead of the JS default (`localStorage`), so the session survives app restarts reliably on Android.
- **Geo data:** `mledoze/countries` (ODbL, structured data only) + `world-atlas` `countries-110m` topojson (small enough to bundle, ~100-200KB). Flags from the MIT-licensed `flag-icons` package, **not** the SVGs bundled in `mledoze/countries` (those are explicitly excluded from its ODbL license).
- **Map tiles:** avoid hammering the public OSM tile server directly in a packaged app (usage-policy limits) — use a free-tier provider (MapTiler/Stadia/Carto) or self-host tiles.

## Data Model

Static reference data (Country, City, Landmark) ships as **bundled JSON**, not DB tables — the quiz engine runs fully client-side/offline, and content updates are just "replace a JSON file."

- `frontend/src/data/countries.json` — iso2/iso3, localized names, capital, region/subregion, centroid latlng, flag asset path, borders, area/population, independent/unMember flags (for a "sovereign states only" filter).
- `frontend/src/data/cities.json` — id, name, countryIso2, lat/lng, population (difficulty tiers), isCapital (reused for Capitals mode).
- `frontend/src/data/landmarks.json` — id, name, countryIso2, lat/lng, category, difficulty.
- Questions have **no DB table** — a deterministic ID string (`flag:DE`, `city-pin:city_paris_fr`) is computed client-side and used as the key for progress tracking.

Supabase Postgres tables (SQL migrations under `supabase/migrations/`, managed via the Supabase CLI, `auth.users` provided by Supabase Auth — no custom User table needed):

- **profiles**: `id (uuid, references auth.users, PK), display_name, created_at, last_seen_at` — only for app-specific fields not already on `auth.users`.
- **user_progress**: `id, user_id (uuid, FK auth.users), question_id (text), times_shown, times_wrong, times_correct, last_seen_at, last_result, ease_factor (reserved), interval_days (reserved)` — unique on `(user_id, question_id)`.
- **score_entries**: `id, user_id, mode, score, max_possible, question_count, duration_ms, played_at, cup_run_id (nullable FK)`.
- **cup_runs**: `id, user_id, total_score, modes_played (jsonb), played_at`.

No separate leaderboard table — leaderboards are `SELECT ... ORDER BY score DESC` over `score_entries`/`cup_runs.total_score`, exposed either directly via PostgREST (with a public-read RLS policy) or a Postgres **view** that only exposes `display_name`/`score`/`mode` (avoids leaking `user_id`/emails to the public leaderboard read).

**Row Level Security (RLS):** enabled on all tables. Users can `INSERT`/`SELECT` only their own `user_progress`/`score_entries`/`cup_runs` rows (`auth.uid() = user_id`); a separate public-read policy (or view) exposes only what the leaderboard needs.

**Sync model:** client is authoritative between syncs; instead of a custom `/progress/sync` route, call a Postgres **RPC function** (`increment_progress(question_id, shown_delta, wrong_delta, correct_delta)`, `SECURITY DEFINER`, using `auth.uid()` internally) via `supabase.rpc(...)`. The function does an atomic `UPDATE ... SET times_shown = times_shown + delta` (upserting the row if it doesn't exist), avoiding last-write-wins conflicts across devices without any custom backend process.

**Server-side score validation:** since there's no custom backend app to hand-write `score_service.py` in, enforce sanity bounds directly in Postgres — a `CHECK (score <= max_possible)` constraint plus a `BEFORE INSERT` trigger rejecting a `duration_ms` inconsistent with `question_count` (e.g. less than some minimum ms/question). This replaces application-layer validation with database-layer validation, which is enough for a hobby leaderboard.

## Scoring Design

**Simple modes** (flags, countries, capitals, outline):
```
base_points = 100
time_bonus  = round(max(0, 50 * (1 - elapsed_ms / time_limit_ms)))
streak_mult = 1 + min(streak, 10) * 0.05        # caps at 1.5x after a 10-streak
question_score = round((base_points + time_bonus) * streak_mult)  # 0 if wrong, streak resets
```
Example: 2000ms of an 8000ms limit, streak of 6 → time_bonus=38, streak_mult=1.30 → score = round(138*1.30) = 179. Max per question = 225. No negative points for wrong answers (casual, low-anxiety).

**Distance-based pin modes** (city-pin, landmark-pin), haversine distance in km:
```
score = round(100 * exp(-distance_km / R))
```
R=200 for city-pin (0km→100, 50km→78, 100km→61, 200km→37, 500km→8), R=75-100 for landmark-pin (steeper falloff — landmarks are point-precise). Clamp to [0,100]; force score=100 if distance_km < 5 ("bullseye bonus"). Time bonus is smaller and additive here since precision matters more than speed: `final = round(distance_score * 0.9 + min(10, 10*(1-elapsed_ms/time_limit_ms)))`.

**Cup mode aggregation** — normalize to a 0-100 "percentage of perfect play" so uneven per-mode question counts stay fair:
```
cup_total_score = round(100 * sum(entry.score for entry in legs) / sum(entry.max_possible for entry in legs))
```
Store the raw per-leg `ScoreEntry` rows (via `cup_run_id`) for a post-game per-mode breakdown.

## Adaptive Sampling (Training Mode)

Skip full SM-2 (built for daily review cadence, doesn't fit short random-time mobile sessions). Use a weighted-random sampler, recomputed client-side each training session from local `UserProgress`:
```
wrong_rate = times_wrong / max(times_shown, 1)
error_weight = 1 + 4 * wrong_rate                      # [1, 5]
recency_weight = 3.0 if never shown else min(1 + days_since_last_seen * 0.15, 4.0)
priority = error_weight * recency_weight
next_question = random.choices(all_questions, weights=priorities)
```
Mix in 30% flat-random picks per session for variety/serendipity. Keep a short "last 5 asked" ring buffer to avoid immediate repeats. Fully client-side — implementable in under an hour, only touches the backend to persist counters after each answer.

## Project Structure

```
geo-quiz/
  frontend/                       # React + TS + Vite + Capacitor
    android/                      # generated by `npx cap add android`
    src/
      routes/                     # one screen per file (HomeScreen, FlagsQuizScreen, CityPinScreen, CupModeScreen, TrainingModeScreen, LeaderboardScreen, ...)
      features/
        quiz-engine/              # pure TS, no React deps — questionGenerator.ts, scoring.ts, adaptiveSampler.ts, cupSession.ts, types.ts
        progress/                 # progressStore.ts (local persistence), progressSync.ts (delta batching + offline queue)
        geo/                      # distance.ts (haversine), countryLookup.ts
      data/                       # countries.json, cities.json, landmarks.json, flags/*.svg, world-atlas-110m.json
      components/                 # MapPicker/ (leaflet), CountryMap/ (react-simple-maps), ScoreBar, StreakBadge, Timer
      api/                        # supabaseClient.ts, progressApi.ts (RPC calls), scoreApi.ts, leaderboardApi.ts, authApi.ts
      hooks/                      # useQuizSession.ts, useTimer.ts, useAuthSession.ts (wraps Supabase auth state)
      state/                      # sessionStore.ts, userStore.ts (Zustand)
    capacitor.config.ts
    .env.example                  # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
  supabase/                        # Supabase CLI project — this is the entire "backend"
    migrations/                    # SQL: tables, RLS policies, increment_progress() RPC, public leaderboard view
    config.toml
```

`features/quiz-engine` is framework-agnostic pure TS — unit-testable with Vitest independent of React. There is no custom backend app in this design — Supabase (Postgres + Auth + auto-generated REST/RPC) replaces it; the only "backend code" is SQL under `supabase/migrations/`.

## Phased Roadmap (each phase independently playable)

1. **Scaffold + static data + text/MC modes** — Vite React-TS scaffold, resolve the React18-vs-19 map-library decision now, pull `mledoze/countries` + `flag-icons` data, build `questionGenerator.ts`/`scoring.ts` with Vitest tests. Ship Flags/Capitals/Countries modes, no Supabase project yet, no persistence beyond a session-end summary.
2. **Map-based modes** — `react-simple-maps` for Outline mode, `react-leaflet` + haversine for City-pin/Landmark-pin. Verify distance-score falloff against the worked table above.
3. **Cup mode + Training mode** — `cupSession.ts` aggregation, local `progressStore.ts` (localStorage/idb), `adaptiveSampler.ts`. Verify Training mode resurfaces deliberately-missed questions sooner.
4. **Supabase for leaderboard + sync** — create the Supabase project, write SQL migrations (`profiles`, `user_progress`, `score_entries`, `cup_runs`, RLS policies, `increment_progress()` RPC, leaderboard view), wire up `signInAnonymously()` on first launch and the `api/` client wrappers. Verify two anonymous sessions (two browser profiles) both appear on the shared leaderboard, and progress survives a local-storage clear (i.e. it was actually persisted server-side, not just cached).
5. **Capacitor Android packaging** — `npx cap add android`, test SVG/Leaflet rendering and touch hit-testing on a real device/emulator (small countries like Luxembourg are the stress case), switch the Supabase JS client to a Capacitor-safe storage adapter (Preferences/Secure Storage) so the anonymous session survives app restarts.
6. **Polish + deployment** — leaderboard/profile UI, cup breakdown chart, streak badges, Capacitor Haptics; no separate backend deployment needed since Supabase is already hosted (or self-hosted later if desired — it's open-source).

## Risks Flagged

- `react-simple-maps` React 19 peer-dep conflict (see above) — resolve in Phase 1, not mid-Phase-2.
- Android WebView touch/pan/zoom quirks on SVG maps — test on-device in Phase 5, not just desktop Chrome.
- Keep topojson at `countries-110m` resolution — higher resolution visibly slows first paint on mid-range Android.
- Client-side scoring means a modified client could inflate leaderboard scores — add the Postgres `CHECK`/trigger-based plausibility bounds (Phase 4), full anti-cheat is overkill for a hobby project.
- OSM public tile server usage policy — use an alternative provider or self-host before any real usage.
- Supabase anonymous session is stored client-side (via the Capacitor storage adapter) — if the app is uninstalled or storage is cleared, that identity is gone; accept reinstall = new anonymous identity, cross-device continuity is what the optional account upgrade is for.
- The Supabase anon/public API key is bundled into the client — this is expected (RLS is what actually protects data, not key secrecy), but every table needs an explicit RLS policy before shipping, or it defaults to fully open or fully locked depending on how the table was created.

## Critical Files to Create First

- `frontend/src/features/quiz-engine/scoring.ts` — validates the whole scoring design, easiest to unit test first
- `frontend/src/data/countries.json` — foundational dataset everything else derives from
- `frontend/src/features/quiz-engine/adaptiveSampler.ts` — core of Training mode
- `supabase/migrations/0001_init.sql` — `user_progress`/`score_entries`/`cup_runs` tables + RLS policies, the state that must survive across devices
- `supabase/migrations/0002_increment_progress.sql` — the delta-merge `increment_progress()` RPC function

## Verification

- Phase 1: `npm run test` (Vitest) on `scoring.ts` against the worked examples above; manually play Flags/Capitals/Countries in the browser.
- Phase 2: manually verify a city-pin click's displayed score matches the distance-to-score table for a few known distances.
- Phase 3: deliberately miss a handful of questions, confirm they resurface disproportionately in the next Training session.
- Phase 4: `supabase db reset` / `supabase test db` (pgTAP or manual SQL) against the migrations, plus a manual two-anonymous-session test confirming both appear on the shared leaderboard view.
- Phase 5: run `npx cap run android` on an emulator and, if available, a physical device; check map pan/zoom/tap accuracy specifically.
- Before each phase is considered done: it must be playable end-to-end, not just unit-tested.
