#!/usr/bin/env node
/**
 * Kworb chart updater. Node 18+, no dependencies.
 *
 *   node kworb.js              # keep updating, every 30 minutes
 *   node kworb.js --once       # one pass, then exit
 *   node kworb.js --every=15   # minutes between passes
 *
 *   pm2 start kworb.js --name kworb
 *
 * Writes one JSON per chart under Jordan/kworb/.
 * Spotify totals archives are skipped: each one is the full history, not the live chart.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "kworb");
const EVERY_MINUTES = Number((process.argv.find((arg) => arg.startsWith("--every=")) || "").split("=")[1]) || Number(process.env.KW_EVERY) || 30;
const DELAY_MS = Number(process.env.KW_DELAY) || 250;
const ONCE = process.argv.includes("--once");
const UA = "Mozilla/5.0";

const HEADER_KEY = {
  pos: "position",
  "p+": "change",
  "artist and title": "song",
  track: "song",
  video: "song",
  "#1 track": "song",
  "#1 overall": "overall",
  "#1 music": "music",
  artist: "artist",
  days: "days",
  wks: "weeks",
  pk: "peak",
  "(x?)": "timesAtPeak",
  streams: "streams",
  "streams+": "streamsChange",
  "7day": "streams7d",
  "7day+": "streams7dChange",
  total: "total",
  views: "views",
  likes: "likes",
  "#": "charts",
  highlights: "highlights",
  aud: "audience",
  "aud+": "audienceChange",
  formats: "formats",
  pkaud: "peakAudience",
  itunes: "itunes",
  spotify: "spotify",
  "apple m": "apple",
  shazam: "shazam",
  listeners: "listeners",
  "daily +/-": "listenersChange",
  pklisteners: "peakListeners",
  country: "country",
  "market size": "marketSize",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decode(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function numberOrNull(value) {
  const clean = String(value || "").replace(/,/g, "").replace(/%$/, "").trim();
  if (!/^[+-]?\d+(\.\d+)?$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function anchors(html) {
  const found = [];
  const re = /<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    const href = match[1];
    const idMatch = href.match(/(?:^|\/)(artist|track|video)\/([^./]+)/);
    found.push({
      kind: idMatch ? idMatch[1] : null,
      id: idMatch ? idMatch[2].replace(/_songs$/, "") : null,
      name: decode(match[2]),
    });
  }
  return found;
}

function songFromCell(html) {
  const splitAt = html.indexOf("(w/");
  const main = anchors(splitAt === -1 ? html : html.slice(0, splitAt));
  const featured = anchors(splitAt === -1 ? "" : html.slice(splitAt)).filter((item) => item.kind === "artist");
  const artist = main.find((item) => item.kind === "artist");
  const track = main.find((item) => item.kind === "track");
  const video = [...main, ...anchors(html)].find((item) => item.kind === "video");
  const plain = decode(html);
  let name = plain;
  let artistName = artist ? artist.name : null;
  let title = track ? track.name : video ? video.name : null;
  if (!artistName && !title && plain.includes(" - ")) {
    const dash = plain.indexOf(" - ");
    artistName = plain.slice(0, dash);
    title = plain.slice(dash + 3);
    name = plain;
  } else if (!title) {
    title = plain || null;
  }
  if (artistName && title) name = artistName + " - " + title;
  return {
    artist: artistName,
    artistId: artist ? artist.id : null,
    title,
    trackId: track ? track.id : null,
    videoId: video ? video.id : null,
    name,
    with: featured.map((item) => ({ name: item.name, id: item.id })),
  };
}

function columnKey(label, index) {
  const norm = String(label || "").toLowerCase();
  if (norm === "#" && index === 0) return "position";
  if (HEADER_KEY[norm]) return HEADER_KEY[norm];
  if (!label && index === 0) return "position";
  if (!label && index === 1) return "change";
  if (!label) return null;
  return norm.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || null;
}

function applyCell(row, key, cell) {
  if (!key) return;
  if (key === "song" || key === "overall" || key === "music") {
    const song = songFromCell(cell);
    if (key === "song") {
      row.artist = song.artist;
      row.artistId = song.artistId;
      row.title = song.title;
      row.trackId = song.trackId;
      row.videoId = song.videoId;
      row.name = song.name;
      row.with = song.with;
      return;
    }
    row[key] = song.name || song.title || null;
    if (song.videoId) row[key + "Id"] = song.videoId;
    return;
  }
  if (key === "artist") {
    const link = anchors(cell).find((item) => item.kind === "artist") || anchors(cell)[0];
    row.artist = link ? link.name : decode(cell) || null;
    row.artistId = link && link.kind === "artist" ? link.id : null;
    return;
  }
  if (key === "timesAtPeak") {
    const times = decode(cell).match(/\(x(\d+)\)/);
    row.timesAtPeak = times ? Number(times[1]) : null;
    return;
  }
  if (key === "change" || key === "highlights" || key === "country") {
    row[key] = decode(cell) || null;
    return;
  }
  if (key === "formats") {
    const text = decode(cell);
    row.formats = text ? numberOrNull(text) ?? text : null;
    return;
  }
  const text = decode(cell);
  if (!text) {
    row[key] = null;
    return;
  }
  row[key] = numberOrNull(text) ?? text;
}

function pageTitle(html) {
  const match = html.match(/<span class="pagetitle">([\s\S]*?)<\/span>/);
  if (!match) return { chart: "", date: null };
  const decoded = decode(match[1]);
  const chart = decode(match[1].split("|")[0]).replace(/\s+-\s*$/, "").trim() || decoded;
  return { chart, date: chartDate(decoded) };
}

function compact(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (value == null || value === "") continue;
    if (key === "with" && Array.isArray(value) && value.length === 0) continue;
    if (key === "name" && (value === row.title || value === (row.artist ? row.artist + " - " + row.title : ""))) continue;
    out[key] = value;
  }
  return out;
}

function chartDate(title) {
  const iso = title.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];
  const crumb = title.match(/(\d{4})\s*»\s*\/\s*«\s*(\d{1,2})\s*»\s*\/\s*«\s*(\d{1,2})/);
  if (!crumb) return null;
  return crumb[1] + "-" + crumb[2].padStart(2, "0") + "-" + crumb[3].padStart(2, "0");
}

function mainTable(html) {
  const tables = html.match(/<table\b[\s\S]*?<\/table>/g) || [];
  return tables.find((table) => /<th\b/i.test(table) && /<tbody/i.test(table)) || "";
}

function parseChart(html) {
  const table = mainTable(html);
  const headers = [...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map((match) => decode(match[1]));
  const body = table.match(/<tbody>([\s\S]*?)<\/tbody>/);
  const rows = body ? body[1].match(/<tr\b[\s\S]*?<\/tr>/g) || [] : [];
  const tracks = rows.map((rowHtml) => {
    const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1]);
    const row = {};
    headers.forEach((label, index) => applyCell(row, columnKey(label, index), cells[index] || ""));
    return compact(row);
  }).filter((row) => Object.keys(row).length);
  const title = pageTitle(html);
  return { chart: title.chart, date: title.date, tracks };
}

function spotifyJobs(html) {
  const jobs = [];
  const re = /<tr><td class="mp text">([^<]+)<\/td>\s*<td class="mp text">([\s\S]*?)<\/td>\s*<\/tr>/g;
  let match;
  while ((match = re.exec(html))) {
    const country = decode(match[1]);
    const links = [...match[2].matchAll(/href="(country\/([a-z0-9]+)_(daily|weekly))\.html"/g)];
    for (const link of links) {
      jobs.push({
        section: "spotify",
        id: link[2] + "-" + link[3],
        country,
        code: link[2],
        period: link[3],
        url: "https://kworb.net/spotify/" + link[1] + ".html",
      });
    }
  }
  jobs.push({
    section: "spotify",
    id: "listeners",
    url: "https://kworb.net/spotify/listeners.html",
  });
  return jobs;
}

function insightJobs(html) {
  const seen = new Set();
  const jobs = [];
  const re = /href="([a-z0-9]+\.html)"/g;
  let match;
  while ((match = re.exec(html))) {
    if (seen.has(match[1])) continue;
    seen.add(match[1]);
    const code = match[1].replace(/\.html$/, "");
    jobs.push({
      section: "youtube",
      id: "country-" + code,
      code,
      url: "https://kworb.net/youtube/insights/" + match[1],
    });
  }
  return jobs;
}

function fixedJobs() {
  return [
    ["youtube", "latest", "https://kworb.net/youtube/"],
    ["youtube", "english", "https://kworb.net/youtube/realtime_anglo.html"],
    ["youtube", "spanish", "https://kworb.net/youtube/realtime_hispano.html"],
    ["youtube", "asian", "https://kworb.net/youtube/realtime_asian.html"],
    ["youtube", "other", "https://kworb.net/youtube/realtime_other.html"],
    ["youtube", "trending", "https://kworb.net/youtube/trending.html"],
    ["youtube", "trending-music", "https://kworb.net/youtube/trending_music.html"],
    ["youtube", "trending-local", "https://kworb.net/youtube/trending_local.html"],
    ["youtube", "trending-overall", "https://kworb.net/youtube/trending_overall.html"],
    ["youtube", "trending-countries", "https://kworb.net/youtube/trending_countries.html"],
    ["radio", "songs", "https://kworb.net/radio/"],
  ].map(([section, id, url]) => ({ section, id, url }));
}

async function fetchText(url, attempt) {
  const tries = attempt || 0;
  try {
    const response = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html" },
      signal: AbortSignal.timeout(45000),
    });
    if ((response.status === 429 || response.status >= 500) && tries < 3) {
      await sleep(2000 * (tries + 1));
      return fetchText(url, tries + 1);
    }
    if (!response.ok) throw new Error(response.status + " " + url);
    return response.text();
  } catch (error) {
    if (tries < 2 && !String(error.message || "").startsWith("4")) {
      await sleep(1500 * (tries + 1));
      return fetchText(url, tries + 1);
    }
    throw error;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

async function saveJob(job) {
  const html = job.html || (await fetchText(job.url));
  const parsed = parseChart(html);
  if (!parsed.tracks.length) throw new Error("No rows");
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
  };
  const file = path.join(ROOT, job.section, job.id + ".json");
  writeJson(file, data);
  return { id: job.section + "/" + job.id, file, count: data.count, date: data.date, source: job.url };
}

async function collectJobs() {
  const [spotifyHtml, insightsHtml] = await Promise.all([
    fetchText("https://kworb.net/spotify/"),
    fetchText("https://kworb.net/youtube/insights/"),
  ]);
  return [
    ...spotifyJobs(spotifyHtml),
    ...fixedJobs(),
    { section: "youtube", id: "insights", url: "https://kworb.net/youtube/insights/", html: insightsHtml },
    ...insightJobs(insightsHtml),
  ];
}

async function runOnce() {
  const started = Date.now();
  const jobs = await collectJobs();
  const saved = [];
  const failed = [];
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    try {
      const result = await saveJob(job);
      saved.push(result);
      console.log(result.id, result.date || "-", result.count);
    } catch (error) {
      failed.push({ id: job.section + "/" + job.id, url: job.url, error: error.message || String(error) });
      console.error("fail", job.section + "/" + job.id, error.message || error);
    }
    if (!job.html && i < jobs.length - 1) await sleep(DELAY_MS);
  }
  const index = {
    updatedAt: new Date().toISOString(),
    seconds: Math.round((Date.now() - started) / 1000),
    ok: saved.length,
    failed,
    charts: saved,
  };
  writeJson(path.join(ROOT, "index.json"), index);
  console.log("updated", saved.length, "charts,", failed.length, "failed, in", index.seconds + "s ->", ROOT);
  return index;
}

async function main() {
  console.log(ONCE ? "one pass" : "every " + EVERY_MINUTES + " min", "->", ROOT);
  do {
    const started = Date.now();
    try {
      await runOnce();
    } catch (error) {
      console.error(error.message || error);
      if (ONCE) process.exitCode = 1;
    }
    if (ONCE) break;
    const wait = Math.max(5000, EVERY_MINUTES * 60 * 1000 - (Date.now() - started));
    console.log("next pass in", Math.round(wait / 1000) + "s");
    await sleep(wait);
  } while (!ONCE);
}

if (require.main === module) {
  main();
}

module.exports = { parseChart, spotifyJobs, insightJobs };
