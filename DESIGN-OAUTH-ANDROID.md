# DESIGN — Google-/GitHub-Login in der Android-App

> Stand: 2026-09-14 · Auslöser: Gerätetest Build 9 — nach der Anmeldung landet
> man im Browser statt in der App · Vorgänger: [DESIGN-AUTH.md](DESIGN-AUTH.md)
> (dort seit Juli als Einschränkung beschrieben, Zeile 49)

## 1. Befund

In der App ruft `signInWithOAuth` bzw. `linkIdentity` die Provider-Seite mit
`redirectTo = window.location.origin + pathname` auf. In Capacitor ist das
`https://localhost/`.

1. Die WebView gibt die fremde URL an den **System-Browser** ab.
2. Nach der Anmeldung schickt Supabase zurück an `https://localhost/` — die
   Adresse steht nicht auf der Erlaubnisliste, also Fallback auf die
   **Site-URL** `https://geoquiz.tobsob.dev`.
3. Angemeldet ist danach der **Browser**. Die App erfährt nichts davon, das
   Manifest hat keinen Weg zurück.

Die Buttons sind in der App sichtbar. Tester und Googles Prüfer drücken genau
die.

## 2. Entscheidung

**Deep-Link mit eigenem URL-Schema, Anmeldung im Chrome Custom Tab, PKCE.**

```
de.tobsob.geoquizarcade://auth-callback
```

| Baustein | Was |
|---|---|
| `@capacitor/browser` | öffnet die Provider-Seite als **Custom Tab** über der App |
| `redirectTo` in der App | das Schema oben statt `https://localhost/` |
| `skipBrowserRedirect: true` | supabase-js gibt nur die URL zurück, statt selbst zu navigieren |
| `AndroidManifest.xml` | `intent-filter` für `VIEW` + `BROWSABLE` auf Schema und Host |
| `App.addListener('appUrlOpen')` | fängt den Rücksprung und tauscht den Code gegen die Sitzung |
| `flowType: 'pkce'` **nur nativ** | Rücksprung trägt einen Einmal-Code statt der Tokens |
| Supabase Redirect-URLs | Schema-URL ergänzen (Dashboard) |

### Warum PKCE und warum nur in der App

Ein eigenes URL-Schema kann jede andere App auf dem Gerät ebenfalls
registrieren. Im Implicit Flow stünden Access- und Refresh-Token direkt im
Rücksprung, eine fremde App könnte sie abfangen. Mit PKCE steht dort nur ein
Code, und der ist ohne den Verifier im Speicher dieser App wertlos
(RFC 8252, „OAuth 2.0 for Native Apps").

Im Web bleibt der Implicit Flow: Er läuft seit Juli, `detectSessionInUrl` und
`resolveOAuthRedirectError()` sind darauf abgestimmt, und das Risiko oben gibt
es dort nicht. Die Mail-Links sind vom Flow unabhängig — sie laufen seit
[DESIGN-MAIL-DOMAIN.md](DESIGN-MAIL-DOMAIN.md) über `token_hash` + `verifyOtp`.

### Warum Custom Tab statt Login in der WebView

Google lehnt OAuth in eingebetteten WebViews ab (`disallowed_useragent`). Der
System-Browser allein wäre erlaubt, aber dort hängt die Rückkehr am
Browser-Verhalten gegenüber Custom Schemes. Der Custom Tab liegt über der App,
fühlt sich wie ein Teil davon an und wird nach dem Rücksprung geschlossen.

### Verworfen

- **Android App Links** (`https://geoquiz.tobsob.dev/…` öffnet die App):
  sauberer, weil kein fremdes Schema möglich ist, braucht aber
  `assetlinks.json` mit dem **Play-Signaturschlüssel**. Den gibt es erst nach
  dem ersten Upload mit Play App Signing. Für später vorgemerkt.
- **Google-Buttons in der App ausblenden:** vom Nutzer verworfen. Ohne Google-
  Login bliebe in der App nur die Bestätigungsmail, und die landet bei Outlook
  im Junk.

## 3. Ablauf in der App

```
Button → continueWithProvider / signInWithProvider
       → supabase-js: URL mit code_challenge (Verifier landet in Preferences)
       → Browser.open(url)                       [Custom Tab]
       → Google/GitHub → Supabase → de.tobsob.geoquizarcade://auth-callback?code=…
       → Android öffnet die App (singleTask, gleiche Instanz)
       → appUrlOpen (der Custom Tab verschwindet von selbst: singleTask
         räumt beim Zurückholen alles über der App-Activity ab)
       → Fehler im Rücksprung?  → Meldung; bei „gibt schon einen Spieler"
         meldet der nächste Tipp direkt an (§6 — anders als im Web)
       → sonst exchangeCodeForSession(code)
       → ensureSession() + applyAuthSession() → #/profile
```

Details, die man beim Ändern wissen muss:

- **Fehler-Parsing geteilt:** `parseOAuthRedirectError(hash, search)` bekommt
  die Teile der Deep-Link-URL. Keine zweite Implementierung.
- **`identity_already_exists`-Fallback:** Der gemerkte Provider liegt in
  `sessionStorage`. Die WebView wird beim Rücksprung nicht neu geladen
  (`singleTask`), er ist also noch da.
- **Parsing rein und getestet:** Erkennen des Callbacks und Herausziehen von
  Code bzw. Fehler in `features/auth/nativeOAuth.ts`, ohne Capacitor-Import.

## 4. Reihenfolge

1. Code + Manifest + Plugin, Tests
2. Supabase → URL Configuration → Redirect-URL
   `de.tobsob.geoquizarcade://auth-callback` ergänzen
3. Build 10 aufs Gerät
4. Test: Gast → „Mit Google" (Verknüpfen, Fortschritt bleibt) **und**
   abgemeldet → „Mit Google" auf bestehendes Konto (Zweitgerät-Fall)

Ursprünglich ohne Web-Deploy geplant. Mit dem Befund aus §5 ändert sich auch der Web-Pfad, deshalb Web **und** App ausrollen.

## 5. Befund beim ersten Gerätetest (Build 10, 2026-09-14)

Rücksprung in die App **funktionierte**, angemeldet wurde trotzdem nicht. Die
Meldung im Profil: „Für diese E-Mail existiert bereits ein Account."

Ursache lag nicht im Deep-Link, sondern im Fallback aus DESIGN-AUTH: Als Gast
versucht „Mit Google" zuerst `linkIdentity`. Das Google-Konto des Nutzers hing
an keinem Spieler, aber ein Spieler **mit derselben E-Mail** existierte
(per E-Mail/Passwort angelegt). GoTrue antwortet dann nicht mit
`identity_already_exists`, sondern mit `email_exists` — und der automatische
Umweg zur normalen Anmeldung griff nur beim ersten Code.

**Betraf das Web genauso** — `resolveOAuthRedirectError()` prüfte denselben
einen Code. Aufgefallen ist es erst jetzt, weil der Fall (E-Mail-Konto,
danach Google mit derselben Adresse) vorher nie getestet wurde.

**Fix:** `shouldSignInInsteadOfLinking()` in `features/auth/oauthRedirect.ts`,
genutzt von Web (`resolveOAuthRedirectError`) und App
(`handleNativeOAuthCallback`): `identity_already_exists`, `email_exists`,
`user_already_exists` → Anmeldung mit demselben Provider. GoTrue verknüpft
das Google-Konto dabei über die bestätigte E-Mail mit dem bestehenden
Spieler. Der Gast-Fortschritt geht dabei verloren — dieselbe, in DESIGN-AUTH
bereits akzeptierte Folge wie beim ersten Code.

## 6. Zweiter Befund (Build 11): der automatische zweite Sprung verschwindet

Mit dem Fix aus §5 löste die App den Umweg aus, angemeldet wurde trotzdem
nicht, ohne Meldung. Auth-Logs, dreimal dasselbe Muster:

| Schritt | Log |
|---|---|
| Gast → Verknüpfen | `/user/identities/authorize` |
| Rücksprung | `/callback` → `400: A user with this email address has already been registered` |
| App startet Anmeldung | `/authorize` → 302 zu Google |
| — | **kein `/callback` mehr** |

Der zweite Custom Tab wurde geöffnet und hat die Google-Seite geladen, kam
aber nie zum Abschluss. Er startet im selben Moment, in dem Android die App
per Deep-Link nach vorne holt, und landet dahinter. Mit Warten auf
`resume` plus Verzögerung ließe sich das vermutlich lösen — aber nur
vermutlich, und abhängig vom Gerät.

**Entscheidung:** In der App kein automatischer zweiter Sprung. Stattdessen
eine Meldung („Zu diesem Google-Konto gibt es schon einen Spieler. Tippe
nochmal …") und ein Merker in `sessionStorage`; der nächste Tipp auf
denselben Provider ruft direkt `signInWithProvider` auf, ohne
Verknüpfungsversuch. Ein Tipp mehr, dafür ohne Timing. Das Web behält den
automatischen Umweg, dort gibt es kein Zurückholen der App.

**Nebenbeobachtung:** Bei den fehlgeschlagenen Verknüpfungen loggt Supabase
im selben Request `identity_linked` **und** den Fehler. Die Users-Liste zeigt
danach keinen zusätzlichen Google-Provider bei Konten mit E-Mail; ob ein
anonymer Gast betroffen ist, war dort nicht sichtbar. Prüfstein: Landet die
Anmeldung mit diesem Google-Konto im echten Konto, ist nichts hängen
geblieben.

## 7. Dritter Befund (Build 12) und Abschluss (Build 13)

Die Meldung aus §6 erschien, aber beide Buttons standen auf „…" und waren
gesperrt: `OAuthButtons` ließ `busy` nach einem erfolgreichen Start bewusst
an, weil im Web die Seite in diesem Moment verlassen wird. In der App bleibt
sie stehen. Fix: in der App `busy` zurücksetzen, sobald der Custom Tab offen
ist.

**Bestätigt auf dem Gerät (S24 Ultra, Build 13, 2026-09-14):** Gast →
„Mit Google" → Meldung → zweiter Tipp → angemeldet im **bestehenden** Konto
(Level 18, Pokalregal, Bestpunkte). Damit ist auch belegt, dass bei den
fehlgeschlagenen Verknüpfungen aus §6 nichts an einem Gast hängen blieb; der
betroffene Gast steht in der Users-Liste als anonym ohne Provider.

**Nicht getestet:** GitHub in der App (gleicher Code-Pfad), ein ganz neues
Google-Konto (Verknüpfen ohne Konflikt, Gast-Fortschritt bleibt), Kaltstart
der App während des Logins (`getLaunchUrl`).

