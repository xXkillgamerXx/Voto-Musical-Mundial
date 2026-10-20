<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getNewsCategories, getNewsPosts } from '../../../src/services/api/newsApi'
import { withLocale } from '../lib/locale'
import { t } from '../lib/copy'
import { toCategoryCard, type CategoryCard } from '../lib/news'
import CatsCard from './CatsCard.vue'

const props = defineProps<{ locale?: string }>()
const loc = computed(() => (props.locale === 'en' ? 'en' : 'es'))
const homeHref = computed(() => withLocale('/', loc.value))
const items = ref<CategoryCard[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [rows, latest] = await Promise.all([
      getNewsCategories(loc.value),
      getNewsPosts({ page: 1, limit: 24, locale: loc.value }).catch(() => ({ items: [] })),
    ])
    const covers = new Map<string, string>()
    for (const post of latest.items || []) {
      if (!post.coverUrl) continue
      if (post.categorySlug && !covers.has(post.categorySlug)) covers.set(post.categorySlug, post.coverUrl)
      for (const cat of post.categories || []) {
        if (cat.slug && !covers.has(cat.slug)) covers.set(cat.slug, post.coverUrl)
      }
    }
    items.value = (Array.isArray(rows) ? rows : [])
      .filter((row: { postCount?: number }) => Number(row.postCount || 0) > 0)
      .sort((a: { nav?: boolean }, b: { nav?: boolean }) => Number(Boolean(b.nav)) - Number(Boolean(a.nav)))
      .map((row: { slug: string; name: string; href?: string; coverUrl?: string | null; postCount?: number }, index: number) =>
        toCategoryCard({ ...row, coverUrl: row.coverUrl || covers.get(row.slug) || null }, index, loc.value),
      )
    document.title = `${t(loc.value, 'categoriesCrumb')} — Music Mundial`
  } catch {
    error.value = t(loc.value, 'categoryMissing')
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.locale, load)
</script>

<template>
  <main class="category-page">
    <section class="category-hero category-hero-light">
      <div class="container">
        <nav class="crumbs" aria-label="breadcrumb">
          <a :href="homeHref">Music Mundial</a>
          <span class="crumbs-sep" aria-hidden="true">›</span>
          <span class="crumbs-now">{{ t(loc, 'categoriesCrumb') }}</span>
        </nav>
        <div class="cats-head">
          <div>
            <div class="cats-eyebrow">{{ t(loc, 'explore') }}</div>
            <h1>{{ t(loc, 'discoverLead') }} <span>{{ t(loc, 'discoverAccent') }}</span></h1>
            <p>{{ t(loc, 'discoverBlurb') }}</p>
          </div>
          <span v-if="!loading" class="cats-link">
            {{ items.length.toLocaleString(loc) }} {{ t(loc, 'categoriesCrumb').toLowerCase() }}
          </span>
        </div>
      </div>
    </section>
    <div class="container category-body">
      <p v-if="error" class="article-status">{{ error }}</p>
      <div v-if="loading" class="article-loader article-loader-center" aria-live="polite">
        <div class="article-loader-eq" aria-hidden="true">
          <i v-for="n in 14" :key="n" :style="{ '--d': `${(n % 7) * 80}ms` }"></i>
        </div>
        <p class="article-loader-copy">{{ t(loc, 'loadingStories') }}</p>
      </div>
      <div v-else class="cats-index-grid">
        <CatsCard v-for="card in items" :key="card.href" :card="card" />
      </div>
    </div>
  </main>
</template>
