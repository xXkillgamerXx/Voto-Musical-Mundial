<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { translate } from '../i18n'
import { getPollResults, getPolls } from '../services/api/pollsApi'
import { applyPollLocale, resolvePollSlug } from '../utils/pollLocale'

const { locale } = useI18n()
const polls = ref([])
const isLoading = ref(true)
const errorMessage = ref('')

const getArtistImage = (artist) =>
  artist?.image ||
  artist?.imageUrl ||
  artist?.photo ||
  artist?.photoURL ||
  artist?.photoUrl ||
  artist?.foto ||
  artist?.banner ||
  ''

const pollYearForUrl = (poll) => {
  const year = poll.year || poll.config?.year || poll.categoryYear || poll.category?.year
  if (year) return year
  return locale.value === 'en' ? 'history' : 'historial'
}

const pollUrl = (poll) => {
  const year = pollYearForUrl(poll)
  const slug = resolvePollSlug(poll, locale.value)
  const prefix = locale.value === 'en' ? '/poll' : '/votacion'
  return `${prefix}/${year}/${slug}`
}

const categoryTitleFor = (poll) => {
  const localized = applyPollLocale(poll, locale.value)
  return localized.categoryName || localized.title || translate('hallOfFame.fallbackCategory')
}

const pollTitleFor = (poll) => {
  const localized = applyPollLocale(poll, locale.value)
  return localized.title || poll.title || ''
}

const yearFor = (poll) => {
  const year = Number(
    poll.year ||
      poll.config?.year ||
      poll.categoryYear ||
      poll.category?.year ||
      poll.category?.metadata?.year ||
      0,
  )
  return Number.isFinite(year) && year > 0 ? year : null
}

const winners = computed(() =>
  polls.value
    .filter((poll) => poll.status === 'closed' && poll.winnerArtist)
    .map((poll) => ({
      poll,
      artist: poll.winnerArtist,
      categoryTitle: categoryTitleFor(poll),
      pollTitle: pollTitleFor(poll),
      year: yearFor(poll),
    })),
)

const yearGroups = computed(() => {
  const groups = winners.value.reduce((result, entry) => {
    const year = entry.year
    const entries = result.get(year) || []
    entries.push(entry)
    result.set(year, entries)
    return result
  }, new Map())

  return [...groups.entries()]
    .sort(([currentYear], [nextYear]) => Number(nextYear || 0) - Number(currentYear || 0))
    .map(([year, entries]) => ({
      year,
      entries,
    }))
})

const pickWinnerIds = (poll, finalRound) => {
  const fromPoll = poll.winnerIds || poll.config?.winnerIds
  if (Array.isArray(fromPoll) && fromPoll.length) return fromPoll.map(String)

  const fromRound = finalRound?.winnerIds || finalRound?.config?.winnerIds
  if (Array.isArray(fromRound) && fromRound.length) return fromRound.map(String)

  return []
}

const resolveFinalRound = (poll) => {
  const rounds = Array.isArray(poll.rounds) ? poll.rounds : []
  const closed = rounds.filter((round) => round.status === 'closed')
  return closed.at(-1) || rounds.at(-1) || null
}

const hydratePollWinner = async (poll) => {
  if (poll.status !== 'closed') {
    return poll
  }

  const finalRound = resolveFinalRound(poll)
  const winnerIds = pickWinnerIds(poll, finalRound)

  try {
    const results = await getPollResults({
      pollId: poll.id,
      roundId: finalRound?.id,
    })
    const ranked = Array.isArray(results?.results) ? results.results : []

    let winnerArtist = null
    if (winnerIds.length) {
      const match = ranked.find((row) => String(row.artistId) === String(winnerIds[0]))
      winnerArtist = match?.artist || ranked[0]?.artist || null
    } else {
      winnerArtist = ranked[0]?.artist || null
    }

    if (!winnerArtist && finalRound?.id) {
      const rootResults = await getPollResults({ pollId: poll.id })
      winnerArtist = rootResults?.results?.[0]?.artist || null
    }

    return {
      ...poll,
      year: poll.year || poll.config?.year || null,
      winnerArtist,
    }
  } catch {
    return poll
  }
}

const loadPolls = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const payload = await getPolls(100)
    const list = Array.isArray(payload) ? payload : payload?.polls || []
    const pollDocs = list.filter((poll) => poll.status === 'closed')
    polls.value = await Promise.all(pollDocs.map((poll) => hydratePollWinner(poll)))
    isLoading.value = false
  } catch {
    errorMessage.value = translate('hallOfFame.errors.load')
    isLoading.value = false
  }
}

onMounted(loadPolls)
</script>

<template>
  <section class="hof mx-auto max-w-352 px-4 py-8 sm:px-6 lg:py-12">
    <header
      class="relative overflow-hidden rounded-[1.75rem] border border-amber-300/25 bg-[#080a18] px-6 py-8 shadow-2xl shadow-amber-950/20 sm:rounded-[2rem] sm:px-10 sm:py-11"
    >
      <div class="pointer-events-none absolute -left-20 -top-24 size-72 rounded-full bg-amber-300/20 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-28 right-0 size-96 rounded-full bg-fuchsia-400/15 blur-3xl"></div>
      <div class="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div class="max-w-2xl">
          <p class="text-xs font-black uppercase tracking-[0.32em] text-amber-200">
            {{ $t('hallOfFame.eyebrow') }}
          </p>
          <h1 class="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
            {{ $t('hallOfFame.title') }}
          </h1>
          <p class="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
            {{ $t('hallOfFame.description') }}
          </p>
        </div>
        <div
          v-if="!isLoading && winners.length"
          class="inline-flex items-center gap-2 self-start rounded-full border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-amber-100"
        >
          <i class="fa-solid fa-crown text-amber-300" aria-hidden="true"></i>
          {{ $t('hallOfFame.winnersCount', { count: winners.length }) }}
        </div>
      </div>
    </header>

    <p
      v-if="errorMessage"
      class="mt-6 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
    >
      {{ errorMessage }}
    </p>

    <p
      v-if="isLoading"
      class="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm font-bold text-slate-300"
    >
      {{ $t('hallOfFame.loading') }}
    </p>

    <div v-else-if="yearGroups.length" class="mt-8 space-y-12">
      <section v-for="group in yearGroups" :key="group.year" class="space-y-5">
        <div class="flex items-end justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.28em] text-amber-200">
              {{ $t('hallOfFame.year') }}
            </p>
            <h2 class="mt-1 text-4xl font-black text-white sm:text-5xl">
              {{ group.year || $t('hallOfFame.history') }}
            </h2>
          </div>
          <span
            class="rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-amber-100"
          >
            {{ $t('hallOfFame.winnersCount', { count: group.entries.length }) }}
          </span>
        </div>

        <!-- Un solo ganador: tarjeta hero a ancho completo -->
        <article
          v-if="group.entries.length === 1"
          class="hof-hero group relative overflow-hidden rounded-[1.75rem] border border-amber-300/25 bg-slate-950/70 shadow-2xl shadow-amber-950/25"
        >
          <div class="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div class="relative min-h-[320px] overflow-hidden sm:min-h-[420px]">
              <img
                v-if="getArtistImage(group.entries[0].artist)"
                :src="getArtistImage(group.entries[0].artist)"
                :alt="group.entries[0].artist.name"
                class="absolute inset-0 size-full object-cover object-center transition duration-700 group-hover:scale-[1.03]"
              />
              <div
                class="absolute inset-0 bg-linear-to-t from-[#080a18] via-[#080a18]/35 to-transparent lg:bg-linear-to-r lg:from-transparent lg:via-[#080a18]/20 lg:to-[#080a18]"
              ></div>
              <span
                class="absolute left-5 top-5 inline-flex items-center gap-2 rounded-2xl border border-amber-300/35 bg-amber-300/15 px-3 py-2 text-xs font-black uppercase tracking-widest text-amber-100 backdrop-blur"
              >
                <i class="fa-solid fa-trophy text-amber-300" aria-hidden="true"></i>
                #1
              </span>
            </div>

            <div class="relative flex flex-col justify-center gap-4 p-6 sm:p-8 lg:p-10">
              <p class="text-xs font-black uppercase tracking-[0.28em] text-amber-200">
                {{ group.entries[0].categoryTitle }}
              </p>
              <h3 class="text-4xl font-black leading-none text-white sm:text-5xl lg:text-6xl">
                {{ group.entries[0].artist.name }}
              </h3>
              <p class="max-w-md text-sm leading-7 text-slate-300 sm:text-base">
                {{ group.entries[0].pollTitle }}
              </p>
              <div class="mt-2 flex flex-wrap gap-3">
                <a
                  :href="pollUrl(group.entries[0].poll)"
                  class="inline-flex min-h-12 items-center justify-center rounded-full bg-linear-to-r from-amber-300 via-pink-400 to-fuchsia-500 px-6 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.02]"
                >
                  {{ $t('hallOfFame.viewPoll') }}
                </a>
                <span
                  class="inline-flex min-h-12 items-center rounded-full border border-white/10 bg-white/5 px-5 text-xs font-black uppercase tracking-wide text-slate-200"
                >
                  {{ $t('hallOfFame.champion') }}
                </span>
              </div>
            </div>
          </div>
        </article>

        <!-- Varios ganadores: grid -->
        <div
          v-else
          class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          <article
            v-for="(entry, index) in group.entries"
            :key="entry.poll.id"
            class="group overflow-hidden rounded-[1.5rem] border border-amber-300/20 bg-slate-950/55 shadow-xl shadow-violet-950/20 transition hover:-translate-y-1 hover:border-amber-300/40"
          >
            <div class="relative aspect-[4/5] overflow-hidden bg-linear-to-br from-amber-300/30 via-fuchsia-500/20 to-slate-950">
              <img
                v-if="getArtistImage(entry.artist)"
                :src="getArtistImage(entry.artist)"
                :alt="entry.artist.name"
                class="absolute inset-0 size-full object-cover object-center transition duration-500 group-hover:scale-105"
              />
              <div class="absolute inset-0 bg-linear-to-t from-[#080a18] via-[#080a18]/25 to-transparent"></div>
              <span
                class="absolute left-4 top-4 grid size-11 place-items-center rounded-2xl border border-amber-300/30 bg-amber-300/20 text-sm font-black text-amber-100 backdrop-blur"
              >
                #{{ index + 1 }}
              </span>
              <div class="absolute inset-x-0 bottom-0 p-5">
                <p class="text-[10px] font-black uppercase tracking-[0.28em] text-amber-200">
                  {{ entry.categoryTitle }}
                </p>
                <h3 class="mt-2 text-2xl font-black text-white sm:text-3xl">
                  {{ entry.artist.name }}
                </h3>
              </div>
            </div>

            <div class="space-y-4 p-5">
              <p class="line-clamp-2 text-sm leading-6 text-slate-400">
                {{ entry.pollTitle }}
              </p>
              <a
                :href="pollUrl(entry.poll)"
                class="inline-flex rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-fuchsia-100 transition hover:bg-fuchsia-400/20"
              >
                {{ $t('hallOfFame.viewPoll') }}
              </a>
            </div>
          </article>
        </div>
      </section>
    </div>

    <div
      v-else
      class="relative mt-8 overflow-hidden rounded-[1.75rem] border border-amber-300/15 bg-[#090b19]/90 p-8 text-center shadow-2xl shadow-amber-950/15 sm:p-12"
    >
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.18),transparent_34%),radial-gradient(circle_at_85%_75%,rgba(217,70,239,0.14),transparent_30%)]"
      ></div>
      <div
        class="relative mx-auto grid size-16 place-items-center rounded-3xl border border-amber-200/20 bg-amber-300/10 text-2xl text-amber-200 shadow-lg shadow-amber-950/20"
      >
        <i class="fa-solid fa-crown" aria-hidden="true"></i>
      </div>
      <h3 class="relative mt-5 text-xl font-black uppercase text-white">
        {{ $t('hallOfFame.emptyPreparingTitle') }}
      </h3>
      <p class="relative mx-auto mt-2 max-w-xl text-sm font-bold leading-6 text-slate-400">
        {{ $t('hallOfFame.emptyPreparingDescription') }}
      </p>
    </div>
  </section>
</template>
