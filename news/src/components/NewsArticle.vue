<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getNewsPopular, getNewsPost } from '../../../src/services/api/newsApi'
import { t } from '../lib/copy'
import { withLocale } from '../lib/locale'
import { coverOf, formatNewsDate, type NewsCard } from '../lib/news'

const props = defineProps<{ slug: string; locale?: string }>()
const post = ref<(NewsCard & { content?: string; related?: NewsCard[] }) | null>(null)
const popular = ref<NewsCard[]>([])
const popularLoading = ref(true)
const error = ref('')
const loading = ref(true)
const loc = computed(() => (props.locale === 'en' ? 'en' : 'es'))
const homeHref = computed(() => withLocale('/', loc.value))
const crumbCategory = computed(() => {
  const cats = post.value?.categories || []
  const preferred = ['kpop', 'pop', 'viral', 'series', 'peliculas', 'celebridades', 'entrevista', 'redes-sociales']
  return cats.find((item) => preferred.includes(item.slug))
    || cats[0]
    || { slug: post.value?.categorySlug || 'noticias', name: post.value?.category || (loc.value === 'en' ? 'News' : 'Noticias') }
})
const crumbHref = computed(() => withLocale(`/categoria/${crumbCategory.value.slug}`, loc.value))

async function load() {
  loading.value = true
  popularLoading.value = true
  error.value = ''
  post.value = null
  popular.value = []
  const popularPromise = getNewsPopular({ exclude: props.slug, limit: 5, locale: loc.value }).catch(() => ({ items: [] }))
  try {
    post.value = await getNewsPost(props.slug, loc.value)
    document.title = `${post.value.title} — Music Mundial`
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  } catch {
    error.value = t(loc.value, 'storyMissing')
    document.title = loc.value === 'en' ? 'Music Mundial — Entertainment news' : 'Music Mundial — Cultura y entretenimiento'
    window.history.replaceState({}, '', `/${loc.value}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  } finally {
    loading.value = false
  }
  const feed = await popularPromise
  popular.value = feed.items || []
  popularLoading.value = false
}

onMounted(load)
watch(() => [props.slug, props.locale], load)
</script>

<template>
  <main class="article-page">
    <div class="container article-layout">
      <div class="article-wrap">
      <div v-if="loading" class="article-loader" aria-live="polite">
        <nav class="crumbs crumbs-load" aria-label="breadcrumb">
          <a :href="homeHref">Music Mundial</a>
          <span class="crumbs-sep" aria-hidden="true">›</span>
          <span class="skel skel-chip"></span>
          <span class="crumbs-sep" aria-hidden="true">›</span>
          <span class="skel skel-crumb"></span>
        </nav>
        <div class="article-loader-eq" aria-hidden="true">
          <i v-for="n in 14" :key="n" :style="{ '--d': `${(n % 7) * 80}ms` }"></i>
        </div>
        <p class="article-loader-copy">{{ t(loc, 'loadingStory') }}</p>
        <div class="article-skel-tags">
          <span class="skel skel-chip"></span>
          <span class="skel skel-chip short"></span>
        </div>
        <div class="skel skel-title"></div>
        <div class="skel skel-title two"></div>
        <div class="skel skel-meta"></div>
        <div class="skel skel-cover"></div>
        <div class="skel skel-line"></div>
        <div class="skel skel-line"></div>
        <div class="skel skel-line short"></div>
      </div>
      <p v-else-if="error" class="article-status">{{ error }} <a :href="homeHref">{{ t(loc, 'backHome') }}</a></p>
      <article v-else-if="post" class="article">
        <nav class="crumbs" aria-label="breadcrumb">
          <a :href="homeHref">Music Mundial</a>
          <span class="crumbs-sep" aria-hidden="true">›</span>
          <a :href="crumbHref">{{ crumbCategory.name }}</a>
          <span class="crumbs-sep" aria-hidden="true">›</span>
          <span class="crumbs-now">{{ post.title }}</span>
        </nav>
        <div class="article-tags">
          <a
            v-for="cat in (post.categories?.length ? post.categories : [{ slug: post.categorySlug, name: post.category }])"
            :key="cat.slug"
            class="chip"
            :href="withLocale(`/categoria/${cat.slug}`, locale === 'en' ? 'en' : 'es')"
          >{{ cat.name }}</a>
        </div>
        <h1>{{ post.title }}</h1>
        <p class="article-meta">
          <span class="article-by">{{ t(loc, 'byAuthor') }} {{ post.authorName || t(loc, 'staff') }}</span>
          <span v-if="post.publishedAt"> · {{ formatNewsDate(post.publishedAt, loc) }}</span>
        </p>
        <figure v-if="post.coverUrl" class="article-cover">
          <img :src="coverOf(post)" :alt="post.title" />
        </figure>
        <p v-if="post.excerpt" class="article-lead">{{ post.excerpt }}</p>
        <div class="article-body" v-html="post.content"></div>
      </article>
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
    <section v-if="post?.related?.length" class="article-more">
      <div class="container">
        <div class="entertain-head cats-head">
          <div>
            <div class="cats-eyebrow">{{ t(loc, 'explore') }}</div>
            <h2><span>{{ t(loc, 'moreStories') }}</span></h2>
          </div>
          <a class="cats-link" :href="homeHref">{{ t(loc, 'seeMoreArrow') }}</a>
        </div>
        <div class="entertain-grid">
          <a class="entertain-feature" :href="post.related[0].href">
            <img :src="coverOf(post.related[0])" :alt="post.related[0].title" />
            <span class="etag">{{ post.related[0].category }}</span>
            <div>
              <h3>{{ post.related[0].title }}</h3>
              <p>{{ post.related[0].excerpt }}</p>
              <time>{{ formatNewsDate(post.related[0].publishedAt, loc) }}</time>
            </div>
          </a>
          <div class="entertain-side">
            <a v-for="item in post.related.slice(1)" :key="item.id" :href="item.href">
              <img :src="coverOf(item)" :alt="item.title" />
              <div>
                <span class="etag">{{ item.category }}</span>
                <h3>{{ item.title }}</h3>
                <time>{{ formatNewsDate(item.publishedAt, loc) }}</time>
              </div>
            </a>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
