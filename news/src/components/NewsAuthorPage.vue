<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getNewsAuthor, getNewsPopular } from '../../../src/services/api/newsApi'
import { t } from '../lib/copy'
import { withLocale } from '../lib/locale'
import { coverOf, formatNewsDate, type NewsCard } from '../lib/news'
import { applyNewsSeo } from '../lib/seo'

const props = defineProps<{ slug: string; locale?: string }>()
const loc = computed(() => (props.locale === 'es' ? 'es' : 'en'))
const homeHref = computed(() => withLocale('/', loc.value))
const loading = ref(true)
const error = ref('')
const page = ref(1)
const total = ref(0)
const items = ref<NewsCard[]>([])
const popular = ref<NewsCard[]>([])
const popularLoading = ref(true)
const author = ref<{
  name: string
  slug: string
  href?: string
  bio?: string
  photoUrl?: string
  postCount?: number
} | null>(null)

const countLabel = computed(() => {
  const n = Number(author.value?.postCount || total.value || 0)
  return `${n.toLocaleString(loc.value === 'en' ? 'en' : 'es')} ${t(loc.value, 'authorStories')}`
})
const initial = computed(() => (author.value?.name || 'A').trim().charAt(0).toUpperCase() || 'A')

async function load(reset = true) {
  if (reset) {
    page.value = 1
    items.value = []
    popular.value = []
    popularLoading.value = true
    author.value = null
  }
  loading.value = true
  error.value = ''
  const popularPromise = reset
    ? getNewsPopular({ limit: 5, locale: loc.value }).catch(() => ({ items: [] }))
    : Promise.resolve(null)
  try {
    const payload = await getNewsAuthor(props.slug, { page: page.value, limit: 18, locale: loc.value })
    author.value = {
      name: payload.name,
      slug: payload.slug,
      href: payload.href,
      bio: payload.bio,
      photoUrl: payload.photoUrl,
      postCount: payload.postCount || payload.total,
    }
    total.value = payload.total || 0
    items.value = reset ? payload.items || [] : [...items.value, ...(payload.items || [])]
    if (reset) {
      applyNewsSeo({
        type: 'profile',
        locale: loc.value,
        title: `${author.value.name}, ${t(loc.value, 'authorAt')}`,
        description:
          author.value.bio ||
          (loc.value === 'es'
            ? `${author.value.name} escribe en Music Mundial.`
            : `${author.value.name} writes for Music Mundial.`),
        path: author.value.href || withLocale(`/author/${props.slug}`, loc.value),
        image: author.value.photoUrl || coverOf(items.value[0]),
        imageAlt: author.value.name,
        author: author.value.name,
        authorUrl: author.value.href,
        authorImage: author.value.photoUrl,
        hreflangEn: withLocale(`/author/${props.slug}`, 'en'),
        hreflangEs: withLocale(`/author/${props.slug}`, 'es'),
      })
    }
  } catch {
    error.value = t(loc.value, 'authorMissing')
  } finally {
    loading.value = false
  }
  const feed = await popularPromise
  if (feed) {
    popular.value = feed.items || []
    popularLoading.value = false
  }
}

function loadMore() {
  page.value += 1
  load(false)
}

onMounted(() => load(true))
watch(() => [props.slug, props.locale], () => load(true))
</script>

<template>
  <main class="category-page author-page">
    <section class="category-hero category-hero-light">
      <div class="container">
        <nav class="crumbs" aria-label="breadcrumb">
          <a :href="homeHref">Music Mundial</a>
          <span class="crumbs-sep" aria-hidden="true">›</span>
          <span class="crumbs-now">{{ author?.name || t(loc, 'authorCrumb') }}</span>
        </nav>
        <div v-if="loading && !author" class="author-hero">
          <span class="author-hero-photo skel"></span>
          <div>
            <div class="skel skel-chip"></div>
            <div class="skel skel-title"></div>
            <div class="skel skel-line"></div>
          </div>
        </div>
        <div v-else-if="author" class="author-hero">
          <img v-if="author.photoUrl" class="author-hero-photo" :src="author.photoUrl" :alt="author.name" />
          <span v-else class="author-hero-photo ph">{{ initial }}</span>
          <div>
            <div class="cats-eyebrow">{{ t(loc, 'authorCrumb') }}</div>
            <h1>{{ author.name }}</h1>
            <p v-if="author.bio" class="author-hero-bio">{{ author.bio }}</p>
            <p class="author-hero-count">{{ countLabel }}</p>
          </div>
        </div>
        <p v-else class="article-status">{{ error }} <a :href="homeHref">{{ t(loc, 'backHome') }}</a></p>
      </div>
    </section>
    <div class="container article-layout category-body">
      <div class="article-wrap">
        <div class="pop-mag category-grid">
          <a v-for="item in items" :key="item.id" class="pop-card" :href="item.href">
            <div class="photo">
              <img :src="coverOf(item)" :alt="item.title" />
              <div class="tag-row"><span class="category">{{ item.category }}</span></div>
            </div>
            <h3>{{ item.title }}</h3>
            <time>{{ formatNewsDate(item.publishedAt, loc) }}</time>
          </a>
          <div v-for="n in loading && !items.length ? 6 : 0" :key="'skel-' + n" class="pop-card pop-card-skel">
            <div class="photo skel"></div>
            <span class="skel skel-line"></span>
            <span class="skel skel-meta"></span>
          </div>
        </div>
        <div v-if="loading && items.length" class="article-loader category-more-load" aria-live="polite">
          <p class="article-loader-copy">{{ t(loc, 'authorLoading') }}</p>
        </div>
        <div v-else-if="!loading && items.length < total" class="category-more-row">
          <button class="category-more" type="button" @click="loadMore">{{ t(loc, 'loadMore') }}</button>
        </div>
      </div>
      <aside v-if="popular.length || popularLoading" class="most-read">
        <div class="cats-eyebrow">{{ t(loc, 'mostRead') }}</div>
        <a v-for="(item, index) in popular" :key="item.id" class="most-read-card" :href="item.href">
          <div class="most-read-photo">
            <img :src="coverOf(item)" :alt="item.title" />
            <span class="most-read-num">{{ String(index + 1).padStart(2, '0') }}</span>
          </div>
          <h3>{{ item.title }}</h3>
        </a>
      </aside>
    </div>
  </main>
</template>
