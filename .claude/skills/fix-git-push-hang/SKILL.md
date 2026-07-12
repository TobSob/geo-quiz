---
name: fix-git-push-hang
description: Diagnoses and fixes a `git push`/`pull`/`fetch` over https that hangs indefinitely on Windows with zero output (not even "Enumerating objects"). Use this whenever a git network command in an automated/non-interactive session (Claude Code, CI, scripts) appears stuck for more than ~20-30 seconds with no output at all — that's the signature of the Windows Git Credential Manager (GCM) waiting on an interactive browser/GUI auth prompt that nothing in the session can click through. Do not confuse this with a genuinely slow push (large files, slow network) — genuine slowness still prints progress lines like "Enumerating objects" or "Writing objects" quickly; a GCM hang prints nothing at all.
---

# Fix a hanging `git push` on Windows (GCM auth popup)

## Why this happens

Windows' default git credential helper is `manager` (Git Credential Manager).
When it needs to (re-)authenticate, it can pop up an interactive browser/GUI
prompt. In an automated or non-interactive shell — like a Claude Code
session — there's no one to click through that prompt, so the git process
just hangs forever. No error, no progress output, nothing: the command is
blocked before it even reaches the network layer.

## Recognize it

- `git push` (or `pull`/`fetch`) produces **no output whatsoever**, not even
  the usual first lines like `Enumerating objects` or `Writing objects`.
- It's been stuck well past what the repo size / connection would justify.

If you see actual progress output that's just slow, this isn't GCM — don't
apply this fix, just let it run or investigate bandwidth/repo size instead.

## Fix it

1. **Confirm the cause** — check the configured credential helper:
   ```
   git config --get-all credential.helper
   ```
   `manager` confirms it. Then find the stuck process:
   ```
   powershell -Command "Get-Process | Where-Object { $_.ProcessName -match 'git|GitHub|WebAuth' } | Select-Object ProcessName,Id"
   ```
   A `git-credential-manager` process sitting alongside `git-remote-https`
   (or a live `git push`) is the stuck one.

2. **Kill the stuck processes** so the blocked git command actually exits:
   ```
   powershell -Command "Stop-Process -Id <id1>,<id2>,... -Force -ErrorAction SilentlyContinue"
   ```

3. **Switch to a non-interactive credential source.** If GitHub CLI is
   already authenticated (`gh auth status` shows logged in), point git at it
   instead of the interactive manager:
   ```
   gh auth setup-git
   ```
   If `gh` isn't on PATH yet in this shell (common right after a fresh
   install — see the "gh installed but not found" case below), call it by
   full path: `"/c/Program Files/GitHub CLI/gh.exe" auth setup-git`.

   This sets a **per-host override**
   (`credential.https://github.com.helper`) that wins over the global
   `manager` helper for github.com specifically, and authenticates using
   `gh`'s already-stored token — no popup, no prompt.

   If `gh` isn't authenticated either, that's the real blocker: tell the
   user to run `gh auth login` themselves (it needs an interactive
   browser/device-code flow you can't complete on their behalf).

4. **Retry the git command.** It should now complete immediately.

## Related: `gh` installed but "command not found"

If `gh --version` fails right after installing it via winget, it's very
likely already on the *system* PATH (check with
`[Environment]::GetEnvironmentVariable("Path","Machine") -split ";"` in
PowerShell) but the current shell process was spawned before that PATH
update and hasn't picked it up. A new terminal tab isn't enough if the host
app (e.g. Claude Code) itself was already running when `gh` was installed —
its environment was frozen at launch. Fully quit and restart the host
app (not just open a new session/tab inside it); if that still doesn't
work, log off/on or reboot. In the meantime, call `gh` by its full path
(`"C:\Program Files\GitHub CLI\gh.exe"`) rather than waiting.
