// Store-Screenshot der globalen Bestenliste mit DEMO-Daten (docs/STORE-LISTING.md §5).
// Echte App (Vite-Dev-Server), alle Supabase-Aufrufe abgefangen und mit erfundenen
// Spielern im Stil von generateRetroName beantwortet — keine echten fremden Namen
// im Store, keine Anmeldung nötig. Nutzt das installierte Edge (kein Browser-Download).
//
//   npm i --no-save playwright-core
//   npm run dev                      # in einem zweiten Terminal
//   node scripts/store-screenshot-leaderboard.mjs assets/store-screenshots/09-bestenliste.png
//
// 414×920 CSS-px bei Faktor 1080/414 → 1080×2400 wie die Emulator-Aufnahmen.
import { chromium } from 'playwright-core'

const APP = process.env.APP ?? 'http://localhost:5173'
const OUT = process.argv[2] ?? 'leaderboard.png'
const REF = 'dpueqnhhwcdbhihiudyg'
const ME = { id: '00000000-0000-4000-8000-000000000001', name: 'NEON_OTTER_66' }

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 3600 * 24
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ME.id, role: 'authenticated', is_anonymous: false, exp, aud: 'authenticated' })}.sig`
const user = { id: ME.id, aud: 'authenticated', role: 'authenticated', email: 'demo@example.invalid', is_anonymous: false, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-07-01T00:00:00Z' }
const session = { access_token: jwt, token_type: 'bearer', expires_in: 86400, expires_at: exp, refresh_token: 'demo', user }

// Demo-Cup-Läufe im Stil der Zufallsnamen (generateRetroName), plausible Summen
// aus 6 Disziplinen à 30 s. Eigener Name auf Platz 4 → hervorgehobene Zeile.
const now = Date.now()
const day = 86400000
const cupRows = [
  ['COSMIC_LYNX_31', 11840, 'champion'],
  ['TURBO_ORCA_77', 11205, 'dragon'],
  ['HYPER_RAVEN_19', 10630, 'wizard'],
  [ME.name, 10115, 'astro'],
  ['RETRO_PANDA_52', 9780, 'robogirl'],
  ['ATOMIC_YETI_88', 9345, 'knight'],
  ['MEGA_DINGO_24', 8990, 'alien'],
  ['SHADOW_WOLF_63', 8610, 'ninja'],
  ['PIXEL_HAWK_45', 8170, 'princess'],
  ['ULTRA_COBRA_12', 7725, 'robot'],
  ['BLAZE_TIGER_90', 7310, 'punk'],
  ['CYBER_FOX_37', 6880, 'ghost'],
].map(([display_name, total_score, avatar], i) => ({
  cup_run_id: 1000 + i, display_name, total_score, avatar,
  modes_played: ['flags', 'capitals', 'countries', 'outline', 'city-pin', 'landmark-pin'],
  played_at: new Date(now - (i % 5) * day - i * 3600000).toISOString(),
}))
const avatarOf = Object.fromEntries(cupRows.map((r) => [r.display_name, r.avatar]))

function rpc(name, body) {
  switch (name) {
    case 'get_leaderboard_cups': return cupRows.map(({ avatar: _avatar, ...r }) => r)
    case 'get_leaderboard_scores': return []
    case 'get_leaderboard_first_played': return new Date(now - 90 * day).toISOString()
    case 'get_profile_avatars': return (body.p_names ?? []).map((n) => ({ display_name: n, avatar_id: avatarOf[n] ?? null }))
    case 'get_leaderboard_levels': return []
    case 'list_my_groups': return []
    case 'get_gamification': return { stats: { xp: 9800, rounds_played: 212, solo_best_score: 4310, cup_count: 38, cup_best_score: 10115, questions_answered: 5400, questions_correct: 4120, total_points: 410000, best_streak: 31, volltreffer_count: 140, trophy_count: 4, play_days: 41 }, badges: [], trophies: [], featured: [] }
    default: return null
  }
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({ viewport: { width: 414, height: 920 }, deviceScaleFactor: 1080 / 414, locale: 'de-DE', isMobile: true, hasTouch: true })
await ctx.addInitScript(([key, val]) => {
  localStorage.setItem(key, val)
}, [`CapacitorStorage.sb-${REF}-auth-token`, JSON.stringify(session)])

await ctx.route(`https://${REF}.supabase.co/**`, async (route) => {
  const req = route.request()
  const url = new URL(req.url())
  const json = (status, data) => route.fulfill({ status, contentType: 'application/json', body: data === undefined ? '' : JSON.stringify(data) })
  if (url.pathname.startsWith('/auth/v1/user')) return json(200, user)
  if (url.pathname.startsWith('/auth/v1/')) return json(200, session)
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const name = url.pathname.split('/').pop()
    let body = {}
    try { body = req.postDataJSON() ?? {} } catch {}
    return json(200, rpc(name, body))
  }
  if (url.pathname === '/rest/v1/profiles') {
    if (req.method() === 'GET') {
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      const row = { display_name: ME.name, avatar_id: 'astro' }
      return json(200, single ? row : [row])
    }
    return route.fulfill({ status: 204, body: '' })
  }
  console.log('unmocked', req.method(), url.pathname)
  return json(200, [])
})

const page = await ctx.newPage()
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()) })
await page.goto(`${APP}/#/scores`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.screenshot({ path: OUT })
console.log('saved', OUT)
await browser.close()
