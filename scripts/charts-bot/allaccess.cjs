const fs = require("fs");
const path = require("path");

const SOURCE = "https://www.allaccess.com/mediabase/q/report/sevenDay/format/H1/panel/R/detail/C/reportType/R";
const OUT = path.join(__dirname, "allaccess.json");

function decode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function text(html) {
  return decode(String(html || "").replace(/<[^>]+>/g, " "));
}

function numberOrNull(value) {
  const clean = text(value).replace(/,/g, "");
  if (!clean || clean === "—") return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function rankChange(lastWeek, position) {
  if (lastWeek == null || position == null) return null;
  const delta = lastWeek - position;
  if (delta === 0) return "=";
  return (delta > 0 ? "+" : "") + delta;
}

function parse(html) {
  const header = (html.match(/<div class="chart-header">([\s\S]*?)<\/div>/) || [])[1] || "";
  const chart = text((header.match(/<h2>([\s\S]*?)<\/h2>/) || [])[1]);
  const subtitle = text((header.match(/<h5>([\s\S]*?)<\/h5>/) || [])[1]);
  const dates = (header.match(/<h6>([\s\S]*?)<\/h6>/) || [])[1] || "";
  const lastWeekLabel = text((dates.match(/lw:<\/b>\s*([^<]+)/) || [])[1]);
  const thisWeekLabel = text((dates.match(/TW:<\/b>\s*([^<]+)/) || [])[1]);
  const body = (html.match(/<tbody>([\s\S]*?)<\/tbody>/) || [])[1] || "";
  const rows = body.match(/<tr\b[\s\S]*?<\/tr>/g) || [];

  const tracks = rows.map((row) => {
    const cells = [];
    const re = /<td\b[^>]*>([\s\S]*?)<\/td>/g;
    let match;
    while ((match = re.exec(row))) cells.push(match[1]);
    const artistHtml = cells[2] || "";
    const titleHtml = cells[3] || "";
    const link = titleHtml.match(/href="[^"]*\/song\/([^/"]+)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    const lastWeek = numberOrNull(cells[0]);
    const position = numberOrNull(cells[1]);
    return {
      position,
      change: rankChange(lastWeek, position),
      lastWeek,
      artist: text(artistHtml.replace(/<img\b[^>]*>/g, "")),
      title: link ? text(link[2]) : text(titleHtml),
      songId: link ? decode(link[1]) : null,
      spins: numberOrNull(cells[4]),
      spinsLastWeek: numberOrNull(cells[5]),
      spinsChange: numberOrNull(cells[6]),
      audience: numberOrNull(cells[7]),
      up: /chartup/.test(artistHtml),
    };
  });

  return {
    source: SOURCE,
    chart: chart || "Top 40",
    panel: subtitle,
    lastWeek: lastWeekLabel || null,
    thisWeek: thisWeekLabel || null,
    audienceUnit: "millions",
    abbreviated: /abbreviated Mediabase Report/i.test(html),
    scrapedAt: new Date().toISOString(),
    count: tracks.length,
    tracks,
  };
}

function cookieJar() {
  const jar = new Map();
  return {
    header() {
      return [...jar.entries()].map(([key, value]) => key + "=" + value).join("; ");
    },
    store(response) {
      const lines = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
      for (const line of lines) {
        const pair = line.split(";")[0];
        const eq = pair.indexOf("=");
        if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
  };
}

async function request(jar, url, options) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "user-agent": "Mozilla/5.0",
      cookie: jar.header(),
      ...(options && options.headers),
    },
    redirect: (options && options.redirect) || "manual",
  });
  jar.store(response);
  return response;
}

async function main() {
  const username = process.env.AA_USER;
  const password = process.env.AA_PASS;
  if (!username || !password) throw new Error("Set AA_USER and AA_PASS");

  const jar = cookieJar();
  await request(jar, "https://www.allaccess.com/login");
  const login = await request(jar, "https://www.allaccess.com/site/api/Account/logIn/", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-requested-with": "XMLHttpRequest",
      referer: "https://www.allaccess.com/login",
      origin: "https://www.allaccess.com",
    },
    body: new URLSearchParams({ username, password }).toString(),
  });
  const loginBody = await login.json();
  const result = loginBody && loginBody.response;
  if (!result || result.type !== "success") {
    const title = result && result.title ? decodeURIComponent(result.title) : "Login failed";
    throw new Error(title);
  }

  const report = await request(jar, SOURCE, { redirect: "follow" });
  const html = await report.text();
  if (html.includes('id="login-form"')) throw new Error("Report still requires login");
  const data = parse(html);
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
  console.log(data.chart, data.thisWeek, data.count, "tracks ->", OUT);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = { parse, SOURCE };
