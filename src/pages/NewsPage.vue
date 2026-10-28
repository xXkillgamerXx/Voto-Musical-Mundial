<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { translate } from '../i18n'
import { getNewsPosts } from '../services/api/newsApi'

const VISUALS = [
  'from-violet-950 via-fuchsia-700 to-indigo-950',
  'from-indigo-950 via-purple-700 to-fuchsia-900',
  'from-amber-900 via-fuchsia-700 to-violet-950',
  'from-cyan-950 via-violet-800 to-slate-950',
  'from-rose-950 via-fuchsia-800 to-slate-950',
  'from-slate-950 via-blue-900 to-violet-950',
]

const { locale } = useI18n()
const newsItems = ref([])
const isLoading = ref(true)
const errorMessage = ref('')
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 9

const formatFeedDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return translate('news.recent')
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const mapPost = (post, index) => ({
  id: post.id,
  title: post.title,
  tag: post.category || translate('news.defaultTag'),
  time: formatFeedDate(post.publishedAt),
  link: post.href,
  description: post.excerpt || '',
  image: post.coverUrl || '',
  visual: VISUALS[index % VISUALS.length],
})

const visibleNews = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return newsItems.value
  return newsItems.value.filter((item) =>
    [item.title, item.tag, item.description].filter(Boolean).join(' ').toLowerCase().includes(query),
  )
})
const totalPages = computed(() => Math.max(Math.ceil(visibleNews.value.length / itemsPerPage), 1))
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
    const payload = await getNewsPosts({
      page: 1,
      limit: 24,
      locale: locale.value,
    })
    newsItems.value = (payload.items || []).map(mapPost)
  } catch {
    errorMessage.value = translate('news.errors.loadFeed')
    newsItems.value = []
  } finally {
    isLoading.value = false
  }
}

onMounted(loadNews)

watch(searchQuery, () => {
  currentPage.value = 1
})

watch(locale, () => {
  currentPage.value = 1
  loadNews()
})
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-8 sm:px-6 lg:py-12">
    <div class="relative overflow-hidden rounded-4xl border border-white/10 bg-white/4 p-6 shadow-2xl shadow-violet-950/20 sm:p-8">
      <div class="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-fuchsia-400/15 blur-3xl"></div>
      <div class="relative">
        <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
          {{ $t('news.feedEyebrow') }}
        </p>
        <h1 class="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
          {{ $t('news.title') }}
        </h1>
        <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          {{ $t('news.description') }}
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
          :placeholder="$t('news.searchPlaceholder')"
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
          :key="item.id"
          class="group flex h-full overflow-hidden rounded-3xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25 transition hover:-translate-y-1 hover:border-fuchsia-300/30"
        >
          <a :href="item.link" class="flex h-full min-h-full w-full flex-col">
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

            <div class="flex flex-1 flex-col p-5">
              <h3 class="line-clamp-2 text-lg font-black text-white">{{ item.title }}</h3>
              <p v-if="item.description" class="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{{ item.description }}</p>
              <p class="mt-auto pt-4 text-xs font-bold uppercase tracking-widest text-slate-500">{{ item.time }}</p>
              <span class="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition group-hover:scale-[1.01]">
                {{ $t('news.readArticle') }}
                <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </span>
            </div>
          </a>
        </article>
      </div>

      <div class="mt-8 flex flex-col items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 sm:flex-row">
        <p class="text-sm font-bold text-slate-400">
          {{ $t('news.pagination', { page: currentPage, total: totalPages, count: visibleNews.length }) }}
        </p>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="currentPage === 1"
            @click="goToPage(currentPage - 1)"
          >
            {{ $t('common.actions.previous') }}
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
            {{ $t('common.actions.next') }}
          </button>
        </div>
      </div>
    </template>

    <div v-else class="mt-8 rounded-4xl border border-white/10 bg-slate-950/45">
      <p class="px-4 py-10 text-center text-sm font-bold text-slate-400">
        {{ $t('news.emptySearch') }}
      </p>
    </div>
  </section>
</template>
