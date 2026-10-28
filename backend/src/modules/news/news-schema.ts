export const SITE_NAME = 'Music Mundial';
export const ORG_ID = 'https://www.musicmundial.com/#organization';
export const LOGO_ID = 'https://www.musicmundial.com/#logo';
export const LOGO_SQUARE = 'https://www.musicmundial.com/logo-cuadrado.png';
export const LOGO_512 = LOGO_SQUARE;
export const LOGO_1000 = LOGO_SQUARE;
export const SAME_AS = [
  'https://www.facebook.com/MusicMundialEn/',
  'https://twitter.com/MusicMundial',
  'https://www.instagram.com/MusicMundial',
];
export const FACEBOOK_PAGE = 'https://www.facebook.com/MusicMundialEn/';
export const TWITTER_SITE = '@MusicMundial';

type NewsSchemaInput = {
  locale: 'es' | 'en';
  origin: string;
  url: string;
  title: string;
  description: string;
  image: string;
  published?: string;
  modified?: string;
  author?: string;
  authorUrl?: string;
  authorImage?: string;
  keywords?: string[];
  sections?: string[];
  categoryName?: string;
  categoryUrl?: string;
  imageCaption?: string;
  videos?: string[];
};

const compact = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '' && item !== null)) as T;

const languageOf = (locale: 'es' | 'en') => (locale === 'es' ? 'es-ES' : 'en-US');
const articleLanguage = (locale: 'es' | 'en') => (locale === 'es' ? 'es' : 'en-US');
const publisherLogo = () => ({
  '@type': 'ImageObject',
  url: LOGO_SQUARE,
  width: 1000,
  height: 1000,
});
const siteHome = (origin: string, locale: 'es' | 'en') =>
  `${origin.replace(/\/$/, '')}${locale === 'es' ? '/es' : '/'}`;
const websiteId = (locale: 'es' | 'en') =>
  locale === 'es' ? 'https://www.musicmundial.com/es/#website' : 'https://www.musicmundial.com/#website';

const organizationNode = (origin: string, locale: 'es' | 'en') => {
  const lang = languageOf(locale);
  return {
    '@type': ['Organization', 'NewsMediaOrganization'],
    '@id': ORG_ID,
    name: SITE_NAME,
    url: siteHome(origin, locale),
    sameAs: SAME_AS,
    logo: {
      '@type': 'ImageObject',
      '@id': LOGO_ID,
      url: LOGO_SQUARE,
      contentUrl: LOGO_SQUARE,
      caption: SITE_NAME,
      inLanguage: lang,
      width: 1000,
      height: 1000,
    },
    image: {
      '@type': 'ImageObject',
      url: LOGO_SQUARE,
      width: 1000,
      height: 1000,
    },
  };
};

export const buildNewsArticleGraph = (input: NewsSchemaInput) => {
  const origin = input.origin.replace(/\/$/, '');
  const url = input.url.replace(/\/$/, '') || origin;
  const lang = languageOf(input.locale);
  const articleLang = articleLanguage(input.locale);
  const year = Number(String(input.published || '').slice(0, 4)) || new Date().getFullYear();
  const pageId = `${url}/#webpage`;
  const snippetId = `${url}/#richSnippet`;
  const crumbId = `${url}/#breadcrumb`;
  const home = siteHome(origin, input.locale).replace(/\/$/, '') || origin;
  const authorUrl = input.authorUrl
    ? /^https?:\/\//i.test(input.authorUrl)
      ? input.authorUrl
      : `${origin}${input.authorUrl}`
    : '';
  const authorId = authorUrl || `${url}/#author`;
  const keywords = (input.keywords || []).map((item) => String(item || '').trim()).filter(Boolean);
  const sections = (input.sections || []).map((item) => String(item || '').trim()).filter(Boolean);
  const imageCaption = input.imageCaption || input.title;
  const videos = [...new Set((input.videos || []).map((id) => String(id || '').trim()).filter(Boolean))];

  const person = input.author
    ? compact({
        '@type': 'Person',
        '@id': authorId,
        name: input.author,
        url: authorUrl || undefined,
        image: input.authorImage
          ? {
              '@type': 'ImageObject',
              '@id': input.authorImage,
              url: input.authorImage,
              caption: input.author,
            }
          : undefined,
        inLanguage: lang,
        worksFor: { '@id': ORG_ID },
      })
    : null;

  const crumbs: Array<Record<string, unknown>> = [
    {
      '@type': 'ListItem',
      position: 1,
      name: input.locale === 'es' ? 'Inicio' : 'Home',
      item: home,
    },
  ];
  if (input.categoryName && input.categoryUrl) {
    crumbs.push({
      '@type': 'ListItem',
      position: 2,
      name: input.categoryName,
      item: input.categoryUrl,
    });
  }
  crumbs.push({
    '@type': 'ListItem',
    position: crumbs.length + 1,
    name: input.title,
    item: url,
  });

  const videoNodes = videos.map((id) =>
    compact({
      '@type': 'VideoObject',
      '@id': `${url}/#video-${id}`,
      name: input.title,
      description: input.description,
      thumbnailUrl: input.image,
      uploadDate: input.published || undefined,
      embedUrl: `https://www.youtube.com/embed/${id}`,
      contentUrl: `https://www.youtube.com/watch?v=${id}`,
      isFamilyFriendly: true,
      publisher: {
        '@type': 'NewsMediaOrganization',
        '@id': ORG_ID,
        name: SITE_NAME,
      },
      inLanguage: articleLang,
      isPartOf: { '@id': pageId },
      mainEntityOfPage: { '@id': url },
    }),
  );

  return {
    '@context': 'https://schema.org',
    '@graph': [
      compact({
        '@type': 'NewsArticle',
        '@id': snippetId,
        headline: input.title,
        name: input.title,
        description: input.description,
        image: input.image
          ? {
              '@type': 'ImageObject',
              url: input.image,
              width: 1600,
              height: 900,
              caption: imageCaption,
            }
          : undefined,
        datePublished: input.published || undefined,
        dateModified: input.modified || input.published || undefined,
        keywords: keywords.length ? keywords.join(', ') : undefined,
        articleSection: input.categoryName || (sections.length ? sections[0] : undefined),
        author: person
          ? compact({
              '@type': 'Person',
              '@id': authorId,
              name: input.author,
              url: authorUrl || undefined,
              image: input.authorImage || undefined,
            })
          : undefined,
        video: videoNodes.length ? videoNodes.map((item) => ({ '@id': item['@id'] })) : undefined,
        publisher: {
          '@type': 'NewsMediaOrganization',
          '@id': ORG_ID,
          name: SITE_NAME,
          logo: publisherLogo(),
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': url,
        },
        isAccessibleForFree: true,
        inLanguage: articleLang,
        copyrightYear: year,
        copyrightHolder: { '@id': ORG_ID },
        url,
        isPartOf: { '@id': pageId },
        thumbnailUrl: input.image,
      }),
      person,
      organizationNode(origin, input.locale),
      compact({
        '@type': 'WebPage',
        '@id': pageId,
        url,
        name: `${input.title} — ${SITE_NAME}`,
        datePublished: input.published || undefined,
        dateModified: input.modified || input.published || undefined,
        isPartOf: { '@id': websiteId(input.locale) },
        primaryImageOfPage: { '@id': input.image },
        inLanguage: lang,
        breadcrumb: { '@id': crumbId },
      }),
      {
        '@type': 'WebSite',
        '@id': websiteId(input.locale),
        url: input.locale === 'es' ? 'https://www.musicmundial.com/es/' : 'https://www.musicmundial.com/',
        name: SITE_NAME,
        publisher: { '@id': ORG_ID },
        inLanguage: lang,
        potentialAction: {
          '@type': 'SearchAction',
          target:
            input.locale === 'es'
              ? 'https://www.musicmundial.com/es/?s={search_term_string}'
              : 'https://www.musicmundial.com/?s={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'ImageObject',
        '@id': input.image,
        url: input.image,
        contentUrl: input.image,
        width: 1600,
        height: 900,
        caption: imageCaption,
        inLanguage: lang,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': crumbId,
        itemListElement: crumbs,
      },
      ...videoNodes,
    ].filter(Boolean),
  };
};
