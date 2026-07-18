# 🔐 Design-Notizen — Social Login (Google/GitHub)

> Arbeitsdokument, Stil wie [DESIGN-ARCADE.md](DESIGN-ARCADE.md). Design-Chat
> 2026-07-18. Läuft als **Phase J** in der [ROADMAP.md](ROADMAP.md).

Legende: ✅ entschieden · 💬 in Diskussion · ⬜ noch nicht besprochen

---

## Ausgangslage (steht fest)

Heutiger Auth-Flow ([authApi.ts](frontend/src/api/authApi.ts)) ist anonym-first:

1. `ensureSession()` meldet jeden Erstbesuch anonym an (`signInAnonymously`) und legt eine `profiles`-Zeile mit generiertem Retro-Namen an.
2. „Gast → Account": `upgradeToAccount(email, password)` ruft `supabase.auth.updateUser({email, password})` — **behält dieselbe User-ID**, Fortschritt bleibt erhalten, nur eine E-Mail-Bestätigung ist nötig.
3. „Login auf Zweitgerät": `signInWithEmail(email, password)` via `signInWithPassword`.

Kein OAuth-Code vorhanden (Repo-weiter Grep bestätigt: kein `signInWithOAuth`/`linkIdentity`/`oauth`). `@supabase/supabase-js` ist bereits auf `^2.110.2` — unterstützt beide benötigten Methoden ohne Client-Umbau.

---

## Grundkonzept (steht fest)

SSO ergänzt den bestehenden Flow, ersetzt ihn nicht — E-Mail/Passwort bleibt bestehen (SSO braucht Dashboard-Setup + ein Google/GitHub-Konto, nicht jeder Spieler hat/will das).

| Baustein | Entscheidung | Status |
|---|---|---|
| Provider | Google + GitHub | ✅ |
| EIN Button statt getrennter Pfade (Nutzer-Entscheid 2026-07-18, R2) | `continueWithProvider(provider)` versucht immer zuerst `linkIdentity` (Fortschritt bleibt erhalten, falls die Identität neu ist). Gehört sie schon einem ANDEREN Account, fällt `resolveOAuthRedirectError()` nach dem Rücksprung automatisch auf einen normalen `signInWithOAuth`-Login zurück — vom Umweg merkt der Nutzer nichts außer einem zweiten kurzen Redirect | ✅ |
| Anzeigename | **Nicht** den echten Google/GitHub-Namen übernehmen — weiter `generateRetroName()` wie bei jedem neuen Profil. Begründung: pseudonymes Bestenlisten-Konzept, keine echten Namen auf öffentlichen Ranglisten | ✅ |
| UI-Ort/-Struktur (Nutzer-Entscheid 2026-07-18, R2: Panels getauscht) | „Anmelden" ist jetzt die **Standard-Ansicht** für Gäste — Google/GitHub-Icon-Buttons oben (decken Neu- und Bestandskonto gleichzeitig ab), E-Mail/Passwort-Login darunter. „Account registrieren" (reines E-Mail/Passwort, **ohne** Google/GitHub — SSO hat keinen separaten Registrieren-Schritt) ist dahinter aufklappbar, vorher war es umgekehrt | ✅ |

---

## Technik-Punkte

| # | Punkt | Entscheidung/Stand | Status |
|---|---|---|---|
| S1 | Supabase-Dashboard-Konfiguration (manuell, wie Roadmap A4) | Google-OAuth-Client (Google Cloud Console) + GitHub-OAuth-App anlegen, Redirect-URI `https://<projekt>.supabase.co/auth/v1/callback` bei beiden Providern eintragen, Provider im Supabase-Dashboard (Authentication → Providers) aktivieren mit Client-ID/Secret. **Zusätzlich: „Allow manual linking" einschalten** (Authentication → Settings) — sonst schlägt `linkIdentity` (Gast-Upgrade) mit „manual linking is disabled" fehl | ⬜ |
| S2 | Site-URL/Redirect-URLs | Fällt mit Roadmap A4 zusammen (`https://geo-quiz-a6s.pages.dev` + `http://localhost:5173` als Redirect-URLs, Site-URL auf die Live-Domain) — wichtig auch für den Fehlerfall: bei nicht konfiguriertem Provider leitet Supabase auf die **Site-URL** um | ⬜ |
| S3 | HashRouter-Risiko | App nutzt `HashRouter`. `oauthRedirectTo()` zielt auf `origin + pathname` (App-Root ohne Hash). **Verifiziert (R2):** `resolveOAuthRedirectError()` läuft synchron in `main.tsx` VOR dem ersten Render, räumt Fehler-Redirects (`error_code=…` in Hash ODER Query) auf, bevor der HashRouter sie als ungültigen Pfad fehlinterpretiert; ein Catch-all `<Route path="*">` in `App.tsx` fängt zusätzlich den kurzen Moment ab, bevor supabase-js einen Erfolgs-Redirect (`#access_token=…`) selbst aus der URL entfernt | ✅ |
| S4 | `authApi.ts`-Erweiterung | Umgesetzt: `signInWithProvider`/`linkProvider` als Bausteine, `continueWithProvider(provider)` (öffentliche API — merkt den Provider in `sessionStorage`, ruft `linkProvider`), `resolveOAuthRedirectError()` (Fallback-Auslöser), `consumePendingOAuthMessage()`, `oauthRedirectTo()`-Helper, neue Fehlertexte | ✅ |
| S5 | Migration | Keine — reine Auth-Konfiguration + Client-Code, `ensureSession()` funktioniert unverändert (läuft bereits generisch über `sessionData.session.user`, egal welcher Provider die Session erzeugt hat) | ✅ |
| S6 | UI | Umgesetzt (R2, Panels getauscht): `OAuthButtons` (ein Button je Provider, `GoogleIcon`/`GithubIcon` als offizielle SVGs) sitzt jetzt oben im standardmäßig offenen `LoginPanel`; `RegisterPanel` (vormals `UpgradePanel`) hat keine OAuth-Buttons mehr und ist hinter `RegisterToggle` versteckt | ✅ |
| S7 | Parsing testbar halten | `parseOAuthRedirectError()` liegt bewusst in einem eigenen Modul ohne Supabase-Import (`features/auth/oauthRedirect.ts`) — ein Test, der direkt `authApi.ts` importiert hätte, hätte den echten Supabase-Client konstruiert und in Node eine unhandled rejection ausgelöst (Capacitor-`Preferences`-Plugin braucht `window`) | ✅ |

### Bekannte Grenzen (bewusst so gelassen)

- **Android/Capacitor**: Der OAuth-Redirect-Flow funktioniert so nur im Web — die Android-App (Phase B) bräuchte Deep-Links/Custom-Scheme. Buttons erscheinen dort zwar, der Rücksprung landet aber im Web. Bei Bedarf als eigener Schritt nachziehen.
- **Fallback-Fehlschlag**: Scheitert auch der automatische Zweit-Redirect nach einem `identity_already_exists`-Konflikt (selten), landet die Fehlermeldung über `consumePendingOAuthMessage()` im `LoginPanel` — es gibt aber keinen dritten Versuch.

---

## Umsetzungsreihenfolge

1. **Manuell (blockiert alles andere):** Google-Cloud-OAuth-Client + GitHub-OAuth-App anlegen, in Supabase-Dashboard eintragen (S1/S2).
2. `authApi.ts`: `signInWithProvider`/`linkProvider` (S4).
3. UI-Buttons in `ProfileScreen.tsx` (`UpgradePanel`/`LoginPanel`).
4. Redirect-Roundtrip im Browser verifizieren (S3) — Live-Domain und `localhost:5173`.

---

## Offene Punkte

- Muss der Nutzer nach OAuth-Login noch seinen Retro-Namen bestätigen/anpassen können, oder läuft das automatisch wie heute?
- Soll GitHub/Google-Login auch für Anti-Cheat/Klarnamen-Zwecke Rückschlüsse zulassen (z. B. E-Mail-Verifizierung überspringen, weil OAuth-Provider das schon getan hat)? Vermutlich ja — OAuth-E-Mails gelten als verifiziert, das spart sogar einen Schritt gegenüber Passwort-Signup.

---

## Verlauf

| Datum | Eintrag |
|---|---|
| 2026-07-18 | J1 vom Nutzer eingerichtet (Google-Cloud-OAuth-Client + GitHub-OAuth-App, Provider in Supabase aktiviert). Erster Live-Test deckte einen echten Bug auf: „Konto-Verknüpfung ist serverseitig deaktiviert" beim Registrieren-Pfad — „Allow manual linking" fehlte noch im Dashboard. Im selben Zug (Nutzer-Wunsch, Runde 2) Panels umgebaut: **Anmelden ist jetzt Standard** (Google/GitHub-Icons oben, deckt Neu- und Bestandskonto gleichzeitig ab), **Registrieren aufklappbar und ohne OAuth**. Dafür `continueWithProvider()` (immer erst linkIdentity, bei `identity_already_exists` automatischer Fallback auf normalen Login via `resolveOAuthRedirectError()` in `main.tsx`, vor dem ersten Render). Catch-all-Route in `App.tsx` gegen HashRouter-Blankscreen bei Token-Redirects. Neuer Test `oauthRedirect.test.ts` (reines Parsing-Modul, kein Supabase-Import). Tests 113/113, tsc/lint/Build grün, Browser-verifiziert (Panel-Tausch, Icons, Registrieren ohne OAuth) |
| 2026-07-18 | J2+J3 umgesetzt (Code komplett): `signInWithProvider`/`linkProvider` + OAuth-Fehlertexte in `authApi.ts`, `OAuthButtons` in Upgrade- und Login-Panel. Browser-verifiziert (Gast-Sicht): beide Panels zeigen „Mit Google"/„Mit GitHub", Konsole sauber; Tests/tsc/lint/Build grün. **Offen: J1 (Dashboard-Setup durch den Nutzer, inkl. „Allow manual linking") und J4 (Redirect-Roundtrip-Test)** — bis dahin liefern die Buttons eine deutsche Fehlermeldung bzw. laufen auf die Site-URL |
| 2026-07-18 | Dokument angelegt, Design-Chat: SSO ergänzt (nicht ersetzt) den bestehenden anonym-first-Flow, `linkIdentity` fürs Gast-Upgrade, `signInWithOAuth` fürs Zweitgerät-Login, Retro-Name bleibt statt echtem OAuth-Namen. Dashboard-Setup als blockierender erster Schritt identifiziert, HashRouter-Redirect als einziges echtes technisches Risiko markiert. Als Phase J in die Roadmap übernommen |
