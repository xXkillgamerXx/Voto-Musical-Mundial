<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AdminDashboardPage from './admin/pages/AdminDashboardPage.vue'
import ActivePolls from './components/ActivePolls.vue'
import AppFooter from './components/layout/AppFooter.vue'
import AppNavbar from './components/layout/AppNavbar.vue'
import BannerFeatures from './components/BannerFeatures.vue'
import CommunitySection from './components/CommunitySection.vue'
import HeroBanner from './components/HeroBanner.vue'
import LatestNews from './components/LatestNews.vue'
import LiveActivity from './components/LiveActivity.vue'
import MainCategories from './components/MainCategories.vue'
import MissionsSection from './components/MissionsSection.vue'
import ThemeToggle from './components/theme/ThemeToggle.vue'
import TopRanking from './components/TopRanking.vue'
import ArtistsPage from './pages/ArtistsPage.vue'
import ArtistProfilePage from './pages/ArtistProfilePage.vue'
import HallOfFamePage from './pages/HallOfFamePage.vue'
import ListPollPage from './pages/ListPollPage.vue'
import NewsPage from './pages/NewsPage.vue'
import PollsPage from './pages/PollsPage.vue'
import RankingPopularityPage from './pages/RankingPopularityPage.vue'
import RegisterPage from './pages/RegisterPage.vue'
import TermsPage from './pages/TermsPage.vue'
import UserProfilePage from './pages/UserProfilePage.vue'
import VersusEmbed from './pages/VersusEmbed.vue'
import VersusPollPage from './pages/VersusPollPage.vue'

const currentPath = ref(window.location.pathname)
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
const isPlainPage = computed(() => isRegisterPage.value || isVersusEmbedPage.value || isAdminPage.value)

const syncCurrentPath = () => {
  currentPath.value = window.location.pathname
}

onMounted(() => {
  window.addEventListener('popstate', syncCurrentPath)
})

onUnmounted(() => {
  window.removeEventListener('popstate', syncCurrentPath)
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

    <main class="relative z-10" :class="!isPlainPage && 'pt-11 sm:pt-24'">
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
        <LiveActivity />
        <LatestNews />
        <MissionsSection />
        <CommunitySection />
      </template>

    </main>

    <AppFooter v-if="!isPlainPage" />

  </div>
</template>
