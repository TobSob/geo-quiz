# DESIGN — Native Google-Anmeldung in der Android-App

> Stand: 2026-10-05 · Auslöser: Rückmeldung aus dem Closed Test ·
> Vorgänger: [DESIGN-OAUTH-ANDROID.md](DESIGN-OAUTH-ANDROID.md)

## 1. Befund

Zwei Beschwerden der ersten Tester, beide Folgen des Custom-Tab-Wegs aus
DESIGN-OAUTH-ANDROID.md:

1. **„Komischer Supabase-Link":** Google zeigt auf der Anmeldeseite das Ziel
   des OAuth-Rücksprungs an, und das ist `dpueqnhhwcdbhihiudyg.supabase.co`.
   Für Tester sieht das nach Phishing aus.
2. **Zweiter Tipp nötig:** Wer schon einen Spieler zum Google-Konto hat (der
   Normalfall bei Freunden, die vorher im Web gespielt haben), scheitert beim
   Verknüpfen und muss nochmal tippen. Das war die bewusste Notlösung aus
   DESIGN-OAUTH-ANDROID.md §6, weil ein automatisch geöffneter zweiter Custom
   Tab hinter der App verschwand.

## 2. Entscheidung

**Google in der App über Androids Credential Manager, ID-Token direkt an
Supabase.** GitHub bleibt beim Custom Tab.

| Baustein | Was |
|---|---|
| `GoogleSignInPlugin.java` | lokales Capacitor-Plugin, `GetSignInWithGoogleOption` → ID-Token |
| `features/auth/nativeGoogle.ts` | Plugin-Aufruf, Nonce-Paar, Fehler-Einordnung |
| `continueWithGoogleNative()` in `authApi.ts` | `linkIdentity({token, nonce})`, bei Konflikt sofort `signInWithIdToken` mit demselben Token |
| `VITE_GOOGLE_WEB_CLIENT_ID` | Web-Client-ID (dieselbe wie im Supabase-Google-Provider); fehlt sie, bleibt alles beim Alten |

Damit:

- **Kein Browser, keine Supabase-Adresse.** Die Kontoauswahl ist ein
  System-Sheet über der App und zeigt den App-Namen aus dem
  OAuth-Zustimmungsbildschirm.
- **Kein zweiter Tipp.** Es gibt keinen Rücksprung und keinen zweiten Tab,
  der verschwinden könnte. Das Token ist bis zu seinem Ablauf (~1 h) gültig
  und wird für die Anmeldung direkt wiederverwendet.

### Nonce

Google bekommt `sha256(raw)`, Supabase `raw`. Supabase prüft, dass der Hash
des Rohwerts im Token steht. „Skip nonce checks" im Dashboard bleibt **aus**.

### Fallback statt harter Abhängigkeit

Jeder Fehler außer „Nutzer hat abgebrochen" (falscher SHA-1 in der Console,
Gerät ohne Play-Dienste, fehlende Client-ID) führt auf den bisherigen
Custom-Tab-Weg. Der Login kann durch diese Änderung also nicht schlechter
werden als vorher, nur besser.

### Verworfen

- **Supabase Custom Domain** (`auth.tobsob.dev`): würde Punkt 1 auch im Web
  lösen, kostet aber ein kostenpflichtiges Add-on und löst Punkt 2 nicht.
  Für später, falls die Web-Nutzer sich ebenfalls beschweren.
- **Drittanbieter-Plugin** (z. B. capgo social-login): ~60 Zeilen Java eigener
  Code gegen eine weitere Abhängigkeit, die Capacitor-Major-Sprüngen
  hinterherlaufen muss.
- **Zweiten Custom Tab nach `resume` verzögert öffnen** (§6 im Vorgänger):
  geräteabhängiges Timing, und Punkt 1 bliebe.

## 3. Manuelle Schritte (Console)

1. **Google Cloud Console** → im Projekt, in dem der Web-Client für Supabase
   liegt → *APIs & Dienste → Anmeldedaten → OAuth-Client-ID erstellen →
   Android*: Paket `de.tobsob.geoquizarcade`, SHA-1 des
   **App-Signaturschlüssels** aus der Play Console (*Testen und
   veröffentlichen → App-Integrität → App-Signatur*). Testinstallationen aus
   dem Play Store tragen diese Signatur, nicht die des Upload-Keys.
2. Optional ein zweiter Android-Client mit dem SHA-1 des **Upload-Keys** —
   nur nötig für selbst installierte Release-APKs.
3. **Zustimmungsbildschirm**: App-Name `GEOQUIZ ARCADE`, Logo, Support-Mail.
   Das ist, was in der Kontoauswahl steht.
4. `frontend/.env.local`: `VITE_GOOGLE_WEB_CLIENT_ID=<Web-Client-ID>` (aus
   Supabase → Authentication → Providers → Google).
5. Supabase → Google-Provider: „Skip nonce checks" **aus** lassen.
6. `npm run release -- --android-only`, als neues Release in den Alpha-Track.

Die Android-Client-ID wird nirgends eingetragen — Google erkennt die App am
Paketnamen plus Signatur.

## 4. Test

- Gast → „Mit Google" → neues Google-Konto → Gast-Fortschritt bleibt
- Gast → „Mit Google" → Konto mit bestehendem Spieler → **direkt** angemeldet
- Kontoauswahl wegwischen → „Google-Anmeldung abgebrochen.", kein Browser
- Ohne Client-ID gebaut → alter Custom-Tab-Weg wie bisher

## 5. Umsetzungs-Log

| Datum | Stand |
|---|---|
| 2026-10-05 | Code + Plugin + Tests (185/185), `compileDebugJavaWithJavac` grün. Console-Schritte §3 und Gerätetest offen |
| 2026-10-05 | Android-Client `GEOQUIZ ARCADE Android (Play)` im Cloud-Projekt `901692925361` (gehört dem GeoQuiz-Konto, **nicht** tob.sobek) mit Play-App-Signatur-SHA-1 `30:C8:8B:C4:…:C1:53` angelegt. Upload-Key ist `E2:BC:5B:31:…:EA:69` (aus dem AAB gelesen) — der gehört nicht hinein. Build 16 gebaut, Client-ID im Bundle, Plugin in der APK. Build 16 im Alpha-Track eingereicht (2026-10-05, in Prüfung). Gerätetest offen |
