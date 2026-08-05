// Ein Release-Lauf für beide Zielplattformen (ROADMAP Phase A + B).
//
// `npm run deploy` deckte bisher nur das Web ab — die Android-App musste man
// von Hand hinterherbauen (cap sync + gradlew) und vergaß es entsprechend.
// Dieses Skript macht beides aus einer Quelle: EIN Vite-Build wandert sowohl
// zu Cloudflare Pages als auch (via Capacitor) in die APK/AAB. So können Web
// und App nicht mehr auseinanderlaufen.
//
//   npm run release              Checks + Web-Deploy + signierte APK/AAB
//   npm run release:web          nur Cloudflare Pages
//   npm run release:android      nur die App (kein Upload)
//
// Flags (auch kombinierbar, nach `--` anhängen):
//   --skip-checks   Tests + Lint überspringen (nur für Notfall-Redeploys)
//   --no-deploy     alles bauen, aber nichts hochladen (Trockenlauf)
//   --debug-apk     zusätzlich die Debug-APK bauen (fürs schnelle Aufspielen)
//   --no-bump       versionCode NICHT hochzählen (sonst Standard, siehe unten)
//
// Voraussetzungen für den Android-Teil: JAVA_HOME + ANDROID_HOME gesetzt
// (siehe ROADMAP B1) und `android/keystore.properties` für die Signierung —
// fehlt sie, baut Gradle unsigniert weiter und das Skript sagt es deutlich.

import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ANDROID = join(ROOT, 'android')
const OUT_DIR = join(ROOT, 'release')
const IS_WIN = process.platform === 'win32'

const args = process.argv.slice(2)
const has = (flag) => args.includes(flag)

const webOnly = has('--web-only')
const androidOnly = has('--android-only')
const doWeb = !androidOnly
const doAndroid = !webOnly
const doUpload = doWeb && !has('--no-deploy')
const doChecks = !has('--skip-checks')

// ---- Ausgabe ---------------------------------------------------------------

const step = (n, total, text) => console.log(`\n[${n}/${total}] ${text}`)
const info = (text) => console.log(`      ${text}`)
const warn = (text) => console.warn(`  !   ${text}`)

function fail(text) {
  console.error(`\n  ✖ ${text}\n`)
  process.exit(1)
}

const quote = (s) => (/\s/.test(s) ? `"${s}"` : s)

/**
 * Alles läuft über die Shell — npm/npx/gradlew sind auf Windows Batch-Dateien,
 * die Node seit CVE-2024-27980 nicht mehr direkt startet. Deshalb eine
 * Kommandozeile statt Argument-Array (sonst DEP0190); alle Argumente stehen
 * hier fest im Skript, es kommt nichts von außen hinein.
 */
function commandLine(cmd, cmdArgs) {
  return [quote(cmd), ...cmdArgs].join(' ')
}

/** Führt ein Kommando aus und bricht bei Fehler den ganzen Lauf ab. */
function run(cmd, cmdArgs, cwd = ROOT) {
  const line = commandLine(cmd, cmdArgs)
  info(`$ ${line}`)
  const res = spawnSync(line, { cwd, stdio: 'inherit', shell: true })
  if (res.error) fail(`${cmd} nicht ausführbar: ${res.error.message}`)
  if (res.status !== 0) fail(`${line} → Exit-Code ${res.status}`)
}

/** Wie `run`, aber der Ausgang ist egal (z. B. optionale Signatur-Prüfung). */
function tryRun(cmd, cmdArgs, cwd = ROOT) {
  const res = spawnSync(commandLine(cmd, cmdArgs), { cwd, encoding: 'utf8', shell: true })
  return res.status === 0 ? (res.stdout ?? '') : null
}

const mb = (path) => `${(statSync(path).size / 1024 / 1024).toFixed(1)} MB`

// ---- Vorprüfungen ----------------------------------------------------------

const GRADLE_FILE = join(ANDROID, 'app', 'build.gradle')

/** Versionsangaben aus build.gradle — landen im Dateinamen der Artefakte. */
function androidVersion() {
  const gradle = readFileSync(GRADLE_FILE, 'utf8')
  const code = gradle.match(/versionCode\s+(\d+)/)?.[1] ?? '0'
  const name = gradle.match(/versionName\s+"([^"]+)"/)?.[1] ?? '0.0'
  return { code, name }
}

/**
 * versionCode vor jedem Release-Build hochzählen (DESIGN-PLAYSTORE.md).
 *
 * Play nimmt ein .aab nur mit HÖHEREM versionCode an als das zuletzt
 * hochgeladene. Eine Zahl, die man von Hand pflegen muss, vergisst man genau
 * einmal — und merkt es erst am abgelehnten Upload. Ein zu hoher Wert kostet
 * dagegen nichts, Play verlangt nur Monotonie, keine Lückenlosigkeit.
 *
 * Der versionName („1.0") bleibt bewusst manuell: den soll eine
 * Release-Entscheidung setzen, kein Build.
 */
function bumpVersionCode() {
  const gradle = readFileSync(GRADLE_FILE, 'utf8')
  const match = gradle.match(/versionCode\s+(\d+)/)
  if (!match) {
    warn('versionCode in app/build.gradle nicht gefunden — nicht hochgezählt.')
    return
  }
  const next = Number(match[1]) + 1
  writeFileSync(GRADLE_FILE, gradle.replace(match[0], `versionCode ${next}`))
  info(`versionCode ${match[1]} → ${next}  (--no-bump lässt ihn stehen)`)
}

/**
 * Die Rechtstexte in public/ tragen Platzhalter für den Verantwortlichen, die
 * kein Skript füllen kann. Eine Datenschutzerklärung mit „TODO" darin ist
 * schlimmer als gar keine (und ihre URL steht im Play-Store-Eintrag) — beim
 * Upload bricht der Lauf deshalb ab. Bei einem Trockenlauf reicht die Warnung,
 * sonst könnte man nicht mal mehr eine Test-APK bauen.
 */
function checkLegalPlaceholders(hard) {
  const pages = ['datenschutz/index.html', 'konto-loeschen/index.html', 'impressum/index.html']
  const unfilled = pages.filter((p) => {
    const file = join(ROOT, 'dist', p)
    return existsSync(file) && readFileSync(file, 'utf8').includes('TODO_ANBIETER')
  })
  if (unfilled.length === 0) return

  const what = `Platzhalter in den Rechtstexten: ${unfilled.join(', ')}`
  const how =
    'Anbieterangaben in frontend/public/ eintragen (TODO_ANBIETER_NAME,\n' +
    '      TODO_ANBIETER_ANSCHRIFT, TODO_ANBIETER_EMAIL) — siehe DESIGN-PLAYSTORE.md.'
  if (hard) fail(`${what}\n    ${how}`)
  warn(what)
  warn(how)
}

function checkAndroidToolchain() {
  if (!existsSync(ANDROID)) fail('android/ fehlt — erst `npx cap add android` ausführen.')
  if (!process.env.JAVA_HOME) {
    fail('JAVA_HOME ist nicht gesetzt — Gradle findet sonst kein JDK (ROADMAP B1).')
  }
  if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
    fail('ANDROID_HOME ist nicht gesetzt — Gradle findet sonst kein SDK (ROADMAP B1).')
  }
  if (!existsSync(join(ANDROID, 'keystore.properties'))) {
    warn('android/keystore.properties fehlt — die Release-Artefakte werden')
    warn('UNSIGNIERT gebaut und lassen sich nicht installieren/hochladen.')
    warn('Vorlage: android/keystore.properties.example')
  }
}

// ---- Schritte ---------------------------------------------------------------

function buildWeb() {
  run('npm', ['run', 'build'])
}

function deployWeb() {
  run('npx', [
    'wrangler',
    'pages',
    'deploy',
    'dist',
    '--project-name',
    'geo-quiz',
    '--branch',
    'main',
  ])
}

function buildAndroid() {
  if (!has('--no-bump')) bumpVersionCode()

  // Kopiert dist/ nach android/app/src/main/assets/public + aktualisiert Plugins.
  run('npx', ['cap', 'sync', 'android'])

  const gradlew = join(ANDROID, IS_WIN ? 'gradlew.bat' : 'gradlew')
  const tasks = ['assembleRelease', 'bundleRelease']
  if (has('--debug-apk')) tasks.push('assembleDebug')
  run(gradlew, tasks, ANDROID)
}

/** Artefakte mit sprechendem Namen nach frontend/release/ legen. */
function collectArtifacts() {
  const { code, name } = androidVersion()
  const stamp = new Date().toISOString().slice(0, 10)
  mkdirSync(OUT_DIR, { recursive: true })

  // Nur ausdrücklich angeforderte Artefakte einsammeln — in outputs/ liegen
  // sonst auch alte Dateien früherer Läufe (z. B. eine Debug-APK von gestern).
  const sources = [
    ['app/build/outputs/apk/release/app-release.apk', `GeoQuizArcade-${name}-${code}-${stamp}.apk`],
    ['app/build/outputs/bundle/release/app-release.aab', `GeoQuizArcade-${name}-${code}-${stamp}.aab`],
  ]
  if (has('--debug-apk')) {
    sources.push(['app/build/outputs/apk/debug/app-debug.apk', `GeoQuizArcade-${stamp}-debug.apk`])
  }

  const copied = []
  for (const [from, to] of sources) {
    const src = join(ANDROID, from)
    if (!existsSync(src)) continue
    const dest = join(OUT_DIR, to)
    copyFileSync(src, dest)
    copied.push(dest)
  }
  if (copied.length === 0) fail('Gradle lief durch, aber es liegt kein Artefakt in android/app/build/outputs.')
  return copied
}

/** Signatur bestätigen, solange apksigner im SDK auffindbar ist. */
function verifySignature(apk) {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT
  if (!sdk || !apk) return
  const buildTools = join(sdk, 'build-tools')
  if (!existsSync(buildTools)) return
  const newest = readdirSync(buildTools).sort().pop()
  if (!newest) return
  const apksigner = join(buildTools, newest, IS_WIN ? 'apksigner.bat' : 'apksigner')
  if (!existsSync(apksigner)) return
  const out = tryRun(apksigner, ['verify', '--print-certs', apk])
  const cn = out?.match(/Signer #1 certificate DN:.*?CN=([^,\r\n]+)/)?.[1]
  if (cn) info(`Signatur OK — CN=${cn.trim()}`)
  else warn('Signatur nicht bestätigt — APK ist vermutlich unsigniert.')
}

// ---- Ablauf ------------------------------------------------------------------

const steps = []
if (doChecks) steps.push('Tests + Lint')
if (doWeb) steps.push('Web-Build')
if (doUpload) steps.push('Cloudflare Pages')
if (doAndroid) steps.push('Android-Build')

if (steps.length === 0) fail('Nichts zu tun — --web-only und --android-only schließen sich aus.')

console.log(`\nGEOQUIZ-ARCADE-Release: ${steps.join(' → ')}`)
if (doAndroid) checkAndroidToolchain()

let n = 0
const total = steps.length

if (doChecks) {
  step(++n, total, 'Tests + Lint')
  run('npm', ['run', 'test'])
  run('npm', ['run', 'lint'])
}

// Web-Build ist auch fürs Android-Paket die Quelle — bei --android-only
// trotzdem bauen, sonst wanderte ein veraltetes dist/ in die APK.
if (doWeb) {
  step(++n, total, 'Web-Build (dist/)')
} else {
  console.log('\n      Web-Build für die App (dist/ ist die Capacitor-Quelle)')
}
buildWeb()
checkLegalPlaceholders(doUpload)

if (doUpload) {
  step(++n, total, 'Deploy → Cloudflare Pages')
  deployWeb()
} else if (doWeb) {
  info('Upload übersprungen (--no-deploy)')
}

if (doAndroid) {
  step(++n, total, 'Android-Build (cap sync + Gradle)')
  buildAndroid()
  const copied = collectArtifacts()
  verifySignature(copied.find((p) => p.endsWith('.apk') && !p.includes('debug')))
  console.log('')
  for (const p of copied) info(`${p}  (${mb(p)})`)
}

console.log('\n  ✔ Release fertig.')
if (doUpload) info('Web: https://geo-quiz-a6s.pages.dev')
if (doAndroid) info(`App: frontend/release/ — aufs Gerät via  adb install -r <apk>`)
console.log('')
