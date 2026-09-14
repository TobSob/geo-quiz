# DESIGN — Mails und Web über die eigene Domain (`tobsob.dev`)

> Stand: 2026-09-14 · Auslöser: Bestätigungsmail landet bei Outlook im Junk,
> obwohl SPF, DKIM und DMARC bestehen · Ist-Stand: [docs/wiki/auth-und-email.md](docs/wiki/auth-und-email.md)

## 1. Befund

Erste Resend-Mail an `@outlook.de` (2026-09-13), Header ausgewertet:

- `spf=pass`, `dkim=pass header.d=mail.tobsob.dev`, `dmarc=pass`, `compauth=pass`
- trotzdem `SCL: 5`, `dest:J` → Junk

Die Authentifizierung ist also nicht das Problem. Übrig bleiben Reputation und
Inhalt. Reputation (Domain am selben Tag registriert) lässt sich nur aussitzen.
Beim Inhalt fällt ein Punkt deutlich heraus:

| In der Mail | Domain |
|---|---|
| Absender | `mail.tobsob.dev` |
| Button-Link | `dpueqnhhwcdbhihiudyg.supabase.co/auth/v1/verify?token=…` |
| Rücksprung darin | `geo-quiz-a6s.pages.dev` |

„Bestätige dein Konto" plus Link auf eine kryptische fremde Domain ist das
Muster einer Phishing-Mail. Das ist die größte Stellschraube, die wir selbst
in der Hand haben.

## 2. Entscheidung

1. **Web zusätzlich unter `https://geoquiz.tobsob.dev`** (Custom Domain am
   bestehenden Pages-Projekt). `pages.dev` bleibt erreichbar, damit alte Links
   und Store-Einträge nicht sterben.
2. **Supabase-Site-URL auf `https://geoquiz.tobsob.dev`.**
3. **Mail-Templates verlinken auf die eigene Domain** statt auf den
   GoTrue-Verify-Endpunkt:

   ```
   {{ .SiteURL }}/?token_hash={{ .TokenHash }}&type=email_change
   ```

   Die App löst den Token selbst über `supabase.auth.verifyOtp({ token_hash, type })` ein.
4. **Kleinkram im Dashboard:** Emoji raus aus den Betreffzeilen, Absender
   `geoquiz@mail.tobsob.dev` statt `noreply@`.

### Verworfen: Supabase Custom Domain (`auth.tobsob.dev`)

Hätte den Verify-Link ohne Code-Änderung auf die eigene Domain gebracht, ist
aber ein kostenpflichtiges Add-on auf einem bezahlten Plan. Dauerkosten für ein
Problem, das ein Template plus ~50 Zeilen Client-Code lösen.

## 3. Nebeneffekt, der allein schon für den Umbau spräche

Microsoft Defender und Outlook-„Safe Links" rufen Links in eingehenden Mails
**vorab** auf, um sie zu prüfen. Beim alten Link ist schon dieser GET das
Einlösen: Der Scanner verbraucht den Einmal-Token, und der Mensch bekommt
danach „Link abgelaufen". Der neue Link ist eine normale Seite; eingelöst wird
erst per JavaScript im Browser, und Scanner führen das nicht aus.

## 4. Umsetzung im Client

**Reihenfolge-Problem wie beim Recovery-Marker:** Der HashRouter schreibt die
URL gleich nach dem Start um. Deshalb zwei Phasen:

| Phase | Wo | Was |
|---|---|---|
| synchron, vor dem ersten Render | `main.tsx` → `captureEmailLink()` | `?token_hash=…&type=…` lesen, **nur im Speicher** halten, Query per `replaceState` entfernen und auf `#/profile` stellen |
| asynchron, beim Sitzungsaufbau | `ensureSession()` | vor `getSession()` einmal `verifyOtp` — sonst legt die App erst einen neuen Gast an und überschreibt ihn Sekunden später |

Details, die man beim Ändern wissen muss:

- **Nur im Speicher, nicht in `sessionStorage`:** Ein Reload soll den Token
  nicht ein zweites Mal einlösen — der zweite Versuch scheitert sicher und
  zeigt dann „abgelaufen", obwohl gerade alles geklappt hat.
- **Token sofort aus der Adressleiste:** Wer einen Screenshot macht oder die
  URL teilt, gibt sonst eine Anmeldung weiter.
- **Geteilte Promise:** `ensureSession()` wird von mehreren Stellen parallel
  aufgerufen. Eingelöst wird genau einmal.
- **Recovery braucht nichts Neues:** `captureRecoveryRedirect()` prüft Hash
  *und* Query auf `type=recovery` und läuft vor dem Entfernen der Query;
  `verifyOtp` mit `type: 'recovery'` feuert `PASSWORD_RECOVERY`
  (auth-js 2.110.2, `GoTrueClient.verifyOtp`). Beide Wege des
  Recovery-Panels greifen also weiter.
- **Alte Links bleiben gültig:** Schon verschickte Mails mit dem
  Implicit-Flow-Link löst weiter `detectSessionInUrl` ein.
- **Rückmeldung:** einmalige Meldung oben im Konto-Bereich, Erfolg wie Fehler.
  Nicht über den OAuth-Meldungs-Slot — der steht nur im Login-Panel für Gäste
  und wäre nach einer erfolgreichen Bestätigung unsichtbar.
- **Android:** unverändert. Links aus Mails öffnen im Browser, nie in der App;
  `VITE_PUBLIC_SITE_URL` zeigt jetzt auf die neue Domain.

## 5. Reihenfolge der Umstellung

Falsch herum ausgerollt, zeigen Mails auf Code, der noch nicht live ist:

1. Custom Domain `geoquiz.tobsob.dev` am Pages-Projekt anlegen
2. Web deployen (`npm run release -- --web-only`)
3. Redirect-URL `https://geoquiz.tobsob.dev/**` ergänzen, **dann** Site-URL umstellen
4. Templates auf `token_hash`-Links umstellen
5. Rundlauf an Outlook **und** Gmail

## 6. Offen gelassen

- Rechtsseiten und Store-Listing zeigen auf die neue Domain; `pages.dev`
  leitet (noch) nicht um. Eine Umleitung wäre ein eigener Schritt.
- Reputation: Auch mit sauberem Inhalt kann eine frische Domain bei Microsoft
  noch Wochen im Junk landen. Das ist mit diesem Umbau nicht erledigt, nur
  verkürzt.

## 7. Nachtrag 2026-09-14: Resend in der Datenschutzerklärung

Seit dem Umstieg (2026-09-13) laufen die E-Mail-Adressen der Nutzer über
Resend. Die Datenschutzerklärung nannte in §5 aber nur Supabase und
Cloudflare. Das Data-Safety-Formular muss zur Erklärung passen, deshalb vor
dem Eintrag in der Play Console nachgezogen.

Geändert in `frontend/public/datenschutz/index.html`:

| Stelle | Änderung |
|---|---|
| Stand | 3. August → **14. September 2026**. Der alte Stand war schon vor Resend veraltet: OpenFreeMap kam am 2026-08-29 dazu, ohne dass das Datum mitzog |
| §3, Zeile E-Mail-Adresse | Zweck um Bestätigungs- und Passwort-Mail ergänzt; Rechtsgrundlage bleibt Art. 6 Abs. 1 lit. b (Vertragserfüllung) |
| §5 | Resend als dritter Auftragsverarbeiter: welche Daten (Adresse, Mailinhalt, Zeitpunkt, Zustellstatus), Versandregion EU (Irland), ausdrücklich keine Werbemails |

**Bewusst nicht aufgenommen:**

- **Firmenname und Sitz von Resend.** Nicht aus einer Primärquelle geprüft,
  eine falsche Angabe im Rechtstext wiegt schwerer als eine fehlende. Der
  bestehende Satz zu Standardvertragsklauseln deckt die Drittlands-Frage ab.
- **Gmail (2026-08-30 bis 2026-09-13).** In dem Zeitraum gingen nur Testmails
  an eigene Adressen, keine Mails an fremde Nutzer.
- **Amazon SES** (Resends Unterauftragsverarbeiter, im Mail-Header sichtbar).
  Unterauftragsverarbeiter führt der Hauptauftragsverarbeiter, nicht wir.

**DPA mit Resend: besteht (geprüft 2026-09-14).** Resends Data Processing
Addendum (Stand 27. August 2026, https://resend.com/legal/dpa) ist Teil der
Nutzungsbedingungen:

- Präambel: geschlossen zwischen *Plus Five Five, Inc.* und dem Kunden „as of
  the effective date … of the applicable customer's acceptance of the Terms of
  Service"; bindend „upon Customer entering into the Agreement".
- Die Unterschriftsfelder sind „for reference purposes only"; die ausgeführte
  Fassung ist im Resend-Dashboard abrufbar.
- 6.3.9: Mit dem DPA gelten die EU-SCC als unterzeichnet. Zusätzlich
  Verpflichtung auf das EU-US Data Privacy Framework.

Kein separater Abschluss nötig. Kopie der Seite als Nachweis (Art. 28 DSGVO):
`docs/nachweise/resend-dpa-stand-2026-08-27.htm` und `.pdf` (Druckfassung, 121 Seiten inkl. SCC-Anhängen) — **gitignored**, weil das
Repo öffentlich ist; liegt also nur lokal.

**Data Safety:** unverändert „geteilt: nein". Weitergabe an Dienstleister,
die im Auftrag verarbeiten, zählt bei Google nicht als Teilen.

