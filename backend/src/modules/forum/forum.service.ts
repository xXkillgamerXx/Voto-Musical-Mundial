import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FanItemType, FanPurchaseStatus, Prisma, UserRole } from '@prisma/client';
import { BLOCKED_PROMO_MESSAGE, isCommentHardBlocked } from '../../common/comment-promo';
import { BLOCKED_LANGUAGE_MESSAGE, isCommentLanguageBlocked } from '../../common/comment-profanity';
import { serialize } from '../../common/serialize';
import { FanService } from '../fan/fan.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AdminListForumTopicsDto, AdminUpdateForumTopicDto } from './dto/admin-topic.dto';
import { CreateForumPostDto } from './dto/create-post.dto';
import { CreateForumTopicDto } from './dto/create-topic.dto';
import { CreateForumCategoryDto, UpdateForumCategoryDto } from './dto/upsert-category.dto';
import { FORUM_CATEGORY_SEED, FORUM_RESERVED_SLUGS } from './forum.constants';

const PAGE_SIZE = 20;
const TITLE_MAX = 140;
const BODY_MAX = 8000;
const ADMIN_ROLES = new Set<UserRole>([UserRole.admin, UserRole.superadmin, UserRole.owner]);
const AUTHOR_SELECT = { id: true, username: true, displayName: true, photoUrl: true } as const;

type TopicSort = 'latest' | 'activity' | 'replies' | 'popular';

@Injectable()
export class ForumService {
  private seeded = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fan: FanService,
    private readonly redis: RedisService,
  ) {}

  async ensureCategories() {
    if (this.seeded) return;
    for (const row of FORUM_CATEGORY_SEED) {
      await this.prisma.forumCategory.upsert({
        where: { slug: row.slug },
        update: {},
        create: { ...row },
      });
    }
    this.seeded = true;
  }

  async home(locale: 'es' | 'en') {
    await this.ensureCategories();
    const sinceOnline = new Date(Date.now() - 30 * 60 * 1000);
    const [categories, topics, premium, topicTotal, postTotal, authorRows, onlineRows] = await Promise.all([
      this.prisma.forumCategory.findMany({
        where: { isActive: true, parentId: null },
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: { select: { topics: { where: { deletedAt: null } } } },
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: { _count: { select: { topics: { where: { deletedAt: null } } } } },
          },
        },
      }),
      this.listTopicRows({ page: 1, limit: 12, sort: 'activity', locale }),
      this.premiumMembers(),
      this.prisma.forumTopic.count({ where: { deletedAt: null, category: { isActive: true } } }),
      this.prisma.forumPost.count({ where: { deletedAt: null } }),
      this.prisma.forumPost.groupBy({
        by: ['authorId'],
        where: { deletedAt: null },
      }),
      this.prisma.forumPost.groupBy({
        by: ['authorId'],
        where: { deletedAt: null, createdAt: { gte: sinceOnline } },
      }),
    ]);
    const popular = await this.listTopicRows({ page: 1, limit: 5, sort: 'popular', locale });
    return serialize({
      locale,
      categories: categories.map((item) => this.mapCategory(item, locale, this.topicCountOf(item))),
      topics: topics.items,
      popular: popular.items,
      premium,
      stats: {
        topics: topicTotal,
        posts: postTotal,
        members: authorRows.length,
        online: onlineRows.length,
      },
    });
  }

  async category(slug: string, locale: 'es' | 'en', query: { page?: string; limit?: string; sort?: TopicSort; q?: string }) {
    await this.ensureCategories();
    const all = slug === 'all';
    const category = all
      ? null
      : await this.prisma.forumCategory.findFirst({
          where: { slug, isActive: true },
          include: {
            parent: true,
            children: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              include: { _count: { select: { topics: { where: { deletedAt: null } } } } },
            },
          },
        });
    if (!all && !category) throw new NotFoundException('Esa sala no existe.');
    const page = this.pageOf(query.page);
    const limit = this.limitOf(query.limit);
    const categoryIds = category
      ? [category.id, ...(category.children || []).map((child) => child.id)]
      : undefined;
    const rows = await this.listTopicRows({
      categoryIds,
      page,
      limit,
      sort: query.sort || 'activity',
      q: query.q,
      locale,
    });
    const replies = category
      ? await this.prisma.forumTopic.aggregate({
          where: { categoryId: { in: categoryIds }, deletedAt: null },
          _sum: { replyCount: true },
        })
      : { _sum: { replyCount: 0 } };
    return serialize({
      category: category ? this.mapCategory(category, locale, rows.total) : this.allCategory(locale, rows.total),
      replies: Number(replies._sum.replyCount || 0),
      ...rows,
    });
  }

  async search(locale: 'es' | 'en', q: string, page?: string, limit?: string) {
    const query = String(q || '').trim();
    if (query.length < 2) return serialize({ items: [], total: 0, page: 1, limit: PAGE_SIZE });
    return serialize(
      await this.listTopicRows({
        page: this.pageOf(page),
        limit: this.limitOf(limit),
        sort: 'activity',
        q: query,
        locale,
      }),
    );
  }

  async topic(id: string, locale: 'es' | 'en', query: { page?: string }, viewer?: { id?: bigint }, ip?: string) {
    const topicId = this.idOf(id);
    const topic = await this.prisma.forumTopic.findFirst({
      where: { id: topicId, deletedAt: null },
      include: {
        category: true,
        author: { select: AUTHOR_SELECT },
        lastPoster: { select: AUTHOR_SELECT },
      },
    });
    if (!topic || !topic.category.isActive) throw new NotFoundException('Ese tema no existe.');
    await this.bumpViews(topic.id, viewer?.id, ip);
    const page = this.pageOf(query.page);
    const [posts, skuMap] = await Promise.all([
      this.prisma.forumPost.findMany({
        where: { topicId: topic.id, deletedAt: null },
        orderBy: { position: 'asc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { author: { select: AUTHOR_SELECT } },
      }),
      this.fan.fanSkuByUserIds([topic.authorId]),
    ]);
    const postSkus = await this.fan.fanSkuByUserIds(posts.map((item) => item.authorId));
    const totalPosts = await this.prisma.forumPost.count({ where: { topicId: topic.id, deletedAt: null } });
    return serialize({
      topic: this.mapTopic(topic, locale, skuMap.get(topic.authorId.toString()) || null),
      items: posts.map((item) => this.mapPost(item, postSkus.get(item.authorId.toString()) || null)),
      page,
      limit: PAGE_SIZE,
      total: totalPosts,
    });
  }

  async createTopic(userId: bigint, dto: CreateForumTopicDto, locale: 'es' | 'en') {
    await this.ensureCategories();
    const category = await this.prisma.forumCategory.findFirst({
      where: { slug: dto.category.trim().toLowerCase(), isActive: true },
      include: { parent: true },
    });
    if (!category) throw new NotFoundException('Esa sala no existe.');
    await this.assertCanPost(userId, category.isVip || Boolean(category.parent?.isVip));
    const title = this.cleanTitle(dto.title);
    const body = await this.cleanBody(dto.body);
    const images = this.cleanImages(dto.images);
    const slug = await this.uniqueSlug(category.id, title);
    const topic = await this.prisma.$transaction(async (tx) => {
      const created = await tx.forumTopic.create({
        data: {
          categoryId: category.id,
          authorId: userId,
          title,
          slug,
          lastPosterId: userId,
        },
      });
      await tx.forumPost.create({
        data: {
          topicId: created.id,
          authorId: userId,
          body,
          images,
          position: 1,
        },
      });
      return tx.forumTopic.findUniqueOrThrow({
        where: { id: created.id },
        include: { category: true, author: { select: AUTHOR_SELECT }, lastPoster: { select: AUTHOR_SELECT } },
      });
    });
    const sku = (await this.fan.getVoteBoost(userId)).sku;
    return serialize({ topic: this.mapTopic(topic, locale, sku) });
  }

  async createPost(userId: bigint, topicIdRaw: string, dto: CreateForumPostDto) {
    const topic = await this.prisma.forumTopic.findFirst({
      where: { id: this.idOf(topicIdRaw), deletedAt: null },
      include: { category: { include: { parent: true } } },
    });
    if (!topic) throw new NotFoundException('Ese tema no existe.');
    if (topic.closedAt) throw new ForbiddenException('Este tema está cerrado.');
    await this.assertCanPost(userId, topic.category.isVip || Boolean(topic.category.parent?.isVip));
    const body = await this.cleanBody(dto.body);
    const images = this.cleanImages(dto.images);
    let replyToPostId: bigint | null = null;
    if (dto.replyToPostId) {
      const parent = await this.prisma.forumPost.findFirst({
        where: { id: this.idOf(dto.replyToPostId), topicId: topic.id, deletedAt: null },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('La publicación citada no está en este tema.');
      replyToPostId = parent.id;
    }
    const post = await this.prisma.$transaction(async (tx) => {
      const last = await tx.forumPost.findFirst({
        where: { topicId: topic.id },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      const created = await tx.forumPost.create({
        data: {
          topicId: topic.id,
          authorId: userId,
          body,
          images,
          position: (last?.position || 1) + 1,
          replyToPostId,
        },
        include: { author: { select: AUTHOR_SELECT } },
      });
      await tx.forumTopic.update({
        where: { id: topic.id },
        data: {
          replyCount: { increment: 1 },
          lastPostAt: created.createdAt,
          lastPosterId: userId,
        },
      });
      return created;
    });
    const sku = (await this.fan.getVoteBoost(userId)).sku;
    return serialize({ post: this.mapPost(post, sku) });
  }

  async setCategoryActive(slug: string, isActive: boolean, role: UserRole) {
    if (!ADMIN_ROLES.has(role)) throw new ForbiddenException('No autorizado.');
    await this.ensureCategories();
    const category = await this.prisma.forumCategory.findUnique({ where: { slug } });
    if (!category) throw new NotFoundException('Esa sala no existe.');
    const next = await this.prisma.forumCategory.update({
      where: { id: category.id },
      data: { isActive },
    });
    return serialize({ category: this.mapCategory(next, 'es') });
  }

  async adminCategories() {
    await this.ensureCategories();
    const rows = await this.prisma.forumCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { nameEs: 'asc' }],
      include: {
        parent: true,
        _count: { select: { topics: { where: { deletedAt: null } } } },
      },
    });
    return serialize({
      items: rows.map((item) => this.mapCategoryAdmin(item, item._count.topics, item.parent?.slug || null)),
    });
  }

  async adminCreateCategory(dto: CreateForumCategoryDto) {
    await this.ensureCategories();
    const slug = this.categorySlug(dto.slug || dto.nameEs);
    const exists = await this.prisma.forumCategory.findUnique({ where: { slug } });
    if (exists) throw new BadRequestException('Ya existe una sala con ese slug.');
    const last = await this.prisma.forumCategory.aggregate({ _max: { sortOrder: true } });
    const parent = await this.parentOf(dto.parentSlug);
    const created = await this.prisma.forumCategory.create({
      data: {
        slug,
        nameEs: dto.nameEs.trim(),
        nameEn: dto.nameEn.trim(),
        blurbEs: (dto.blurbEs || '').trim(),
        blurbEn: (dto.blurbEn || '').trim(),
        icon: dto.icon || 'note',
        sortOrder: dto.sortOrder ?? (last._max.sortOrder || 0) + 1,
        isVip: Boolean(dto.isVip),
        isActive: dto.isActive !== false,
        parentId: parent?.id || null,
      },
    });
    return serialize({ category: this.mapCategoryAdmin(created, 0, parent?.slug || null) });
  }

  async adminUpdateCategory(slug: string, dto: UpdateForumCategoryDto) {
    await this.ensureCategories();
    const category = await this.prisma.forumCategory.findUnique({ where: { slug } });
    if (!category) throw new NotFoundException('Esa sala no existe.');
    const parent =
      dto.parentSlug === undefined ? undefined : await this.parentOf(dto.parentSlug, category.slug);
    if (parent && parent.id === category.id) {
      throw new BadRequestException('Una sala no puede estar dentro de sí misma.');
    }
    const childCount = await this.prisma.forumCategory.count({ where: { parentId: category.id } });
    if (parent && childCount) {
      throw new BadRequestException('Mueve las subcategorías antes de anidar esta sala.');
    }
    const next = await this.prisma.forumCategory.update({
      where: { id: category.id },
      data: {
        ...(dto.nameEs != null ? { nameEs: dto.nameEs.trim() } : {}),
        ...(dto.nameEn != null ? { nameEn: dto.nameEn.trim() } : {}),
        ...(dto.blurbEs != null ? { blurbEs: dto.blurbEs.trim() } : {}),
        ...(dto.blurbEn != null ? { blurbEn: dto.blurbEn.trim() } : {}),
        ...(dto.icon != null ? { icon: dto.icon } : {}),
        ...(dto.sortOrder != null ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isVip != null ? { isVip: dto.isVip } : {}),
        ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
        ...(parent !== undefined ? { parentId: parent?.id || null } : {}),
      },
      include: {
        parent: true,
        _count: { select: { topics: { where: { deletedAt: null } } } },
      },
    });
    return serialize({ category: this.mapCategoryAdmin(next, next._count.topics, next.parent?.slug || null) });
  }

  async adminTopics(query: AdminListForumTopicsDto) {
    await this.ensureCategories();
    const page = this.pageOf(query.page);
    const limit = this.limitOf(query.limit);
    const status = query.status || 'all';
    const q = String(query.q || '').trim();
    const categorySlug = String(query.category || '').trim().toLowerCase();
    const locale = query.locale === 'en' ? 'en' : 'es';
    const where: Prisma.ForumTopicWhereInput = {
      ...(status === 'hidden'
        ? { deletedAt: { not: null } }
        : status === 'active'
          ? { deletedAt: null }
          : status === 'closed'
            ? { deletedAt: null, closedAt: { not: null } }
            : status === 'pinned'
              ? { deletedAt: null, pinnedAt: { not: null } }
              : {}),
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { author: { username: { contains: q, mode: 'insensitive' } } },
              { author: { displayName: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.forumTopic.findMany({
        where,
        orderBy: [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, { lastPostAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: true,
          author: { select: AUTHOR_SELECT },
          lastPoster: { select: AUTHOR_SELECT },
        },
      }),
      this.prisma.forumTopic.count({ where }),
    ]);
    return serialize({
      items: rows.map((item) => ({
        ...this.mapTopic(item, locale, null),
        hidden: Boolean(item.deletedAt),
      })),
      total,
      page,
      limit,
    });
  }

  async adminUpdateTopic(id: string, dto: AdminUpdateForumTopicDto) {
    const topic = await this.prisma.forumTopic.findUnique({
      where: { id: this.idOf(id) },
      include: {
        category: true,
        author: { select: AUTHOR_SELECT },
        lastPoster: { select: AUTHOR_SELECT },
      },
    });
    if (!topic) throw new NotFoundException('Ese tema no existe.');
    let categoryId = topic.categoryId;
    let slug = topic.slug;
    if (dto.category && dto.category !== topic.category.slug) {
      const category = await this.prisma.forumCategory.findFirst({ where: { slug: dto.category.trim().toLowerCase() } });
      if (!category) throw new NotFoundException('Esa sala no existe.');
      categoryId = category.id;
      slug = await this.uniqueSlug(category.id, dto.title || topic.title);
    }
    const next = await this.prisma.forumTopic.update({
      where: { id: topic.id },
      data: {
        ...(dto.title != null ? { title: this.cleanTitle(dto.title) } : {}),
        ...(dto.category && dto.category !== topic.category.slug ? { categoryId, slug } : {}),
        ...(dto.pinned != null ? { pinnedAt: dto.pinned ? new Date() : null } : {}),
        ...(dto.closed != null ? { closedAt: dto.closed ? new Date() : null } : {}),
        ...(dto.hidden != null ? { deletedAt: dto.hidden ? new Date() : null } : {}),
      },
      include: {
        category: true,
        author: { select: AUTHOR_SELECT },
        lastPoster: { select: AUTHOR_SELECT },
      },
    });
    return serialize({
      topic: { ...this.mapTopic(next, 'es', null), hidden: Boolean(next.deletedAt) },
    });
  }

  private async listTopicRows(input: {
    categoryId?: bigint;
    categoryIds?: bigint[];
    page: number;
    limit: number;
    sort: TopicSort;
    q?: string;
    locale: 'es' | 'en';
  }) {
    const where: Prisma.ForumTopicWhereInput = {
      deletedAt: null,
      category: { isActive: true },
      ...(input.categoryIds?.length
        ? { categoryId: { in: input.categoryIds } }
        : input.categoryId
          ? { categoryId: input.categoryId }
          : {}),
      ...(input.q
        ? {
            OR: [
              { title: { contains: input.q, mode: 'insensitive' } },
              { author: { username: { contains: input.q, mode: 'insensitive' } } },
              { author: { displayName: { contains: input.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const pinnedFirst: Prisma.ForumTopicOrderByWithRelationInput = { pinnedAt: { sort: 'desc', nulls: 'last' } };
    const orderBy: Prisma.ForumTopicOrderByWithRelationInput[] =
      input.sort === 'latest'
        ? [pinnedFirst, { createdAt: 'desc' }]
        : input.sort === 'replies'
          ? [pinnedFirst, { replyCount: 'desc' }, { lastPostAt: 'desc' }]
          : input.sort === 'popular'
            ? [pinnedFirst, { replyCount: 'desc' }, { viewCount: 'desc' }]
            : [pinnedFirst, { lastPostAt: 'desc' }];
    const [rows, total] = await Promise.all([
      this.prisma.forumTopic.findMany({
        where,
        orderBy,
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: {
          category: true,
          author: { select: AUTHOR_SELECT },
          lastPoster: { select: AUTHOR_SELECT },
        },
      }),
      this.prisma.forumTopic.count({ where }),
    ]);
    const skuMap = await this.fan.fanSkuByUserIds([
      ...rows.map((item) => item.authorId),
      ...rows.map((item) => item.lastPosterId).filter((id): id is bigint => Boolean(id)),
    ]);
    return {
      items: rows.map((item) =>
        this.mapTopic(item, input.locale, skuMap.get(item.authorId.toString()) || null, item.lastPosterId ? skuMap.get(item.lastPosterId.toString()) || null : null),
      ),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  private async premiumMembers() {
    const rows = await this.prisma.fanPurchase.findMany({
      where: {
        type: FanItemType.plan,
        status: FanPurchaseStatus.paid,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { startedAt: 'desc' },
      take: 24,
      select: {
        sku: true,
        user: { select: AUTHOR_SELECT },
      },
    });
    const seen = new Set<string>();
    const people: Array<{
      id: string
      username: string | null
      displayName: string
      photoUrl: string | null
      fanSku: string
    }> = [];
    for (const row of rows) {
      const key = row.user.id.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      people.push({
        id: row.user.id.toString(),
        username: row.user.username,
        displayName: row.user.displayName || row.user.username || 'Fan',
        photoUrl: row.user.photoUrl,
        fanSku: row.sku,
      });
      if (people.length >= 8) break;
    }
    return people;
  }

  private async assertCanPost(userId: bigint, vip: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new ForbiddenException('Inicia sesión para participar.');
    if (!vip || ADMIN_ROLES.has(user.role)) return;
    const sku = (await this.fan.getVoteBoost(userId)).sku;
    if (!sku) throw new ForbiddenException('Esta sala es solo para miembros FAN.');
  }

  private async bumpViews(topicId: bigint, userId?: bigint, ip?: string) {
    const stamp = userId?.toString() || ip || 'anon';
    const key = `forum:view:${topicId.toString()}:${stamp}`;
    try {
      const fresh = await this.redis.client.set(key, '1', 'EX', 1800, 'NX');
      if (!fresh) return;
    } catch {
      return;
    }
    await this.prisma.forumTopic.update({
      where: { id: topicId },
      data: { viewCount: { increment: 1 } },
    });
  }

  private async uniqueSlug(categoryId: bigint, title: string) {
    const base =
      title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'tema';
    let slug = base;
    let n = 2;
    while (await this.prisma.forumTopic.findFirst({ where: { categoryId, slug } })) {
      slug = `${base}-${n}`.slice(0, 72);
      n += 1;
    }
    return slug;
  }

  private async parentOf(parentSlug?: string, currentSlug?: string) {
    const slug = String(parentSlug || '').trim().toLowerCase();
    if (!slug) return null;
    if (currentSlug && slug === currentSlug) {
      throw new BadRequestException('Una sala no puede estar dentro de sí misma.');
    }
    const parent = await this.prisma.forumCategory.findUnique({ where: { slug } });
    if (!parent) throw new NotFoundException('La sala padre no existe.');
    if (parent.parentId) throw new BadRequestException('Solo se puede anidar un nivel.');
    return parent;
  }

  private topicCountOf(item: { _count: { topics: number }; children?: Array<{ _count: { topics: number } }> }) {
    return item._count.topics + (item.children || []).reduce((sum, child) => sum + child._count.topics, 0);
  }

  private mapCategoryAdmin(
    item: {
      slug: string;
      nameEs: string;
      nameEn: string;
      blurbEs: string;
      blurbEn: string;
      icon: string;
      sortOrder: number;
      isVip: boolean;
      isActive: boolean;
    },
    topicCount = 0,
    parentSlug: string | null = null,
  ) {
    return {
      slug: item.slug,
      nameEs: item.nameEs,
      nameEn: item.nameEn,
      blurbEs: item.blurbEs,
      blurbEn: item.blurbEn,
      icon: item.icon,
      sortOrder: item.sortOrder,
      isVip: item.isVip,
      isActive: item.isActive,
      parentSlug,
      topicCount,
    };
  }

  private categorySlug(value: string) {
    const slug =
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || '';
    if (slug.length < 2) throw new BadRequestException('El slug no es válido.');
    if (FORUM_RESERVED_SLUGS.has(slug)) throw new BadRequestException('Ese slug está reservado.');
    return slug;
  }

  private mapCategory(
    item: {
      slug: string;
      nameEs: string;
      nameEn: string;
      blurbEs: string;
      blurbEn: string;
      icon: string;
      isVip: boolean;
      parent?: { slug: string; nameEs: string; nameEn: string } | null;
      children?: Array<{
        slug: string;
        nameEs: string;
        nameEn: string;
        blurbEs: string;
        blurbEn: string;
        icon: string;
        isVip: boolean;
        _count?: { topics: number };
      }>;
    },
    locale: 'es' | 'en',
    topicCount = 0,
  ) {
    const parent = item.parent
      ? {
          slug: item.parent.slug,
          name: locale === 'es' ? item.parent.nameEs : item.parent.nameEn,
        }
      : null;
    return {
      slug: item.slug,
      name: locale === 'es' ? item.nameEs : item.nameEn,
      blurb: locale === 'es' ? item.blurbEs : item.blurbEn,
      icon: item.icon,
      isVip: item.isVip,
      topicCount,
      parentSlug: parent?.slug || null,
      parent,
      children: (item.children || []).map((child) =>
        this.mapCategory(
          {
            ...child,
            parent: item.parent || { slug: item.slug, nameEs: item.nameEs, nameEn: item.nameEn },
          },
          locale,
          child._count?.topics || 0,
        ),
      ),
    };
  }

  private allCategory(locale: 'es' | 'en', topicCount: number) {
    return {
      slug: 'all',
      name: locale === 'es' ? 'Todos los temas' : 'All Topics',
      blurb: locale === 'es' ? 'Toda la comunidad en un solo listado.' : 'The whole community in one list.',
      icon: 'news',
      isVip: false,
      topicCount,
      parentSlug: null,
      parent: null,
      children: [],
    };
  }

  private mapTopic(
    item: {
      id: bigint;
      title: string;
      slug: string;
      replyCount: number;
      viewCount: number;
      lastPostAt: Date;
      createdAt: Date;
      pinnedAt: Date | null;
      closedAt: Date | null;
      category: { slug: string; nameEs: string; nameEn: string; isVip: boolean };
      author: { id: bigint; username: string | null; displayName: string | null; photoUrl: string | null };
      lastPoster: { id: bigint; username: string | null; displayName: string | null; photoUrl: string | null } | null;
    },
    locale: 'es' | 'en',
    fanSku: string | null,
    lastPosterSku: string | null = null,
  ) {
    return {
      id: item.id.toString(),
      title: item.title,
      slug: item.slug,
      href: `/forum/${item.category.slug}/${item.id.toString()}`,
      replyCount: item.replyCount,
      viewCount: item.viewCount,
      lastPostAt: item.lastPostAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
      pinned: Boolean(item.pinnedAt),
      closed: Boolean(item.closedAt),
      category: {
        slug: item.category.slug,
        name: locale === 'es' ? item.category.nameEs : item.category.nameEn,
        isVip: item.category.isVip,
      },
      author: this.mapPerson(item.author, fanSku),
      lastPoster: item.lastPoster ? this.mapPerson(item.lastPoster, lastPosterSku) : null,
    };
  }

  private mapPost(
    item: {
      id: bigint;
      body: string;
      images: Prisma.JsonValue;
      position: number;
      replyToPostId: bigint | null;
      createdAt: Date;
      author: { id: bigint; username: string | null; displayName: string | null; photoUrl: string | null };
    },
    fanSku: string | null,
  ) {
    return {
      id: item.id.toString(),
      body: item.body,
      images: Array.isArray(item.images) ? item.images.filter((row) => typeof row === 'string') : [],
      position: item.position,
      replyToPostId: item.replyToPostId ? item.replyToPostId.toString() : null,
      createdAt: item.createdAt.toISOString(),
      author: this.mapPerson(item.author, fanSku),
    };
  }

  private mapPerson(
    person: { id: bigint; username: string | null; displayName: string | null; photoUrl: string | null },
    fanSku: string | null,
  ) {
    return {
      id: person.id.toString(),
      username: person.username,
      displayName: person.displayName || person.username || 'Fan',
      photoUrl: person.photoUrl,
      fanSku,
    };
  }

  private cleanTitle(value: string) {
    const title = value.replace(/\s+/g, ' ').trim();
    if (title.length < 8) throw new BadRequestException('El título es demasiado corto.');
    if (title.length > TITLE_MAX) throw new BadRequestException('El título es demasiado largo.');
    return title;
  }

  private async cleanBody(value: string) {
    const body = value.trim();
    if (body.length < 2) throw new BadRequestException('Escribe el mensaje.');
    if (body.length > BODY_MAX) throw new BadRequestException('El mensaje es demasiado largo.');
    if (isCommentHardBlocked(body)) throw new BadRequestException(BLOCKED_PROMO_MESSAGE);
    if (await isCommentLanguageBlocked(body)) throw new BadRequestException(BLOCKED_LANGUAGE_MESSAGE);
    return body;
  }

  private cleanImages(value?: string[]) {
    if (!value?.length) return [];
    const images = value
      .map((item) => String(item || '').trim())
      .filter((item) => item.startsWith('https://') || item.startsWith('http://') || item.startsWith('data:image/'))
      .slice(0, 4);
    const bytes = images.join('').length;
    if (bytes > 1_200_000) throw new BadRequestException('Las imágenes son demasiado pesadas.');
    return images;
  }

  private pageOf(value?: string) {
    return Math.max(1, Number(value || 1) || 1);
  }

  private limitOf(value?: string) {
    return Math.min(50, Math.max(1, Number(value || PAGE_SIZE) || PAGE_SIZE));
  }

  private idOf(value: string) {
    if (!/^\d+$/.test(String(value || ''))) throw new NotFoundException('Ese tema no existe.');
    return BigInt(value);
  }
}
