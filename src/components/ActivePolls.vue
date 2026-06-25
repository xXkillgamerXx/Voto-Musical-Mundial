<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { collection, onSnapshot } from 'firebase/firestore'
import { useI18n } from 'vue-i18n'
import { translate } from '../i18n'
import { db } from '../firebase'
import { subscribeLivePollsCached } from '../services/firebaseCache'

const { locale } = useI18n()
const polls = ref([])
const now = ref(Date.now())

const timeLabels = computed(() => [
  translate('home.activePolls.time.days'),
  translate('home.activePolls.time.hours'),
  translate('home.activePolls.time.minutes'),
  translate('home.activePolls.time.seconds'),
])

let unsubscribePolls = null
let clockTimer = null
const activeRoundEndListeners = new Map()

const pollUrl = (poll) => `/votacion/${poll.year || new Date().getFullYear()}/${poll.slug || poll.id}`

const countdownFor = (poll) => {
  if (poll.status === 'selecting_winners') {
    return [
      translate('home.activePolls.processParts.one'),
      translate('home.activePolls.processParts.two'),
      translate('home.activePolls.processParts.three'),
      translate('home.activePolls.processParts.four'),
    ]
  }

  const endDate = poll.activeEndAt?.toDate?.() || poll.endAt?.toDate?.() || poll.activeRoundEndAt?.toDate?.()

  if (!endDate) {
    return ['LIVE', '', '', '']
  }

  const remainingSeconds = Math.max(Math.floor((endDate.getTime() - now.value) / 1000), 0)
  const days = Math.floor(remainingSeconds / 86400)
  const hours = Math.floor((remainingSeconds % 86400) / 3600)
  const minutes = Math.floor((remainingSeconds % 3600) / 60)
  const seconds = remainingSeconds % 60
  const formatValue = (value) => String(value).padStart(2, '0')

  return [formatValue(days), formatValue(hours), formatValue(minutes), formatValue(seconds)]
}

const getPollEndAt = (poll) => poll.activeEndAt || poll.endAt || null

const syncActiveRoundEndListeners = (pollRows) => {
  activeRoundEndListeners.forEach((listener, pollId) => {
    const poll = pollRows.find((item) => item.id === pollId)
    const activeRoundKey = poll?.activeRoundId || ''

    if (!poll || getPollEndAt(poll) || listener.roundId !== activeRoundKey) {
      listener.unsubscribe()
      activeRoundEndListeners.delete(pollId)
    }
  })

  pollRows.forEach((poll) => {
    if (getPollEndAt(poll) || activeRoundEndListeners.has(poll.id)) {
      return
    }

    const unsubscribe = onSnapshot(collection(db, 'polls', poll.id, 'rounds'), (roundsSnap) => {
      const rounds = roundsSnap.docs.map((roundDoc) => ({
        id: roundDoc.id,
        ...roundDoc.data(),
      }))
      const activeRound = rounds.find((round) => round.id === poll.activeRoundId)
        || rounds.find((round) => round.status === 'live')
        || rounds[0]
        || null

      polls.value = polls.value.map((currentPoll) =>
        currentPoll.id === poll.id
          ? {
              ...currentPoll,
              activeRoundId: currentPoll.activeRoundId || activeRound?.id || '',
              activeRoundEndAt: activeRound?.endAt || null,
            }
          : currentPoll,
      )
    })

    activeRoundEndListeners.set(poll.id, {
      roundId: poll.activeRoundId || '',
      unsubscribe,
    })
  })
}

const activePolls = computed(() =>
  {
    locale.value

    return polls.value.map((poll, index) => ({
      ...poll,
      question: poll.status === 'selecting_winners'
        ? translate('home.activePolls.countingQuestion')
        : poll.description || translate('home.activePolls.defaultQuestion'),
      statusLabel: poll.status === 'selecting_winners'
        ? translate('polls.status.selectingWinners')
        : translate('polls.status.live'),
      actionLabel: poll.status === 'selecting_winners'
        ? translate('home.activePolls.processAction')
        : translate('common.actions.vote'),
      time: countdownFor(poll),
      visual: [
        'from-violet-950 via-fuchsia-700 to-indigo-950',
        'from-slate-800 via-violet-700 to-slate-950',
        'from-fuchsia-900 via-pink-700 to-slate-950',
      ][index % 3],
    }))
  },
)

onMounted(() => {
  unsubscribePolls = subscribeLivePollsCached(db, (pollRows) => {
    const previousPolls = new Map(polls.value.map((poll) => [poll.id, poll]))

    polls.value = pollRows.map((poll) => {
      const previousPoll = previousPolls.get(poll.id)
      const activeRoundId = poll.activeRoundId || previousPoll?.activeRoundId || ''

      return {
        ...poll,
        activeRoundId,
        activeEndAt: getPollEndAt(poll),
        activeRoundEndAt: previousPoll?.activeRoundEndAt || null,
      }
    })

    syncActiveRoundEndListeners(pollRows)
  })

  clockTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  unsubscribePolls?.()
  activeRoundEndListeners.forEach((listener) => listener.unsubscribe())
  activeRoundEndListeners.clear()
  window.clearInterval(clockTimer)
})
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-6 sm:px-6 lg:py-8">
    <div class="mb-5 flex items-center justify-between gap-4">
      <h2 class="flex items-center gap-2 text-lg font-black uppercase tracking-tight sm:text-xl">
        <span class="text-fuchsia-300">✦</span>
        {{ $t('home.activePolls.title') }}
      </h2>
      <span class="text-xs font-black uppercase tracking-wide text-violet-300">
        {{ $t('home.activePolls.eyebrow') }}
      </span>
    </div>

    <div
      v-if="!activePolls.length"
      class="relative overflow-hidden rounded-4xl border border-violet-300/15 bg-[#080a18]/90 p-6 shadow-2xl shadow-violet-950/20 sm:p-8"
    >
      <div class="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-fuchsia-400/15 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-24 right-0 size-72 rounded-full bg-cyan-400/10 blur-3xl"></div>
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_46%,rgba(217,70,239,0.16),transparent_24%)]"></div>
      <div class="relative grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-center">
        <div class="grid size-18 place-items-center rounded-3xl border border-fuchsia-300/25 bg-fuchsia-400/10 text-3xl text-fuchsia-100 shadow-xl shadow-fuchsia-950/20">
          <i class="fa-solid fa-tower-broadcast" aria-hidden="true"></i>
        </div>

        <div>
          <div class="flex flex-wrap gap-2">
            <span class="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-100">
              {{ $t('home.activePolls.emptySoon') }}
            </span>
            <span class="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
              {{ $t('home.activePolls.emptyNoLive') }}
            </span>
          </div>
          <h3 class="mt-2 text-2xl font-black text-white">
            {{ $t('home.activePolls.emptyTitle') }}
          </h3>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            {{ $t('home.activePolls.emptyDescription') }}
          </p>
          <div class="mt-4 flex flex-wrap gap-2">
            <span class="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-black text-fuchsia-100">
              <i class="fa-solid fa-bell mr-1" aria-hidden="true"></i>
              {{ $t('home.activePolls.stayTuned') }}
            </span>
            <span class="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-100">
              <i class="fa-solid fa-ranking-star mr-1" aria-hidden="true"></i>
              {{ $t('home.activePolls.checkRankings') }}
            </span>
          </div>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row md:flex-col">
          <a
            href="/ranking-popularity"
            class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/8 px-5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-white/12"
          >
            {{ $t('home.activePolls.viewRanking') }}
          </a>
          <a
            href="/salon-de-la-fama"
            class="inline-flex min-h-11 items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/25 transition hover:scale-[1.01]"
          >
            {{ $t('home.activePolls.hallOfFame') }}
          </a>
        </div>
      </div>
    </div>

    <div v-else class="mobile-active-polls-slider -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:hidden">
      <article
        v-for="poll in activePolls"
        :key="poll.id"
        class="min-w-[90%] snap-center overflow-hidden rounded-2xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25"
      >
        <div
          class="relative h-56 overflow-hidden bg-linear-to-br"
          :class="poll.visual"
        >
          <img
            v-if="poll.banner"
            :src="poll.banner"
            :alt="poll.title"
            class="absolute inset-0 size-full object-cover"
          />
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.26),transparent_24%),radial-gradient(circle_at_70%_70%,rgba(217,70,239,0.35),transparent_28%)]"></div>
          <div class="absolute inset-0 bg-linear-to-t from-[#080a17] via-transparent to-white/5"></div>
        </div>

        <div class="p-5">
          <h3 class="text-lg font-black uppercase">{{ poll.title }}</h3>
          <p class="mt-1 text-sm text-slate-400">{{ poll.question }}</p>

          <div
            v-if="poll.time[0] === 'LIVE'"
            class="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-center shadow-inner shadow-black/30"
          >
            <p class="text-lg font-black text-emerald-100">{{ $t('polls.status.live') }}</p>
            <p class="text-[10px] font-bold uppercase text-emerald-200/70">
              {{ $t('home.activePolls.noDefinedEnd') }}
            </p>
          </div>
          <div v-else class="mt-5 grid grid-cols-4 gap-2">
            <div
              v-for="(value, index) in poll.time"
              :key="`${poll.id}-mobile-${index}`"
              class="rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-center shadow-inner shadow-black/30"
            >
              <p class="text-lg font-black">{{ value }}</p>
              <p class="text-[10px] font-bold uppercase text-slate-500">
                {{ poll.status === 'selecting_winners' || value === 'LIVE' ? '' : timeLabels[index] }}
              </p>
            </div>
          </div>

          <a
            :href="pollUrl(poll)"
            class="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-9 text-sm font-black uppercase tracking-wide shadow-lg shadow-fuchsia-500/25"
          >
            {{ poll.actionLabel }}
          </a>
        </div>
      </article>
    </div>

    <div v-if="activePolls.length" class="hidden space-y-3 md:block">
      <article
        v-for="poll in activePolls"
        :key="poll.id"
        class="grid min-h-50 overflow-hidden rounded-2xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25 transition hover:border-fuchsia-300/30 hover:bg-[#101226] md:grid-cols-[20rem_1fr_auto_auto] md:items-center"
      >
        <div
          class="relative h-60 overflow-hidden bg-linear-to-br md:h-50"
          :class="poll.visual"
        >
          <img
            v-if="poll.banner"
            :src="poll.banner"
            :alt="poll.title"
            class="absolute inset-0 size-full object-cover"
          />
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.26),transparent_24%),radial-gradient(circle_at_70%_70%,rgba(217,70,239,0.35),transparent_28%)]"></div>
          <div class="absolute inset-0 bg-linear-to-t from-[#080a17] via-transparent to-white/5"></div>
        </div>

        <div class="px-5 py-5 md:px-6">
          <h3 class="text-lg font-black uppercase">{{ poll.title }}</h3>
          <p class="mt-1 text-sm text-slate-400">{{ poll.question }}</p>
        </div>

        <div
          v-if="poll.time[0] === 'LIVE'"
          class="px-4 md:px-2"
        >
          <div class="min-w-40 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-center shadow-inner shadow-black/30">
            <p class="text-xl font-black text-emerald-100">{{ $t('polls.status.live') }}</p>
            <p class="text-[10px] font-bold uppercase text-emerald-200/70">
              {{ $t('home.activePolls.noDefinedEnd') }}
            </p>
          </div>
        </div>
        <div v-else class="grid grid-cols-4 gap-2 px-4 md:px-2">
          <div
            v-for="(value, index) in poll.time"
            :key="`${poll.id}-${index}`"
            class="min-w-17 rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-center shadow-inner shadow-black/30"
          >
            <p class="text-xl font-black">{{ value }}</p>
            <p class="text-[10px] font-bold uppercase text-slate-500">
              {{ poll.status === 'selecting_winners' || value === 'LIVE' ? '' : timeLabels[index] }}
            </p>
          </div>
        </div>

        <a
          :href="pollUrl(poll)"
          class="m-4 flex min-h-12 min-w-28 items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-9 text-sm font-black uppercase tracking-wide shadow-lg shadow-fuchsia-500/25 md:ml-2"
        >
          {{ poll.actionLabel }}
        </a>
      </article>
    </div>
  </section>
</template>

<style scoped>
.mobile-active-polls-slider {
  scrollbar-width: none;
}

.mobile-active-polls-slider::-webkit-scrollbar {
  display: none;
}
</style>
