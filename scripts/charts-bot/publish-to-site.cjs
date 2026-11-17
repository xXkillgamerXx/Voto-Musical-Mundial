#!/usr/bin/env node
/**
 * Publish scraper output into site charts JSON.
 *
 *   node publish-to-site.cjs
 *   CHARTS_DATA_DIR=./data CHARTS_OUT=/www/.../html/charts node publish-to-site.cjs
 */
const fs = require('fs')
const path = require('path')

const HERE = __dirname
const REPO = path.resolve(HERE, '..', '..')
const DEFAULT_PACK = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  'OneDrive',
  'Escritorio',
  'MusicMundial',
)
const PACK =
  process.env.CHARTS_DATA_DIR ||
  process.env.MUSICMUNDIAL_PACK ||
  DEFAULT_PACK
const OUT =
  process.env.CHARTS_OUT ||
  path.join(REPO, 'news', 'public', 'charts')
const SPOT_OUT = path.join(OUT, 'spotify')
const TOP = Number(process.env.CHARTS_TOP || 40)
const PUBLISHED_AT = new Date().toISOString()

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data))
  fs.renameSync(tmp, file)
}

function stamp(pack) {
  return {
    ...pack,
    scrapedAt: pack.scrapedAt || PUBLISHED_AT,
    publishedAt: PUBLISHED_AT,
  }
}

function takeTracks(pack, n = TOP) {
  const tracks = (pack.tracks || []).slice(0, n)
  return stamp({ ...pack, tracks, count: pack.count || tracks.length })
}

function coverMapFromExisting() {
  const map = new Map()
  const remember = (track) => {
    if (!track?.coverUrl) return
    if (track.trackId) map.set(`t:${track.trackId}`, track.coverUrl)
    if (track.artistId) map.set(`a:${track.artistId}`, track.coverUrl)
    const artist = normText(track.artist)
    const title = normText(track.title)
    if (artist || title) map.set(`k:${artist}|${title}`, track.coverUrl)
    if (title) map.set(`title:${title}`, track.coverUrl)
    if (artist) map.set(`artist:${artist}`, track.coverUrl)
  }
  try {
    const current = readJson(path.join(OUT, 'data.json'))
    for (const pack of Object.values(current)) {
      for (const track of pack.tracks || []) remember(track)
    }
  } catch {}
  try {
    for (const name of fs.readdirSync(SPOT_OUT)) {
      if (!name.endsWith('-daily.json')) continue
      const pack = readJson(path.join(SPOT_OUT, name))
      for (const track of pack.tracks || []) remember(track)
    }
  } catch {}
  return map
}

function normText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function withCovers(tracks, covers) {
  return tracks.map((track) => {
    if (track.coverUrl) return track
    const artist = normText(track.artist)
    const title = normText(track.title)
    const hit =
      (track.trackId && covers.get(`t:${track.trackId}`)) ||
      (track.artistId && covers.get(`a:${track.artistId}`)) ||
      covers.get(`k:${artist}|${title}`) ||
      (title && covers.get(`title:${title}`)) ||
      (artist && covers.get(`artist:${artist}`))
    return hit ? { ...track, coverUrl: hit } : track
  })
}

function loadPack(rel) {
  const file = path.join(PACK, rel)
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`)
  return readJson(file)
}

function buildRadio(covers) {
  const hybridPath = path.join(PACK, 'kworb', 'radio', 'hybrid.json')
  if (fs.existsSync(hybridPath)) {
    const hybrid = readJson(hybridPath)
    const week = hybrid.allAccess?.week || null
    const date = hybrid.kworb?.date || null
    return stamp({
      source: 'hybrid',
      chart: 'Radio Airplay',
      date,
      week,
      scrapedAt: hybrid.scrapedAt || hybrid.kworb?.scrapedAt || PUBLISHED_AT,
      count: hybrid.count || (hybrid.tracks || []).length,
      matched: hybrid.matched,
      note: week
        ? `All Access spins for ${week}, joined to audience estimates from ${date || 'kworb'}`
        : undefined,
      tracks: withCovers((hybrid.tracks || []).slice(0, TOP), covers),
    })
  }

  const aaPath = path.join(PACK, 'allaccess.json')
  if (fs.existsSync(aaPath)) {
    const aa = readJson(aaPath)
    return stamp({
      source: 'allaccess',
      chart: 'Radio Airplay',
      date: String(aa.scrapedAt || '').slice(0, 10) || null,
      week: aa.lastWeek && aa.thisWeek ? `${aa.lastWeek} - ${aa.thisWeek}` : null,
      scrapedAt: aa.scrapedAt || PUBLISHED_AT,
      count: aa.count || (aa.tracks || []).length,
      tracks: withCovers(
        (aa.tracks || []).slice(0, TOP).map((t) => ({
          position: t.position,
          change: t.change,
          artist: t.artist,
          title: t.title,
          spins: t.spins,
          spinsLastWeek: t.spinsLastWeek,
          spinsChange: t.spinsChange,
          audience: t.audience,
          panelAudience: t.audience,
          sources: ['allaccess'],
        })),
        covers,
      ),
    })
  }

  // Fallback: kworb radio audience estimates (no spins panel).
  const songs = loadPack('kworb/radio/songs.json')
  return stamp({
    source: 'kworb',
    chart: 'Radio Airplay',
    date: songs.date || null,
    week: null,
    scrapedAt: songs.scrapedAt || PUBLISHED_AT,
    count: songs.count || (songs.tracks || []).length,
    note: 'Kworb radio audience estimates (All Access spins not configured)',
    tracks: withCovers(
      (songs.tracks || []).slice(0, TOP).map((t) => ({
        position: t.position,
        change: t.change,
        artist: t.artist,
        title: t.title,
        audience: t.audience,
        audienceChange: t.audienceChange,
        formats: t.formats,
        days: t.days,
        peak: t.peak,
        sources: ['kworb'],
      })),
      covers,
    ),
  })
}

function main() {
  if (!fs.existsSync(path.join(PACK, 'kworb'))) {
    throw new Error(`Charts data not found under ${PACK}`)
  }
  const covers = coverMapFromExisting()
  const daily = takeTracks(loadPack('kworb/spotify/global-daily.json'))
  daily.tracks = withCovers(daily.tracks, covers)
  const listeners = takeTracks(loadPack('kworb/spotify/listeners.json'))
  listeners.tracks = withCovers(listeners.tracks, covers)
  const latest = takeTracks(loadPack('kworb/youtube/latest.json'))
  latest.tracks = withCovers(latest.tracks, covers)
  const trending = takeTracks(loadPack('kworb/youtube/trending.json'))
  trending.tracks = withCovers(trending.tracks, covers)
  const insights = takeTracks(loadPack('kworb/youtube/insights.json'))
  insights.tracks = withCovers(insights.tracks, covers)

  const data = {
    daily,
    listeners,
    latest,
    trending,
    insights,
    radio: buildRadio(covers),
  }
  writeJson(path.join(OUT, 'data.json'), data)

  const spotDir = path.join(PACK, 'kworb', 'spotify')
  const packed = []
  for (const name of fs.readdirSync(spotDir).sort()) {
    if (!name.endsWith('-daily.json')) continue
    const code = name.replace(/-daily\.json$/, '')
    if (code === 'global') continue
    const raw = takeTracks(readJson(path.join(spotDir, name)))
    raw.tracks = withCovers(raw.tracks, covers)
    writeJson(path.join(SPOT_OUT, `${code}-daily.json`), raw)
    packed.push({
      code: raw.code || code,
      country: raw.country || code.toUpperCase(),
      date: raw.date || null,
      count: raw.count || raw.tracks.length,
    })
  }
  writeJson(path.join(SPOT_OUT, 'countries.json'), {
    frequent: ['us', 'gb', 'br', 'mx', 'co'],
    available: packed,
    packed,
  })

  // Also persist into Postgres via API when configured.
  ingestToDatabase(data, packed).catch((error) => {
    console.warn('[charts-bot] DB ingest skipped/failed:', error.message || error)
  })

  console.log('published', {
    pack: PACK,
    out: OUT,
    daily: data.daily.tracks.length,
    radio: data.radio.tracks.length,
    countries: packed.length,
    radioSource: data.radio.source,
    dailyDate: data.daily.date,
  })
}

async function ingestToDatabase(data, countries) {
  const secret = String(process.env.CHARTS_INGEST_SECRET || '').trim()
  const apiBase = String(
    process.env.CHARTS_API_URL || process.env.PUBLIC_API_URL || 'http://127.0.0.1:4000/api',
  )
    .trim()
    .replace(/\/$/, '')
  if (!secret) {
    console.log('[charts-bot] CHARTS_INGEST_SECRET not set; JSON only')
    return
  }

  const packs = []
  for (const [boardKey, pack] of Object.entries(data)) {
    packs.push({
      boardKey,
      code: pack.code || 'global',
      chart: pack.chart || null,
      date: pack.date || null,
      week: pack.week || null,
      source: pack.source || null,
      note: pack.note || null,
      country: pack.country || null,
      section: pack.section || null,
      period: pack.period || null,
      scrapedAt: pack.scrapedAt || null,
      publishedAt: pack.publishedAt || null,
      tracks: pack.tracks || [],
    })
  }

  for (const row of countries || []) {
    const code = String(row.code || '').toLowerCase()
    if (!code || code === 'global') continue
    try {
      const pack = readJson(path.join(SPOT_OUT, `${code}-daily.json`))
      packs.push({
        boardKey: 'daily',
        code,
        chart: pack.chart || null,
        date: pack.date || null,
        source: pack.source || null,
        country: pack.country || row.country || code.toUpperCase(),
        section: pack.section || 'spotify',
        period: pack.period || 'daily',
        scrapedAt: pack.scrapedAt || null,
        publishedAt: pack.publishedAt || null,
        tracks: pack.tracks || [],
      })
    } catch {}
  }

  const response = await fetch(`${apiBase}/charts/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-charts-ingest-secret': secret,
    },
    body: JSON.stringify({ packs, countries }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${response.status} ${text.slice(0, 200)}`)
  }
  const json = await response.json()
  console.log('[charts-bot] DB ingest ok', json.ingested)
}

main()
