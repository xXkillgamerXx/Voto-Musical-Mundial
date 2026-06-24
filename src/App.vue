<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AdminDashboardPage from './admin/pages/AdminDashboardPage.vue'
import ActivePolls from './components/ActivePolls.vue'
import AppFooter from './components/layout/AppFooter.vue'
import AppNavbar from './components/layout/AppNavbar.vue'
import BannerFeatures from './components/BannerFeatures.vue'
import DailyRewardModal from './components/DailyRewardModal.vue'
import HeroBanner from './components/HeroBanner.vue'
import LiveActivity from './components/LiveActivity.vue'
import MainCategories from './components/MainCategories.vue'
import MissionsSection from './components/MissionsSection.vue'
import TopRanking from './components/TopRanking.vue'
import ArtistProfilePage from './pages/ArtistProfilePage.vue'
import ListPollPage from './pages/ListPollPage.vue'
import RegisterPage from './pages/RegisterPage.vue'
import TermsPage from './pages/TermsPage.vue'
import VersusEmbed from './pages/VersusEmbed.vue'
import VersusPollPage from './pages/VersusPollPage.vue'

const currentPath = ref(window.location.pathname)
const isRegisterPage = computed(() => currentPath.value === '/registro')
const isTermsPage = computed(() => currentPath.value === '/terminos-y-condiciones')
const isListPollPage = computed(() => currentPath.value === '/votacion/lista')
const isDynamicListPollPage = computed(() => /^\/votacion\/\d{4}\/[^/]+$/.test(currentPath.value))
const isVersusPollPage = computed(() => currentPath.value === '/votacion/versus')
const isVersusEmbedPage = computed(() => currentPath.value === '/embed/versus')
const isArtistProfilePage = computed(() => currentPath.value === '/artista/jungkook')
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
  <div class="relative min-h-screen overflow-hidden bg-[#03040d] text-white">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(168,85,247,0.18),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(217,70,239,0.12),transparent_26%),linear-gradient(180deg,#050719_0%,#03040d_42%,#03040d_100%)]"></div>
    <div class="pointer-events-none absolute left-1/2 top-0 h-px w-full max-w-352 -translate-x-1/2 bg-linear-to-r from-transparent via-fuchsia-300/40 to-transparent"></div>

    <AppNavbar v-if="!isPlainPage" />

    <main class="relative z-10" :class="!isPlainPage && 'pt-11 sm:pt-24'">
      <RegisterPage v-if="isRegisterPage" />
      <TermsPage v-else-if="isTermsPage" />
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
        <MissionsSection />
      </template>

    </main>

    <AppFooter v-if="!isPlainPage" />

    <DailyRewardModal v-if="!isPlainPage && !isTermsPage && !isListPollPage && !isDynamicListPollPage && !isVersusPollPage && !isArtistProfilePage" />
  </div>
</template>
