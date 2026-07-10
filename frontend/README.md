# GeoQuiz Frontend

React 18 + TypeScript + Vite. Siehe die [Haupt-README](../README.md) für Setup, Spielmodi und Architektur.

```bash
npm install
npm run dev       # http://localhost:5173
npm run test      # Vitest — Quiz-Engine & Scoring
npm run build     # Typecheck + Production-Build
npm run lint      # oxlint
```

Nützliche Einstiegspunkte:

- [`src/features/quiz-engine/`](src/features/quiz-engine/) — Spiellogik als pures TS, komplett ohne React-Abhängigkeit, unit-getestet
- [`src/components/QuizView.tsx`](src/components/QuizView.tsx) — der von allen Modi geteilte Quiz-Screen (Frage → Feedback → Weiter)
- [`src/hooks/useQuizSession.ts`](src/hooks/useQuizSession.ts) — Session-State-Machine (Score, Streak, Timer-Übergänge)
- [`src/index.css`](src/index.css) — das komplette 8-Bit-Design-System (CSS-Variablen, Pixel-Borders, CRT-Effekte)
- [`scripts/transform-countries.mjs`](scripts/transform-countries.mjs) — regeneriert `src/data/countries.json` aus dem Rohdatensatz

Env-Konfiguration: `.env.example` → `.env.local` kopieren und den Supabase-Anon-Key eintragen (optional — ohne läuft das Spiel offline).
