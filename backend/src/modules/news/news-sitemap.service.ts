import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { newsPublicOrigin } from './news-origin';
import { NewsLocale, NewsMysqlService } from './news-mysql';

export const SITEMAP_PAGE_SIZE = 2000;

/** Current calendar year plus the previous year (drop 2022–2024-style archives). */
const SITEMAP_CURRENT_SQL = `p.post_type = 'post' AND p.post_status = 'publish' AND p.post_date >= MAKEDATE(YEAR(CURDATE()) - 1, 1)`;

export const sitemapPageHref = (locale: NewsLocale, page: number) =>
  locale === 'es' ? `/es/sitemap-${page}.xml` : `/sitemap-${page}.xml`;

const publicHref = (locale: NewsLocale, suffix = '') => {
  const rest = String(suffix || '').replace(/^\/+/, '');
  if (locale === 'es') return rest ? `/es/${rest}` : '/es';
  return rest ? `/${rest}` : '/';
};

const largeNewsImage = (url?: string | null) => {
  const raw = String(url || '').trim();
  if (!raw) return raw;
  return raw.replace(/-(?:scaled|[0-9]+x[0-9]+)(?=\.(?:jpe?g|png|webp|gif)(?:\?|#|$))/i, '');
};

@Injectable()
export class NewsSitemapService {
  private readonly logger = new Logger(NewsSitemapService.name);
  private lastPingAt = 0;

  constructor(
    private readonly mysql: NewsMysqlService,
    private readonly config: ConfigService,
  ) {}

  publicOrigin() {
    return newsPublicOrigin(this.config);
  }

  async listPage(localeValue: string | undefined, page: number, limit = SITEMAP_PAGE_SIZE) {
    const locale = this.mysql.locale(localeValue);
    const safePage = Math.max(1, Number(page || 1));
    const safeLimit = Math.min(5000, Math.max(1, Number(limit || SITEMAP_PAGE_SIZE)));
    const offset = (safePage - 1) * safeLimit;
    const rows = await this.mysql.query<{
      post_name: string;
      post_title: string;
      post_date: Date | string;
      post_modified: Date | string;
      cover_url: string | null;
      alt_slug: string | null;
    }>(
      locale,
      `SELECT p.post_name, p.post_title, p.post_date, p.post_modified, att.guid AS cover_url, alt.meta_value AS alt_slug
       FROM wpgn_posts p
       LEFT JOIN wpgn_postmeta th ON th.post_id = p.ID AND th.meta_key = '_thumbnail_id'
       LEFT JOIN wpgn_posts att ON att.ID = CAST(th.meta_value AS UNSIGNED)
       LEFT JOIN wpgn_postmeta alt ON alt.post_id = p.ID AND alt.meta_key = '_vmm_alt_slug'
       WHERE ${SITEMAP_CURRENT_SQL}
       ORDER BY p.post_date DESC, p.ID DESC
       LIMIT ? OFFSET ?`,
      [safeLimit, offset],
    );
    const other: NewsLocale = locale === 'es' ? 'en' : 'es';
    return rows.map((row) => ({
      slug: row.post_name,
      title: row.post_title,
      href: publicHref(locale, row.post_name),
      publishedAt: row.post_date,
      modifiedAt: row.post_modified || row.post_date,
      coverUrl: largeNewsImage(row.cover_url) || null,
      altHref: row.alt_slug ? publicHref(other, row.alt_slug) : '',
      locale,
    }));
  }

  async listNews(localeValue?: string, hours = 48) {
    const locale = this.mysql.locale(localeValue);
    const windowHours = Math.min(72, Math.max(24, Number(hours || 48)));
    const rows = await this.mysql.query<{
      post_name: string;
      post_title: string;
      post_date: Date | string;
      post_modified: Date | string;
      cover_url: string | null;
      alt_slug: string | null;
    }>(
      locale,
      `SELECT p.post_name, p.post_title, p.post_date, p.post_modified, att.guid AS cover_url, alt.meta_value AS alt_slug
       FROM wpgn_posts p
       LEFT JOIN wpgn_postmeta th ON th.post_id = p.ID AND th.meta_key = '_thumbnail_id'
       LEFT JOIN wpgn_posts att ON att.ID = CAST(th.meta_value AS UNSIGNED)
       LEFT JOIN wpgn_postmeta alt ON alt.post_id = p.ID AND alt.meta_key = '_vmm_alt_slug'
       WHERE p.post_type = 'post' AND p.post_status = 'publish'
         AND p.post_date >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       ORDER BY p.post_date DESC, p.ID DESC
       LIMIT 1000`,
      [windowHours],
    );
    const other: NewsLocale = locale === 'es' ? 'en' : 'es';
    return rows.map((row) => ({
      slug: row.post_name,
      title: row.post_title,
      href: publicHref(locale, row.post_name),
      publishedAt: row.post_date,
      modifiedAt: row.post_modified || row.post_date,
      coverUrl: largeNewsImage(row.cover_url) || null,
      altHref: row.alt_slug ? publicHref(other, row.alt_slug) : '',
      locale,
    }));
  }

  async indexEntries(localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    const newsRows = await this.mysql.query<{ lastmod: Date | string | null }>(
      locale,
      `SELECT MAX(p.post_date) AS lastmod
       FROM wpgn_posts p
       WHERE p.post_type = 'post' AND p.post_status = 'publish'
         AND p.post_date >= DATE_SUB(NOW(), INTERVAL 48 HOUR)`,
    );
    const countRows = await this.mysql.query<{ total: number }>(
      locale,
      `SELECT COUNT(*) AS total FROM wpgn_posts p WHERE ${SITEMAP_CURRENT_SQL}`,
    );
    const total = Number(countRows[0]?.total || 0);
    const pageCount = Math.max(0, Math.ceil(total / SITEMAP_PAGE_SIZE));
    const pages: { page: number; lastmod: Date | string | null }[] = [];
    for (let page = 1; page <= pageCount; page += 1) {
      const offset = (page - 1) * SITEMAP_PAGE_SIZE;
      const rows = await this.mysql.query<{ lastmod: Date | string | null }>(
        locale,
        `SELECT MAX(p.post_date) AS lastmod
         FROM (
           SELECT post_date
           FROM wpgn_posts p
           WHERE ${SITEMAP_CURRENT_SQL}
           ORDER BY p.post_date DESC, p.ID DESC
           LIMIT ? OFFSET ?
         ) p`,
        [SITEMAP_PAGE_SIZE, offset],
      );
      pages.push({ page, lastmod: rows[0]?.lastmod || null });
    }
    return {
      locale,
      newsLastmod: newsRows[0]?.lastmod || null,
      pages,
    };
  }

  async notify(localeValue?: string) {
    const now = Date.now();
    if (now - this.lastPingAt < 120_000) return;
    const origin = this.publicOrigin();
    if (!origin) return;
    this.lastPingAt = now;
    const locale = this.mysql.locale(localeValue);
    const urls =
      locale === 'es'
        ? [`${origin}/es/sitemap_index.xml`, `${origin}/es/news-sitemap.xml`]
        : [`${origin}/sitemap_index.xml`, `${origin}/news-sitemap.xml`, `${origin}/es/sitemap_index.xml`];
    await Promise.all(urls.map((url) => this.ping(url)));
  }

  async refreshAll() {
    this.lastPingAt = 0;
    await this.notify('en');
  }

  private async ping(sitemapUrl: string) {
    const encoded = encodeURIComponent(sitemapUrl);
    const targets = [
      `https://www.google.com/ping?sitemap=${encoded}`,
      `https://www.bing.com/ping?sitemap=${encoded}`,
    ];
    await Promise.all(
      targets.map(async (url) => {
        try {
          const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) });
          this.logger.log(`sitemap ping ${res.status} ${url}`);
        } catch (error) {
          this.logger.warn(`sitemap ping failed ${url}: ${String(error)}`);
        }
      }),
    );
  }
}
