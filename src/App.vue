<script setup>
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import ActivePolls from './components/ActivePolls.vue'
import AppFooter from './components/layout/AppFooter.vue'
import AppNavbar from './components/layout/AppNavbar.vue'
import BannerFeatures from './components/BannerFeatures.vue'
import HeroBanner from './components/HeroBanner.vue'
import HomeAd from './components/HomeAd.vue'
import MainCategories from './components/MainCategories.vue'
import ThemeToggle from './components/theme/ThemeToggle.vue'
import { preloadRouteData } from './services/firebaseCache'
import { db, trackAnalyticsEvent } from './firebase'

const AdminDashboardPage = defineAsyncComponent(() => import('./admin/pages/AdminDashboardPage.vue'))
const CommunitySection = defineAsyncComponent(() => import('./components/CommunitySection.vue'))
const DailyRewardModal = defineAsyncComponent(() => import('./components/DailyRewardModal.vue'))
const LatestNews = defineAsyncComponent(() => import('./components/LatestNews.vue'))
const LiveActivity = defineAsyncComponent(() => import('./components/LiveActivity.vue'))
const MissionsSection = defineAsyncComponent(() => import('./components/MissionsSection.vue'))
const TopRanking = defineAsyncComponent(() => import('./components/TopRanking.vue'))
const ArtistsPage = defineAsyncComponent(() => import('./pages/ArtistsPage.vue'))
const ArtistProfilePage = defineAsyncComponent(() => import('./pages/ArtistProfilePage.vue'))
const HallOfFamePage = defineAsyncComponent(() => import('./pages/HallOfFamePage.vue'))
const ListPollPage = defineAsyncComponent(() => import('./pages/ListPollPage.vue'))
const NewsPage = defineAsyncComponent(() => import('./pages/NewsPage.vue'))
const PollsPage = defineAsyncComponent(() => import('./pages/PollsPage.vue'))
const RankingPopularityPage = defineAsyncComponent(() => import('./pages/RankingPopularityPage.vue'))
const RegisterPage = defineAsyncComponent(() => import('./pages/RegisterPage.vue'))
const TermsPage = defineAsyncComponent(() => import('./pages/TermsPage.vue'))
const UserProfilePage = defineAsyncComponent(() => import('./pages/UserProfilePage.vue'))
const VersusEmbed = defineAsyncComponent(() => import('./pages/VersusEmbed.vue'))
const VersusPollPage = defineAsyncComponent(() => import('./pages/VersusPollPage.vue'))

const currentPath = ref(window.location.pathname)
const currentRouteKey = ref(`${window.location.pathname}${window.location.search}${window.location.hash}`)
const PREVIEW_PAGE_LOADING = false
const isPageLoading = ref(true)
let loadingTimer = null
let loadingToken = 0
const prefetchedRoutes = new Set()
const isRegisterPage = computed(() => currentPath.value === '/registro')
const isTermsPage = computed(() => currentPath.value === '/terminos-y-condiciones')
const isPollsPage = computed(() => currentPath.value === '/votaciones')
const isHallOfFamePage = computed(() => currentPath.value === '/salon-de-la-fama')
const isArtistsPage = computed(() => currentPath.value === '/artistas')
const isRankingPopularityPage = computed(() => currentPath.value === '/ranking-popularity')
const isNewsPage = computed(() => currentPath.value === '/noticias')
const isUserProfilePage = computed(() => currentPath.value === '/perfil')
const isPublicUserProfilePage = computed(() => /^\/user\/[a-z0-9_]{3,20}$/.test(currentPath.value))
const isListPollPage = computed(() => currentPath.value === '/votacion/lista')
const isDynamicListPollPage = computed(() => /^\/votacion\/\d{4}\/[^/]+$/.test(currentPath.value))
const isVersusPollPage = computed(() => currentPath.value === '/votacion/versus')
const isVersusEmbedPage = computed(() => currentPath.value === '/embed/versus')
const isArtistProfilePage = computed(() => /^\/artista\/[^/]+$/.test(currentPath.value))
const isAdminPage = computed(() => currentPath.value.startsWith('/admin'))
const isEmbeddedPage = computed(() => {
  currentRouteKey.value
  const params = new URLSearchParams(window.location.search)
  return params.get('embed') === '1' || params.get('embed') === 'true'
})
const isPlainPage = computed(() => isEmbeddedPage.value || isRegisterPage.value || isVersusEmbedPage.value || isAdminPage.value)
const shouldShowDailyRewardModal = computed(() => !isPlainPage.value && !isTermsPage.value)

const trackPageView = () => {
  trackAnalyticsEvent('page_view', {
    page_location: window.location.href,
    page_path: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    page_title: document.title,
  })
}

const finishPageLoading = async () => {
  if (PREVIEW_PAGE_LOADING) {
    isPageLoading.value = true
    return
  }

  const token = ++loadingToken
  window.clearTimeout(loadingTimer)

  await preloadRouteData(db, window.location.pathname).catch(() => {})

  if (token !== loadingToken) {
    return
  }

  loadingTimer = window.setTimeout(() => {
    isPageLoading.value = false
  }, 420)
}

const syncCurrentPath = () => {
  isPageLoading.value = true
  currentPath.value = window.location.pathname
  currentRouteKey.value = `${window.location.pathname}${window.location.search}${window.location.hash}`
  trackPageView()
  finishPageLoading()
}

const isInternalNavigation = (anchor) => {
  if (!anchor?.href || anchor.target || anchor.hasAttribute('download')) {
    return false
  }

  const url = new URL(anchor.href)

  return url.origin === window.location.origin
    && `${url.pathname}${url.search}${url.hash}` !== `${window.location.pathname}${window.location.search}${window.location.hash}`
}

const handleDocumentClick = (event) => {
  const anchor = event.target.closest?.('a[href]')

  if (!isInternalNavigation(anchor)) {
    return
  }

  const url = new URL(anchor.href)

  event.preventDefault()
  isPageLoading.value = true
  window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`)
  window.scrollTo({ top: 0, behavior: 'instant' })
  window.setTimeout(syncCurrentPath, 120)
}

const preloadAnchorRoute = (event) => {
  const anchor = event.target.closest?.('a[href]')

  if (!isInternalNavigation(anchor)) {
    return
  }

  const url = new URL(anchor.href)

  if (prefetchedRoutes.has(url.pathname)) {
    return
  }

  prefetchedRoutes.add(url.pathname)
  preloadRouteData(db, url.pathname).catch(() => {})
}

onMounted(() => {
  window.addEventListener('popstate', syncCurrentPath)
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('pointerover', preloadAnchorRoute, { passive: true })
  document.addEventListener('touchstart', preloadAnchorRoute, { passive: true })
  trackPageView()
  finishPageLoading()
})

onUnmounted(() => {
  window.removeEventListener('popstate', syncCurrentPath)
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('pointerover', preloadAnchorRoute)
  document.removeEventListener('touchstart', preloadAnchorRoute)
  window.clearTimeout(loadingTimer)
})
</script>

<template>
  <div class="app-shell relative min-h-screen overflow-hidden">
    <div class="app-background pointer-events-none absolute inset-0"></div>
    <div class="app-top-divider pointer-events-none absolute left-1/2 top-0 h-px w-full max-w-352 -translate-x-1/2"></div>

    <AppNavbar v-if="!isPlainPage" />
    <ThemeToggle
      v-if="isPlainPage && !isVersusEmbedPage"
      compact
      class="fixed right-4 top-4 z-60"
    />

    <Transition name="page-loader">
      <div
        v-if="isPageLoading"
        class="fixed inset-0 z-999 grid place-items-center bg-[#050713] text-white"
      >
        <div class="page-loader-card text-center">
          <div class="page-loader-equalizer relative mx-auto flex h-28 w-44 items-end justify-center gap-2 rounded-4xl border border-white/10 bg-white/8 px-6 py-5 shadow-2xl shadow-fuchsia-950/45 backdrop-blur-xl">
            <img
              src="/logo-votos.png"
              alt="World Music Votes"
              class="absolute -right-10 -top-8 w-22 rotate-12 drop-shadow-[0_0_30px_rgba(251,191,36,0.62)]"
            />
            <span
              v-for="index in 7"
              :key="`loader-bar-${index}`"
              class="page-loader-eq-bar block w-3 rounded-full bg-linear-to-t from-cyan-300 via-fuchsia-300 to-amber-200"
              :style="{ animationDelay: `${index * 90}ms` }"
            ></span>
          </div>
          <p class="mt-5 text-2xl font-black tracking-tight text-white">
            World Music Votes
          </p>
          <p class="mt-1 text-xs font-black uppercase tracking-[0.32em] text-fuchsia-200">
            Global awards
          </p>
          <div class="mx-auto mt-4 h-1.5 w-36 overflow-hidden rounded-full bg-white/10">
            <span class="page-loader-bar block h-full rounded-full bg-linear-to-r from-violet-400 to-fuchsia-400"></span>
          </div>
        </div>
      </div>
    </Transition>

    <main
      :key="currentRouteKey"
      class="relative z-10"
      :class="!isPlainPage && 'pt-11 sm:pt-24'"
    >
      <RegisterPage v-if="isRegisterPage" />
      <TermsPage v-else-if="isTermsPage" />
      <PollsPage v-else-if="isPollsPage" />
      <HallOfFamePage v-else-if="isHallOfFamePage" />
      <ArtistsPage v-else-if="isArtistsPage" />
      <RankingPopularityPage v-else-if="isRankingPopularityPage" />
      <NewsPage v-else-if="isNewsPage" />
      <UserProfilePage v-else-if="isUserProfilePage || isPublicUserProfilePage" />
      <VersusEmbed v-else-if="isVersusEmbedPage" />
      <AdminDashboardPage v-else-if="isAdminPage" />
      <ListPollPage v-else-if="isListPollPage || isDynamicListPollPage" />
      <VersusPollPage v-else-if="isVersusPollPage" />
      <ArtistProfilePage v-else-if="isArtistProfilePage" />

      <template v-else>
        <section class="mx-auto max-w-352 px-0 py-4 sm:px-6 sm:py-6 lg:py-8">
          <HeroBanner />
          <div class="hidden md:block">
            <BannerFeatures />
          </div>
        </section>

        <ActivePolls />
        <MainCategories />
        <TopRanking />
        <HomeAd />
        <LiveActivity />
        <LatestNews />
        <MissionsSection />
        <CommunitySection />
      </template>

    </main>

    <AppFooter v-if="!isPlainPage" />
    <DailyRewardModal v-if="shouldShowDailyRewardModal" />

  </div>
</template>

<style scoped>
.page-loader-enter-active,
.page-loader-leave-active {
  transition: opacity 0.22s ease;
}

.page-loader-enter-from,
.page-loader-leave-to {
  opacity: 0;
}

.page-loader-card {
  animation: page-loader-card 0.8s ease-out both;
}

.page-loader-equalizer {
  animation: page-loader-equalizer 2.4s ease-in-out infinite;
}

.page-loader-eq-bar {
  animation: page-loader-eq-bar 0.9s ease-in-out infinite;
  height: 28%;
  box-shadow: 0 0 22px rgba(217, 70, 239, 0.28);
}

.page-loader-bar {
  animation: page-loader-bar 1s ease-in-out infinite;
  transform-origin: left center;
}

@keyframes page-loader-card {
  from {
    opacity: 0;
    transform: translateY(0.75rem) scale(0.96);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes page-loader-equalizer {
  0%,
  100% {
    transform: scale(1);
    filter: drop-shadow(0 0 22px rgba(217, 70, 239, 0.3));
  }

  50% {
    transform: scale(1.04);
    filter: drop-shadow(0 0 34px rgba(34, 211, 238, 0.24));
  }
}

@keyframes page-loader-eq-bar {
  0%,
  100% {
    height: 24%;
    opacity: 0.72;
  }

  50% {
    height: 88%;
    opacity: 1;
  }
}

@keyframes page-loader-bar {
  0% {
    transform: translateX(-100%) scaleX(0.55);
  }

  55% {
    transform: translateX(12%) scaleX(0.85);
  }

  100% {
    transform: translateX(110%) scaleX(0.55);
  }
}
</style>
