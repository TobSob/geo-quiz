# Auth, Konten & E-Mail-Versand

> **Stand:** 2026-09-12 · **Verifiziert:** `src/api/authApi.ts`, Live-Abfrage
> `GET /auth/v1/settings` mit Anon-Key, Dashboard-Durchgang (URL Configuration,
> SMTP Settings, Rate Limits) am 2026-09-12, Browser-Durchgang des Recovery-Panels

## Versand-Setup: erledigt (2026-09-12 im Dashboard geprüft)

Variante A (Gmail direkt) ist **eingerichtet**. Damit ist der lange
Veröffentlichungs-Blocker „kein Mailversand" weg — offen ist nur noch der
Rundlauf mit einer echt zugestellten Mail.

| Baustein | Stand |
|---|---|
| 2FA auf `geoquizsupport@gmail.com` | ✅ aktiv (Authenticator-App seit 2026-08-30) |
| App-Passwort `Supabase GEOQUIZ` | ✅ vorhanden, „zuletzt verwendet 30. Aug." |
| Custom SMTP in Supabase | ✅ **an**: `smtp.gmail.com:587`, User + Sender `geoquizsupport@gmail.com`, Sender-Name `GEOQUIZ ARCADE` |
| Rate Limit E-Mail | ✅ `30`/Stunde (Default bei Free ist ~2/h und wäre nach zwei Testern dicht) |
| Deutsche Templates | ✅ **belegt** — die tatsächlich verschickte Mail (2026-09-12, 20:11) trägt Absender `GEOQUIZ ARCADE <geoquizsupport@gmail.com>`, deutschen Betreff und den korrekt eingesetzten `{{ .NewEmail }}` |
| Versand | ✅ **belegt** — Kopie im Gesendet-Ordner des Gmail-Kontos |
| Zustellung an `@outlook.de` | ❌ **nicht im Posteingang angekommen** (Junk-Ordner zum Zeitpunkt dieser Notiz noch nicht gegengeprüft) — siehe unten |
| Zustellung an andere Anbieter | ⬜ ungeprüft |

Supabase zeigt bei Gmail eine orange Warnung („provider designed for personal
rather than transactional email"). **Erwartet, kein Fehler** — genau der in der
Abwägung unten beschriebene Graubereich von Variante A.

### Umzug auf Variante C: `mail.tobsob.dev` über Resend (seit 2026-09-13)

Auslöser: die Microsoft-Zustellung (unten). Domain `tobsob.dev` bei Cloudflare,
Versand-**Sub**domain `mail.tobsob.dev`, damit die Reputation der Dach-Domain
unberührt bleibt. Resend-Region **Ireland (eu-west-1)**.

DNS von außen geprüft am 2026-09-13 (über `1.1.1.1` **und** `8.8.8.8`):

| Eintrag | Name | Inhalt |
|---|---|---|
| DKIM | `resend._domainkey.mail.tobsob.dev` | TXT `p=MIGfMA0…` (von Resend per Cloudflare-Auto-Configure gesetzt) |
| SPF | `send.mail.tobsob.dev` | TXT `v=spf1 include:amazonses.com ~all` |
| MX (Return-Path) | `send.mail.tobsob.dev` | `feedback-smtp.eu-west-1.amazonses.com` |
| DMARC | `_dmarc.tobsob.dev` | TXT `v=DMARC1; p=none;` — **von Hand**, Resend setzt ihn nicht. Auf der Dach-Domain, gilt damit für alle Subdomains |

`p=none` = nur beobachten. Verschärfen erst, wenn die Zustellung stabil läuft.
Bewusst **ohne** `rua=mailto:…@gmail.com`: Berichte an eine fremde Domain
verlangen dort einen Autorisierungseintrag, den `gmail.com` nicht hat — sie
kämen nie an.

Nachprüfen:

```bash
nslookup -type=TXT _dmarc.tobsob.dev 1.1.1.1
```

### Erster Resend-Test an Outlook (2026-09-13): technisch sauber, trotzdem Junk

Kommt an (vorher mit Gmail-Relay: gar nicht), landet aber im **Junk**. Header
der Mail ausgewertet:

| Header | Wert | Bedeutung |
|---|---|---|
| `Authentication-Results` | `spf=pass`, `dkim=pass header.d=mail.tobsob.dev`, `dmarc=pass`, `compauth=pass reason=100` | **Authentifizierung fehlerfrei**, DKIM ist auf die Absender-Domain ausgerichtet |
| `X-MS-Exchange-Organization-SCL` | **5** | Spam-Einstufung durch den Inhalts-/Reputationsfilter |
| `X-Microsoft-Antispam` | `BCL:0` | nicht als Massenmail eingestuft |
| `X-Microsoft-Antispam-Mailbox-Delivery` | `dest:J; OFR:SpamFilterAuthJ` | Junk **trotz** bestandener Authentifizierung |

Die Technik ist also nicht mehr das Problem. Was Microsoft stört, in der
Reihenfolge des vermuteten Gewichts (Umbau dazu:
[DESIGN-MAIL-DOMAIN.md](../../DESIGN-MAIL-DOMAIN.md), Code seit 2026-09-14):

1. **Domain-Alter:** `tobsob.dev` ist am selben Tag registriert. Frische
   Domains gelten grundsätzlich als verdächtig. Das lässt sich nur mit Zeit
   und sauberem Versand abbauen.
2. **Link zeigt auf fremde Domains:** Absender `mail.tobsob.dev`, der Button
   aber auf `dpueqnhhwcdbhihiudyg.supabase.co/auth/v1/verify?token=…` mit
   `redirect_to` nach `pages.dev`. „Bestätige dein Konto" plus Link auf eine
   kryptische Fremd-Domain ist das Muster einer Phishing-Mail. Die größte
   Stellschraube, die wir selbst in der Hand haben.
3. Kleinkram: Emoji im Betreff, `noreply@` als Absender, vollflächig dunkles
   HTML. Je für sich schwach.

Gut ist bereits: `multipart/alternative` mit Text-Teil, `BCL:0`.

**Sicherheitsnotiz:** Der Link enthält einen Einmal-Token, und wer ihn
anklickt, wird **als dieser Nutzer angemeldet**. Header und Mailtext also nie
vollständig weitergeben, ohne den Link vorher einzulösen oder zu kürzen.

### Wie man Versand von Zustellung trennt (2026-09-12 durchgespielt)

Als die erste Testmail nicht ankam, liessen sich die Schichten sauber
auseinanderziehen — die Reihenfolge lohnt sich beim nächsten Mal:

1. **Meldung in der App:** „Fast geschafft!" heisst, `updateUser()` kam ohne
   Fehler zurück. Wäre der SMTP-Versand gescheitert, lieferte GoTrue
   `500 Error sending confirmation email`.
2. **Auth-Logs** (Dashboard → Logs → Auth): der `PUT /user` stand auf `200`
   mit **1,47 s Dauer** — diese Sekunde-und-halb *ist* der SMTP-Rundlauf zu
   Google. Ein 200er in wenigen Millisekunden hätte gegen einen Versand
   gesprochen.
3. **Users-Liste ist hier die falsche Quelle:** Der Nutzer steht dort weiter
   mit `email: null` und `is_anonymous: true`. Das ist **kein Fehler** — beim
   Upgrade landet die neue Adresse bis zur Bestätigung in `email_change`, und
   diese Spalte zeigt die Liste nicht. Wer hier „die Mail ist nicht in
   Supabase" liest, sucht am falschen Ende.
4. **Gesendet-Ordner des Gmail-Kontos** — der entscheidende Beleg: Gmail legt
   als SMTP-Relay eine Kopie jeder verschickten Mail dort ab. Lag sie da, ist
   der Versand bewiesen und die Suche verlagert sich auf den Empfänger.

### Bekanntes Zustellproblem: Microsoft (`outlook.de`/`hotmail`/`live`)

Die Mail ging nachweislich raus und kam bei `@outlook.de` nicht im
Posteingang an. Microsoft nimmt solche Mails an und verwirft sie oft still
(oder legt sie in den Junk).
Der Grund steckt in der Abwägung unten: Die Mail kommt formal von
`geoquizsupport@gmail.com`, also von einem frischen Freemail-Absender mit
Bestätigungslink im Body. Outlook.com filtert dieses Muster hart.

**Konsequenz für die Closed-Tester-Runde:** Tester mit Microsoft-Adressen
bekommen die Bestätigungsmail womöglich nie — und sehen in der App eine
Erfolgsmeldung. Entweder vorher ansagen („bitte Gmail-Adresse nutzen") oder
den Sprung auf **Variante C** (eigene Domain mit SPF/DKIM) machen, die genau
dieses Problem löst.

## Realer Serverstand (2026-08-30 abgefragt)

| Einstellung | Wert | Bedeutung |
|---|---|---|
| `anonymous_users` | **true** | Jeder startet als Gast mit echter User-ID |
| `email` | **true** | E-Mail/Passwort aktiv |
| `google` | **true** | OAuth aktiv |
| `github` | **true** | OAuth aktiv |
| `mailer_autoconfirm` | **false** | **Bestätigungsmail ist Pflicht** |
| `disable_signup` | false | Registrierung offen |
| `phone`, `passkeys`, `saml` | false | nicht genutzt |

Nachprüfen (aus `frontend/`, Anon-Key ist öffentlich):

```bash
curl -s "$SUPABASE_URL/auth/v1/settings" -H "apikey: $SUPABASE_ANON_KEY"
```

> STATUS.md führt Phase J (Google/GitHub) als „Setup offen" — **veraltet**,
> beide Provider sind serverseitig aktiv.

## Flows (`src/api/authApi.ts`)

| Flow | Funktion | Besonderheit |
|---|---|---|
| Gast → Konto (E-Mail) | `upgradeToAccount` | `updateUser({email, password})` behält die User-ID, der Fortschritt wandert mit. Läuft technisch als **E-Mail-Änderung** |
| Gast → Konto (OAuth) | `linkProvider` | `linkIdentity` hängt die Identität an die bestehende ID. Braucht „Allow manual linking" im Dashboard |
| Anmeldung 2. Gerät | `signInWithEmail` / `signInWithProvider` | ersetzt die anonyme Sitzung |
| Konto löschen | `deleteOwnAccount` | **Server zuerst, dann lokal.** Bei Serverfehler bleibt lokal alles stehen; danach sofort frische anonyme Sitzung |

OAuth-Rücksprung geht auf `origin + pathname` **ohne** Hash, damit
`detectSessionInUrl` das Token-Fragment liest, bevor der HashRouter greift.

**In der Android-App anders (seit 2026-09-14):** Rücksprung auf
`de.tobsob.geoquizarcade://auth-callback` (Supabase-Redirect-URL eingetragen),
Provider-Seite als Chrome Custom Tab, PKCE statt Implicit Flow, Einlösen per
`appUrlOpen` → `exchangeCodeForSession`. Gibt es schon einen Spieler zum
Google-Konto, zeigt die App eine Meldung und meldet beim **zweiten Tipp** an —
kein automatischer zweiter Sprung wie im Web. Details:
[../../DESIGN-OAUTH-ANDROID.md](../../DESIGN-OAUTH-ANDROID.md).

## Welche Mail die App überhaupt auslöst

Genau **eine**: die Bestätigung beim Gast→Konto-Upgrade. Weil das technisch
eine E-Mail-Änderung ist, greift das Template **„Change Email Address"** —
nicht „Confirm signup". Wer nur das Signup-Template eindeutscht, deutscht die
Mail ein, die praktisch niemand bekommt.

Wegen `mailer_autoconfirm: false` gilt: **ohne funktionierenden Versand kann
sich niemand registrieren.**

## Warum der eingebaute Versand nicht reicht

Supabases eingebauter Mailversand ist Testbetrieb: scharf gedrosselt und auf
Adressen aus dem Projektteam beschränkt. Fremde Tester bekommen die Mail nicht.
Zusätzlich sind beim eingebauten Versand die **Templates gesperrt** — Subject
und Body werden erst mit Custom SMTP editierbar. Daher die Reihenfolge:
SMTP zuerst, Templates danach.

Die App übersetzt `email rate limit exceeded` bereits in „Zu viele Versuche" —
aus Nutzersicht sieht die Drossel also wie ein Bug aus.

## Die drei Absender-Varianten (Abwägung, 2026-08-06 + 2026-08-30)

| Variante | Zustellbarkeit | Aufwand | Urteil |
|---|---|---|---|
| **A — Gmail direkt als SMTP** (`smtp.gmail.com:587`, App-Passwort, 2FA nötig, ~500/Tag) | gut: Mail kommt wirklich von Google, SPF/DKIM stimmen | klein | Bester Start **ohne eigene Domain**. Haken: Google erlaubt in den ToS kein transaktionales Senden über normale Konten — bei Hobby-Volumen praktisch irrelevant, formal ein Graubereich |
| **B — Brevo/Resend mit `@gmail.com` als Absender** (300 Mails/Tag frei) | schwächer: keine DMARC-Ausrichtung für `gmail.com`, seit den Google/Yahoo-Bulk-Regeln von 2024 ein Spam-Ordner-Kandidat. Resend lehnt Freemail ohnehin ab | klein | Reicht, um die Templates freizuschalten und 12 Closed-Tester zu bedienen („schau in den Spam") |
| **C — eigene Domain + Brevo/Resend**, `noreply@…` mit SPF/DKIM | belastbar | ~10 €/Jahr + DNS | Die Antwort für Produktion |

**Diese Abwägung stand bis heute nur in Session-Transkripten**, nicht in einem
Dokument — deshalb liegt sie jetzt hier.

### Gmail direkt als SMTP (Variante A) — Schritt für Schritt

Gewählter Weg für den Start (2026-08-30), weil ohne eigene Domain die einzige
Variante mit sauberer SPF/DKIM-Ausrichtung.

1. **2FA** auf `geoquizsupport@gmail.com` aktivieren (`myaccount.google.com`
   → Sicherheit → Bestätigung in zwei Schritten). Ohne 2FA gibt Google keine
   App-Passwörter heraus — die häufigste Stolperstelle.
2. **App-Passwort** unter `myaccount.google.com/apppasswords` erzeugen
   (Name z. B. `Supabase GEOQUIZ`). 16 Zeichen, in vier Blöcken angezeigt; die
   Leerzeichen sind Darstellung und gehören nicht ins Feld. Wird genau einmal
   gezeigt und ist einzeln widerrufbar, ohne das Google-Passwort zu ändern.
3. **Site-URL zuerst setzen** (siehe unten) — sonst zeigt der
   Bestätigungslink ins Leere, und das merkt man erst, wenn ein Tester klickt.
4. **Supabase → Authentication → Emails → SMTP Settings:**

   | Feld | Wert |
   |---|---|
   | Host | `smtp.gmail.com` |
   | Port | `587` |
   | Username | `geoquizsupport@gmail.com` |
   | Password | das App-Passwort |
   | Sender email | `geoquizsupport@gmail.com` |
   | Sender name | `GEOQUIZ ARCADE` |

   Die Absender**adresse** muss das Konto selbst sein — Gmail schreibt sie
   ohnehin darauf um. Der Absender**name** ist frei.
5. **Rate Limit** unter Authentication → Rate Limits prüfen (siehe unten).
   Googles eigene Grenze (~500 Mails/Tag) ist hier nicht der Engpass.
6. **Templates** eindeutschen, „Change Email Address" zuerst.
7. **E2E prüfen:** Wegwerf-Adresse → Gast spielen → Konto anlegen → Mail
   kommt an → Link klicken → auf zweitem Gerät anmelden.

Der Wechsel auf Variante C später ist ein Feld-Tausch in denselben
SMTP-Settings; die Templates bleiben unangetastet.

### Brevo konkret (falls B oder C)

1. *Senders, Domains & Dedicated IPs → Senders → Add a sender*, Bestätigungs-
   link anklicken.
2. *SMTP & API → SMTP*: Host `smtp-relay.brevo.com`, Port `587`, Login =
   die dort angezeigte Adresse, Passwort = der dort erzeugte SMTP-Key.
3. Supabase → Authentication → Emails → SMTP Settings; Absender exakt
   `GEOQUIZ ARCADE <geoquizsupport@gmail.com>` — weicht die Adresse von der
   verifizierten ab, weist Brevo die Mail ab.
4. Organisation/Company im Brevo-Konto: **„Tobias Sobek"**, passend zum
   [Impressum](../../frontend/public/impressum/index.html). Kein erfundener
   Firmenname, keine Rechtsform, die es nicht gibt.

**Auch mit eigenem SMTP deckelt Supabase den Versand.** Der Standardwert ist
niedrig; für eine Testphase etwas im Bereich 30/Stunde einstellen, sonst läuft
das Limit genau an dem Abend voll, an dem sich alle Tester anmelden.

### Site-URL nicht vergessen

Der Bestätigungslink zeigt auf die in Supabase hinterlegte **Site-URL**. Steht
dort noch `localhost:5173`, ist der Link für jeden echten Nutzer tot.

**Am 2026-09-12 im Dashboard nachgesehen (ROADMAP A4, vorher „ungeprüft"):**
Site URL steht korrekt auf `https://geo-quiz-a6s.pages.dev`. In den
Redirect-URLs stand **nur** `http://localhost:5173`; ergänzt wird
`https://geo-quiz-a6s.pages.dev/**`, weil OAuth und Reset `origin + pathname`
schicken und die Wildcard alle Unterpfade abdeckt.

### Warum beide Mails ins Web zeigen, auch aus der App

| Mail | Ziel des Links |
|---|---|
| Konto-Bestätigung (Gast→Konto) | **kein** `emailRedirectTo` im Code → die Supabase-Site-URL |
| Passwort-Reset | `passwordResetRedirectTo()` → in der App explizit `VITE_PUBLIC_SITE_URL` |

In der App ist `window.location.origin` Capacitors `https://localhost` — darauf
kann kein Mail-Client zeigen. Ablauf für App-Nutzer also: Konto in der App
anlegen → Mail im Browser bestätigen → in der App anmelden. Der Fortschritt
bleibt, weil die User-ID dieselbe ist. **Es gibt keine App-spezifische
Einstellung, die hier nötig wäre.**

## Links in Auth-Mails: eigene Domain + `verifyOtp` (Code seit 2026-09-14)

Die Templates verlinken auf `{{ .SiteURL }}/?token_hash={{ .TokenHash }}&type=…`
statt auf `{{ .ConfirmationURL }}`. Warum und wie:
[DESIGN-MAIL-DOMAIN.md](../../DESIGN-MAIL-DOMAIN.md).

| Phase | Funktion | Wann |
|---|---|---|
| festhalten | `captureEmailLink()` in `main.tsx` | synchron vor dem Render, **nach** `captureRecoveryRedirect()` |
| einlösen | `verifyPendingEmailLink()` am Anfang von `ensureSession()` | einmal, geteilte Promise |
| melden | `EmailLinkNotice` oben im Konto-Bereich | sobald der Status `online` ist |

Im Browser geprüft (2026-09-14, Dev-Server, ungültiger Token): Query ist sofort
aus der URL, genau **ein** `POST /verify` (→ 403), Meldung „Der Link ist
abgelaufen…" erscheint.

**Erfolgsfall live bewiesen (2026-09-14, echte Mail an `@outlook.de`):** Link
in der Mail zeigt auf `https://geoquiz.tobsob.dev/?token_hash=…&type=email_change`,
Klick landet auf `https://geoquiz.tobsob.dev/#/profile` (Token weg), Meldung
„E-Mail bestätigt — dein Account ist jetzt dauerhaft gesichert." Die Meldung
erscheint nur, wenn `verifyOtp` ohne Fehler zurückkam — der Server hat die
Adresse also bestätigt.

**Stolperstelle beim Testen:** Outlook schaltet Links in Junk-Mails ab. Erst
„Kein Junk", dann klicken.

**Stand der Umstellung (2026-09-14):**

| Schritt | Stand |
|---|---|
| Client-Code | ✅ gebaut, Tests 164/164 |
| Custom Domain `geoquiz.tobsob.dev` am Pages-Projekt | ✅ per API angelegt (Wrangler-OAuth-Token hat `pages:write`), CNAME `geoquiz → geo-quiz-a6s.pages.dev` von Hand (Token hat nur `zone:read`); **active** 2026-09-14 |
| Web-Deploy | ✅ `npm run release -- --web-only`, Bundle mit `token_hash`-Code geprüft; Rechtsseiten auf der neuen Domain `200` |
| Redirect-URL `https://geoquiz.tobsob.dev/**`, dann Site-URL | ✅ |
| Templates auf `token_hash` + Absender `geoquiz@` | ✅ in echter Mail belegt |
| Betreff ohne Emoji | ❌ „Change Email Address" trägt in der Mail vom 2026-09-14 **noch** das 🌍 — Subject nicht gespeichert |
| Rundlauf Outlook | ✅ Bestätigung funktioniert; Zustellung weiter **Junk** (`SCL 5`, alles `pass`) → Reputation der zwei Tage alten Domain |
| Rundlauf Gmail | ⬜ |

## Passwort vergessen (seit 2026-08-30)

`requestPasswordReset(email)` im LoginPanel → Mail → Link → Recovery-Panel im
Profil → `setNewPassword(pw)`. Details und Begründung:
[../../DESIGN-PASSWORD-RESET.md](../../DESIGN-PASSWORD-RESET.md).

Drei Dinge, die man wissen muss, bevor man daran etwas ändert:

1. **Der Recovery-Modus wird über zwei Wege erkannt** — den synchron in
   `main.tsx` gesetzten Marker (`captureRecoveryRedirect()`) und das
   `PASSWORD_RECOVERY`-Event. Der HashRouter schreibt den Hash sofort um; ohne
   den Marker wäre `type=recovery` je nach Timing schon weg.
2. **Die Tokens fasst nur supabase-js an.** Der Marker liest ausschließlich
   `type=recovery` — ein zweiter Einlöseversuch würde denselben Einmal-Token
   doppelt verbrauchen.
3. **Aus der Android-App zeigt der Link aufs Web** (`VITE_PUBLIC_SITE_URL`,
   Fallback `https://geoquiz.tobsob.dev`), weil `window.location.origin`
   dort Capacitors `https://localhost` ist. Passwort im Browser neu setzen,
   danach in der App anmelden.

**Noch unbewiesen:** der Rundlauf mit einer echt zugestellten Mail — der geht
erst, wenn der SMTP-Versand steht. Bis dahin ist alles ab „GoTrue schickt die
Mail" ungeprüft.

## Vertiefung

- [../../DESIGN-AUTH.md](../../DESIGN-AUTH.md) — Auth-Entscheidungen, OAuth-Umbau
- [../../DESIGN-PASSWORD-RESET.md](../../DESIGN-PASSWORD-RESET.md) — Reset-Flow im Detail
- [../../supabase/email-templates.md](../../supabase/email-templates.md) — die drei deutschen Vorlagen + Setup
- [../../DESIGN-PLAYSTORE.md](../../DESIGN-PLAYSTORE.md) §1 — Konto-Löschung
