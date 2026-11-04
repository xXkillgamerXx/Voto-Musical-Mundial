<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getNewsTag } from '../../../src/services/api/newsApi'
import { t } from '../lib/copy'
import { withLocale } from '../lib/locale'
import { coverErrorFallback, coverOf, formatNewsDate, tagHref, type NewsCard } from '../lib/news'
import { applyNewsSeo } from '../lib/seo'

type Related = { slug: string; name: string; href?: string }
type Supporter = { name: string; tier: string; points: number }
type TagPage = {
  slug: string
  name: string
  description?: string
  about?: string
  logoUrl?: string
  coverUrl?: string
  verified?: boolean
  followers?: number
  stats?: { articles: number; images: number; videos: number; updatedAt?: string | null }
  items?: NewsCard[]
  trending?: NewsCard[]
  related?: Related[]
  supporters?: Supporter[]
  total?: number
}

const props = defineProps<{ slug: string; locale?: string }>()
const page = ref<TagPage | null>(null)
const items = ref<NewsCard[]>([])
const total = ref(0)
const pageNo = ref(1)
const loading = ref(true)
const error = ref('')
const following = ref(false)
const loc = computed(() => (props.locale === 'es' ? 'es' : 'en'))
const homeHref = computed(() => withLocale('/', loc.value))

const compact = (value: number) => {
  const count = Number(value || 0)
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return count.toLocaleString(loc.value === 'en' ? 'en' : 'es')
}

const ago = (value?: string | null) => {
  if (!value) return ''
  const diff = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diff) || diff < 0) return ''
  const min = Math.max(1, Math.round(diff / 60000))
  if (min < 60) return loc.value === 'en' ? `${min} min ago` : `hace ${min} min`
  const hours = Math.round(min / 60)
  if (hours < 48) return loc.value === 'en' ? `${hours} h ago` : `hace ${hours} h`
  const days = Math.round(hours / 24)
  return loc.value === 'en' ? `${days} d ago` : `hace ${days} d`
}

const followerLabel = computed(() => {
  const base = Number(page.value?.followers || 0)
  return compact(base + (following.value ? 1 : 0))
})

const followKey = () => `vmm_tag_follow_${props.slug.toLowerCase()}`

async function load(reset = true) {
  if (reset) {
    pageNo.value = 1
    items.value = []
  }
  loading.value = true
  error.value = ''
  try {
    const payload = await getNewsTag(props.slug, { page: pageNo.value, limit: 12, locale: loc.value })
    page.value = payload
    total.value = Number(payload.total || 0)
    items.value = reset ? payload.items || [] : [...items.value, ...(payload.items || [])]
    following.value = window.localStorage.getItem(followKey()) === '1'
    if (reset) {
      applyNewsSeo({
        type: 'website',
        locale: loc.value,
        title: `${payload.name} — Music Mundial`,
        description: payload.description || payload.about || `${payload.name} · Music Mundial`,
        path: tagHref(loc.value, payload.slug || props.slug),
        image: payload.coverUrl || coverOf(payload.items?.[0], '/images/jungkook-hero.jpg', 'full'),
        imageAlt: payload.name,
      })
    }
  } catch {
    error.value = loc.value === 'en' ? 'This tag could not be loaded.' : 'No se pudo cargar esta etiqueta.'
    page.value = null
  } finally {
    loading.value = false
  }
}

const toggleFollow = () => {
  following.value = !following.value
  if (following.value) window.localStorage.setItem(followKey(), '1')
  else window.localStorage.removeItem(followKey())
}

const loadMore = () => {
  pageNo.value += 1
  load(false)
}

onMounted(() => load(true))
watch(() => [props.slug, props.locale], () => load(true))
</script>

<template>
  <main class="tag-page">
    <section class="tag-hero" :style="page?.coverUrl ? { backgroundImage: `linear-gradient(90deg, rgba(10,8,22,.92), rgba(10,8,22,.55)), url(${page.coverUrl})` } : undefined">
      <div class="container">
        <nav class="crumbs" aria-label="breadcrumb">
          <a :href="homeHref">Music Mundial</a>
          <span class="crumbs-sep">›</span>
          <span class="crumbs-now">{{ page?.name || props.slug }}</span>
        </nav>
        <div class="tag-id">
          <div class="tag-logo">
            <img v-if="page?.logoUrl" :src="page.logoUrl" :alt="page.name" />
            <span v-else>{{ (page?.name || props.slug).slice(0, 2) }}</span>
          </div>
          <div>
            <h1>
              {{ page?.name || props.slug }}
              <svg v-if="page?.verified" viewBox="0 0 24 24" aria-label="Verificada"><path d="M12 2l2.2 1.6 2.6-.4 1.2 2.4 2.4 1.2-.4 2.6L22 12l-1.6 2.2.4 2.6-2.4 1.2-1.2 2.4-2.6-.4L12 22l-2.2-1.6-2.6.4-1.2-2.4-2.4-1.2.4-2.6L2 12l1.6-2.2-.4-2.6 2.4-1.2 1.2-2.4 2.6.4L12 2zm-1.2 13.2 5-5-1.4-1.4-3.6 3.6-1.6-1.6-1.4 1.4 3 3z" /></svg>
            </h1>
            <p>{{ page?.description || (loc === 'en' ? 'Latest news and updates' : 'Lo último y las actualizaciones') }}</p>
            <div class="tag-actions">
              <button type="button" :class="{ on: following }" @click="toggleFollow">
                {{ following ? (loc === 'en' ? 'Following' : 'Siguiendo') : (loc === 'en' ? 'Follow' : 'Seguir') }}
              </button>
              <span v-if="Number(page?.followers || 0) > 0">{{ followerLabel }} {{ loc === 'en' ? 'followers' : 'seguidores' }}</span>
            </div>
          </div>
        </div>
        <div v-if="page?.stats" class="tag-stats">
          <p><b>{{ compact(page.stats.articles) }}</b><span>{{ loc === 'en' ? 'Articles' : 'Notas' }}</span></p>
          <p><b>{{ compact(page.stats.images) }}</b><span>{{ loc === 'en' ? 'Images' : 'Imágenes' }}</span></p>
          <p><b>{{ compact(page.stats.videos) }}</b><span>Videos</span></p>
          <p><b>{{ ago(page.stats.updatedAt) || '—' }}</b><span>{{ loc === 'en' ? 'Last update' : 'Última nota' }}</span></p>
        </div>
      </div>
    </section>

    <div class="container tag-layout">
      <div>
        <h2>{{ loc === 'en' ? 'Latest news' : 'Últimas notas' }}</h2>
        <p v-if="error" class="article-status">{{ error }}</p>
        <article v-for="item in items" :key="item.id" class="tag-story">
          <a class="tag-story-photo" :href="item.href"><img :src="coverOf(item, '/images/jungkook-hero.jpg', 'thumb')" :alt="item.title" loading="lazy" decoding="async" @error="coverErrorFallback" /></a>
          <div>
            <small>{{ item.category }}</small>
            <h3><a :href="item.href">{{ item.title }}</a></h3>
            <p v-if="item.excerpt">{{ item.excerpt }}</p>
            <time>{{ ago(item.publishedAt) || formatNewsDate(item.publishedAt, loc) }}</time>
          </div>
        </article>
        <button v-if="!loading && items.length < total" class="category-more" type="button" @click="loadMore">
          {{ t(loc, 'loadMore') }}
        </button>
        <p v-else-if="loading" class="article-status">{{ t(loc, 'loadingStories') }}</p>
      </div>
      <aside>
        <section v-if="page?.about" class="tag-card">
          <h2>{{ loc === 'en' ? 'About' : 'Acerca de' }} {{ page.name }}</h2>
          <p>{{ page.about }}</p>
        </section>
        <section v-if="page?.trending?.length" class="tag-card">
          <h2>{{ loc === 'en' ? 'Trending now' : 'Tendencia' }}</h2>
          <ol>
            <li v-for="(item, index) in page.trending" :key="item.id">
              <span>{{ index + 1 }}</span>
              <a :href="item.href">{{ item.title }}</a>
            </li>
          </ol>
        </section>
        <section v-if="page?.supporters?.length" class="tag-card">
          <h2>{{ loc === 'en' ? 'Premium supporters' : 'Supporters' }}</h2>
          <ol>
            <li v-for="(fan, index) in page.supporters" :key="fan.name">
              <span>{{ index + 1 }}</span>
              <b>{{ fan.name }}</b>
              <em>{{ fan.tier }}</em>
              <strong>{{ compact(fan.points) }}</strong>
            </li>
          </ol>
        </section>
        <section v-if="page?.related?.length" class="tag-card">
          <h2>{{ loc === 'en' ? 'Related tags' : 'Etiquetas relacionadas' }}</h2>
          <div class="tag-related">
            <a v-for="tag in page.related" :key="tag.slug" :href="tag.href || tagHref(loc, tag.slug)">{{ tag.name }}</a>
          </div>
        </section>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.tag-hero {
  padding: 28px 0 22px;
  color: #f4f1ff;
  background:
    radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.45), transparent 28%),
    linear-gradient(120deg, #12081f, #2a1248 55%, #1a1030);
  background-size: cover;
  background-position: center;
}
.tag-hero .crumbs,
.tag-hero .crumbs a,
.tag-hero .crumbs-now { color: #d9d0ea; }
.tag-id { display: flex; gap: 18px; align-items: center; margin-top: 18px; }
.tag-logo {
  display: grid;
  place-items: center;
  width: 92px;
  height: 92px;
  overflow: hidden;
  border: 3px solid rgba(255,255,255,.7);
  border-radius: 50%;
  background: #1d1033;
  font-weight: 800;
  letter-spacing: 0.04em;
}
.tag-logo img { width: 100%; height: 100%; object-fit: cover; }
.tag-id h1 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 40px; }
.tag-id h1 svg { width: 22px; height: 22px; fill: #7c5cff; }
.tag-id p { margin: 6px 0 0; color: #ddd4ee; }
.tag-actions { display: flex; gap: 12px; align-items: center; margin-top: 14px; }
.tag-actions button {
  border: 0;
  border-radius: 999px;
  padding: 10px 16px;
  background: #7c5cff;
  color: white;
  font-weight: 800;
  cursor: pointer;
}
.tag-actions button.on { background: transparent; border: 1px solid rgba(255,255,255,.4); }
.tag-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 22px;
}
.tag-stats p {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 14px;
  background: rgba(8, 6, 18, .35);
}
.tag-stats b { display: block; font-size: 22px; }
.tag-stats span { color: #c9bedd; font-size: 12px; }
.tag-layout { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(260px, .7fr); gap: 22px; padding: 28px 0 48px; }
.tag-story { display: grid; grid-template-columns: 210px 1fr; gap: 14px; margin: 0 0 16px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
.tag-story-photo { display: block; overflow: hidden; border-radius: 14px; }
.tag-story img { width: 100%; height: 126px; object-fit: cover; }
.tag-story small { color: #7c5cff; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.tag-story h3 { margin: 4px 0; font-size: 20px; }
.tag-story h3 a, .tag-card a { color: inherit; text-decoration: none; }
.tag-story p { margin: 0 0 6px; color: var(--sub); }
.tag-story time { color: var(--sub); font-size: 13px; }
.tag-card { margin-bottom: 14px; padding: 16px; border: 1px solid var(--line); border-radius: 16px; background: var(--card); }
.tag-card h2 { margin: 0 0 10px; font-size: 18px; }
.tag-card ol { margin: 0; padding: 0; list-style: none; }
.tag-card li { display: grid; grid-template-columns: 22px 1fr auto auto; gap: 8px; align-items: center; margin-top: 10px; }
.tag-card em { color: #7c5cff; font-size: 11px; font-style: normal; font-weight: 800; }
.tag-related { display: flex; flex-wrap: wrap; gap: 8px; }
.tag-related a { padding: 6px 10px; border-radius: 999px; background: var(--off); color: var(--ink); text-decoration: none; font-size: 13px; font-weight: 800; }
@media (max-width: 860px) {
  .tag-layout, .tag-story, .tag-stats { grid-template-columns: 1fr; }
  .tag-id h1 { font-size: 30px; }
}
</style>
