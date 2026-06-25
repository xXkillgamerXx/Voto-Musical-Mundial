<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
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
})

const poll = ref(null)
const artists = ref([])
const contestants = ref([])
const rounds = ref([])
const activeRoundContestants = ref([])
const pollVotes = ref([])
const users = ref([])
const selectedRoundId = ref('')
const winnersToAdvance = ref(2)
const manualVoteAmounts = ref({})
const roundForm = ref({
  title: '',
  type: 'list',
  endAt: '',
})
const isLaunchModalOpen = ref(false)
const isFinishPollModalOpen = ref(false)
const isRoundModalOpen = ref(false)
const roundEndAtInput = ref(null)
const errorMessage = ref('')
const successMessage = ref('')
let unsubscribePoll = null
let unsubscribeContestants = null
let unsubscribeRounds = null
let unsubscribeActiveRoundContestants = null
let unsubscribeVotes = null
let unsubscribeUsers = null

const getArtist = (artistId) => artists.value.find((artist) => artist.id === artistId)
const getArtistImage = (artist) =>
  artist?.image || artist?.imageUrl || artist?.photo || artist?.photoURL || artist?.foto || artist?.banner || ''

const getUser = (userId) => users.value.find((user) => user.id === userId)
const getUserName = (user) => user?.displayName || user?.username || user?.name || user?.email || 'Usuario'
const getUserAvatar = (user) => user?.photoURL || user?.avatar || user?.image || ''

const rankedContestants = computed(() =>
  contestants.value
    .map((contestant) => {
      const totalVotes = Number(contestant.totalVotes ?? ((contestant.votes || 0) + (contestant.manualVotes || 0)))
      return {
        ...contestant,
        artist: getArtist(contestant.artistId),
        totalVotes,
      }
    })
    .sort((current, next) => next.totalVotes - current.totalVotes),
)

const totalPollVotes = computed(() =>
  rankedContestants.value.reduce((total, contestant) => total + contestant.totalVotes, 0),
)

const activeRound = computed(() =>
  rounds.value.find((round) => round.id === selectedRoundId.value)
    || rounds.value.find((round) => round.id === poll.value?.activeRoundId)
    || rounds.value.find((round) => round.status === 'live')
    || rounds.value[0]
    || null,
)

const activeRoundIndex = computed(() =>
  rounds.value.findIndex((round) => round.id === activeRound.value?.id),
)

const nextRound = computed(() => {
  if (activeRoundIndex.value < 0) {
    return null
  }

  return rounds.value[activeRoundIndex.value + 1] || null
})

const isNextRoundLocked = computed(() =>
  Boolean(nextRound.value && nextRound.value.status !== 'draft'),
)

const activeRoundArtistIds = computed(() =>
  new Set(activeRoundContestants.value.map((contestant) => contestant.artistId)),
)

const activeRoundVotes = computed(() => {
  if (!activeRound.value) {
    return []
  }

  return pollVotes.value.filter((vote) => {
    if (vote.roundId) {
      return vote.roundId === activeRound.value.id
    }

    return activeRoundArtistIds.value.has(vote.artistId)
  })
})

const activeRoundRanking = computed(() =>
  activeRoundContestants.value
    .map((contestant) => {
      const artistVotes = activeRoundVotes.value
        .filter((vote) => vote.artistId === contestant.artistId)
        .reduce((total, vote) => total + Number(vote.amount || 1), 0)
      const baseVotes = artistVotes || Number(contestant.votes || 0)
      const manualVotes = Number(contestant.manualVotes || 0)
      const totalVotes = Math.max(0, baseVotes + manualVotes)

      return {
        ...contestant,
        artist: getArtist(contestant.artistId),
        totalVotes,
      }
    })
    .sort((current, next) => next.totalVotes - current.totalVotes),
)

const totalActiveRoundVotes = computed(() =>
  activeRoundRanking.value.reduce((total, contestant) => total + contestant.totalVotes, 0),
)

const recentRoundVotes = computed(() =>
  activeRoundVotes.value
    .slice()
    .sort((current, next) => (next.createdAt?.toMillis?.() || 0) - (current.createdAt?.toMillis?.() || 0))
    .slice(0, 12)
    .map((vote) => ({
      ...vote,
      artist: getArtist(vote.artistId),
      user: getUser(vote.userId),
    })),
)

const userVoteLeaders = computed(() => {
  const totals = new Map()

  activeRoundVotes.value.forEach((vote) => {
    const current = totals.get(vote.userId) || {
      userId: vote.userId,
      amount: 0,
      user: getUser(vote.userId),
    }

    current.amount += Number(vote.amount || 1)
    current.user = getUser(vote.userId)
    totals.set(vote.userId, current)
  })

  return [...totals.values()].sort((current, next) => next.amount - current.amount).slice(0, 8)
})

const phaseLabel = computed(
  () =>
    ({
      initial: 'Inicial',
      round: 'Ronda',
      semifinal: 'Semifinal',
      final: 'Final',
    })[poll.value?.phase] || 'Inicial',
)

const typeLabel = computed(
  () =>
    ({
      list: 'Lista',
      versus: 'Versus',
    })[poll.value?.type] || 'Lista',
)

const toTimestamp = (value) => (value ? Timestamp.fromDate(new Date(value)) : null)

const openDatePicker = (input) => {
  input?.focus()
  input?.showPicker?.()
}

const formatDate = (value) => {
  const date = value?.toDate?.() || null
  return date
    ? new Intl.DateTimeFormat('es', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    : 'Sin fecha'
}

const formatTime = (value) => {
  const date = value?.toDate?.() || null
  return date
    ? new Intl.DateTimeFormat('es', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(date)
    : 'Ahora'
}

const percentFor = (votes, total) => {
  if (!total) {
    return '0.00%'
  }

  return `${((votes / total) * 100).toFixed(2)}%`
}

const winnerCountOptions = computed(() => {
  const maxContestants = Math.max(activeRoundRanking.value.length, 1)
  return Array.from({ length: maxContestants }, (_, index) => index + 1)
})

const loadArtists = async () => {
  const artistsSnap = await getDocs(query(collection(db, 'artists'), orderBy('createdAt', 'desc')))
  artists.value = artistsSnap.docs.map((artistDoc) => ({
    id: artistDoc.id,
    ...artistDoc.data(),
  }))
}

const listenPoll = () => {
  unsubscribePoll = onSnapshot(
    doc(db, 'polls', props.pollId),
    (pollSnap) => {
      poll.value = pollSnap.exists() ? { id: pollSnap.id, ...pollSnap.data() } : null
    },
    () => {
      errorMessage.value = 'No se pudo escuchar la votacion.'
    },
  )
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
      errorMessage.value = 'No se pudieron escuchar los votos.'
    },
  )
}

const listenRounds = () => {
  unsubscribeRounds = onSnapshot(
    query(collection(db, 'polls', props.pollId, 'rounds'), orderBy('createdAt', 'asc')),
    (roundsSnap) => {
      rounds.value = roundsSnap.docs.map((roundDoc) => ({
        id: roundDoc.id,
        ...roundDoc.data(),
      }))

      if (!selectedRoundId.value || !rounds.value.some((round) => round.id === selectedRoundId.value)) {
        selectedRoundId.value = rounds.value.find((round) => round.status === 'live')?.id || rounds.value[0]?.id || ''
      }

      listenActiveRoundContestants()
    },
    () => {
      errorMessage.value = 'No se pudieron escuchar las rondas.'
    },
  )
}

const selectRound = (roundId) => {
  selectedRoundId.value = roundId
  listenActiveRoundContestants()
}

const listenActiveRoundContestants = () => {
  unsubscribeActiveRoundContestants?.()
  activeRoundContestants.value = []

  if (!activeRound.value) {
    return
  }

  unsubscribeActiveRoundContestants = onSnapshot(
    collection(db, 'polls', props.pollId, 'rounds', activeRound.value.id, 'contestants'),
    (contestantsSnap) => {
      activeRoundContestants.value = contestantsSnap.docs.map((contestantDoc) => ({
        id: contestantDoc.id,
        ...contestantDoc.data(),
      }))
    },
    () => {
      errorMessage.value = 'No se pudieron escuchar los participantes de la ronda.'
    },
  )
}

const listenVotes = () => {
  unsubscribeVotes = onSnapshot(
    query(collection(db, 'polls', props.pollId, 'votes'), orderBy('createdAt', 'desc')),
    (votesSnap) => {
      pollVotes.value = votesSnap.docs.map((voteDoc) => ({
        id: voteDoc.id,
        ...voteDoc.data(),
      }))
    },
    () => {
      errorMessage.value = 'No se pudieron escuchar los votos.'
    },
  )
}

const listenUsers = () => {
  unsubscribeUsers = onSnapshot(
    collection(db, 'users'),
    (usersSnap) => {
      users.value = usersSnap.docs.map((userDoc) => ({
        id: userDoc.id,
        ...userDoc.data(),
      }))
    },
  )
}

const updatePollStatus = async (status) => {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await updateDoc(doc(db, 'polls', props.pollId), {
      status,
      isLive: status === 'live',
      winnersStatus: status === 'selecting_winners' ? 'pending' : poll.value?.winnersStatus || 'pending',
      updatedAt: serverTimestamp(),
    })
    successMessage.value = 'Estado actualizado.'
  } catch {
    errorMessage.value = 'No se pudo actualizar el estado.'
  }
}

const updateRoundStatus = async (round, status) => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!round?.id) {
    errorMessage.value = 'Selecciona una ronda.'
    return
  }

  try {
    if (status === 'live') {
      const batch = writeBatch(db)

      rounds.value.forEach((item) => {
        batch.update(doc(db, 'polls', props.pollId, 'rounds', item.id), {
          status: item.id === round.id ? 'live' : item.status === 'live' ? 'closed' : item.status,
          liveStartedAt: item.id === round.id ? serverTimestamp() : item.liveStartedAt || null,
          updatedAt: serverTimestamp(),
        })
      })

      batch.update(doc(db, 'polls', props.pollId), {
        activeRoundId: round.id,
        status: 'live',
        isLive: true,
        updatedAt: serverTimestamp(),
      })

      await batch.commit()
    } else {
      await updateDoc(doc(db, 'polls', props.pollId, 'rounds', round.id), {
        status,
        updatedAt: serverTimestamp(),
      })
    }

    selectedRoundId.value = round.id
    successMessage.value = status === 'live' ? 'Ronda lanzada.' : 'Ronda actualizada.'
  } catch {
    errorMessage.value = 'No se pudo actualizar la ronda.'
  }
}

const finishActiveRound = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!activeRound.value?.id) {
    errorMessage.value = 'Selecciona una ronda.'
    return
  }

  if (isNextRoundLocked.value) {
    errorMessage.value = 'Ya lanzaste la siguiente ronda. No se pueden cambiar los que pasan.'
    return
  }

  const winnerCount = Number(winnersToAdvance.value || 1)
  const winners = activeRoundRanking.value.slice(0, winnerCount)

  if (!winners.length) {
    errorMessage.value = 'Esta ronda no tiene artistas para seleccionar ganadores.'
    return
  }

  try {
    const batch = writeBatch(db)
    const winnerIds = winners.map((winner) => winner.artistId)

    activeRoundRanking.value.forEach((contestant) => {
      const winnerIndex = winnerIds.indexOf(contestant.artistId)
      batch.update(doc(db, 'polls', props.pollId, 'rounds', activeRound.value.id, 'contestants', contestant.id), {
        isWinner: winnerIndex >= 0,
        winnerRank: winnerIndex >= 0 ? winnerIndex + 1 : null,
      })
    })

    batch.update(doc(db, 'polls', props.pollId, 'rounds', activeRound.value.id), {
      status: 'closed',
      winnerIds,
      winnerCount,
      winnersSelectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    batch.update(doc(db, 'polls', props.pollId), {
      activeRoundId: null,
      status: 'selecting_winners',
      isLive: false,
      winnersStatus: 'pending',
      updatedAt: serverTimestamp(),
    })

    if (nextRound.value?.status === 'draft') {
      const nextContestantsSnap = await getDocs(
        collection(db, 'polls', props.pollId, 'rounds', nextRound.value.id, 'contestants'),
      )
      const nextContestantIds = new Set(nextContestantsSnap.docs.map((contestantDoc) => contestantDoc.id))

      nextContestantsSnap.docs.forEach((contestantDoc) => {
        if (!winnerIds.includes(contestantDoc.id)) {
          batch.delete(contestantDoc.ref)
        }
      })

      winnerIds.forEach((artistId) => {
        if (!nextContestantIds.has(artistId)) {
          batch.set(doc(db, 'polls', props.pollId, 'rounds', nextRound.value.id, 'contestants', artistId), {
            artistId,
            votes: 0,
            manualVotes: 0,
            totalVotes: 0,
            isWinner: false,
            winnerRank: null,
            addedAt: serverTimestamp(),
          })
        }
      })
    }

    await batch.commit()
    successMessage.value = activeRound.value.status === 'closed'
      ? `Ganadores actualizados. ${winnerCount} artista(s) pasan.`
      : `Ronda finalizada. ${winnerCount} ganador(es) pasan a la siguiente ronda.`
  } catch {
    errorMessage.value = 'No se pudo finalizar la ronda.'
  }
}

const launchPoll = async () => {
  await updatePollStatus('live')
  isLaunchModalOpen.value = false
}

const cancelLaunch = async () => {
  const confirmed = window.confirm('¿Quieres cancelar el lanzamiento y volver la votacion a borrador?')

  if (!confirmed) {
    return
  }

  await updatePollStatus('draft')
}

const finishPoll = async () => {
  await updatePollStatus('closed')
  isFinishPollModalOpen.value = false
}

const addManualVotes = async (contestant) => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!activeRound.value?.id) {
    errorMessage.value = 'Selecciona una ronda.'
    return
  }

  const amount = Number(manualVoteAmounts.value[contestant.id] || 0)

  if (!Number.isInteger(amount) || amount === 0) {
    errorMessage.value = 'Escribe una cantidad válida de votos. Usa negativo para restar.'
    return
  }

  if (amount < 0 && contestant.totalVotes + amount < 0) {
    errorMessage.value = 'No puedes restar más votos de los que tiene el artista.'
    return
  }

  try {
    await updateDoc(doc(db, 'polls', props.pollId, 'rounds', activeRound.value.id, 'contestants', contestant.id), {
      manualVotes: increment(amount),
      totalVotes: increment(amount),
    })

    await addDoc(collection(db, 'polls', props.pollId, 'adjustments'), {
      roundId: activeRound.value.id,
      artistId: contestant.artistId,
      amount,
      type: 'manual_votes',
      createdAt: serverTimestamp(),
    })

    manualVoteAmounts.value = {
      ...manualVoteAmounts.value,
      [contestant.id]: '',
    }
    successMessage.value = amount > 0
      ? `${amount} voto(s) agregados.`
      : `${Math.abs(amount)} voto(s) restados.`
  } catch {
    errorMessage.value = 'No se pudo ajustar la cantidad de votos.'
  }
}

const createRound = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!roundForm.value.title.trim()) {
    errorMessage.value = 'Escribe el nombre de la ronda.'
    return
  }

  try {
    const sourceWinnerIds = rounds.value[rounds.value.length - 1]?.winnerIds || []
    const roundRef = await addDoc(collection(db, 'polls', props.pollId, 'rounds'), {
      title: roundForm.value.title.trim(),
      type: roundForm.value.type,
      endAt: toTimestamp(roundForm.value.endAt),
      status: 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    await Promise.all(
      sourceWinnerIds.map((artistId) =>
        setDoc(doc(db, 'polls', props.pollId, 'rounds', roundRef.id, 'contestants', artistId), {
          artistId,
          votes: 0,
          manualVotes: 0,
          totalVotes: 0,
          isWinner: false,
          winnerRank: null,
          addedAt: serverTimestamp(),
        }),
      ),
    )

    roundForm.value = {
      title: '',
      type: 'list',
      endAt: '',
    }
    isRoundModalOpen.value = false
    successMessage.value = sourceWinnerIds.length
      ? 'Ronda creada con los ganadores de la ronda anterior.'
      : 'Ronda creada.'
  } catch {
    errorMessage.value = 'No se pudo crear la ronda.'
  }
}

onMounted(async () => {
  await loadArtists()
  listenPoll()
  listenContestants()
  listenRounds()
  listenVotes()
  listenUsers()
})

onUnmounted(() => {
  unsubscribePoll?.()
  unsubscribeContestants?.()
  unsubscribeRounds?.()
  unsubscribeActiveRoundContestants?.()
  unsubscribeVotes?.()
  unsubscribeUsers?.()
})
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
          Panel de votacion
        </p>
        <h2 class="mt-2 text-3xl font-black text-white">
          {{ poll?.title || 'Votacion' }}
        </h2>
        <p class="mt-2 text-sm text-slate-400">
          Gestiona configuracion, fase, participantes, votos y ganadores desde aqui.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          v-if="poll?.status !== 'live'"
          type="button"
          class="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-400/20"
          @click="isLaunchModalOpen = true"
        >
          Lanzar en vivo
        </button>
        <button
          v-if="poll?.status === 'live'"
          type="button"
          class="rounded-full border border-red-300/25 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 transition hover:bg-red-500/20"
          @click="cancelLaunch"
        >
          Cancelar lanzamiento
        </button>
        <button
          v-if="poll?.status === 'live'"
          type="button"
          class="rounded-full border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-xs font-black text-amber-100 transition hover:bg-amber-400/20"
          @click="updatePollStatus('selecting_winners')"
        >
          Elegir ganadores
        </button>
        <a
          :href="`/admin/votaciones/${props.pollId}/ganadores`"
          class="rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-2 text-xs font-black text-fuchsia-100 transition hover:bg-fuchsia-400/20"
        >
          Guardar ganadores
        </a>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article class="rounded-3xl border border-white/10 bg-white/4 p-5">
        <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Estado</p>
        <h3 class="mt-2 text-2xl font-black text-white">{{ poll?.status || 'draft' }}</h3>
        <p class="mt-2 text-sm text-slate-400">
          <span v-if="poll?.status === 'draft'">Aun no se lanza.</span>
          <span v-else-if="poll?.status === 'live'">Usuarios pueden votar.</span>
          <span v-else-if="poll?.status === 'selecting_winners'">Usuarios esperan ganadores.</span>
          <span v-else>Votacion cerrada.</span>
        </p>
      </article>

      <article class="rounded-3xl border border-white/10 bg-white/4 p-5">
        <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Tipo</p>
        <h3 class="mt-2 text-2xl font-black text-white">{{ typeLabel }}</h3>
        <p class="mt-2 text-sm text-slate-400">Formato de la fase.</p>
      </article>

      <article class="rounded-3xl border border-white/10 bg-white/4 p-5">
        <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Fase</p>
        <h3 class="mt-2 text-2xl font-black text-white">{{ phaseLabel }}</h3>
        <p class="mt-2 text-sm text-slate-400">Etapa actual del torneo.</p>
      </article>

      <article class="rounded-3xl border border-white/10 bg-white/4 p-5">
        <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Participantes</p>
        <h3 class="mt-2 text-2xl font-black text-white">{{ contestants.length }}</h3>
        <p class="mt-2 text-sm text-slate-400">{{ totalPollVotes }} votos totales.</p>
      </article>
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

    <section class="grid gap-6 xl:grid-cols-4">
      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6 xl:col-span-3">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
              Rondas
            </p>
            <h3 class="mt-2 text-2xl font-black text-white">
              Sistema de Rondas
            </h3>
          </div>
          <div class="flex items-center gap-2">
            <span class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-300">
              {{ rounds.length }} rondas
            </span>
            <button
              type="button"
              class="rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01]"
              @click="isRoundModalOpen = true"
            >
              Crear fase
            </button>
          </div>
        </div>

        <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="(round, index) in rounds"
            :key="round.id"
            class="rounded-2xl border bg-slate-950/45 p-4 transition"
            :class="activeRound?.id === round.id ? 'border-cyan-300/35 shadow-lg shadow-cyan-950/20' : 'border-white/10'"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-black uppercase tracking-widest text-fuchsia-300">Fase #{{ index + 1 }}</p>
                <p class="mt-2 text-xl font-black text-white">{{ round.title }}</p>
                <p class="mt-1 text-sm text-slate-400">Estado: {{ round.status || 'draft' }}</p>
                <p class="mt-1 text-sm text-slate-400">Finaliza: {{ formatDate(round.endAt) }}</p>
              </div>
              <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
                {{ round.type === 'versus' ? 'Versus' : 'Lista' }}
              </span>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                class="inline-flex min-h-10 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/20"
                @click="selectRound(round.id)"
              >
                Ver datos
              </button>
              <button
                v-if="round.status !== 'live' && round.status !== 'closed'"
                type="button"
                class="inline-flex min-h-10 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 text-xs font-black text-emerald-100 transition hover:bg-emerald-400/20"
                @click="updateRoundStatus(round, 'live')"
              >
                Lanzar ronda
              </button>
              <button
                v-if="round.status === 'live' && activeRound?.id === round.id"
                type="button"
                class="inline-flex min-h-10 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 text-xs font-black text-amber-100 transition hover:bg-amber-400/20"
                @click="finishActiveRound"
              >
                Finalizar ronda
              </button>
              <a
                :href="`/admin/votaciones/${props.pollId}/rondas/${round.id}`"
                class="inline-flex min-h-10 items-center justify-center rounded-2xl border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 text-xs font-black text-fuchsia-100 transition hover:bg-fuchsia-400/20"
              >
                Configurar
              </a>
            </div>
          </div>

          <p
            v-if="!rounds.length"
            class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400"
          >
            Todavia no hay rondas. Crea la primera fase para organizar la votacion.
          </p>
        </div>

        <button
          type="button"
          class="mt-5 flex min-h-13 w-full items-center justify-center rounded-2xl border border-red-300/25 bg-red-500/10 px-5 text-sm font-black uppercase tracking-wide text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="poll?.status === 'closed'"
          @click="isFinishPollModalOpen = true"
        >
          {{ poll?.status === 'closed' ? 'Votación finalizada' : 'Finalizar votación' }}
        </button>
      </article>
    </section>

    <section class="grid gap-6 xl:grid-cols-[1fr_0.45fr]">
      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
              Tiempo real
            </p>
            <h3 class="mt-2 text-2xl font-black text-white">
              {{ activeRound?.title || 'Primera ronda' }}
            </h3>
            <p class="mt-2 text-sm text-slate-400">
              Ranking de artistas de la ronda · {{ totalActiveRoundVotes }} votos registrados
            </p>
          </div>
          <div v-if="activeRound" class="flex flex-wrap items-center gap-2">
            <span class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-300">
              {{ activeRound.type === 'versus' ? 'Versus' : 'Lista' }} · {{ activeRound.status || 'draft' }}
            </span>
            <label class="flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200">
              Pasan
              <select
                v-model="winnersToAdvance"
                class="bg-transparent text-white outline-none"
              >
                <option
                  v-for="count in winnerCountOptions"
                  :key="count"
                  :value="count"
                  class="bg-slate-950"
                >
                  {{ count }}
                </option>
              </select>
            </label>
            <button
              type="button"
              class="rounded-full border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-xs font-black text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!activeRoundRanking.length || isNextRoundLocked"
              @click="finishActiveRound"
            >
              {{ activeRound.status === 'closed' ? 'Guardar ganadores' : 'Finalizar ronda' }}
            </button>
            <span
              v-if="activeRound.status === 'closed'"
              class="text-xs font-bold text-slate-500"
            >
              <span v-if="isNextRoundLocked">Bloqueado: la siguiente ronda ya fue lanzada.</span>
              <span v-else>Puedes cambiarlo hasta lanzar la siguiente ronda.</span>
            </span>
          </div>
        </div>

        <div v-if="activeRound" class="mt-5 space-y-3">
          <div
            v-for="(contestant, index) in activeRoundRanking"
            :key="contestant.id"
            class="rounded-2xl border bg-slate-950/45 p-4"
            :class="contestant.isWinner ? 'border-amber-300/35 bg-amber-400/10' : 'border-white/10'"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex min-w-0 items-center gap-3">
                <span class="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-sm font-black text-slate-200">
                  #{{ index + 1 }}
                </span>
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
                  <span class="flex min-w-0 flex-wrap items-center gap-2">
                    <span class="block truncate font-black text-white">{{ contestant.artist?.name || 'Artista' }}</span>
                    <span
                      v-if="contestant.isWinner"
                      class="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-100"
                    >
                      Ganador #{{ contestant.winnerRank || index + 1 }}
                    </span>
                  </span>
                  <span class="block truncate text-xs text-slate-400">{{ contestant.totalVotes }} votos individuales</span>
                </span>
              </div>
              <div class="text-right">
                <p class="text-lg font-black text-white">{{ percentFor(contestant.totalVotes, totalActiveRoundVotes) }}</p>
                <p class="text-xs font-bold text-slate-500">Representación</p>
              </div>
            </div>
            <div class="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                class="h-full rounded-full bg-linear-to-r from-cyan-400 to-fuchsia-400"
                :style="{ width: percentFor(contestant.totalVotes, totalActiveRoundVotes) }"
              ></div>
            </div>
            <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <input
                v-model="manualVoteAmounts[contestant.id]"
                type="number"
                step="1"
                class="min-h-10 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/50 sm:w-32"
                placeholder="+10 o -5"
              />
              <button
                type="button"
                class="min-h-10 rounded-2xl border border-violet-300/25 bg-violet-400/10 px-4 text-xs font-black text-violet-100 transition hover:bg-violet-400/20"
                @click="addManualVotes(contestant)"
              >
                Ajustar votos
              </button>
            </div>
          </div>

          <p
            v-if="!activeRoundRanking.length"
            class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400"
          >
            Esta ronda todavía no tiene artistas asignados.
          </p>
        </div>

        <p
          v-else
          class="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400"
        >
          Crea una ronda para ver estadísticas en tiempo real.
        </p>
      </article>

      <div class="grid gap-6">
        <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
          <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            Votos recientes
          </p>
          <h3 class="mt-2 text-2xl font-black text-white">Actividad</h3>

          <div class="mt-5 max-h-90 space-y-3 overflow-y-auto pr-1">
            <div
              v-for="vote in recentRoundVotes"
              :key="vote.id"
              class="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3"
            >
              <div class="flex min-w-0 items-center gap-3">
                <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-linear-to-br from-cyan-500 to-fuchsia-500 text-xs font-black text-white">
                  <img
                    v-if="getUserAvatar(vote.user)"
                    :src="getUserAvatar(vote.user)"
                    :alt="getUserName(vote.user)"
                    class="size-full object-cover"
                  />
                  <span v-else>{{ getUserName(vote.user).charAt(0) }}</span>
                </span>
                <span class="min-w-0">
                  <span class="block truncate text-sm font-black text-white">{{ getUserName(vote.user) }}</span>
                  <span class="block truncate text-xs text-slate-400">Votó por {{ vote.artist?.name || 'artista' }}</span>
                </span>
              </div>
              <span class="text-xs font-bold text-slate-500">{{ formatTime(vote.createdAt) }}</span>
            </div>

            <p
              v-if="!recentRoundVotes.length"
              class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400"
            >
              Aún no hay votos en esta ronda.
            </p>
          </div>
        </article>

        <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
          <p class="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">
            Usuarios
          </p>
          <h3 class="mt-2 text-2xl font-black text-white">Más votos</h3>

          <div class="mt-5 space-y-3">
            <div
              v-for="leader in userVoteLeaders"
              :key="leader.userId"
              class="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3"
            >
              <div class="flex min-w-0 items-center gap-3">
                <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-linear-to-br from-emerald-500 to-cyan-500 text-xs font-black text-white">
                  <img
                    v-if="getUserAvatar(leader.user)"
                    :src="getUserAvatar(leader.user)"
                    :alt="getUserName(leader.user)"
                    class="size-full object-cover"
                  />
                  <span v-else>{{ getUserName(leader.user).charAt(0) }}</span>
                </span>
                <span class="min-w-0">
                  <span class="block truncate text-sm font-black text-white">{{ getUserName(leader.user) }}</span>
                  <span class="block truncate text-xs text-slate-400">{{ leader.user?.email || leader.userId }}</span>
                </span>
              </div>
              <span class="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-100">
                {{ leader.amount }} votos
              </span>
            </div>

            <p
              v-if="!userVoteLeaders.length"
              class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400"
            >
              Aún no hay usuarios votando.
            </p>
          </div>
        </article>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="isFinishPollModalOpen"
        class="fixed inset-0 z-80 grid place-items-center bg-black/80 px-4 backdrop-blur-md"
        @click.self="isFinishPollModalOpen = false"
      >
        <article class="w-full max-w-lg rounded-4xl border border-red-300/25 bg-[#080a18] p-6 text-white shadow-2xl shadow-red-950/30">
          <p class="text-xs font-black uppercase tracking-[0.28em] text-red-300">
            Confirmar cierre
          </p>
          <h2 class="mt-3 text-3xl font-black">
            Finalizar votación
          </h2>
          <p class="mt-3 text-sm leading-6 text-slate-300">
            Al confirmar, la votación completa quedará cerrada y los usuarios ya no podrán votar.
          </p>

          <div class="mt-5 rounded-3xl border border-red-300/15 bg-red-500/10 p-4">
            <p class="text-xs font-black uppercase tracking-widest text-red-200">Votación</p>
            <p class="mt-2 text-lg font-black text-white">{{ poll?.title || 'Sin titulo' }}</p>
            <p class="mt-1 text-sm text-red-100">
              Esta acción publica el cierre final del proceso.
            </p>
          </div>

          <div class="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
              @click="isFinishPollModalOpen = false"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="min-h-12 rounded-2xl bg-red-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-red-950/40 transition hover:bg-red-400"
              @click="finishPoll"
            >
              Sí, finalizar votación
            </button>
          </div>
        </article>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="isLaunchModalOpen"
        class="fixed inset-0 z-80 grid place-items-center bg-black/80 px-4 backdrop-blur-md"
        @click.self="isLaunchModalOpen = false"
      >
        <article class="w-full max-w-lg rounded-4xl border border-emerald-300/25 bg-[#080a18] p-6 text-white shadow-2xl shadow-emerald-950/30">
          <p class="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">
            Confirmar lanzamiento
          </p>
          <h2 class="mt-3 text-3xl font-black">
            Lanzar votación en vivo
          </h2>
          <p class="mt-3 text-sm leading-6 text-slate-300">
            Al confirmar, los usuarios podrán entrar a la votación y empezar a votar en tiempo real.
          </p>

          <div class="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
            <p class="text-xs font-black uppercase tracking-widest text-slate-400">Votación</p>
            <p class="mt-2 text-lg font-black text-white">{{ poll?.title || 'Sin titulo' }}</p>
            <p class="mt-1 text-sm text-slate-400">
              {{ contestants.length }} participantes · {{ totalPollVotes }} votos actuales
            </p>
          </div>

          <div class="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
              @click="isLaunchModalOpen = false"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="min-h-12 rounded-2xl bg-linear-to-r from-emerald-500 to-cyan-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-emerald-950/40 transition hover:scale-[1.01]"
              @click="launchPoll"
            >
              Confirmar lanzamiento
            </button>
          </div>
        </article>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="isRoundModalOpen"
        class="fixed inset-0 z-80 grid place-items-center bg-black/80 px-4 backdrop-blur-md"
        @click.self="isRoundModalOpen = false"
      >
        <article class="w-full max-w-lg rounded-4xl border border-fuchsia-300/25 bg-[#080a18] p-6 text-white shadow-2xl shadow-fuchsia-950/30">
          <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
            Nueva fase
          </p>
          <h2 class="mt-3 text-3xl font-black">
            Crear fase
          </h2>
          <p class="mt-3 text-sm leading-6 text-slate-300">
            Crea una ronda y selecciona si sera tipo lista o versus.
          </p>

          <div class="mt-5 space-y-4">
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Nombre de la ronda</span>
              <input
                v-model="roundForm.title"
                type="text"
                class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
                placeholder="Ronda 1, Semifinal, Final..."
              />
            </label>

            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Fecha de finalización</span>
              <span class="relative mt-2 block">
                <input
                  ref="roundEndAtInput"
                  v-model="roundForm.endAt"
                  type="datetime-local"
                  class="min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 pr-14 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
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

            <div>
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Tipo de ronda</span>
              <div class="mt-2 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  class="min-h-24 rounded-2xl border px-4 text-left transition"
                  :class="
                    roundForm.type === 'list'
                      ? 'border-fuchsia-300/50 bg-fuchsia-400/15 text-white'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  "
                  @click="roundForm.type = 'list'"
                >
                  <span class="block text-sm font-black uppercase tracking-wide">Lista</span>
                  <span class="mt-2 block text-xs leading-5 text-slate-400">Ranking con varios artistas compitiendo.</span>
                </button>
                <button
                  type="button"
                  class="min-h-24 rounded-2xl border px-4 text-left transition"
                  :class="
                    roundForm.type === 'versus'
                      ? 'border-cyan-300/50 bg-cyan-400/15 text-white'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  "
                  @click="roundForm.type = 'versus'"
                >
                  <span class="block text-sm font-black uppercase tracking-wide">Versus</span>
                  <span class="mt-2 block text-xs leading-5 text-slate-400">Duelo entre opciones o ganadores.</span>
                </button>
              </div>
            </div>
          </div>

          <div class="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
              @click="isRoundModalOpen = false"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="min-h-12 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01]"
              @click="createRound"
            >
              Crear fase
            </button>
          </div>
        </article>
      </div>
    </Teleport>

  </section>
</template>
