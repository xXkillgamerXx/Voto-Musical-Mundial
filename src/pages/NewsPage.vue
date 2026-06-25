<script setup>
import { computed, onMounted, ref, watch } from 'vue'

const feedUrl = 'https://www.musicmundial.com/en/feed/'
const feedProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`
const feedJsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`
const postsUrl = 'https://www.musicmundial.com/en/wp-json/wp/v2/posts?per_page=24&_embed=1'
const newsItems = ref([])
const isLoading = ref(true)
const errorMessage = ref('')
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 9

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
  const imageMatch = encodedContent.match(/<img[^>]+src=["']([^"']+)["']/i)

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
  posts.map((post, index) => {
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
  items.map((item, index) => ({
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

const sortByRecent = (items) =>
  items.slice().sort((current, next) => {
    const currentTime = new Date(current.rawDate || current.time).getTime() || 0
    const nextTime = new Date(next.rawDate || next.time).getTime() || 0

    return nextTime - currentTime
  })

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

const visibleNews = computed(() => {
  const normalizedQuery = searchQuery.value.trim().toLowerCase()

  if (!normalizedQuery) {
    return newsItems.value
  }

  return newsItems.value.filter((item) =>
    [item.title, item.tag, item.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery),
  )
})

const totalPages = computed(() =>
  Math.max(Math.ceil(visibleNews.value.length / itemsPerPage), 1),
)
const paginatedNews = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage

  return visibleNews.value.slice(start, start + itemsPerPage)
})

const goToPage = (page) => {
  currentPage.value = Math.min(Math.max(page, 1), totalPages.value)
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

    newsItems.value = sortByRecent(items.map((item, index) => ({
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
    })))
  } catch {
    errorMessage.value = 'No se pudieron cargar las noticias del feed.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadNews)

watch(searchQuery, () => {
  currentPage.value = 1
})
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-8 sm:px-6 lg:py-12">
    <div class="relative overflow-hidden rounded-4xl border border-white/10 bg-white/4 p-6 shadow-2xl shadow-violet-950/20 sm:p-8">
      <div class="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-fuchsia-400/15 blur-3xl"></div>
      <div class="relative">
        <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
          Music Mundial Feed
        </p>
        <h1 class="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
          Noticias
        </h1>
        <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Últimas noticias de música y entretenimiento cargadas desde el feed oficial de Music Mundial.
        </p>
      </div>
    </div>

    <div class="mt-6 rounded-3xl border border-white/10 bg-[#090b19]/80 p-4 shadow-xl shadow-violet-950/20 sm:p-5">
      <label class="relative block">
        <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fuchsia-200">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        </span>
        <input
          v-model="searchQuery"
          type="search"
          class="min-h-13 w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/45 focus:bg-white/8"
          placeholder="Buscar noticias..."
        />
      </label>
    </div>

    <p
      v-if="errorMessage"
      class="mt-6 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
    >
      {{ errorMessage }}
    </p>

    <div v-if="isLoading" class="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="index in 6"
        :key="index"
        class="overflow-hidden rounded-3xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25"
      >
        <div class="h-48 animate-pulse bg-white/10"></div>
        <div class="p-5">
          <div class="h-4 w-44 animate-pulse rounded-full bg-white/15"></div>
          <div class="mt-3 h-3 w-28 animate-pulse rounded-full bg-fuchsia-300/20"></div>
        </div>
      </article>
    </div>

    <template v-else-if="visibleNews.length">
      <div class="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="item in paginatedNews"
          :key="item.link"
          class="group overflow-hidden rounded-3xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25 transition hover:-translate-y-1 hover:border-fuchsia-300/30"
        >
          <a :href="item.link" target="_blank" rel="noreferrer" class="block">
            <div class="relative h-48 overflow-hidden bg-linear-to-br" :class="item.visual">
              <img
                v-if="item.image"
                :src="item.image"
                :alt="item.title"
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
                Leer noticia
                <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
              </span>
            </div>
          </a>
        </article>
      </div>

      <div class="mt-8 flex flex-col items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 sm:flex-row">
        <p class="text-sm font-bold text-slate-400">
          Página {{ currentPage }} de {{ totalPages }} · {{ visibleNews.length }} noticias
        </p>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="currentPage === 1"
            @click="goToPage(currentPage - 1)"
          >
            Anterior
          </button>
          <button
            v-for="page in totalPages"
            :key="page"
            type="button"
            class="grid size-11 place-items-center rounded-2xl text-xs font-black transition"
            :class="page === currentPage ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-950/25' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
          <button
            type="button"
            class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="currentPage === totalPages"
            @click="goToPage(currentPage + 1)"
          >
            Siguiente
          </button>
        </div>
      </div>
    </template>

    <div v-else class="mt-8 rounded-4xl border border-white/10 bg-slate-950/45">
      <p class="px-4 py-10 text-center text-sm font-bold text-slate-400">
        No encontramos noticias con esa búsqueda.
      </p>
    </div>
  </section>
</template>
