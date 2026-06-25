<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { translate } from '../../i18n'

const props = defineProps({
  pollId: {
    type: String,
    required: true,
  },
})

const poll = ref(null)
const artists = ref([])
const contestants = ref([])
const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')
let unsubscribeContestants = null

const contestantIds = computed(() => new Set(contestants.value.map((contestant) => contestant.artistId)))

const getArtistImage = (artist) =>
  artist?.image || artist?.imageUrl || artist?.photo || artist?.photoURL || artist?.foto || artist?.banner || ''

const getArtistGroup = (artist) => artist?.group || artist?.fandom || ''

const getArtist = (artistId) => artists.value.find((artist) => artist.id === artistId)

const availableArtists = computed(() =>
  artists.value.filter((artist) => !contestantIds.value.has(artist.id)),
)

const currentContestants = computed(() =>
  contestants.value.map((contestant) => ({
    ...contestant,
    artist: getArtist(contestant.artistId),
  })),
)

const loadBaseData = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const [pollSnap, artistsSnap] = await Promise.all([
      getDoc(doc(db, 'polls', props.pollId)),
      getDocs(query(collection(db, 'artists'), orderBy('createdAt', 'desc'))),
    ])

    if (!pollSnap.exists()) {
      errorMessage.value = translate('admin.contestants.errors.missingPoll')
      return
    }

    poll.value = { id: pollSnap.id, ...pollSnap.data() }
    artists.value = artistsSnap.docs.map((artistDoc) => ({
      id: artistDoc.id,
      ...artistDoc.data(),
    }))
  } catch {
    errorMessage.value = translate('admin.contestants.errors.load')
  } finally {
    isLoading.value = false
  }
}

const listenContestants = () => {
  unsubscribeContestants = onSnapshot(
    collection(db, 'polls', props.pollId, 'contestants'),
    (contestantsSnap) => {
      contestants.value = contestantsSnap.docs.map((contestantDoc) => ({
        id: contestantDoc.id,
        ...contestantDoc.data(),
      }))
    },
    () => {
      errorMessage.value = translate('admin.contestants.errors.listen')
    },
  )
}

const addContestant = async (artist) => {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await setDoc(doc(db, 'polls', props.pollId, 'contestants', artist.id), {
      artistId: artist.id,
      votes: 0,
      manualVotes: 0,
      totalVotes: 0,
      isWinner: false,
      winnerRank: null,
      addedAt: serverTimestamp(),
    })
    successMessage.value = translate('admin.contestants.added')
  } catch {
    errorMessage.value = translate('admin.contestants.errors.add')
  }
}

const removeContestant = async (contestant) => {
  const artist = getArtist(contestant.artistId)
  const shouldRemove = window.confirm(translate('admin.contestants.confirmRemove', {
    name: artist?.name || translate('admin.common.artist'),
  }))

  if (!shouldRemove) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await deleteDoc(doc(db, 'polls', props.pollId, 'contestants', contestant.id))
    successMessage.value = translate('admin.contestants.removed')
  } catch {
    errorMessage.value = translate('admin.contestants.errors.remove')
  }
}

onMounted(async () => {
  await loadBaseData()
  listenContestants()
})

onUnmounted(() => {
  unsubscribeContestants?.()
})
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
          {{ $t('admin.contestants.eyebrow') }}
        </p>
        <h2 class="mt-2 text-3xl font-black text-white">
          {{ poll?.title || $t('admin.contestants.defaultPoll') }}
        </h2>
        <p class="mt-2 text-sm text-slate-400">
          {{ $t('admin.contestants.description') }}
        </p>
      </div>

      <a
        href="/admin/votaciones"
        class="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
      >
        {{ $t('admin.common.backToPolls') }}
      </a>
    </div>

    <p
      v-if="successMessage"
      class="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200"
    >
      {{ successMessage }}
    </p>
    <p
      v-if="errorMessage"
      class="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
    >
      {{ errorMessage }}
    </p>

    <div
      v-if="isLoading"
      class="rounded-3xl border border-white/10 bg-white/4 p-5 text-sm font-bold text-slate-300"
    >
      {{ $t('admin.contestants.loading') }}
    </div>

    <div v-else class="grid gap-6 xl:grid-cols-2">
      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <h3 class="text-2xl font-black text-white">{{ $t('admin.contestants.available') }}</h3>
        <div class="mt-5 space-y-3">
          <div
            v-for="artist in availableArtists"
            :key="artist.id"
            class="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4"
          >
            <div class="flex min-w-0 items-center gap-3">
              <span class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white">
                <img
                  v-if="getArtistImage(artist)"
                  :src="getArtistImage(artist)"
                  :alt="artist.name"
                  class="size-full object-cover"
                />
                <span v-else>{{ artist.name?.charAt(0) || 'A' }}</span>
              </span>
              <span class="min-w-0">
                <span class="block truncate font-black text-white">{{ artist.name }}</span>
                <span class="block truncate text-xs text-slate-400">{{ getArtistGroup(artist) || $t('admin.common.noGroup') }}</span>
              </span>
            </div>
            <button
              type="button"
              class="rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-2 text-xs font-black text-fuchsia-100 transition hover:bg-fuchsia-400/20"
              @click="addContestant(artist)"
            >
              {{ $t('admin.contestants.add') }}
            </button>
          </div>
          <p v-if="!availableArtists.length" class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400">
            {{ $t('admin.contestants.emptyAvailable') }}
          </p>
        </div>
      </article>

      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <h3 class="text-2xl font-black text-white">{{ $t('admin.contestants.current') }}</h3>
        <div class="mt-5 space-y-3">
          <div
            v-for="contestant in currentContestants"
            :key="contestant.id"
            class="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4"
          >
            <div class="flex min-w-0 items-center gap-3">
              <span class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-cyan-500 to-blue-500 text-sm font-black text-white">
                <img
                  v-if="getArtistImage(contestant.artist)"
                  :src="getArtistImage(contestant.artist)"
                  :alt="contestant.artist?.name"
                  class="size-full object-cover"
                />
                <span v-else>{{ contestant.artist?.name?.charAt(0) || 'A' }}</span>
              </span>
              <span class="min-w-0">
                <span class="block truncate font-black text-white">{{ contestant.artist?.name || $t('admin.common.artist') }}</span>
                <span class="block truncate text-xs text-slate-400">
                  {{ $t('admin.common.votes', { count: contestant.totalVotes || 0 }) }}
                </span>
              </span>
            </div>
            <button
              type="button"
              class="rounded-full border border-red-300/25 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 transition hover:bg-red-500/20"
              @click="removeContestant(contestant)"
            >
              {{ $t('admin.contestants.remove') }}
            </button>
          </div>
          <p v-if="!currentContestants.length" class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400">
            {{ $t('admin.contestants.emptyCurrent') }}
          </p>
        </div>
      </article>
    </div>
  </section>
</template>
