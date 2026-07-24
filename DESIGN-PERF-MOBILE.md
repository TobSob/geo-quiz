# DESIGN-PERF-MOBILE — Handy wird warm beim Spielen (2026-07-24)

> Ausgelöst durch einen Praxisbericht: Das Handy (Galaxy S24 Ultra) wurde beim
> Spielen einer Cup-Runde in der Android-App spürbar warm.
> Betrifft Web + App gleichermaßen (gleiche Codebasis, gleiche Engine —
> die Android-App ist eine Chromium-WebView).
> Verwandte Docs: [DESIGN-ARCADE.md](DESIGN-ARCADE.md) (Arcade-Session),
> [DESIGN-PIN-UX.md](DESIGN-PIN-UX.md) (Kartenmodi, Kachel-Prefetch),
> [DESIGN-MOBILE-POLISH.md](DESIGN-MOBILE-POLISH.md) (Handy-Layout).

## Messverfahren

Gemessen am angeschlossenen Gerät (SM-S928U1, Android, 120-Hz-Display) über
Chrome-Remote-Debugging: `adb forward tcp:9222 localabstract:chrome_devtools_remote`,
Varianten per CDP `Runtime.evaluate` live in die Seite injiziert, CPU-Zeit aus
`/proc/<pid>/stat` der Chrome-Prozesse (GPU-Prozess und Renderer getrennt).

Angaben in **% eines CPU-Kerns**. 100 % = ein Kern dauerhaft ausgelastet.

Zwei Regeln haben sich als notwendig erwiesen:

- **Verschachtelt messen** (IST → Variante → IST → …). Ein erster Anlauf lieferte
  drei identische Werte, weil die Injektion stumm fehlschlug; erst die
  wiederholten IST-Anker machten den Fehler sichtbar. Driften die Anker,
  ist die Messung wertlos.
- **Fremdlast prüfen.** Die USB-Dateiübertragung startet den Android-Medien-Scanner
  (`android.process.media`, bis 39 %). Absolutwerte schwanken dadurch zwischen
  Läufen um ±8 Punkte; die Verhältnisse innerhalb eines Laufs bleiben stabil.

## Befund 1: Starfield-Drift — Vollbild-Repaint pro Frame

**Problem:** `.stars` ist eine bildschirmfüllende `position: fixed`-Ebene, deren
Drift über `background-position` animiert wurde. Das ist eine **Paint**-Property:
Das Gerät rastert die gesamte Ebene in jedem Frame neu und lädt sie als Textur
hoch — auf einem 120-Hz-Display 120× pro Sekunde, dauerhaft, unabhängig davon,
ob gespielt wird.

Messung im **Leerlauf** (Startseite, keine Eingabe):

| Variante | CPU | davon GPU-Prozess | Renderer |
|---|---|---|---|
| IST (`background-position`) | **93,5 %** | 64,4 % | 27,3 % |
| `transform` (compositor-only) | **34,8 %** | 23,8 % | 8,4 % |
| Animation aus | **12,4 %** | 6,7 % | 3,3 % |

Eine Variante, die die Ebene nur in Driftrichtung vergrößert statt auf allen
Seiten, wurde geprüft und **verworfen**: 35,5 % gegenüber 34,8 % — kein
Unterschied. Es zählt nicht die Größe der Ebene (Überstand wird weggeschnitten),
sondern dass eine bildschirmfüllende halbtransparente Ebene pro Frame komponiert
wird.

**Regeln:**
- Die Drift läuft über `transform: translate3d()` auf einem `::before`-Pseudoelement,
  das eine Kachel (550 px) Reserve in Driftrichtung hat. Optisch identisch,
  aber compositor-only.
- **In einer laufenden Runde steht der Himmel still** (`.stars--frozen`) — dieselbe
  Regel wie beim Wordmark-Attract-Mode. Genau dann, wenn das Spiel den Compositor
  selbst braucht, kostet die Kulisse nichts. Zuständig ist das bereits vorhandene
  `inRound` in `App.tsx`.
- `prefers-reduced-motion: reduce` schaltet die Drift ab. Fehlte bisher; beim
  Wordmark war die Regel schon da.

**Verhältnismäßigkeit:** Die Drift bewegt sich 550 px in 120 s — 4,6 Pixel pro
Sekunde, praktisch unsichtbar. Sie deshalb ganz zu streichen wäre vertretbar;
der Attract-Mode im Menü ist aber Teil des Arcade-Charakters
([DESIGN-ARCADE.md](DESIGN-ARCADE.md)), und mit Einfrieren während der Runde
kostet sie dort nichts mehr, wo es zählt.

## Befund 2: CRT-Overlay ist unschuldig (These verworfen)

Der Verdacht lag zunächst auch auf `.crt::before`/`::after` (bildschirmfüllende
Scanlines + Vignette, `z-index: 1000`). Messung: 12,3 % → 12,1 % beim Abschalten,
also **Rauschen**. Die Overlays sind statisch, werden einmal gerastert und danach
nur noch komponiert. **Keine Änderung.** Hier festgehalten, damit die These nicht
beim nächsten Warm-wird-Bericht erneut geprüft wird.

## Befund 3: Cup-Runde — was das Spiel selbst kostet

Zeitreihe über eine vollständige Cup-Runde (6 Legs, 5-s-Fenster):

| Abschnitt | CPU gesamt | GPU | Renderer |
|---|---|---|---|
| Leerlauf (Referenz) | 93 % | 64 % | 27 % |
| Choice-Legs (Flaggen, Hauptstädte, Länder, Umriss) | 113–119 % | 65–69 % | 34–40 % |
| Pin-Legs (City-Pin, Landmark-Pin) | 124–131 % | 57–62 % | 51–69 % |
| Spitze beim Mount des ersten Pin-Legs | **188 %** | 57 % | 69 % |

**Mittel über die Runde: 118,6 %.**

Die Aufschlüsselung ist eindeutig: Der GPU-Prozess liegt die ganze Runde auf
seinem Leerlaufwert — das ist der Starfield, und die Runde ändert daran nichts.
Vom Gesamtwert entfallen **~81 Punkte auf die Kulisse und nur ~25 auf das Spiel**.

**Regeln:**
- `MapPicker` wird per `memo` aus dem 10-Hz-Anzeige-Tick der Arcade-Session
  herausgehalten; der Pin-Callback bekommt eine stabile Identität (`useCallback`),
  sonst registriert `ClickCapture` seine Leaflet-Handler 10×/s neu.
- Der tiefere Umbau (Uhr und Timer-Balken als eigene Komponente, damit der Tick
  gar nicht erst den ganzen Baum anfasst) ist **bewusst aufgeschoben**: gemessene
  ~10 Punkte gegenüber 81 für Befund 1. Erst nachmessen, dann entscheiden.

## Befund 4: Kachel-Prefetch — Requests statt Bandbreite

Der Prefetch feuert beim Mount des ersten Pin-Legs **1360 Kachel-Requests auf
einmal** (`PREFETCH_ZOOMS = [2,3,4,5]`; Zoom 5 allein sind 1024 davon) und hält
alle `Image`-Objekte für die Lebensdauer der Seite in `keepAlive` fest.

Gemessen während der Cup-Runde: **1576 Requests, aber nur 0,63 MB** — der Cache
war warm, das waren fast durchweg Treffer à ~400 Byte. Die ursprüngliche Sorge
über 30–60 MB Funklast ist damit **nicht bestätigt**. Zeitlich fällt der Burst
aber exakt mit der 188-%-Spitze zusammen.

**Regeln:**
- Der Prefetch läuft über eine Warteschlange mit begrenzter Parallelität statt
  als Burst. Das Gesamtvolumen bleibt gleich, die Spitze verschwindet.
- Geladene Bilder werden aus `keepAlive` entlassen. Der Grund für `keepAlive`
  (GC bricht Requests ohne Referenz ab, siehe [DESIGN-PIN-UX.md](DESIGN-PIN-UX.md))
  gilt nur bis zum `load` — danach steht die Kachel im HTTP-Cache.
- **Offen:** Das Verhalten bei kaltem Cache (Neuinstallation, erster Start) ist
  ungemessen. Der Zoom-Bereich bleibt unverändert, bis dafür Zahlen vorliegen.

## Gegenprobe nach dem Umbau (2026-07-24)

Am selben Gerät, gleiches Verfahren. Der Zustand VOR dem Umbau wurde in
derselben Sitzung per CSS rekonstruiert, damit beide Varianten unter identischen
Bedingungen laufen. Anker-Wiederholung 33,2 % / 36,3 % — Messung gültig.

| Zustand | CPU | GPU | Renderer |
|---|---|---|---|
| ALT, Menü (`background-position`) | **100,2 %** | 73,7 % | 24,7 % |
| NEU, Menü (`transform`) | **34,8 %** | 23,4 % | 8,2 % |
| NEU, Cup-Route (eingefroren) | **2,3 %** | 0,2 % | 0,0 % |

Die 2,3 % sind der statische Cup-Intro-Screen — Starfield und Wordmark beide
eingefroren, nichts bewegt sich. Das ist der Boden **ohne** Spiel-Last, nicht
der Wert einer laufenden Runde; dort kommen die gemessenen ~25 Punkte Spiel
obendrauf.

**Fallstricke des Messverfahrens** (beide real aufgetreten, beide kosteten einen
kompletten Messlauf):

- Der Bildschirm schläft mitten im Lauf ein (`DOZE_SUSPEND`) und alles friert
  ein — Ergebnis: gleichmäßige ~3 % mit GPU 0,0 %. Vor **und** nach jedem
  Messfenster `document.visibilityState` und `mScreenState` prüfen.
- `Runtime.evaluate` teilt sich den globalen Scope der Seite über alle Aufrufe
  hinweg: ein `const x` aus einem früheren Skript lässt jedes spätere `let x`
  mit „already been declared" scheitern — stumm, wenn niemand den Rückgabewert
  prüft. Injektionen in eine IIFE kapseln und das Ergebnis auswerten.

### Vollständige Cup-Runde nach dem Umbau

Gemessen gegen den lokalen Produktions-Build (`vite preview` via `adb reverse`),
damit Dev-Overhead den Vergleich nicht verfälscht. Gleiche Dauer und
Leg-Abdeckung wie die Ausgangsmessung, Sterne durchgehend `FROZEN`:

| Abschnitt | vorher | nachher |
|---|---|---|
| **Mittel über die Runde** | **118,6 %** | **51,9 %** |
| GPU-Prozess | 65–69 % | 9–20 % |
| Renderer (Choice-Legs) | 34–40 % | 13–29 % |
| Spitze beim Mount des ersten Pin-Legs | 188 % | 154 % |

**Die Erwartung von ~38 % wurde nicht erreicht.** Die Rechnung „118,6 − 81
Punkte Starfield" ging nicht auf: In der Runde bringt der Wegfall ~66 Punkte
(GPU −50, Renderer −13), nicht die im Leerlauf gemessenen 81. Der aus einem
Zustand abgeleitete Einzelbeitrag lässt sich also nicht ungeprüft auf einen
anderen Zustand übertragen — hier festgehalten, damit die nächste Prognose
vorsichtiger ausfällt.

### Kalter Cache — Frage beantwortet

Die Messung lief gegen `localhost:4173` statt `geo-quiz-a6s.pages.dev`. Chrome
partitioniert den HTTP-Cache nach Top-Level-Site, die neue Herkunft bekam also
eine frische Partition — unbeabsichtigt, aber genau der gesuchte Kaltstart:

**1389 Requests, 5,37 MB** — rund 3,9 KB pro Kachel. Die ursprüngliche Sorge über
30–60 MB Funklast war um eine Größenordnung daneben. Der Zoom-Bereich
(`PREFETCH_ZOOMS = [2,3,4,5]`) bleibt damit **unverändert**; die Warteschlange
genügt, um die Einschaltspitze zu dämpfen (188 % → 154 %).

## Offen

- Gegenprobe in der **Android-App** (WebView statt Chrome). Gleiche Engine und
  gleiches CSS, der Effekt sollte übertragen — belegt ist es nicht. Braucht ein
  Release, weil die Release-APK nicht debuggbar ist (`chrome://inspect` zeigt nur
  Chrome-Tabs und Debug-Builds).
