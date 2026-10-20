<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AuthDialog from './components/AuthDialog.vue'
import CatsCard from './components/CatsCard.vue'
import NewsArticle from './components/NewsArticle.vue'
import NewsCategoriesPage from './components/NewsCategoriesPage.vue'
import NewsCategoryPage from './components/NewsCategoryPage.vue'
import { getNewsHome, getNewsPosts } from '../../src/services/api/newsApi'
import { t, type CopyKey } from './lib/copy'
import { coverOf, formatNewsDate, parseNewsPage, toCategoryCard, type NewsCard, type NewsPage } from './lib/news'
import { ensureLocalePath, localeFromPath, withLocale, type SiteLocale } from './lib/locale'
import { getTheme, toggleTheme as flipTheme, type SiteTheme } from './lib/theme'
import { getCurrentApiAuth, getMe, logout } from '../../src/services/api/authApi'
import { onStoredAuthChange } from '../../src/services/api/client'
import { getNotifications } from '../../src/services/api/notificationsApi'
import {
  getNotificationBody,
  getNotificationTitle,
  shouldDisplayNotification,
} from '../../src/utils/notificationDisplay'
import { storyTags, type Story } from './data/home'

const menuOpen = ref(false)
const noticesOpen = ref(false)
const searchOpen = ref(false)
const searchQuery = ref('')
const searchHits = ref<NewsCard[]>([])
const searchLoading = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null
const slide = ref(0)
const catPage = ref(0)
const catSize = ref(4)
const newsPage = ref<NewsPage>(parseNewsPage())
const homeReady = ref(false)
const homeFeedLocale = ref<SiteLocale | null>(null)
const enEmpty = ref(false)
let homeRequest = 0
const emptyStory = (): Story => ({ category: '', title: '', image: '/images/teach-you.jpg', alt: '', meta: '' })

const siteLocale = computed(() => newsPage.value.locale || localeFromPath())
const theme = ref<SiteTheme>(getTheme())

function setSiteTheme() {
  flipTheme()
  theme.value = getTheme()
}

function txt(key: CopyKey) {
  return t(siteLocale.value, key)
}

function loc(path: string) {
  return withLocale(path, siteLocale.value)
}

function postHref(item?: { href?: string } | null, fallback = '/') {
  const href = item?.href || fallback
  const first = href.split('/').filter(Boolean)[0]
  if (first === 'es' || first === 'en') return href
  return withLocale(href, siteLocale.value)
}

function setLocale(next: SiteLocale) {
  if (next === siteLocale.value && newsPage.value.name === 'home') return
  closeMenu()
  closePops()
  searchHits.value = []
  searchQuery.value = ''
  if (newsPage.value.locale !== next) {
    homeReady.value = false
    enEmpty.value = false
    clearHomeFeed()
  }
  window.history.pushState({}, '', `/${next}`)
  syncNewsPage()
}

function onNewsClick(event: MouseEvent) {
  const link = (event.target as HTMLElement | null)?.closest?.('a')
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
  const href = link.getAttribute('href') || ''
  if (!href || href.includes('#') || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return
  if (href.startsWith('/vote') || href.startsWith('/api')) return
  event.preventDefault()
  const first = href.split('/').filter(Boolean)[0]
  const next = first === 'es' || first === 'en' ? href.split('?')[0] : withLocale(href, siteLocale.value)
  closeMenu()
  if (window.location.pathname === next) return
  window.history.pushState({}, '', next)
  syncNewsPage()
}

function closePops() {
  noticesOpen.value = false
  accountOpen.value = false
  searchOpen.value = false
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target?.closest('.icon-pop')) closePops()
  onNewsClick(event)
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closePops()
}

function asStory(post: NewsCard, fallbackImage: string): Story {
  const tags = (post.categories?.map((item) => item.name).filter(Boolean) || [post.category]).slice(0, 4)
  return {
    category: post.category,
    title: post.title,
    image: coverOf(post, fallbackImage),
    alt: post.title,
    meta: formatNewsDate(post.publishedAt, siteLocale.value),
    lead: post.excerpt,
    href: post.href,
    tags,
  }
}

function clearHomeFeed() {
  slides.value = []
  homeCards.value = []
  trends.value = []
  entertainmentStories.value = []
  kpopFeatureStories.value = []
  kpopMoreStories.value = []
  moreStories.value = []
  screenLeadStory.value = emptyStory()
  screenSideStories.value = []
  popStories.value = []
  socialStories.value = []
  interviewStories.value = []
  categories.value = []
  homeFeedLocale.value = null
}

async function loadHomeFeed() {
  if (newsPage.value.name !== 'home') return
  const locale = newsPage.value.locale
  if (homeFeedLocale.value === locale && homeReady.value) return
  const request = ++homeRequest
  try {
    const feed = await getNewsHome(locale)
    if (request !== homeRequest || newsPage.value.locale !== locale) return
    const fromFeed = locale
    enEmpty.value = locale === 'en' && !feed?.spotlight?.length
    slides.value = (feed?.spotlight || []).map((post: NewsCard) => ({
      tag: post.category,
      title: post.title,
      text: post.excerpt,
      date: formatNewsDate(post.publishedAt, fromFeed),
      image: coverOf(post, '/images/jungkook-hero.jpg'),
      alt: post.title,
      href: post.href,
    }))
    slide.value = 0
    homeCards.value = (feed?.cards || []).map((post: NewsCard) => ({
      tags: (post.categories?.map((item) => item.name).filter(Boolean).slice(0, 2).length
        ? post.categories.map((item) => item.name).slice(0, 2)
        : [post.category]),
      title: post.title,
      date: formatNewsDate(post.publishedAt, fromFeed),
      image: coverOf(post),
      alt: post.title,
      href: post.href,
    }))
    trends.value = (feed?.trends || []).map((post: NewsCard) => ({
      tag: post.category,
      title: post.title,
      date: formatNewsDate(post.publishedAt, fromFeed),
      image: coverOf(post),
      alt: post.title,
      href: post.href,
    }))
    entertainmentStories.value = (feed?.entertainment || []).map((post: NewsCard) => asStory(post, '/images/stray-kids-grammy.jpg'))
    kpopFeatureStories.value = (feed?.kpop || []).slice(0, 3).map((post: NewsCard) => asStory(post, '/images/jungkook-hero.jpg'))
    kpopMoreStories.value = (feed?.kpop || []).slice(3, 6).map((post: NewsCard) => asStory(post, '/images/jungkook-hero.jpg'))
    moreStories.value = (feed?.more || []).map((post: NewsCard) => asStory(post, '/images/katseye.jpg'))
    screenLeadStory.value = feed?.series?.[0]
      ? asStory(feed.series[0], '/images/teach-you.jpg')
      : { category: '', title: '', image: '/images/teach-you.jpg', alt: '', meta: '' }
    screenSideStories.value = (feed?.series || []).slice(1, 5).map((post: NewsCard) => asStory(post, '/images/screen-euphoria.jpg'))
    popStories.value = (feed?.pop || []).map((post: NewsCard) => asStory(post, '/images/taylor-swift.jpg'))
    socialStories.value = (feed?.social || []).map((post: NewsCard) => asStory(post, '/images/katseye.jpg'))
    interviewStories.value = (feed?.interviews || []).map((post: NewsCard) => asStory(post, '/images/rm-museo.webp'))
    categories.value = (feed?.categories || [])
      .filter((row: { slug?: string; postCount?: number }) => Number(row.postCount || 0) > 0)
      .sort((a: { nav?: boolean }, b: { nav?: boolean }) => Number(Boolean(b.nav)) - Number(Boolean(a.nav)))
      .slice(0, 12)
      .map((row: { slug: string; name: string; href?: string; coverUrl?: string | null; postCount?: number }, index: number) =>
        toCategoryCard(row, index, fromFeed),
      )
    homeFeedLocale.value = locale
  } catch {
    if (request !== homeRequest) return
    clearHomeFeed()
    homeFeedLocale.value = locale
    enEmpty.value = locale === 'en'
  } finally {
    if (request === homeRequest) {
      homeReady.value = true
      await nextTick()
      bindRise()
    }
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

function syncNewsPage(opts?: { keepScroll?: boolean }) {
  ensureLocalePath()
  newsPage.value = parseNewsPage()
  document.documentElement.lang = newsPage.value.locale
  document.title = newsPage.value.locale === 'en' ? 'Music Mundial — Entertainment news' : 'Music Mundial — Cultura y entretenimiento'
  if (!opts?.keepScroll) scrollToTop()
  if (newsPage.value.name === 'home') loadHomeFeed()
}

const slides = ref<Array<{
  tag: string
  title: string
  text: string
  date: string
  image: string
  alt: string
  href?: string
}>>([])
const currentSlide = computed(() => slides.value[slide.value] || slides.value[0]!)
const categories = ref<Array<{ href: string; image: string; title: string; sub: string; icon: string; tone: string }>>([])

const catPages = computed(() => {
  const pages = []
  const list = categories.value
  for (let i = 0; i < list.length; i += catSize.value) pages.push(list.slice(i, i + catSize.value))
  return pages
})

let slideTimer: ReturnType<typeof setInterval> | null = null
let catTimer: ReturnType<typeof setInterval> | null = null
let revealObserver: IntersectionObserver | null = null

function stopSlides() {
  if (slideTimer) clearInterval(slideTimer)
  slideTimer = null
}

function startSlides() {
  stopSlides()
  slideTimer = setInterval(() => stepSlide(1), 6500)
}

function stepSlide(direction: number, manual = false) {
  if (!slides.value.length) return
  slide.value = (slide.value + direction + slides.value.length) % slides.value.length
  if (manual) startSlides()
}

function syncCatSize() {
  const width = window.innerWidth
  catSize.value = width <= 720 ? 1 : width <= 980 ? 2 : 4
  if (catPage.value >= catPages.value.length) catPage.value = 0
}

function stopCats() {
  if (catTimer) clearInterval(catTimer)
  catTimer = null
}

function startCats() {
  stopCats()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  catTimer = setInterval(() => stepCats(1), 5200)
}

function stepCats(direction: number, manual = false) {
  const total = catPages.value.length
  if (!total) return
  catPage.value = (catPage.value + direction + total) % total
  if (manual) startCats()
}

function bindRise() {
  const nodes = document.querySelectorAll('.rise:not(.shown)')
  if (!nodes.length) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !revealObserver) {
    nodes.forEach((el) => el.classList.add('shown'))
    return
  }
  nodes.forEach((el) => revealObserver?.observe(el))
  window.setTimeout(() => {
    document.querySelectorAll('.home .rise:not(.shown)').forEach((el) => el.classList.add('shown'))
  }, 250)
}

function onPopState() {
  syncNewsPage({ keepScroll: true })
}

onMounted(() => {
  startSlides()
  syncCatSize()
  startCats()
  syncNewsPage({ keepScroll: true })
  window.addEventListener('resize', syncCatSize)
  window.addEventListener('popstate', onPopState)
  document.addEventListener('click', onDocumentClick)
  window.addEventListener('keydown', onDocumentKeydown)
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('shown')
      revealObserver?.unobserve(entry.target)
    })
  }, { threshold: 0.08 })
  bindRise()
})

watch(
  () => [newsPage.value.name, homeReady.value, homeFeedLocale.value] as const,
  async ([name, ready]) => {
    if (name !== 'home' || !ready) return
    await nextTick()
    bindRise()
  },
)
onUnmounted(() => {
  stopSlides()
  stopCats()
  window.removeEventListener('resize', syncCatSize)
  window.removeEventListener('popstate', onPopState)
  document.removeEventListener('click', onDocumentClick)
  window.removeEventListener('keydown', onDocumentKeydown)
  revealObserver?.disconnect()
})

const homeCards = ref<Array<{ tags: string[]; title: string; date: string; image: string; alt: string; href?: string }>>([])
const trends = ref<Array<{ tag: string; title: string; date: string; image: string; alt: string; href?: string }>>([])
const entertainmentStories = ref<Story[]>([])
const kpopFeatureStories = ref<Story[]>([])
const kpopMoreStories = ref<Story[]>([])
const moreStories = ref<Story[]>([])
const screenLeadStory = ref<Story>(emptyStory())
const screenSideStories = ref<Story[]>([])
const popStories = ref<Story[]>([])
const socialStories = ref<Story[]>([])
const interviewStories = ref<Story[]>([])

const readBlocks = computed(() => [
  { title: txt('social'), icon: 'social', items: socialStories.value },
  { title: txt('interviews'), icon: 'mic', items: interviewStories.value },
])

function visible(_story: Story) {
  return true
}

const eqBars = Array.from({ length: 72 }, (_, i) => ({
  h: `${18 + Math.round((Math.sin(i * 0.45) + 1) * 25 + ((i * 17) % 28))}px`,
  d: `${0.7 + ((i * 13) % 18) / 10}s`,
  delay: `${-((i * 7) % 30) / 10}s`,
}))

const inbox = ref<Array<Record<string, any>>>([])

const notices = computed(() => inbox.value.filter(shouldDisplayNotification))
const unreadCount = computed(() => notices.value.filter((item) => !item.readAt).length)

function noticeTitle(item: Record<string, any>) {
  return getNotificationTitle(item) || getNotificationBody(item) || 'Notificación'
}

function noticeTime(item: Record<string, any>) {
  const value = item.createdAt || item.created_at
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function noticeHref(item: Record<string, any>) {
  const url = item?.payload?.url
  if (typeof url === 'string' && url.trim()) return url
  return '/vote/notificaciones'
}

async function loadInbox() {
  if (!isSignedIn.value) {
    inbox.value = []
    noticesOpen.value = false
    return
  }
  try {
    inbox.value = await getNotifications(40)
  } catch {
    inbox.value = []
  }
}

function toggleNotices() {
  noticesOpen.value = !noticesOpen.value
  accountOpen.value = false
  searchOpen.value = false
  if (noticesOpen.value) loadInbox()
}

async function runSearch(query: string) {
  const q = query.trim()
  if (q.length < 2) {
    searchHits.value = []
    searchLoading.value = false
    return
  }
  searchLoading.value = true
  try {
    const payload = await getNewsPosts({ page: 1, limit: 8, q, locale: siteLocale.value })
    if (searchQuery.value.trim() !== q) return
    searchHits.value = payload.items || []
  } catch {
    if (searchQuery.value.trim() === q) searchHits.value = []
  } finally {
    if (searchQuery.value.trim() === q) searchLoading.value = false
  }
}

function toggleSearch() {
  searchOpen.value = !searchOpen.value
  noticesOpen.value = false
  accountOpen.value = false
  if (searchOpen.value) {
    nextTick(() => searchInput.value?.focus())
  } else {
    searchQuery.value = ''
    searchHits.value = []
  }
}

watch(searchQuery, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  const q = value.trim()
  if (q.length < 2) {
    searchHits.value = []
    searchLoading.value = false
    return
  }
  searchLoading.value = true
  searchTimer = setTimeout(() => runSearch(q), 280)
})

function closeMenu() {
  menuOpen.value = false
}

type AuthUser = {
  username?: string
  displayName?: string
  email?: string
  photoUrl?: string
  photoURL?: string
  role?: string
} | null

const currentUser = ref<AuthUser>(null)
const authOpen = ref(false)
const authMode = ref<'login' | 'register'>('login')
const accountOpen = ref(false)
const avatarFailed = ref(false)
let stopAuthWatch: (() => void) | null = null

const isSignedIn = computed(() => Boolean(currentUser.value))
const userInitial = computed(() => {
  const name = currentUser.value?.displayName || currentUser.value?.username || currentUser.value?.email || 'M'
  return String(name).trim().charAt(0).toUpperCase() || 'M'
})
const userLabel = computed(
  () => currentUser.value?.displayName || currentUser.value?.username || currentUser.value?.email || txt('account'),
)
const avatarSrc = computed(() => currentUser.value?.photoUrl || currentUser.value?.photoURL || '')

function openAuth(mode: 'login' | 'register') {
  authMode.value = mode
  authOpen.value = true
  accountOpen.value = false
  closeMenu()
}

function closeAuth() {
  authOpen.value = false
  const hash = window.location.hash.replace('#', '').toLowerCase()
  if (hash === 'login' || hash === 'iniciar-sesion' || hash === 'registro' || hash === 'register') {
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`)
  }
}

function openAuthFromHash() {
  const hash = window.location.hash.replace('#', '').toLowerCase()
  if (hash === 'login' || hash === 'iniciar-sesion') openAuth('login')
  if (hash === 'registro' || hash === 'register') openAuth('register')
}

function toggleAccount() {
  accountOpen.value = !accountOpen.value
  noticesOpen.value = false
  searchOpen.value = false
}

function handleLogout() {
  logout()
  accountOpen.value = false
  noticesOpen.value = false
  inbox.value = []
}

function syncAuth(authState = getCurrentApiAuth()) {
  const user = authState?.user && !authState.user.isAnonymous ? authState.user : null
  currentUser.value = user
  avatarFailed.value = false
  accountOpen.value = false
  if (!user) {
    inbox.value = []
    noticesOpen.value = false
    return
  }
  getMe()
    .then((fresh: AuthUser) => {
      if (fresh && currentUser.value) currentUser.value = { ...currentUser.value, ...fresh }
    })
    .catch(() => {})
  loadInbox()
}

onMounted(() => {
  syncAuth()
  stopAuthWatch = onStoredAuthChange(syncAuth)
  openAuthFromHash()
  window.addEventListener('hashchange', openAuthFromHash)
})

onUnmounted(() => {
  stopAuthWatch?.()
  window.removeEventListener('hashchange', openAuthFromHash)
})
</script>

<template>
  <header class="site-header">
    <div class="container head-inner">
      <a :href="loc('/')" class="brand" @click="closeMenu">
        <img class="brand-logo-light" src="/images/logo.webp" alt="Music Mundial" />
        <img class="brand-logo-dark" src="/images/logo-dark.webp" alt="Music Mundial" />
      </a>
      <nav id="nav" class="nav" :class="{ open: menuOpen }">
        <div class="nav-toolbar">
          <div class="nav-toolbar-row">
            <div class="lang-switch" role="group" :aria-label="txt('lang')">
              <a :class="{ on: siteLocale === 'es' }" href="/es" @click.prevent="setLocale('es')">ES</a>
              <a :class="{ on: siteLocale === 'en' }" href="/en" @click.prevent="setLocale('en')">EN</a>
            </div>
            <button
              class="round theme-toggle"
              type="button"
              :title="theme === 'dark' ? txt('themeLight') : txt('themeDark')"
              :aria-label="theme === 'dark' ? txt('themeLight') : txt('themeDark')"
              @click="setSiteTheme"
            >
              <svg v-if="theme === 'dark'" class="icon-sun" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
              </svg>
              <svg v-else class="icon-moon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16.2 13.2A6.2 6.2 0 0 1 11 5.2 6.4 6.4 0 1 0 18.8 15a6.2 6.2 0 0 1-2.6-1.8z" />
              </svg>
            </button>
          </div>
          <label class="search-box">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16.2 16.2 21 21" />
            </svg>
            <input
              v-model="searchQuery"
              type="search"
              :placeholder="txt('searchPlaceholder')"
              autocomplete="off"
            />
          </label>
          <p v-if="searchLoading" class="search-status">{{ txt('searching') }}</p>
          <p v-else-if="searchQuery.trim().length >= 2 && !searchHits.length" class="search-status">{{ txt('searchNone') }}</p>
          <a
            v-for="item in searchHits"
            :key="'nav-' + item.id"
            class="search-hit"
            :href="item.href"
            @click="closeMenu()"
          >
            <img :src="coverOf(item)" :alt="item.title" />
            <div>
              <small>{{ item.category }}</small>
              <h3>{{ item.title }}</h3>
            </div>
          </a>
        </div>
        <a :class="{ active: newsPage.name === 'home' }" :href="loc('/')" @click="closeMenu">{{ txt('navHome') }}</a>
        <a :class="{ active: newsPage.name === 'category' && newsPage.slug === 'kpop' }" :href="loc('/kpop')" @click="closeMenu">KPOP</a>
        <a :href="loc('/categoria/viral')" @click="closeMenu">{{ txt('navEntertainment') }}</a>
        <a :href="loc('/celebridades')" @click="closeMenu">{{ txt('navPopular') }}</a>
        <a :href="loc('/series')" @click="closeMenu">{{ txt('navSeries') }}</a>
        <a href="/vote/" @click="closeMenu">{{ txt('navVote') }}</a>
        <template v-if="!isSignedIn">
          <button class="nav-auth" type="button" @click="openAuth('login')">{{ txt('navLogin') }}</button>
          <button class="nav-auth nav-auth-solid" type="button" @click="openAuth('register')">{{ txt('navRegister') }}</button>
        </template>
        <template v-else>
          <a class="nav-auth" href="/vote/perfil" @click="closeMenu">{{ txt('navProfile') }}</a>
          <button class="nav-auth" type="button" @click="handleLogout">{{ txt('navLogout') }}</button>
        </template>
      </nav>
      <div class="actions">
        <div class="lang-switch" role="group" :aria-label="txt('lang')">
          <a :class="{ on: siteLocale === 'es' }" href="/es" @click.prevent="setLocale('es')">ES</a>
          <a :class="{ on: siteLocale === 'en' }" href="/en" @click.prevent="setLocale('en')">EN</a>
        </div>
        <button
          class="round theme-toggle"
          type="button"
          :title="theme === 'dark' ? txt('themeLight') : txt('themeDark')"
          :aria-label="theme === 'dark' ? txt('themeLight') : txt('themeDark')"
          @click="setSiteTheme"
        >
          <svg v-if="theme === 'dark'" class="icon-sun" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
          </svg>
          <svg v-else class="icon-moon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16.2 13.2A6.2 6.2 0 0 1 11 5.2 6.4 6.4 0 1 0 18.8 15a6.2 6.2 0 0 1-2.6-1.8z" />
          </svg>
        </button>
        <div class="icon-pop search-slot">
          <button
            class="round"
            type="button"
            :aria-label="txt('search')"
            :aria-expanded="searchOpen"
            @click="toggleSearch"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16.2 16.2 21 21" />
            </svg>
          </button>
          <div v-if="searchOpen" class="pop-panel search-pop">
            <label class="search-box">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16.2 16.2 21 21" />
              </svg>
              <input
                ref="searchInput"
                v-model="searchQuery"
                type="search"
                :placeholder="txt('searchPlaceholder')"
                autocomplete="off"
              />
            </label>
            <p v-if="searchLoading" class="search-status">{{ txt('searching') }}</p>
            <p v-else-if="searchQuery.trim().length < 2" class="search-status">{{ txt('searchEmpty') }}</p>
            <p v-else-if="!searchHits.length" class="search-status">{{ txt('searchNone') }}</p>
            <a
              v-for="item in searchHits"
              :key="item.id"
              class="search-hit"
              :href="item.href"
              @click="searchOpen = false"
            >
              <img :src="coverOf(item)" :alt="item.title" />
              <div>
                <small>{{ item.category }}</small>
                <h3>{{ item.title }}</h3>
              </div>
            </a>
          </div>
        </div>
        <div v-if="isSignedIn && notices.length" class="icon-pop">
          <button
            class="round"
            type="button"
            :aria-label="txt('notices')"
            :aria-expanded="noticesOpen"
            @click="toggleNotices"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
              <path d="M10 20a2 2 0 0 0 4 0" />
            </svg>
            <span v-if="unreadCount" class="badge">{{ unreadCount }}</span>
          </button>
          <div v-if="noticesOpen" class="pop-panel notices-pop">
            <div class="notice-head">
              <strong>{{ txt('notices') }}</strong>
              <a href="/vote/notificaciones" @click="noticesOpen = false">{{ txt('seeMore') }}</a>
            </div>
            <a
              v-for="item in notices.slice(0, 4)"
              :key="item.id"
              class="notice-row notice-row-text"
              :href="noticeHref(item)"
              @click="noticesOpen = false"
            >
              <div>
                <h3>{{ noticeTitle(item) }}</h3>
                <time>{{ noticeTime(item) }}</time>
              </div>
            </a>
          </div>
        </div>
        <div v-if="!isSignedIn" class="auth-links">
          <button class="auth-login" type="button" @click="openAuth('login')">{{ txt('navLogin') }}</button>
          <button class="auth-register" type="button" @click="openAuth('register')">{{ txt('navRegister') }}</button>
        </div>
        <div v-if="isSignedIn" class="icon-pop">
          <button
            class="avatar"
            type="button"
            :aria-label="userLabel"
            :aria-expanded="accountOpen"
            @click="toggleAccount"
          >
            <img
              v-if="avatarSrc && !avatarFailed"
              :src="avatarSrc"
              alt=""
              referrerpolicy="no-referrer"
              @error="avatarFailed = true"
            />
            <span v-else>{{ userInitial }}</span>
          </button>
          <div v-if="accountOpen" class="pop-panel account-pop">
            <p class="account-name">{{ userLabel }}</p>
            <a href="/vote/perfil" @click="accountOpen = false">{{ txt('navProfile') }}</a>
            <a href="/vote/perfil/configuracion" @click="accountOpen = false">{{ txt('navSettings') }}</a>
            <a href="/vote/" @click="accountOpen = false">{{ txt('navVote') }}</a>
            <button type="button" @click="handleLogout">{{ txt('navLogout') }}</button>
          </div>
        </div>
        <button
          class="round mobile-toggle"
          type="button"
          :aria-label="txt('menu')"
          @click="menuOpen = !menuOpen; if (menuOpen) closePops()"
        >
          ☰
        </button>
      </div>
    </div>
  </header>

  <NewsArticle v-if="newsPage.name === 'article'" :slug="newsPage.slug" :locale="newsPage.locale" />
  <NewsCategoriesPage v-else-if="newsPage.name === 'categories'" :locale="newsPage.locale" />
  <NewsCategoryPage v-else-if="newsPage.name === 'category'" :slug="newsPage.slug" :locale="newsPage.locale" />
  <main v-else-if="siteLocale === 'en' && enEmpty && homeReady" id="inicio" class="home">
    <div class="container article-wrap">
      <p class="article-status">
        English content is not loaded yet. The site is running in Spanish for now.
        <a href="/es" @click.prevent="setLocale('es')">Ver en español</a>
      </p>
    </div>
  </main>
  <main v-else id="inicio" class="home">
    <div v-if="!homeReady && !slides.length && !homeCards.length" class="container home-grid" aria-live="polite">
      <article class="home-boot-spot">
        <div class="home-boot-copy">
          <div class="article-loader-eq" aria-hidden="true">
            <i v-for="n in 14" :key="n" :style="{ '--d': `${(n % 7) * 80}ms` }"></i>
          </div>
          <p class="article-loader-copy">{{ txt('loadingHome') }}</p>
          <span class="skel skel-chip"></span>
          <span class="skel skel-title"></span>
          <span class="skel skel-title two"></span>
          <span class="skel skel-meta"></span>
          <span class="skel home-boot-btn"></span>
        </div>
      </article>
      <div class="home-cards">
        <div v-for="n in 3" :key="'home-skel-' + n" class="mini-card">
          <div class="mini-card-photo skel"></div>
          <span class="skel skel-line home-boot-line"></span>
          <span class="skel skel-meta home-boot-meta"></span>
        </div>
      </div>
      <section class="entertain home-boot-ent">
        <div class="entertain-head">
          <span class="skel skel-title two"></span>
          <span class="skel skel-meta"></span>
        </div>
        <div class="entertain-grid">
          <div class="entertain-feature skel"></div>
          <div class="entertain-side">
            <div v-for="n in 3" :key="'ent-skel-' + n" class="home-boot-side">
              <span class="skel home-boot-thumb"></span>
              <div>
                <span class="skel skel-line"></span>
                <span class="skel skel-meta"></span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <aside class="home-rail">
        <section class="trend-card">
          <div class="trend-head">
            <span class="skel home-boot-head"></span>
            <span class="skel skel-meta"></span>
          </div>
          <div v-for="n in 5" :key="'trend-skel-' + n" class="trend-row home-boot-trend">
            <span class="skel"></span>
            <span class="skel"></span>
            <div>
              <span class="skel skel-line"></span>
              <span class="skel skel-meta"></span>
            </div>
          </div>
        </section>
        <section class="spotify-band home-boot-spotify skel"></section>
      </aside>
    </div>
    <template v-else>
    <div class="container home-grid">
        <article v-if="currentSlide" class="spotlight rise" @mouseenter="stopSlides" @mouseleave="startSlides">
          <img :key="slide" :src="currentSlide.image" :alt="currentSlide.alt" />
          <div :key="slide" class="spotlight-copy">
            <span class="chip">{{ currentSlide.tag }}</span>
            <h1>{{ currentSlide.title }}</h1>
            <p>{{ currentSlide.text }}</p>
            <time>{{ currentSlide.date }}</time>
            <a class="read-btn" :href="postHref(currentSlide, '/kpop')">{{ txt('readStory') }}</a>
          </div>
          <div class="spotlight-nav">
            <button type="button" :aria-label="txt('prev')" @click="stepSlide(-1, true)">‹</button>
            <span v-for="(_, index) in slides" :key="index" :class="{ on: index === slide }"></span>
            <button type="button" :aria-label="txt('next')" @click="stepSlide(1, true)">›</button>
          </div>
        </article>

        <div class="home-cards rise">
          <a v-for="card in homeCards" :key="card.title" class="mini-card" :href="postHref(card)">
            <div class="mini-card-photo">
              <img :src="card.image" :alt="card.alt" />
              <span class="tag-row">
                <span v-for="tag in card.tags" :key="tag" class="pill">{{ tag }}</span>
              </span>
            </div>
            <h2>{{ card.title }}</h2>
            <time>{{ card.date }}</time>
          </a>
        </div>

        <section class="entertain rise" id="dramas">
          <div class="entertain-head cats-head">
            <div>
              <div class="cats-eyebrow">{{ txt('explore') }}</div>
              <h2><span>{{ txt('entertainment') }}</span></h2>
              <p>{{ txt('entertainmentBlurb') }}</p>
            </div>
            <a class="cats-link" :href="loc('/categoria/viral')">{{ txt('seeMoreArrow') }}</a>
          </div>
          <div v-if="entertainmentStories[0]" class="entertain-grid">
            <a class="entertain-feature" :href="postHref(entertainmentStories[0])">
              <img :src="entertainmentStories[0].image" :alt="entertainmentStories[0].alt" />
              <span class="etag">{{ entertainmentStories[0].category }}</span>
              <div>
                <h3>{{ entertainmentStories[0].title }}</h3>
                <p>{{ entertainmentStories[0].lead }}</p>
                <time>{{ entertainmentStories[0].meta }}</time>
              </div>
            </a>
            <div class="entertain-side">
              <a v-for="story in entertainmentStories.slice(1, 4)" :key="story.title" :href="postHref(story)">
                <img :src="story.image" :alt="story.alt" />
                <div>
                  <span class="etag" :class="story.category.toLowerCase()">{{ story.category }}</span>
                  <h3>{{ story.title }}</h3>
                  <time>{{ story.meta }}</time>
                </div>
              </a>
            </div>
          </div>
        </section>

      <aside class="home-rail rise">
      <section class="trend-card">
          <div class="trend-head">
            <h2>
              <svg class="flame" viewBox="0 0 16 20" aria-hidden="true">
                <path d="M8.1.2c.5 3.4-1.8 5.2-2.9 7.4-.7-.8-1-2-1-2C2.5 7.4 1 9.7 1 12.4 1 16.2 4.1 19.2 8 19.2s7-3 7-6.8c0-3.5-2.3-6-3.7-8-.2 1.8-1.1 3-2.1 3.3.6-2.2 1-4.8-1.1-7.5z" />
              </svg>
              {{ txt('trends') }}
            </h2>
            <a :href="loc('/viral')">{{ txt('seeAllArrow') }}</a>
          </div>
          <a v-for="(item, index) in trends" :key="item.title" class="trend-row" :href="postHref(item)">
            <span>{{ index + 1 }}</span>
            <img :src="item.image" :alt="item.alt" />
            <div>
              <small :class="item.tag.toLowerCase()">{{ item.tag }}</small>
              <h3>{{ item.title }}</h3>
              <time>{{ item.date }}</time>
            </div>
          </a>
        </section>
        <section class="spotify-band">
          <iframe
            data-testid="embed-iframe"
            :title="txt('spotifyTitle')"
            src="https://open.spotify.com/embed/playlist/37i9dQZEVXbMDoHDwVN2tF?utm_source=generator"
            width="100%"
            height="100%"
            frameborder="0"
            allowfullscreen
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          ></iframe>
        </section>
      </aside>
    </div>

    <section class="dark-section rise" id="kpop">
      <div class="kpop-bg" aria-hidden="true">
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
      <div class="container">
        <div class="cats-head kpop-head">
          <div>
            <div class="cats-eyebrow">{{ txt('explore') }}</div>
            <h2>{{ txt('kpopLead') }} <span>{{ txt('kpopAccent') }}</span></h2>
            <p>{{ txt('kpopBlurb') }}</p>
          </div>
          <a class="cats-link" :href="loc('/kpop')">{{ txt('allStories') }}</a>
        </div>
        <div class="dark-grid">
          <a v-for="(story, index) in kpopFeatureStories" :key="story.title" class="feature" :href="postHref(story)">
            <img :src="story.image" :alt="story.alt" />
            <span class="feature-num">{{ String(index + 1).padStart(2, '0') }}</span>
            <div class="info">
              <span class="tag-row">
                <span v-for="tag in storyTags(story)" :key="tag" class="pill">{{ tag }}</span>
              </span>
              <h3>{{ story.title }}</h3>
              <span class="meta">{{ story.meta }}</span>
            </div>
          </a>
        </div>
        <div class="kpop-more">
          <a v-for="(story, index) in kpopMoreStories" :key="story.title" class="kpop-mini" :href="postHref(story)">
            <img :src="story.image" :alt="story.alt" />
            <div>
              <h3>{{ story.title }}</h3>
              <time>{{ story.meta }}</time>
            </div>
            <span class="feature-num">{{ String(index + 4).padStart(2, '0') }}</span>
          </a>
        </div>
      </div>
    </section>

    <section class="cats rise" id="categorias">
      <div class="cats-ambient" aria-hidden="true">
        <span class="cats-glow a"></span>
        <span class="cats-glow b"></span>
        <span class="cats-glow c"></span>
        <span class="cats-ribbon"></span>
        <span class="cats-wave"></span>
        <span class="cats-wave two"></span>
        <span class="cats-dots"></span>
        <img class="cats-phones" src="/images/headphones.png" alt="" />
      </div>
      <div class="container">
        <div class="cats-head">
          <div>
            <div class="cats-eyebrow">{{ txt('explore') }}</div>
            <h2>{{ txt('discoverLead') }} <span>{{ txt('discoverAccent') }}</span></h2>
            <p>{{ txt('discoverBlurb') }}</p>
          </div>
          <a class="cats-link" :href="loc('/categorias')">{{ txt('allCategories') }}</a>
        </div>
        <div class="cats-carousel" @mouseenter="stopCats" @mouseleave="startCats">
          <div class="cats-viewport">
            <div class="cats-track" :style="{ transform: `translateX(-${catPage * 100}%)` }">
              <div v-for="(page, pageIndex) in catPages" :key="pageIndex" class="cats-page" :style="{ gridTemplateColumns: `repeat(${catSize}, minmax(0, 1fr))` }">
                <CatsCard v-for="card in page" :key="card.title" :card="card" />
              </div>
            </div>
          </div>
          <div class="cats-controls">
            <button class="cats-nav prev" type="button" :aria-label="txt('prev')" @click="stepCats(-1, true)">‹</button>
            <div class="cats-pager">
              <button v-for="(_, index) in catPages" :key="index" type="button" :class="{ on: index === catPage }" :aria-label="`Página ${index + 1}`" @click="catPage = index; startCats()"></button>
            </div>
            <button class="cats-nav next" type="button" :aria-label="txt('next')" @click="stepCats(1, true)">›</button>
          </div>
        </div>
      </div>
    </section>

    <section class="section container news rise" id="noticias">
      <div class="news-head cats-head">
        <div>
          <div class="cats-eyebrow">{{ txt('recommended') }}</div>
          <h2>{{ txt('moreNewsLead') }} <span>{{ txt('moreNewsAccent') }}</span></h2>
        </div>
        <a class="cats-link" :href="loc('/categorias')">{{ txt('exploreCategories') }}</a>
      </div>
      <div class="list-grid">
        <div class="news-list">
          <a
            v-for="story in moreStories"
            v-show="visible(story)"
            :key="story.title"
            class="list-story"
            :href="postHref(story)"
          >
            <div>
              <div class="tag-row">
                <span v-for="tag in storyTags(story).slice(0, 4)" :key="tag" class="category">{{ tag }}</span>
              </div>
              <h3>{{ story.title }}</h3>
              <p v-if="story.lead">{{ story.lead }}</p>
              <span class="news-meta">
                <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 4.8V8l2.2 1.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                {{ story.meta }}
              </span>
            </div>
            <div class="photo"><img loading="lazy" :src="story.image" :alt="story.alt" /></div>
          </a>
        </div>
        <aside>
          <section v-for="block in readBlocks" :key="block.title" class="trend-card">
            <div class="trend-head">
              <h2>
                <svg v-if="block.icon === 'social'" class="flame rail-ico" viewBox="0 0 20 20" aria-hidden="true">
                  <circle cx="5" cy="10" r="2.2" />
                  <circle cx="15" cy="5" r="2.2" />
                  <circle cx="15" cy="15" r="2.2" />
                  <path d="M7 9.2 12.8 6.2M7 10.8l5.8 3" fill="none" stroke="currentColor" stroke-width="1.6" />
                </svg>
                <svg v-else class="flame rail-ico" viewBox="0 0 20 20" aria-hidden="true">
                  <rect x="7" y="2" width="6" height="10" rx="3" />
                  <path d="M5 9.5a5 5 0 0 0 10 0M10 14.5V18M7 18h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                </svg>
                {{ block.title }}
              </h2>
              <a :href="loc('/categoria/entrevista')">{{ txt('seeAllArrow') }}</a>
            </div>
            <a
              v-for="(story, index) in block.items"
              v-show="visible(story)"
              :key="story.title"
              class="trend-row"
              :href="postHref(story)"
            >
              <span>{{ index + 1 }}</span>
              <img loading="lazy" :src="story.image" :alt="story.alt" />
              <div>
                <small :class="story.category.toLowerCase()">{{ story.category }}</small>
                <h3>{{ story.title }}</h3>
                <time>
                  <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 4.8V8l2.2 1.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                  {{ story.meta }}
                </time>
              </div>
            </a>
          </section>
        </aside>
      </div>
    </section>

    <section class="dark-section rise" id="pantalla">
      <div class="film-bg" aria-hidden="true">
        <span class="glow"></span>
        <svg viewBox="0 0 1500 850" preserveAspectRatio="xMidYMid slice">
          <path class="film" d="M-210 760 C140 720 200 290 485 100 S950 -90 1550 190" />
          <path class="film" d="M1080 960 C900 710 1120 580 1370 490 S1700 340 1800 150" />
          <path class="film soft" d="M-100 170 C170 60 360 360 620 200 S1140 40 1600 290" />
        </svg>
      </div>
      <div class="container">
        <div class="cats-head kpop-head">
          <div>
            <div class="cats-eyebrow">{{ txt('explore') }}</div>
            <h2>{{ txt('screenLead') }} <span>{{ txt('screenAccent') }}</span></h2>
            <p>{{ txt('screenBlurb') }}</p>
          </div>
          <a class="cats-link" :href="loc('/series')">{{ txt('allStories') }}</a>
        </div>
        <div class="screen-layout">
          <a v-if="screenLeadStory.title" class="screen-feature" :href="postHref(screenLeadStory)">
            <img :src="screenLeadStory.image" :alt="screenLeadStory.alt" />
            <div class="info">
              <span class="screen-tags">
                <span v-for="tag in storyTags(screenLeadStory).slice(0, 3)" :key="tag">{{ tag }}</span>
              </span>
              <h3>{{ screenLeadStory.title }}</h3>
              <time>{{ screenLeadStory.meta }}</time>
            </div>
          </a>
          <div class="screen-side">
            <a v-for="story in screenSideStories" :key="story.title" class="screen-item" :href="postHref(story)">
              <div>
                <h3>{{ story.title }}</h3>
                <time>{{ story.meta }}</time>
              </div>
              <img loading="lazy" :src="story.image" :alt="story.alt" />
            </a>
          </div>
        </div>
      </div>
    </section>

    <section class="section container pop-section" id="popular">
      <div class="cats-head">
        <div>
          <div class="cats-eyebrow">{{ txt('explore') }}</div>
          <h2>{{ txt('popLead') }} <span>{{ txt('popAccent') }}</span></h2>
          <p>{{ txt('popBlurb') }}</p>
        </div>
        <a class="cats-link" :href="loc('/pop')">{{ txt('seeAllArrow') }}</a>
      </div>
      <div class="pop-mag">
        <a
          v-for="(story, index) in popStories"
          v-show="visible(story)"
          :key="story.title"
          class="pop-card rise"
          :style="{ '--d': `${index * 80}ms` }"
          :href="postHref(story)"
        >
          <div class="photo">
            <img loading="lazy" :src="story.image" :alt="story.alt" />
            <div class="tag-row">
              <span v-for="tag in storyTags(story).slice(0, 3)" :key="tag" class="category">{{ tag }}</span>
            </div>
          </div>
          <h3>{{ story.title }}</h3>
          <time>{{ story.meta }}</time>
        </a>
      </div>
    </section>
    </template>
  </main>

  <footer v-if="newsPage.name !== 'home' || homeReady || slides.length" id="contacto" class="footer">
    <div class="container foot-inner">
      <div>
        <a :href="loc('/')" class="brand">
          <img class="brand-logo-light" src="/images/logo.webp" alt="Music Mundial" />
          <img class="brand-logo-dark" src="/images/logo-dark.webp" alt="Music Mundial" />
        </a>
        <p>
          {{ txt('footerBlurb') }}<br />
          {{ txt('footerTag') }}
        </p>
      </div>
      <div class="foot-links">
        <a :href="loc('/')">{{ txt('navHome') }}</a>
        <a :href="loc('/kpop')">K-POP</a>
        <a :href="loc('/k-drama')">K-Dramas</a>
        <a :href="loc('/celebridades')">{{ txt('celebrities') }}</a>
        <a href="/vote/">{{ txt('navVote') }}</a>
        <a href="mailto:hola@musicmundial.com">{{ txt('contact') }}</a>
      </div>
    </div>
  </footer>

  <AuthDialog :open="authOpen" :mode="authMode" :locale="siteLocale" @close="closeAuth" @mode="authMode = $event" />
</template>
