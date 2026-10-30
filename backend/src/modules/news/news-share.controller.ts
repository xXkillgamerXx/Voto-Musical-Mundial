import { Controller, Get, Header, Param, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { loadNewsIndexHtml, paintArticleIndex } from './news-article-html';
import { rssBodyHtml, youtubeVideoIds } from './news-html';
import { buildAuthorProfileGraph, buildNewsArticleGraph } from './news-schema';
import { newsPublicOrigin } from './news-origin';
import { NewsService } from './news.service';

const SITE_NAME = 'Music Mundial';
const DEFAULT_IMAGE_PATH = 'https://www.musicmundial.com/images/portada-1600x900.jpg';
const LOGO_IMAGE_RE =
  /logo-cuadrado|cropped-logo-music-mundial|logo-music-mundial|\/images\/logo(?:-dark)?\.(?:png|webp|jpe?g|svg)/i;
const TITLE_MAX = 110;
const DESC_MAX = 160;

const escapeHtml = (value: unknown) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const stripHtml = (value: unknown) =>
  String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const clip = (value: string, max: number) => {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
};

const toIsoUtc = (value?: string | Date | null) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}+00:00`;
};

const withoutEnLocale = (value: string) =>
  String(value || '')
    .replace(/\/en\/(?!wp-content)/gi, '/')
    .replace(/\/en$/i, '/');

const absolutePath = (origin: string, value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return withoutEnLocale(raw);
  return withoutEnLocale(`${origin}${raw.startsWith('/') ? raw : `/${raw}`}`);
};

const preferredSection = (categories: Array<{ slug?: string; name?: string }>) => {
  const preferred = ['entertainment', 'entretenimiento', 'kpop', 'pop', 'news', 'noticias'];
  return (
    categories.find((item) => preferred.includes(String(item.slug || '').toLowerCase())) ||
    categories[0] ||
    null
  );
};

const formatArticleDate = (value: string, locale: 'es' | 'en') => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return value.slice(0, 10);
  }
};

const imageType = (url: string) => {
  if (/\.png(?:$|\?)/i.test(url)) return 'image/png';
  if (/\.webp(?:$|\?)/i.test(url)) return 'image/webp';
  if (/\.gif(?:$|\?)/i.test(url)) return 'image/gif';
  if (/\.jpe?g(?:$|\?)/i.test(url)) return 'image/jpeg';
  return '';
};

@Controller('news')
export class NewsShareController {
  constructor(
    private readonly news: NewsService,
    private readonly config: ConfigService,
  ) {}

  private origin(req: Request) {
    return newsPublicOrigin(this.config, req);
  }

  private absoluteUrl(value: string, origin: string) {
    const raw = String(value || '').trim();
    if (!raw || LOGO_IMAGE_RE.test(raw)) return DEFAULT_IMAGE_PATH;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('//')) return `https:${raw}`;
    return `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`;
  }

  @Get('share/:slug')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  async articleShareCard(
    @Param('slug') slug: string,
    @Query('locale') localeValue: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const locale = localeValue === 'es' ? 'es' : 'en';
    const origin = this.origin(req);
    let article: Record<string, any> | null = null;
    try {
      article = (await this.news.shareCard(slug, locale)) as Record<string, any> | null;
    } catch {
      article = null;
    }

    const titleRaw = clip(stripHtml(article?.title || SITE_NAME), TITLE_MAX);
    const descriptionRaw = clip(
      stripHtml(
        article?.excerpt ||
          (locale === 'es'
            ? 'Noticias de música, K-POP y entretenimiento en Music Mundial.'
            : 'Music, K-POP and entertainment news on Music Mundial.'),
      ),
      DESC_MAX,
    );
    const path = withoutEnLocale(String(article?.href || (locale === 'es' ? `/es/${slug}` : `/${slug}`)));
    const url = withoutEnLocale(`${origin}${path}`);
    const imageRaw = this.absoluteUrl(String(article?.coverUrl || ''), origin);
    const published = toIsoUtc(article?.publishedAt);
    const modified = toIsoUtc(article?.modifiedAt || article?.publishedAt);
    const ogImageType = imageType(imageRaw);
    if (!article) return res.status(404).end();

    const author = stripHtml(article?.authorName || '');
    const authorHref = withoutEnLocale(
      String(article?.authorHref || (article?.authorSlug ? `/author/${article.authorSlug}` : '')),
    );
    const authorPhoto = String(article?.authorPhotoUrl || '').trim();
    const authorImage =
      authorPhoto && !LOGO_IMAGE_RE.test(authorPhoto)
        ? this.absoluteUrl(authorPhoto, origin) === DEFAULT_IMAGE_PATH
          ? ''
          : this.absoluteUrl(authorPhoto, origin)
        : '';
    const videos = Array.isArray(article?.videos) && article.videos.length
      ? article.videos.map((id: string) => String(id || '').trim()).filter(Boolean)
      : youtubeVideoIds(String(article?.content || ''));
    const description = escapeHtml(descriptionRaw);
    const image = escapeHtml(imageRaw);
    const canonical = escapeHtml(url);
    const enHref = locale === 'en' ? path : String(article?.alternate?.href || '');
    const esHref = locale === 'es' ? path : String(article?.alternate?.href || '');
    const categories = Array.isArray(article?.categories) ? article.categories : [];
    const category = preferredSection(categories);
    const tags = Array.isArray(article?.tags) ? article.tags : [];
    const jsonLd = JSON.stringify(
      buildNewsArticleGraph({
        locale,
        origin,
        url,
        title: stripHtml(article?.title || titleRaw),
        description: clip(stripHtml(article?.excerpt || descriptionRaw), 320),
        image: imageRaw,
        published,
        modified,
        author,
        authorUrl: authorHref,
        authorImage,
        keywords: tags.map((item: { slug?: string; name?: string }) => item.name || item.slug || ''),
        sections: categories.map((item: { name?: string }) => String(item.name || '')),
        categoryName: String(category?.name || article?.category || ''),
        categoryUrl: category?.slug
          ? `${origin}${locale === 'es' ? '/es' : ''}/categoria/${category.slug}`
          : '',
        imageCaption: stripHtml(article?.coverCaption || article?.coverAlt || titleRaw),
        videos,
      }),
    ).replace(/</g, '\\u003c');

    const indexHtml = loadNewsIndexHtml();
    const pageTitle = titleRaw.includes(SITE_NAME) ? escapeHtml(titleRaw) : escapeHtml(`${titleRaw} — ${SITE_NAME}`);
    const html = indexHtml
      ? paintArticleIndex(
          indexHtml,
          {
            locale,
            title: pageTitle,
            description,
            canonical,
            image,
            imageType: ogImageType,
            published,
            modified,
            author: escapeHtml(author),
            section: escapeHtml(String(category?.name || article?.category || '')),
            imageAlt: escapeHtml(String(article?.coverAlt || titleRaw)),
            tags: tags
              .map((item: { name?: string; slug?: string }) => escapeHtml(item.name || item.slug || ''))
              .filter(Boolean),
            jsonLd,
            hreflangEn: enHref ? escapeHtml(absolutePath(origin, enHref)) : '',
            hreflangEs: esHref ? escapeHtml(absolutePath(origin, esHref)) : '',
          },
          {
            locale,
            title: escapeHtml(stripHtml(article?.title || titleRaw)),
            excerpt: escapeHtml(clip(stripHtml(article?.excerpt || ''), 280)),
            author: escapeHtml(author),
            authorHref: authorHref ? escapeHtml(authorHref.startsWith('http') ? authorHref : authorHref) : '',
            byLabel: locale === 'es' ? 'Por' : 'By',
            publishedLabel: escapeHtml(formatArticleDate(String(article?.publishedAt || ''), locale)),
            publishedIso: published,
            image,
            imageAlt: escapeHtml(String(article?.coverAlt || titleRaw)),
            imageCaption: escapeHtml(String(article?.coverCaption || '')),
            categoryName: escapeHtml(String(category?.name || article?.category || '')),
            categoryHref: category?.slug
              ? escapeHtml(`${locale === 'es' ? '/es' : ''}/categoria/${category.slug}`)
              : '',
            homeHref: locale === 'es' ? '/es' : '/',
            bodyHtml: rssBodyHtml(String(article?.content || '')),
            videos,
          },
        )
      : '';
    if (!html) return res.status(404).end();
    return res.status(200).send(html);
  }

  @Get('share-author/:slug')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  async authorShareCard(
    @Param('slug') slug: string,
    @Query('locale') localeValue: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const locale = localeValue === 'es' ? 'es' : 'en';
    const origin = this.origin(req);
    let author: Record<string, any> | null = null;
    try {
      author = (await this.news.findAuthor(slug, locale, 1, 12)) as Record<string, any> | null;
    } catch {
      author = null;
    }
    if (!author) return res.status(404).end();

    const name = stripHtml(author.name || slug);
    const path = withoutEnLocale(String(author.href || (locale === 'es' ? `/es/author/${slug}` : `/author/${slug}`)));
    const url = withoutEnLocale(`${origin}${path}`);
    const descriptionRaw = clip(
      stripHtml(
        author.bio ||
          (locale === 'es'
            ? `${name} escribe en Music Mundial.`
            : `${name} writes for Music Mundial.`),
      ),
      DESC_MAX,
    );
    const imageRaw = this.absoluteUrl(String(author.photoUrl || author.items?.[0]?.coverUrl || ''), origin);
    const jsonLd = JSON.stringify(
      buildAuthorProfileGraph({
        locale,
        origin,
        url,
        name,
        description: descriptionRaw,
        image: imageRaw,
      }),
    ).replace(/</g, '\\u003c');
    const pageTitle = escapeHtml(`${name}, Author at ${SITE_NAME}`);
    const indexHtml = loadNewsIndexHtml();
    const html = indexHtml
      ? paintArticleIndex(
          indexHtml,
          {
            locale,
            ogType: 'profile',
            title: pageTitle,
            description: escapeHtml(descriptionRaw),
            canonical: escapeHtml(url),
            image: escapeHtml(imageRaw),
            imageAlt: escapeHtml(name),
            jsonLd,
            hreflangEn: escapeHtml(absolutePath(origin, `/author/${author.slug || slug}`)),
            hreflangEs: escapeHtml(absolutePath(origin, `/es/author/${author.slug || slug}`)),
          },
          undefined,
          {
            locale,
            name: escapeHtml(name),
            bio: escapeHtml(clip(stripHtml(author.bio || ''), 600)),
            photo: escapeHtml(imageRaw),
            countLabel: `${Number(author.postCount || author.total || 0)} ${locale === 'es' ? 'artículos' : 'articles'}`,
            homeHref: locale === 'es' ? '/es' : '/',
            items: (Array.isArray(author.items) ? author.items : []).map((item: Record<string, any>) => ({
              href: escapeHtml(String(item.href || '')),
              title: escapeHtml(stripHtml(item.title || '')),
              image: escapeHtml(this.absoluteUrl(String(item.coverUrl || ''), origin)),
              category: escapeHtml(String(item.category || '')),
              meta: escapeHtml(
                `${item.authorName ? `${locale === 'es' ? 'Por' : 'By'} ${item.authorName} · ` : ''}${formatArticleDate(
                  String(item.publishedAt || ''),
                  locale,
                )}`,
              ),
            })),
          },
        )
      : '';
    if (!html) return res.status(404).end();
    return res.status(200).send(html);
  }
}
