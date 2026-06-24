<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ActivePolls from './components/ActivePolls.vue'
import AppFooter from './components/AppFooter.vue'
import AppNavbar from './components/AppNavbar.vue'
import BannerFeatures from './components/BannerFeatures.vue'
import DailyRewardModal from './components/DailyRewardModal.vue'
import HeroBanner from './components/HeroBanner.vue'
import LiveActivity from './components/LiveActivity.vue'
import MainCategories from './components/MainCategories.vue'
import PopularPolls from './components/PopularPolls.vue'
import RegisterPage from './components/RegisterPage.vue'
import TopRanking from './components/TopRanking.vue'

const currentPath = ref(window.location.pathname)
const isRegisterPage = computed(() => currentPath.value === '/registro')

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

    <AppNavbar v-if="!isRegisterPage" />

    <main class="relative z-10" :class="!isRegisterPage && 'pt-11 sm:pt-24'">
      <RegisterPage v-if="isRegisterPage" />

      <template v-else>
        <section class="mx-auto max-w-352 px-0 py-4 sm:px-6 sm:py-6 lg:py-8">
          <HeroBanner />
          <div class="hidden md:block">
            <BannerFeatures />
          </div>
        </section>

        <PopularPolls />
        <MainCategories />
        <ActivePolls />
        <TopRanking />
        <LiveActivity />
      </template>

    </main>

    <AppFooter />

    <DailyRewardModal v-if="!isRegisterPage" />
  </div>
</template>
