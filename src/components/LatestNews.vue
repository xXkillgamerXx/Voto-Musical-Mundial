<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { translate } from '../i18n'
import { getNewsPosts } from '../services/api/newsApi'
import { routePath } from '../utils/localizedRoutes'

const VISUALS = [
  'from-violet-950 via-fuchsia-700 to-indigo-950',
  'from-indigo-950 via-purple-700 to-fuchsia-900',
  'from-amber-900 via-fuchsia-700 to-violet-950',
  'from-cyan-950 via-violet-800 to-slate-950',
  'from-rose-950 via-fuchsia-800 to-slate-950',
  'from-slate-950 via-blue-900 to-violet-950',
]

const { locale } = useI18n()
const newsHref = computed(() => routePath('news', locale.value))
const newsItems = ref([])
const isLoading = ref(true)
const errorMessage = ref('')

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

const loadNews = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const payload = await getNewsPosts({ page: 1, limit: 3, locale: locale.value })
    newsItems.value = (payload.items || []).map(mapPost)
    if (!newsItems.value.length) throw new Error('empty')
  } catch {
    errorMessage.value = translate('news.errors.loadExternal')
    newsItems.value = []
  } finally {
    isLoading.value = false
  }
}

onMounted(loadNews)
watch(locale, loadNews)
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
      <a :href="newsHref" class="text-xs font-black uppercase tracking-wide text-violet-300 hover:text-white">
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
      {{ errorMessage }}
    </p>

    <div v-else class="grid gap-4 md:grid-cols-3">
      <article
        v-for="item in newsItems"
        :key="item.id"
        class="group flex h-full overflow-hidden rounded-3xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25 transition hover:-translate-y-1 hover:border-fuchsia-300/30"
      >
        <a :href="item.link" class="flex h-full min-h-full w-full flex-col">
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
  </section>
</template>
