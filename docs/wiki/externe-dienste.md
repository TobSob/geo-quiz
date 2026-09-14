# Externe Dienste — realer Konfigstand

> **Stand:** 2026-09-13 · **Verifiziert:** `curl` gegen die Live-URLs,
> `GET /auth/v1/settings`, Repo-Dateien, Dashboard-Durchgang 2026-09-12. Was nicht prüfbar war, steht als
> „ungeprüft" da.

| Dienst | Wofür | Stand |
|---|---|---|
| **Supabase** `dpueqnhhwcdbhihiudyg` (eu-north-1) | Postgres, Auth, RLS, RPCs | aktiv; Migrationen bis **0017** live. Anon + E-Mail + Google + GitHub aktiviert, `mailer_autoconfirm: false` |
| **Cloudflare Pages** `geo-quiz` | Web-Hosting, Direct Upload via Wrangler | live: https://geo-quiz-a6s.pages.dev; Custom Domain **`geoquiz.tobsob.dev`** geplant als Hauptadresse ([DESIGN-MAIL-DOMAIN.md](../../DESIGN-MAIL-DOMAIN.md)), Stand 2026-09-14 **noch nicht angelegt** — `git push` deployt **nicht** |
| **OpenFreeMap** | Vektorkacheln für die Pin-Karte | in Benutzung; Style liegt **lokal** im Bundle. Die IP der Spieler geht dorthin → steht so in der Datenschutzerklärung |
| **Wikipedia / Wikimedia Commons** | Landmark-Fotos + Nachweise | nur zur **Bauzeit** über `fetch-landmark-images.mjs`; zur Laufzeit wird nichts geladen |
| **Google Play Console** | Store-Vertrieb | Developer-Konto besteht (2026-08-03). **App noch nicht angelegt** — siehe [offene-punkte.md](offene-punkte.md) |
| **SMTP-Provider** | Bestätigungsmails | **Resend** (`smtp.resend.com:465`, Absender `mail.tobsob.dev`, Region eu-west-1) seit 2026-09-13. Vorher Gmail: Versand ging, Microsoft verwarf die Mails. Mit Resend: SPF/DKIM/DMARC `pass`, bei Outlook aber noch Junk, siehe [auth-und-email.md](auth-und-email.md) |
| **Domain `tobsob.dev`** | Dach-Domain für alle Projekte, Mailversand, später Web-Adresse | gekauft **2026-09-13** bei Cloudflare Registrar (DNS ebenfalls Cloudflare). Name passend zur App-ID `de.tobsob.geoquizarcade`; `sobek.dev` war vergeben. `.dev` erzwingt HTTPS (HSTS-Preload der TLD) |
| **Google Fonts** | — | **nicht** zur Laufzeit: Press Start 2P und VT323 liegen als `.woff2` im Bundle (nachgemessen: null Treffer auf `fonts.googleapis` im Build) |

## Live-Prüfung der Rechtsseiten (2026-08-30)

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://geo-quiz-a6s.pages.dev/datenschutz/
```

`/datenschutz/` · `/konto-loeschen/` · `/impressum/` → alle **200**, und die
Datenschutzerklärung nennt bereits OpenFreeMap (also nach dem Basemap-Wechsel
aktualisiert).

## Zugangsdaten — wo sie liegen

| Was | Wo | Nie |
|---|---|---|
| `VITE_SUPABASE_URL` / `_ANON_KEY` | `frontend/.env.local` (gitignored) | Anon-Key ist öffentlich, das ist so vorgesehen |
| Keystore-Passwörter | `frontend/android/keystore.properties` (gitignored) | nicht ins Repo, nicht in den Chat |
| SMTP-Key | nur im Supabase-Dashboard | nicht in den Chat |
| Supabase Service-Role-Key | wird nicht verwendet | niemals in den Client |
