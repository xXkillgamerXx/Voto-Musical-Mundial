import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { NewsService } from './news.service';

const SITE_NAME = 'Music Mundial';
const LOGO_EN = 'https://www.musicmundial.com/logo-cuadrado.png';
const LOGO_ES = 'https://www.musicmundial.com/logo-cuadrado.png';

const escapeXml = (value: unknown) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const cdata = (value: unknown) =>
  `<![CDATA[${String(value || '').replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

const pad = (value: number) => String(value).padStart(2, '0');

const rfc822FromUtcStamp = (value?: string | Date | null) => {
  if (!value) return '';
  const raw = typeof value === 'string' ? value.trim() : '';
  const stamp = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  const date = stamp
    ? new Date(
        Date.UTC(
          Number(stamp[1]),
          Number(stamp[2]) - 1,
          Number(stamp[3]),
          Number(stamp[4]),
          Number(stamp[5]),
          Number(stamp[6]),
        ),
      )
    : value instanceof Date
      ? value
      : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getUTCDay()]}, ${pad(date.getUTCDate())} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} +0000`;
};

@Controller('news/feed')
export class NewsFeedController {
  constructor(
    private readonly news: NewsService,
    private readonly config: ConfigService,
  ) {}

  private origin(req: Request) {
    const configured = (
      this.config.get<string>('PUBLIC_NEWS_ORIGIN') ||
      this.config.get<string>('APP_PUBLIC_ORIGIN') ||
      this.config.get<string>('APP_ORIGIN') ||
      ''
    )
      .split(',')[0]
      .trim()
      .replace(/\/$/, '');
    if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) return configured;
    const host = String(req.headers.host || '').trim();
    if (host && !/localhost|127\.0\.0\.1/i.test(host)) {
      const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
      return `${proto}://${host}`.replace(/\/$/, '');
    }
    return 'https://www.musicmundial.com';
  }

  private abs(origin: string, path: string) {
    if (/^https?:\/\//i.test(path)) return path.replace(/\/?$/, '/');
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${origin}${clean}`.replace(/\/?$/, '/');
  }

  @Get()
  async en(@Req() req: Request, @Res() res: Response) {
    return this.send(req, res, 'en', 'feed');
  }

  @Get(':locale')
  async localeFeed(@Param('locale') locale: string, @Req() req: Request, @Res() res: Response) {
    const lang = locale === 'es' ? 'es' : 'en';
    return this.send(req, res, lang, locale === 'en' ? 'en-feed' : lang);
  }

  private async send(req: Request, res: Response, locale: 'es' | 'en', flavor: string) {
    const origin = this.origin(req);
    const home = locale === 'es' ? `${origin}/es` : origin;
    const self = flavor === 'en-feed' ? `${origin}/en/feed/` : locale === 'es' ? `${origin}/es/feed/` : `${origin}/feed/`;
    const language = locale === 'es' ? 'es' : 'en-US';
    const description =
      locale === 'es' ? 'Más recientes noticias de música y entretenimiento' : 'Updated music and entertainment news';
    const logo = locale === 'es' ? LOGO_ES : LOGO_EN;
    const { items } = await this.news.listRssFeed(locale, 15);
    const lastBuild = rfc822FromUtcStamp(items[0]?.publishedAt) || rfc822FromUtcStamp(new Date());
    const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"
	xmlns:content="http://purl.org/rss/1.0/modules/content/"
	xmlns:wfw="http://wellformedweb.org/CommentAPI/"
	xmlns:dc="http://purl.org/dc/elements/1.1/"
	xmlns:atom="http://www.w3.org/2005/Atom"
	xmlns:sy="http://purl.org/rss/1.0/modules/syndication/"
	xmlns:slash="http://purl.org/rss/1.0/modules/slash/"
	xmlns:media="http://search.yahoo.com/mrss/" >

<channel>
	<title>${escapeXml(SITE_NAME)}</title>
	<atom:link href="${escapeXml(self)}" rel="self" type="application/rss+xml" />
	<link>${escapeXml(home)}</link>
	<description>${escapeXml(description)}</description>
	<lastBuildDate>${escapeXml(lastBuild)}</lastBuildDate>
	<language>${language}</language>
	<sy:updatePeriod>
	hourly	</sy:updatePeriod>
	<sy:updateFrequency>
	1	</sy:updateFrequency>
	<generator>https://wordpress.org/?v=7.1.3</generator>

<image>
	<url>${escapeXml(logo)}</url>
	<title>${escapeXml(SITE_NAME)}</title>
	<link>${escapeXml(home)}</link>
	<width>32</width>
	<height>32</height>
</image>
	${items
    .map((item) => {
      const loc = this.abs(origin, item.href);
      const image = item.coverUrl ? this.abs(origin, item.coverUrl).replace(/\/$/, '') : '';
      const guidHome = locale === 'es' ? `${origin}/es` : origin;
      const seen = new Set<string>();
      const cats = (item.categories || [])
        .filter((cat) => {
          const key = String(cat.name || '').toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((cat) => `<category>${cdata(cat.name)}</category>`)
        .join('\n		');
      const youtube = String(item.youtubeUrl || '').trim();
      const media = youtube
        ? `<media:content url="${escapeXml(youtube)}" medium="video">
			<media:player url="${escapeXml(youtube)}" />
			<media:title type="plain">${escapeXml(`${item.title} — ${SITE_NAME}`)}</media:title>
			<media:thumbnail url="${escapeXml(image)}" />
			<media:rating scheme="urn:simple">nonadult</media:rating>
		</media:content>`
        : '';
      return `<item>
		<title>${escapeXml(item.title)}</title>
		<link>${escapeXml(loc)}</link>
		
		<dc:creator>${cdata(item.authorName)}</dc:creator>
		<pubDate>${escapeXml(rfc822FromUtcStamp(item.publishedAt))}</pubDate>
				${cats}
		<guid isPermaLink="false">${escapeXml(`${guidHome}/?p=${item.id}`)}</guid>

					<description>${cdata(item.excerpt)}</description>
										<content:encoded>${cdata(item.content)}</content:encoded>
					
		
		${media}
	</item>`;
    })
    .join('\n		')}
	</channel>
</rss>`;
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Content-Type', 'application/rss+xml; charset=UTF-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(body);
  }
}
