import { createHash, randomBytes } from 'crypto';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BLOCKED_LANGUAGE_MESSAGE, isCommentLanguageBlocked } from '../../common/comment-profanity';
import { normalizeSlug } from '../../common/poll-lookup';
import { serialize } from '../../common/serialize';
import { PrismaService } from '../prisma/prisma.service';
import { ListNewsDto } from './dto/list-news.dto';
import { UpsertNewsPostDto } from './dto/upsert-news-post.dto';
import { NewsLocale, NewsMysqlService } from './news-mysql';
import { ensureImageAlts, expandNewsEmbeds, firstYoutubeEmbed, plainExcerpt, rssBodyHtml, sanitizeNewsHtml, youtubeVideoIds } from './news-html';
import { NewsSitemapService } from './news-sitemap.service';
import {
  SITE_PAGE_META_KEY,
  SITE_PAGES,
  sitePageByKey,
  sitePageBySlug,
  sitePageHref,
} from './news-site-pages';

type NewsActor = { id: bigint; role?: string };
type NewsAttachment = { url: string; type: string; name: string };
type NewsCommentGif = { url: string; title: string; source: string };
type NewsCommentRow = {
  id: number;
  post_id: number;
  parent_id: number | null;
  user_id: string;
  author_name: string;
  author_username: string | null;
  author_photo: string | null;
  body: string;
  gif?: string | NewsCommentGif | null;
  created_at: Date | string;
};

type PostRow = {
  ID: number;
  post_title: string;
  post_name: string;
  post_excerpt: string;
  post_content: string;
  post_date: Date | string;
  post_modified?: Date | string;
  post_status?: string;
  post_author?: number;
  comment_count: number;
  author_name?: string | null;
  author_nicename?: string | null;
  author_email?: string | null;
  cover_url?: string | null;
  cover_caption?: string | null;
  cover_alt?: string | null;
  view_count?: number;
};

type TermRow = { object_id: number; term_id?: number; slug: string; name: string };

const fromWpStatus = (value?: string) => {
  if (value === 'future') return 'scheduled';
  if (value === 'draft' || value === 'pending' || value === 'private') return 'draft';
  if (value === 'trash') return 'trash';
  return 'publish';
};

const toWpStatus = (value?: string) => {
  if (value === 'scheduled') return 'future';
  if (value === 'draft') return 'draft';
  if (value === 'trash') return 'trash';
  return 'publish';
};

const NAV_SLUGS = new Set([
  'kpop',
  'pop',
  'viral',
  'series',
  'celebridades',
  'noticias',
  'peliculas',
  'entrevista',
  'redes-sociales',
]);

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

const gravatarUrl = (email?: string | null) => {
  const key = String(email || '')
    .trim()
    .toLowerCase();
  if (!key || !key.includes('@')) return '';
  return `https://www.gravatar.com/avatar/${createHash('md5').update(key).digest('hex')}?s=256&d=mp`;
};

const firstImage = (html: string) => {
  const match = String(html || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  const url = match?.[1]?.replace(/\\\//g, '/');
  if (!url) return null;
  const absolute = url.startsWith('//') ? `https:${url}` : url;
  return largeNewsImage(absolute);
};

const toCard = (post: PostRow, categories: Array<{ slug: string; name: string }>, locale: NewsLocale = 'es') => {
  const category = categories[0];
  const excerpt = String(post.post_excerpt || '').trim() || plainExcerpt(post.post_content);
  return {
    id: String(post.ID),
    slug: post.post_name,
    title: post.post_title,
    excerpt,
    coverUrl: largeNewsImage(post.cover_url) || firstImage(post.post_content),
    coverCaption: String(post.cover_caption || '').trim() || undefined,
    coverAlt: String(post.cover_alt || '').trim() || String(post.post_title || '').trim() || undefined,
    featured: false,
    status: fromWpStatus(post.post_status),
    wpAuthorId: post.post_author ? String(post.post_author) : undefined,
    authorName: post.author_name || (locale === 'en' ? 'Staff' : 'Redacción'),
    authorSlug: post.author_nicename || undefined,
    authorHref: post.author_nicename ? publicHref(locale, `author/${post.author_nicename}`) : undefined,
    authorPhotoUrl: gravatarUrl(post.author_email) || undefined,
    publishedAt: post.post_date,
    modifiedAt: post.post_modified || post.post_date,
    viewCount: Number(post.view_count || 0),
    commentCount: Number(post.comment_count || 0),
    category: category?.name || (locale === 'en' ? 'News' : 'Noticias'),
    categorySlug: category?.slug || 'noticias',
    categories,
    href: publicHref(locale, post.post_name),
    locale,
  };
};

const LEGACY_RESERVED = new Set([
  'es',
  'en',
  'vote',
  'api',
  'uploads',
  'images',
  'assets',
  'feed',
  'admin',
  'perfil',
  'profile',
  'user',
  'categoria',
  'categorias',
  'categories',
  'category',
  'kpop',
  'k-pop',
  'noticias',
  'viral',
  'pop',
  'series',
  'celebridades',
  'entretenimiento',
  'peliculas',
  'k-drama',
  'author',
  'forum',
  'foro',
]);

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    private readonly mysql: NewsMysqlService,
    private readonly prisma: PrismaService,
    private readonly sitemaps: NewsSitemapService,
  ) {}

  async listPublic(input: ListNewsDto & { locale?: string }) {
    const locale = this.mysql.locale(input.locale);
    const page = Math.max(1, Number(input.page || 1));
    const limit = Math.min(50, Math.max(1, Number(input.limit || 12)));
    const category = normalizeSlug(input.category);
    const q = String(input.q || '').trim();
    const author = normalizeSlug(input.author);
    const { items, total } = await this.loadPosts(locale, {
      page,
      limit,
      category,
      q,
      authorSlug: author,
    });
    return serialize({ page, limit, total, items });
  }

  async home(localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    const feed = { page: 1, skipCount: true as const };
    const [latest, kpop, pop, viral, series, social, interviews, categoryList] = await Promise.all([
      this.loadPosts(locale, { ...feed, limit: 24 }),
      // Pull extra K-POP rows so the home block still fills after hero/card dedupe
      // (EN homepage is often almost all kpop, which used to leave this section empty).
      this.loadPosts(locale, { ...feed, limit: 24, slugs: ['kpop', 'k-pop'] }),
      this.loadPosts(locale, { ...feed, limit: 16, slugs: ['pop'] }),
      this.loadPosts(locale, { ...feed, limit: 16, slugs: ['viral'] }),
      this.loadPosts(locale, { ...feed, limit: 16, slugs: ['series', 'cine', 'peliculas', 'k-drama'] }),
      this.loadPosts(locale, { ...feed, limit: 12, slugs: ['redes-sociales'] }),
      this.loadPosts(locale, { ...feed, limit: 12, slugs: ['entrevista', 'entrevistas'] }),
      this.categories(localeValue),
    ]);
    const take = (items: typeof latest.items, count: number, bag: Set<string>) => {
      const picked: typeof latest.items = [];
      for (const item of items) {
        if (bag.has(item.id)) continue;
        bag.add(item.id);
        picked.push(item);
        if (picked.length >= count) break;
      }
      return picked;
    };
    /** Prefer unique posts; if dedupe wipes the section, still show category stories. */
    const takeSection = (items: typeof latest.items, count: number, preferUnique: Set<string>) => {
      const unique = take(items, count, new Set(preferUnique));
      if (unique.length) return unique;
      return take(items, count, new Set());
    };
    const pool = latest.items;
    const fallback = [...pool, ...viral.items, ...kpop.items];
    const above = new Set<string>();
    const spotlight = take(pool, 2, above);
    const cards = take(pool, 8, above);
    const trends = take(viral.items.length ? viral.items : fallback, 5, above);
    const entertainment = take(
      [...kpop.items, ...viral.items, ...fallback],
      4,
      above,
    );
    const avoidHero = () => new Set([...spotlight, ...cards].map((item) => item.id));
    const kpopSource = kpop.items.length ? kpop.items : fallback;
    const seriesSource = series.items.length ? series.items : fallback;
    const popSource = pop.items.length ? pop.items : fallback;
    const socialSource = social.items.length ? social.items : fallback;
    const interviewSource = interviews.items.length ? interviews.items : fallback;
    const kpopBlock = takeSection(kpopSource, 6, avoidHero());
    const seriesBlock = takeSection(seriesSource, 5, avoidHero());
    const popBlock = takeSection(popSource, 6, avoidHero());
    const more = takeSection(pool.length ? pool : fallback, 8, avoidHero());
    const socialBlock = takeSection(socialSource, 4, avoidHero());
    const interviewBlock = takeSection(interviewSource, 4, avoidHero());
    const covers = new Map<string, string>();
    for (const item of [...latest.items, ...kpop.items, ...pop.items, ...viral.items, ...series.items, ...social.items, ...interviews.items]) {
      if (!item.coverUrl) continue;
      if (item.categorySlug && !covers.has(item.categorySlug)) covers.set(item.categorySlug, item.coverUrl);
      for (const cat of item.categories || []) {
        if (cat.slug && !covers.has(cat.slug)) covers.set(cat.slug, item.coverUrl);
      }
    }
    return serialize({
      locale,
      spotlight,
      cards,
      trends,
      entertainment,
      kpop: kpopBlock,
      series: seriesBlock,
      pop: popBlock,
      more,
      social: socialBlock,
      interviews: interviewBlock,
      categories: categoryList.map((row: { slug: string; coverUrl?: string | null }) => ({
        ...row,
        coverUrl: covers.get(row.slug) || null,
      })),
    });
  }

  async popular(localeValue?: string, excludeSlug?: string, limitValue = 5) {
    const locale = this.mysql.locale(localeValue);
    const limit = Math.min(8, Math.max(1, Number(limitValue || 5)));
    const exclude = String(excludeSlug || '').trim();
    const items = await this.popularWindow(locale, 90, exclude, limit);
    return serialize({ locale, days: 90, items });
  }

  async findAuthor(slug: string, localeValue?: string, pageValue = 1, limitValue = 18) {
    const locale = this.mysql.locale(localeValue);
    const nicename = String(slug || '')
      .trim()
      .toLowerCase();
    if (!nicename) throw new NotFoundException('No encontramos a ese autor.');
    const profile = await this.authorProfile(locale, nicename);
    if (!profile) throw new NotFoundException('No encontramos a ese autor.');
    const page = Math.max(1, Number(pageValue || 1));
    const limit = Math.min(50, Math.max(1, Number(limitValue || 18)));
    const { items, total } = await this.loadPosts(locale, {
      page,
      limit,
      authorId: profile.id,
    });
    const photo =
      items.find((item) => item.authorPhotoUrl && !/gravatar\.com/i.test(String(item.authorPhotoUrl)))?.authorPhotoUrl ||
      profile.photoUrl;
    return serialize({
      ...profile,
      photoUrl: photo,
      href: publicHref(locale, `author/${profile.slug}`),
      locale,
      page,
      limit,
      total,
      postCount: total,
      items,
    });
  }

  async findBySlug(slug: string, localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    const key = String(slug || '').trim();
    let post = await this.lookupPublished(locale, key);
    if (!post) {
      post = await this.lookupTranslated(locale, key);
    }
    if (!post) throw new NotFoundException('No encontramos esa noticia.');
    return this.presentArticle(locale, post);
  }

  async legacySpanishRedirect(slug: string) {
    const key = String(slug || '')
      .trim()
      .replace(/^\/+|\/+$/g, '');
    if (!key || key.includes('/') || key.includes('.') || LEGACY_RESERVED.has(key.toLowerCase())) {
      return null;
    }
    const english = await this.lookupPublished('en', key);
    if (english) return null;
    const spanish = await this.lookupPublished('es', key);
    if (!spanish) return null;
    return `/es/${key}`;
  }

  async shareCard(slug: string, localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    const key = String(slug || '').trim();
    const post = (await this.lookupPublished(locale, key)) || (await this.lookupTranslated(locale, key));
    if (!post) return null;
    const cats = await this.categoriesFor(locale, [post.ID]);
    const [card] = await this.withAuthors(locale, [toCard(post, cats.get(post.ID) || [], locale)]);
    const tags = await this.tagsFor(locale, [post.ID]);
    const author = post.author_nicename ? await this.authorProfile(locale, post.author_nicename) : null;
    return {
      ...card,
      authorBio: author?.bio || '',
      authorPhotoUrl: card.authorPhotoUrl || author?.photoUrl || '',
      authorPostCount: author?.postCount || 0,
      content: post.post_content || '',
      videos: youtubeVideoIds(post.post_content || ''),
      tags: (tags.get(post.ID) || []).map((item) => ({ slug: item.slug, name: item.name })),
      alternate: await this.alternateFor(locale, post),
    };
  }

  async categories(localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    const rows = await this.mysql.query<{ term_id: number; slug: string; name: string; count: number }>(
      locale,
      `SELECT t.term_id, t.slug, t.name, tt.count
       FROM wpgn_terms t
       JOIN wpgn_term_taxonomy tt ON tt.term_id = t.term_id
       WHERE tt.taxonomy = 'category'
       ORDER BY tt.count DESC, t.name ASC`,
    );
    return serialize(
      rows.map((row, index) => ({
        id: String(row.term_id),
        slug: row.slug,
        name: String(row.name || '').replace(/&amp;/g, '&'),
        description: '',
        nav: NAV_SLUGS.has(row.slug),
        order: NAV_SLUGS.has(row.slug) ? index : 100 + index,
        postCount: Number(row.count || 0),
        href: publicHref(locale, `${locale === 'en' ? 'category' : 'categoria'}/${row.slug}`),
      })),
    );
  }

  async adminList(input: {
    page?: number;
    limit?: number;
    q?: string;
    status?: string;
    locale?: string;
    author?: string;
    from?: string;
    to?: string;
  }) {
    const locale = this.mysql.locale(input.locale);
    const page = Math.max(1, Number(input.page || 1));
    const limit = Math.min(50, Math.max(1, Number(input.limit || 20)));
    const q = String(input.q || '').trim();
    const status = String(input.status || '').trim();
    const author = String(input.author || '').trim();
    const from = /^\d{4}-\d{2}-\d{2}$/.test(String(input.from || '')) ? String(input.from) : '';
    const to = /^\d{4}-\d{2}-\d{2}$/.test(String(input.to || '')) ? String(input.to) : '';
    const where = [`p.post_type = 'post'`];
    const params: unknown[] = [];
    if (status === 'scheduled') {
      where.push(`p.post_status = 'future'`);
    } else if (status === 'draft') {
      where.push(`p.post_status IN ('draft', 'pending', 'private')`);
    } else if (status === 'trash') {
      where.push(`p.post_status = 'trash'`);
    } else if (status === 'publish') {
      where.push(`p.post_status = 'publish'`);
    } else {
      where.push(`p.post_status IN ('publish', 'draft', 'future', 'pending', 'private')`);
    }
    if (q) {
      where.push('(p.post_title LIKE ? OR p.post_name LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    if (author) {
      where.push('(u.display_name LIKE ? OR u.user_nicename LIKE ? OR u.user_login LIKE ?)');
      params.push(`%${author}%`, `%${author}%`, `%${author}%`);
    }
    if (from) {
      where.push('p.post_date >= ?');
      params.push(`${from} 00:00:00`);
    }
    if (to) {
      where.push('p.post_date < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(`${to} 00:00:00`);
    }
    const whereSql = where.join(' AND ');
    const offset = (page - 1) * limit;
    const rows = await this.mysql.query<PostRow>(
      locale,
      `${this.postSelect(true)} WHERE ${whereSql} ORDER BY p.post_date DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    const cats = await this.categoriesFor(locale, rows.map((row) => row.ID));
    const items = await this.withAuthors(
      locale,
      rows.map((row) => toCard(row, cats.get(row.ID) || [], locale)),
    );
    const countFrom = author
      ? 'FROM wpgn_posts p LEFT JOIN wpgn_users u ON u.ID = p.post_author'
      : 'FROM wpgn_posts p';
    const countRows = await this.mysql.query<{ total: number }>(
      locale,
      `SELECT COUNT(*) AS total ${countFrom} WHERE ${whereSql}`,
      params,
    );
    return serialize({ page, limit, total: Number(countRows[0]?.total || 0), items, locale });
  }

  private async adminAuthorsLocale(locale: NewsLocale, q = '') {
    const query = String(q || '').trim();
    const like = `%${query}%`;
    const rows = await this.mysql.query<{
      ID: number;
      display_name: string;
      user_email: string;
      user_login: string;
      user_nicename: string;
      user_url: string;
      posts: number | string;
    }>(
      locale,
      `SELECT u.ID, u.display_name, u.user_email, u.user_login, u.user_nicename, u.user_url,
        COALESCE(pc.posts, 0) AS posts
       FROM wpgn_users u
       LEFT JOIN (
         SELECT post_author, COUNT(*) AS posts
         FROM wpgn_posts
         WHERE post_type = 'post' AND post_status IN ('publish', 'draft', 'future', 'pending', 'private')
         GROUP BY post_author
       ) pc ON pc.post_author = u.ID
       ${
         query
           ? 'WHERE (u.display_name LIKE ? OR u.user_nicename LIKE ? OR u.user_login LIKE ? OR u.user_email LIKE ?)'
           : ''
       }
       ORDER BY COALESCE(pc.posts, 0) DESC, u.display_name ASC
       LIMIT 200`,
      query ? [like, like, like, like] : [],
    );

    const ids = rows.map((row) => Number(row.ID)).filter((id) => id > 0);
    const metaByUser = new Map<number, { bio: string; photo: string; site: string }>();
    if (ids.length) {
      try {
        const metas = await this.mysql.query<{ user_id: number; meta_key: string; meta_value: string }>(
          locale,
          `SELECT user_id, meta_key, meta_value
           FROM wpgn_usermeta
           WHERE user_id IN (${ids.map(() => '?').join(',')})
             AND meta_key IN ('description', 'vmm_avatar', 'vmm_website')`,
          ids,
        );
        for (const meta of metas) {
          const current = metaByUser.get(Number(meta.user_id)) || { bio: '', photo: '', site: '' };
          if (meta.meta_key === 'description') current.bio = String(meta.meta_value || '');
          if (meta.meta_key === 'vmm_avatar') current.photo = String(meta.meta_value || '');
          if (meta.meta_key === 'vmm_website') current.site = String(meta.meta_value || '');
          metaByUser.set(Number(meta.user_id), current);
        }
      } catch (error) {
        this.logger.warn(`adminAuthors meta(${locale}) failed: ${error instanceof Error ? error.message : error}`);
      }
    }

    return rows.map((row) => {
      const linked = String(row.user_url || '').startsWith('vmm:');
      const slug = row.user_nicename || row.user_login;
      const meta = metaByUser.get(Number(row.ID)) || { bio: '', photo: '', site: '' };
      return {
        id: String(row.ID),
        name: row.display_name || row.user_login,
        email: row.user_email || '',
        login: row.user_login,
        slug,
        bio: meta.bio,
        photoUrl: meta.photo || gravatarUrl(row.user_email),
        website: linked ? meta.site : String(row.user_url || ''),
        linkedUserId: linked ? String(row.user_url).slice(4) : '',
        postCount: Number(row.posts || 0),
        href: publicHref(locale, `author/${slug}`),
        locale,
      };
    });
  }

  async adminAuthors(localeValue?: string, q?: string) {
    const locale = this.mysql.locale(localeValue);
    try {
      return serialize(await this.adminAuthorsLocale(locale, q));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`adminAuthors(${locale}) failed: ${message}`);
      throw new BadRequestException(`No se pudieron cargar autores (${locale}): ${message.slice(0, 180)}`);
    }
  }

  async adminUpdateAuthor(
    id: string,
    body: {
      locale?: string;
      name?: string;
      bio?: string;
      website?: string;
      photoUrl?: string;
      linkedUserId?: string | null;
    },
  ) {
    const locale = this.mysql.locale(body.locale);
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) throw new NotFoundException('No encontramos a ese autor.');
    const rows = await this.mysql.query<{ ID: number; user_nicename: string; user_url: string }>(
      locale,
      `SELECT ID, user_nicename, user_url FROM wpgn_users WHERE ID = ? LIMIT 1`,
      [userId],
    );
    const user = rows[0];
    if (!user) throw new NotFoundException('No encontramos a ese autor.');
    const name = String(body.name || '').trim();
    if (name) {
      await this.mysql.exec(locale, `UPDATE wpgn_users SET display_name = ? WHERE ID = ?`, [name.slice(0, 250), userId]);
    }
    if (body.linkedUserId !== undefined) {
      const linked = String(body.linkedUserId || '').trim();
      if (linked) {
        const account = await this.prisma.user.findUnique({
          where: { id: BigInt(linked) },
          select: { id: true, username: true, email: true, displayName: true },
        });
        if (!account) throw new BadRequestException('La cuenta de Vote Music Mundial no existe.');
        const previousUrl = String(user.user_url || '');
        if (previousUrl && !previousUrl.startsWith('vmm:')) {
          await this.setUserMeta(locale, userId, 'vmm_website', previousUrl.slice(0, 300));
        }
        await this.mysql.exec(
          locale,
          `UPDATE wpgn_users SET user_url = ?, user_email = ?, user_nicename = ?, display_name = ? WHERE ID = ?`,
          [
            `vmm:${account.id}`,
            String(account.email || user.user_nicename).slice(0, 100),
            String(account.username || user.user_nicename).toLowerCase().slice(0, 50),
            String(account.displayName || account.username || name || user.user_nicename).slice(0, 250),
            userId,
          ],
        );
      } else if (String(user.user_url || '').startsWith('vmm:')) {
        const site = await this.mysql.query<{ meta_value: string }>(
          locale,
          `SELECT meta_value FROM wpgn_usermeta WHERE user_id = ? AND meta_key = 'vmm_website' LIMIT 1`,
          [userId],
        );
        await this.mysql.exec(locale, `UPDATE wpgn_users SET user_url = ? WHERE ID = ?`, [
          String(site[0]?.meta_value || ''),
          userId,
        ]);
      }
    }
    const fresh = await this.mysql.query<{ user_url: string; user_nicename: string }>(
      locale,
      `SELECT user_url, user_nicename FROM wpgn_users WHERE ID = ? LIMIT 1`,
      [userId],
    );
    const currentUrl = String(fresh[0]?.user_url || user.user_url || '');
    if (body.website != null) {
      const website = String(body.website || '').trim().slice(0, 300);
      if (currentUrl.startsWith('vmm:')) {
        await this.setUserMeta(locale, userId, 'vmm_website', website);
      } else {
        await this.mysql.exec(locale, `UPDATE wpgn_users SET user_url = ? WHERE ID = ?`, [website, userId]);
      }
    }
    if (body.bio != null) await this.setUserMeta(locale, userId, 'description', String(body.bio).slice(0, 2000));
    if (body.photoUrl != null) {
      await this.setUserMeta(locale, userId, 'vmm_avatar', String(body.photoUrl || '').trim().slice(0, 500));
    }
    const latest = await this.mysql.query<{ user_url: string; user_nicename: string }>(
      locale,
      `SELECT user_url, user_nicename FROM wpgn_users WHERE ID = ? LIMIT 1`,
      [userId],
    );
    const nicename = String(latest[0]?.user_nicename || fresh[0]?.user_nicename || user.user_nicename);
    const linkedUrl = String(latest[0]?.user_url || currentUrl || '');
    const profile = await this.authorProfile(locale, nicename);
    return serialize({
      ...profile,
      linkedUserId: linkedUrl.startsWith('vmm:') ? linkedUrl.slice(4) : '',
    });
  }

  async adminGet(id: string, localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    const numeric = Number(id);
    const rows = await this.mysql.query<PostRow>(
      locale,
      `${this.postSelect()} WHERE p.post_type = 'post' AND (p.ID = ? OR p.post_name = ?) LIMIT 1`,
      [Number.isFinite(numeric) ? numeric : 0, id],
    );
    const post = rows[0];
    if (!post) throw new NotFoundException('La noticia no existe.');
    const cats = await this.categoriesFor(locale, [post.ID]);
    const tags = await this.tagsFor(locale, [post.ID]);
    const [card] = await this.withAuthors(locale, [toCard(post, cats.get(post.ID) || [], locale)]);
    const featured = await this.mysql.query<{ meta_value: string }>(
      locale,
      `SELECT meta_value FROM wpgn_postmeta WHERE post_id = ? AND meta_key = '_vmm_featured' LIMIT 1`,
      [post.ID],
    );
    const alternate = await this.alternateFor(locale, post, true);
    return serialize({
      ...card,
      // Solo el extracto escrito a mano (sin fallback del cuerpo) para el editor / h2.
      excerpt: String(post.post_excerpt || '').trim(),
      coverCaption: card.coverCaption || '',
      coverAlt: card.coverAlt || '',
      content: post.post_content,
      featured: featured[0]?.meta_value === '1',
      categoryIds: (cats.get(post.ID) || []).map((item) => String(item.term_id || item.slug)),
      tags: (tags.get(post.ID) || []).map((item) => item.name),
      attachments: await this.attachmentsFor(locale, post.ID),
      altSlug: alternate?.slug || '',
      altPostId: alternate?.id || '',
      altHref: alternate?.href || '',
    });
  }

  async adminOverview(daysValue = 30) {
    const days = [7, 30, 90].includes(Number(daysValue)) ? Number(daysValue) : 30;
    const [es, en] = await Promise.all([this.overviewLocale('es', days), this.overviewLocale('en', days)]);
    const recent = [...es.recent, ...en.recent]
      .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
      .slice(0, 10);
    return serialize({
      days,
      es,
      en,
      recent,
      series: this.mergeSeries(es.series, en.series),
      totals: {
        published: es.published + en.published,
        drafts: es.drafts + en.drafts,
        scheduled: es.scheduled + en.scheduled,
        thisPeriod: es.thisPeriod + en.thisPeriod,
        today: es.today + en.today,
        comments: es.comments + en.comments,
        views: es.views + en.views,
        categories: es.categories + en.categories,
        authors: es.authors + en.authors,
      },
    });
  }

  async create(body: UpsertNewsPostDto, actor?: NewsActor) {
    this.lockAuthor(body, actor, true);
    const locale = this.mysql.locale(body.locale);
    const saved = await this.writePost(locale, body, actor?.id);
    this.refreshSitemaps(locale);
    return this.adminGet(String(saved), locale);
  }

  async update(id: string, body: UpsertNewsPostDto, actor?: NewsActor) {
    this.lockAuthor(body, actor, false);
    const locale = this.mysql.locale(body.locale);
    const postId = await this.requirePostId(locale, id);
    await this.writePost(locale, body, actor?.id, postId);
    this.refreshSitemaps(locale);
    return this.adminGet(String(postId), locale);
  }

  async remove(id: string, localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    const postId = await this.requirePostId(locale, id);
    await this.mysql.exec(locale, `UPDATE wpgn_posts SET post_status = 'trash', post_modified = ? WHERE ID = ?`, [
      this.wpStamp(new Date()),
      postId,
    ]);
    this.refreshSitemaps(locale);
    return serialize({ ok: true, id: String(postId), locale });
  }

  async restore(id: string, localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    const postId = await this.requirePostId(locale, id);
    await this.mysql.exec(
      locale,
      `UPDATE wpgn_posts SET post_status = 'draft', post_modified = ? WHERE ID = ? AND post_status = 'trash'`,
      [this.wpStamp(new Date()), postId],
    );
    return serialize({ ok: true, id: String(postId), locale, status: 'draft' });
  }

  async adminTags(localeValue?: string, q?: string) {
    const locale = this.mysql.locale(localeValue);
    const query = String(q || '').trim();
    const like = `%${query}%`;
    const rows = await this.mysql.query<{ term_id: number; slug: string; name: string; count: number }>(
      locale,
      `SELECT t.term_id, t.slug, t.name, tt.count
       FROM wpgn_terms t
       JOIN wpgn_term_taxonomy tt ON tt.term_id = t.term_id AND tt.taxonomy = 'post_tag'
       ${query ? 'WHERE t.name LIKE ? OR t.slug LIKE ?' : ''}
       ORDER BY tt.count DESC, t.name ASC
       LIMIT 40`,
      query ? [like, like] : [],
    );
    return serialize(
      rows.map((row) => ({
        id: String(row.term_id),
        slug: row.slug,
        name: String(row.name || '').replace(/&amp;/g, '&'),
        postCount: Number(row.count || 0),
        href: publicHref(locale, `tag/${row.slug}`),
      })),
    );
  }

  /** Paginated tags list for external CRM integrations (API-key protected). */
  async integrationTags(
    localeValue?: string,
    q?: string,
    pageValue = 1,
    limitValue = 100,
    opts?: { special?: boolean },
  ) {
    const locale = this.mysql.locale(localeValue);
    const query = String(q || '').trim();
    const like = `%${query}%`;
    const page = Math.max(1, Number(pageValue) || 1);
    const maxLimit = opts?.special ? 500 : 100;
    const limit = Math.min(maxLimit, Math.max(1, Number(limitValue) || 100));
    const offset = (page - 1) * limit;
    const where = query ? 'WHERE t.name LIKE ? OR t.slug LIKE ?' : '';
    const params = query ? [like, like] : [];
    const countRows = await this.mysql.query<{ total: number }>(
      locale,
      `SELECT COUNT(*) AS total
       FROM wpgn_terms t
       JOIN wpgn_term_taxonomy tt ON tt.term_id = t.term_id AND tt.taxonomy = 'post_tag'
       ${where}`,
      params,
    );
    const rows = await this.mysql.query<{ term_id: number; slug: string; name: string; count: number }>(
      locale,
      `SELECT t.term_id, t.slug, t.name, tt.count
       FROM wpgn_terms t
       JOIN wpgn_term_taxonomy tt ON tt.term_id = t.term_id AND tt.taxonomy = 'post_tag'
       ${where}
       ORDER BY tt.count DESC, t.name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    const total = Number(countRows[0]?.total || 0);
    return serialize({
      locale,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      items: rows.map((row) => ({
        id: String(row.term_id),
        slug: row.slug,
        name: String(row.name || '').replace(/&amp;/g, '&'),
        postCount: Number(row.count || 0),
        href: publicHref(locale, `tag/${row.slug}`),
      })),
    });
  }

  async listIntegrationApiKeys() {
    const rows = await this.prisma.newsIntegrationApiKey.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return serialize(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        keyPrefix: row.keyPrefix,
        active: row.active,
        special: row.special,
        expiresAt: row.expiresAt?.toISOString() || null,
        lastUsedAt: row.lastUsedAt?.toISOString() || null,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  }

  async createIntegrationApiKey(input: {
    name?: string;
    special?: boolean;
    expiresAt?: string | null;
    createdBy?: string | number | bigint | null;
  }) {
    const name = String(input.name || '').trim() || 'CRM';
    const rawKey = `nmm_${randomBytes(24).toString('base64url')}`;
    const { hashNewsApiKey } = await import('./news-api-key.guard');
    const keyHash = hashNewsApiKey(rawKey);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Fecha de expiración inválida.');
    }
    const createdBy = input.createdBy ? BigInt(input.createdBy) : null;
    const row = await this.prisma.newsIntegrationApiKey.create({
      data: {
        name,
        keyPrefix: rawKey.slice(0, 12),
        keyHash,
        special: Boolean(input.special),
        expiresAt,
        createdBy,
      },
    });
    return serialize({
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      active: row.active,
      special: row.special,
      expiresAt: row.expiresAt?.toISOString() || null,
      createdAt: row.createdAt.toISOString(),
      // Shown only once at creation.
      apiKey: rawKey,
    });
  }

  async updateIntegrationApiKey(
    id: string,
    input: { name?: string; active?: boolean; special?: boolean; expiresAt?: string | null },
  ) {
    const existing = await this.prisma.newsIntegrationApiKey.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('No encontramos esa API key.');
    let expiresAt = existing.expiresAt;
    if (input.expiresAt === null) expiresAt = null;
    else if (typeof input.expiresAt === 'string' && input.expiresAt.trim()) {
      const next = new Date(input.expiresAt);
      if (Number.isNaN(next.getTime())) throw new BadRequestException('Fecha de expiración inválida.');
      expiresAt = next;
    }
    const row = await this.prisma.newsIntegrationApiKey.update({
      where: { id },
      data: {
        name: input.name !== undefined ? String(input.name || '').trim() || existing.name : undefined,
        active: input.active !== undefined ? Boolean(input.active) : undefined,
        special: input.special !== undefined ? Boolean(input.special) : undefined,
        expiresAt,
      },
    });
    return serialize({
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      active: row.active,
      special: row.special,
      expiresAt: row.expiresAt?.toISOString() || null,
      lastUsedAt: row.lastUsedAt?.toISOString() || null,
      createdAt: row.createdAt.toISOString(),
    });
  }

  async deleteIntegrationApiKey(id: string) {
    const existing = await this.prisma.newsIntegrationApiKey.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('No encontramos esa API key.');
    await this.prisma.newsIntegrationApiKey.delete({ where: { id } });
    return serialize({ ok: true, id });
  }

  async adminTag(id: string, localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    const term = await this.tagTerm(locale, id);
    if (!term) throw new NotFoundException('No encontramos esa etiqueta.');
    const profile = await this.tagProfile(locale, term.term_id);
    return serialize(this.presentTag(locale, term, profile));
  }

  async updateTag(
    id: string,
    body: {
      locale?: string;
      name?: string;
      description?: string;
      about?: string;
      logoUrl?: string;
      coverUrl?: string;
      verified?: boolean;
      followers?: number;
      related?: string[];
      supporters?: Array<{ name?: string; tier?: string; points?: number }>;
    },
  ) {
    const locale = this.mysql.locale(body.locale);
    const term = await this.tagTerm(locale, id);
    if (!term) throw new NotFoundException('No encontramos esa etiqueta.');
    const name = String(body.name || term.name).trim().slice(0, 200);
    const description = String(body.description ?? term.description).trim().slice(0, 500);
    if (name) {
      await this.mysql.exec(locale, `UPDATE wpgn_terms SET name = ? WHERE term_id = ?`, [name, term.term_id]);
    }
    await this.mysql.exec(
      locale,
      `UPDATE wpgn_term_taxonomy SET description = ? WHERE term_id = ? AND taxonomy = 'post_tag'`,
      [description, term.term_id],
    );
    const current = await this.tagProfile(locale, term.term_id);
    const supporters = Array.isArray(body.supporters)
      ? body.supporters
          .map((item) => ({
            name: String(item?.name || '').trim().slice(0, 80),
            tier: String(item?.tier || '').trim().slice(0, 40),
            points: Math.max(0, Number(item?.points || 0)),
          }))
          .filter((item) => item.name)
          .slice(0, 12)
      : current.supporters;
    const next = {
      about: body.about != null ? String(body.about).slice(0, 4000) : current.about,
      logoUrl: body.logoUrl != null ? String(body.logoUrl).trim().slice(0, 500) : current.logoUrl,
      coverUrl: body.coverUrl != null ? String(body.coverUrl).trim().slice(0, 500) : current.coverUrl,
      verified: body.verified != null ? Boolean(body.verified) : current.verified,
      followers: body.followers != null ? Math.max(0, Number(body.followers || 0)) : current.followers,
      related: Array.isArray(body.related)
        ? body.related.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean).slice(0, 12)
        : current.related,
      supporters,
    };
    await this.setTermMeta(locale, term.term_id, '_vmm_tag', JSON.stringify(next));
    return this.adminTag(String(term.term_id), locale);
  }

  async findTag(slug: string, localeValue?: string, pageValue = 1, limitValue = 12) {
    const locale = this.mysql.locale(localeValue);
    const key = String(slug || '')
      .trim()
      .toLowerCase();
    const term = await this.tagTerm(locale, key);
    if (!term) throw new NotFoundException('No encontramos esa etiqueta.');
    const page = Math.max(1, Number(pageValue || 1));
    const limit = Math.min(24, Math.max(1, Number(limitValue || 12)));
    const profile = await this.tagProfile(locale, term.term_id);
    const [{ items, total }, trending, stats, related] = await Promise.all([
      this.loadPosts(locale, { page, limit, tag: term.slug }),
      this.loadPosts(locale, { page: 1, limit: 5, tag: term.slug, skipCount: true, order: 'comments' }),
      this.tagStats(locale, term.term_id),
      profile.related.length ? this.tagsBySlug(locale, profile.related) : this.relatedTags(locale, term.term_id),
    ]);
    return serialize({
      ...this.presentTag(locale, term, profile),
      stats,
      page,
      limit,
      total,
      items,
      trending: trending.items,
      related,
    });
  }

  async listComments(slug: string, localeValue?: string, actor?: { id: bigint } | null) {
    const locale = this.mysql.locale(localeValue);
    const postId = await this.requirePublishedId(locale, slug);
    return serialize({ items: await this.commentsFor(locale, postId, actor?.id ? String(actor.id) : '') });
  }

  async reactComment(
    slug: string,
    commentId: string,
    localeValue: string | undefined,
    actor: { id: bigint },
    reaction: string,
  ) {
    const locale = this.mysql.locale(localeValue);
    const postId = await this.requirePublishedId(locale, slug);
    await this.ensureCommentsTable(locale);
    await this.ensureCommentVotesTable(locale);
    await this.ensureCommentReactionsTable(locale);
    const id = Number(commentId);
    if (!Number.isFinite(id) || id <= 0) throw new NotFoundException('El comentario no existe.');
    const rows = await this.mysql.query<{ id: number }>(
      locale,
      `SELECT id FROM vmm_comments WHERE id = ? AND post_id = ? LIMIT 1`,
      [id, postId],
    );
    if (!rows[0]) throw new NotFoundException('El comentario no existe.');
    const key = String(reaction || '').trim().toLowerCase();
    const allowed = new Set(['love', 'laugh', 'wow', 'fire']);
    if (!allowed.has(key)) throw new BadRequestException('Reacción no válida.');
    const userId = String(actor.id);
    const existing = await this.mysql.query<{ reaction: string }>(
      locale,
      `SELECT reaction FROM vmm_comment_reactions WHERE comment_id = ? AND user_id = ? LIMIT 1`,
      [id, userId],
    );
    const prev = String(existing[0]?.reaction || '');
    if (prev === key) {
      await this.mysql.exec(locale, `DELETE FROM vmm_comment_reactions WHERE comment_id = ? AND user_id = ?`, [
        id,
        userId,
      ]);
    } else if (prev) {
      await this.mysql.exec(
        locale,
        `UPDATE vmm_comment_reactions SET reaction = ?, updated_at = ? WHERE comment_id = ? AND user_id = ?`,
        [key, this.wpStamp(new Date()), id, userId],
      );
    } else {
      await this.mysql.exec(
        locale,
        `INSERT INTO vmm_comment_reactions (comment_id, user_id, reaction, updated_at) VALUES (?, ?, ?, ?)`,
        [id, userId, key, this.wpStamp(new Date())],
      );
    }
    return serialize(await this.commentReactionState(locale, id, userId));
  }

  async listCommentReportOptions(localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    const options = await this.getCommentReportOptions(locale);
    return serialize({
      items: options
        .filter((item) => item.enabled)
        .sort((a, b) => a.sort - b.sort)
        .map((item) => ({
          key: item.key,
          label: locale === 'en' ? item.labelEn : item.labelEs,
        })),
    });
  }

  async reportComment(
    slug: string,
    commentId: string,
    localeValue: string | undefined,
    actor: { id: bigint },
    body: { reason?: string; details?: string },
  ) {
    const locale = this.mysql.locale(localeValue);
    const postId = await this.requirePublishedId(locale, slug);
    await this.ensureCommentsTable(locale);
    await this.ensureCommentReportsTable(locale);
    const id = Number(commentId);
    if (!Number.isFinite(id) || id <= 0) throw new NotFoundException('El comentario no existe.');
    const rows = await this.mysql.query<{ id: number; user_id: string; body: string }>(
      locale,
      `SELECT id, user_id, body FROM vmm_comments WHERE id = ? AND post_id = ? LIMIT 1`,
      [id, postId],
    );
    if (!rows[0]) throw new NotFoundException('El comentario no existe.');
    const options = await this.getCommentReportOptions(locale);
    const reasonKey = String(body?.reason || '').trim().toLowerCase();
    const option = options.find((item) => item.enabled && item.key === reasonKey);
    if (!option) throw new BadRequestException('Motivo de reporte no válido.');
    const details = String(body?.details || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
    const reporterId = String(actor.id);
    const existing = await this.mysql.query<{ id: number }>(
      locale,
      `SELECT id FROM vmm_comment_reports WHERE comment_id = ? AND reporter_user_id = ? LIMIT 1`,
      [id, reporterId],
    );
    if (existing[0]) throw new ConflictException('Ya reportaste este comentario.');
    await this.mysql.exec(
      locale,
      `INSERT INTO vmm_comment_reports
        (comment_id, post_id, post_slug, reporter_user_id, reported_user_id, reason_key, reason_label, details, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
      [
        id,
        postId,
        String(slug || '').slice(0, 200),
        reporterId,
        String(rows[0].user_id || ''),
        option.key,
        locale === 'en' ? option.labelEn : option.labelEs,
        details || null,
        this.wpStamp(new Date()),
      ],
    );
    return serialize({ ok: true });
  }

  async adminListCommentReports(localeValue?: string, status = 'open') {
    const locale = this.mysql.locale(localeValue);
    await this.ensureCommentReportsTable(locale);
    const statusKey = String(status || 'open').trim().toLowerCase();
    const where = statusKey === 'all' ? '' : 'WHERE r.status = ?';
    const params = statusKey === 'all' ? [] : [statusKey];
    const rows = await this.mysql.query<{
      id: number;
      comment_id: number;
      post_id: number;
      post_slug: string | null;
      reporter_user_id: string;
      reported_user_id: string | null;
      reason_key: string;
      reason_label: string;
      details: string | null;
      status: string;
      created_at: Date | string;
      comment_body: string | null;
      author_name: string | null;
    }>(
      locale,
      `SELECT r.id, r.comment_id, r.post_id, r.post_slug, r.reporter_user_id, r.reported_user_id,
              r.reason_key, r.reason_label, r.details, r.status, r.created_at,
              c.body AS comment_body, c.author_name
       FROM vmm_comment_reports r
       LEFT JOIN vmm_comments c ON c.id = r.comment_id
       ${where}
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT 200`,
      params,
    );
    return serialize({
      items: rows.map((row) => ({
        id: String(row.id),
        commentId: String(row.comment_id),
        postId: String(row.post_id),
        postSlug: row.post_slug || '',
        reporterUserId: row.reporter_user_id,
        reportedUserId: row.reported_user_id || '',
        reasonKey: row.reason_key,
        reasonLabel: row.reason_label,
        details: row.details || '',
        status: row.status,
        createdAt: row.created_at,
        commentBody: row.comment_body || '',
        authorName: row.author_name || '',
      })),
    });
  }

  async adminUpdateCommentReport(
    id: string,
    localeValue: string | undefined,
    body: { status?: string; deleteComment?: boolean },
  ) {
    const locale = this.mysql.locale(localeValue);
    await this.ensureCommentReportsTable(locale);
    const reportId = Number(id);
    if (!Number.isFinite(reportId) || reportId <= 0) throw new NotFoundException('El reporte no existe.');
    const rows = await this.mysql.query<{ id: number; comment_id: number }>(
      locale,
      `SELECT id, comment_id FROM vmm_comment_reports WHERE id = ? LIMIT 1`,
      [reportId],
    );
    if (!rows[0]) throw new NotFoundException('El reporte no existe.');
    const status = String(body?.status || '').trim().toLowerCase();
    const allowed = new Set(['open', 'reviewed', 'resolved', 'dismissed']);
    if (!allowed.has(status)) throw new BadRequestException('Estado no válido.');
    await this.mysql.exec(
      locale,
      `UPDATE vmm_comment_reports SET status = ?, resolved_at = ? WHERE id = ?`,
      [status, status === 'open' ? null : this.wpStamp(new Date()), reportId],
    );
    if (body?.deleteComment) {
      await this.removeComment(String(rows[0].comment_id), locale);
    }
    return serialize({ ok: true, id: String(reportId), status });
  }

  async adminGetCommentReportOptions(localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    return serialize({ items: await this.getCommentReportOptions(locale) });
  }

  async adminSaveCommentReportOptions(
    localeValue: string | undefined,
    items: Array<{ key?: string; labelEs?: string; labelEn?: string; enabled?: boolean; sort?: number }>,
  ) {
    const locale = this.mysql.locale(localeValue);
    await this.ensureCommentReportOptionsTable(locale);
    const cleaned = (Array.isArray(items) ? items : [])
      .map((item, index) => {
        const key = String(item?.key || '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '')
          .slice(0, 64);
        if (!key) return null;
        return {
          key,
          labelEs: String(item?.labelEs || key).trim().slice(0, 120) || key,
          labelEn: String(item?.labelEn || key).trim().slice(0, 120) || key,
          enabled: item?.enabled !== false,
          sort: Number.isFinite(Number(item?.sort)) ? Number(item?.sort) : index + 1,
        };
      })
      .filter(Boolean) as Array<{ key: string; labelEs: string; labelEn: string; enabled: boolean; sort: number }>;
    if (!cleaned.length) throw new BadRequestException('Agrega al menos una opción de reporte.');
    await this.mysql.exec(
      locale,
      `INSERT INTO vmm_comment_report_options (id, options_json, updated_at)
       VALUES (1, ?, ?)
       ON DUPLICATE KEY UPDATE options_json = VALUES(options_json), updated_at = VALUES(updated_at)`,
      [JSON.stringify(cleaned), this.wpStamp(new Date())],
    );
    return serialize({ items: cleaned.sort((a, b) => a.sort - b.sort) });
  }

  async voteComment(
    slug: string,
    commentId: string,
    localeValue: string | undefined,
    actor: { id: bigint },
    value: number,
  ) {
    const locale = this.mysql.locale(localeValue);
    const postId = await this.requirePublishedId(locale, slug);
    await this.ensureCommentsTable(locale);
    await this.ensureCommentVotesTable(locale);
    const id = Number(commentId);
    if (!Number.isFinite(id) || id <= 0) throw new NotFoundException('El comentario no existe.');
    const rows = await this.mysql.query<{ id: number; post_id: number }>(
      locale,
      `SELECT id, post_id FROM vmm_comments WHERE id = ? AND post_id = ? LIMIT 1`,
      [id, postId],
    );
    if (!rows[0]) throw new NotFoundException('El comentario no existe.');
    const vote = value === 1 || value === -1 ? value : 0;
    const userId = String(actor.id);
    if (vote === 0) {
      await this.mysql.exec(locale, `DELETE FROM vmm_comment_votes WHERE comment_id = ? AND user_id = ?`, [
        id,
        userId,
      ]);
    } else {
      await this.mysql.exec(
        locale,
        `INSERT INTO vmm_comment_votes (comment_id, user_id, value, updated_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)`,
        [id, userId, vote, this.wpStamp(new Date())],
      );
    }
    const scoreRows = await this.mysql.query<{ score: number }>(
      locale,
      `SELECT COALESCE(SUM(value), 0) AS score FROM vmm_comment_votes WHERE comment_id = ?`,
      [id],
    );
    return serialize({
      id: String(id),
      score: Number(scoreRows[0]?.score || 0),
      myVote: vote,
    });
  }

  async adminListComments(id: string, localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    const postId = await this.requirePostId(locale, id);
    return serialize({ items: await this.commentsFor(locale, postId) });
  }

  async createComment(
    slug: string,
    localeValue: string | undefined,
    actor: { id: bigint },
    text: string,
    parentIdValue?: string,
    gifValue?: { url?: string; title?: string } | null,
  ) {
    const locale = this.mysql.locale(localeValue);
    const postId = await this.requirePublishedId(locale, slug);
    const body = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const gif = this.normalizeCommentGif(gifValue);
    if (body.length < 2 && !gif) throw new BadRequestException('Escribe un comentario.');
    if (body.length > 800) throw new BadRequestException('El comentario es demasiado largo.');
    if (body && (await isCommentLanguageBlocked(body))) throw new BadRequestException(BLOCKED_LANGUAGE_MESSAGE);
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, username: true, displayName: true, photoUrl: true },
    });
    if (!user) throw new BadRequestException('Inicia sesión para comentar.');
    await this.ensureCommentsTable(locale);
    let parentId: number | null = null;
    const rawParent = Number(parentIdValue || 0);
    if (Number.isFinite(rawParent) && rawParent > 0) {
      const parents = await this.mysql.query<{ id: number; parent_id: number | null }>(
        locale,
        `SELECT id, parent_id FROM vmm_comments WHERE id = ? AND post_id = ? LIMIT 1`,
        [rawParent, postId],
      );
      if (!parents[0]) throw new BadRequestException('El comentario al que respondes no existe.');
      // Keep threads shallow: reply-to-reply attaches under the same root.
      parentId = parents[0].parent_id ? Number(parents[0].parent_id) : Number(parents[0].id);
    }
    const inserted = await this.mysql.exec(
      locale,
      `INSERT INTO vmm_comments (post_id, parent_id, user_id, author_name, author_username, author_photo, body, gif, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        postId,
        parentId,
        String(user.id),
        String(user.displayName || user.username || 'Usuario').slice(0, 160),
        String(user.username || '').slice(0, 64) || null,
        user.photoUrl || null,
        body,
        gif ? JSON.stringify(gif) : null,
        this.wpStamp(new Date()),
      ],
    );
    await this.syncCommentCount(locale, postId);
    return serialize({
      id: String(inserted.insertId || ''),
      postId: String(postId),
      parentId: parentId ? String(parentId) : null,
      userId: String(user.id),
      authorName: user.displayName || user.username || 'Usuario',
      authorUsername: user.username || '',
      authorPhotoUrl: user.photoUrl || '',
      body,
      gif,
      createdAt: new Date().toISOString(),
      score: 0,
      myVote: 0,
      reactions: { love: 0, laugh: 0, wow: 0, fire: 0 },
      myReaction: null,
    });
  }

  async removeComment(id: string, localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    await this.ensureCommentsTable(locale);
    const commentId = Number(id);
    if (!Number.isFinite(commentId) || commentId <= 0) throw new NotFoundException('El comentario no existe.');
    const rows = await this.mysql.query<{ post_id: number }>(locale, `SELECT post_id FROM vmm_comments WHERE id = ? LIMIT 1`, [
      commentId,
    ]);
    if (!rows[0]) throw new NotFoundException('El comentario no existe.');
    await this.mysql.exec(locale, `DELETE FROM vmm_comments WHERE id = ?`, [commentId]);
    await this.syncCommentCount(locale, Number(rows[0].post_id));
    return serialize({ ok: true });
  }

  async createCategory(_body?: unknown) {
    throw new BadRequestException('En local las categorías salen de musicmundial_es (dump WordPress).');
  }

  async updateCategory(_id?: string, _body?: unknown) {
    throw new BadRequestException('En local las categorías salen de musicmundial_es (dump WordPress).');
  }

  async removeCategory(_id?: string) {
    throw new BadRequestException('En local las categorías salen de musicmundial_es (dump WordPress).');
  }

  private n(value: unknown) {
    return Number(value || 0);
  }

  private dayKey(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private fillDays(rows: Array<{ day: string | Date; count: number }>, days: number) {
    const map = new Map<string, number>();
    for (const row of rows) {
      const raw = row.day instanceof Date ? this.dayKey(row.day) : String(row.day || '').slice(0, 10);
      if (raw) map.set(raw, this.n(row.count));
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const day = this.dayKey(date);
      return { day, count: map.get(day) || 0 };
    });
  }

  private mergeSeries(
    es: Array<{ day: string; count: number }>,
    en: Array<{ day: string; count: number }>,
  ) {
    return es.map((row, index) => {
      const english = this.n(en[index]?.count);
      return { day: row.day, es: row.count, en: english, count: row.count + english };
    });
  }

  private emptyOverview(days: number) {
    return {
      published: 0,
      drafts: 0,
      scheduled: 0,
      thisPeriod: 0,
      today: 0,
      comments: 0,
      views: 0,
      categories: 0,
      authors: 0,
      series: this.fillDays([], days),
      topCategories: [] as Array<{ slug: string; name: string; postCount: number }>,
      recent: [] as ReturnType<typeof toCard>[],
    };
  }

  private async overviewLocale(locale: NewsLocale, days: number) {
    const [counts, views, categories, seriesRows, recent] = await Promise.all([
      this.mysql.query<{
        published: number;
        drafts: number;
        scheduled: number;
        thisPeriod: number;
        today: number;
        comments: number;
        authors: number;
      }>(
        locale,
        `SELECT
           SUM(p.post_status = 'publish') AS published,
           SUM(p.post_status IN ('draft', 'pending', 'private')) AS drafts,
           SUM(p.post_status = 'future') AS scheduled,
           SUM(p.post_status = 'publish' AND p.post_date >= DATE_SUB(NOW(), INTERVAL ? DAY)) AS thisPeriod,
           SUM(p.post_status = 'publish' AND DATE(p.post_date) = CURDATE()) AS today,
           SUM(CASE WHEN p.post_status = 'publish' THEN p.comment_count ELSE 0 END) AS comments,
           COUNT(DISTINCT CASE WHEN p.post_status = 'publish' THEN p.post_author END) AS authors
         FROM wpgn_posts p
         WHERE p.post_type = 'post'`,
        [days],
      ),
      this.mysql.query<{ views: number }>(
        locale,
        `SELECT COALESCE(SUM(CAST(meta_value AS UNSIGNED)), 0) AS views
         FROM wpgn_postmeta
         WHERE meta_key = 'post_views_count'`,
      ),
      this.categories(locale),
      this.mysql.query<{ day: string; count: number }>(
        locale,
        `SELECT DATE_FORMAT(p.post_date, '%Y-%m-%d') AS day, COUNT(*) AS count
         FROM wpgn_posts p
         WHERE p.post_type = 'post' AND p.post_status = 'publish'
           AND p.post_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY DATE_FORMAT(p.post_date, '%Y-%m-%d')
         ORDER BY day ASC`,
        [days],
      ),
      this.loadPosts(locale, { page: 1, limit: 8, skipCount: true, light: true }),
    ]);
    const row = counts[0];
    if (!row && locale === 'en') return this.emptyOverview(days);
    const cats = (Array.isArray(categories) ? categories : []).filter(
      (item: { postCount?: number }) => Number(item.postCount || 0) > 0,
    );
    return {
      published: this.n(row?.published),
      drafts: this.n(row?.drafts),
      scheduled: this.n(row?.scheduled),
      thisPeriod: this.n(row?.thisPeriod),
      today: this.n(row?.today),
      comments: this.n(row?.comments),
      views: this.n(views[0]?.views),
      categories: cats.length,
      authors: this.n(row?.authors),
      series: this.fillDays(seriesRows, days),
      topCategories: cats.slice(0, 8).map((item: { slug: string; name: string; postCount?: number }) => ({
        slug: item.slug,
        name: item.name,
        postCount: this.n(item.postCount),
      })),
      recent: recent.items,
    };
  }

  private async popularWindow(locale: NewsLocale, days: number, exclude: string, limit: number) {
    const where = [`p.post_type = 'post'`, `p.post_status = 'publish'`, `p.post_date >= DATE_SUB(NOW(), INTERVAL ? DAY)`];
    const params: unknown[] = [days];
    if (exclude) {
      where.push('p.post_name <> ?');
      params.push(exclude);
    }
    const rows = await this.mysql.query<PostRow>(
      locale,
      `SELECT p.ID, p.post_title, p.post_name, p.post_excerpt, p.post_date,
        p.comment_count, COALESCE(NULLIF(u.display_name, ''), u.user_nicename, u.user_login) AS author_name, att.guid AS cover_url,
        CAST(v.meta_value AS UNSIGNED) AS view_count
       FROM wpgn_posts p
       LEFT JOIN wpgn_users u ON u.ID = p.post_author
       LEFT JOIN wpgn_postmeta th ON th.post_id = p.ID AND th.meta_key = '_thumbnail_id'
       LEFT JOIN wpgn_posts att ON att.ID = CAST(th.meta_value AS UNSIGNED)
       LEFT JOIN wpgn_postmeta v ON v.post_id = p.ID AND v.meta_key = 'post_views_count'
       WHERE ${where.join(' AND ')} AND att.guid IS NOT NULL
       ORDER BY COALESCE(CAST(v.meta_value AS UNSIGNED), 0) DESC, p.post_date DESC
       LIMIT ?`,
      [...params, limit],
    );
    const cats = await this.categoriesFor(locale, rows.map((row) => row.ID));
    return rows.map((row) => toCard(row, cats.get(row.ID) || [], locale));
  }

  private postSelect(light = false) {
    const content = light ? '' : 'p.post_content, ';
    return `SELECT p.ID, p.post_title, p.post_name, p.post_excerpt, ${content}p.post_date, p.post_modified, p.post_status, p.post_author,
      p.comment_count, COALESCE(NULLIF(u.display_name, ''), u.user_nicename, u.user_login) AS author_name,
      u.user_nicename AS author_nicename, u.user_email AS author_email, att.guid AS cover_url,
      att.post_excerpt AS cover_caption, imgalt.meta_value AS cover_alt
      FROM wpgn_posts p
      LEFT JOIN wpgn_users u ON u.ID = p.post_author
      LEFT JOIN wpgn_postmeta th ON th.post_id = p.ID AND th.meta_key = '_thumbnail_id'
      LEFT JOIN wpgn_posts att ON att.ID = CAST(th.meta_value AS UNSIGNED)
      LEFT JOIN wpgn_postmeta imgalt ON imgalt.post_id = att.ID AND imgalt.meta_key = '_wp_attachment_image_alt'`;
  }

  private async loadPosts(
    locale: NewsLocale,
    input: {
      page: number;
      limit: number;
      category?: string;
      slugs?: string[];
      q?: string;
      excludeId?: number;
      skipCount?: boolean;
      light?: boolean;
      authorId?: number;
      authorSlug?: string;
      tag?: string;
      order?: 'date' | 'comments';
    },
  ) {
    const slugs = (input.slugs?.length ? input.slugs : input.category ? [input.category] : []).filter(Boolean);
    const where = [`p.post_type = 'post'`, `p.post_status = 'publish'`];
    const params: unknown[] = [];
    if (input.excludeId) {
      where.push('p.ID <> ?');
      params.push(input.excludeId);
    }
    if (input.authorId) {
      where.push('p.post_author = ?');
      params.push(input.authorId);
    } else if (input.authorSlug) {
      where.push('u.user_nicename = ?');
      params.push(input.authorSlug);
    }
    if (slugs.length) {
      where.push(`EXISTS (
        SELECT 1 FROM wpgn_term_relationships tr
        JOIN wpgn_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = 'category'
        JOIN wpgn_terms t ON t.term_id = tt.term_id
        WHERE tr.object_id = p.ID AND t.slug IN (${slugs.map(() => '?').join(', ')})
      )`);
      params.push(...slugs);
    }
    const tag = String(input.tag || '').trim().toLowerCase();
    if (tag) {
      where.push(`EXISTS (
        SELECT 1 FROM wpgn_term_relationships tr
        JOIN wpgn_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = 'post_tag'
        JOIN wpgn_terms t ON t.term_id = tt.term_id
        WHERE tr.object_id = p.ID AND t.slug = ?
      )`);
      params.push(tag);
    }
    if (input.q) {
      where.push('(p.post_title LIKE ? OR p.post_excerpt LIKE ?)');
      params.push(`%${input.q}%`, `%${input.q}%`);
    }
    const whereSql = where.join(' AND ');
    const offset = (input.page - 1) * input.limit;
    const rows = await this.mysql.query<PostRow>(
      locale,
      `${this.postSelect(input.light !== false)} WHERE ${whereSql} ORDER BY ${input.order === 'comments' ? 'p.comment_count DESC, p.post_date DESC' : 'p.post_date DESC'} LIMIT ? OFFSET ?`,
      [...params, input.limit, offset],
    );
    const cats = await this.categoriesFor(locale, rows.map((row) => row.ID));
    const items = await this.withAuthors(
      locale,
      rows.map((row) => toCard(row, cats.get(row.ID) || [], locale)),
    );
    if (input.skipCount) return { total: items.length, items };
    const countFrom = input.authorSlug
      ? 'FROM wpgn_posts p LEFT JOIN wpgn_users u ON u.ID = p.post_author'
      : 'FROM wpgn_posts p';
    const countRows = await this.mysql.query<{ total: number }>(
      locale,
      `SELECT COUNT(*) AS total ${countFrom} WHERE ${whereSql}`,
      params,
    );
    return {
      total: Number(countRows[0]?.total || 0),
      items,
    };
  }

  private async categoryCovers(locale: NewsLocale, slugs: string[]) {
    const map = new Map<string, string>();
    if (!slugs.length) return map;
    const rows = await this.mysql.query<{ slug: string; cover_url: string | null }>(
      locale,
      `SELECT slug, cover_url FROM (
         SELECT t.slug, att.guid AS cover_url,
           ROW_NUMBER() OVER (PARTITION BY t.slug ORDER BY p.post_date DESC) AS rn
         FROM wpgn_terms t
         JOIN wpgn_term_taxonomy tt ON tt.term_id = t.term_id AND tt.taxonomy = 'category'
         JOIN wpgn_term_relationships tr ON tr.term_taxonomy_id = tt.term_taxonomy_id
         JOIN wpgn_posts p ON p.ID = tr.object_id AND p.post_type = 'post' AND p.post_status = 'publish'
         LEFT JOIN wpgn_postmeta th ON th.post_id = p.ID AND th.meta_key = '_thumbnail_id'
         LEFT JOIN wpgn_posts att ON att.ID = CAST(th.meta_value AS UNSIGNED)
         WHERE t.slug IN (${slugs.map(() => '?').join(', ')})
       ) ranked
       WHERE rn = 1 AND cover_url IS NOT NULL`,
      slugs,
    );
    for (const row of rows) {
      if (row.cover_url) map.set(row.slug, row.cover_url);
    }
    return map;
  }

  private async categoriesFor(locale: NewsLocale, ids: number[]) {
    return this.termsFor(locale, ids, 'category');
  }

  private async tagsFor(locale: NewsLocale, ids: number[]) {
    return this.termsFor(locale, ids, 'post_tag');
  }

  private async termsFor(locale: NewsLocale, ids: number[], taxonomy: 'category' | 'post_tag') {
    const map = new Map<number, Array<{ term_id?: number; slug: string; name: string }>>();
    if (!ids.length) return map;
    const rows = await this.mysql.query<TermRow>(
      locale,
      `SELECT tr.object_id, t.term_id, t.slug, t.name
       FROM wpgn_term_relationships tr
       JOIN wpgn_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = ?
       JOIN wpgn_terms t ON t.term_id = tt.term_id
       WHERE tr.object_id IN (${ids.map(() => '?').join(', ')})`,
      [taxonomy, ...ids],
    );
    for (const row of rows) {
      const list = map.get(row.object_id) || [];
      list.push({
        term_id: Number(row.term_id || 0),
        slug: row.slug,
        name: String(row.name || '').replace(/&amp;/g, '&'),
      });
      map.set(row.object_id, list);
    }
    return map;
  }

  private async writePost(locale: NewsLocale, body: UpsertNewsPostDto, actorId?: bigint, postId?: number) {
    const title = String(body.title || '').trim();
    if (title.length < 3) throw new BadRequestException('El título es obligatorio.');
    const content = ensureImageAlts(sanitizeNewsHtml(body.content || ''), title);
    const excerpt = String(body.excerpt || '').trim();
    const coverAlt = String(body.coverAlt || '').trim() || title;
    const status = toWpStatus(body.status);
    const publishedAt = body.publishedAt ? new Date(body.publishedAt) : new Date();
    if (Number.isNaN(publishedAt.getTime())) throw new BadRequestException('La fecha no es válida.');
    const slug = await this.uniqueSlug(locale, body.slug || title, postId);
    const keepAuthor = Boolean(postId) && !String(body.authorUserId || '').trim() && !Number(body.wpAuthorId || 0);
    let authorWpId = 1;
    if (keepAuthor) {
      const current = await this.mysql.query<{ post_author: number }>(
        locale,
        `SELECT post_author FROM wpgn_posts WHERE ID = ? LIMIT 1`,
        [postId],
      );
      authorWpId = Number(current[0]?.post_author || 1);
    } else {
      authorWpId = await this.resolveAuthor(locale, body, actorId);
    }
    const now = this.wpStamp(new Date());
    const date = this.wpStamp(publishedAt);
    const gmt = this.wpStamp(publishedAt, true);
    const nowGmt = this.wpStamp(new Date(), true);

    let id = postId;
    if (id) {
      await this.mysql.exec(
        locale,
        `UPDATE wpgn_posts SET
          post_author = ?, post_date = ?, post_date_gmt = ?, post_content = ?, post_title = ?,
          post_excerpt = ?, post_status = ?, post_name = ?, post_modified = ?, post_modified_gmt = ?, guid = ?
         WHERE ID = ?`,
        [authorWpId, date, gmt, content, title, excerpt, status, slug, now, nowGmt, `/${locale}/${slug}`, id],
      );
    } else {
      const inserted = await this.mysql.exec(
        locale,
        `INSERT INTO wpgn_posts (
          post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
          post_status, comment_status, ping_status, post_password, post_name,
          to_ping, pinged, post_modified, post_modified_gmt, post_content_filtered,
          post_parent, guid, menu_order, post_type, post_mime_type, comment_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', 'closed', '', ?, '', '', ?, ?, '', 0, '', 0, 'post', '', 0)`,
        [authorWpId, date, gmt, content, title, excerpt, status, slug, now, nowGmt],
      );
      id = inserted.insertId;
      if (!id) throw new BadRequestException('No se pudo crear la noticia.');
      await this.mysql.exec(locale, `UPDATE wpgn_posts SET guid = ? WHERE ID = ?`, [`/${locale}/${slug}`, id]);
    }

    await this.setCategories(locale, id, body.categoryIds || []);
    if (Array.isArray(body.tags)) await this.setTags(locale, id, body.tags);
    if (Array.isArray(body.attachments)) await this.setAttachments(locale, id, body.attachments);
    await this.setCover(locale, id, body.coverUrl, body.coverCaption, coverAlt);
    await this.setMeta(locale, id, '_vmm_featured', body.featured ? '1' : '');
    const linkedId = String(body.authorUserId || (!keepAuthor ? actorId : '') || '').trim();
    if (linkedId) await this.setMeta(locale, id, '_vmm_user_id', linkedId);
    else if (postId && !keepAuthor) await this.setMeta(locale, id, '_vmm_user_id', '');
    if (body.altSlug !== undefined || body.altPostId !== undefined) {
      await this.linkAlternate(locale, id, slug, body);
    }
    return id;
  }

  private async requirePostId(locale: NewsLocale, id: string) {
    const numeric = Number(id);
    const rows = await this.mysql.query<{ ID: number }>(
      locale,
      `SELECT ID FROM wpgn_posts WHERE post_type = 'post' AND (ID = ? OR post_name = ?) LIMIT 1`,
      [Number.isFinite(numeric) ? numeric : 0, id],
    );
    if (!rows[0]) throw new NotFoundException('La noticia no existe.');
    return Number(rows[0].ID);
  }

  private otherLocale(locale: NewsLocale): NewsLocale {
    return locale === 'en' ? 'es' : 'en';
  }

  private async lookupPublished(locale: NewsLocale, slug: string) {
    const key = String(slug || '').trim();
    if (!key) return null;
    const rows = await this.mysql.query<PostRow>(
      locale,
      `${this.postSelect()} WHERE p.post_type = 'post' AND p.post_status = 'publish' AND p.post_name = ? LIMIT 1`,
      [key],
    );
    return rows[0] || null;
  }

  private async lookupById(locale: NewsLocale, id: number, publishedOnly = true) {
    if (!id) return null;
    const rows = await this.mysql.query<PostRow>(
      locale,
      `${this.postSelect()} WHERE p.post_type = 'post' AND p.ID = ?${publishedOnly ? ` AND p.post_status = 'publish'` : ''} LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  }

  private async lookupTranslated(locale: NewsLocale, slug: string) {
    const other = this.otherLocale(locale);
    const source = await this.lookupPublished(other, slug);
    if (!source) return null;
    const alternate = await this.alternateFor(other, source);
    if (!alternate) return null;
    if (alternate.id) {
      const byId = await this.lookupById(locale, Number(alternate.id));
      if (byId) return byId;
    }
    if (alternate.slug) return this.lookupPublished(locale, alternate.slug);
    return null;
  }

  private async presentArticle(locale: NewsLocale, post: PostRow) {
    const cats = await this.categoriesFor(locale, [post.ID]);
    const tags = await this.tagsFor(locale, [post.ID]);
    const related = await this.loadPosts(locale, {
      page: 1,
      limit: 4,
      slugs: (cats.get(post.ID) || []).slice(0, 1).map((item) => item.slug),
      excludeId: post.ID,
      skipCount: true,
      light: true,
    });
    const [card] = await this.withAuthors(locale, [toCard(post, cats.get(post.ID) || [], locale)]);
    const attachments = await this.attachmentsFor(locale, post.ID);
    const commentCount = await this.commentCount(locale, post.ID);
    const alternate = await this.alternateFor(locale, post);
    const author = post.author_nicename ? await this.authorProfile(locale, post.author_nicename) : null;
    const dek = String(post.post_excerpt || '').trim();
    return serialize({
      ...card,
      // Listas/SEO pueden usar excerpt con fallback; el h2 de artículo solo si hay dek manual.
      dek,
      authorBio: author?.bio || '',
      authorPhotoUrl: card.authorPhotoUrl || author?.photoUrl || '',
      authorPostCount: author?.postCount || 0,
      content: expandNewsEmbeds(sanitizeNewsHtml(post.post_content)),
      tags: (tags.get(post.ID) || []).map((item) => ({ slug: item.slug, name: item.name })),
      attachments,
      commentCount,
      alternate,
      related: related.items.filter((item) => item.slug !== post.post_name).slice(0, 4),
    });
  }

  private async alternateFor(locale: NewsLocale, post: PostRow, includeDrafts = false) {
    const other = this.otherLocale(locale);
    const altId = Number(await this.getMeta(locale, post.ID, '_vmm_alt_id'));
    const altSlug = await this.getMeta(locale, post.ID, '_vmm_alt_slug');
    let match = altId ? await this.lookupById(other, altId, !includeDrafts) : null;
    if (!match && altSlug) {
      match = includeDrafts
        ? (
            await this.mysql.query<PostRow>(
              other,
              `${this.postSelect()} WHERE p.post_type = 'post' AND p.post_name = ? LIMIT 1`,
              [altSlug],
            )
          )[0] || null
        : await this.lookupPublished(other, altSlug);
    }
    if (!match) match = await this.lookupById(other, post.ID, !includeDrafts);
    if (!match) match = await this.lookupPublished(other, post.post_name);
    if (!match && altSlug) {
      return { id: altId ? String(altId) : '', slug: altSlug, href: publicHref(other, altSlug), locale: other };
    }
    if (!match) return null;
    return {
      id: String(match.ID),
      slug: match.post_name,
      href: publicHref(other, match.post_name),
      locale: other,
    };
  }

  private async linkAlternate(locale: NewsLocale, postId: number, slug: string, body: UpsertNewsPostDto) {
    const other = this.otherLocale(locale);
    const wantedId = Number(body.altPostId || 0);
    const wantedSlug = normalizeSlug(String(body.altSlug || '')) || '';
    let otherPost = wantedId ? await this.lookupById(other, wantedId, false) : null;
    if (!otherPost && wantedSlug) {
      const rows = await this.mysql.query<PostRow>(
        other,
        `${this.postSelect()} WHERE p.post_type = 'post' AND p.post_name = ? LIMIT 1`,
        [wantedSlug],
      );
      otherPost = rows[0] || null;
    }
    if (!otherPost) {
      const reverse = await this.mysql.query<{ post_id: number }>(
        other,
        `SELECT post_id FROM wpgn_postmeta WHERE meta_key = '_vmm_alt_slug' AND meta_value = ? LIMIT 1`,
        [slug],
      );
      if (reverse[0]) otherPost = await this.lookupById(other, Number(reverse[0].post_id), false);
    }
    const otherSlug = otherPost?.post_name || wantedSlug;
    await this.setMeta(locale, postId, '_vmm_alt_id', otherPost ? String(otherPost.ID) : '');
    await this.setMeta(locale, postId, '_vmm_alt_slug', otherSlug);
    if (otherPost) {
      await this.setMeta(other, otherPost.ID, '_vmm_alt_id', String(postId));
      await this.setMeta(other, otherPost.ID, '_vmm_alt_slug', slug);
    }
  }

  private async uniqueSlug(locale: NewsLocale, raw: string, excludeId?: number) {
    let base = normalizeSlug(raw) || 'nota';
    if (base.length > 170) base = base.slice(0, 170);
    let slug = base;
    let index = 2;
    while (index < 50) {
      const rows = await this.mysql.query<{ ID: number }>(
        locale,
        `SELECT ID FROM wpgn_posts WHERE post_name = ?${excludeId ? ' AND ID <> ?' : ''} LIMIT 1`,
        excludeId ? [slug, excludeId] : [slug],
      );
      if (!rows.length) return slug;
      slug = `${base.slice(0, 160)}-${index}`;
      index += 1;
    }
    return `${base.slice(0, 150)}-${Date.now()}`;
  }

  private async resolveAuthor(locale: NewsLocale, body: UpsertNewsPostDto, actorId?: bigint) {
    const userId = String(body.authorUserId || actorId || '').trim();
    const wpAuthorId = Number(body.wpAuthorId || 0);
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) },
        select: { id: true, username: true, email: true, displayName: true },
      });
      if (!user) throw new BadRequestException('La cuenta a vincular no existe.');
      return this.upsertWpUser(locale, user, wpAuthorId || undefined);
    }
    if (wpAuthorId > 0) {
      const rows = await this.mysql.query<{ ID: number }>(locale, `SELECT ID FROM wpgn_users WHERE ID = ? LIMIT 1`, [wpAuthorId]);
      if (rows[0]) return Number(rows[0].ID);
    }
    const fallback = await this.mysql.query<{ ID: number }>(locale, `SELECT ID FROM wpgn_users ORDER BY ID ASC LIMIT 1`);
    return Number(fallback[0]?.ID || 1);
  }

  private async upsertWpUser(
    locale: NewsLocale,
    user: { id: bigint; username?: string | null; email?: string | null; displayName?: string | null },
    substituteId?: number,
  ) {
    const login = `vmm-${user.id}`.slice(0, 60);
    const marker = `vmm:${user.id}`;
    const nicename = String(user.username || login).toLowerCase().slice(0, 50);
    const email = String(user.email || `${login}@users.musicmundial.com`).slice(0, 100);
    const name = String(user.displayName || user.username || login).slice(0, 250);

    if (substituteId && substituteId > 0) {
      const current = await this.mysql.query<{ ID: number }>(locale, `SELECT ID FROM wpgn_users WHERE ID = ? LIMIT 1`, [substituteId]);
      if (current[0]) {
        await this.mysql.exec(
          locale,
          `UPDATE wpgn_users SET display_name = ?, user_email = ?, user_nicename = ?, user_url = ? WHERE ID = ?`,
          [name, email, nicename, marker, substituteId],
        );
        return substituteId;
      }
    }

    const mapped = await this.mysql.query<{ ID: number }>(
      locale,
      `SELECT ID FROM wpgn_users WHERE user_url = ? OR user_login = ? LIMIT 1`,
      [marker, login],
    );
    if (mapped[0]) {
      await this.mysql.exec(
        locale,
        `UPDATE wpgn_users SET display_name = ?, user_email = ?, user_nicename = ? WHERE ID = ?`,
        [name, email, nicename, mapped[0].ID],
      );
      return Number(mapped[0].ID);
    }

    if (user.email) {
      const byEmail = await this.mysql.query<{ ID: number }>(
        locale,
        `SELECT ID FROM wpgn_users WHERE user_email = ? LIMIT 1`,
        [user.email],
      );
      if (byEmail[0]) {
        await this.mysql.exec(
          locale,
          `UPDATE wpgn_users SET display_name = ?, user_nicename = ?, user_url = ? WHERE ID = ?`,
          [name, nicename, marker, byEmail[0].ID],
        );
        return Number(byEmail[0].ID);
      }
    }

    let nice = nicename || login;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const taken = await this.mysql.query<{ ID: number }>(
        locale,
        `SELECT ID FROM wpgn_users WHERE user_nicename = ? OR user_login = ? LIMIT 1`,
        [nice, attempt === 0 ? login : `${login}-${attempt}`],
      );
      if (!taken[0]) break;
      nice = `${nicename.slice(0, 40)}-${attempt + 2}`.slice(0, 50);
    }
    try {
      const inserted = await this.mysql.exec(
        locale,
        `INSERT INTO wpgn_users (
          user_login, user_pass, user_nicename, user_email, user_url,
          user_registered, user_activation_key, user_status, display_name
        ) VALUES (?, ?, ?, ?, ?, ?, '', 0, ?)`,
        [login, `vmm-${user.id}`, nice, email, marker, this.wpStamp(new Date()), name],
      );
      return inserted.insertId || 1;
    } catch (error) {
      const again = await this.mysql.query<{ ID: number }>(
        locale,
        `SELECT ID FROM wpgn_users WHERE user_login = ? OR user_email = ? OR user_url = ? LIMIT 1`,
        [login, email, marker],
      );
      if (again[0]) return Number(again[0].ID);
      throw error;
    }
  }

  private async setCategories(locale: NewsLocale, postId: number, categoryIds: string[]) {
    await this.mysql.exec(
      locale,
      `DELETE tr FROM wpgn_term_relationships tr
       JOIN wpgn_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
       WHERE tr.object_id = ? AND tt.taxonomy = 'category'`,
      [postId],
    );
    const taxIds: number[] = [];
    for (const value of categoryIds) {
      const taxId = await this.termTaxonomyId(locale, String(value || '').trim());
      if (!taxId) continue;
      await this.mysql.exec(
        locale,
        `INSERT IGNORE INTO wpgn_term_relationships (object_id, term_taxonomy_id, term_order) VALUES (?, ?, 0)`,
        [postId, taxId],
      );
      taxIds.push(taxId);
    }
    if (!taxIds.length) return;
    await this.mysql.exec(
      locale,
      `UPDATE wpgn_term_taxonomy tt
       SET count = (
         SELECT COUNT(*) FROM wpgn_term_relationships tr
         JOIN wpgn_posts p ON p.ID = tr.object_id AND p.post_type = 'post' AND p.post_status = 'publish'
         WHERE tr.term_taxonomy_id = tt.term_taxonomy_id
       )
       WHERE tt.term_taxonomy_id IN (${taxIds.map(() => '?').join(', ')})`,
      taxIds,
    );
  }

  private async termTaxonomyId(locale: NewsLocale, idOrSlug: string) {
    if (!idOrSlug) return 0;
    const numeric = Number(idOrSlug);
    if (Number.isFinite(numeric) && numeric > 0) {
      const rows = await this.mysql.query<{ term_taxonomy_id: number }>(
        locale,
        `SELECT term_taxonomy_id FROM wpgn_term_taxonomy WHERE term_id = ? AND taxonomy = 'category' LIMIT 1`,
        [numeric],
      );
      return Number(rows[0]?.term_taxonomy_id || 0);
    }
    const rows = await this.mysql.query<{ term_taxonomy_id: number }>(
      locale,
      `SELECT tt.term_taxonomy_id
       FROM wpgn_term_taxonomy tt
       JOIN wpgn_terms t ON t.term_id = tt.term_id
       WHERE tt.taxonomy = 'category' AND t.slug = ? LIMIT 1`,
      [idOrSlug],
    );
    return Number(rows[0]?.term_taxonomy_id || 0);
  }

  private async setCover(
    locale: NewsLocale,
    postId: number,
    coverUrl?: string,
    coverCaption?: string,
    coverAlt?: string,
  ) {
    const url = String(coverUrl || '').trim();
    const caption = coverCaption === undefined ? undefined : String(coverCaption || '').trim();
    const alt = coverAlt === undefined ? undefined : String(coverAlt || '').trim();
    if (!url && caption === undefined && alt === undefined) return;
    const current = await this.mysql.query<{ meta_value: string }>(
      locale,
      `SELECT meta_value FROM wpgn_postmeta WHERE post_id = ? AND meta_key = '_thumbnail_id' LIMIT 1`,
      [postId],
    );
    let attachmentId = Number(current[0]?.meta_value || 0);
    const now = this.wpStamp(new Date());
    if (attachmentId) {
      const fields = ['post_modified = ?'];
      const params: unknown[] = [now];
      if (url) {
        fields.unshift('guid = ?');
        params.unshift(url);
      }
      if (caption !== undefined) {
        fields.unshift('post_excerpt = ?');
        params.unshift(caption);
      }
      params.push(attachmentId);
      await this.mysql.exec(
        locale,
        `UPDATE wpgn_posts SET ${fields.join(', ')} WHERE ID = ? AND post_type = 'attachment'`,
        params,
      );
    } else if (url) {
      const inserted = await this.mysql.exec(
        locale,
        `INSERT INTO wpgn_posts (
          post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
          post_status, comment_status, ping_status, post_password, post_name,
          to_ping, pinged, post_modified, post_modified_gmt, post_content_filtered,
          post_parent, guid, menu_order, post_type, post_mime_type, comment_count
        ) VALUES (1, ?, ?, '', 'vmm-cover', ?, 'inherit', 'closed', 'closed', '', ?, '', '', ?, ?, '', ?, ?, 0, 'attachment', 'image/jpeg', 0)`,
        [now, now, caption || '', `vmm-cover-${postId}`, now, now, postId, url],
      );
      attachmentId = Number(inserted.insertId || 0);
      if (attachmentId) await this.setMeta(locale, postId, '_thumbnail_id', String(attachmentId));
    }
    if (attachmentId && alt !== undefined) await this.setMeta(locale, attachmentId, '_wp_attachment_image_alt', alt);
  }

  private async getMeta(locale: NewsLocale, postId: number, key: string) {
    const rows = await this.mysql.query<{ meta_value: string }>(
      locale,
      `SELECT meta_value FROM wpgn_postmeta WHERE post_id = ? AND meta_key = ? LIMIT 1`,
      [postId, key],
    );
    return String(rows[0]?.meta_value || '').trim();
  }

  private emptyTagProfile() {
    return {
      about: '',
      logoUrl: '',
      coverUrl: '',
      verified: false,
      followers: 0,
      related: [] as string[],
      supporters: [] as Array<{ name: string; tier: string; points: number }>,
    };
  }

  private async tagTerm(locale: NewsLocale, idOrSlug: string) {
    const key = String(idOrSlug || '').trim();
    const numeric = Number(key);
    const byId = Number.isFinite(numeric) && String(numeric) === key;
    if (!key) return null;
    const rows = await this.mysql.query<{
      term_id: number;
      slug: string;
      name: string;
      description: string;
      count: number;
    }>(
      locale,
      `SELECT t.term_id, t.slug, t.name, tt.description, tt.count
       FROM wpgn_terms t
       JOIN wpgn_term_taxonomy tt ON tt.term_id = t.term_id AND tt.taxonomy = 'post_tag'
       WHERE ${byId ? 't.term_id = ?' : 't.slug = ?'}
       LIMIT 1`,
      [byId ? numeric : key.toLowerCase()],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      term_id: Number(row.term_id),
      slug: row.slug,
      name: String(row.name || '').replace(/&amp;/g, '&'),
      description: String(row.description || ''),
      count: Number(row.count || 0),
    };
  }

  private presentTag(
    locale: NewsLocale,
    term: { term_id: number; slug: string; name: string; description: string },
    profile: ReturnType<NewsService['emptyTagProfile']>,
  ) {
    return {
      id: String(term.term_id),
      slug: term.slug,
      name: term.name,
      description: term.description,
      about: profile.about || term.description,
      logoUrl: profile.logoUrl,
      coverUrl: profile.coverUrl,
      verified: profile.verified,
      followers: profile.followers,
      related: profile.related,
      supporters: profile.supporters,
      href: publicHref(locale, `tag/${term.slug}`),
      locale,
    };
  }

  private async tagProfile(locale: NewsLocale, termId: number) {
    const empty = this.emptyTagProfile();
    try {
      await this.ensureTermMeta(locale);
      const rows = await this.mysql.query<{ meta_value: string }>(
        locale,
        `SELECT meta_value FROM wpgn_termmeta WHERE term_id = ? AND meta_key = '_vmm_tag' LIMIT 1`,
        [termId],
      );
      const data = JSON.parse(String(rows[0]?.meta_value || '{}')) as Partial<ReturnType<NewsService['emptyTagProfile']>>;
      return {
        about: String(data.about || '').slice(0, 4000),
        logoUrl: String(data.logoUrl || '').slice(0, 500),
        coverUrl: String(data.coverUrl || '').slice(0, 500),
        verified: Boolean(data.verified),
        followers: Math.max(0, Number(data.followers || 0)),
        related: Array.isArray(data.related)
          ? data.related.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean).slice(0, 12)
          : [],
        supporters: Array.isArray(data.supporters)
          ? data.supporters
              .map((item) => ({
                name: String(item?.name || '').trim().slice(0, 80),
                tier: String(item?.tier || '').trim().slice(0, 40),
                points: Math.max(0, Number(item?.points || 0)),
              }))
              .filter((item) => item.name)
              .slice(0, 12)
          : [],
      };
    } catch {
      return empty;
    }
  }

  private async tagStats(locale: NewsLocale, termId: number) {
    const rows = await this.mysql.query<{ articles: number; images: number; videos: number; updated_at: Date | string | null }>(
      locale,
      `SELECT COUNT(*) AS articles,
         SUM(th.meta_id IS NOT NULL) AS images,
         SUM(
           p.post_content LIKE '%youtube.com%'
           OR p.post_content LIKE '%youtu.be%'
           OR p.post_content LIKE '%[embed]%'
         ) AS videos,
         MAX(p.post_modified) AS updated_at
       FROM wpgn_posts p
       JOIN wpgn_term_relationships tr ON tr.object_id = p.ID
       JOIN wpgn_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
         AND tt.taxonomy = 'post_tag' AND tt.term_id = ?
       LEFT JOIN wpgn_postmeta th ON th.post_id = p.ID AND th.meta_key = '_thumbnail_id' AND th.meta_value <> ''
       WHERE p.post_type = 'post' AND p.post_status = 'publish'`,
      [termId],
    );
    const row = rows[0];
    return {
      articles: Number(row?.articles || 0),
      images: Number(row?.images || 0),
      videos: Number(row?.videos || 0),
      updatedAt: row?.updated_at || null,
    };
  }

  private async relatedTags(locale: NewsLocale, termId: number) {
    const rows = await this.mysql.query<{ slug: string; name: string }>(
      locale,
      `SELECT t.slug, t.name
       FROM wpgn_term_relationships tr
       JOIN wpgn_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
         AND tt.taxonomy = 'post_tag' AND tt.term_id = ?
       JOIN wpgn_posts p ON p.ID = tr.object_id AND p.post_type = 'post' AND p.post_status = 'publish'
         AND p.post_date >= DATE_SUB(NOW(), INTERVAL 18 MONTH)
       JOIN wpgn_term_relationships tr2 ON tr2.object_id = tr.object_id AND tr2.term_taxonomy_id <> tr.term_taxonomy_id
       JOIN wpgn_term_taxonomy tt2 ON tt2.term_taxonomy_id = tr2.term_taxonomy_id AND tt2.taxonomy = 'post_tag'
       JOIN wpgn_terms t ON t.term_id = tt2.term_id
       GROUP BY t.term_id, t.slug, t.name
       ORDER BY COUNT(*) DESC
       LIMIT 8`,
      [termId],
    );
    return rows.map((row) => ({
      slug: row.slug,
      name: String(row.name || '').replace(/&amp;/g, '&'),
      href: publicHref(locale, `tag/${row.slug}`),
    }));
  }

  private async tagsBySlug(locale: NewsLocale, slugs: string[]) {
    const clean = slugs.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
    if (!clean.length) return [];
    const rows = await this.mysql.query<{ slug: string; name: string }>(
      locale,
      `SELECT t.slug, t.name
       FROM wpgn_terms t
       JOIN wpgn_term_taxonomy tt ON tt.term_id = t.term_id AND tt.taxonomy = 'post_tag'
       WHERE t.slug IN (${clean.map(() => '?').join(', ')})`,
      clean,
    );
    const order = new Map(clean.map((slug, index) => [slug, index]));
    return rows
      .sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99))
      .map((row) => ({
        slug: row.slug,
        name: String(row.name || '').replace(/&amp;/g, '&'),
        href: publicHref(locale, `tag/${row.slug}`),
      }));
  }

  private termMetaReady = new Set<NewsLocale>();

  private async ensureTermMeta(locale: NewsLocale) {
    if (this.termMetaReady.has(locale)) return;
    await this.mysql.exec(
      locale,
      `CREATE TABLE IF NOT EXISTS wpgn_termmeta (
        meta_id bigint unsigned NOT NULL AUTO_INCREMENT,
        term_id bigint unsigned NOT NULL DEFAULT 0,
        meta_key varchar(255) DEFAULT NULL,
        meta_value longtext,
        PRIMARY KEY (meta_id),
        KEY term_id (term_id),
        KEY meta_key (meta_key(191))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    this.termMetaReady.add(locale);
  }

  private async setTermMeta(locale: NewsLocale, termId: number, key: string, value: string) {
    await this.ensureTermMeta(locale);
    const rows = await this.mysql.query<{ meta_id: number }>(
      locale,
      `SELECT meta_id FROM wpgn_termmeta WHERE term_id = ? AND meta_key = ? LIMIT 1`,
      [termId, key],
    );
    if (!value) {
      if (rows[0]) await this.mysql.exec(locale, `DELETE FROM wpgn_termmeta WHERE meta_id = ?`, [rows[0].meta_id]);
      return;
    }
    if (rows[0]) {
      await this.mysql.exec(locale, `UPDATE wpgn_termmeta SET meta_value = ? WHERE meta_id = ?`, [value, rows[0].meta_id]);
      return;
    }
    await this.mysql.exec(locale, `INSERT INTO wpgn_termmeta (term_id, meta_key, meta_value) VALUES (?, ?, ?)`, [
      termId,
      key,
      value,
    ]);
  }

  private async setUserMeta(locale: NewsLocale, userId: number, key: string, value: string) {
    const rows = await this.mysql.query<{ umeta_id: number }>(
      locale,
      `SELECT umeta_id FROM wpgn_usermeta WHERE user_id = ? AND meta_key = ? LIMIT 1`,
      [userId, key],
    );
    if (!value) {
      if (rows[0]) await this.mysql.exec(locale, `DELETE FROM wpgn_usermeta WHERE umeta_id = ?`, [rows[0].umeta_id]);
      return;
    }
    if (rows[0]) {
      await this.mysql.exec(locale, `UPDATE wpgn_usermeta SET meta_value = ? WHERE umeta_id = ?`, [value, rows[0].umeta_id]);
      return;
    }
    await this.mysql.exec(locale, `INSERT INTO wpgn_usermeta (user_id, meta_key, meta_value) VALUES (?, ?, ?)`, [
      userId,
      key,
      value,
    ]);
  }

  private async setMeta(locale: NewsLocale, postId: number, key: string, value: string) {
    const rows = await this.mysql.query<{ meta_id: number }>(
      locale,
      `SELECT meta_id FROM wpgn_postmeta WHERE post_id = ? AND meta_key = ? LIMIT 1`,
      [postId, key],
    );
    if (!value) {
      if (rows[0]) await this.mysql.exec(locale, `DELETE FROM wpgn_postmeta WHERE meta_id = ?`, [rows[0].meta_id]);
      return;
    }
    if (rows[0]) {
      await this.mysql.exec(locale, `UPDATE wpgn_postmeta SET meta_value = ? WHERE meta_id = ?`, [value, rows[0].meta_id]);
      return;
    }
    await this.mysql.exec(locale, `INSERT INTO wpgn_postmeta (post_id, meta_key, meta_value) VALUES (?, ?, ?)`, [
      postId,
      key,
      value,
    ]);
  }

  private lockAuthor(body: UpsertNewsPostDto, actor: NewsActor | undefined, isCreate: boolean) {
    const role = String(actor?.role || '').toLowerCase();
    const canAssign = role === 'admin' || role === 'superadmin' || role === 'owner';
    if (!canAssign) {
      body.authorUserId = actor?.id ? String(actor.id) : undefined;
      body.wpAuthorId = undefined;
      return;
    }
    if (isCreate && !String(body.authorUserId || '').trim()) {
      body.authorUserId = actor?.id ? String(actor.id) : undefined;
    }
  }

  private async setTags(locale: NewsLocale, postId: number, tags: string[]) {
    await this.mysql.exec(
      locale,
      `DELETE tr FROM wpgn_term_relationships tr
       JOIN wpgn_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
       WHERE tr.object_id = ? AND tt.taxonomy = 'post_tag'`,
      [postId],
    );
    const names = [
      ...new Set(
        tags
          .map((item) => String(item || '').replace(/&amp;/g, '&').trim())
          .filter((item) => item.length >= 2)
          .slice(0, 24),
      ),
    ];
    const taxIds: number[] = [];
    for (const name of names) {
      const taxId = await this.ensureTag(locale, name);
      if (!taxId) continue;
      await this.mysql.exec(
        locale,
        `INSERT IGNORE INTO wpgn_term_relationships (object_id, term_taxonomy_id, term_order) VALUES (?, ?, 0)`,
        [postId, taxId],
      );
      taxIds.push(taxId);
    }
    if (!taxIds.length) return;
    await this.mysql.exec(
      locale,
      `UPDATE wpgn_term_taxonomy tt
       SET count = (
         SELECT COUNT(*) FROM wpgn_term_relationships tr
         JOIN wpgn_posts p ON p.ID = tr.object_id AND p.post_type = 'post' AND p.post_status = 'publish'
         WHERE tr.term_taxonomy_id = tt.term_taxonomy_id
       )
       WHERE tt.term_taxonomy_id IN (${taxIds.map(() => '?').join(', ')})`,
      taxIds,
    );
  }

  private async ensureTag(locale: NewsLocale, name: string) {
    const slug = normalizeSlug(name) || 'tag';
    const found = await this.mysql.query<{ term_taxonomy_id: number }>(
      locale,
      `SELECT tt.term_taxonomy_id
       FROM wpgn_term_taxonomy tt
       JOIN wpgn_terms t ON t.term_id = tt.term_id
       WHERE tt.taxonomy = 'post_tag' AND (t.slug = ? OR t.name = ?)
       LIMIT 1`,
      [slug, name],
    );
    if (found[0]) return Number(found[0].term_taxonomy_id);
    const inserted = await this.mysql.exec(
      locale,
      `INSERT INTO wpgn_terms (name, slug, term_group) VALUES (?, ?, 0)`,
      [name.slice(0, 200), slug.slice(0, 200)],
    );
    const termId = Number(inserted.insertId || 0);
    if (!termId) return 0;
    const tax = await this.mysql.exec(
      locale,
      `INSERT INTO wpgn_term_taxonomy (term_id, taxonomy, description, parent, count) VALUES (?, 'post_tag', '', 0, 0)`,
      [termId],
    );
    return Number(tax.insertId || 0);
  }

  private attachmentKind(url: string, type?: string, name?: string) {
    const hint = `${type || ''} ${name || ''} ${url}`.toLowerCase();
    if (hint.includes('gif') || hint.endsWith('.gif')) return 'gif';
    if (hint.includes('video') || /\.(mp4|webm|mov)(\?|$)/.test(hint)) return 'video';
    return 'image';
  }

  private parseAttachments(raw: unknown): NewsAttachment[] {
    const list = Array.isArray(raw) ? raw : [];
    return list
      .map((item) => {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        const url = String(row.url || '').trim();
        if (!url) return null;
        const name = String(row.name || url.split('/').pop() || 'archivo').slice(0, 180);
        return { url, name, type: this.attachmentKind(url, String(row.type || ''), name) };
      })
      .filter((item): item is NewsAttachment => Boolean(item))
      .slice(0, 24);
  }

  private async attachmentsFor(locale: NewsLocale, postId: number) {
    const rows = await this.mysql.query<{ meta_value: string }>(
      locale,
      `SELECT meta_value FROM wpgn_postmeta WHERE post_id = ? AND meta_key = '_vmm_attachments' LIMIT 1`,
      [postId],
    );
    try {
      return this.parseAttachments(JSON.parse(rows[0]?.meta_value || '[]'));
    } catch {
      return [];
    }
  }

  private async setAttachments(locale: NewsLocale, postId: number, items: Array<{ url?: string; type?: string; name?: string }>) {
    const attachments = this.parseAttachments(items);
    await this.setMeta(locale, postId, '_vmm_attachments', attachments.length ? JSON.stringify(attachments) : '');
  }

  private commentsReady = new Set<NewsLocale>();
  private commentsGifReady = new Set<NewsLocale>();
  private commentVotesReady = new Set<NewsLocale>();
  private commentReactionsReady = new Set<NewsLocale>();
  private commentReportsReady = new Set<NewsLocale>();
  private commentReportOptionsReady = new Set<NewsLocale>();

  private defaultCommentReportOptions() {
    return [
      { key: 'spam', labelEs: 'Spam', labelEn: 'Spam', enabled: true, sort: 1 },
      { key: 'offensive', labelEs: 'Contenido ofensivo', labelEn: 'Offensive content', enabled: true, sort: 2 },
      { key: 'sexual', labelEs: 'Contenido sexual', labelEn: 'Sexual content', enabled: true, sort: 3 },
      { key: 'harassment', labelEs: 'Acoso', labelEn: 'Harassment', enabled: true, sort: 4 },
      { key: 'misinformation', labelEs: 'Desinformación', labelEn: 'Misinformation', enabled: true, sort: 5 },
      { key: 'other', labelEs: 'Otro', labelEn: 'Other', enabled: true, sort: 6 },
    ];
  }

  private async ensureCommentsTable(locale: NewsLocale) {
    if (!this.commentsReady.has(locale)) {
      await this.mysql.exec(
        locale,
        `CREATE TABLE IF NOT EXISTS vmm_comments (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          post_id BIGINT UNSIGNED NOT NULL,
          parent_id BIGINT UNSIGNED NULL,
          user_id VARCHAR(32) NOT NULL,
          author_name VARCHAR(160) NOT NULL,
          author_username VARCHAR(64) NULL,
          author_photo TEXT NULL,
          body TEXT NOT NULL,
          gif TEXT NULL,
          created_at DATETIME NOT NULL,
          PRIMARY KEY (id),
          KEY post_id (post_id),
          KEY parent_id (parent_id),
          KEY user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );
      try {
        await this.mysql.exec(
          locale,
          `ALTER TABLE vmm_comments
           ADD COLUMN parent_id BIGINT UNSIGNED NULL AFTER post_id,
           ADD KEY parent_id (parent_id)`,
        );
      } catch {
        /* column/index already exists on upgraded DBs */
      }
      await this.backfillOrphanReplies(locale);
      this.commentsReady.add(locale);
    }
    if (!this.commentsGifReady.has(locale)) {
      try {
        await this.mysql.exec(locale, `ALTER TABLE vmm_comments ADD COLUMN gif TEXT NULL AFTER body`);
      } catch {
        /* column already exists on upgraded DBs */
      }
      this.commentsGifReady.add(locale);
    }
  }

  /** Link old @mention replies that were saved flat before parent_id existed. */
  private async backfillOrphanReplies(locale: NewsLocale) {
    try {
      const orphans = await this.mysql.query<{
        id: number;
        post_id: number;
        body: string;
        created_at: Date | string;
      }>(
        locale,
        `SELECT id, post_id, body, created_at
         FROM vmm_comments
         WHERE parent_id IS NULL AND body LIKE '@%'
         ORDER BY id ASC
         LIMIT 500`,
      );
      for (const orphan of orphans) {
        const mention = String(orphan.body || '')
          .trim()
          .match(/^@([A-Za-z0-9._-]+)/)?.[1];
        if (!mention) continue;
        const parents = await this.mysql.query<{ id: number }>(
          locale,
          `SELECT id
           FROM vmm_comments
           WHERE post_id = ?
             AND id < ?
             AND parent_id IS NULL
             AND (
               LOWER(author_username) = LOWER(?)
               OR LOWER(REPLACE(author_name, ' ', '')) = LOWER(?)
             )
           ORDER BY id DESC
           LIMIT 1`,
          [orphan.post_id, orphan.id, mention, mention],
        );
        if (!parents[0]) continue;
        await this.mysql.exec(locale, `UPDATE vmm_comments SET parent_id = ? WHERE id = ? AND parent_id IS NULL`, [
          parents[0].id,
          orphan.id,
        ]);
      }
    } catch {
      /* ignore backfill failures */
    }
  }

  private async ensureCommentVotesTable(locale: NewsLocale) {
    if (this.commentVotesReady.has(locale)) return;
    await this.mysql.exec(
      locale,
      `CREATE TABLE IF NOT EXISTS vmm_comment_votes (
        comment_id BIGINT UNSIGNED NOT NULL,
        user_id VARCHAR(32) NOT NULL,
        value TINYINT NOT NULL,
        updated_at DATETIME NOT NULL,
        PRIMARY KEY (comment_id, user_id),
        KEY comment_id (comment_id),
        KEY user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    this.commentVotesReady.add(locale);
  }

  private async ensureCommentReactionsTable(locale: NewsLocale) {
    if (this.commentReactionsReady.has(locale)) return;
    await this.mysql.exec(
      locale,
      `CREATE TABLE IF NOT EXISTS vmm_comment_reactions (
        comment_id BIGINT UNSIGNED NOT NULL,
        user_id VARCHAR(32) NOT NULL,
        reaction VARCHAR(16) NOT NULL,
        updated_at DATETIME NOT NULL,
        PRIMARY KEY (comment_id, user_id),
        KEY comment_id (comment_id),
        KEY reaction (reaction)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    this.commentReactionsReady.add(locale);
  }

  private async ensureCommentReportsTable(locale: NewsLocale) {
    if (this.commentReportsReady.has(locale)) return;
    await this.mysql.exec(
      locale,
      `CREATE TABLE IF NOT EXISTS vmm_comment_reports (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        comment_id BIGINT UNSIGNED NOT NULL,
        post_id BIGINT UNSIGNED NOT NULL,
        post_slug VARCHAR(200) NULL,
        reporter_user_id VARCHAR(32) NOT NULL,
        reported_user_id VARCHAR(32) NULL,
        reason_key VARCHAR(64) NOT NULL,
        reason_label VARCHAR(160) NOT NULL,
        details TEXT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'open',
        created_at DATETIME NOT NULL,
        resolved_at DATETIME NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_reporter_comment (comment_id, reporter_user_id),
        KEY status (status),
        KEY post_id (post_id),
        KEY created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    this.commentReportsReady.add(locale);
  }

  private async ensureCommentReportOptionsTable(locale: NewsLocale) {
    if (this.commentReportOptionsReady.has(locale)) return;
    await this.mysql.exec(
      locale,
      `CREATE TABLE IF NOT EXISTS vmm_comment_report_options (
        id TINYINT UNSIGNED NOT NULL,
        options_json LONGTEXT NOT NULL,
        updated_at DATETIME NOT NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    const rows = await this.mysql.query<{ id: number }>(
      locale,
      `SELECT id FROM vmm_comment_report_options WHERE id = 1 LIMIT 1`,
    );
    if (!rows[0]) {
      await this.mysql.exec(
        locale,
        `INSERT INTO vmm_comment_report_options (id, options_json, updated_at) VALUES (1, ?, ?)`,
        [JSON.stringify(this.defaultCommentReportOptions()), this.wpStamp(new Date())],
      );
    }
    this.commentReportOptionsReady.add(locale);
  }

  private async getCommentReportOptions(locale: NewsLocale) {
    await this.ensureCommentReportOptionsTable(locale);
    const rows = await this.mysql.query<{ options_json: string }>(
      locale,
      `SELECT options_json FROM vmm_comment_report_options WHERE id = 1 LIMIT 1`,
    );
    try {
      const parsed = JSON.parse(rows[0]?.options_json || '[]');
      if (!Array.isArray(parsed) || !parsed.length) return this.defaultCommentReportOptions();
      return parsed
        .map((item: any, index: number) => ({
          key: String(item?.key || '').trim().toLowerCase(),
          labelEs: String(item?.labelEs || item?.key || '').trim(),
          labelEn: String(item?.labelEn || item?.key || '').trim(),
          enabled: item?.enabled !== false,
          sort: Number.isFinite(Number(item?.sort)) ? Number(item.sort) : index + 1,
        }))
        .filter((item: { key: string }) => item.key)
        .sort((a: { sort: number }, b: { sort: number }) => a.sort - b.sort);
    } catch {
      return this.defaultCommentReportOptions();
    }
  }

  private async commentReactionState(locale: NewsLocale, commentId: number, viewerUserId = '') {
    const counts = await this.mysql.query<{ reaction: string; total: number }>(
      locale,
      `SELECT reaction, COUNT(*) AS total
       FROM vmm_comment_reactions
       WHERE comment_id = ?
       GROUP BY reaction`,
      [commentId],
    );
    const mine = viewerUserId
      ? await this.mysql.query<{ reaction: string }>(
          locale,
          `SELECT reaction FROM vmm_comment_reactions WHERE comment_id = ? AND user_id = ? LIMIT 1`,
          [commentId, viewerUserId],
        )
      : [];
    const reactions = { love: 0, laugh: 0, wow: 0, fire: 0 };
    for (const row of counts) {
      if (row.reaction in reactions) reactions[row.reaction as keyof typeof reactions] = Number(row.total || 0);
    }
    return {
      id: String(commentId),
      reactions,
      myReaction: String(mine[0]?.reaction || '') || null,
    };
  }

  private normalizeCommentGif(value?: { url?: string; title?: string } | string | null): NewsCommentGif | null {
    try {
      const raw =
        typeof value === 'string'
          ? (JSON.parse(value) as { url?: string; title?: string })
          : value && typeof value === 'object'
            ? value
            : null;
      const url = String(raw?.url || '').trim();
      if (!url || !/^https?:\/\//i.test(url)) return null;
      return {
        url: url.slice(0, 500),
        title: String(raw?.title || '').slice(0, 200),
        source: 'giphy',
      };
    } catch {
      return null;
    }
  }

  private mapComment(
    row: NewsCommentRow & {
      score?: number;
      my_vote?: number | null;
      love_count?: number;
      laugh_count?: number;
      wow_count?: number;
      fire_count?: number;
      my_reaction?: string | null;
    },
  ) {
    const username = String(row.author_username || '').trim();
    const parentId = row.parent_id ? String(row.parent_id) : null;
    return {
      id: String(row.id),
      postId: String(row.post_id),
      parentId,
      userId: String(row.user_id),
      authorName: row.author_name || 'Usuario',
      authorUsername: username || undefined,
      authorPhotoUrl: row.author_photo || undefined,
      body: row.body,
      gif: this.normalizeCommentGif(row.gif || null),
      createdAt: row.created_at,
      score: Number(row.score || 0),
      myVote: Number(row.my_vote || 0) === 1 || Number(row.my_vote || 0) === -1 ? Number(row.my_vote) : 0,
      reactions: {
        love: Number(row.love_count || 0),
        laugh: Number(row.laugh_count || 0),
        wow: Number(row.wow_count || 0),
        fire: Number(row.fire_count || 0),
      },
      myReaction: String(row.my_reaction || '') || null,
    };
  }

  private async commentsFor(locale: NewsLocale, postId: number, viewerUserId = '') {
    await this.ensureCommentsTable(locale);
    await this.ensureCommentVotesTable(locale);
    await this.ensureCommentReactionsTable(locale);
    const rows = await this.mysql.query<
      NewsCommentRow & {
        score: number;
        my_vote: number | null;
        love_count: number;
        laugh_count: number;
        wow_count: number;
        fire_count: number;
        my_reaction: string | null;
      }
    >(
      locale,
      `SELECT c.id, c.post_id, c.parent_id, c.user_id, c.author_name, c.author_username, c.author_photo, c.body, c.gif, c.created_at,
              COALESCE((SELECT SUM(v.value) FROM vmm_comment_votes v WHERE v.comment_id = c.id), 0) AS score,
              (SELECT v.value FROM vmm_comment_votes v WHERE v.comment_id = c.id AND v.user_id = ? LIMIT 1) AS my_vote,
              COALESCE((SELECT COUNT(*) FROM vmm_comment_reactions r WHERE r.comment_id = c.id AND r.reaction = 'love'), 0) AS love_count,
              COALESCE((SELECT COUNT(*) FROM vmm_comment_reactions r WHERE r.comment_id = c.id AND r.reaction = 'laugh'), 0) AS laugh_count,
              COALESCE((SELECT COUNT(*) FROM vmm_comment_reactions r WHERE r.comment_id = c.id AND r.reaction = 'wow'), 0) AS wow_count,
              COALESCE((SELECT COUNT(*) FROM vmm_comment_reactions r WHERE r.comment_id = c.id AND r.reaction = 'fire'), 0) AS fire_count,
              (SELECT r.reaction FROM vmm_comment_reactions r WHERE r.comment_id = c.id AND r.user_id = ? LIMIT 1) AS my_reaction
       FROM vmm_comments c
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC, c.id ASC
       LIMIT 200`,
      [viewerUserId || '', viewerUserId || '', postId],
    );
    return rows.map((row) => this.mapComment(row));
  }

  private async commentCount(locale: NewsLocale, postId: number) {
    try {
      await this.ensureCommentsTable(locale);
      const rows = await this.mysql.query<{ total: number }>(
        locale,
        `SELECT COUNT(*) AS total FROM vmm_comments WHERE post_id = ?`,
        [postId],
      );
      return Number(rows[0]?.total || 0);
    } catch {
      return 0;
    }
  }

  private async syncCommentCount(locale: NewsLocale, postId: number) {
    const total = await this.commentCount(locale, postId);
    await this.mysql.exec(locale, `UPDATE wpgn_posts SET comment_count = ? WHERE ID = ?`, [total, postId]);
  }

  private async requirePublishedId(locale: NewsLocale, slug: string) {
    const key = String(slug || '').trim();
    const rows = await this.mysql.query<{ ID: number }>(
      locale,
      `SELECT ID FROM wpgn_posts WHERE post_type = 'post' AND post_status = 'publish' AND post_name = ? LIMIT 1`,
      [key],
    );
    if (!rows[0]) throw new NotFoundException('No encontramos esa noticia.');
    return Number(rows[0].ID);
  }

  private async authorProfile(locale: NewsLocale, nicename: string) {
    const key = String(nicename || '')
      .trim()
      .toLowerCase();
    if (!key) return null;
    const rows = await this.mysql.query<{
      ID: number;
      display_name: string;
      user_nicename: string;
      user_email: string;
      user_url: string;
    }>(
      locale,
      `SELECT u.ID, u.display_name, u.user_nicename, u.user_email, u.user_url
       FROM wpgn_users u
       WHERE u.user_nicename = ? OR u.user_login = ?
       LIMIT 1`,
      [key, key],
    );
    const user = rows[0];
    if (!user) return null;
    let bio = '';
    let photoUrl = '';
    let extraSite = '';
    let postCount = 0;
    try {
      const metas = await this.mysql.query<{ meta_key: string; meta_value: string }>(
        locale,
        `SELECT meta_key, meta_value FROM wpgn_usermeta WHERE user_id = ? AND meta_key IN ('description', 'vmm_avatar', 'vmm_website')`,
        [user.ID],
      );
      for (const row of metas) {
        if (row.meta_key === 'description') bio = String(row.meta_value || '').trim();
        if (row.meta_key === 'vmm_avatar') photoUrl = String(row.meta_value || '').trim();
        if (row.meta_key === 'vmm_website') extraSite = String(row.meta_value || '').trim();
      }
    } catch {
      bio = '';
    }
    try {
      const counts = await this.mysql.query<{ total: number }>(
        locale,
        `SELECT COUNT(*) AS total FROM wpgn_posts p WHERE p.post_author = ? AND p.post_type = 'post' AND p.post_status = 'publish'`,
        [user.ID],
      );
      postCount = Number(counts[0]?.total || 0);
    } catch {
      postCount = 0;
    }
    const linked = String(user.user_url || '').startsWith('vmm:');
    const website = linked ? extraSite : String(user.user_url || '').trim();
    return {
      id: Number(user.ID),
      slug: user.user_nicename || key,
      name: user.display_name || user.user_nicename || key,
      bio,
      photoUrl: photoUrl || gravatarUrl(user.user_email),
      website,
      postCount,
    };
  }

  private async withAuthors<
    T extends { id: string; authorName: string; locale?: string; authorHref?: string; authorPhotoUrl?: string },
  >(locale: NewsLocale, items: T[]) {
    if (!items.length) return items;
    const ids = items.map((item) => Number(item.id)).filter((id) => id > 0);
    if (!ids.length) return items;
    const metas = await this.mysql.query<{ post_id: number; meta_value: string }>(
      locale,
      `SELECT post_id, meta_value FROM wpgn_postmeta WHERE meta_key = '_vmm_user_id' AND post_id IN (${ids.map(() => '?').join(', ')})`,
      ids,
    );
    const byPost = new Map(metas.map((row) => [String(row.post_id), String(row.meta_value || '').trim()]));
    const userIds = [...new Set([...byPost.values()].filter((value) => /^\d+$/.test(value)))].map((value) => BigInt(value));
    if (!userIds.length) return items;
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, displayName: true, photoUrl: true, email: true },
    });
    const byUser = new Map(users.map((user) => [user.id.toString(), user]));
    return items.map((item) => {
      const linked = byPost.get(item.id);
      const user = linked ? byUser.get(linked) : null;
      if (!user) return item;
      const username = String(user.username || '').trim();
      return {
        ...item,
        authorUserId: linked,
        authorName: user.displayName || user.username || item.authorName,
        authorUsername: username || undefined,
        authorEmail: user.email || undefined,
        authorPhotoUrl: user.photoUrl || item.authorPhotoUrl,
        authorHref:
          item.authorHref ||
          (username ? publicHref((item.locale || locale) as NewsLocale, `user/${username}`) : undefined),
        authorProfileHref: username ? publicHref((item.locale || locale) as NewsLocale, `user/${username}`) : undefined,
      };
    });
  }

  async sitemapCount(localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    const rows = await this.mysql.query<{ total: number }>(
      locale,
      `SELECT COUNT(*) AS total FROM wpgn_posts p WHERE p.post_type = 'post' AND p.post_status = 'publish'`,
    );
    return Number(rows[0]?.total || 0);
  }

  async listSitemap(localeValue: string | undefined, page: number, limit = 2000) {
    const locale = this.mysql.locale(localeValue);
    const safePage = Math.max(1, Number(page || 1));
    const safeLimit = Math.min(5000, Math.max(1, Number(limit || 2000)));
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
       WHERE p.post_type = 'post' AND p.post_status = 'publish'
       ORDER BY p.post_date DESC, p.ID DESC
       LIMIT ? OFFSET ?`,
      [safeLimit, offset],
    );
    const other = this.otherLocale(locale);
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

  async listRssFeed(localeValue?: string, limit = 15) {
    const locale = this.mysql.locale(localeValue);
    const safeLimit = Math.min(50, Math.max(1, Number(limit || 15)));
    const rows = await this.mysql.query<
      PostRow & {
        post_date_gmt?: string | null;
        yoast_desc?: string | null;
        rank_desc?: string | null;
        ruby_tagline?: string | null;
      }
    >(
      locale,
      `SELECT p.ID, p.post_title, p.post_name, p.post_excerpt, p.post_content,
        DATE_FORMAT(p.post_date, '%Y-%m-%d %H:%i:%s') AS post_date,
        DATE_FORMAT(p.post_date_gmt, '%Y-%m-%d %H:%i:%s') AS post_date_gmt,
        p.post_status, p.post_author, p.comment_count,
        COALESCE(NULLIF(u.display_name, ''), u.user_nicename, u.user_login) AS author_name,
        att.guid AS cover_url,
        yoast.meta_value AS yoast_desc,
        rankm.meta_value AS rank_desc,
        tagline.meta_value AS ruby_tagline
       FROM wpgn_posts p
       LEFT JOIN wpgn_users u ON u.ID = p.post_author
       LEFT JOIN wpgn_postmeta th ON th.post_id = p.ID AND th.meta_key = '_thumbnail_id'
       LEFT JOIN wpgn_posts att ON att.ID = CAST(th.meta_value AS UNSIGNED)
       LEFT JOIN wpgn_postmeta yoast ON yoast.post_id = p.ID AND yoast.meta_key = '_yoast_wpseo_metadesc'
       LEFT JOIN wpgn_postmeta rankm ON rankm.post_id = p.ID AND rankm.meta_key = 'rank_math_description'
       LEFT JOIN wpgn_postmeta tagline ON tagline.post_id = p.ID AND tagline.meta_key = 'ruby_tagline'
       WHERE p.post_type = 'post' AND p.post_status = 'publish'
       ORDER BY p.post_date DESC
       LIMIT ?`,
      [safeLimit],
    );
    const ids = rows.map((row) => row.ID);
    const [cats, tags] = await Promise.all([this.categoriesFor(locale, ids), this.tagsFor(locale, ids)]);
    const items = await this.withAuthors(
      locale,
      rows.map((row) => {
        const content = rssBodyHtml(row.post_content || '');
        const gmt = String(row.post_date_gmt || '').startsWith('0000') ? '' : String(row.post_date_gmt || '').trim();
        const seo = String(row.ruby_tagline || row.rank_desc || row.yoast_desc || '').trim();
        const excerpt = String(row.post_excerpt || '').trim() || seo || plainExcerpt(row.post_content);
        const card = toCard(row, [...(cats.get(row.ID) || []), ...(tags.get(row.ID) || [])], locale);
        return {
          ...card,
          excerpt,
          publishedAt: gmt || row.post_date,
          content,
          youtubeUrl: firstYoutubeEmbed(content || row.post_content || ''),
        };
      }),
    );
    return { locale, items };
  }

  async listNewsSitemap(localeValue?: string, hours = 48) {
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
       ORDER BY p.post_date DESC
       LIMIT 1000`,
      [windowHours],
    );
    const other = this.otherLocale(locale);
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

  private refreshSitemaps(locale: NewsLocale) {
    void this.sitemaps.notify(locale).catch((error) => this.logger.warn(`sitemap ping failed: ${String(error)}`));
  }

  async listSitePages(localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    try {
      await this.ensureSitePages(locale);
    } catch {
      // Keep listing defaults even if seed/MySQL is briefly unavailable.
    }
    const items: Array<{
      key: string;
      id: string;
      title: string;
      slug: string;
      status: string;
      href: string;
      updatedAt: string | Date | null;
      locale: NewsLocale;
    }> = [];
    for (const def of SITE_PAGES) {
      let row: Awaited<ReturnType<NewsService['findSitePageRow']>> = null;
      try {
        row = await this.findSitePageRow(locale, def.key);
      } catch {
        row = null;
      }
      const slug = locale === 'en' ? def.enSlug : def.esSlug;
      items.push({
        key: def.key,
        id: row ? String(row.ID) : '',
        title: row?.post_title || (locale === 'en' ? def.enTitle : def.esTitle),
        slug: row?.post_name || slug,
        status: row?.post_status || 'publish',
        href: sitePageHref(locale, def.key),
        updatedAt: row?.post_modified || null,
        locale,
      });
    }
    return serialize({ locale, items });
  }

  async getSitePage(slugOrKey: string, localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    await this.ensureSitePages(locale);
    const def = sitePageByKey(slugOrKey) || sitePageBySlug(locale, slugOrKey);
    if (!def) throw new NotFoundException('No encontramos esa página.');
    const row = await this.findSitePageRow(locale, def.key);
    if (!row) throw new NotFoundException('No encontramos esa página.');
    return serialize({
      key: def.key,
      id: String(row.ID),
      title: row.post_title,
      slug: row.post_name,
      content: expandNewsEmbeds(sanitizeNewsHtml(row.post_content || '')),
      status: row.post_status,
      href: sitePageHref(locale, def.key),
      updatedAt: row.post_modified,
      locale,
    });
  }

  async adminGetSitePage(key: string, localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    await this.ensureSitePages(locale);
    const def = sitePageByKey(key);
    if (!def) throw new NotFoundException('Página no válida.');
    const row = await this.findSitePageRow(locale, def.key);
    if (!row) throw new NotFoundException('Página no válida.');
    return serialize({
      key: def.key,
      id: String(row.ID),
      title: row.post_title,
      slug: row.post_name,
      content: row.post_content || '',
      status: row.post_status,
      href: sitePageHref(locale, def.key),
      updatedAt: row.post_modified,
      locale,
    });
  }

  async updateSitePage(
    key: string,
    body: { locale?: string; title?: string; content?: string; status?: string },
  ) {
    const locale = this.mysql.locale(body.locale);
    await this.ensureSitePages(locale);
    const def = sitePageByKey(key);
    if (!def) throw new BadRequestException('Página no válida.');
    const row = await this.findSitePageRow(locale, def.key);
    if (!row) throw new NotFoundException('Página no válida.');
    const title = String(body.title || '').trim() || (locale === 'en' ? def.enTitle : def.esTitle);
    if (title.length < 2) throw new BadRequestException('El título es obligatorio.');
    const content = ensureImageAlts(sanitizeNewsHtml(body.content || ''), title);
    const status = String(body.status || 'publish').trim() === 'draft' ? 'draft' : 'publish';
    const slug = locale === 'en' ? def.enSlug : def.esSlug;
    const now = this.wpStamp(new Date());
    const nowGmt = this.wpStamp(new Date(), true);
    await this.mysql.exec(
      locale,
      `UPDATE wpgn_posts SET
        post_title = ?, post_content = ?, post_status = ?, post_name = ?,
        post_modified = ?, post_modified_gmt = ?, guid = ?
       WHERE ID = ? AND post_type = 'page'`,
      [title, content, status, slug, now, nowGmt, sitePageHref(locale, def.key), row.ID],
    );
    await this.setMeta(locale, row.ID, SITE_PAGE_META_KEY, def.key);
    return this.adminGetSitePage(def.key, locale);
  }

  private async ensureSitePages(locale: NewsLocale) {
    for (const def of SITE_PAGES) {
      const existing = await this.findSitePageRow(locale, def.key);
      if (existing) continue;
      const slug = locale === 'en' ? def.enSlug : def.esSlug;
      const title = locale === 'en' ? def.enTitle : def.esTitle;
      const content = locale === 'en' ? def.enHtml : def.esHtml;
      const now = this.wpStamp(new Date());
      const nowGmt = this.wpStamp(new Date(), true);
      const bySlug = await this.mysql.query<{ ID: number }>(
        locale,
        `SELECT ID FROM wpgn_posts WHERE post_type = 'page' AND post_name = ? LIMIT 1`,
        [slug],
      );
      let id = Number(bySlug[0]?.ID || 0);
      if (id) {
        const empty = await this.mysql.query<{ post_content: string }>(
          locale,
          `SELECT post_content FROM wpgn_posts WHERE ID = ? LIMIT 1`,
          [id],
        );
        if (!String(empty[0]?.post_content || '').trim()) {
          await this.mysql.exec(
            locale,
            `UPDATE wpgn_posts SET post_title = ?, post_content = ?, post_status = 'publish', post_modified = ?, post_modified_gmt = ? WHERE ID = ?`,
            [title, content, now, nowGmt, id],
          );
        }
      } else {
        const inserted = await this.mysql.exec(
          locale,
          `INSERT INTO wpgn_posts (
            post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt,
            post_status, comment_status, ping_status, post_password, post_name,
            to_ping, pinged, post_modified, post_modified_gmt, post_content_filtered,
            post_parent, guid, menu_order, post_type, post_mime_type, comment_count
          ) VALUES (1, ?, ?, ?, ?, '', 'publish', 'closed', 'closed', '', ?, '', '', ?, ?, '', 0, ?, 0, 'page', '', 0)`,
          [now, nowGmt, content, title, slug, now, nowGmt, sitePageHref(locale, def.key)],
        );
        id = Number(inserted.insertId || 0);
      }
      if (id) await this.setMeta(locale, id, SITE_PAGE_META_KEY, def.key);
    }
  }

  private async findSitePageRow(locale: NewsLocale, key: string) {
    const def = sitePageByKey(key);
    if (!def) return null;
    const slug = locale === 'en' ? def.enSlug : def.esSlug;
    const byMeta = await this.mysql.query<{
      ID: number;
      post_title: string;
      post_name: string;
      post_content: string;
      post_status: string;
      post_modified: Date | string;
    }>(
      locale,
      `SELECT p.ID, p.post_title, p.post_name, p.post_content, p.post_status, p.post_modified
       FROM wpgn_posts p
       JOIN wpgn_postmeta m ON m.post_id = p.ID AND m.meta_key = ? AND m.meta_value = ?
       WHERE p.post_type = 'page'
       LIMIT 1`,
      [SITE_PAGE_META_KEY, key],
    );
    if (byMeta[0]) return byMeta[0];
    const bySlug = await this.mysql.query<{
      ID: number;
      post_title: string;
      post_name: string;
      post_content: string;
      post_status: string;
      post_modified: Date | string;
    }>(
      locale,
      `SELECT ID, post_title, post_name, post_content, post_status, post_modified
       FROM wpgn_posts
       WHERE post_type = 'page' AND post_name = ?
       LIMIT 1`,
      [slug],
    );
    return bySlug[0] || null;
  }

  private wpStamp(value: Date, gmt = false) {
    const year = gmt ? value.getUTCFullYear() : value.getFullYear();
    const month = String((gmt ? value.getUTCMonth() : value.getMonth()) + 1).padStart(2, '0');
    const day = String(gmt ? value.getUTCDate() : value.getDate()).padStart(2, '0');
    const hour = String(gmt ? value.getUTCHours() : value.getHours()).padStart(2, '0');
    const minute = String(gmt ? value.getUTCMinutes() : value.getMinutes()).padStart(2, '0');
    const second = String(gmt ? value.getUTCSeconds() : value.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }
}
