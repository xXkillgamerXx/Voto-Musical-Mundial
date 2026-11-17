#!/usr/bin/env node
/**
 * One-shot: push existing html/charts JSON into Postgres via /api/charts/ingest.
 *
 *   CHARTS_INGEST_SECRET=... CHARTS_API_URL=https://www.musicmundial.com/api node seed-db-from-json.cjs
 *   CHARTS_OUT=/www/wwwroot/new_musicmundial/html/charts node seed-db-from-json.cjs
 */
const fs = require('fs')
const path = require('path')

const OUT =
  process.env.CHARTS_OUT ||
  path.join(__dirname, '..', '..', 'news', 'public', 'charts')
const apiBase = String(
  process.env.CHARTS_API_URL || process.env.PUBLIC_API_URL || 'http://127.0.0.1:4000/api',
)
  .trim()
  .replace(/\/$/, '')
const secret = String(process.env.CHARTS_INGEST_SECRET || '').trim()

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

async function main() {
  if (!secret) throw new Error('Set CHARTS_INGEST_SECRET')
  const data = readJson(path.join(OUT, 'data.json'))
  let countries = []
  try {
    countries = readJson(path.join(OUT, 'spotify', 'countries.json')).packed || []
  } catch {}

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

  const spotDir = path.join(OUT, 'spotify')
  if (fs.existsSync(spotDir)) {
    for (const name of fs.readdirSync(spotDir)) {
      if (!name.endsWith('-daily.json')) continue
      const code = name.replace(/-daily\.json$/, '')
      if (code === 'global') continue
      const pack = readJson(path.join(spotDir, name))
      packs.push({
        boardKey: 'daily',
        code,
        chart: pack.chart || null,
        date: pack.date || null,
        source: pack.source || null,
        country: pack.country || code.toUpperCase(),
        section: pack.section || 'spotify',
        period: pack.period || 'daily',
        scrapedAt: pack.scrapedAt || null,
        publishedAt: pack.publishedAt || null,
        tracks: pack.tracks || [],
      })
    }
  }

  const response = await fetch(`${apiBase}/charts/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-charts-ingest-secret': secret,
    },
    body: JSON.stringify({ packs, countries }),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${response.status} ${text}`)
  console.log(text)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
