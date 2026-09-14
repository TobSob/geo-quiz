# Daten & Pipeline

> **Stand:** 2026-08-30 · **Verifiziert:** `node -e` Zählung über `src/data/*.json`

## Mengen (nachgezählt, nicht geschätzt)

| Datei | Einträge | Zweck |
|---|---|---|
| `countries.json` | **245** | Länder (davon 194 UN-Mitglieder) |
| `cities.json` | **143** | Städte für City-Pin |
| `landmarks.json` | **129** | Sehenswürdigkeiten + Foto |
| `landmark-credits.json` | **129** | Urheber + Lizenz je Foto, eigener Chunk |

> STATUS.md nennt an dieser Stelle 141 Städte — das ist veraltet. Nachzählen:
> `node -e "console.log(require('./src/data/cities.json').length)"` aus `frontend/`.

Dazu `world-atlas-50m.json` (756 KB Topojson, per `import()` nachgeladen),
`outline-index.json` (~7 KB Umkreise fürs Pruning) und
`basemap-dark-nolabels.json` (5,6 KB, siehe [karte-und-basemap.md](karte-und-basemap.md)).

## Generator-Skripte (`frontend/scripts/`)

| Skript | Macht |
|---|---|
| `transform-countries.mjs` | mledoze/countries (770 KB) → schlanke `countries.json` |
| `build-outline-atlas.mjs` | Umkreis-Index je Land für den Outline-Modus |
| `fetch-landmark-images.mjs` | Fotos **und** Nachweise in einem Lauf über die Wikipedia-API (`extmetadata`) |
| `build-basemap-style.mjs` | MapLibre-Style aus OpenFreeMaps Dark bauen und beschneiden |
| `generate-app-assets.mjs` | Icon, Splash, Feature-Grafik prozedural zeichnen |
| `landmarks-manifest.mjs` / `validate-manifest.mjs` | Manifest der Landmark-Bilder + Prüfung |

**Regel:** Bilder und Nachweise kommen aus **demselben Lauf**. Sonst können
ausgeliefertes Foto und Urhebernennung auseinanderlaufen — bei CC-BY ist das
ein Lizenzverstoß, kein Schönheitsfehler. Ein Datenintegritäts-Test hält beide
Dateien deckungsgleich.

## Bekannte Falle

Wikipedias `pageimage` ist **nicht zwingend ein Foto**. Bei der Alhambra war es
ein Grundriss von 1889; korrigiert über `MANUAL_OVERRIDES` im Fetch-Skript. Ein
Scan aller 129 Nachweise fand keinen zweiten Fall — bei neuen Landmarks aber
wieder hinsehen.

## Vertiefung

- [../DEVELOPMENT.md](../DEVELOPMENT.md) §7 — Daten-Pipeline, §10 — Daten ergänzen
- [../IMAGE_CREDITS.md](../IMAGE_CREDITS.md) — die Nachweise selbst
