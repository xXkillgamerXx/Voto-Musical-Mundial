#!/usr/bin/env node
/**
 * Optimized scrape for Music Mundial site charts only.
 * Skips weekly Spotify archives and most YouTube side charts.
 *
 *   node scrape-site.cjs
 *   CHARTS_DATA_DIR=/path/to/data node scrape-site.cjs
 */
const path = require('path')
const kworb = require('./kworb.cjs')

// Patch ROOT via env before running — kworb uses __dirname/kworb.
// We reimplement a focused runner using exported parsers + local fetch.

const fs = require('fs')

const DATA = process.env.CHARTS_DATA_DIR || path.join(__dirname, 'data')
const ROOT = path.join(DATA, 'kworb')
const DELAY_MS = Number(process.env.KW_DELAY || 200)
const UA = 'Mozilla/5.0 MusicMundialChartsBot/1.0'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchText(url, attempt = 0) {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html' },
      signal: AbortSignal.timeout(45000),
    })
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      await sleep(2000 * (attempt + 1))
      return fetchText(url, attempt + 1)
    }
    if (!response.ok) throw new Error(response.status + ' ' + url)
    return response.text()
  } catch (error) {
    if (attempt < 2 && !String(error.message || '').startsWith('4')) {
      await sleep(1500 * (attempt + 1))
      return fetchText(url, attempt + 1)
    }
    throw error
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data) + '\n')
  fs.renameSync(tmp, file)
}

async function saveJob(job) {
  const html = job.html || (await fetchText(job.url))
  const parsed = kworb.parseChart(html)
  if (!parsed.tracks.length) throw new Error('No rows')
  const data = {
    source: job.url,
    section: job.section,
    id: job.id,
    country: job.country || null,
    code: job.code || null,
    period: job.period || null,
    chart: parsed.chart,
    date: parsed.date,
    scrapedAt: new Date().toISOString(),
    count: parsed.tracks.length,
    tracks: parsed.tracks,
  }
  const file = path.join(ROOT, job.section, job.id + '.json')
  writeJson(file, data)
  return { id: `${job.section}/${job.id}`, count: data.count, date: data.date }
}

async function collectSiteJobs() {
  const [spotifyHtml, insightsHtml] = await Promise.all([
    fetchText('https://kworb.net/spotify/'),
    fetchText('https://kworb.net/youtube/insights/'),
  ])
  const spotify = kworb.spotifyJobs(spotifyHtml).filter(
    (job) => job.id === 'listeners' || (job.period === 'daily' && job.code),
  )
  return [
    ...spotify,
    { section: 'youtube', id: 'latest', url: 'https://kworb.net/youtube/' },
    { section: 'youtube', id: 'trending', url: 'https://kworb.net/youtube/trending.html' },
    {
      section: 'youtube',
      id: 'insights',
      url: 'https://kworb.net/youtube/insights/',
      html: insightsHtml,
    },
    { section: 'radio', id: 'songs', url: 'https://kworb.net/radio/' },
  ]
}

async function main() {
  const started = Date.now()
  fs.mkdirSync(ROOT, { recursive: true })
  const jobs = await collectSiteJobs()
  const saved = []
  const failed = []
  console.log('site scrape', jobs.length, 'jobs ->', ROOT)
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]
    try {
      const result = await saveJob(job)
      saved.push(result)
      console.log(result.id, result.date || '-', result.count)
    } catch (error) {
      failed.push({ id: `${job.section}/${job.id}`, error: error.message || String(error) })
      console.error('fail', `${job.section}/${job.id}`, error.message || error)
    }
    if (!job.html && i < jobs.length - 1) await sleep(DELAY_MS)
  }
  writeJson(path.join(ROOT, 'index.json'), {
    updatedAt: new Date().toISOString(),
    seconds: Math.round((Date.now() - started) / 1000),
    ok: saved.length,
    failed,
    mode: 'site',
  })
  console.log('done', saved.length, 'ok,', failed.length, 'failed, in', Math.round((Date.now() - started) / 1000) + 's')
  if (!saved.length) process.exitCode = 1
}

main()
