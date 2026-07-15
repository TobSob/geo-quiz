# 🎭 Design-Notizen — Avatare & Spielerkarten

> Arbeitsdokument fürs Avatar-System (Playtest-Feedback-Runden 3–5, 2026-07-15).
> Muster wie [DESIGN-ARCADE.md](DESIGN-ARCADE.md): Regeln + Begründungen hier,
> Umsetzungsstand in der [ROADMAP.md](ROADMAP.md) (Phase H).

Legende: ✅ entschieden/umgesetzt · 💬 in Diskussion · ⬜ offen

---

## Kernidee (steht fest)

Jeder Spieler hat einen wählbaren **8-Bit-Pixel-Avatar** im Stil der ersten
Game-Boy-RPGs. Avatare sind **prozedurale 16×16-Sprites** (Zeichen-Raster →
SVG-Rechtecke, keine Bilddateien) und leben komplett im Client:
[`avatarCatalog.ts`](frontend/src/features/avatars/avatarCatalog.ts).
Menschliche Trainer teilen sich ein Basis-Gesicht + Frisur/Accessoire-Overlays;
Tiere/Roboter sind eigenständige Sprites.

| Regel | Wert | Status |
|---|---|---|
| Sprite-Format | 16×16, `shape-rendering: crispEdges`, PICO-8-nahe Palette | ✅ |
| Starter (immer wählbar, auch Gast/offline) | 8 Stück | ✅ |
| Freischaltbare | über Level, Abzeichen, Pokal, Prestige | ✅ |
| Gäste | können **nichts** freischalten (Level/Erfolge sind account-gebunden); Picker zeigt „🔒 Nur mit Account" statt Level-Angabe | ✅ |
| Auswahl-Speicherung | lokal (`avatarStore`, localStorage) **und** am Server-Profil (`profiles.avatar_id`, Migration 0010) — folgt dem Account übers Gerät | ✅ |
| Anzeige | Header (mit Verbindungsstatus-Punkt), Profil, Spielerkarte, jede Bestenlisten-Zeile | ✅ |

## Katalog (Stand 2026-07-15, 21 Avatare)

**Starter (8):** Junge · Mädchen · **Sora** (Kanarienvogel, orange) · **Riku**
(Kanarienvogel, gelb mit schwarzem Schopf/Flügeln) · Punk · Cool (Cap +
Sonnenbrille) · **Mira** (Prinzessin, Tiara) · **Superheld** (Domino-Maske +
Emblem)

**Freischaltbar (13):**

| Avatar | Bedingung |
|---|---|
| Ninja | Level 3 |
| Magier | Level 6 |
| Robo | Level 8 *(war Starter; Nutzer-Entscheid 2026-07-15: später freischalten)* |
| Ritter | Level 10 |
| Geist | Level 12 |
| Astronaut | Level 15 |
| Cyra (Robo-Girl) | Level 20 |
| Vampir | Level 25 |
| König | Level 30 |
| Drache | Level 40 |
| Alien | Abzeichen „Weltenbummler" (Stufe 1) |
| Champion | ein Pokal |
| **Geologe** (Bauhelm) | **alle 16 Abzeichen auf Diamant** (Prestige, `allDiamond`) |

*Historie: Lena (blond) und Max wurden 2026-07-15 durch Sora und Riku ersetzt;
Mira bekam Tiara + Kleid (Prinzessin). Entfernte IDs (`blondgirl`, `darkboy`,
`pony`) fallen beim Laden auf den Standard-Avatar (`boy`) zurück.*

## Entschiedene Punkte

| # | Punkt | Entscheidung | Status |
|---|---|---|---|
| V1 | Grafik-Herkunft | Prozedural als Code (Zeichen-Raster → `<rect>`-RLE) statt Bild-Assets: scharf auf jeder Größe, kein Asset-Prozess, per PR erweiterbar | ✅ |
| V2 | Stil | Erste Iteration (flache Vektor-Icons) war dem Nutzer nicht cool genug → Neubau als geschattete GB-Trainer-Sprites (Basis-Gesicht + Overlays) | ✅ |
| V3 | Unlock-Quelle | Level aus XP (`levels.ts`) + Badge-Stufen + Pokale aus dem `gamificationStore` — kein eigener Server-State nötig | ✅ |
| V4 | Gast-Verhalten | Keine Unlocks ohne Account; Hinweis statt unerreichbarer Level-Angabe | ✅ |
| V5 | Server-Sync | `profiles.avatar_id` + additive Nur-Lese-RPC `get_profile_avatars(names[])` (nur Name→Avatar, nie user_id). Leaderboard-RPCs bleiben unangetastet; Client läuft ohne Migration einfach ohne fremde Avatare weiter | ✅ |
| V6 | Spielerkarte | Avatar + Level/XP-Balken + Erfolgs-Embleme (Stufenfarbe) + lokale Bestpunkte; im Profil und als Overlay beim Klick auf die eigene Bestenlisten-Zeile | ✅ |
| V7 | Cup-Punkte-Hover | „Meine Rekorde": Cup-Einträge zeigen im Hover die Punkte je Disziplin (`cupLegs` im `progressStore`) | ✅ |

## Offene Punkte

| # | Punkt | Stand | Status |
|---|---|---|---|
| A1 | **Migration 0010 auf Live-DB einspielen** (`supabase/migrations/0010_profile_avatars.sql`, auch in `apply_all.sql`) — erst danach erscheinen fremde Avatare in der Bestenliste | wartet auf Deploy | ⬜ |
| A2 | Spielerkarten **fremder** Accounts (Embleme/Bestpunkte anderer beim Klick) — braucht weitere Profil-RPC (Server kennt Bestscores, Badges) | Idee, nicht beauftragt | 💬 |
| A3 | „Karten-Skins" (Rahmen/Hintergründe der Spielerkarte als Unlocks) | Ideen-Parkplatz | ⬜ |
| A4 | Avatar-Namen (Sora/Riku/Mira/Cyra) ggf. vom Nutzer umbenennbar? | nicht besprochen | ⬜ |

## Umsetzungs-Log

*Neueste Einträge oben.*

- **2026-07-15 (R5):** Starter-Rework auf Nutzer-Wunsch: Sora + Riku
  (Kanarienvögel) ersetzen Lena + Max, Mira → Prinzessin (Tiara-Overlay),
  Superheld neu (Masken- + Emblem-Overlay), Robo → Level 8. Katalog: 21.
  Render-verifiziert (Canvas→PNG), Suite 103 Tests grün.
- **2026-07-15 (R4):** Gast-Gating („Nur mit Account"), 4 neue Avatare
  (Geist, Vampir, Drache, Geologe mit `allDiamond`-Prestige-Regel),
  Header kompakt (Status-Punkt am Avatar statt „● ONLINE"-Text),
  Migration 0010 + `avatarApi.ts` (Sync/Reconcile/fetchAvatars),
  Bestenliste zeigt Avatare aller Spieler (graceful ohne Migration).
- **2026-07-15 (R3):** Avatar-System eingeführt: Katalog + `PixelAvatar`-
  Renderer, Picker im Profil, `avatarStore` (persist), Spielerkarte
  (`PlayerCard` + Overlay), Cup-Punkte-Hover. Erste Grafik-Iteration
  (flache Icons) nach Nutzer-Feedback durch GB-Sprites ersetzt.
