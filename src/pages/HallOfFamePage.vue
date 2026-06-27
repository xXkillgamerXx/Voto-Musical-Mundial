<script setup>
import { computed, onMounted, ref } from 'vue'
import { translate } from '../i18n'
import { getPollResults, getPolls } from '../services/api/pollsApi'

const polls = ref([])
const isLoading = ref(true)
const errorMessage = ref('')

const getArtistImage = (artist) =>
  artist?.image || artist?.imageUrl || artist?.photo || artist?.photoURL || artist?.photoUrl || artist?.foto || artist?.banner || ''

const pollYearForUrl = (poll) => poll.year || poll.categoryYear || poll.category?.year || 'historial'
const pollUrl = (poll) => `/votacion/${pollYearForUrl(poll)}/${poll.slug || poll.id}`

const categoryTitleFor = (poll) => poll.categoryName || poll.category?.name || poll.title || translate('hallOfFame.fallbackCategory')
const yearFor = (poll) => {
  const year = Number(poll.year || poll.categoryYear || poll.category?.year || 0)
  return Number.isFinite(year) && year > 0 ? year : null
}

const winners = computed(() =>
  polls.value
    .filter((poll) => poll.status === 'closed' && poll.winnerArtist)
    .map((poll) => ({
      poll,
      artist: poll.winnerArtist,
      categoryTitle: categoryTitleFor(poll),
      year: yearFor(poll),
    }))
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

const hydratePollWinner = async (poll) => {
  if (poll.status !== 'closed') {
    return poll
  }

  try {
    const results = await getPollResults({ pollId: poll.id })
    return {
      ...poll,
      winnerArtist: results.results?.[0]?.artist || null,
    }
  } catch {
    return poll
  }
}

const loadPolls = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const pollDocs = (await getPolls(100)).filter((poll) => poll.status === 'closed')
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
  <section class="mx-auto max-w-352 px-4 py-8 sm:px-6 lg:py-12">
    <div class="relative overflow-hidden rounded-4xl border border-amber-300/25 bg-[#080a18] p-6 shadow-2xl shadow-amber-950/20 sm:p-10">
      <div class="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-amber-300/20 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-24 right-0 size-96 rounded-full bg-fuchsia-400/15 blur-3xl"></div>
      <div class="relative">
        <p class="text-xs font-black uppercase tracking-[0.32em] text-amber-200">
          {{ $t('hallOfFame.eyebrow') }}
        </p>
        <h1 class="mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl">
          {{ $t('hallOfFame.title') }}
        </h1>
        <p class="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
          {{ $t('hallOfFame.description') }}
        </p>
      </div>
    </div>

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

    <div v-else-if="yearGroups.length" class="mt-8 space-y-10">
      <section
        v-for="group in yearGroups"
        :key="group.year"
        class="rounded-4xl border border-white/10 bg-white/4 p-4 sm:p-6"
      >
        <div class="mb-5 flex items-center justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.28em] text-amber-200">
              {{ $t('hallOfFame.year') }}
            </p>
            <h2 class="mt-2 text-4xl font-black text-white">
              {{ group.year || 'Historial' }}
            </h2>
          </div>
          <span class="rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-amber-100">
            {{ $t('hallOfFame.winnersCount', { count: group.entries.length }) }}
          </span>
        </div>

        <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="(entry, index) in group.entries"
            :key="entry.poll.id"
            class="overflow-hidden rounded-4xl border border-amber-300/20 bg-slate-950/55 shadow-xl shadow-violet-950/20"
          >
            <div class="relative h-88 overflow-hidden bg-linear-to-br from-amber-300/30 via-fuchsia-500/20 to-slate-950 sm:h-96">
              <img
                v-if="getArtistImage(entry.artist)"
                :src="getArtistImage(entry.artist)"
                :alt="entry.artist.name"
                class="absolute inset-0 size-full object-cover object-top"
              />
              <div class="absolute inset-0 bg-linear-to-t from-[#080a18] via-[#080a18]/18 to-white/5"></div>
              <span class="absolute left-5 top-5 grid size-13 place-items-center rounded-2xl border border-amber-300/30 bg-amber-300/20 text-sm font-black text-amber-100 backdrop-blur">
                #{{ index + 1 }}
              </span>
            </div>

            <div class="p-5">
              <p class="text-xs font-black uppercase tracking-[0.28em] text-amber-200">
                {{ entry.categoryTitle }}
              </p>
              <h3 class="mt-3 text-3xl font-black text-white">{{ entry.artist.name }}</h3>
              <p class="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                {{ entry.poll.title }}
              </p>
              <a
                :href="pollUrl(entry.poll)"
                class="mt-5 inline-flex rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-5 py-2 text-xs font-black uppercase tracking-wide text-fuchsia-100 transition hover:bg-fuchsia-400/20"
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
      class="relative mt-8 overflow-hidden rounded-4xl border border-amber-300/15 bg-[#090b19]/90 p-8 text-center shadow-2xl shadow-amber-950/15"
    >
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.18),transparent_34%),radial-gradient(circle_at_85%_75%,rgba(217,70,239,0.14),transparent_30%)]"></div>
      <div class="relative mx-auto grid size-16 place-items-center rounded-3xl border border-amber-200/20 bg-amber-300/10 text-2xl text-amber-200 shadow-lg shadow-amber-950/20">
        <i class="fa-solid fa-crown" aria-hidden="true"></i>
      </div>
      <h3 class="relative mt-5 text-xl font-black uppercase text-white">
        Salon de la fama en preparacion
      </h3>
      <p class="relative mx-auto mt-2 max-w-xl text-sm font-bold leading-6 text-slate-400">
        Cuando una votacion cerrada tenga ganador, aparecera aqui como parte del historial oficial.
      </p>
    </div>
  </section>
</template>
