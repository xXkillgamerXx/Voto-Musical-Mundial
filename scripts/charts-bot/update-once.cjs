#!/usr/bin/env node
/**
 * One automatic cycle: scrape site charts → publish into CHARTS_OUT.
 *
 *   node update-once.cjs
 */
const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const HERE = __dirname
const DATA = process.env.CHARTS_DATA_DIR || path.join(HERE, 'data')
const OUT =
  process.env.CHARTS_OUT ||
  path.join(HERE, '..', '..', 'news', 'public', 'charts')

function run(script, env = {}) {
  const result = spawnSync(process.execPath, [path.join(HERE, script)], {
    cwd: HERE,
    env: { ...process.env, CHARTS_DATA_DIR: DATA, CHARTS_OUT: OUT, ...env },
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`${script} failed with code ${result.status}`)
  }
}

function main() {
  fs.mkdirSync(DATA, { recursive: true })
  fs.mkdirSync(OUT, { recursive: true })
  console.log('[charts-bot] scrape', new Date().toISOString())
  run('scrape-site.cjs')
  if (process.env.AA_USER && process.env.AA_PASS) {
    console.log('[charts-bot] allaccess radio')
    const aa = spawnSync(process.execPath, [path.join(HERE, 'allaccess.cjs')], {
      cwd: HERE,
      env: process.env,
      stdio: 'inherit',
    })
    const from = path.join(HERE, 'allaccess.json')
    const to = path.join(DATA, 'allaccess.json')
    if (aa.status === 0 && fs.existsSync(from)) {
      fs.copyFileSync(from, to)
    } else {
      console.warn('[charts-bot] allaccess skipped/failed; using kworb radio fallback')
    }
  }
  console.log('[charts-bot] publish →', OUT)
  run('publish-to-site.cjs')
  console.log('[charts-bot] done', new Date().toISOString())
}

main()
