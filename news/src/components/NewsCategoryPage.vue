<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getNewsPopular, getNewsPosts } from '../../../src/services/api/newsApi'
import { withLocale } from '../lib/locale'
import { t } from '../lib/copy'
import { categoryHero, categoryTitle, coverOf, formatNewsDate, type NewsCard } from '../lib/news'

const props = defineProps<{ slug: string; locale?: string }>()
const items = ref<NewsCard[]>([])
const popular = ref<NewsCard[]>([])
const popularLoading = ref(true)
const total = ref(0)
const page = ref(1)
const loading = ref(true)
const error = ref('')
const loc = computed(() => (props.locale === 'en' ? 'en' : 'es'))
const homeHref = computed(() => withLocale('/', loc.value))
const fromPosts = computed(() => {
  const match = items.value.find((item) => item.categorySlug === props.slug)
    || items.value.find((item) => item.categories?.some((cat) => cat.slug === props.slug))
  return match?.categories?.find((cat) => cat.slug === props.slug)?.name || match?.category || ''
})
const title = computed(() => categoryTitle(props.slug, loc.value, fromPosts.value))
const hero = computed(() => categoryHero(props.slug, loc.value))
const countLabel = computed(() => {
  const count = total.value.toLocaleString(loc.value === 'en' ? 'en' : 'es')
  return `${count} ${t(loc.value, 'storiesCount')}`
})
const eqBars = Array.from({ length: 48 }, (_, i) => ({
  h: `${18 + Math.round((Math.sin(i * 0.45) + 1) * 25 + ((i * 17) % 28))}px`,
  d: `${0.7 + ((i * 13) % 18) / 10}s`,
  delay: `${-((i * 7) % 30) / 10}s`,
}))

async function load(reset = true) {
  if (reset) {
    page.value = 1
    items.value = []
    popular.value = []
    popularLoading.value = true
  }
  loading.value = true
  error.value = ''
  const popularPromise = reset
    ? getNewsPopular({ limit: 5, locale: loc.value }).catch(() => ({ items: [] }))
    : Promise.resolve(null)
  try {
    const payload = await getNewsPosts({ page: page.value, limit: 18, category: props.slug, locale: loc.value })
    total.value = payload.total || 0
    items.value = reset ? payload.items : [...items.value, ...(payload.items || [])]
    document.title = `${title.value} — Music Mundial`
  } catch {
    error.value = t(loc.value, 'categoryMissing')
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
  <main class="category-page">
    <section
      class="category-hero"
      :class="hero.dark === 'kpop' ? 'dark-section' : hero.dark === 'screen' ? 'dark-section category-hero-screen' : 'category-hero-light'"
    >
      <div v-if="hero.dark === 'kpop'" class="kpop-bg" aria-hidden="true">
        <span class="glow"></span>
        <span class="glow two"></span>
        <svg class="sound-waves" viewBox="0 0 1440 560" preserveAspectRatio="none">
          <path class="wave" d="M-100 190 C110 20 220 410 410 190 S680 20 840 200 S1120 400 1530 145" />
          <path class="wave" d="M-100 250 C160 450 230 30 440 250 S670 470 890 245 S1220 30 1540 275" />
          <path class="wave" d="M-100 330 C90 145 270 490 465 330 S725 180 900 340 S1240 520 1530 300" />
        </svg>
        <div class="equalizer">
          <i v-for="(bar, i) in eqBars" :key="i" :style="{ '--h': bar.h, '--d': bar.d, '--delay': bar.delay }"></i>
        </div>
      </div>
      <div v-else-if="hero.dark === 'screen'" class="film-bg" aria-hidden="true">
        <span class="glow"></span>
        <svg viewBox="0 0 1500 850" preserveAspectRatio="xMidYMid slice">
          <path class="film" d="M-210 760 C140 720 200 290 485 100 S950 -90 1550 190" />
          <path class="film" d="M1080 960 C900 710 1120 580 1370 490 S1700 340 1800 150" />
          <path class="film soft" d="M-100 170 C170 60 360 360 620 200 S1140 40 1600 290" />
        </svg>
      </div>
      <div class="container">
        <nav class="crumbs" aria-label="breadcrumb">
          <a :href="homeHref">Music Mundial</a>
          <span class="crumbs-sep" aria-hidden="true">›</span>
          <span class="crumbs-now">{{ title }}</span>
        </nav>
        <div class="cats-head" :class="{ 'kpop-head': Boolean(hero.dark) }">
          <div>
            <div class="cats-eyebrow">{{ t(loc, 'explore') }}</div>
            <h1>{{ hero.lead }} <span>{{ hero.accent }}</span></h1>
            <p>{{ hero.blurb }}</p>
          </div>
          <span v-if="items.length || !loading" class="cats-link">{{ countLabel }}</span>
          <span v-else class="cats-link article-meta-load">
            <span class="article-loader-eq" aria-hidden="true">
              <i v-for="n in 8" :key="n" :style="{ '--d': `${(n % 7) * 80}ms` }"></i>
            </span>
          </span>
        </div>
      </div>
    </section>
    <div class="container article-layout category-body">
      <div class="article-wrap">
      <p v-if="error" class="article-status">{{ error }}</p>
      <div class="pop-mag category-grid">
        <a v-for="item in items" :key="item.id" class="pop-card" :href="item.href">
          <div class="photo">
            <img :src="coverOf(item)" :alt="item.title" />
            <div class="tag-row"><span class="category">{{ item.category }}</span></div>
          </div>
          <h3>{{ item.title }}</h3>
          <time>{{ item.authorName ? `${t(loc, 'byAuthor')} ${item.authorName} · ` : '' }}{{ formatNewsDate(item.publishedAt, loc) }}</time>
        </a>
        <div v-for="n in loading && !items.length ? 6 : 0" :key="'skel-' + n" class="pop-card pop-card-skel">
          <div class="photo skel"></div>
          <span class="skel skel-line"></span>
          <span class="skel skel-meta"></span>
        </div>
      </div>
      <div v-if="loading && items.length" class="article-loader category-more-load" aria-live="polite">
        <div class="article-loader-eq" aria-hidden="true">
          <i v-for="n in 14" :key="'more-' + n" :style="{ '--d': `${(n % 7) * 80}ms` }"></i>
        </div>
        <p class="article-loader-copy">{{ t(loc, 'loadingStories') }}</p>
      </div>
      <button
        v-else-if="!loading && items.length < total"
        class="read-btn category-more"
        type="button"
        @click="loadMore"
      >
        {{ t(loc, 'loadMore') }}
      </button>
      </div>
      <aside v-if="popular.length || popularLoading" class="most-read">
        <div class="cats-eyebrow">{{ t(loc, 'mostRead') }}</div>
        <a
          v-for="(item, index) in popular"
          :key="item.id"
          class="most-read-card"
          :href="item.href"
        >
          <div class="most-read-photo">
            <img :src="coverOf(item)" :alt="item.title" />
            <span class="most-read-num">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="most-read-tags">
              <span class="chip">{{ item.category }}</span>
            </span>
          </div>
          <h3>{{ item.title }}</h3>
        </a>
        <div v-for="n in popularLoading && !popular.length ? 5 : 0" :key="'pop-skel-' + n" class="most-read-card most-read-skel">
          <div class="most-read-photo skel"></div>
          <span class="skel skel-line"></span>
        </div>
      </aside>
    </div>
  </main>
</template>
