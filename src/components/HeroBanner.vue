<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'

const activeSlide = ref(0)
const animatedVotes = ref(0)
const animatedPercent = ref(0)
const animatedProgress = ref(0)

const bannerSlides = [
  {
    badge: '#1 mas popular',
    status: 'En vivo',
    eyebrow: 'Best Kpop Vocalists 2026',
    title: 'Jungkook lidera la votacion',
    description:
      'Apoya a tu artista favorito, suma votos y ayuda a tu fandom a mantenerse arriba en el ranking.',
    category: 'Lista',
    leader: 'Jungkook',
    votes: '1,890,406',
    percent: '38.48%',
    progress: 82,
    time: '6d 04h',
  },
  {
    badge: 'Votacion destacada',
    status: 'Abierta',
    eyebrow: 'Best Kpop Leaders 2026',
    title: 'Elige al lider favorito',
    description:
      'Cada voto cuenta para subir posiciones. Vuelve cuando termine el cooldown y sigue apoyando.',
    category: 'Ranking',
    leader: 'Seungmin',
    votes: '1,817,217',
    percent: '36.99%',
    progress: 76,
    time: '12d 08h',
  },
  {
    badge: 'Top del momento',
    status: 'Resultados',
    eyebrow: 'Best Global Artist 2026',
    title: 'La carrera sigue abierta',
    description:
      'Consulta el avance del top y descubre que fandom esta empujando mas fuerte en tiempo real.',
    category: 'Top 5',
    leader: 'Rose',
    votes: '596,389',
    percent: '12.14%',
    progress: 54,
    time: 'Live',
  },
]

const goToPreviousSlide = () => {
  activeSlide.value = (activeSlide.value - 1 + bannerSlides.length) % bannerSlides.length
}

const goToNextSlide = () => {
  activeSlide.value = (activeSlide.value + 1) % bannerSlides.length
}

let autoplayTimer
let statsAnimationFrame

const parseVotes = (value) => Number(value.replaceAll(',', ''))
const parsePercent = (value) => Number(value.replace('%', ''))

const formatVotes = (value) => Math.round(value).toLocaleString('en-US')
const formatPercent = (value) => `${value.toFixed(2)}%`

const easeOutCubic = (progress) => 1 - Math.pow(1 - progress, 3)

const animateBannerStats = () => {
  if (statsAnimationFrame) {
    window.cancelAnimationFrame(statsAnimationFrame)
  }

  const slide = bannerSlides[activeSlide.value]
  const targetVotes = parseVotes(slide.votes)
  const targetPercent = parsePercent(slide.percent)
  const targetProgress = slide.progress
  const duration = 1300
  const startTime = performance.now()

  animatedVotes.value = 0
  animatedPercent.value = 0
  animatedProgress.value = 0

  const tick = (currentTime) => {
    const progress = Math.min((currentTime - startTime) / duration, 1)
    const easedProgress = easeOutCubic(progress)

    animatedVotes.value = targetVotes * easedProgress
    animatedPercent.value = targetPercent * easedProgress
    animatedProgress.value = targetProgress * easedProgress

    if (progress < 1) {
      statsAnimationFrame = window.requestAnimationFrame(tick)
      return
    }

    animatedVotes.value = targetVotes
    animatedPercent.value = targetPercent
    animatedProgress.value = targetProgress
  }

  statsAnimationFrame = window.requestAnimationFrame(tick)
}

watch(activeSlide, () => {
  animateBannerStats()
})

onMounted(() => {
  animateBannerStats()
  autoplayTimer = window.setInterval(goToNextSlide, 5000)
})

onUnmounted(() => {
  window.clearInterval(autoplayTimer)
  if (statsAnimationFrame) {
    window.cancelAnimationFrame(statsAnimationFrame)
  }
})
</script>

<template>
  <div
    class="relative w-full overflow-hidden border-y border-white/10 bg-slate-950 shadow-2xl shadow-violet-950/40 sm:rounded-4xl sm:border"
  >
    <div
      class="absolute inset-0 bg-[url('/banner-vote-bg.svg')] bg-cover bg-center transition-transform duration-1000"
      :class="activeSlide % 2 === 0 ? 'scale-100' : 'scale-105'"
    ></div>
    <div class="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,18,0.98)_0%,rgba(3,7,18,0.82)_42%,rgba(3,7,18,0.18)_100%)]"></div>
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_38%_45%,rgba(217,70,239,0.22),transparent_28%),radial-gradient(circle_at_72%_45%,rgba(168,85,247,0.18),transparent_26%)]"></div>
    <div class="absolute -bottom-28 left-0 h-44 w-full bg-linear-to-t from-slate-950 via-slate-950/80 to-transparent"></div>

    <button
      type="button"
      class="absolute left-4 top-1/2 z-20 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/35 text-xl text-white shadow-xl backdrop-blur transition hover:bg-white/15 md:grid"
      aria-label="Banner anterior"
      @click="goToPreviousSlide"
    >
      ‹
    </button>

    <button
      type="button"
      class="absolute right-4 top-1/2 z-20 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/35 text-xl text-white shadow-xl backdrop-blur transition hover:bg-white/15 md:grid"
      aria-label="Banner siguiente"
      @click="goToNextSlide"
    >
      ›
    </button>

    <div class="relative grid min-h-[420px] items-center px-4 py-12 sm:px-10 lg:grid-cols-[0.78fr_1fr] lg:px-20">
      <Transition name="banner-copy" mode="out-in">
      <div :key="activeSlide" class="w-full max-w-xl">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <span class="rounded-full bg-amber-300 px-3 py-1 text-[11px] font-black uppercase text-slate-950">
            {{ bannerSlides[activeSlide].badge }}
          </span>
          <span class="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-black uppercase text-emerald-300">
            {{ bannerSlides[activeSlide].status }}
          </span>
        </div>

        <p class="mb-2 text-xs font-black uppercase tracking-[0.35em] text-fuchsia-300">
          {{ bannerSlides[activeSlide].eyebrow }}
        </p>
        <h1 class="max-w-2xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          {{ bannerSlides[activeSlide].title }}
        </h1>
        <p class="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
          {{ bannerSlides[activeSlide].description }}
        </p>

        <div class="mt-6 flex flex-wrap items-end gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-widest text-slate-400">
              {{ bannerSlides[activeSlide].category }}
            </p>
            <div class="mt-1 flex items-center gap-3">
              <span class="text-4xl font-black text-white">❤ {{ formatVotes(animatedVotes) }}</span>
              <span class="text-sm font-bold text-slate-300">votos</span>
            </div>
          </div>
          <div>
            <p class="text-2xl font-black text-fuchsia-300">{{ formatPercent(animatedPercent) }}</p>
            <p class="text-xs text-slate-400">del top actual</p>
          </div>
        </div>

        <div class="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10 sm:max-w-md">
          <div
            class="h-full rounded-full bg-linear-to-r from-violet-400 to-fuchsia-400 transition-all duration-700 ease-out"
            :style="{ width: `${animatedProgress}%` }"
          ></div>
        </div>

        <div class="mt-7 grid w-full gap-3 sm:max-w-md sm:grid-cols-2">
          <a
            href="#"
            class="flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 text-center text-sm font-black uppercase tracking-wide shadow-xl shadow-fuchsia-500/25 transition hover:scale-[1.02]"
          >
            <span>Votar ahora</span>
            <span aria-hidden="true">→</span>
          </a>
          <a
            href="#"
            class="flex min-h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 text-center text-sm font-bold text-slate-200 transition hover:bg-white/10"
          >
            Ver rankings
          </a>
        </div>

        <div class="mt-7 flex items-center gap-3">
          <button
            v-for="(_, index) in bannerSlides"
            :key="index"
            type="button"
            class="h-2 rounded-full transition-all"
            :class="activeSlide === index ? 'w-10 bg-fuchsia-300' : 'w-2 bg-white/30 hover:bg-white/60'"
            :aria-label="`Ver banner ${index + 1}`"
            @click="activeSlide = index"
          ></button>
        </div>
      </div>
      </Transition>

      <div class="relative hidden min-h-[360px] lg:block">
        <div class="absolute right-10 top-1/2 h-72 w-96 -translate-y-1/2 rounded-[3rem] border border-white/10 bg-white/5 backdrop-blur-sm"></div>
        <div class="absolute right-20 top-20 h-40 w-28 rotate-6 rounded-3xl bg-white/10 shadow-2xl shadow-black/40"></div>
        <div class="absolute right-56 top-24 h-32 w-24 -rotate-12 rounded-3xl bg-fuchsia-400/20 shadow-2xl shadow-fuchsia-500/30"></div>
        <div class="absolute right-36 top-1/2 grid size-44 -translate-y-1/2 place-items-center rounded-full border border-fuchsia-300/40 bg-black/30 shadow-[0_0_90px_rgba(217,70,239,0.55)]">
          <img src="/logo-votos.png" alt="Corona Votos Musica Mundial" class="w-44" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.banner-copy-enter-active,
.banner-copy-leave-active {
  transition:
    opacity 360ms ease,
    transform 360ms ease,
    filter 360ms ease;
}

.banner-copy-enter-from {
  opacity: 0;
  transform: translateY(18px);
  filter: blur(8px);
}

.banner-copy-leave-to {
  opacity: 0;
  transform: translateY(-12px);
  filter: blur(8px);
}
</style>
