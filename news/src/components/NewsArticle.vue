<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { getNewsPopular, getNewsPost } from '../../../src/services/api/newsApi'
import { t } from '../lib/copy'
import { expandNewsEmbeds, loadTwitterEmbeds, youtubeVideoIds } from '../lib/embeds'
import { withLocale } from '../lib/locale'
import { coverOf, formatNewsDate, type NewsCard } from '../lib/news'
import { newsRouteState } from '../lib/route-state'
import { applyHomeSeo, applyNewsSeo } from '../lib/seo'
import NewsComments from './NewsComments.vue'

const props = defineProps<{ slug: string; locale?: string }>()
const post = ref<(NewsCard & { content?: string; related?: NewsCard[] }) | null>(null)
const popular = ref<NewsCard[]>([])
const popularLoading = ref(true)
const error = ref('')
const loading = ref(true)
const loc = computed(() => (props.locale === 'es' ? 'es' : 'en'))
const homeHref = computed(() => withLocale('/', loc.value))
const crumbCategory = computed(() => {
  const cats = post.value?.categories || []
  const preferred = ['kpop', 'pop', 'viral', 'series', 'peliculas', 'celebridades', 'entrevista', 'redes-sociales']
  return cats.find((item) => preferred.includes(item.slug))
    || cats[0]
    || { slug: post.value?.categorySlug || 'noticias', name: post.value?.category || (loc.value === 'en' ? 'News' : 'Noticias') }
})
const crumbHref = computed(() => withLocale(`/categoria/${crumbCategory.value.slug}`, loc.value))
const bodyHtml = computed(() => expandNewsEmbeds(post.value?.content || ''))
const copiedShare = ref('')
const shareUrl = () => window.location.href
const share = async (network: 'facebook' | 'twitter' | 'instagram' | 'tiktok') => {
  const url = shareUrl()
  const title = post.value?.title || ''
  if (network === 'facebook') {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener')
    return
  }
  if (network === 'twitter') {
    window.open(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      '_blank',
      'noopener',
    )
    return
  }
  try {
    await navigator.clipboard.writeText(url)
    copiedShare.value = network
    window.setTimeout(() => {
      copiedShare.value = ''
    }, 2200)
  } catch {
    copiedShare.value = ''
  }
  window.open(network === 'instagram' ? 'https://www.instagram.com/' : 'https://www.tiktok.com/', '_blank', 'noopener')
}
const isVideo = (item: { url: string; type?: string; name?: string }) =>
  String(item.type || item.name || item.url).toLowerCase().includes('video') ||
  /\.(mp4|webm|mov)(\?|$)/i.test(item.url)
const isGif = (item: { url: string; type?: string; name?: string }) =>
  String(item.type || item.name || item.url).toLowerCase().includes('gif')

async function load() {
  loading.value = true
  popularLoading.value = true
  error.value = ''
  post.value = null
  popular.value = []
  const popularPromise = getNewsPopular({ exclude: props.slug, limit: 5, locale: loc.value }).catch(() => ({ items: [] }))
  try {
    post.value = await getNewsPost(props.slug, loc.value)
    applyNewsSeo({
      type: 'article',
      locale: loc.value,
      title: post.value.title,
      description: post.value.excerpt,
      path: post.value.href || window.location.pathname,
      image: post.value.coverUrl,
      imageAlt: post.value.title,
      publishedAt: post.value.publishedAt,
      modifiedAt: post.value.modifiedAt || post.value.publishedAt,
      author: post.value.authorName,
      authorUrl: post.value.authorHref,
      authorImage: post.value.authorPhotoUrl,
      keywords: (post.value.tags || []).map((item) => item.slug || item.name),
      sections: (post.value.categories || []).map((item) => item.name),
      categoryName: crumbCategory.value.name,
      categoryPath: crumbHref.value,
      hreflangEn: loc.value === 'en' ? post.value.href : post.value.alternate?.href,
      hreflangEs: loc.value === 'es' ? post.value.href : post.value.alternate?.href,
      videos: youtubeVideoIds(post.value.content || ''),
    })
    newsRouteState.alternateHref = post.value.alternate?.href || ''
    if (post.value.href && window.location.pathname !== post.value.href) {
      window.history.replaceState({}, '', `${post.value.href}${window.location.search}${window.location.hash}`)
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  } catch {
    error.value = t(loc.value, 'storyMissing')
    applyHomeSeo(loc.value)
    window.history.replaceState({}, '', loc.value === 'es' ? '/es' : '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  } finally {
    loading.value = false
  }
  const feed = await popularPromise
  popular.value = feed.items || []
  popularLoading.value = false
}

onMounted(load)
onUnmounted(() => {
  newsRouteState.alternateHref = ''
})
watch(() => [props.slug, props.locale], load)
watch(bodyHtml, async () => {
  await nextTick()
  loadTwitterEmbeds(document.querySelector('.article-body'))
})
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
          <span class="article-by">
            {{ t(loc, 'byAuthor') }}
            <a v-if="post.authorHref || post.authorUsername" :href="post.authorHref || withLocale(`/user/${post.authorUsername}`, loc)">{{ post.authorName || t(loc, 'staff') }}</a>
            <template v-else>{{ post.authorName || t(loc, 'staff') }}</template>
          </span>
          <span v-if="post.publishedAt"> · {{ formatNewsDate(post.publishedAt, loc) }}</span>
        </p>
        <figure v-if="post.coverUrl" class="article-cover">
          <img :src="coverOf(post)" :alt="post.title" width="1600" height="900" fetchpriority="high" decoding="async" />
        </figure>
        <p v-if="post.excerpt" class="article-lead">{{ post.excerpt }}</p>
        <div class="article-body" v-html="bodyHtml"></div>
        <div v-if="post.tags?.length" class="article-post-tags">
          <span>{{ t(loc, 'articleTags') }}</span>
          <b v-for="tag in post.tags" :key="tag.slug || tag.name">{{ tag.name }}</b>
        </div>
        <section v-if="post.attachments?.length" class="article-files">
          <h2>{{ t(loc, 'articleFiles') }}</h2>
          <div class="article-file-grid">
            <figure v-for="file in post.attachments" :key="file.url">
              <video v-if="isVideo(file)" :src="file.url" controls playsinline />
              <img v-else :src="file.url" :alt="file.name || ''" :class="{ gif: isGif(file) }" />
              <figcaption v-if="file.name">{{ file.name }}</figcaption>
            </figure>
          </div>
        </section>
        <div class="article-share">
          <h2>{{ t(loc, 'shareOn') }}</h2>
          <div class="article-share-row">
            <button type="button" class="share-facebook" @click="share('facebook')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v3H6v4h3v8h4v-8h3l1-4h-4V9c0-.6.4-1 1-1z"/></svg>
              {{ t(loc, 'shareFacebook') }}
            </button>
            <button type="button" class="share-twitter" @click="share('twitter')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22 5.8c-.7.3-1.5.5-2.3.6.8-.5 1.4-1.2 1.7-2.1-.8.5-1.6.8-2.5 1A3.8 3.8 0 0 0 12 8.7c0 .3 0 .6.1.9-3.2-.2-6-1.7-7.9-4-.3.6-.5 1.2-.5 1.9 0 1.3.7 2.5 1.7 3.2-.6 0-1.2-.2-1.7-.5v.1c0 1.8 1.3 3.4 3 3.7-.3.1-.7.1-1 .1-.2 0-.5 0-.7-.1.5 1.5 1.9 2.6 3.6 2.6A7.6 7.6 0 0 1 2 18.4 10.8 10.8 0 0 0 7.8 20c7 0 10.8-5.8 10.8-10.8v-.5c.7-.5 1.4-1.2 1.9-1.9z"/></svg>
              {{ t(loc, 'shareTwitter') }}
            </button>
            <button type="button" class="share-instagram" @click="share('instagram')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm10 2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-5 3.2A3.8 3.8 0 1 1 8.2 12 3.8 3.8 0 0 1 12 8.2zm0 1.6A2.2 2.2 0 1 0 14.2 12 2.2 2.2 0 0 0 12 9.8zM17.4 6.6a1 1 0 1 1-1 1 1 1 0 0 1 1-1z"/></svg>
              {{ t(loc, 'shareInstagram') }}
            </button>
            <button type="button" class="share-tiktok" @click="share('tiktok')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.2 3h3.1c.3 2.5 1.8 4.3 4.2 4.6v3.1c-1.5 0-2.9-.5-4.1-1.3v7.2A7.6 7.6 0 1 1 8.4 9.2v3.2a4.4 4.4 0 1 0 3.2 4.3V3z"/></svg>
              {{ t(loc, 'shareTikTok') }}
            </button>
          </div>
          <p v-if="copiedShare" class="article-share-copied">{{ t(loc, 'shareCopied') }}</p>
        </div>
        <NewsComments :slug="post.slug" :locale="loc" />
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
