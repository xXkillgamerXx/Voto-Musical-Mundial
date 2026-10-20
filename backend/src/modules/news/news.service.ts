import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { normalizeSlug } from '../../common/poll-lookup';
import { serialize } from '../../common/serialize';
import { ListNewsDto } from './dto/list-news.dto';
import { NewsLocale, NewsMysqlService } from './news-mysql';
import { plainExcerpt, sanitizeNewsHtml } from './news-html';

type PostRow = {
  ID: number;
  post_title: string;
  post_name: string;
  post_excerpt: string;
  post_content: string;
  post_date: Date | string;
  comment_count: number;
  author_name?: string | null;
  cover_url?: string | null;
  view_count?: number;
};

type TermRow = { object_id: number; slug: string; name: string };

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

const firstImage = (html: string) => {
  const match = String(html || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  const url = match?.[1]?.replace(/\\\//g, '/');
  if (!url) return null;
  return url.startsWith('//') ? `https:${url}` : url;
};

const toCard = (post: PostRow, categories: Array<{ slug: string; name: string }>, locale: NewsLocale = 'es') => {
  const category = categories[0];
  const excerpt = String(post.post_excerpt || '').trim() || plainExcerpt(post.post_content);
  return {
    id: String(post.ID),
    slug: post.post_name,
    title: post.post_title,
    excerpt,
    coverUrl: post.cover_url || firstImage(post.post_content),
    featured: false,
    status: 'publish',
    authorName: post.author_name || (locale === 'en' ? 'Staff' : 'Redacción'),
    publishedAt: post.post_date,
    viewCount: Number(post.view_count || 0),
    commentCount: Number(post.comment_count || 0),
    category: category?.name || (locale === 'en' ? 'News' : 'Noticias'),
    categorySlug: category?.slug || 'noticias',
    categories,
    href: `/${locale}/${post.post_name}`,
    locale,
  };
};

@Injectable()
export class NewsService {
  constructor(private readonly mysql: NewsMysqlService) {}

  async listPublic(input: ListNewsDto & { locale?: string }) {
    const locale = this.mysql.locale(input.locale);
    const page = Math.max(1, Number(input.page || 1));
    const limit = Math.min(50, Math.max(1, Number(input.limit || 12)));
    const category = normalizeSlug(input.category);
    const q = String(input.q || '').trim();
    const { items, total } = await this.loadPosts(locale, {
      page,
      limit,
      category,
      q,
    });
    return serialize({ page, limit, total, items });
  }

  async home(localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    const feed = { page: 1, skipCount: true as const };
    const [latest, kpop, pop, viral, series, social, interviews, categoryList] = await Promise.all([
      this.loadPosts(locale, { ...feed, limit: 16 }),
      this.loadPosts(locale, { ...feed, limit: 8, slugs: ['kpop', 'k-pop'] }),
      this.loadPosts(locale, { ...feed, limit: 8, slugs: ['pop'] }),
      this.loadPosts(locale, { ...feed, limit: 16, slugs: ['viral'] }),
      this.loadPosts(locale, { ...feed, limit: 8, slugs: ['series', 'cine', 'peliculas', 'k-drama'] }),
      this.loadPosts(locale, { ...feed, limit: 6, slugs: ['redes-sociales'] }),
      this.loadPosts(locale, { ...feed, limit: 6, slugs: ['entrevista', 'entrevistas'] }),
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
    const pool = latest.items;
    const fallback = [...pool, ...viral.items, ...kpop.items];
    const above = new Set<string>();
    const spotlight = take(pool, 2, above);
    const cards = take(pool, 3, above);
    const trends = take(viral.items.length ? viral.items : fallback, 5, above);
    const entertainment = take(
      [...kpop.items, ...viral.items, ...fallback],
      4,
      above,
    );
    const avoidHero = () => new Set([...spotlight, ...cards].map((item) => item.id));
    const kpopBlock = take(kpop.items.length ? kpop.items : fallback, 6, avoidHero());
    const seriesBlock = take(series.items.length ? series.items : fallback, 5, avoidHero());
    const popBlock = take(pop.items.length ? pop.items : fallback, 6, avoidHero());
    const more = take(pool.length ? pool : fallback, 8, avoidHero());
    const socialBlock = take(social.items.length ? social.items : fallback, 4, avoidHero());
    const interviewBlock = take(interviews.items.length ? interviews.items : fallback, 4, avoidHero());
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

  async findBySlug(slug: string, localeValue?: string) {
    const locale = this.mysql.locale(localeValue);
    const key = String(slug || '').trim();
    const rows = await this.mysql.query<PostRow>(
      locale,
      `${this.postSelect()} WHERE p.post_type = 'post' AND p.post_status = 'publish' AND p.post_name = ? LIMIT 1`,
      [key],
    );
    const post = rows[0];
    if (!post) throw new NotFoundException('No encontramos esa noticia.');
    const cats = await this.categoriesFor(locale, [post.ID]);
    const related = await this.loadPosts(locale, {
      page: 1,
      limit: 4,
      slugs: (cats.get(post.ID) || []).slice(0, 1).map((item) => item.slug),
      excludeId: post.ID,
      skipCount: true,
      light: true,
    });
    return serialize({
      ...toCard(post, cats.get(post.ID) || [], locale),
      content: sanitizeNewsHtml(post.post_content),
      related: related.items.filter((item) => item.slug !== post.post_name).slice(0, 4),
    });
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
        href: `/${locale}/categoria/${row.slug}`,
      })),
    );
  }

  async adminList(input: { page?: number; limit?: number; q?: string; status?: string; locale?: string }) {
    return this.listPublic(input);
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
    return serialize({
      ...toCard(post, cats.get(post.ID) || [], locale),
      content: post.post_content,
      categoryIds: (cats.get(post.ID) || []).map((item) => item.slug),
    });
  }

  async create(_body?: unknown, _userId?: bigint) {
    throw new BadRequestException('En local las noticias salen de musicmundial_es (dump WordPress).');
  }

  async update(_id?: string, _body?: unknown) {
    throw new BadRequestException('En local las noticias salen de musicmundial_es (dump WordPress).');
  }

  async remove(_id?: string) {
    throw new BadRequestException('En local las noticias salen de musicmundial_es (dump WordPress).');
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
    return `SELECT p.ID, p.post_title, p.post_name, p.post_excerpt, ${content}p.post_date,
      p.comment_count, COALESCE(NULLIF(u.display_name, ''), u.user_nicename, u.user_login) AS author_name, att.guid AS cover_url
      FROM wpgn_posts p
      LEFT JOIN wpgn_users u ON u.ID = p.post_author
      LEFT JOIN wpgn_postmeta th ON th.post_id = p.ID AND th.meta_key = '_thumbnail_id'
      LEFT JOIN wpgn_posts att ON att.ID = CAST(th.meta_value AS UNSIGNED)`;
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
    },
  ) {
    const slugs = (input.slugs?.length ? input.slugs : input.category ? [input.category] : []).filter(Boolean);
    const where = [`p.post_type = 'post'`, `p.post_status = 'publish'`];
    const params: unknown[] = [];
    if (input.excludeId) {
      where.push('p.ID <> ?');
      params.push(input.excludeId);
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
    if (input.q) {
      where.push('(p.post_title LIKE ? OR p.post_excerpt LIKE ?)');
      params.push(`%${input.q}%`, `%${input.q}%`);
    }
    const whereSql = where.join(' AND ');
    const offset = (input.page - 1) * input.limit;
    const rows = await this.mysql.query<PostRow>(
      locale,
      `${this.postSelect(input.light !== false)} WHERE ${whereSql} ORDER BY p.post_date DESC LIMIT ? OFFSET ?`,
      [...params, input.limit, offset],
    );
    const cats = await this.categoriesFor(locale, rows.map((row) => row.ID));
    const items = rows.map((row) => toCard(row, cats.get(row.ID) || [], locale));
    if (input.skipCount) return { total: items.length, items };
    const countRows = await this.mysql.query<{ total: number }>(
      locale,
      `SELECT COUNT(*) AS total FROM wpgn_posts p WHERE ${whereSql}`,
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
    const map = new Map<number, Array<{ slug: string; name: string }>>();
    if (!ids.length) return map;
    const rows = await this.mysql.query<TermRow>(
      locale,
      `SELECT tr.object_id, t.slug, t.name
       FROM wpgn_term_relationships tr
       JOIN wpgn_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = 'category'
       JOIN wpgn_terms t ON t.term_id = tt.term_id
       WHERE tr.object_id IN (${ids.map(() => '?').join(', ')})`,
      ids,
    );
    for (const row of rows) {
      const list = map.get(row.object_id) || [];
      list.push({ slug: row.slug, name: String(row.name || '').replace(/&amp;/g, '&') });
      map.set(row.object_id, list);
    }
    return map;
  }
}
