<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
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
const selectedWinnerIds = ref([])
const errorMessage = ref('')
const successMessage = ref('')
let unsubscribePoll = null
let unsubscribeContestants = null

const getArtist = (artistId) => artists.value.find((artist) => artist.id === artistId)
const getArtistImage = (artist) =>
  artist?.image || artist?.imageUrl || artist?.photo || artist?.photoURL || artist?.foto || artist?.banner || ''

const rankedContestants = computed(() =>
  contestants.value
    .map((contestant) => ({
      ...contestant,
      artist: getArtist(contestant.artistId),
      totalVotes: Number(contestant.totalVotes ?? ((contestant.votes || 0) + (contestant.manualVotes || 0))),
    }))
    .sort((current, next) => next.totalVotes - current.totalVotes),
)

const loadArtists = async () => {
  const artistsSnap = await getDocs(query(collection(db, 'artists'), orderBy('createdAt', 'desc')))
  artists.value = artistsSnap.docs.map((artistDoc) => ({
    id: artistDoc.id,
    ...artistDoc.data(),
  }))
}

const listenPoll = () => {
  unsubscribePoll = onSnapshot(doc(db, 'polls', props.pollId), (pollSnap) => {
    poll.value = pollSnap.exists() ? { id: pollSnap.id, ...pollSnap.data() } : null
    selectedWinnerIds.value = poll.value?.winnerIds || []
  })
}

const listenContestants = () => {
  unsubscribeContestants = onSnapshot(collection(db, 'polls', props.pollId, 'contestants'), (contestantsSnap) => {
    contestants.value = contestantsSnap.docs.map((contestantDoc) => ({
      id: contestantDoc.id,
      ...contestantDoc.data(),
    }))
  })
}

const toggleWinner = (artistId) => {
  if (selectedWinnerIds.value.includes(artistId)) {
    selectedWinnerIds.value = selectedWinnerIds.value.filter((winnerId) => winnerId !== artistId)
    return
  }

  selectedWinnerIds.value = [...selectedWinnerIds.value, artistId]
}

const saveWinners = async () => {
  if (!selectedWinnerIds.value.length) {
    errorMessage.value = translate('admin.winners.selectOne')
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    const batch = writeBatch(db)
    const selectedRank = new Map(selectedWinnerIds.value.map((artistId, index) => [artistId, index + 1]))

    contestants.value.forEach((contestant) => {
      batch.update(doc(db, 'polls', props.pollId, 'contestants', contestant.id), {
        isWinner: selectedRank.has(contestant.artistId),
        winnerRank: selectedRank.get(contestant.artistId) || null,
      })
    })

    batch.update(doc(db, 'polls', props.pollId), {
      winnerIds: selectedWinnerIds.value,
      winnersStatus: 'selected',
      status: 'closed',
      isLive: false,
      updatedAt: serverTimestamp(),
    })

    await batch.commit()
    successMessage.value = translate('admin.winners.saved')
  } catch {
    errorMessage.value = translate('admin.winners.errors.save')
  }
}

onMounted(async () => {
  await loadArtists()
  listenPoll()
  listenContestants()
})

onUnmounted(() => {
  unsubscribePoll?.()
  unsubscribeContestants?.()
})
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
          Ganadores
        </p>
        <h2 class="mt-2 text-3xl font-black text-white">
          {{ poll?.title || 'Votacion' }}
        </h2>
        <p class="mt-2 text-sm text-slate-400">
          Elige y guarda ganadores para cerrar la votacion.
        </p>
      </div>

      <a
        :href="`/admin/votaciones/${props.pollId}/monitor`"
        class="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
      >
        Volver al monitor
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

    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div class="space-y-3">
        <button
          v-for="(contestant, index) in rankedContestants"
          :key="contestant.id"
          type="button"
          class="flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition"
          :class="
            selectedWinnerIds.includes(contestant.artistId)
              ? 'border-fuchsia-300/45 bg-fuchsia-400/15'
              : 'border-white/10 bg-slate-950/45 hover:bg-white/5'
          "
          @click="toggleWinner(contestant.artistId)"
        >
          <span class="text-2xl font-black text-fuchsia-200">#{{ index + 1 }}</span>
          <span class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white">
            <img
              v-if="getArtistImage(contestant.artist)"
              :src="getArtistImage(contestant.artist)"
              :alt="contestant.artist?.name"
              class="size-full object-cover"
            />
            <span v-else>{{ contestant.artist?.name?.charAt(0) || 'A' }}</span>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-black text-white">{{ contestant.artist?.name || 'Artista' }}</span>
            <span class="block text-sm text-slate-400">{{ contestant.totalVotes }} votos</span>
          </span>
          <span
            v-if="selectedWinnerIds.includes(contestant.artistId)"
            class="rounded-full border border-fuchsia-300/35 bg-fuchsia-400/15 px-3 py-1 text-xs font-black text-fuchsia-100"
          >
            Ganador
          </span>
        </button>
      </div>

      <button
        type="button"
        class="mt-6 min-h-12 w-full rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01]"
        @click="saveWinners"
      >
        Guardar ganadores y cerrar
      </button>
    </article>
  </section>
</template>
