<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  adjustAdminContestantVotes,
  closeAdminPoll,
  createAdminContestant,
  createAdminRound,
  finishAdminRound,
  getAdminArtists,
  getAdminMetrics,
  getAdminRounds,
  launchAdminRound,
  updateAdminRound,
} from '../../services/api/adminApi'
import { getPoll } from '../../services/api/pollsApi'
import { subscribePollRealtime } from '../../services/api/realtimeApi'
import {
  mergeContestantsWithPublicResults,
  startPublicResultsAggregator,
  subscribePublicResults,
} from '../../services/pollResults'
import { translate } from '../../i18n'

const props = defineProps({
  pollId: {
    type: String,
    required: true,
  },
})

const db = null

const buildRoundPayload = (round, extra = {}) => {
  const { contestants: _contestants, artist: _artist, ...rest } = round || {}
  return { ...rest, ...extra }
}

const poll = ref(null)
const artists = ref([])
const contestants = ref([])
const rounds = ref([])
const activeRoundContestants = ref([])
const recentActivity = ref([])
const publicResults = ref(null)
const selectedRoundId = ref('')
const winnersToAdvance = ref(2)
const manualVoteAmounts = ref({})
const roundForm = ref({
  title: '',
  type: 'list',
  endAt: '',
})
const isFinishPollModalOpen = ref(false)
const isRoundModalOpen = ref(false)
const roundEndAtInput = ref(null)
const errorMessage = ref('')
const successMessage = ref('')
let unsubscribeRealtime = null
let realtimeRefreshThrottle = 0
let metricsTimer = null
const serverMetrics = ref(null)
let unsubscribePoll = null
let unsubscribeContestants = null
let unsubscribeRounds = null
let unsubscribeActiveRoundContestants = null
let unsubscribePublicResults = null
let stopResultsAggregator = null

const getArtist = (artistId) => artists.value.find((artist) => artist.id === artistId)
const getArtistImage = (artist) =>
  artist?.image || artist?.imageUrl || artist?.photo || artist?.photoURL || artist?.foto || artist?.photoUrl || artist?.metadata?.image || artist?.metadata?.imageUrl || artist?.metadata?.photoUrl || artist?.metadata?.banner || artist?.banner || ''

const getUserName = (user) => user?.displayName || user?.username || user?.name || user?.email || translate('admin.monitor.userFallback')
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

// Regla: una fase solo se puede lanzar si TODAS las fases anteriores estan cerradas con ganadores.
const canLaunchRound = (round) => {
  const index = rounds.value.findIndex((item) => item.id === round.id)
  if (index <= 0) {
    return true
  }

  for (let i = 0; i < index; i += 1) {
    const previous = rounds.value[i]
    const winnerIds = previous.winnerIds || previous.config?.winnerIds || []
    if (previous.status !== 'closed' || !winnerIds.length) {
      return false
    }
  }

  return true
}

const activeRoundArtistIds = computed(() =>
  new Set(activeRoundContestants.value.map((contestant) => contestant.artistId)),
)

const activeRoundVotes = computed(() => {
  if (!activeRound.value) return []
  return recentActivity.value.filter((vote) =>
    vote.roundId ? vote.roundId === activeRound.value.id : activeRoundArtistIds.value.has(vote.artistId),
  )
})

const activeRoundRanking = computed(() =>
  mergeContestantsWithPublicResults(activeRoundContestants.value, publicResults.value)
    .map((contestant) => {
      const totalVotes = Math.max(0, Number(contestant.totalVotes || 0))

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
      user: {
        id: vote.userId,
        displayName: vote.userDisplayName,
        photoURL: vote.userPhotoURL,
      },
    })),
)

const userVoteLeaders = computed(() => {
  const totals = new Map()

  activeRoundVotes.value.forEach((vote) => {
    const current = totals.get(vote.userId) || {
      userId: vote.userId,
      amount: 0,
      user: {
        id: vote.userId,
        displayName: vote.userDisplayName,
        photoURL: vote.userPhotoURL,
      },
    }

    current.amount += Number(vote.amount || 1)
    totals.set(vote.userId, current)
  })

  return [...totals.values()].sort((current, next) => next.amount - current.amount).slice(0, 8)
})

const launchableRound = computed(() =>
  rounds.value.find(
    (round) => round.status !== 'live' && round.status !== 'closed' && canLaunchRound(round),
  ) || null,
)

// Paso guiado: dice en que estado esta la votacion y cual es la accion principal a hacer ahora.
const guidedStep = computed(() => {
  const status = poll.value?.status || 'draft'

  if (status === 'closed') {
    return {
      label: 'Votación cerrada',
      hint: 'Esta votación terminó. Los resultados ya están publicados.',
      tone: 'slate',
      actionLabel: '',
      action: null,
    }
  }

  if (status === 'live') {
    return {
      label: 'En vivo',
      hint: `Fase activa: "${activeRound.value?.title || '—'}". Los usuarios están votando en tiempo real.`,
      tone: 'emerald',
      actionLabel: `Finalizar fase y avanzar top ${winnersToAdvance.value}`,
      action: 'finish',
    }
  }

  if (status === 'selecting_winners') {
    if (launchableRound.value) {
      return {
        label: 'Ganadores elegidos',
        hint: `Listo. Ahora lanza la siguiente fase: "${launchableRound.value.title}".`,
        tone: 'cyan',
        actionLabel: `Lanzar ${launchableRound.value.title}`,
        action: 'launch',
      }
    }

    return {
      label: 'Eligiendo ganadores',
      hint: 'Los usuarios están esperando. Cuando no haya más fases, cierra la votación.',
      tone: 'amber',
      actionLabel: 'Cerrar votación',
      action: 'close',
    }
  }

  // Borrador
  if (!rounds.value.length) {
    return {
      label: 'Borrador',
      hint: 'Crea la primera fase para empezar la votación.',
      tone: 'cyan',
      actionLabel: 'Crear fase',
      action: 'createRound',
    }
  }

  if (launchableRound.value) {
    return {
      label: 'Lista para iniciar',
      hint: `Lanza la fase "${launchableRound.value.title}" para que los usuarios voten.`,
      tone: 'cyan',
      actionLabel: `Lanzar ${launchableRound.value.title}`,
      action: 'launch',
    }
  }

  return {
    label: 'Pendiente',
    hint: 'Elige los ganadores de la fase anterior para habilitar la siguiente.',
    tone: 'amber',
    actionLabel: '',
    action: null,
  }
})

const guidedToneClass = computed(
  () =>
    ({
      emerald: 'border-emerald-300/30 from-emerald-500/15',
      cyan: 'border-cyan-300/30 from-cyan-500/15',
      amber: 'border-amber-300/30 from-amber-500/15',
      slate: 'border-white/15 from-white/5',
    })[guidedStep.value.tone] || 'border-white/15 from-white/5',
)

const runGuidedAction = () => {
  const step = guidedStep.value

  if (step.action === 'createRound') {
    isRoundModalOpen.value = true
    return
  }

  if (step.action === 'launch' && launchableRound.value) {
    updateRoundStatus(launchableRound.value, 'live')
    return
  }

  if (step.action === 'finish') {
    finishActiveRound()
    return
  }

  if (step.action === 'close') {
    isFinishPollModalOpen.value = true
  }
}

const formatUptime = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds || 0)))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h > 0) {
    return `${h}h ${m}m`
  }
  return `${m}m`
}

const consumptionLevel = computed(() => {
  const rpm = Number(serverMetrics.value?.requestsPerMinute || 0)
  if (rpm < 200) {
    return { label: 'Bajo', tone: 'text-emerald-300' }
  }
  if (rpm < 1000) {
    return { label: 'Medio', tone: 'text-amber-300' }
  }
  return { label: 'Alto', tone: 'text-red-300' }
})

const loadServerMetrics = async () => {
  try {
    serverMetrics.value = await getAdminMetrics()
  } catch {
    // Silencioso: si falla, simplemente no se actualiza el panel de consumo.
  }
}

const toApiDate = (value) => (value ? new Date(value).toISOString() : null)

const openDatePicker = (input) => {
  input?.focus()
  input?.showPicker?.()
}

const formatDate = (value) => {
  const date = value?.toDate?.() || (value ? new Date(value) : null)
  return date
    ? new Intl.DateTimeFormat('es', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    : translate('polls.list.noDate')
}

const formatTime = (value) => {
  const date = value?.toDate?.() || (value ? new Date(value) : null)
  return date
    ? new Intl.DateTimeFormat('es', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(date)
    : translate('common.status.ready')
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
  const rows = await getAdminArtists()
  artists.value = rows.map((artist) => ({
    ...(artist.metadata || {}),
    ...artist,
    id: String(artist.id),
  }))
}

const listenPoll = () => {
  getPoll(props.pollId)
    .then((row) => {
      const config = row?.config || {}
      poll.value = row ? {
        ...config,
        ...row,
        id: String(row.id),
        activeRoundId: config.activeRoundId || row.activeRoundId || '',
        year: Number(config.year || row.year || new Date().getFullYear()),
      } : null
    })
    .catch(() => {
      errorMessage.value = translate('admin.monitor.errors.listenPoll')
    })
}

const listenContestants = () => {
  getPoll(props.pollId)
    .then((row) => {
      contestants.value = (row?.contestants || [])
        .filter((contestant) => !contestant.roundId)
        .map((contestant) => ({
          ...(contestant.metadata || {}),
          ...contestant,
          id: String(contestant.id),
          artistId: String(contestant.artistId),
          totalVotes: Number(contestant.totalVotes ?? Number(contestant.votes || 0) + Number(contestant.manualVotes || 0)),
        }))
    })
    .catch(() => {
      errorMessage.value = translate('admin.monitor.errors.listenVotes')
    })
}

const listenRounds = () => {
  getAdminRounds(props.pollId)
    .then((roundRows) => {
      rounds.value = roundRows.map((round) => ({
        ...(round.config || {}),
        ...round,
        id: String(round.id),
        type: round.type === 'versus' ? 'versus' : 'list',
        endAt: round.endsAt || round.config?.endAt || round.config?.endsAt || '',
        winnerIds: round.config?.winnerIds || [],
        contestants: (round.contestants || []).map((contestant) => ({
          ...(contestant.metadata || {}),
          ...contestant,
          id: String(contestant.id),
          artistId: String(contestant.artistId),
          totalVotes: Number(contestant.totalVotes ?? Number(contestant.votes || 0) + Number(contestant.manualVotes || 0)),
        })),
      }))

      if (!selectedRoundId.value || !rounds.value.some((round) => round.id === selectedRoundId.value)) {
        selectedRoundId.value = rounds.value.find((round) => round.status === 'live')?.id || rounds.value[0]?.id || ''
      }

      listenActiveRoundContestants()
      restartResultsAggregator()
    })
    .catch(() => {
      errorMessage.value = translate('admin.monitor.errors.listenRounds')
    })
}

const selectRound = (roundId) => {
  selectedRoundId.value = roundId
  listenActiveRoundContestants()
  restartResultsAggregator()
}

const listenActiveRoundContestants = () => {
  unsubscribeActiveRoundContestants?.()
  unsubscribePublicResults?.()
  activeRoundContestants.value = []
  publicResults.value = null
  recentActivity.value = []

  if (!activeRound.value) {
    return
  }

  activeRoundContestants.value = (activeRound.value.contestants || []).map((contestant) => ({
    ...contestant,
    artistId: String(contestant.artistId),
  }))

  unsubscribePublicResults = subscribePublicResults(db, {
    pollId: props.pollId,
    roundId: activeRound.value.id,
    onData: (results) => {
      publicResults.value = results
      recentActivity.value = results?.recentActivity || []
    },
    onError: () => {
      errorMessage.value = translate('admin.monitor.errors.listenResults')
    },
  })
}

const restartResultsAggregator = () => {
  stopResultsAggregator?.()
  stopResultsAggregator = null

  if (!activeRound.value?.id) {
    return
  }

  stopResultsAggregator = startPublicResultsAggregator({
    db,
    pollId: props.pollId,
    getRound: () => activeRound.value,
    onError: () => {
      errorMessage.value = translate('admin.monitor.errors.aggregate')
    },
  })
}

const updateRoundStatus = async (round, status) => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!round?.id) {
    errorMessage.value = translate('admin.monitor.errors.selectRound')
    return
  }

  try {
    if (status === 'live') {
      // Accion atomica de 1 clic: el backend cierra otras fases, fija la activa y valida
      // que las fases anteriores ya tengan ganadores elegidos.
      await launchAdminRound(props.pollId, round.id)
    } else {
      await updateAdminRound(props.pollId, round.id, buildRoundPayload(round, {
        type: round.type === 'versus' ? 'versus' : 'standard',
        status,
      }))
    }

    selectedRoundId.value = round.id
    successMessage.value = status === 'live' ? translate('admin.monitor.roundLaunched') : translate('admin.monitor.roundUpdated')
    listenPoll()
    listenRounds()
  } catch (error) {
    errorMessage.value = error?.message || translate('admin.monitor.errors.updateRound')
  }
}

const finishActiveRound = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!activeRound.value?.id) {
    errorMessage.value = translate('admin.monitor.errors.selectRound')
    return
  }

  if (isNextRoundLocked.value) {
    errorMessage.value = translate('admin.monitor.errors.nextRoundLocked')
    return
  }

  const winnerCount = Number(winnersToAdvance.value || 1)
  const winners = activeRoundRanking.value.slice(0, winnerCount)

  if (!winners.length) {
    errorMessage.value = translate('admin.monitor.errors.noWinners')
    return
  }

  try {
    const winnerIds = winners.map((winner) => winner.artistId)

    await finishAdminRound(props.pollId, activeRound.value.id, {
      winnerIds,
      winnerCount,
    })

    successMessage.value = activeRound.value.status === 'closed'
      ? translate('admin.monitor.winnersUpdated', { count: winnerCount })
      : translate('admin.monitor.roundFinished', { count: winnerCount })
    listenPoll()
    listenRounds()
  } catch {
    errorMessage.value = translate('admin.monitor.errors.finishRound')
  }
}

const finishPoll = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await closeAdminPoll(props.pollId)
    successMessage.value = translate('admin.monitor.statusUpdated')
    listenPoll()
  } catch (error) {
    errorMessage.value = error?.message || translate('admin.monitor.errors.updateStatus')
  } finally {
    isFinishPollModalOpen.value = false
  }
}

const addManualVotes = async (contestant) => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!activeRound.value?.id) {
    errorMessage.value = translate('admin.monitor.errors.selectRound')
    return
  }

  const amount = Number(manualVoteAmounts.value[contestant.id] || 0)

  if (!Number.isInteger(amount) || amount === 0) {
    errorMessage.value = translate('admin.monitor.errors.invalidManualVotes')
    return
  }

  if (amount < 0 && contestant.totalVotes + amount < 0) {
    errorMessage.value = translate('admin.monitor.errors.negativeVotes')
    return
  }

  try {
    await adjustAdminContestantVotes(props.pollId, contestant.id, amount)

    manualVoteAmounts.value = {
      ...manualVoteAmounts.value,
      [contestant.id]: '',
    }
    successMessage.value = amount > 0
      ? translate('admin.monitor.manualVotesAdded', { count: amount })
      : translate('admin.monitor.manualVotesRemoved', { count: Math.abs(amount) })
    restartResultsAggregator()
    listenActiveRoundContestants()
  } catch {
    errorMessage.value = translate('admin.monitor.errors.adjustVotes')
  }
}

const createRound = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!roundForm.value.title.trim()) {
    errorMessage.value = translate('admin.monitor.errors.roundName')
    return
  }

  try {
    const sourceWinnerIds = rounds.value[rounds.value.length - 1]?.winnerIds || []
    const endAt = toApiDate(roundForm.value.endAt)
    const round = await createAdminRound(props.pollId, {
      title: roundForm.value.title.trim(),
      type: roundForm.value.type === 'versus' ? 'versus' : 'standard',
      endAt,
      endsAt: endAt,
      status: 'draft',
    })

    await Promise.all(
      sourceWinnerIds.map((artistId) =>
        createAdminContestant(props.pollId, {
          roundId: round.id,
          artistId,
          votes: 0,
          manualVotes: 0,
          totalVotes: 0,
          isWinner: false,
          winnerRank: null,
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
      ? translate('admin.monitor.roundCreatedWithWinners')
      : translate('admin.monitor.roundCreated')
    listenRounds()
  } catch {
    errorMessage.value = translate('admin.monitor.errors.createRound')
  }
}

const refreshFromRealtime = () => {
  const nowMs = Date.now()
  if (nowMs - realtimeRefreshThrottle < 800) {
    return
  }
  realtimeRefreshThrottle = nowMs
  listenPoll()
  listenRounds()
  listenActiveRoundContestants()
}

onMounted(async () => {
  await loadArtists()
  listenPoll()
  listenContestants()
  listenRounds()

  // Admin en vivo por socket: cuando cambia el estado, llegan votos o se ajustan votos manuales,
  // el panel se refresca solo (sin recargar y sin polling agresivo).
  unsubscribeRealtime = subscribePollRealtime(props.pollId, {
    onPollStateChanged: refreshFromRealtime,
    onResultsDirty: refreshFromRealtime,
  })

  loadServerMetrics()
  metricsTimer = window.setInterval(loadServerMetrics, 10000)
})

onUnmounted(() => {
  unsubscribePoll?.()
  unsubscribeContestants?.()
  unsubscribeRounds?.()
  unsubscribeActiveRoundContestants?.()
  unsubscribePublicResults?.()
  unsubscribeRealtime?.()
  stopResultsAggregator?.()
  window.clearInterval(metricsTimer)
})
</script>

<template>
  <section class="space-y-6">
    <div>
      <div>
        <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
          {{ $t('admin.monitor.panel') }}
        </p>
        <h2 class="mt-2 text-3xl font-black text-white">
          {{ poll?.title || $t('admin.monitor.defaultPoll') }}
        </h2>
        <p class="mt-2 text-sm text-slate-400">
          {{ $t('admin.monitor.description') }}
        </p>
      </div>
    </div>

    <article
      class="relative overflow-hidden rounded-3xl border bg-linear-to-br to-[#0a0c1c] p-5 sm:p-6"
      :class="guidedToneClass"
    >
      <div class="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-white/5 blur-3xl"></div>
      <div class="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="min-w-0">
          <p class="text-xs font-black uppercase tracking-[0.28em] text-slate-300">
            Paso actual
          </p>
          <h3 class="mt-2 flex items-center gap-3 text-2xl font-black text-white">
            <span class="grid size-9 place-items-center rounded-2xl border border-white/15 bg-black/30 text-base">
              <i
                class="fa-solid"
                :class="{
                  'fa-tower-broadcast text-emerald-300': guidedStep.tone === 'emerald',
                  'fa-rocket text-cyan-300': guidedStep.tone === 'cyan',
                  'fa-hourglass-half text-amber-300': guidedStep.tone === 'amber',
                  'fa-flag-checkered text-slate-300': guidedStep.tone === 'slate',
                }"
                aria-hidden="true"
              ></i>
            </span>
            {{ guidedStep.label }}
          </h3>
          <p class="mt-2 max-w-2xl text-sm font-bold leading-6 text-slate-300">
            {{ guidedStep.hint }}
          </p>
        </div>

        <button
          v-if="guidedStep.action"
          type="button"
          class="inline-flex min-h-13 shrink-0 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.02]"
          @click="runGuidedAction"
        >
          <i class="fa-solid fa-bolt" aria-hidden="true"></i>
          {{ guidedStep.actionLabel }}
        </button>
      </div>
    </article>

    <article class="relative overflow-hidden rounded-3xl border border-cyan-300/15 bg-[#0a0c1c]/80 p-5 sm:p-6">
      <div class="pointer-events-none absolute -right-16 -bottom-16 size-44 rounded-full bg-cyan-500/10 blur-3xl"></div>
      <div class="relative flex items-center justify-between gap-3">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Consumo del servidor</p>
          <h3 class="mt-1 text-xl font-black text-white">Uso en vivo (estimado)</h3>
        </div>
        <span
          class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest"
          :class="consumptionLevel.tone"
        >
          {{ consumptionLevel.label }}
        </span>
      </div>

      <div class="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div class="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Llamados/min</p>
          <p class="mt-1 text-2xl font-black text-white">{{ serverMetrics?.requestsPerMinute ?? '—' }}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Llamados total</p>
          <p class="mt-1 text-2xl font-black text-white">{{ (serverMetrics?.requests ?? 0).toLocaleString('es') }}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Conexiones live</p>
          <p class="mt-1 text-2xl font-black text-cyan-200">{{ serverMetrics?.realtimeConnections ?? 0 }}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Votos en cola</p>
          <p class="mt-1 text-2xl font-black text-fuchsia-200">{{ serverMetrics?.votesStreamLength ?? 0 }}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Votos en base</p>
          <p class="mt-1 text-2xl font-black text-white">{{ (serverMetrics?.db?.votes ?? 0).toLocaleString('es') }}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Activo desde</p>
          <p class="mt-1 text-2xl font-black text-white">{{ formatUptime(serverMetrics?.uptimeSeconds) }}</p>
        </div>
      </div>

      <p class="relative mt-4 text-xs font-bold text-slate-500">
        Usuarios, comentarios y artistas:
        {{ (serverMetrics?.db?.users ?? 0).toLocaleString('es') }} usuarios ·
        {{ (serverMetrics?.db?.comments ?? 0).toLocaleString('es') }} comentarios ·
        {{ (serverMetrics?.db?.artists ?? 0).toLocaleString('es') }} artistas
      </p>
    </article>

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

    <section>
      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
              {{ $t('admin.monitor.rounds') }}
            </p>
            <h3 class="mt-2 text-2xl font-black text-white">
              {{ $t('admin.monitor.roundsSystem') }}
            </h3>
          </div>
          <div class="flex items-center gap-2">
            <span class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-300">
              {{ $t('admin.monitor.roundsCount', { count: rounds.length }) }}
            </span>
            <button
              type="button"
              class="rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01]"
              @click="isRoundModalOpen = true"
            >
              {{ $t('admin.monitor.createPhase') }}
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
                <p class="text-xs font-black uppercase tracking-widest text-fuchsia-300">{{ $t('admin.monitor.phaseNumber', { number: index + 1 }) }}</p>
                <p class="mt-2 text-xl font-black text-white">{{ round.title }}</p>
                <p class="mt-1 text-sm text-slate-400">{{ $t('admin.monitor.state', { status: round.status || 'draft' }) }}</p>
                <p class="mt-1 text-sm text-slate-400">{{ $t('admin.monitor.endsAt', { date: formatDate(round.endAt) }) }}</p>
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
                Ver resumen
              </button>
              <a
                :href="`/admin/votaciones/${props.pollId}/rondas/${round.id}`"
                class="inline-flex min-h-10 items-center justify-center rounded-2xl border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 text-xs font-black text-fuchsia-100 transition hover:bg-fuchsia-400/20"
              >
                {{ $t('admin.monitor.configure') }}
              </a>
            </div>
          </div>

          <p
            v-if="!rounds.length"
            class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400"
          >
            {{ $t('admin.monitor.emptyRounds') }}
          </p>
        </div>

      </article>
    </section>

    <section class="grid gap-6 xl:grid-cols-[1fr_0.45fr]">
      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
              {{ $t('admin.monitor.realtime') }}
            </p>
            <h3 class="mt-2 text-2xl font-black text-white">
              {{ activeRound?.title || $t('admin.monitor.firstRound') }}
            </h3>
            <p class="mt-2 text-sm text-slate-400">
              {{ $t('admin.monitor.rankingSummary', { votes: totalActiveRoundVotes }) }}
            </p>
          </div>
          <div v-if="activeRound" class="flex flex-wrap items-center gap-2">
            <span class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-300">
              {{ activeRound.type === 'versus' ? 'Versus' : 'Lista' }} · {{ activeRound.status || 'draft' }}
            </span>
            <label class="flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200">
              {{ $t('admin.monitor.advance') }}
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
              {{ activeRound.status === 'closed' ? $t('admin.monitor.saveWinners') : $t('admin.monitor.finishRound') }}
            </button>
            <span
              v-if="activeRound.status === 'closed'"
              class="text-xs font-bold text-slate-500"
            >
              <span v-if="isNextRoundLocked">{{ $t('admin.monitor.lockedNextRound') }}</span>
              <span v-else>{{ $t('admin.monitor.canChangeUntilNext') }}</span>
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
                    <span class="block truncate font-black text-white">{{ contestant.artist?.name || $t('admin.common.artist') }}</span>
                    <span
                      v-if="contestant.isWinner"
                      class="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-100"
                    >
                      {{ $t('admin.monitor.winnerRank', { rank: contestant.winnerRank || index + 1 }) }}
                    </span>
                  </span>
                  <span class="block truncate text-xs text-slate-400">{{ $t('admin.monitor.individualVotes', { count: contestant.totalVotes }) }}</span>
                </span>
              </div>
              <div class="text-right">
                <p class="text-lg font-black text-white">{{ percentFor(contestant.totalVotes, totalActiveRoundVotes) }}</p>
                <p class="text-xs font-bold text-slate-500">{{ $t('admin.monitor.representation') }}</p>
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
                :placeholder="$t('admin.monitor.manualVotesPlaceholder')"
              />
              <button
                type="button"
                class="min-h-10 rounded-2xl border border-violet-300/25 bg-violet-400/10 px-4 text-xs font-black text-violet-100 transition hover:bg-violet-400/20"
                @click="addManualVotes(contestant)"
              >
                {{ $t('admin.monitor.adjustVotes') }}
              </button>
            </div>
          </div>

          <p
            v-if="!activeRoundRanking.length"
            class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400"
          >
            {{ $t('admin.monitor.emptyRoundArtists') }}
          </p>
        </div>

        <p
          v-else
          class="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400"
        >
          {{ $t('admin.monitor.createRoundForStats') }}
        </p>
      </article>

      <div class="grid gap-6">
        <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
          <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            {{ $t('admin.monitor.recentVotes') }}
          </p>
          <h3 class="mt-2 text-2xl font-black text-white">{{ $t('admin.monitor.activity') }}</h3>

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
                  <span class="block truncate text-xs text-slate-400">{{ $t('admin.monitor.votedFor', { artist: vote.artist?.name || $t('admin.monitor.artistFallback') }) }}</span>
                </span>
              </div>
              <span class="text-xs font-bold text-slate-500">{{ formatTime(vote.createdAt) }}</span>
            </div>

            <p
              v-if="!recentRoundVotes.length"
              class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400"
            >
              {{ $t('admin.monitor.emptyRecentVotes') }}
            </p>
          </div>
        </article>

        <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
          <p class="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">
            {{ $t('admin.monitor.users') }}
          </p>
          <h3 class="mt-2 text-2xl font-black text-white">{{ $t('admin.monitor.topUsers') }}</h3>

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
                {{ $t('admin.common.votes', { count: leader.amount }) }}
              </span>
            </div>

            <p
              v-if="!userVoteLeaders.length"
              class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400"
            >
              {{ $t('admin.monitor.emptyVotingUsers') }}
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
            {{ $t('admin.monitor.confirmClose') }}
          </p>
          <h2 class="mt-3 text-3xl font-black">
            Finalizar votación
          </h2>
          <p class="mt-3 text-sm leading-6 text-slate-300">
            Al confirmar, la votación completa quedará cerrada y los usuarios ya no podrán votar.
          </p>

          <div class="mt-5 rounded-3xl border border-red-300/15 bg-red-500/10 p-4">
            <p class="text-xs font-black uppercase tracking-widest text-red-200">{{ $t('admin.monitor.pollLabel') }}</p>
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
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.monitor.roundName') }}</span>
              <input
                v-model="roundForm.title"
                type="text"
                class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
                :placeholder="$t('admin.monitor.roundNamePlaceholder')"
              />
            </label>

            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.monitor.roundEndDate') }}</span>
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
                  :aria-label="$t('admin.monitor.openCalendar')"
                  @click="openDatePicker(roundEndAtInput)"
                >
                  <svg class="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </span>
            </label>

            <div>
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.monitor.roundType') }}</span>
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
                  <span class="block text-sm font-black uppercase tracking-wide">{{ $t('admin.monitor.typeList') }}</span>
                  <span class="mt-2 block text-xs leading-5 text-slate-400">{{ $t('admin.monitor.typeListDescription') }}</span>
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
                  <span class="block text-sm font-black uppercase tracking-wide">{{ $t('admin.monitor.typeVersus') }}</span>
                  <span class="mt-2 block text-xs leading-5 text-slate-400">{{ $t('admin.monitor.typeVersusDescription') }}</span>
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
