<script setup>
import ActivePolls from './components/ActivePolls.vue'
import AppNavbar from './components/AppNavbar.vue'
import BannerFeatures from './components/BannerFeatures.vue'
import DailyRewardModal from './components/DailyRewardModal.vue'
import HeroBanner from './components/HeroBanner.vue'
import LiveActivity from './components/LiveActivity.vue'
import MainCategories from './components/MainCategories.vue'
import PopularPolls from './components/PopularPolls.vue'
import TopRanking from './components/TopRanking.vue'
</script>

<template>
  <div class="relative min-h-screen overflow-hidden bg-[#03040d] text-white">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(168,85,247,0.18),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(217,70,239,0.12),transparent_26%),linear-gradient(180deg,#050719_0%,#03040d_42%,#03040d_100%)]"></div>
    <div class="pointer-events-none absolute left-1/2 top-0 h-px w-full max-w-352 -translate-x-1/2 bg-linear-to-r from-transparent via-fuchsia-300/40 to-transparent"></div>

    <AppNavbar />

    <main class="relative z-10">
      <section class="mx-auto max-w-352 px-0 py-4 sm:px-6 sm:py-6 lg:py-8">
        <HeroBanner />
        <BannerFeatures />
      </section>

      <PopularPolls />
      <MainCategories />
      <ActivePolls />
      <TopRanking />
      <LiveActivity />

    </main>

    <footer class="relative z-10 border-t border-white/10 px-6 py-8 text-center text-sm text-slate-400">
      <p>© 2026 Voto Música Mundial. Todos los derechos reservados.</p>
    </footer>

    <DailyRewardModal />
  </div>
</template>
