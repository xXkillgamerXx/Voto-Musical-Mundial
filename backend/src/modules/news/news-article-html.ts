import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

export type ArticleHead = {
  locale: 'es' | 'en';
  title: string;
  description: string;
  canonical: string;
  image: string;
  imageAlt?: string;
  imageType?: string;
  published?: string;
  modified?: string;
  author?: string;
  section?: string;
  tags?: string[];
  jsonLd: string;
  hreflangEn?: string;
  hreflangEs?: string;
};

export type ArticleBody = {
  locale: 'es' | 'en';
  title: string;
  excerpt?: string;
  author?: string;
  authorHref?: string;
  byLabel?: string;
  publishedLabel?: string;
  publishedIso?: string;
  image?: string;
  imageAlt?: string;
  categoryName?: string;
  categoryHref?: string;
  homeHref?: string;
  bodyHtml: string;
  videos?: string[];
};

let cache = { path: '', mtime: 0, html: '' };

const indexCandidates = () =>
  [
    process.env.NEWS_INDEX_PATH,
    '/app/news-html/index.html',
    join(process.cwd(), 'news-html/index.html'),
    join(process.cwd(), '../dist-news/index.html'),
    join(process.cwd(), '../news/index.html'),
  ].filter(Boolean) as string[];

export const loadNewsIndexHtml = () => {
  const path = indexCandidates().find((item) => existsSync(item));
  if (!path) return '';
  const mtime = statSync(path).mtimeMs;
  if (cache.path === path && cache.mtime === mtime && cache.html) return cache.html;
  cache = { path, mtime, html: readFileSync(path, 'utf8') };
  return cache.html;
};

const stripHomeSeo = (html: string) =>
  html
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="robots"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="googlebot(?:-news)?"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="alternate"\s+hreflang="[^"]*"\s+href="[^"]*"\s*\/?>\s*/gi, '')
    .replace(/<meta\s+(?:property|name)="(?:og:[^"]*|article:[^"]*|twitter:[^"]*)"[^>]*>\s*/gi, '')
    .replace(/<!--\s*===== SCHEMA\.ORG =====\s*-->\s*/i, '')
    .replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/i, '');

const rankMathBlock = (head: ArticleHead) => {
  const locale = head.locale === 'es' ? 'es_ES' : 'en_US';
  const localeAlt = head.locale === 'es' ? 'en_US' : 'es_ES';
  const imageAlt = head.imageAlt || head.title;
  const imageType = head.imageType || 'image/jpeg';
  const hreflang = [
    head.hreflangEs ? `    <link rel="alternate" hreflang="es" href="${head.hreflangEs}">` : '',
    head.hreflangEs ? `    <link rel="alternate" hreflang="es-ES" href="${head.hreflangEs}">` : '',
    head.hreflangEn ? `    <link rel="alternate" hreflang="en" href="${head.hreflangEn}">` : '',
    head.hreflangEn ? `    <link rel="alternate" hreflang="en-US" href="${head.hreflangEn}">` : '',
    `    <link rel="alternate" hreflang="x-default" href="${head.hreflangEn || head.canonical}">`,
  ]
    .filter(Boolean)
    .join('\n');
  const tags = (head.tags || [])
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
    .map((tag) => `    <meta property="article:tag" content="${tag}">`)
    .join('\n');

  const lines = [
    `    <meta name="description" content="${head.description}">`,
    `    <meta name="robots" content="follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large">`,
    `    <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">`,
    `    <meta name="googlebot-news" content="index, follow">`,
    `    <link rel="canonical" href="${head.canonical}">`,
    hreflang,
    `    <meta property="og:locale" content="${locale}">`,
    `    <meta property="og:locale:alternate" content="${localeAlt}">`,
    `    <meta property="og:type" content="article">`,
    `    <meta property="og:title" content="${head.title}">`,
    `    <meta property="og:description" content="${head.description}">`,
    `    <meta property="og:url" content="${head.canonical}">`,
    `    <meta property="og:site_name" content="Music Mundial">`,
    `    <meta property="article:publisher" content="https://www.facebook.com/MusicMundialEn/">`,
    tags,
    head.section ? `    <meta property="article:section" content="${head.section}">` : '',
    `    <meta property="og:image" content="${head.image}">`,
    `    <meta property="og:image:secure_url" content="${head.image}">`,
    `    <meta property="og:image:width" content="1600">`,
    `    <meta property="og:image:height" content="900">`,
    `    <meta property="og:image:alt" content="${imageAlt}">`,
    `    <meta property="og:image:type" content="${imageType}">`,
    head.published ? `    <meta property="article:published_time" content="${head.published}">` : '',
    head.modified ? `    <meta property="article:modified_time" content="${head.modified}">` : '',
    head.author ? `    <meta property="article:author" content="${head.author}">` : '',
    `    <meta name="twitter:card" content="summary_large_image">`,
    `    <meta name="twitter:title" content="${head.title}">`,
    `    <meta name="twitter:description" content="${head.description}">`,
    `    <meta name="twitter:site" content="@MusicMundial">`,
    `    <meta name="twitter:image" content="${head.image}">`,
    `    <script type="application/ld+json" id="news-article-schema">${head.jsonLd}</script>`,
  ].filter(Boolean);

  return `${lines.join('\n')}\n`;
};

const youtubeEmbed = (id: string, title: string) =>
  `<div class="yt-embed"><iframe src="https://www.youtube.com/embed/${id}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>`;

const withYoutubeEmbeds = (body: ArticleBody) => {
  let html = String(body.bodyHtml || '').trim();
  for (const id of body.videos || []) {
    const key = String(id || '').trim();
    if (!key || html.includes(`/embed/${key}`)) continue;
    html += `\n${youtubeEmbed(key, body.title)}`;
  }
  return html;
};

export const renderArticleBody = (body: ArticleBody) => {
  const homeHref = body.homeHref || (body.locale === 'es' ? '/es' : '/');
  const byLabel = body.byLabel || (body.locale === 'es' ? 'Por' : 'By');
  const author = body.authorHref
    ? `<a href="${body.authorHref}">${body.author}</a>`
    : body.author || '';
  const crumbs = [
    `<a href="${homeHref}">Music Mundial</a>`,
    body.categoryName
      ? `<span class="crumbs-sep" aria-hidden="true">›</span>${
          body.categoryHref ? `<a href="${body.categoryHref}">${body.categoryName}</a>` : `<span>${body.categoryName}</span>`
        }`
      : '',
    `<span class="crumbs-sep" aria-hidden="true">›</span><span class="crumbs-now">${body.title}</span>`,
  ]
    .filter(Boolean)
    .join('\n          ');
  const content = withYoutubeEmbeds(body);

  return `<main id="news-ssr" class="article-page">
    <div class="container article-layout">
      <div class="article-wrap">
        <article class="article">
          <nav class="crumbs" aria-label="breadcrumb">
          ${crumbs}
          </nav>
          <h1>${body.title}</h1>
          <p class="article-meta">
            ${author ? `<span class="article-by">${byLabel} ${author}</span>` : ''}
            ${
              body.publishedLabel
                ? `<span> · <time datetime="${body.publishedIso || ''}">${body.publishedLabel}</time></span>`
                : ''
            }
          </p>
          ${
            body.image
              ? `<figure class="article-cover"><img src="${body.image}" alt="${body.imageAlt || body.title}" width="1600" height="900" fetchpriority="high" decoding="async"></figure>`
              : ''
          }
          ${body.excerpt ? `<p class="article-lead">${body.excerpt}</p>` : ''}
          <div class="article-body">
            ${content}
          </div>
        </article>
      </div>
    </div>
  </main>`;
};

export const paintArticleIndex = (html: string, head: ArticleHead, body?: ArticleBody) => {
  const lang = head.locale === 'es' ? 'es' : 'en';
  let out = html.replace(
    /<html\b[^>]*>/i,
    `<html lang="${lang}" prefix="og: https://ogp.me/ns# article: https://ogp.me/ns/article#">`,
  );
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${head.title}</title>`);
  out = stripHomeSeo(out);
  out = out.replace(/<title>[^<]*<\/title>/i, (match) => `${match}\n${rankMathBlock(head)}`);
  if (body) {
    const shell = renderArticleBody(body);
    if (!out.includes('news-ssr-hide')) {
      out = out.replace(
        '</head>',
        '    <style id="news-ssr-hide">#app:not(:empty) ~ #news-ssr{display:none}</style>\n  </head>',
      );
    }
    out = out.replace(/<div id="app"><\/div>/i, `<div id="app"></div>\n    ${shell}`);
  }
  return out;
};
