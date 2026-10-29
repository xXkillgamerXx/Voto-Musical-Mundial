<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { getCurrentApiAuth, getMe } from '../../../src/services/api/authApi'
import { onStoredAuthChange } from '../../../src/services/api/client'
import {
  createForumPost,
  createForumTopic,
  getForumCategory,
  getForumHome,
  getForumTopic,
  searchForum,
} from '../../../src/services/api/forumApi'
import { t } from '../lib/copy'
import { FORUM_BOARDS, fanLabel, fanTone, forumCover } from '../lib/forum'
import { withLocale } from '../lib/locale'
import { applyNewsSeo } from '../lib/seo'
import CatsCard from './CatsCard.vue'

type Person = {
  id: string
  username?: string | null
  displayName: string
  photoUrl?: string | null
  fanSku?: string | null
}

type Category = {
  slug: string
  name: string
  blurb: string
  icon: string
  isVip?: boolean
  topicCount?: number
  parentSlug?: string | null
  parent?: { slug: string; name: string } | null
  children?: Category[]
}

type Topic = {
  id: string
  title: string
  slug: string
  href: string
  replyCount: number
  viewCount: number
  lastPostAt: string
  createdAt: string
  pinned?: boolean
  closed?: boolean
  category: { slug: string; name: string; isVip?: boolean }
  author: Person
  lastPoster?: Person | null
}

type Post = {
  id: string
  body: string
  images: string[]
  position: number
  replyToPostId?: string | null
  createdAt: string
  author: Person
}

const STARTLY_URL = 'https://startlyapp.com/musicmundial'
const STARTLY_MORE = 'https://startlyapp.com/'
const props = defineProps<{ locale?: string; board?: string; post?: string }>()
const loc = computed(() => (props.locale === 'es' ? 'es' : 'en'))
const forumHref = computed(() => withLocale('/forum', loc.value))
const isAuthed = (auth = getCurrentApiAuth()) => Boolean(auth?.accessToken && auth.user && !auth.user.isAnonymous)
const signedIn = ref(isAuthed())
const meName = ref('')
const mePhoto = ref('')
const loading = ref(true)
const error = ref('')
const categories = ref<Category[]>([])
const topics = ref<Topic[]>([])
const popular = ref<Topic[]>([])
const premium = ref<Person[]>([])
const stats = ref({ members: 0, posts: 0, topics: 0, online: 0 })
const posts = ref<Post[]>([])
const activeCategory = ref<Category | null>(null)
const activeTopic = ref<Topic | null>(null)
const sort = ref<'latest' | 'activity' | 'replies' | 'popular'>('activity')
const page = ref(1)
const total = ref(0)
const search = ref('')
const draftTitle = ref('')
const draftBoard = ref('kpop')
const draftBody = ref('')
const draftImages = ref<string[]>([])
const composeError = ref('')
const replyBody = ref('')
const replyTo = ref<Post | null>(null)
const replyError = ref('')
const sending = ref(false)
let stopAuth: (() => void) | null = null

const view = computed(() => {
  if (props.board === 'new') return 'compose'
  if (props.post) return 'thread'
  if (props.board) return 'category'
  return 'home'
})
const compact = (value: number) =>
  new Intl.NumberFormat(loc.value === 'en' ? 'en' : 'es', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0)
const ago = (value?: string) => {
  if (!value) return ''
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.max(1, Math.round((Date.now() - then) / 60000))
  if (mins < 60) return loc.value === 'es' ? `hace ${mins} min` : `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return loc.value === 'es' ? `hace ${hours} h` : `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return loc.value === 'es' ? `hace ${days} d` : `${days}d ago`
  return new Date(value).toLocaleDateString(loc.value === 'en' ? 'en' : 'es')
}
const profileHref = (person: Person) =>
  person.username ? withLocale(`/user/${person.username}`, loc.value) : forumHref.value
const topicHref = (item: Topic) => withLocale(`/forum/${item.category.slug}/${item.id}`, loc.value)
const categoryHref = (slug: string) => withLocale(`/forum/${slug}`, loc.value)
const newHref = computed(() => withLocale('/forum/new', loc.value))
const pages = computed(() => Math.max(1, Math.ceil(total.value / 20)))
const fallbackCategories = computed(() =>
  FORUM_BOARDS.map((item) => ({
    slug: item.slug,
    name: item.name[loc.value],
    blurb: '',
    icon: item.icon,
    topicCount: 0,
  })),
)
const shownCategories = computed(() => (categories.value.length ? categories.value : fallbackCategories.value))
const composeRooms = computed(() => {
  const rooms: Array<{ slug: string; name: string }> = []
  for (const card of shownCategories.value) {
    rooms.push({ slug: card.slug, name: card.name })
    for (const child of card.children || []) {
      rooms.push({ slug: child.slug, name: `${card.name} / ${child.name}` })
    }
  }
  return rooms
})
const subrooms = computed(() => activeCategory.value?.children || [])
const asExploreCard = (card: Category, index: number) => ({
  href: categoryHref(card.slug),
  image: forumCover(card.slug, index),
  title: card.name,
  sub: t(loc.value, 'forumViewTopics'),
  icon: card.icon || FORUM_BOARDS.find((board) => board.slug === card.slug)?.icon || 'note',
  tone: String((index % 4) + 1),
})
const exploreCards = computed(() => shownCategories.value.map(asExploreCard))
const subroomCards = computed(() => subrooms.value.map(asExploreCard))
const mosaicShots = computed(() =>
  (subroomCards.value.length ? subroomCards.value : exploreCards.value).slice(0, 4).map((card) => card.image),
)

function go(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function openLogin() {
  window.location.hash = 'login'
}

function syncAuth() {
  signedIn.value = isAuthed()
  const user = getCurrentApiAuth()?.user
  if (!signedIn.value || !user) {
    meName.value = ''
    mePhoto.value = ''
    return
  }
  meName.value = user.displayName || user.username || user.email || ''
  mePhoto.value = user.photoUrl || user.photoURL || ''
  getMe()
    .then((me) => {
      meName.value = me?.displayName || me?.username || meName.value
      mePhoto.value = me?.photoUrl || me?.photoURL || mePhoto.value
    })
    .catch(() => {})
}

function applySeo() {
  const title = activeTopic.value?.title || activeCategory.value?.name || t(loc.value, 'forumCommunity')
  applyNewsSeo({
    type: 'website',
    locale: loc.value,
    title: `${title} — Music Mundial`,
    description: activeCategory.value?.blurb || t(loc.value, 'forumLead'),
    path: props.post && props.board
      ? withLocale(`/forum/${props.board}/${props.post}`, loc.value)
      : props.board
        ? categoryHref(props.board)
        : forumHref.value,
    hreflangEn: withLocale(props.post && props.board ? `/forum/${props.board}/${props.post}` : props.board ? `/forum/${props.board}` : '/forum', 'en'),
    hreflangEs: withLocale(props.post && props.board ? `/forum/${props.board}/${props.post}` : props.board ? `/forum/${props.board}` : '/forum', 'es'),
  })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    if (view.value === 'thread' && props.post) {
      const payload = await getForumTopic(props.post, { page: page.value, locale: loc.value })
      activeTopic.value = payload.topic
      activeCategory.value = payload.topic?.category
        ? { slug: payload.topic.category.slug, name: payload.topic.category.name, blurb: '', icon: 'note', isVip: payload.topic.category.isVip }
        : null
      posts.value = payload.items || []
      total.value = payload.total || 0
    } else if (view.value === 'category' && props.board) {
      const payload = await getForumCategory(props.board, { page: page.value, sort: sort.value, q: search.value, locale: loc.value })
      activeCategory.value = payload.category
      topics.value = payload.items || []
      total.value = payload.total || 0
      const home = await getForumHome(loc.value)
      categories.value = home.categories || []
      popular.value = home.popular || []
      premium.value = home.premium || []
      stats.value = {
        members: Number(home.stats?.members || 0),
        posts: Number(payload.replies || 0) + Number(payload.total || 0),
        topics: Number(payload.total || 0),
        online: Number(home.stats?.online || 0),
      }
    } else if (view.value === 'compose') {
      const home = await getForumHome(loc.value)
      categories.value = home.categories || []
      draftBoard.value = draftBoard.value || home.categories?.[1]?.slug || 'kpop'
    } else {
      const home = await getForumHome(loc.value)
      categories.value = home.categories || []
      popular.value = home.popular || []
      premium.value = home.premium || []
      stats.value = {
        members: Number(home.stats?.members || 0),
        posts: Number(home.stats?.posts || 0),
        topics: Number(home.stats?.topics || 0),
        online: Number(home.stats?.online || 0),
      }
      activeCategory.value = null
      activeTopic.value = null
      const list =
        search.value.trim().length >= 2
          ? await searchForum(search.value.trim(), { page: page.value, locale: loc.value })
          : await getForumCategory('all', { page: page.value, sort: sort.value, locale: loc.value })
      topics.value = list.items || []
      total.value = list.total || 0
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : t(loc.value, 'forumMissing')
  } finally {
    loading.value = false
    applySeo()
  }
}

function startDiscussion() {
  if (!signedIn.value) {
    openLogin()
    return
  }
  if (activeCategory.value?.slug && activeCategory.value.slug !== 'all') {
    draftBoard.value = activeCategory.value.slug
  }
  go(newHref.value)
}

async function publishTopic() {
  composeError.value = ''
  if (!signedIn.value) {
    openLogin()
    return
  }
  if (draftTitle.value.trim().length < 8) {
    composeError.value = t(loc.value, 'forumNeedTitle')
    return
  }
  if (draftBody.value.trim().length < 12) {
    composeError.value = t(loc.value, 'forumNeedBody')
    return
  }
  sending.value = true
  try {
    const payload = await createForumTopic(
      {
        category: draftBoard.value,
        title: draftTitle.value.trim(),
        body: draftBody.value.trim(),
        images: draftImages.value,
      },
      loc.value,
    )
    draftTitle.value = ''
    draftBody.value = ''
    draftImages.value = []
    go(withLocale(payload.topic.href, loc.value))
  } catch (err) {
    composeError.value = err instanceof Error ? err.message : t(loc.value, 'forumNeedBody')
  } finally {
    sending.value = false
  }
}

async function publishReply() {
  replyError.value = ''
  if (!signedIn.value) {
    openLogin()
    return
  }
  if (!activeTopic.value || replyBody.value.trim().length < 2) {
    replyError.value = t(loc.value, 'forumNeedBody')
    return
  }
  sending.value = true
  try {
    const payload = await createForumPost(activeTopic.value.id, {
      body: replyBody.value.trim(),
      replyToPostId: replyTo.value?.id,
    })
    posts.value = [...posts.value, payload.post]
    replyBody.value = ''
    replyTo.value = null
    if (activeTopic.value) activeTopic.value.replyCount += 1
  } catch (err) {
    replyError.value = err instanceof Error ? err.message : t(loc.value, 'forumNeedBody')
  } finally {
    sending.value = false
  }
}

function onImages(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files || []).slice(0, 4)
  Promise.all(
    files.map(
      (file) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.readAsDataURL(file)
        }),
    ),
  ).then((rows) => {
    draftImages.value = rows.filter(Boolean).slice(0, 4)
  })
}

function shareTopic() {
  const url = window.location.href
  if (navigator.share) {
    void navigator.share({ title: activeTopic.value?.title || t(loc.value, 'navForum'), url })
    return
  }
  void navigator.clipboard?.writeText(url)
}

function runSearch() {
  page.value = 1
  if (view.value === 'home' || view.value === 'category') void load()
}

onMounted(() => {
  syncAuth()
  stopAuth = onStoredAuthChange(syncAuth)
  void load()
})
onUnmounted(() => stopAuth?.())
watch(() => [props.board, props.post, props.locale], () => {
  page.value = 1
  void load()
})
watch(sort, () => {
  page.value = 1
  if (view.value === 'category' || view.value === 'home') void load()
})
watch(page, () => {
  if (view.value !== 'compose') void load()
})
</script>

<template>
  <main class="forum-page forum-community">
    <div class="container">
      <header class="forum-hero">
        <nav v-if="view !== 'home'" class="crumbs" aria-label="breadcrumb">
          <a :href="withLocale('/', loc)">Music Mundial</a>
          <span class="crumbs-sep">›</span>
          <a v-if="view !== 'home'" :href="forumHref">{{ t(loc, 'navForum') }}</a>
          <span v-else class="crumbs-now">{{ t(loc, 'navForum') }}</span>
          <template v-if="activeCategory && view !== 'home'">
            <template v-if="activeCategory.parent">
              <span class="crumbs-sep">›</span>
              <a :href="categoryHref(activeCategory.parent.slug)">{{ activeCategory.parent.name }}</a>
            </template>
            <span class="crumbs-sep">›</span>
            <a v-if="view === 'thread'" :href="categoryHref(activeCategory.slug)">{{ activeCategory.name }}</a>
            <span v-else class="crumbs-now">{{ activeCategory.name }}</span>
          </template>
        </nav>
        <div v-if="view === 'home' || view === 'category'" class="forum-hero-grid">
          <div class="forum-hero-copy">
            <h1 v-if="view === 'category' && activeCategory">{{ activeCategory.name }}</h1>
            <h1 v-else>
              <em>{{ t(loc, 'forumTitleA') }}</em>
              {{ t(loc, 'forumTitleB') }}
              <span class="forum-spark" aria-hidden="true">✦</span>
            </h1>
            <p class="forum-lead">{{ view === 'category' && activeCategory ? activeCategory.blurb : t(loc, 'forumLead') }}</p>
            <ul class="forum-stats">
              <li>
                <span class="forum-stat-ico">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 19c.8-3 2.6-4.5 5-4.5S13.2 16 14 19" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="9" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 19c.4-2 1.5-3.2 3.2-3.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
                </span>
                <div>
                  <b>{{ compact(stats.members) }}</b>
                  <small>{{ t(loc, 'forumMembers') }}</small>
                </div>
              </li>
              <li>
                <span class="forum-stat-ico">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14v10H8l-3 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
                </span>
                <div>
                  <b>{{ compact(stats.posts) }}</b>
                  <small>{{ t(loc, 'forumPosts') }}</small>
                </div>
              </li>
              <li>
                <span class="forum-stat-ico">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v16l-5-3-5 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
                </span>
                <div>
                  <b>{{ compact(stats.topics) }}</b>
                  <small>{{ t(loc, 'forumTopics') }}</small>
                </div>
              </li>
              <li>
                <span class="forum-stat-ico live">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h3l2-5 3 10 2-5h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                <div>
                  <b>{{ compact(stats.online) }}</b>
                  <small>{{ t(loc, 'forumOnline') }}</small>
                </div>
              </li>
            </ul>
            <div class="forum-hero-actions">
              <button class="forum-btn solid" type="button" @click="startDiscussion">{{ t(loc, 'forumStart') }}</button>
              <a v-if="view === 'home'" class="forum-btn ghost" href="#foro-explore">{{ t(loc, 'forumExplore') }}</a>
              <a v-else class="forum-btn ghost" :href="forumHref">{{ t(loc, 'forumBack') }}</a>
              <label v-if="view === 'category'" class="forum-search">
                <input v-model="search" :placeholder="t(loc, 'forumSearchPh')" @keydown.enter.prevent="runSearch" />
              </label>
            </div>
          </div>
          <aside class="forum-startly">
            <div class="forum-startly-copy">
              <h2>{{ t(loc, 'forumStartlyTitle') }} <em>{{ t(loc, 'forumStartlyNew') }}</em></h2>
              <p>{{ t(loc, 'forumStartlyLead') }}</p>
              <div class="forum-startly-actions">
                <a class="forum-startly-go" :href="STARTLY_URL" target="_blank" rel="noreferrer">{{ t(loc, 'forumStartlyGo') }} <span aria-hidden="true">↗</span></a>
                <a class="forum-startly-more" :href="STARTLY_MORE" target="_blank" rel="noreferrer">{{ t(loc, 'forumStartlyMore') }}</a>
              </div>
              <small>{{ t(loc, 'forumStartlyNote') }}</small>
            </div>
            <svg class="forum-startly-star" viewBox="0 0 160 160" aria-hidden="true">
              <defs>
                <linearGradient id="starFill" x1="30" y1="10" x2="130" y2="150">
                  <stop offset="0%" stop-color="#c4b5fd"/>
                  <stop offset="45%" stop-color="#8b5cf6"/>
                  <stop offset="100%" stop-color="#6d28d9"/>
                </linearGradient>
              </defs>
              <path fill="url(#starFill)" d="M80 8 98 58h52l-42 31 16 51-44-30-44 30 16-51-42-31h52z"/>
              <ellipse cx="64" cy="78" rx="8" ry="10" fill="#1e1b4b"/>
              <ellipse cx="96" cy="78" rx="8" ry="10" fill="#1e1b4b"/>
              <circle cx="67" cy="75" r="2.4" fill="#fff"/>
              <circle cx="99" cy="75" r="2.4" fill="#fff"/>
              <path d="M68 98c8 10 16 10 24 0" fill="none" stroke="#1e1b4b" stroke-width="4" stroke-linecap="round"/>
            </svg>
          </aside>
        </div>
        <div v-else class="forum-hero-copy">
          <div class="cats-eyebrow">{{ t(loc, 'navForum') }}</div>
          <h1 v-if="view === 'thread' && activeTopic">{{ activeTopic.title }}</h1>
          <h1 v-else>{{ t(loc, 'forumNewTitle') }}</h1>
          <div class="forum-hero-actions">
            <button class="forum-btn solid" type="button" @click="startDiscussion">{{ t(loc, 'forumStart') }}</button>
            <a class="forum-btn ghost" :href="forumHref">{{ t(loc, 'forumBack') }}</a>
          </div>
        </div>
      </header>

      <p v-if="error" class="forum-empty-box">{{ error }}</p>
      <div v-else-if="loading" class="forum-loader" aria-live="polite">
        <div class="forum-loader-eq" aria-hidden="true">
          <i v-for="n in 12" :key="n" :style="{ '--d': `${(n % 6) * 90}ms` }"></i>
        </div>
        <p class="forum-loader-copy">{{ t(loc, 'forumLoading') }}</p>
        <div class="forum-loader-skel" aria-hidden="true">
          <div class="forum-explore-grid">
            <span v-for="n in 5" :key="n" class="forum-skel-board" :data-tone="String(n)"></span>
          </div>
          <div class="forum-skel-list">
            <span v-for="n in 4" :key="n" class="forum-skel-thread"></span>
          </div>
        </div>
      </div>

      <template v-else>
        <section v-if="view === 'home'" id="foro-explore" class="forum-explore">
          <div class="forum-explore-head">
            <h2>{{ t(loc, 'forumExplore') }}</h2>
            <label class="forum-search">
              <input v-model="search" :placeholder="t(loc, 'forumSearchPh')" @keydown.enter.prevent="runSearch" />
            </label>
          </div>
          <div class="forum-home-grid">
            <CatsCard v-for="card in exploreCards" :key="card.href" :card="card" />
          </div>
        </section>

        <section v-if="view === 'category' && subroomCards.length" class="forum-explore">
          <h2>{{ t(loc, 'forumSubrooms') }}</h2>
          <div class="forum-home-grid">
            <CatsCard v-for="card in subroomCards" :key="card.href" :card="card" />
          </div>
        </section>

        <div v-if="(view === 'home' || view === 'category') && !topics.length" class="forum-home-empty">
          <div class="forum-home-mosaic" aria-hidden="true">
            <img v-for="shot in mosaicShots" :key="shot" :src="shot" alt="" />
          </div>
          <div>
            <h3>{{ t(loc, 'forumHomeEmptyTitle') }}</h3>
            <p>{{ t(loc, 'forumEmpty') }}</p>
            <div class="forum-hero-actions">
              <button class="forum-btn solid" type="button" @click="startDiscussion">{{ t(loc, 'forumStart') }}</button>
              <a class="forum-btn ghost" :href="exploreCards[0]?.href || forumHref">{{ t(loc, 'forumExplore') }}</a>
            </div>
          </div>
        </div>

        <div v-if="view === 'compose' || view === 'thread' || topics.length" class="article-layout forum-layout forum-layout-in">
          <div>
          <section v-if="(view === 'home' || view === 'category') && topics.length" class="forum-card forum-threads">
            <div class="forum-threads-head">
              <h2>{{ view === 'category' ? activeCategory?.name : t(loc, 'forumLatest') }}</h2>
              <div class="forum-tabs">
                <button type="button" :class="{ on: sort === 'activity' }" @click="sort = 'activity'">{{ t(loc, 'forumSortActivity') }}</button>
                <button type="button" :class="{ on: sort === 'latest' }" @click="sort = 'latest'">{{ t(loc, 'forumSortLatest') }}</button>
                <button type="button" :class="{ on: sort === 'replies' }" @click="sort = 'replies'">{{ t(loc, 'forumSortReplies') }}</button>
                <button type="button" :class="{ on: sort === 'popular' }" @click="sort = 'popular'">{{ t(loc, 'forumSortPopular') }}</button>
              </div>
            </div>
            <a v-for="row in topics" :key="row.id" class="forum-thread" :href="topicHref(row)">
              <img v-if="row.author.photoUrl" class="forum-thread-avatar" :src="row.author.photoUrl" alt="" />
              <span v-else class="forum-thread-avatar">{{ row.author.displayName.slice(0, 1) }}</span>
              <div class="forum-thread-copy">
                <small>{{ row.category.name }}</small>
                <h3>{{ row.title }}</h3>
                <p>
                  {{ row.author.displayName }}
                  <span v-if="fanLabel(row.author.fanSku)" class="forum-fan" :class="fanTone(row.author.fanSku)">{{ fanLabel(row.author.fanSku) }}</span>
                  · {{ ago(row.createdAt) }}
                  <template v-if="row.lastPoster"> · {{ t(loc, 'forumLastActivity') }} {{ row.lastPoster.displayName }} · {{ ago(row.lastPostAt) }}</template>
                </p>
              </div>
              <div class="forum-thread-nums">
                <b>{{ compact(row.replyCount) }}</b>
                <span>{{ t(loc, 'forumReplies') }}</span>
              </div>
              <div class="forum-thread-nums">
                <b>{{ compact(row.viewCount) }}</b>
                <span>{{ t(loc, 'forumViews') }}</span>
              </div>
            </a>
            <div v-if="pages > 1" class="forum-pager">
              <button type="button" :disabled="page <= 1" @click="page -= 1">{{ t(loc, 'prev') }}</button>
              <span>{{ t(loc, 'forumPage') }} {{ page }}</span>
              <button type="button" :disabled="page >= pages" @click="page += 1">{{ t(loc, 'next') }}</button>
            </div>
          </section>

          <section v-if="view === 'compose'" class="forum-card forum-compose-form">
            <label>
              {{ t(loc, 'forumRoom') }}
              <select v-model="draftBoard">
                <option v-for="card in composeRooms" :key="card.slug" :value="card.slug">{{ card.name }}</option>
              </select>
            </label>
            <label>
              {{ t(loc, 'forumTitleLabel') }}
              <input v-model="draftTitle" maxlength="140" :placeholder="t(loc, 'forumTitlePh')" />
            </label>
            <label>
              {{ t(loc, 'forumBodyLabel') }}
              <textarea v-model="draftBody" rows="8" maxlength="8000" :placeholder="t(loc, 'forumBodyPh')"></textarea>
            </label>
            <label>
              {{ t(loc, 'forumAttach') }}
              <input type="file" accept="image/*" multiple @change="onImages" />
            </label>
            <div v-if="draftImages.length" class="forum-compose-shots">
              <img v-for="(shot, index) in draftImages" :key="index" :src="shot" alt="" />
            </div>
            <p v-if="composeError" class="forum-empty">{{ composeError }}</p>
            <button class="forum-btn solid" type="button" :disabled="sending" @click="publishTopic">{{ t(loc, 'forumPublish') }}</button>
          </section>

          <article v-if="view === 'thread'" class="forum-card forum-topic">
            <p v-if="!activeTopic" class="forum-empty-box">{{ t(loc, 'forumMissing') }}</p>
            <template v-else>
              <p class="forum-topic-meta">
                <a :href="categoryHref(activeTopic.category.slug)">{{ activeTopic.category.name }}</a>
                · {{ compact(activeTopic.replyCount) }} {{ t(loc, 'forumReplies').toLowerCase() }}
                · {{ compact(activeTopic.viewCount) }} {{ t(loc, 'forumViews').toLowerCase() }}
              </p>
              <section v-for="item in posts" :key="item.id" class="forum-post" :id="`p-${item.position}`" :class="{ op: item.position === 1 }">
                <a class="forum-post-num" :href="`${topicHref(activeTopic)}#p-${item.position}`">#{{ item.position }}</a>
                <a class="forum-post-person" :href="profileHref(item.author)">
                  <img v-if="item.author.photoUrl" :src="item.author.photoUrl" alt="" />
                  <span v-else class="forum-thread-avatar">{{ item.author.displayName.slice(0, 1) }}</span>
                  <strong>{{ item.author.displayName }}</strong>
                  <small v-if="item.author.username">@{{ item.author.username }}</small>
                  <span v-if="fanLabel(item.author.fanSku)" class="forum-fan" :class="fanTone(item.author.fanSku)">{{ fanLabel(item.author.fanSku) }}</span>
                </a>
                <time>{{ ago(item.createdAt) }}</time>
                <p v-if="item.replyToPostId" class="forum-quote-flag">{{ t(loc, 'forumQuote') }}</p>
                <p class="forum-post-body">{{ item.body }}</p>
                <img v-for="(shot, index) in item.images" :key="index" class="forum-post-shot" :src="shot" alt="" />
                <div class="forum-post-actions">
                  <button type="button" @click="replyTo = item">{{ t(loc, 'forumQuote') }}</button>
                  <button v-if="item.position === 1" type="button" @click="shareTopic">{{ t(loc, 'forumShare') }}</button>
                </div>
              </section>
              <div v-if="activeTopic.closed" class="forum-empty-box">{{ t(loc, 'forumClosed') }}</div>
              <form v-else-if="signedIn" class="forum-reply" @submit.prevent="publishReply">
                <p v-if="replyTo">{{ t(loc, 'forumQuote') }} #{{ replyTo.position }} · {{ replyTo.author.displayName }}</p>
                <textarea v-model="replyBody" rows="4" maxlength="8000" :placeholder="t(loc, 'forumReplyPh')"></textarea>
                <p v-if="replyError" class="forum-empty">{{ replyError }}</p>
                <button class="forum-btn solid" type="submit" :disabled="sending">{{ t(loc, 'forumReply') }}</button>
              </form>
              <p v-else class="article-comments-login">
                <button type="button" @click="openLogin">{{ t(loc, 'forumNeedLogin') }}</button>
              </p>
              <div v-if="pages > 1" class="forum-pager">
                <button type="button" :disabled="page <= 1" @click="page -= 1">{{ t(loc, 'prev') }}</button>
                <span>{{ t(loc, 'forumPage') }} {{ page }}</span>
                <button type="button" :disabled="page >= pages" @click="page += 1">{{ t(loc, 'next') }}</button>
              </div>
            </template>
          </article>
        </div>

        <aside class="forum-side">
          <section class="forum-card">
            <div class="forum-side-head">
              <h2>{{ t(loc, 'forumPremiumMembers') }}</h2>
            </div>
            <a v-for="person in premium" :key="person.id" class="forum-member" :href="profileHref(person)">
              <img v-if="person.photoUrl" :src="person.photoUrl" alt="" />
              <span v-else class="forum-thread-avatar">{{ person.displayName.slice(0, 1) }}</span>
              <div>
                <strong>{{ person.displayName }}</strong>
                <small v-if="fanLabel(person.fanSku)" class="forum-fan" :class="fanTone(person.fanSku)">{{ fanLabel(person.fanSku) }}</small>
              </div>
            </a>
            <p v-if="!premium.length" class="forum-empty">{{ t(loc, 'forumNoLast') }}</p>
          </section>
          <section v-if="popular.length" class="forum-card">
            <div class="forum-side-head">
              <h2>{{ t(loc, 'forumTrending') }}</h2>
            </div>
            <a v-for="(item, index) in popular" :key="item.id" class="forum-trend-row" :href="topicHref(item)">
              <span>{{ index + 1 }}</span>
              <div>
                <strong>{{ item.title }}</strong>
                <small>{{ compact(item.replyCount) }} {{ t(loc, 'forumReplies').toLowerCase() }}</small>
              </div>
            </a>
          </section>
          <aside v-if="view !== 'home' && view !== 'category'" class="forum-startly">
            <h2>{{ t(loc, 'forumStartlyTitle') }} <em>{{ t(loc, 'forumStartlyNew') }}</em></h2>
            <p>{{ t(loc, 'forumStartlyLead') }}</p>
            <div class="forum-startly-actions">
              <a class="forum-startly-go" :href="STARTLY_URL" target="_blank" rel="noreferrer">{{ t(loc, 'forumStartlyGo') }}</a>
              <a class="forum-startly-more" :href="STARTLY_MORE" target="_blank" rel="noreferrer">{{ t(loc, 'forumStartlyMore') }}</a>
            </div>
            <small>{{ t(loc, 'forumStartlyNote') }}</small>
          </aside>
        </aside>
        </div>
      </template>
    </div>
  </main>
</template>
