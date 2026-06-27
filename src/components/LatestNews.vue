<script setup>
import { computed, onMounted, ref } from 'vue'
import { translate } from '../i18n'

const feedUrl = 'https://www.musicmundial.com/en/feed/'
const feedProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`
const feedJsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`
const postsUrl = 'https://www.musicmundial.com/en/wp-json/wp/v2/posts?per_page=3&_embed=1'
const newsItems = ref([])
const isLoading = ref(true)
const errorMessage = ref('')

const fallbackNews = [
  {
    title: 'Music Mundial: últimas noticias de música y entretenimiento',
    tag: 'News',
    time: 'Actualizado',
    link: 'https://www.musicmundial.com/en/',
    image: '',
    visual: 'from-violet-950 via-fuchsia-700 to-indigo-950',
  },
  {
    title: 'KPOP, rankings, celebridades y novedades globales',
    tag: 'KPOP',
    time: 'En vivo',
    link: 'https://www.musicmundial.com/en/',
    image: '',
    visual: 'from-indigo-950 via-purple-700 to-fuchsia-900',
  },
  {
    title: 'Mantente al día con las historias más comentadas',
    tag: 'Entertainment',
    time: 'Ahora',
    link: 'https://www.musicmundial.com/en/',
    image: '',
    visual: 'from-amber-900 via-fuchsia-700 to-violet-950',
  },
]

const visibleNews = computed(() => newsItems.value.length ? newsItems.value : fallbackNews)

const textFromNode = (item, selector) =>
  item.querySelector(selector)?.textContent?.trim() || ''

const imageFromItem = (item) => {
  const mediaImage = item.querySelector('media\\:content, content')?.getAttribute('url')
    || item.querySelector('media\\:thumbnail, thumbnail')?.getAttribute('url')
    || item.querySelector('enclosure')?.getAttribute('url')

  if (mediaImage) {
    return mediaImage
  }

  const encodedContent = textFromNode(item, 'encoded')
    || item.getElementsByTagName('content:encoded')?.[0]?.textContent
    || ''
  const featuredImageMatch = encodedContent.match(/<img[^>]+class=["'][^"']*(?:wp-post-image|wp-image|size-full)[^"']*["'][^>]+src=["']([^"']+)["']/i)
    || encodedContent.match(/<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*(?:wp-post-image|wp-image|size-full)[^"']*["']/i)
  const imageMatch = featuredImageMatch || encodedContent.match(/<img[^>]+src=["']([^"']+)["']/i)

  return imageMatch?.[1] || ''
}

const formatFeedDate = (value) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Reciente'
  }

  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const newsFromItems = (items) =>
  items.slice(0, 3).map((item, index) => ({
    title: textFromNode(item, 'title'),
    tag: textFromNode(item, 'category') || 'News',
    rawDate: textFromNode(item, 'pubDate'),
    time: formatFeedDate(textFromNode(item, 'pubDate')),
    link: textFromNode(item, 'link'),
    description: textFromNode(item, 'description'),
    image: imageFromItem(item),
    visual: [
      'from-violet-950 via-fuchsia-700 to-indigo-950',
      'from-indigo-950 via-purple-700 to-fuchsia-900',
      'from-amber-900 via-fuchsia-700 to-violet-950',
      'from-cyan-950 via-violet-800 to-slate-950',
      'from-rose-950 via-fuchsia-800 to-slate-950',
      'from-slate-950 via-blue-900 to-violet-950',
    ][index % 6],
  }))

const sortByRecent = (items) =>
  items.slice().sort((current, next) => {
    const currentTime = new Date(current.rawDate || current.time).getTime() || 0
    const nextTime = new Date(next.rawDate || next.time).getTime() || 0

    return nextTime - currentTime
  })

const fetchFeedItems = async () => {
  const urls = [feedUrl, feedProxyUrl]

  for (const url of urls) {
    try {
      const response = await fetch(url)

      if (!response.ok) {
        continue
      }

      const xmlText = await response.text()
      const documentXml = new DOMParser().parseFromString(xmlText, 'text/xml')
      const items = [...documentXml.querySelectorAll('item')]

      if (items.length) {
        return items
      }
    } catch {
      // Try the next feed source.
    }
  }

  return []
}

const imageFromHtml = (html = '') => {
  const featuredImageMatch = html.match(/<img[^>]+class=["'][^"']*(?:wp-post-image|wp-image|size-full)[^"']*["'][^>]+src=["']([^"']+)["']/i)
    || html.match(/<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*(?:wp-post-image|wp-image|size-full)[^"']*["']/i)
  const imageMatch = featuredImageMatch || html.match(/<img[^>]+src=["']([^"']+)["']/i)

  return imageMatch?.[1] || ''
}

const stripHtml = (value = '') => value.replace(/<[^>]+>/g, '').trim()

const newsFromPosts = (posts) =>
  posts.slice(0, 3).map((post, index) => {
    const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0]
    const terms = post._embedded?.['wp:term']?.flat?.() || []
    const tag = terms.find((term) => term.taxonomy === 'category')?.name || 'News'

    return {
      title: stripHtml(post.title?.rendered || 'Noticia'),
      tag,
      rawDate: post.date_gmt || post.date,
      time: formatFeedDate(post.date_gmt || post.date),
      link: post.link,
      description: stripHtml(post.excerpt?.rendered || ''),
      image: featuredMedia?.source_url || imageFromHtml(post.content?.rendered || post.excerpt?.rendered),
      visual: [
        'from-violet-950 via-fuchsia-700 to-indigo-950',
        'from-indigo-950 via-purple-700 to-fuchsia-900',
        'from-amber-900 via-fuchsia-700 to-violet-950',
        'from-cyan-950 via-violet-800 to-slate-950',
        'from-rose-950 via-fuchsia-800 to-slate-950',
        'from-slate-950 via-blue-900 to-violet-950',
      ][index % 6],
    }
  })

const fetchWordPressNews = async () => {
  try {
    const response = await fetch(postsUrl)

    if (!response.ok) {
      return []
    }

    const posts = await response.json()

    if (!Array.isArray(posts) || !posts.length) {
      return []
    }

    return sortByRecent(newsFromPosts(posts))
  } catch {
    return []
  }
}

const newsFromJsonItems = (items) =>
  items.slice(0, 3).map((item, index) => ({
    title: item.title || 'Noticia',
    tag: item.categories?.[0] || 'News',
    rawDate: item.pubDate,
    time: formatFeedDate(item.pubDate),
    link: item.link,
    description: item.description?.replace(/<[^>]+>/g, '').trim() || '',
    image: item.thumbnail
      || item.enclosure?.link
      || imageFromHtml(item.content || item.description),
    visual: [
      'from-violet-950 via-fuchsia-700 to-indigo-950',
      'from-indigo-950 via-purple-700 to-fuchsia-900',
      'from-amber-900 via-fuchsia-700 to-violet-950',
      'from-cyan-950 via-violet-800 to-slate-950',
      'from-rose-950 via-fuchsia-800 to-slate-950',
      'from-slate-950 via-blue-900 to-violet-950',
    ][index % 6],
  }))

const fetchFeedJsonNews = async () => {
  try {
    const response = await fetch(feedJsonUrl)

    if (!response.ok) {
      return []
    }

    const data = await response.json()

    if (data.status !== 'ok' || !Array.isArray(data.items)) {
      return []
    }

    return sortByRecent(newsFromJsonItems(data.items))
  } catch {
    return []
  }
}

const loadNews = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const wordpressNews = await fetchWordPressNews()

    if (wordpressNews.length) {
      newsItems.value = wordpressNews
      return
    }

    const items = await fetchFeedItems()

    if (!items.length) {
      const jsonNews = await fetchFeedJsonNews()

      if (!jsonNews.length) {
        throw new Error('empty-feed')
      }

      newsItems.value = jsonNews
      return
    }

    newsItems.value = sortByRecent(newsFromItems(items))
  } catch {
    errorMessage.value = translate('news.errors.loadExternal')
    newsItems.value = []
  } finally {
    isLoading.value = false
  }
}

onMounted(loadNews)
</script>

<template>
  <section id="noticias" class="mx-auto max-w-352 scroll-mt-28 px-4 py-6 sm:px-6 lg:py-8">
    <div class="mb-5 flex items-end justify-between gap-4">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
          Noticias
        </p>
        <h2 class="mt-2 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
          Music Mundial
        </h2>
      </div>
      <a href="/noticias" class="text-xs font-black uppercase tracking-wide text-violet-300 hover:text-white">
        Ver todas
      </a>
    </div>

    <div
      v-if="isLoading"
      class="grid gap-4 md:grid-cols-3"
    >
      <article
        v-for="index in 3"
        :key="`news-skeleton-${index}`"
        class="overflow-hidden rounded-3xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25"
      >
        <div class="h-48 animate-pulse bg-white/10"></div>
        <div class="p-5">
          <div class="h-4 w-40 animate-pulse rounded-full bg-white/15"></div>
          <div class="mt-3 h-3 w-24 animate-pulse rounded-full bg-fuchsia-300/20"></div>
        </div>
      </article>
    </div>

    <p
      v-else-if="errorMessage && !newsItems.length"
      class="mb-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-100"
    >
      {{ errorMessage }} Mostrando enlaces destacados.
    </p>

    <div class="grid gap-4 md:grid-cols-3">
      <article
        v-for="item in visibleNews"
        :key="item.title"
        class="group overflow-hidden rounded-3xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25 transition hover:-translate-y-1 hover:border-fuchsia-300/30"
      >
        <a :href="item.link" target="_blank" rel="noreferrer" class="block">
          <div class="relative h-48 overflow-hidden bg-linear-to-br" :class="item.visual">
            <img
              v-if="item.image"
              :src="item.image"
              :alt="item.title"
              loading="lazy"
              decoding="async"
              class="absolute inset-0 size-full object-cover opacity-80 transition duration-500 group-hover:scale-105"
            />
            <div class="absolute inset-0 bg-linear-to-t from-[#080a17] via-black/10 to-transparent"></div>
            <span class="absolute left-4 top-4 rounded-full bg-black/35 px-3 py-1 text-xs font-black uppercase text-white backdrop-blur">
              {{ item.tag }}
            </span>
          </div>

          <div class="p-5">
            <h3 class="line-clamp-2 text-lg font-black text-white">{{ item.title }}</h3>
            <p class="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{{ item.description }}</p>
            <p class="mt-3 text-xs font-bold uppercase tracking-widest text-slate-500">{{ item.time }}</p>
            <span class="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition group-hover:scale-[1.01]">
              {{ $t('news.readArticle') }}
              <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
            </span>
          </div>
        </a>
      </article>
    </div>
  </section>
</template>
