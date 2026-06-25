<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { collection, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore'
import { translate } from '../i18n'
import { db } from '../firebase'

const polls = ref([])
const artists = ref([])
const categories = ref([])
const isLoading = ref(true)
const errorMessage = ref('')
let unsubscribePolls = null

const getArtist = (artistId) => artists.value.find((artist) => artist.id === artistId)
const getCategory = (categoryId) => categories.value.find((category) => category.id === categoryId)
const getArtistImage = (artist) =>
  artist?.image || artist?.imageUrl || artist?.photo || artist?.photoURL || artist?.foto || artist?.banner || ''

const pollUrl = (poll) => `/votacion/${poll.year || new Date().getFullYear()}/${poll.slug || poll.id}`

const categoryTitleFor = (poll) => poll.categoryName || getCategory(poll.categoryId)?.name || poll.title || translate('hallOfFame.fallbackCategory')
const yearFor = (poll) => Number(poll.year || getCategory(poll.categoryId)?.year || new Date().getFullYear())

const winners = computed(() =>
  polls.value
    .filter((poll) => poll.status === 'closed' && poll.winnerIds?.length)
    .map((poll) => ({
      poll,
      artist: getArtist(poll.winnerIds[0]),
      categoryTitle: categoryTitleFor(poll),
      year: yearFor(poll),
    }))
    .filter((entry) => entry.artist),
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
    .sort(([currentYear], [nextYear]) => nextYear - currentYear)
    .map(([year, entries]) => ({
      year,
      entries,
    }))
})

const loadArtists = async () => {
  const artistsSnap = await getDocs(query(collection(db, 'artists'), orderBy('createdAt', 'desc')))
  artists.value = artistsSnap.docs.map((artistDoc) => ({
    id: artistDoc.id,
    ...artistDoc.data(),
  }))
}

const loadCategories = async () => {
  const categoriesSnap = await getDocs(collection(db, 'pollCategories'))
  categories.value = categoriesSnap.docs.map((categoryDoc) => ({
    id: categoryDoc.id,
    ...categoryDoc.data(),
  })).sort((current, next) =>
    Number(next.year || 0) - Number(current.year || 0)
      || String(current.name || '').localeCompare(String(next.name || '')),
  )
}

const hydratePollWinner = async (poll) => {
  if (poll.winnerIds?.length || poll.status !== 'closed') {
    return poll
  }

  try {
    const roundsSnap = await getDocs(query(collection(db, 'polls', poll.id, 'rounds'), orderBy('createdAt', 'asc')))
    const finalRound = roundsSnap.docs
      .map((roundDoc) => ({
        id: roundDoc.id,
        ...roundDoc.data(),
      }))
      .filter((round) => round.status === 'closed' && round.winnerIds?.length)
      .at(-1)

    return {
      ...poll,
      winnerIds: finalRound?.winnerIds || [],
    }
  } catch {
    return poll
  }
}

const loadPolls = () => {
  isLoading.value = true
  errorMessage.value = ''

  unsubscribePolls = onSnapshot(
    query(collection(db, 'polls'), orderBy('createdAt', 'desc')),
    async (pollsSnap) => {
      const pollDocs = pollsSnap.docs.map((pollDoc) => ({
        id: pollDoc.id,
        ...pollDoc.data(),
      }))
      polls.value = await Promise.all(pollDocs.map((poll) => hydratePollWinner(poll)))
      isLoading.value = false
    },
    () => {
      errorMessage.value = translate('hallOfFame.errors.load')
      isLoading.value = false
    },
  )
}

onMounted(async () => {
  await loadArtists()
  await loadCategories()
  loadPolls()
})

onUnmounted(() => {
  unsubscribePolls?.()
})
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
            <h2 class="mt-2 text-4xl font-black text-white">{{ group.year }}</h2>
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

    <p
      v-else
      class="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm font-bold text-slate-400"
    >
      {{ $t('hallOfFame.empty') }}
    </p>
  </section>
</template>
