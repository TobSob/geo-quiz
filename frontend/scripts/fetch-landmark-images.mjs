// Fetches verified coordinates + a representative thumbnail image per
// landmark from the German Wikipedia API (action=query, prop=coordinates
// pageimages) and writes:
//   - src/data/landmarks.json (final quiz data)
//   - public/landmarks/<id>.jpg (downloaded thumbnails)
//   - docs/IMAGE_CREDITS.md (source article + license per image)
// Run: node scripts/fetch-landmark-images.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LANDMARK_MANIFEST } from './landmarks-manifest.mjs'

// A handful of well-known places have Wikipedia articles that lack a
// machine-readable coordinate (too large/diffuse an area for one point) or
// a usable page image (infobox image is a locator map, not a photo).
// Verified real-world coordinates / a manually picked Commons photo fill
// the gap instead of silently dropping the entry.
const MANUAL_OVERRIDES = {
  lm_amazon_rainforest: { lat: -3.13, lng: -59.98 }, // Encontro das Águas, Manaus
  lm_pamukkale: { lat: 37.9247, lng: 29.1206 },
  lm_zocalo: { lat: 19.4326, lng: -99.1332 },
  lm_bali_uluwatu: { lat: -8.8291, lng: 115.0849 },
  lm_panama_canal: {
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Panama_Canal_Miraflores_Locks.jpg/500px-Panama_Canal_Miraflores_Locks.jpg',
  },
  lm_timbuktu: {
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Djinguereber_Mosque%2C_Timbuktu%2C_Mali.jpg/500px-Djinguereber_Mosque%2C_Timbuktu%2C_Mali.jpg',
  },
  // These Wikipedia articles' "page image" is a locator map or flag rather
  // than an actual photo — swapped for a real Commons photo instead.
  lm_atacama: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Atacama_Desert_Panorama_%28img_2303%29.jpg/500px-Atacama_Desert_Panorama_%28img_2303%29.jpg' },
  lm_cartagena: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Cartagena%2C_Colombia_%285049256137%29.jpg/500px-Cartagena%2C_Colombia_%285049256137%29.jpg' },
  lm_chichen_itza: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Chichen_Itza_3.jpg/500px-Chichen_Itza_3.jpg' },
  lm_cinque_terre: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Manarola_NW_Cinque_Terre_Sep23_A7C_07233.jpg/500px-Manarola_NW_Cinque_Terre_Sep23_A7C_07233.jpg' },
  lm_cliffs_moher: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Ireland_Cliffs_of_Moher_BW_2025-09-11_14-27-51.jpg/500px-Ireland_Cliffs_of_Moher_BW_2025-09-11_14-27-51.jpg' },
  lm_copacabana: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Copacabana%2C_Rio_de_Janeiro%2C_Brazil.jpg/500px-Copacabana%2C_Rio_de_Janeiro%2C_Brazil.jpg' },
  lm_dolomites: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Drei_Zinnen_Tre_Cime_di_Lavaredo_Dolomites.jpg/500px-Drei_Zinnen_Tre_Cime_di_Lavaredo_Dolomites.jpg' },
  lm_el_nido: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Island_lagoon_in_Bacuit_Bay%2C_El_Nido%2C_Palawan%2C_Philippines.jpg/500px-Island_lagoon_in_Bacuit_Bay%2C_El_Nido%2C_Palawan%2C_Philippines.jpg' },
  lm_faroe_islands: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Faroe_Islands%2C_Streymoy%2C_Kaldbaksbotnur.jpg/500px-Faroe_Islands%2C_Streymoy%2C_Kaldbaksbotnur.jpg' },
  lm_galapagos: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Galapagos_giant_tortoise_%28Chelonoidis_nigra%29_%285526603796%29.jpg/500px-Galapagos_giant_tortoise_%28Chelonoidis_nigra%29_%285526603796%29.jpg' },
  lm_ha_long_bay: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Limestone_Island_in_Halong_Bay%2C_Vietnam.jpg/500px-Limestone_Island_in_Halong_Bay%2C_Vietnam.jpg' },
  lm_iguazu_falls: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Iguazu_Falls_Panorama_2009.jpg/500px-Iguazu_Falls_Panorama_2009.jpg' },
  lm_jeju: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Seongsan%2C_Jeju_Island.jpg/500px-Seongsan%2C_Jeju_Island.jpg' },
  lm_lake_baikal: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Lake_Baikal_in_winter.jpg/500px-Lake_Baikal_in_winter.jpg' },
  lm_la_rambla: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Las_Ramblas_Barcelona_%283937446922%29.jpg/500px-Las_Ramblas_Barcelona_%283937446922%29.jpg' },
  lm_maracana: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Panorama_of_Maracana_Stadium_-_Rio_de_Janeiro_-_Brazil_-_01_%2817370723219%29.jpg/500px-Panorama_of_Maracana_Stadium_-_Rio_de_Janeiro_-_Brazil_-_01_%2817370723219%29.jpg' },
  lm_raja_ampat: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Aerial_of_SE_Misool%27s_Balbulol_Islands.jpg/500px-Aerial_of_SE_Misool%27s_Balbulol_Islands.jpg' },
  lm_tegalalang: { lat: -8.4302, lng: 115.2795, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Tegallalang_Rice_Terraces_Bali_1.jpg/500px-Tegallalang_Rice_Terraces_Bali_1.jpg' },
  lm_zanzibar: { imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Zanzibar_Stone_Town_beach.jpg/500px-Zanzibar_Stone_Town_beach.jpg' },
}

const here = dirname(fileURLToPath(import.meta.url))
const outJson = join(here, '..', 'src', 'data', 'landmarks.json')
const outImageDir = join(here, '..', 'public', 'landmarks')
const outCredits = join(here, '..', '..', 'docs', 'IMAGE_CREDITS.md')

const UA = 'GeoQuizDev/1.0 (contact: tob.sobek@gmail.com)'
const API = 'https://de.wikipedia.org/w/api.php'
const THUMB_WIDTH = 480

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function queryBatch(titles) {
  const url = new URL(API)
  url.searchParams.set('action', 'query')
  url.searchParams.set('prop', 'coordinates|pageimages|info')
  url.searchParams.set('inprop', 'url')
  url.searchParams.set('titles', titles.join('|'))
  url.searchParams.set('pithumbsize', String(THUMB_WIDTH))
  url.searchParams.set('redirects', '1')
  // coordinates module defaults to 10 results per request and silently
  // truncates the rest (via a `cocontinue` token) — max avoids that.
  url.searchParams.set('colimit', 'max')
  url.searchParams.set('format', 'json')
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`API error ${res.status} for batch`)
  return res.json()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function downloadImage(url, destPath, attempt = 1) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 429 && attempt <= 5) {
    const retryAfter = Number(res.headers.get('retry-after')) || attempt * 2
    await sleep(retryAfter * 1000)
    return downloadImage(url, destPath, attempt + 1)
  }
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(destPath, buf)
  return buf.length
}

async function main() {
  mkdirSync(outImageDir, { recursive: true })

  // title -> resolved page data (handles normalization/redirects)
  const byTitle = new Map()
  for (const batch of chunk(LANDMARK_MANIFEST, 40)) {
    const data = await queryBatch(batch.map((e) => e.wikiTitle))
    const pages = Object.values(data.query?.pages ?? {})
    const normalized = new Map((data.query?.normalized ?? []).map((n) => [n.from, n.to]))
    const redirects = new Map((data.query?.redirects ?? []).map((r) => [r.from, r.to]))
    for (const entry of batch) {
      let resolved = entry.wikiTitle
      if (normalized.has(resolved)) resolved = normalized.get(resolved)
      if (redirects.has(resolved)) resolved = redirects.get(resolved)
      const page = pages.find((p) => p.title === resolved)
      byTitle.set(entry.wikiTitle, page)
    }
  }

  // Large multi-title batches occasionally mis-resolve a title (server-side
  // title-matching quirk) — refetch those alone before giving up on them.
  for (const entry of LANDMARK_MANIFEST) {
    const page = byTitle.get(entry.wikiTitle)
    const hasCoord = page?.coordinates?.[0]
    const hasThumb = page?.thumbnail?.source
    if (page && page.missing === undefined && hasCoord && hasThumb) continue
    const data = await queryBatch([entry.wikiTitle])
    const solo = Object.values(data.query?.pages ?? {})[0]
    if (solo) byTitle.set(entry.wikiTitle, solo)
    await sleep(200)
  }

  const results = []
  const failures = []
  const credits = []

  for (const entry of LANDMARK_MANIFEST) {
    const page = byTitle.get(entry.wikiTitle)
    const override = MANUAL_OVERRIDES[entry.id]
    if (!page || page.missing !== undefined) {
      failures.push(`${entry.id}: page not found for "${entry.wikiTitle}"`)
      continue
    }
    const coord = page.coordinates?.[0]
      ? { lat: page.coordinates[0].lat, lng: page.coordinates[0].lon }
      : override?.lat !== undefined
        ? override
        : null
    const thumb = override?.imageUrl ?? page.thumbnail?.source
    if (!coord) {
      failures.push(`${entry.id}: no coordinates on "${page.title}"`)
      continue
    }
    if (!thumb) {
      failures.push(`${entry.id}: no thumbnail on "${page.title}"`)
      continue
    }
    let bytes = 0
    try {
      bytes = await downloadImage(thumb, join(outImageDir, `${entry.id}.jpg`))
    } catch (err) {
      failures.push(`${entry.id}: ${err.message}`)
      continue
    }
    await sleep(400)
    results.push({
      id: entry.id,
      name: entry.name,
      countryIso2: entry.countryIso2,
      lat: Math.round(coord.lat * 10000) / 10000,
      lng: Math.round(coord.lng * 10000) / 10000,
      category: entry.category,
      difficulty: entry.difficulty,
      image: `/landmarks/${entry.id}.jpg`,
    })
    credits.push(`- **${entry.name}** — [${page.title}](${page.fullurl}) (Wikipedia, ${Math.round(bytes / 1024)} KB)`)
    process.stdout.write(`ok  ${entry.id} <- ${page.title} (${bytes} bytes)\n`)
  }

  writeFileSync(outJson, JSON.stringify(results))
  writeFileSync(
    outCredits,
    `# Bildnachweise — Landmark-Pin\n\nBilder stammen aus Wikipedia-Artikeln (jeweiliges "Page Image"), Lizenz siehe verlinkter Artikel/Commons-Seite.\n\n${credits.join('\n')}\n`,
  )

  process.stdout.write(`\n${results.length} ok, ${failures.length} failed\n`)
  if (failures.length) {
    process.stdout.write('\nFAILURES:\n' + failures.map((f) => `  - ${f}`).join('\n') + '\n')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
