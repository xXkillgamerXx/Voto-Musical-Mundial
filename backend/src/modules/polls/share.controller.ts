import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { PollsService } from './polls.service';

const DEFAULT_OG_IMAGE = 'https://vote.musicmundial.com/web-app-manifest-512x512.png';
const TWITTER_SITE = '@MusicMundial';
const DEFAULT_DESCRIPTION =
  'Vota por tus artistas favoritos, sigue rondas en vivo y descubre rankings globales de fandoms.';

const escapeHtml = (value: unknown) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const stripHtml = (value: unknown) =>
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (value: string, max = 200) => {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

@Controller('share')
export class ShareController {
  constructor(
    private readonly polls: PollsService,
    private readonly config: ConfigService,
  ) {}

  private siteOrigin() {
    const raw =
      this.config.get<string>('PUBLIC_WEB_ORIGIN') ||
      this.config.get<string>('APP_PUBLIC_ORIGIN') ||
      'https://vote.musicmundial.com';
    return raw.split(',')[0].trim().replace(/\/$/, '') || 'https://vote.musicmundial.com';
  }

  private absoluteUrl(value: string, origin: string) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('//')) return `https:${raw}`;
    return `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`;
  }

  private resolveImage(poll: Record<string, any>, origin: string) {
    const config = asRecord(poll.config);
    const metadata = asRecord(poll.metadata);
    const image =
      poll.banner ||
      poll.cover ||
      poll.coverImage ||
      poll.image ||
      config.banner ||
      config.bannerUrl ||
      config.cover ||
      config.coverImage ||
      config.image ||
      config.imageUrl ||
      metadata.banner ||
      metadata.bannerUrl ||
      metadata.cover ||
      metadata.coverImage ||
      metadata.image ||
      metadata.imageUrl ||
      '';

    return this.absoluteUrl(String(image || ''), origin) || DEFAULT_OG_IMAGE;
  }

  private imageMimeType(imageUrl: string) {
    if (/\.png(?:$|\?)/i.test(imageUrl)) return 'image/png';
    if (/\.webp(?:$|\?)/i.test(imageUrl)) return 'image/webp';
    if (/\.gif(?:$|\?)/i.test(imageUrl)) return 'image/gif';
    if (/\.jpe?g(?:$|\?)/i.test(imageUrl)) return 'image/jpeg';
    return '';
  }

  private resolveLocale(
    poll: Record<string, any> | null,
    slug: string,
    lang?: string,
  ): 'es' | 'en' {
    if (lang === 'en' || lang === 'es') {
      return lang;
    }

    const slugEs = String(poll?.slug || '').trim();
    const slugEn = String(asRecord(poll?.config).slugEn || slugEs).trim();
    const incoming = String(slug || '').trim();

    // Prefer EN only when the path slug is uniquely the English slug.
    if (incoming && slugEn && incoming === slugEn && incoming !== slugEs) {
      return 'en';
    }
    return 'es';
  }

  private resolveCanonicalPath(poll: Record<string, any>, year: string, locale: 'es' | 'en') {
    const config = asRecord(poll.config);
    const slugEs = String(poll.slug || '').trim();
    const slugEn = String(config.slugEn || slugEs).trim();
    const pollYear = String(config.year || year || new Date().getFullYear());
    if (locale === 'en') {
      return `/poll/${pollYear}/${encodeURIComponent(slugEn || slugEs)}`;
    }
    return `/votacion/${pollYear}/${encodeURIComponent(slugEs || slugEn)}`;
  }

  private resolveTitle(poll: Record<string, any> | null, locale: 'es' | 'en') {
    const config = asRecord(poll?.config);
    if (locale === 'en') {
      return String(config.titleEn || poll?.title || 'MUSIC MUNDIAL VOTE');
    }
    return String(poll?.title || config.titleEn || 'MUSIC MUNDIAL VOTE');
  }

  private resolveDescription(poll: Record<string, any> | null, locale: 'es' | 'en') {
    const config = asRecord(poll?.config);
    const raw =
      locale === 'en'
        ? config.descriptionEn || poll?.description || DEFAULT_DESCRIPTION
        : poll?.description || config.descriptionEn || DEFAULT_DESCRIPTION;
    return truncate(stripHtml(raw), 200);
  }

  @Get('poll/:year/:slug')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  async pollShareCard(
    @Param('year') year: string,
    @Param('slug') slug: string,
    @Query('lang') lang: string | undefined,
    @Res() res: Response,
  ) {
    const origin = this.siteOrigin();
    let poll: Record<string, any> | null = null;

    try {
      poll = (await this.polls.findOne(slug)) as Record<string, any>;
    } catch {
      poll = null;
    }

    const locale = this.resolveLocale(poll, slug, lang);
    const titleRaw = this.resolveTitle(poll, locale);
    const descriptionRaw = this.resolveDescription(poll, locale);
    const title = escapeHtml(titleRaw);
    const description = escapeHtml(descriptionRaw);
    const imageRaw = this.resolveImage(poll || {}, origin);
    const image = escapeHtml(imageRaw);
    const imageType = this.imageMimeType(imageRaw);
    const isDefaultImage = imageRaw === DEFAULT_OG_IMAGE;
    const path = poll
      ? this.resolveCanonicalPath(poll, year, locale)
      : `/${locale === 'en' ? 'poll' : 'votacion'}/${encodeURIComponent(year)}/${encodeURIComponent(slug)}`;
    const url = escapeHtml(`${origin}${path}`);
    const ogLocale = locale === 'en' ? 'en_US' : 'es_ES';
    const ogLocaleAlt = locale === 'en' ? 'es_ES' : 'en_US';

    // Crawler-friendly headers: avoid Helmet CSP blocking preview images in body.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    res.setHeader('X-Robots-Tag', 'noindex');

    const imageSizeTags = isDefaultImage
      ? `
  <meta property="og:image:width" content="512" />
  <meta property="og:image:height" content="512" />`
      : `
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />`;

    const imageTypeTag = imageType
      ? `
  <meta property="og:image:type" content="${escapeHtml(imageType)}" />`
      : '';

    const html = `<!doctype html>
<html lang="${locale}" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${url}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="MUSIC MUNDIAL VOTE" />
  <meta property="og:locale" content="${ogLocale}" />
  <meta property="og:locale:alternate" content="${ogLocaleAlt}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:secure_url" content="${image}" />
  <meta property="og:image:alt" content="${title}" />${imageTypeTag}${imageSizeTags}

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="${TWITTER_SITE}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="twitter:image:alt" content="${title}" />
  <meta name="twitter:url" content="${url}" />
</head>
<body>
  <p><a href="${url}">${title}</a></p>
  <img src="${image}" alt="${title}" width="1200" height="630" />
</body>
</html>`;

    return res.status(200).send(html);
  }
}
