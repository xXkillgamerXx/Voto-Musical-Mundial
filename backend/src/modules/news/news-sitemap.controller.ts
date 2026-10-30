import { Controller, Get, Header, Param, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { newsPublicOrigin } from './news-origin';
import { NewsSitemapService, SITEMAP_PAGE_SIZE, sitemapPageHref } from './news-sitemap.service';

const SITE_NAME = 'Music Mundial';

const escapeXml = (value: unknown) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const pad = (value: number) => String(value).padStart(2, '0');

const toIso = (value?: string | Date | null) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}+00:00`;
};

type SitemapRow = {
  href: string;
  title: string;
  publishedAt?: string | Date;
  modifiedAt?: string | Date;
  coverUrl?: string | null;
  altHref?: string;
  locale: 'es' | 'en';
};

@Controller('news/sitemaps')
export class NewsSitemapController {
  constructor(
    private readonly sitemaps: NewsSitemapService,
    private readonly config: ConfigService,
  ) {}

  private origin(req: Request) {
    return newsPublicOrigin(this.config, req);
  }

  private abs(origin: string, path: string) {
    if (/^https?:\/\//i.test(path)) return path;
    return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  private xmlHeader(origin: string) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="${escapeXml(`${origin}/main-sitemap.xsl`)}"?>`;
  }

  private hreflangLinks(origin: string, row: SitemapRow) {
    const loc = this.abs(origin, row.href);
    const alt = row.altHref ? this.abs(origin, row.altHref) : '';
    const en = row.locale === 'en' ? loc : alt;
    const es = row.locale === 'es' ? loc : alt;
    const links = [
      en ? `<xhtml:link rel="alternate" hreflang="en" href="${escapeXml(en)}" />` : '',
      en ? `<xhtml:link rel="alternate" hreflang="en-US" href="${escapeXml(en)}" />` : '',
      es ? `<xhtml:link rel="alternate" hreflang="es" href="${escapeXml(es)}" />` : '',
      es ? `<xhtml:link rel="alternate" hreflang="es-ES" href="${escapeXml(es)}" />` : '',
      `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(en || loc)}" />`,
    ];
    return links.filter(Boolean).join('');
  }

  private urlEntry(origin: string, row: SitemapRow, news = false) {
    const loc = this.abs(origin, row.href);
    const image = row.coverUrl ? this.abs(origin, row.coverUrl) : '';
    const language = row.locale === 'es' ? 'es' : 'en';
    const newsBlock = news
      ? `<news:news>
      <news:publication>
        <news:name>${SITE_NAME}</news:name>
        <news:language>${language}</news:language>
      </news:publication>
      <news:publication_date>${escapeXml(toIso(row.publishedAt))}</news:publication_date>
      <news:title>${escapeXml(row.title)}</news:title>
    </news:news>`
      : '';
    const imageBlock = image
      ? `<image:image>
      <image:loc>${escapeXml(image)}</image:loc>
      <image:title>${escapeXml(row.title)}</image:title>
    </image:image>`
      : '';
    return `<url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(toIso(row.modifiedAt || row.publishedAt))}</lastmod>
    ${newsBlock}
    ${imageBlock}
    ${this.hreflangLinks(origin, row)}
  </url>`;
  }

  private sendXml(res: Response, body: string) {
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Content-Type', 'text/xml; charset=UTF-8');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).send(body);
  }

  @Get('index')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async index(@Req() req: Request, @Res() res: Response) {
    return this.sendIndex(req, res, 'en');
  }

  @Get('index/:locale')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async indexLocale(@Param('locale') locale: string, @Req() req: Request, @Res() res: Response) {
    return this.sendIndex(req, res, locale === 'es' ? 'es' : 'en');
  }

  @Get('news')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async newsAll(@Req() req: Request, @Res() res: Response) {
    const origin = this.origin(req);
    const rows = await this.sitemaps.listNews('en');
    return this.sendNews(res, origin, rows);
  }

  @Get('news/:locale')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async newsLocale(@Param('locale') locale: string, @Req() req: Request, @Res() res: Response) {
    const origin = this.origin(req);
    const rows = await this.sitemaps.listNews(locale === 'es' ? 'es' : 'en');
    return this.sendNews(res, origin, rows);
  }

  @Get(':locale/:page')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async page(
    @Param('locale') locale: string,
    @Param('page') page: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const origin = this.origin(req);
    const lang = locale === 'es' ? 'es' : 'en';
    const rows = await this.sitemaps.listPage(lang, Number(page || 1), SITEMAP_PAGE_SIZE);
    if (!rows.length) {
      res.removeHeader('Content-Security-Policy');
      return res.status(404).type('text/plain').send('');
    }
    const body = `${this.xmlHeader(origin)}
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  ${rows.map((row) => this.urlEntry(origin, row)).join('\n  ')}
</urlset>`;
    return this.sendXml(res, body);
  }

  private async sendIndex(req: Request, res: Response, locale: 'es' | 'en') {
    const origin = this.origin(req);
    const index = await this.sitemaps.indexEntries(locale);
    const newsPath = locale === 'es' ? '/es/news-sitemap.xml' : '/news-sitemap.xml';
    const fallback = toIso(index.pages[0]?.lastmod || index.newsLastmod || new Date());
    const items = [
      `<sitemap><loc>${escapeXml(`${origin}${newsPath}`)}</loc><lastmod>${escapeXml(toIso(index.newsLastmod) || fallback)}</lastmod></sitemap>`,
    ];
    for (const page of index.pages) {
      items.push(
        `<sitemap><loc>${escapeXml(`${origin}${sitemapPageHref(locale, page.page)}`)}</loc><lastmod>${escapeXml(toIso(page.lastmod) || fallback)}</lastmod></sitemap>`,
      );
    }
    return this.sendXml(
      res,
      `${this.xmlHeader(origin)}
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${items.join('\n  ')}
</sitemapindex>`,
    );
  }

  private sendNews(res: Response, origin: string, rows: SitemapRow[]) {
    const body = `${this.xmlHeader(origin)}
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  ${rows.map((row) => this.urlEntry(origin, row, true)).join('\n  ')}
</urlset>`;
    return this.sendXml(res, body);
  }
}
