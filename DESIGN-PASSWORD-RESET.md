# DESIGN — Passwort vergessen

**Status:** umgesetzt · 2026-08-30 · Tests 157/157, tsc/lint/Build grün

> **Nachtrag 2026-09-14:** Der Reset-Link zeigt nicht mehr auf GoTrues
> Verify-Endpunkt, sondern auf `{{ .SiteURL }}/?token_hash=…&type=recovery`;
> eingelöst wird per `verifyOtp` in `ensureSession()`
> ([DESIGN-MAIL-DOMAIN.md](DESIGN-MAIL-DOMAIN.md)). Das Recovery-Panel bleibt
> unverändert: `captureRecoveryRedirect()` liest `type=recovery` auch aus der
> Query, und `verifyOtp` feuert `PASSWORD_RECOVERY`. Der unten beschriebene
> Implicit-Flow-Weg gilt weiter für schon verschickte Mails.
**Auslöser:** Beim Aufbau des Projekt-Wikis fiel auf, dass
`resetPasswordForEmail` in `frontend/src/` **nirgends** vorkam — obwohl
`supabase/email-templates.md` seit dem 2026-07-12 eine fertige deutsche
„Reset Password"-Vorlage enthält, mit der Notiz „noch keine UI dafür im Spiel".

## Warum das vor dem Store-Release nicht offenbleiben durfte

Das Konto**löschen** funktioniert seit Migration 0017 sauber, das Konto
**zurückholen** gar nicht. Für eine App mit E-Mail/Passwort-Registrierung heißt
das: Passwort vergessen = Konto, Lernfortschritt, Pokale, Abzeichen und alle
Bestenlisteneinträge unwiederbringlich weg. Und weil die Support-Adresse
`geoquizsupport@gmail.com` in Datenschutzerklärung und Impressum steht, landen
genau diese Fälle dort — ohne dass es einen anderen Weg gäbe als manuelles
Zurücksetzen im Supabase-Dashboard.

Kein Play-Blocker, aber die einzige Stelle im Auth-Modell, an der ein normaler
Nutzerfehler zu dauerhaftem Datenverlust führt.

## Ablauf

```
LoginPanel „Passwort vergessen?"
   → requestPasswordReset(email)         resetPasswordForEmail + redirectTo
   → GoTrue schickt Mail
   → Klick auf den Link  →  App-Root mit #…&type=recovery
   → main.tsx captureRecoveryRedirect()  Marker in sessionStorage
   → supabase-js löst die Tokens ein     detectSessionInUrl
   → PasswordRecoveryPanel im Profil
   → setNewPassword(pw)                  updateUser({ password })
   → ensureSession + applyAuthSession    Level/XP/Avatar/Queue laden
```

## Die vier Entscheidungen, die Arbeit gekostet haben

### 1. Zwei unabhängige Wege in den Recovery-Modus

Der Client läuft im **Implicit Flow** (supabase-js-Default, in
`supabaseClient.ts` nicht überschrieben — nachgesehen, nicht vermutet). Die
Tokens kommen also als **Hash-Fragment** zurück. Das kollidiert mit dem
HashRouter: Dessen Catch-all-Route schreibt einen unbekannten Hash sofort auf
`#/profile` um, und danach ist `type=recovery` nicht mehr zu sehen.

Genau dieses Problem hatte Phase J schon für OAuth-Fehler gelöst —
`resolveOAuthRedirectError()` läuft synchron in `main.tsx` **vor** dem ersten
Render. `captureRecoveryRedirect()` folgt demselben Muster und setzt nur einen
Marker in `sessionStorage`.

**Die Tokens fasst es bewusst nicht an.** Ein zweiter Einlöseversuch neben
`detectSessionInUrl` würde denselben Einmal-Token zweimal verbrauchen. Der
Marker sagt nur „das war eine Recovery", die Sitzung baut supabase-js.

Dazu kommt als zweiter Weg das `PASSWORD_RECOVERY`-Event
(`onPasswordRecovery`). Der Marker deckt den Fall ab, dass der Router schneller
war; das Event den Fall, dass die Seite schon stand. Welcher zuerst greift,
hängt vom Timing ab — zusammen sind sie unabhängig von der Reihenfolge.

### 2. Reset-Link aus der App zeigt aufs Web, nicht auf die App

In der Android-App ist `window.location.origin` Capacitors eigener Origin
(`https://localhost`). Ein Reset-Link dorthin wäre für den System-Browser, der
die Mail öffnet, **wertlos** — er landete im Nichts.

`passwordResetRedirectTo()` prüft deshalb `Capacitor.isNativePlatform()` und
schickt native Aufrufe auf die öffentliche Web-Adresse
(`VITE_PUBLIC_SITE_URL`, Fallback seit 2026-09-14 `https://geoquiz.tobsob.dev`). Folge:
Wer das Passwort in der App vergisst, setzt es im Browser neu und meldet sich
danach in der App damit an. Ein Umweg, aber ein funktionierender — und der
einzige, der ohne App-Links/Deep-Link-Verifizierung auskommt.

Die URL steht als Env-Variable und nicht nur als Konstante, weil sie sich mit
einer eigenen Domain ändert — dann reicht ein Eintrag in `.env.local`.

### 3. Keine Auskunft darüber, ob es das Konto gibt

Die Rückmeldung lautet immer „Wenn es zu dieser Adresse ein Konto gibt, ist die
Mail unterwegs". Ein „diese Adresse kennen wir nicht" würde das Formular in ein
Verzeichnis verwandeln, mit dem sich prüfen lässt, wer hier registriert ist.
Supabase gibt die Information ohnehin nicht heraus; die Formulierung stellt nur
sicher, dass die UI sie nicht doch suggeriert.

### 4. Wiederholungsfeld statt „einmal tippen reicht"

Ein Tippfehler wäre hier besonders teuer: Das alte Passwort ist nach dem Setzen
weg, und der Fehler fällt erst beim nächsten Anmelden auf — dann braucht es
einen zweiten Reset-Link. Deshalb zwei Felder und `validateNewPassword()`.

Der Speichern-Knopf ist bei einem Problem deaktiviert, **und daneben steht,
warum** — ein toter Knopf ohne Begründung war die erste Fassung und im
Browser-Durchgang sofort als Sackgasse erkennbar. Die Meldung erscheint aber
erst, wenn das jeweilige Feld angefasst wurde: „mindestens 6 Zeichen" beim
ersten Tastendruck wäre Meckern, nicht Hilfe.

## Fehlermeldungen

Vier neue Übersetzungen in `translateAuthError`, alle aus realen
GoTrue-Antworten:

| GoTrue | Deutsch |
|---|---|
| `otp_expired`, „invalid or has expired" | Der Link ist abgelaufen oder wurde schon benutzt — fordere einen neuen an. |
| „New password should be different" | Das neue Passwort muss sich vom alten unterscheiden. |
| „Auth session missing" | Die Sitzung ist abgelaufen — fordere den Link bitte neu an. |
| „For security purposes … only request this after" | Zu schnell hintereinander — bitte einen Moment warten. |

Ein **abgelaufener** Link kommt als Fehler-Redirect zurück, nicht als Token —
den fängt weiterhin `resolveOAuthRedirectError()` ab und zeigt ihn im
LoginPanel. Deshalb greift dort jetzt dieselbe Übersetzung.

## Tests

`recovery.test.ts`, 9 Fälle, ohne DOM: Erkennung im Hash und in der Query,
Nicht-Erkennung bei `type=signup`, bei `#/profile` und beim Fehler-Redirect
(`otp_expired`), dazu die Passwortprüfung inklusive der Reihenfolge „Länge vor
Gleichheit" — die konkretere Meldung soll gewinnen.

Die Logik liegt deshalb in `features/auth/recovery.ts` und nicht in der
Komponente: dieselbe Trennung wie bei `oauthRedirect.ts` und
`pinMapGeometry.ts`.

## Im Browser durchgespielt (2026-08-30)

- „Passwort vergessen?" ohne Adresse → Hinweis statt Request.
- Aufruf mit `#…&type=recovery` → Panel erscheint, URL wird auf `#/profile`
  aufgeräumt, Marker ist danach verbraucht (`sessionStorage` leer).
- Zu kurz → „mindestens 6 Zeichen"; abweichend → „stimmen nicht überein";
  gültig → Knopf aktiv.

**Noch nicht durchgespielt:** der echte Rundlauf mit einer zugestellten Mail —
der geht erst, wenn der SMTP-Versand steht
([docs/wiki/auth-und-email.md](docs/wiki/auth-und-email.md)). Bis dahin ist die
Kette ab „GoTrue schickt Mail" unbewiesen.

## Bewusst NICHT gemacht

- **Kein eigener Screen `/reset`.** Der Recovery-Link landet ohnehin auf der
  App-Root; eine zusätzliche Route hieße, den Hash noch einmal umzuschreiben —
  genau die Operation, die hier die Tokens frisst.
- **Kein Deep-Link in die Android-App.** Bräuchte App-Links samt
  Domain-Verifizierung; der Umweg über den Browser kostet den Nutzer einen
  Login und uns nichts.
- **Kein Passwort-Stärke-Meter.** Supabase erzwingt 6 Zeichen; mehr Anspruch
  gehört serverseitig konfiguriert, nicht in eine Anzeige.
