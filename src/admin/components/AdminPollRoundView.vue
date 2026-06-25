<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../firebase'

const props = defineProps({
  pollId: {
    type: String,
    required: true,
  },
  roundId: {
    type: String,
    required: true,
  },
})

const poll = ref(null)
const round = ref(null)
const rounds = ref([])
const artists = ref([])
const roundContestants = ref([])
const roundForm = ref({
  title: '',
  type: 'list',
  status: 'draft',
  endAt: '',
})
const isDeleteModalOpen = ref(false)
const isGroupModalOpen = ref(false)
const isRemoveContestantModalOpen = ref(false)
const isSavingRound = ref(false)
const isDeletingRound = ref(false)
const isRemovingContestant = ref(false)
const roundEndAtInput = ref(null)
const selectedGroupArtistIds = ref([])
const contestantToRemove = ref(null)
const errorMessage = ref('')
const successMessage = ref('')
let unsubscribePoll = null
let unsubscribeRound = null
let unsubscribeRounds = null
let unsubscribeRoundContestants = null

const roundArtistIds = computed(() => new Set(roundContestants.value.map((contestant) => contestant.artistId)))
const currentRoundIndex = computed(() => rounds.value.findIndex((item) => item.id === props.roundId))
const previousRound = computed(() => {
  if (currentRoundIndex.value <= 0) {
    return null
  }

  return rounds.value[currentRoundIndex.value - 1] || null
})
const previousWinnerIds = computed(() => previousRound.value?.winnerIds || [])
const availableArtists = computed(() => {
  const sourceArtists = previousRound.value
    ? artists.value.filter((artist) => previousWinnerIds.value.includes(artist.id))
    : artists.value

  return sourceArtists.filter((artist) => !roundArtistIds.value.has(artist.id))
})
const currentContestants = computed(() =>
  roundContestants.value
    .map((contestant, index) => ({
      ...contestant,
      order: Number(contestant.order ?? index),
      artist: artists.value.find((artist) => artist.id === contestant.artistId),
    }))
    .sort((current, next) => current.order - next.order),
)

const orderedVersusContestants = computed(() =>
  currentContestants.value
    .map((contestant, index) => ({
      ...contestant,
      matchGroup: Number(contestant.matchGroup || 0),
      matchOrder: Number(contestant.matchOrder ?? index),
    }))
    .sort((current, next) => {
      if (current.matchGroup !== next.matchGroup) {
        return current.matchGroup - next.matchGroup
      }

      return current.matchOrder - next.matchOrder
    }),
)

const versusGroups = computed(() => {
  const manualGroups = orderedVersusContestants.value.reduce((groups, contestant) => {
    if (!contestant.matchGroup) {
      return groups
    }

    const group = groups.get(contestant.matchGroup) || []
    group.push(contestant)
    groups.set(contestant.matchGroup, group)
    return groups
  }, new Map())

  if (manualGroups.size) {
    return [...manualGroups.entries()]
      .sort(([currentGroup], [nextGroup]) => currentGroup - nextGroup)
      .map(([groupNumber, contestants]) => ({
        groupNumber,
        contestants: contestants.sort((current, next) => current.matchOrder - next.matchOrder),
      }))
  }

  const groups = []

  for (let index = 0; index < currentContestants.value.length; index += 2) {
    groups.push({
      groupNumber: Math.floor(index / 2) + 1,
      contestants: currentContestants.value.slice(index, index + 2),
    })
  }

  return groups
})

const ungroupedContestants = computed(() =>
  currentContestants.value.filter((contestant) => !contestant.matchGroup),
)

const getArtistImage = (artist) =>
  artist?.image || artist?.imageUrl || artist?.photo || artist?.photoURL || artist?.foto || artist?.banner || ''

const getArtistGroup = (artist) => artist?.group || artist?.fandom || ''
const availableArtistsHelp = computed(() =>
  previousRound.value
    ? `Solo puedes asignar ganadores de ${previousRound.value.title || 'la ronda anterior'}.`
    : 'Agrega artistas a esta ronda.',
)

const formatDate = (value) => {
  const date = value?.toDate?.() || null
  return date
    ? new Intl.DateTimeFormat('es', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    : 'Sin fecha'
}

const toDatetimeLocal = (value) => {
  const date = value?.toDate?.()

  if (!date) {
    return ''
  }

  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

const toTimestamp = (value) => (value ? Timestamp.fromDate(new Date(value)) : null)

const openDatePicker = (input) => {
  input?.focus()
  input?.showPicker?.()
}

const loadArtists = async () => {
  const artistsSnap = await getDocs(query(collection(db, 'artists'), orderBy('createdAt', 'desc')))
  artists.value = artistsSnap.docs.map((artistDoc) => ({
    id: artistDoc.id,
    ...artistDoc.data(),
  }))
}

const listenBaseData = () => {
  unsubscribePoll = onSnapshot(doc(db, 'polls', props.pollId), (pollSnap) => {
    poll.value = pollSnap.exists() ? { id: pollSnap.id, ...pollSnap.data() } : null
  })

  unsubscribeRound = onSnapshot(doc(db, 'polls', props.pollId, 'rounds', props.roundId), (roundSnap) => {
    round.value = roundSnap.exists() ? { id: roundSnap.id, ...roundSnap.data() } : null

    if (round.value) {
      roundForm.value = {
        title: round.value.title || '',
        type: round.value.type || 'list',
        status: round.value.status || 'draft',
        endAt: toDatetimeLocal(round.value.endAt),
      }
    }
  })

  unsubscribeRounds = onSnapshot(
    query(collection(db, 'polls', props.pollId, 'rounds'), orderBy('createdAt', 'asc')),
    (roundsSnap) => {
      rounds.value = roundsSnap.docs.map((roundDoc) => ({
        id: roundDoc.id,
        ...roundDoc.data(),
      }))
    },
  )

  unsubscribeRoundContestants = onSnapshot(
    collection(db, 'polls', props.pollId, 'rounds', props.roundId, 'contestants'),
    (contestantsSnap) => {
      roundContestants.value = contestantsSnap.docs.map((contestantDoc) => ({
        id: contestantDoc.id,
        ...contestantDoc.data(),
      }))
    },
  )
}

const addRoundContestant = async (artist) => {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await setDoc(doc(db, 'polls', props.pollId, 'rounds', props.roundId, 'contestants', artist.id), {
      artistId: artist.id,
      votes: 0,
      manualVotes: 0,
      totalVotes: 0,
      isWinner: false,
      winnerRank: null,
      order: roundContestants.value.length,
      matchGroup: null,
      matchOrder: null,
      addedAt: serverTimestamp(),
    })
    successMessage.value = 'Artista agregado a la ronda.'
  } catch {
    errorMessage.value = 'No se pudo agregar el artista a la ronda.'
  }
}

const toggleGroupArtist = (contestantId) => {
  if (selectedGroupArtistIds.value.includes(contestantId)) {
    selectedGroupArtistIds.value = selectedGroupArtistIds.value.filter((id) => id !== contestantId)
    return
  }

  if (selectedGroupArtistIds.value.length >= 2) {
    errorMessage.value = 'Solo puedes seleccionar 2 artistas por grupo.'
    return
  }

  selectedGroupArtistIds.value = [...selectedGroupArtistIds.value, contestantId]
}

const openGroupModal = () => {
  selectedGroupArtistIds.value = []
  errorMessage.value = ''
  successMessage.value = ''
  isGroupModalOpen.value = true
}

const createVersusGroup = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (selectedGroupArtistIds.value.length !== 2) {
    errorMessage.value = 'Selecciona exactamente 2 artistas para crear el grupo.'
    return
  }

  const nextGroupNumber = Math.max(0, ...currentContestants.value.map((contestant) => Number(contestant.matchGroup || 0))) + 1

  try {
    const batch = writeBatch(db)

    selectedGroupArtistIds.value.forEach((contestantId, index) => {
      batch.update(doc(db, 'polls', props.pollId, 'rounds', props.roundId, 'contestants', contestantId), {
        matchGroup: nextGroupNumber,
        matchOrder: index,
      })
    })

    await batch.commit()
    selectedGroupArtistIds.value = []
    isGroupModalOpen.value = false
    successMessage.value = `Grupo ${nextGroupNumber} creado.`
  } catch {
    errorMessage.value = 'No se pudo crear el grupo.'
  }
}

const removeVersusGroup = async (group) => {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const batch = writeBatch(db)

    group.contestants.forEach((contestant) => {
      batch.update(doc(db, 'polls', props.pollId, 'rounds', props.roundId, 'contestants', contestant.id), {
        matchGroup: null,
        matchOrder: null,
      })
    })

    await batch.commit()
    successMessage.value = `Grupo ${group.groupNumber} eliminado.`
  } catch {
    errorMessage.value = 'No se pudo eliminar el grupo.'
  }
}

const moveRoundContestant = async (contestant, direction) => {
  const currentIndex = currentContestants.value.findIndex((item) => item.id === contestant.id)
  const targetIndex = currentIndex + direction

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= currentContestants.value.length) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    const targetContestant = currentContestants.value[targetIndex]
    const batch = writeBatch(db)

    batch.update(doc(db, 'polls', props.pollId, 'rounds', props.roundId, 'contestants', contestant.id), {
      order: targetContestant.order,
    })
    batch.update(doc(db, 'polls', props.pollId, 'rounds', props.roundId, 'contestants', targetContestant.id), {
      order: contestant.order,
    })

    await batch.commit()
  } catch {
    errorMessage.value = 'No se pudo reordenar el artista.'
  }
}

const saveRoundSettings = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!roundForm.value.title.trim()) {
    errorMessage.value = 'Escribe el nombre de la ronda.'
    return
  }

  isSavingRound.value = true

  try {
    await updateDoc(doc(db, 'polls', props.pollId, 'rounds', props.roundId), {
      title: roundForm.value.title.trim(),
      status: roundForm.value.status,
      endAt: toTimestamp(roundForm.value.endAt),
      updatedAt: serverTimestamp(),
    })
    successMessage.value = 'Ronda actualizada.'
  } catch {
    errorMessage.value = 'No se pudo actualizar la ronda.'
  } finally {
    isSavingRound.value = false
  }
}

const removeRoundContestant = (contestant) => {
  contestantToRemove.value = contestant
  errorMessage.value = ''
  successMessage.value = ''
  isRemoveContestantModalOpen.value = true
}

const confirmRemoveRoundContestant = async () => {
  if (!contestantToRemove.value) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''
  isRemovingContestant.value = true

  try {
    await deleteDoc(doc(db, 'polls', props.pollId, 'rounds', props.roundId, 'contestants', contestantToRemove.value.id))
    isRemoveContestantModalOpen.value = false
    contestantToRemove.value = null
    successMessage.value = 'Artista quitado de la ronda.'
  } catch {
    errorMessage.value = 'No se pudo quitar el artista.'
  } finally {
    isRemovingContestant.value = false
  }
}

const deleteRound = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  isDeletingRound.value = true

  try {
    const batch = writeBatch(db)
    const contestantsSnap = await getDocs(collection(db, 'polls', props.pollId, 'rounds', props.roundId, 'contestants'))

    contestantsSnap.docs.forEach((contestantDoc) => {
      batch.delete(contestantDoc.ref)
    })

    batch.delete(doc(db, 'polls', props.pollId, 'rounds', props.roundId))
    await batch.commit()

    isDeleteModalOpen.value = false
    window.location.href = `/admin/votaciones/${props.pollId}`
  } catch {
    errorMessage.value = 'No se pudo eliminar la ronda.'
    isDeletingRound.value = false
  }
}

onMounted(async () => {
  await loadArtists()
  listenBaseData()
})

onUnmounted(() => {
  unsubscribePoll?.()
  unsubscribeRound?.()
  unsubscribeRounds?.()
  unsubscribeRoundContestants?.()
})
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
          Configurar ronda
        </p>
        <h2 class="mt-2 text-3xl font-black text-white">
          {{ round?.title || 'Ronda' }}
        </h2>
        <p class="mt-2 text-sm text-slate-400">
          {{ poll?.title || 'Votacion' }} · Tipo: {{ round?.type === 'versus' ? 'Versus' : 'Lista' }}
        </p>
      </div>

      <a
        :href="`/admin/votaciones/${props.pollId}`"
        class="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
      >
        Volver al panel
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

    <div class="grid gap-4 2xl:grid-cols-2 2xl:items-start">
      <article class="rounded-3xl border border-white/10 bg-white/4 p-4 sm:p-5">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
              Datos
            </p>
            <h3 class="mt-1 text-xl font-black text-white">Datos y configuración de la ronda</h3>
            <p class="mt-1 text-xs text-slate-400">
              Edita el nombre, tipo y estado de esta ronda.
            </p>
          </div>
          <button
            type="button"
            class="rounded-full border border-red-300/25 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isDeletingRound"
            @click="isDeleteModalOpen = true"
          >
            {{ isDeletingRound ? 'Eliminando...' : 'Eliminar ronda' }}
          </button>
        </div>

        <form class="mt-4 grid gap-3 xl:grid-cols-12" @submit.prevent="saveRoundSettings">
          <label class="space-y-2 xl:col-span-6">
            <span class="text-xs font-black uppercase tracking-widest text-slate-300">Nombre de la ronda</span>
            <input
              v-model="roundForm.title"
              type="text"
              class="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
              placeholder="Ronda 1"
            />
          </label>

          <div class="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-2.5 xl:col-span-3">
            <p class="text-xs font-black uppercase tracking-widest text-slate-500">Tipo</p>
            <p class="mt-1 text-sm font-bold text-slate-200">
              {{ roundForm.type === 'versus' ? 'Versus' : 'Lista' }}
            </p>
          </div>

          <label class="space-y-2 xl:col-span-3">
            <span class="text-xs font-black uppercase tracking-widest text-slate-300">Estado</span>
            <select
              v-model="roundForm.status"
              class="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
            >
              <option value="draft">Borrador</option>
              <option value="live">En vivo</option>
              <option value="closed">Cerrada</option>
            </select>
          </label>

          <div class="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-2.5 xl:col-span-12">
            <p class="text-xs font-black uppercase tracking-widest text-slate-500">Finaliza</p>
            <p class="mt-1 text-sm font-bold text-slate-200">{{ formatDate(round?.endAt) }}</p>
          </div>

          <label class="space-y-2 xl:col-span-12">
            <span class="text-xs font-black uppercase tracking-widest text-slate-300">Fecha de finalización</span>
            <span class="relative block">
              <input
                ref="roundEndAtInput"
                v-model="roundForm.endAt"
                type="datetime-local"
                class="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-2.5 pr-14 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl border border-white/10 bg-white/8 text-slate-200 transition hover:bg-white/15 hover:text-white"
                aria-label="Abrir calendario"
                @click="openDatePicker(roundEndAtInput)"
              >
                <svg class="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </span>
          </label>

          <div class="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-2.5 xl:col-span-7">
            <span class="text-xs font-black uppercase tracking-widest text-slate-500">ID</span>
            <p class="truncate text-xs font-bold text-slate-500">
              {{ props.roundId }}
            </p>
          </div>

          <div class="flex items-end justify-end xl:col-span-5">
            <button
              type="submit"
              class="min-h-11 w-full rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 text-sm font-black text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isSavingRound"
            >
              {{ isSavingRound ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>
        </form>
      </article>

      <article class="rounded-3xl border border-white/10 bg-white/4 p-4 sm:p-5">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300">
            Asignación
          </p>
          <h3 class="mt-1 text-xl font-black text-white">Asignar artistas a la ronda</h3>
          <p class="mt-1 text-xs text-slate-400">
            <span v-if="roundForm.type === 'versus'">
              {{ availableArtistsHelp }} Luego crea grupos de 2 artistas para cada duelo.
            </span>
            <span v-else>{{ availableArtistsHelp }}</span>
          </p>
        </div>
        <p class="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
          {{ currentContestants.length }} participantes
        </p>
      </div>

      <div class="mt-4 grid gap-4 xl:grid-cols-2">
        <section class="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
          <div class="flex items-center justify-between gap-3">
            <h4 class="text-lg font-black text-white">Disponibles</h4>
            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              {{ availableArtists.length }} artistas
            </span>
          </div>
          <div class="mt-3 max-h-[300px] space-y-2 overflow-y-auto pr-1">
            <div
              v-for="artist in availableArtists"
              :key="artist.id"
              class="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/45 p-3"
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
                  <span class="block truncate text-xs text-slate-400">{{ getArtistGroup(artist) || 'Sin grupo' }}</span>
                </span>
              </div>
              <button
                type="button"
                class="rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-2 text-xs font-black text-fuchsia-100 transition hover:bg-fuchsia-400/20"
                @click="addRoundContestant(artist)"
              >
                Agregar
              </button>
            </div>
            <p v-if="!availableArtists.length" class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400">
              <span v-if="previousRound && !previousWinnerIds.length">
                La ronda anterior aun no tiene ganadores seleccionados.
              </span>
              <span v-else>No hay artistas disponibles.</span>
            </p>
          </div>
        </section>

        <section class="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
          <div class="flex items-center justify-between gap-3">
            <h4 class="text-lg font-black text-white">En esta ronda</h4>
            <span class="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-200">
              {{ currentContestants.length }} asignados
            </span>
          </div>
          <div class="mt-3 max-h-[300px] space-y-2 overflow-y-auto pr-1">
            <div
              v-for="(contestant, index) in currentContestants"
              :key="contestant.id"
              class="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/45 p-3"
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
                  <span class="block truncate font-black text-white">{{ contestant.artist?.name || 'Artista' }}</span>
                  <span class="block truncate text-xs text-slate-400">{{ contestant.totalVotes || 0 }} votos</span>
                </span>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <button
                  v-if="roundForm.type !== 'versus'"
                  type="button"
                  class="grid size-9 place-items-center rounded-full border border-white/10 bg-white/5 text-xs font-black text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="index === 0"
                  title="Subir"
                  @click="moveRoundContestant(contestant, -1)"
                >
                  ↑
                </button>
                <button
                  v-if="roundForm.type !== 'versus'"
                  type="button"
                  class="grid size-9 place-items-center rounded-full border border-white/10 bg-white/5 text-xs font-black text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="index === currentContestants.length - 1"
                  title="Bajar"
                  @click="moveRoundContestant(contestant, 1)"
                >
                  ↓
                </button>
                <span
                  v-if="roundForm.type === 'versus' && contestant.matchGroup"
                  class="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-fuchsia-100"
                >
                  Grupo {{ contestant.matchGroup }}
                </span>
                <button
                  type="button"
                  class="rounded-full border border-red-300/25 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 transition hover:bg-red-500/20"
                  @click="removeRoundContestant(contestant)"
                >
                  Quitar
                </button>
              </div>
            </div>
            <p v-if="!currentContestants.length" class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400">
              Esta ronda aun no tiene artistas.
            </p>
          </div>
        </section>
      </div>
      <section
        v-if="roundForm.type === 'versus'"
        class="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-3"
      >
        <div class="flex items-center justify-between gap-3">
          <h4 class="text-lg font-black text-white">Duelos generados</h4>
          <div class="flex items-center gap-2">
            <span class="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-fuchsia-100">
              {{ versusGroups.length }} grupos
            </span>
            <button
              type="button"
              class="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/20"
              @click="openGroupModal"
            >
              Crear grupo
            </button>
          </div>
        </div>

        <div class="mt-3 grid gap-3 lg:grid-cols-2">
          <article
            v-for="group in versusGroups"
            :key="`group-${group.groupNumber}`"
            class="rounded-2xl border border-white/10 bg-slate-950/45 p-3"
          >
            <div class="mb-3 flex items-center justify-between gap-3">
              <p class="text-xs font-black uppercase tracking-widest text-fuchsia-300">
                Grupo {{ group.groupNumber }}
              </p>
              <button
                v-if="group.contestants.some((contestant) => contestant.matchGroup)"
                type="button"
                class="rounded-full border border-red-300/25 bg-red-500/10 px-3 py-1 text-[10px] font-black text-red-100 transition hover:bg-red-500/20"
                @click="removeVersusGroup(group)"
              >
                Eliminar grupo
              </button>
            </div>

            <div class="space-y-2">
              <div
                v-for="(contestant, index) in group.contestants"
                :key="contestant.id"
                class="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
              >
                <span class="grid size-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-[10px] font-black text-slate-300">
                  {{ index === 0 ? 'A' : 'B' }}
                </span>
                <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-xs font-black text-white">
                  <img
                    v-if="getArtistImage(contestant.artist)"
                    :src="getArtistImage(contestant.artist)"
                    :alt="contestant.artist?.name"
                    class="size-full object-cover"
                  />
                  <span v-else>{{ contestant.artist?.name?.charAt(0) || 'A' }}</span>
                </span>
                <span class="min-w-0">
                  <span class="block truncate font-black text-white">{{ contestant.artist?.name || 'Artista' }}</span>
                  <span class="block truncate text-xs text-slate-400">{{ getArtistGroup(contestant.artist) || 'Sin grupo' }}</span>
                </span>
              </div>

              <p
                v-if="group.contestants.length === 1"
                class="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-xs font-bold text-amber-100"
              >
                Falta 1 artista para completar este duelo.
              </p>
            </div>
          </article>

          <p
            v-if="!versusGroups.length"
            class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400"
          >
            Agrega artistas para formar duelos de 2 en 2.
          </p>
        </div>
        <p
          v-if="roundForm.type === 'versus' && ungroupedContestants.length"
          class="mt-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-xs font-bold text-amber-100"
        >
          Tienes {{ ungroupedContestants.length }} artista(s) sin grupo. Usa "Crear grupo" para armar los duelos.
        </p>
      </section>
      </article>
    </div>
    <Teleport to="body">
      <div
        v-if="isGroupModalOpen"
        class="fixed inset-0 z-80 grid place-items-center bg-black/80 px-4 backdrop-blur-md"
        @click.self="isGroupModalOpen = false"
      >
        <article class="w-full max-w-2xl rounded-4xl border border-cyan-300/25 bg-[#080a18] p-6 text-white shadow-2xl shadow-cyan-950/30">
          <p class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            Nuevo grupo versus
          </p>
          <h2 class="mt-3 text-3xl font-black">
            Crear grupo
          </h2>
          <p class="mt-3 text-sm leading-6 text-slate-300">
            Selecciona exactamente 2 artistas de esta ronda para crear un duelo.
          </p>

          <div class="mt-5 grid max-h-96 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            <button
              v-for="contestant in ungroupedContestants"
              :key="contestant.id"
              type="button"
              class="flex items-center gap-3 rounded-2xl border p-3 text-left transition"
              :class="
                selectedGroupArtistIds.includes(contestant.id)
                  ? 'border-cyan-300/45 bg-cyan-400/15'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              "
              @click="toggleGroupArtist(contestant.id)"
            >
              <span class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white">
                <img
                  v-if="getArtistImage(contestant.artist)"
                  :src="getArtistImage(contestant.artist)"
                  :alt="contestant.artist?.name"
                  class="size-full object-cover"
                />
                <span v-else>{{ contestant.artist?.name?.charAt(0) || 'A' }}</span>
              </span>
              <span class="min-w-0">
                <span class="block truncate font-black text-white">{{ contestant.artist?.name || 'Artista' }}</span>
                <span class="block truncate text-xs text-slate-400">{{ getArtistGroup(contestant.artist) || 'Sin grupo' }}</span>
              </span>
            </button>

            <p
              v-if="!ungroupedContestants.length"
              class="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm font-bold text-slate-400 sm:col-span-2"
            >
              No hay artistas disponibles para agrupar. Agrega artistas o elimina un grupo existente para volver a usar sus participantes.
            </p>
          </div>

          <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              class="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10"
              @click="isGroupModalOpen = false"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="rounded-full bg-linear-to-r from-cyan-500 to-fuchsia-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-cyan-950/30 transition hover:scale-[1.01]"
              @click="createVersusGroup"
            >
              Crear grupo
            </button>
          </div>
        </article>
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="isRemoveContestantModalOpen"
        class="fixed inset-0 z-80 grid place-items-center bg-black/80 px-4 backdrop-blur-md"
        @click.self="isRemoveContestantModalOpen = false"
      >
        <article class="w-full max-w-lg rounded-4xl border border-red-300/25 bg-[#080a18] p-6 text-white shadow-2xl shadow-red-950/30">
          <p class="text-xs font-black uppercase tracking-[0.28em] text-red-300">
            Confirmar acción
          </p>
          <h2 class="mt-3 text-3xl font-black">
            Quitar artista
          </h2>
          <p class="mt-3 text-sm leading-6 text-slate-300">
            Vas a quitar a <strong>{{ contestantToRemove?.artist?.name || 'este artista' }}</strong> de esta ronda.
          </p>

          <div class="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <span class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white">
              <img
                v-if="getArtistImage(contestantToRemove?.artist)"
                :src="getArtistImage(contestantToRemove?.artist)"
                :alt="contestantToRemove?.artist?.name"
                class="size-full object-cover"
              />
              <span v-else>{{ contestantToRemove?.artist?.name?.charAt(0) || 'A' }}</span>
            </span>
            <span class="min-w-0">
              <span class="block truncate font-black text-white">
                {{ contestantToRemove?.artist?.name || 'Artista' }}
              </span>
              <span class="block truncate text-xs text-slate-400">
                {{ getArtistGroup(contestantToRemove?.artist) || 'Sin grupo' }}
              </span>
            </span>
          </div>

          <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              class="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isRemovingContestant"
              @click="isRemoveContestantModalOpen = false"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="rounded-full bg-red-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/30 transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isRemovingContestant"
              @click="confirmRemoveRoundContestant"
            >
              {{ isRemovingContestant ? 'Quitando...' : 'Sí, quitar artista' }}
            </button>
          </div>
        </article>
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="isDeleteModalOpen"
        class="fixed inset-0 z-80 grid place-items-center bg-black/80 px-4 backdrop-blur-md"
        @click.self="isDeleteModalOpen = false"
      >
        <article class="w-full max-w-lg rounded-4xl border border-red-300/25 bg-[#080a18] p-6 text-white shadow-2xl shadow-red-950/30">
          <p class="text-xs font-black uppercase tracking-[0.28em] text-red-300">
            Confirmar eliminación
          </p>
          <h2 class="mt-3 text-3xl font-black">
            Eliminar ronda
          </h2>
          <p class="mt-3 text-sm leading-6 text-slate-300">
            Esta acción eliminará <strong>{{ round?.title || 'esta ronda' }}</strong> y también quitará todos los artistas asignados dentro de ella.
          </p>

          <div class="mt-6 rounded-2xl border border-red-300/15 bg-red-500/10 p-4">
            <p class="text-sm font-bold text-red-100">
              No se puede deshacer esta acción.
            </p>
          </div>

          <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              class="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isDeletingRound"
              @click="isDeleteModalOpen = false"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="rounded-full bg-red-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/30 transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isDeletingRound"
              @click="deleteRound"
            >
              {{ isDeletingRound ? 'Eliminando...' : 'Sí, eliminar ronda' }}
            </button>
          </div>
        </article>
      </div>
    </Teleport>
  </section>
</template>
