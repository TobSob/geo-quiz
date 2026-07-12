# 📧 Deutsche E-Mail-Templates für Supabase Auth

Supabase verschickt ab Werk englische Standard-Mails („Confirm your new email
address …"). Diese Vorlagen eindeutschen die relevanten Templates im
GeoQuiz-Ton.

> **Voraussetzung (Stand 2026-07, im Dashboard verifiziert): Custom SMTP.**
> Beim eingebauten Supabase-Mailversand sind die Templates gesperrt
> („Emails will be sent using the default templates") — erst mit
> eingerichtetem Custom SMTP werden Subject/Body editierbar.
>
> **Setup-Reihenfolge:**
> 1. Mail-Anbieter mit Free-Tier: **Brevo** (300 Mails/Tag, einzelne
>    Absenderadresse verifizierbar, keine eigene Domain nötig) oder Resend
>    (braucht eigene Domain). Absenderadresse verifizieren, SMTP-Zugangsdaten
>    holen (Brevo: Host `smtp-relay.brevo.com`, Port 587, Login + Key).
> 2. Supabase → Authentication → Emails → **SMTP Settings**: Host/Port/User/
>    Passwort + Absender (z. B. `GeoQuiz <adresse>`) eintragen, speichern.
> 3. Dann → Tab **Templates**: jeweiliges Template öffnen, Subject + Body
>    (HTML) mit den Vorlagen unten ersetzen, Save.
>    https://supabase.com/dashboard/project/dpueqnhhwcdbhihiudyg/auth/templates
>
> Nebeneffekte von Custom SMTP: kein „powered by Supabase"-Footer mehr,
> eigener Absendername, keine Drossel des eingebauten Versands.

---

## 1. „Change Email Address" — wichtigste Vorlage!

Das Account-Upgrade (Gast → registriert) läuft technisch als E-Mail-Änderung,
darum bekommen neue Spieler DIESE Mail.

**Subject:**

```
🌍 GeoQuiz: Bestätige deine E-Mail-Adresse
```

**Body (HTML):**

```html
<div style="font-family: 'Courier New', monospace; background: #1a1a2e; color: #e8e8e8; padding: 32px 24px; border: 4px solid #0a0a14;">
  <h2 style="color: #00e756; margin: 0 0 4px;">GEO<span style="color: #29adff;">QUIZ</span></h2>
  <p style="color: #ffec27; font-weight: bold; margin: 0 0 20px;">&#9654; ACCOUNT SICHERN</p>
  <p>Fast geschafft! Best&auml;tige <strong style="color: #29adff;">{{ .NewEmail }}</strong> als deine E-Mail-Adresse, dann ist dein Spielstand dauerhaft gesichert und du kannst dich auf jedem Ger&auml;t anmelden.</p>
  <p style="margin: 28px 0;">
    <a href="{{ .ConfirmationURL }}" style="background: #00e756; color: #1a1a2e; padding: 14px 22px; text-decoration: none; font-weight: bold; border: 3px solid #0a0a14;">&#9654;&nbsp;E-MAIL BEST&Auml;TIGEN</a>
  </p>
  <p style="color: #8a8a9e; font-size: 13px;">Du hast das nicht angefordert? Dann kannst du diese Mail einfach ignorieren &mdash; es passiert nichts.</p>
</div>
```

## 2. „Confirm signup"

Greift bei Direkt-Registrierungen (falls künftig jemand ohne Gast-Phase
einen Account anlegt).

**Subject:**

```
🌍 GeoQuiz: Bestätige deine Registrierung
```

**Body (HTML):**

```html
<div style="font-family: 'Courier New', monospace; background: #1a1a2e; color: #e8e8e8; padding: 32px 24px; border: 4px solid #0a0a14;">
  <h2 style="color: #00e756; margin: 0 0 4px;">GEO<span style="color: #29adff;">QUIZ</span></h2>
  <p style="color: #ffec27; font-weight: bold; margin: 0 0 20px;">&#9654; PLAYER REGISTRIERT</p>
  <p>Willkommen! Ein Klick, und dein Account ist startklar:</p>
  <p style="margin: 28px 0;">
    <a href="{{ .ConfirmationURL }}" style="background: #00e756; color: #1a1a2e; padding: 14px 22px; text-decoration: none; font-weight: bold; border: 3px solid #0a0a14;">&#9654;&nbsp;REGISTRIERUNG BEST&Auml;TIGEN</a>
  </p>
  <p style="color: #8a8a9e; font-size: 13px;">Du hast dich nicht bei GeoQuiz registriert? Dann ignoriere diese Mail einfach.</p>
</div>
```

## 3. „Reset Password"

Noch keine UI dafür im Spiel — aber falls die Mail je ausgelöst wird, soll
sie nicht englisch sein.

**Subject:**

```
🌍 GeoQuiz: Passwort zurücksetzen
```

**Body (HTML):**

```html
<div style="font-family: 'Courier New', monospace; background: #1a1a2e; color: #e8e8e8; padding: 32px 24px; border: 4px solid #0a0a14;">
  <h2 style="color: #00e756; margin: 0 0 4px;">GEO<span style="color: #29adff;">QUIZ</span></h2>
  <p style="color: #ffec27; font-weight: bold; margin: 0 0 20px;">&#9654; CONTINUE?</p>
  <p>Du willst dein Passwort zur&uuml;cksetzen? Hier entlang:</p>
  <p style="margin: 28px 0;">
    <a href="{{ .ConfirmationURL }}" style="background: #29adff; color: #1a1a2e; padding: 14px 22px; text-decoration: none; font-weight: bold; border: 3px solid #0a0a14;">&#9654;&nbsp;NEUES PASSWORT SETZEN</a>
  </p>
  <p style="color: #8a8a9e; font-size: 13px;">Falls du das nicht warst: Mail ignorieren, dein Passwort bleibt unver&auml;ndert.</p>
</div>
```

---

## Zusätzlich prüfen (gleiche Ecke im Dashboard)

- **Site URL / Redirect URLs** (Authentication → URL Configuration): Der
  Bestätigungslink leitet dorthin weiter. Für lokales Testen `http://localhost:5173`,
  nach dem Web-Deployment (Phase A4) die echte Domain eintragen.
- Der Absendername ist beim eingebauten Versand fix — auch das ändert sich
  erst mit Custom SMTP (dann z. B. „GeoQuiz <mail@deinedomain.de>").
