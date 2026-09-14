# Projekt-Wiki — GEOQUIZ ARCADE

Kurze, atomare Seiten mit **geprüften Fakten**. Diese Ebene beantwortet
„was ist gerade wahr und wo schaue ich nach". Die Herleitung („warum haben wir
das so entschieden") steht weiter in den `DESIGN-*.md` und in
[../DEVELOPMENT.md](../DEVELOPMENT.md); jede Seite verlinkt am Ende dorthin.

**Nicht** hier hinein gehört: Prosa, die anderswo schon steht. Zwei Quellen
für dieselbe Wahrheit driften auseinander — das ist der Grund, warum es dieses
Wiki überhaupt gibt (siehe [../../DESIGN-WIKI.md](../../DESIGN-WIKI.md)).

## Seiten

| Seite | Beantwortet |
|---|---|
| [architektur.md](architektur.md) | Stack, Schichten, Ordner, Routen, Konventionen |
| [quiz-engine.md](quiz-engine.md) | Modi, Scoring-Konstanten, Sessions, Sampler |
| [daten-und-pipeline.md](daten-und-pipeline.md) | Datendateien, Mengen, Generator-Skripte |
| [state-und-sync.md](state-und-sync.md) | Stores, Persistenz, Delta-Sync, Offline |
| [backend-supabase.md](backend-supabase.md) | Tabellen, RPCs, Views, RLS, Migrationsstand |
| [auth-und-email.md](auth-und-email.md) | Gast → Konto, OAuth, Löschung, **Mailversand** |
| [karte-und-basemap.md](karte-und-basemap.md) | MapLibre, Style-Bau, Pin-Geometrie |
| [gamification.md](gamification.md) | XP/Level, Abzeichen, Pokale, Avatare |
| [android-und-release.md](android-und-release.md) | Capacitor, Signierung, `release.mjs` |
| [externe-dienste.md](externe-dienste.md) | Jeder externe Dienst + realer Konfigstand |
| [recht-und-nachweise.md](recht-und-nachweise.md) | Rechtstexte, Bild-/Lizenznachweise |
| [offene-punkte.md](offene-punkte.md) | Was wirklich noch fehlt (geprüft) |

## Konventionen dieser Seiten

- Kopfzeile mit **Stand** (Datum) und **Verifiziert** (womit geprüft).
- Zahlen nur, wenn sie aus Code oder einem Kommando stammen — mit dem Kommando
  daneben, damit die nächste Sitzung sie billig nachprüfen kann.
- Was unsicher ist, steht als „ungeprüft" da. Lieber eine ehrliche Lücke als
  eine Zahl, der jemand glaubt.
