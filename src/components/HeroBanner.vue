<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { subscribeArtistsCached, subscribeLivePollsCached } from '../services/firebaseCache'
import { subscribePublicResults } from '../services/pollResults'

const activeSlide = ref(0)
const animatedVotes = ref(0)
const animatedPercent = ref(0)
const animatedProgress = ref(0)
const livePolls = ref([])
const livePollResults = ref({})
const activeRoundIds = ref({})
const artists = ref([])

let unsubscribePolls = null
const roundListeners = new Map()
const pollResultListeners = new Map()

const emptyBannerSlide = {
  badge: 'Proximamente',
  status: 'Sin votaciones',
  eyebrow: 'Votos Musica Mundial',
  title: 'Prepara tu fandom para la proxima votacion',
  description:
    'Cuando haya una votacion activa, aqui veras el lider, los votos y el avance real del ranking.',
  category: '',
  leader: '',
  votes: '0',
  percent: '0.00%',
  progress: 0,
  time: '',
  href: '/votaciones',
  socialStats: [],
  isEmpty: true,
}

const liveSlides = computed(() =>
  livePolls.value.slice(0, 3).map((poll, index) => buildLiveSlide(poll, index)),
)
const bannerSlides = computed(() => liveSlides.value.length ? liveSlides.value : [emptyBannerSlide])
const currentSlide = computed(() => bannerSlides.value[activeSlide.value] || bannerSlides.value[0])

const goToPreviousSlide = () => {
  activeSlide.value = (activeSlide.value - 1 + bannerSlides.value.length) % bannerSlides.value.length
}

const goToNextSlide = () => {
  activeSlide.value = (activeSlide.value + 1) % bannerSlides.value.length
}

let autoplayTimer
let statsAnimationFrame

const parseVotes = (value) => Number(String(value || 0).replaceAll(',', ''))
const parsePercent = (value) => Number(value.replace('%', ''))

const formatVotes = (value) => Math.round(value).toLocaleString('en-US')
const formatPercent = (value) => `${value.toFixed(2)}%`
const pollUrl = (poll) => `/votacion/${poll.year || new Date().getFullYear()}/${poll.slug || poll.id}`
const getArtistName = (artistId) =>
  artists.value.find((artist) => artist.id === artistId)?.name || 'Tu artista favorito'
const getEffectiveRoundId = (poll) => poll.activeRoundId || activeRoundIds.value[poll.id] || ''

const estimatedStats = (votes) => {
  const safeVotes = Math.max(Number(votes || 0), 1)
  const activeFans = Math.max(120, Math.round(safeVotes * 0.018))
  const todayVotes = Math.max(480, Math.round(safeVotes * 0.12))
  const pushPercent = Math.min(99, Math.max(61, Math.round(58 + Math.log10(safeVotes) * 7)))

  return [
    { label: 'Fans activos', value: activeFans.toLocaleString('en-US') },
    { label: 'Votos hoy', value: todayVotes.toLocaleString('en-US') },
    { label: 'Fandom push', value: `${pushPercent}%` },
  ]
}

const easeOutCubic = (progress) => 1 - Math.pow(1 - progress, 3)

const clearPollResult = (pollId) => {
  if (!pollId || !livePollResults.value[pollId]) {
    return
  }

  const nextResults = { ...livePollResults.value }
  delete nextResults[pollId]
  livePollResults.value = nextResults
}

const setPollResult = (pollId, result) => {
  livePollResults.value = {
    ...livePollResults.value,
    [pollId]: result,
  }
}

const setActiveRoundId = (pollId, roundId) => {
  activeRoundIds.value = {
    ...activeRoundIds.value,
    [pollId]: roundId || '',
  }
}

const clearActiveRoundId = (pollId) => {
  if (!pollId || !activeRoundIds.value[pollId]) {
    return
  }

  const nextRoundIds = { ...activeRoundIds.value }
  delete nextRoundIds[pollId]
  activeRoundIds.value = nextRoundIds
}

const syncRoundListeners = (pollRows) => {
  const visiblePolls = pollRows.slice(0, 3)
  const visiblePollIds = new Set(visiblePolls.map((poll) => poll.id))

  roundListeners.forEach((unsubscribe, pollId) => {
    if (!visiblePollIds.has(pollId)) {
      unsubscribe()
      roundListeners.delete(pollId)
      clearActiveRoundId(pollId)
    }
  })

  visiblePolls.forEach((poll) => {
    if (roundListeners.has(poll.id)) {
      return
    }

    const activeRound = (poll.rounds || []).find((round) => round.id === poll.activeRoundId)
      || (poll.rounds || []).find((round) => round.status === 'live')
      || (poll.rounds || [])[0]
      || null

    setActiveRoundId(poll.id, activeRound?.id || '')
    syncPollResultListeners(livePolls.value)

    roundListeners.set(poll.id, () => {})
  })
}

const syncPollResultListeners = (pollRows) => {
  const visiblePolls = pollRows.slice(0, 3)
  const nextKeys = new Set(
    visiblePolls.map((poll) => `${poll.id}:${getEffectiveRoundId(poll) || '_root'}`),
  )

  pollResultListeners.forEach((listener, key) => {
    if (!nextKeys.has(key)) {
      listener.unsubscribers.forEach((unsubscribe) => unsubscribe())
      pollResultListeners.delete(key)
      clearPollResult(listener.pollId)
    }
  })

  visiblePolls.forEach((poll) => {
    const key = `${poll.id}:${getEffectiveRoundId(poll) || '_root'}`

    if (pollResultListeners.has(key)) {
      return
    }

    const unsubscribe = subscribePublicResults(null, {
      pollId: poll.id,
      roundId: getEffectiveRoundId(poll) || null,
      onData: (publicResults) => {
        setPollResult(poll.id, publicResults || {
          totalVotes: Number(poll.totalVotes || 0),
          leaderArtistId: poll.leaderArtistId || null,
          leaderVotes: Number(poll.leaderVotes || 0),
        })
      },
      onError: () => clearPollResult(poll.id),
    })

    pollResultListeners.set(key, {
      pollId: poll.id,
      unsubscribers: [unsubscribe],
    })
  })
}

const animateBannerStats = () => {
  if (statsAnimationFrame) {
    window.cancelAnimationFrame(statsAnimationFrame)
  }

  const slide = currentSlide.value
  if (!slide) {
    return
  }

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

const buildLiveSlide = (poll, index) => {
  const liveResult = livePollResults.value[poll.id] || {}
  const totalVotes = Number(liveResult.totalVotes ?? poll.totalVotes ?? 0)
  const leaderVotes = Number(liveResult.leaderVotes ?? poll.leaderVotes ?? 0)
  const percent = totalVotes ? (leaderVotes / totalVotes) * 100 : 0
  const leaderArtistId = liveResult.leaderArtistId || poll.leaderArtistId
  const leaderName = getArtistName(leaderArtistId)

  return {
    badge: index === 0 ? '#1 en vivo' : 'Votacion en vivo',
    status: poll.status === 'selecting_winners' ? 'En proceso' : 'En vivo',
    eyebrow: poll.title || 'Votacion activa',
    title: leaderArtistId ? `${leaderName} lidera la votacion` : poll.title || 'Vota por tu artista favorito',
    description: poll.description || 'Tu voto puede cambiar el ranking. Entra, apoya a tu artista y ayuda a tu fandom a subir posiciones.',
    category: poll.category || 'Lista',
    leader: leaderName,
    votes: String(totalVotes || leaderVotes || 0),
    percent: `${percent.toFixed(2)}%`,
    progress: Math.min(Math.max(percent * 2.1, totalVotes ? 18 : 8), 100),
    time: 'Live',
    href: pollUrl(poll),
    socialStats: estimatedStats(totalVotes || leaderVotes),
  }
}

const listenLivePolls = () => {
  unsubscribePolls = subscribeLivePollsCached(
    null,
    (pollRows) => {
      livePolls.value = pollRows
      syncRoundListeners(pollRows)
      syncPollResultListeners(pollRows)
      activeSlide.value = Math.min(activeSlide.value, Math.max(bannerSlides.value.length - 1, 0))
      animateBannerStats()
    },
    () => {
      livePolls.value = []
      syncRoundListeners([])
      syncPollResultListeners([])
    },
  )
}

watch([activeSlide, bannerSlides], () => {
  animateBannerStats()
})

let unsubscribeArtists = null

onMounted(() => {
  unsubscribeArtists = subscribeArtistsCached(null, (artistRows) => {
    artists.value = artistRows
  })
  listenLivePolls()
  animateBannerStats()
  autoplayTimer = window.setInterval(goToNextSlide, 5000)
})

onUnmounted(() => {
  unsubscribeArtists?.()
  unsubscribePolls?.()
  roundListeners.forEach((unsubscribe) => unsubscribe())
  roundListeners.clear()
  pollResultListeners.forEach((listener) => {
    listener.unsubscribers.forEach((unsubscribe) => unsubscribe())
  })
  pollResultListeners.clear()
  window.clearInterval(autoplayTimer)
  if (statsAnimationFrame) {
    window.cancelAnimationFrame(statsAnimationFrame)
  }
})
</script>

<template>
  <div
    class="dark-surface hero-surface relative w-full overflow-hidden border-y border-white/10 bg-slate-950 shadow-2xl shadow-violet-950/40 sm:rounded-4xl sm:border"
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
      :aria-label="$t('widgets.hero.previous')"
      @click="goToPreviousSlide"
    >
      ‹
    </button>

    <button
      type="button"
      class="absolute right-4 top-1/2 z-20 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/35 text-xl text-white shadow-xl backdrop-blur transition hover:bg-white/15 md:grid"
      :aria-label="$t('widgets.hero.next')"
      @click="goToNextSlide"
    >
      ›
    </button>

    <div class="relative grid min-h-[420px] items-center px-4 py-12 sm:px-10 lg:grid-cols-[0.78fr_1fr] lg:px-20">
      <Transition name="banner-copy" mode="out-in">
      <div :key="activeSlide" class="w-full max-w-xl">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <span class="rounded-full bg-amber-300 px-3 py-1 text-[11px] font-black uppercase text-slate-950">
            {{ currentSlide.badge }}
          </span>
          <span class="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-black uppercase text-emerald-300">
            {{ currentSlide.status }}
          </span>
        </div>

        <p class="mb-2 text-xs font-black uppercase tracking-[0.35em] text-fuchsia-300">
          {{ currentSlide.eyebrow }}
        </p>
        <h1 class="max-w-2xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          {{ currentSlide.title }}
        </h1>
        <p class="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
          {{ currentSlide.description }}
        </p>

        <div
          v-if="!currentSlide.isEmpty"
          class="mt-6 flex flex-wrap items-end gap-4"
        >
          <div>
            <p class="text-xs font-black uppercase tracking-widest text-slate-400">
              {{ currentSlide.category }}
            </p>
            <div class="mt-1 flex items-center gap-3">
              <span class="text-4xl font-black text-white">❤ {{ formatVotes(animatedVotes) }}</span>
              <span class="text-sm font-bold text-slate-300">{{ $t('widgets.hero.votes') }}</span>
            </div>
          </div>
          <div>
            <p class="text-2xl font-black text-fuchsia-300">{{ formatPercent(animatedPercent) }}</p>
            <p class="text-xs text-slate-400">{{ $t('widgets.hero.currentTop') }}</p>
          </div>
        </div>

        <div
          v-if="!currentSlide.isEmpty"
          class="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10 sm:max-w-md"
        >
          <div
            class="h-full rounded-full bg-linear-to-r from-violet-400 to-fuchsia-400 transition-all duration-700 ease-out"
            :style="{ width: `${animatedProgress}%` }"
          ></div>
        </div>

        <div
          v-if="currentSlide.socialStats.length"
          class="mt-4 grid w-full gap-2 sm:max-w-md sm:grid-cols-3"
        >
          <div
            v-for="stat in currentSlide.socialStats"
            :key="stat.label"
            class="rounded-2xl border border-white/10 bg-white/7 px-3 py-3 backdrop-blur"
          >
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {{ stat.label }}
            </p>
            <p class="mt-1 text-lg font-black text-white">
              {{ stat.value }}
            </p>
          </div>
        </div>

        <div class="mt-7 grid w-full gap-3 sm:max-w-md sm:grid-cols-2">
          <a
            :href="currentSlide.href"
            class="flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 text-center text-sm font-black uppercase tracking-wide shadow-xl shadow-fuchsia-500/25 transition hover:scale-[1.02]"
          >
            <span>{{ currentSlide.isEmpty ? 'Ver votaciones' : $t('common.actions.voteNow') }}</span>
            <span aria-hidden="true">→</span>
          </a>
          <a
            href="/ranking-popularity"
            class="flex min-h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 text-center text-sm font-bold text-slate-200 transition hover:bg-white/10"
          >
            {{ $t('widgets.hero.viewRankings') }}
          </a>
        </div>

        <div
          v-if="bannerSlides.length > 1"
          class="mt-7 flex items-center gap-3"
        >
          <button
            v-for="(_, index) in bannerSlides"
            :key="index"
            type="button"
            class="h-2 rounded-full transition-all"
            :class="activeSlide === index ? 'w-10 bg-fuchsia-300' : 'w-2 bg-white/30 hover:bg-white/60'"
            :aria-label="$t('widgets.hero.viewBanner', { number: index + 1 })"
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
