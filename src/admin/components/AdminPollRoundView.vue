<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  createAdminContestant,
  deleteAdminContestant,
  deleteAdminRound,
  generateAdminVersus,
  getAdminArtists,
  getAdminRounds,
  updateAdminContestant,
  updateAdminRound,
} from '../../services/api/adminApi'
import { getPoll } from '../../services/api/pollsApi'
import { translate } from '../../i18n'

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
const isGeneratingVersus = ref(false)
const addingArtistId = ref('')
const removingContestantId = ref('')
const roundEndAtInput = ref(null)
const selectedGroupArtistIds = ref([])
const contestantToRemove = ref(null)
const artistSearch = ref('')
const draggedVersusContestantId = ref('')
const isReorderingVersus = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const copiedEmbed = ref('')

const roundArtistIds = computed(() => new Set(roundContestants.value.map((contestant) => contestant.artistId)))
const currentRoundIndex = computed(() => rounds.value.findIndex((item) => item.id === props.roundId))
const previousRound = computed(() => {
  if (currentRoundIndex.value <= 0) {
    return null
  }

  return rounds.value[currentRoundIndex.value - 1] || null
})
const previousWinnerIds = computed(() => previousRound.value?.winnerIds || [])
const availableArtistsBase = computed(() => {
  const sourceArtists = previousRound.value
    ? artists.value.filter((artist) => previousWinnerIds.value.includes(artist.id))
    : artists.value

  return sourceArtists.filter((artist) => !roundArtistIds.value.has(artist.id))
})
const availableArtists = computed(() => {
  const search = artistSearch.value.trim().toLowerCase()

  if (!search) {
    return availableArtistsBase.value
  }

  return availableArtistsBase.value.filter((artist) =>
    [
      artist.name,
      artist.group,
      artist.fandom,
      artist.country,
      artist.role,
      artist.genre,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search)),
  )
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
const versusCompletedGroups = computed(() =>
  versusGroups.value.filter((group) => group.contestants.length === 2),
)
const versusIncompleteGroups = computed(() =>
  versusGroups.value.filter((group) => group.contestants.length !== 2),
)
const canGenerateVersus = computed(() =>
  roundForm.value.type === 'versus' && currentContestants.value.length >= 2,
)

const getArtistImage = (artist) =>
  artist?.image || artist?.imageUrl || artist?.photo || artist?.photoURL || artist?.foto || artist?.photoUrl || artist?.metadata?.image || artist?.metadata?.imageUrl || artist?.metadata?.photoUrl || artist?.metadata?.banner || artist?.banner || ''

const getArtistGroup = (artist) => artist?.group || artist?.fandom || ''
const publicPollPath = computed(() =>
  `/votacion/${poll.value?.year || new Date().getFullYear()}/${poll.value?.slug || props.pollId}`,
)
const buildRoundEmbedUrl = (groupNumber = null) => {
  const url = new URL(publicPollPath.value, window.location.origin)
  url.searchParams.set('ronda', props.roundId)
  url.searchParams.set('embed', '1')

  if (groupNumber) {
    url.searchParams.set('duelo', String(groupNumber))
  }

  return url.toString()
}
const roundEmbedUrl = computed(() => buildRoundEmbedUrl())
const buildEmbedFrameId = (groupNumber = null) =>
  `wmv-embed-${String(props.roundId).replace(/[^a-zA-Z0-9_-]/g, '-')}${groupNumber ? `-duelo-${groupNumber}` : ''}`
const buildIframeCode = (url, frameId) =>
  [
    `<iframe id="${frameId}" src="${url}" width="100%" style="width:100%; min-height:360px; border:0; border-radius:24px; overflow:hidden;" loading="lazy"></iframe>`,
    '<script>',
    '  window.addEventListener("message", function(event) {',
    '    var data = event.data || {};',
    `    if (data.type !== "wmv-embed-height" || !data.src || data.src.indexOf("${url}") !== 0) return;`,
    `    var iframe = document.getElementById("${frameId}");`,
    '    if (iframe) iframe.style.height = Math.max(360, Number(data.height || 0)) + "px";',
    '  });',
    '</scr' + 'ipt>',
  ].join('\n')
const buildGroupIframeCode = (groupNumber) => {
  const url = buildRoundEmbedUrl(groupNumber)
  return buildIframeCode(url, buildEmbedFrameId(groupNumber))
}
const embedFrameId = computed(() => buildEmbedFrameId())
const roundIframeCode = computed(() => buildIframeCode(roundEmbedUrl.value, embedFrameId.value))
const groupEmbedRows = computed(() =>
  roundForm.value.type === 'versus'
    ? versusGroups.value.map((group) => ({
        groupNumber: group.groupNumber,
        title: `Duelo ${group.groupNumber}`,
        url: buildRoundEmbedUrl(group.groupNumber),
        iframe: buildGroupIframeCode(group.groupNumber),
      }))
    : [],
)
const availableArtistsHelp = computed(() =>
  previousRound.value
    ? `Solo puedes asignar ganadores de ${previousRound.value.title || 'la ronda anterior'}.`
    : 'Agrega artistas a esta ronda.',
)
const versusSetupHint = computed(() => {
  if (currentContestants.value.length < 2) {
    return 'Agrega al menos 2 artistas para crear el primer VS.'
  }

  if (currentContestants.value.length % 2 !== 0) {
    return 'Hay un artista sin pareja. Puedes generar igual y completar ese duelo despues.'
  }

  if (!versusCompletedGroups.value.length) {
    return 'Ya puedes generar los duelos automaticos con los artistas asignados.'
  }

  return 'Duelos listos. Revisa los pares antes de lanzar la fase.'
})

const formatDate = (value) => {
  const date = value?.toDate?.() || (value ? new Date(value) : null)
  return date
    ? new Intl.DateTimeFormat('es', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    : 'Sin fecha'
}

const toDatetimeLocal = (value) => {
  const date = value?.toDate?.() || (value ? new Date(value) : null)

  if (!date || Number.isNaN(date.getTime())) {
    return ''
  }

  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

const toApiDate = (value) => (value ? new Date(value).toISOString() : null)

const openDatePicker = (input) => {
  input?.focus()
  input?.showPicker?.()
}

const copyToClipboard = async (value, type) => {
  try {
    await navigator.clipboard.writeText(value)
    copiedEmbed.value = type
    window.setTimeout(() => {
      if (copiedEmbed.value === type) {
        copiedEmbed.value = ''
      }
    }, 2200)
  } catch {
    errorMessage.value = 'No se pudo copiar. Selecciona el texto manualmente.'
  }
}

const loadArtists = async () => {
  const rows = await getAdminArtists()
  artists.value = rows.map((artist) => ({
    ...(artist.metadata || {}),
    ...artist,
    id: String(artist.id),
  }))
}

const listenBaseData = async () => {
  const [pollRow, roundRows] = await Promise.all([
    getPoll(props.pollId),
    getAdminRounds(props.pollId),
  ])

  poll.value = pollRow ? {
    ...(pollRow.config || {}),
    ...pollRow,
    id: String(pollRow.id),
    year: Number(pollRow.config?.year || pollRow.year || new Date().getFullYear()),
  } : null
  rounds.value = roundRows.map((roundRow) => ({
    ...(roundRow.config || {}),
    ...roundRow,
    id: String(roundRow.id),
    type: roundRow.type === 'versus' ? 'versus' : 'list',
    endAt: roundRow.endsAt || roundRow.config?.endAt || roundRow.config?.endsAt || '',
    winnerIds: roundRow.config?.winnerIds || [],
    contestants: (roundRow.contestants || []).map((contestant) => ({
      ...(contestant.metadata || {}),
      ...contestant,
      id: String(contestant.id),
      artistId: String(contestant.artistId),
      totalVotes: Number(contestant.totalVotes ?? Number(contestant.votes || 0) + Number(contestant.manualVotes || 0)),
    })),
  }))
  round.value = rounds.value.find((item) => item.id === props.roundId) || null

  if (round.value) {
    roundForm.value = {
      title: round.value.title || '',
      type: round.value.type || 'list',
      status: round.value.status || 'draft',
      endAt: toDatetimeLocal(round.value.endAt || round.value.endsAt),
    }
  }

  roundContestants.value = round.value?.contestants || []
}

const addRoundContestant = async (artist) => {
  errorMessage.value = ''
  successMessage.value = ''
  addingArtistId.value = artist.id

  try {
    await createAdminContestant(props.pollId, {
      roundId: props.roundId,
      artistId: artist.id,
      votes: 0,
      manualVotes: 0,
      totalVotes: 0,
      isWinner: false,
      winnerRank: null,
      order: roundContestants.value.length,
      matchGroup: 0,
      matchOrder: 0,
    })
    successMessage.value = translate('admin.round.added')
    await listenBaseData()
  } catch {
    errorMessage.value = translate('admin.round.errors.add')
  } finally {
    addingArtistId.value = ''
  }
}

const toggleGroupArtist = (contestantId) => {
  if (selectedGroupArtistIds.value.includes(contestantId)) {
    selectedGroupArtistIds.value = selectedGroupArtistIds.value.filter((id) => id !== contestantId)
    return
  }

  if (selectedGroupArtistIds.value.length >= 2) {
    errorMessage.value = translate('admin.round.errors.groupLimit')
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

const generateVersusAuto = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (currentContestants.value.length < 2) {
    errorMessage.value = 'Agrega al menos 2 artistas para generar duelos.'
    return
  }

  try {
    isGeneratingVersus.value = true
    const result = await generateAdminVersus(props.pollId, props.roundId)
    successMessage.value = `Duelos generados: ${result.groups || ''}.`
    await listenBaseData()
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudieron generar los duelos.'
  } finally {
    isGeneratingVersus.value = false
  }
}

const createVersusGroup = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (selectedGroupArtistIds.value.length !== 2) {
    errorMessage.value = translate('admin.round.errors.groupExact')
    return
  }

  const nextGroupNumber = Math.max(0, ...currentContestants.value.map((contestant) => Number(contestant.matchGroup || 0))) + 1

  try {
    await Promise.all(selectedGroupArtistIds.value.map((contestantId, index) =>
      updateAdminContestant(props.pollId, contestantId, {
        matchGroup: nextGroupNumber,
        matchOrder: index,
      }),
    ))
    selectedGroupArtistIds.value = []
    isGroupModalOpen.value = false
    successMessage.value = `Grupo ${nextGroupNumber} creado.`
    await listenBaseData()
  } catch {
    errorMessage.value = translate('admin.round.errors.createGroup')
  }
}

const removeVersusGroup = async (group) => {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await Promise.all(group.contestants.map((contestant) =>
      updateAdminContestant(props.pollId, contestant.id, {
        matchGroup: 0,
        matchOrder: 0,
      }),
    ))
    successMessage.value = `Grupo ${group.groupNumber} eliminado.`
    await listenBaseData()
  } catch {
    errorMessage.value = translate('admin.round.errors.deleteGroup')
  }
}

const startVersusDrag = (contestant) => {
  draggedVersusContestantId.value = contestant?.id || ''
}

const clearVersusDrag = () => {
  draggedVersusContestantId.value = ''
}

const dropVersusContestant = async (targetContestant, targetGroupNumber, targetOrder) => {
  const draggedId = draggedVersusContestantId.value
  clearVersusDrag()

  if (!draggedId || isReorderingVersus.value) {
    return
  }

  const draggedContestant = currentContestants.value.find((contestant) => contestant.id === draggedId)
  if (!draggedContestant || draggedContestant.id === targetContestant?.id) {
    return
  }

  const fromGroup = Number(draggedContestant.matchGroup || 0)
  const fromOrder = Number(draggedContestant.matchOrder || 0)
  const toGroup = Number(targetGroupNumber || targetContestant?.matchGroup || 0)
  const toOrder = Number(targetOrder ?? targetContestant?.matchOrder ?? 0)

  if (!toGroup) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''
  isReorderingVersus.value = true

  try {
    const updates = [
      updateAdminContestant(props.pollId, draggedContestant.id, {
        matchGroup: toGroup,
        matchOrder: toOrder,
      }),
    ]

    if (targetContestant?.id) {
      updates.push(updateAdminContestant(props.pollId, targetContestant.id, {
        matchGroup: fromGroup || toGroup,
        matchOrder: fromGroup ? fromOrder : toOrder,
      }))
    }

    await Promise.all(updates)
    successMessage.value = 'Duelo actualizado.'
    await listenBaseData()
  } catch {
    errorMessage.value = 'No se pudo actualizar el duelo.'
  } finally {
    isReorderingVersus.value = false
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
    await Promise.all([
      updateAdminContestant(props.pollId, contestant.id, {
      order: targetContestant.order,
      }),
      updateAdminContestant(props.pollId, targetContestant.id, {
        order: contestant.order,
      }),
    ])
    await listenBaseData()
  } catch {
    errorMessage.value = translate('admin.round.errors.reorder')
  }
}

const saveRoundSettings = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!roundForm.value.title.trim()) {
    errorMessage.value = translate('admin.round.errors.nameRequired')
    return
  }

  isSavingRound.value = true

  try {
    const endAt = toApiDate(roundForm.value.endAt)
    const { contestants: _contestants, artist: _artist, ...roundRest } = round.value || {}

    await updateAdminRound(props.pollId, props.roundId, {
      ...roundRest,
      title: roundForm.value.title.trim(),
      type: roundForm.value.type === 'versus' ? 'versus' : 'standard',
      status: roundForm.value.status,
      endAt,
      endsAt: endAt,
    })
    successMessage.value = translate('admin.round.updated')
    await listenBaseData()
  } catch {
    errorMessage.value = translate('admin.round.errors.update')
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
  removingContestantId.value = contestantToRemove.value.id

  try {
    await deleteAdminContestant(props.pollId, contestantToRemove.value.id)
    isRemoveContestantModalOpen.value = false
    contestantToRemove.value = null
    successMessage.value = translate('admin.round.removed')
    await listenBaseData()
  } catch {
    errorMessage.value = translate('admin.round.errors.remove')
  } finally {
    isRemovingContestant.value = false
    removingContestantId.value = ''
  }
}

const deleteRound = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  isDeletingRound.value = true

  try {
    await deleteAdminRound(props.pollId, props.roundId)

    isDeleteModalOpen.value = false
    window.location.href = `/admin/votaciones/${props.pollId}`
  } catch {
    errorMessage.value = translate('admin.round.errors.delete')
    isDeletingRound.value = false
  }
}

onMounted(async () => {
  await loadArtists()
  await listenBaseData()
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
            <h3 class="mt-1 text-xl font-black text-white">{{ $t('admin.round.configTitle') }}</h3>
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
            <span class="text-xs font-black uppercase tracking-widest text-slate-300">{{ $t('admin.round.roundName') }}</span>
            <input
              v-model="roundForm.title"
              type="text"
              class="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
              :placeholder="$t('admin.round.roundNamePlaceholder')"
            />
          </label>

          <div class="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-2.5 xl:col-span-3">
            <p class="text-xs font-black uppercase tracking-widest text-slate-500">{{ $t('admin.round.type') }}</p>
            <p class="mt-1 text-sm font-bold text-slate-200">
              {{ roundForm.type === 'versus' ? 'Versus' : 'Lista' }}
            </p>
          </div>

          <label class="space-y-2 xl:col-span-3">
            <span class="text-xs font-black uppercase tracking-widest text-slate-300">{{ $t('admin.round.status') }}</span>
            <select
              v-model="roundForm.status"
              class="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
            >
              <option value="draft">{{ $t('common.status.draft') }}</option>
              <option value="live">{{ $t('common.status.live') }}</option>
              <option value="closed">{{ $t('common.status.closed') }}</option>
            </select>
          </label>

          <div class="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-2.5 xl:col-span-12">
            <p class="text-xs font-black uppercase tracking-widest text-slate-500">{{ $t('admin.round.ends') }}</p>
            <p class="mt-1 text-sm font-bold text-slate-200">{{ formatDate(round?.endAt) }}</p>
          </div>

          <label class="space-y-2 xl:col-span-12">
            <span class="text-xs font-black uppercase tracking-widest text-slate-300">{{ $t('admin.round.endDate') }}</span>
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
                :aria-label="$t('admin.monitor.openCalendar')"
                @click="openDatePicker(roundEndAtInput)"
              >
                <svg class="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </span>
          </label>

          <div class="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-2.5 xl:col-span-7">
            <span class="text-xs font-black uppercase tracking-widest text-slate-500">{{ $t('admin.round.id') }}</span>
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

        <div class="mt-5 rounded-3xl border border-cyan-300/15 bg-cyan-400/8 p-4">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                Embed de esta ronda
              </p>
              <h4 class="mt-1 text-lg font-black text-white">
                Código para pegar en otra web
              </h4>
              <p class="mt-1 text-xs leading-5 text-slate-400">
                Abre solo el cuadro de votación de esta ronda, sin navbar, footer ni comentarios.
              </p>
            </div>
            <a
              :href="roundEmbedUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex min-h-10 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 text-xs font-black uppercase text-cyan-100 transition hover:bg-cyan-400/20"
            >
              Ver ejemplo
            </a>
          </div>

          <div class="mt-4 grid gap-3">
            <label class="block">
              <span class="text-xs font-black uppercase tracking-widest text-slate-400">
                URL embed
              </span>
              <div class="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  :value="roundEmbedUrl"
                  readonly
                  class="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-xs font-bold text-slate-200 outline-none"
                />
                <button
                  type="button"
                  class="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-xs font-black uppercase text-slate-100 transition hover:bg-white/12"
                  @click="copyToClipboard(roundEmbedUrl, 'url')"
                >
                  {{ copiedEmbed === 'url' ? 'Copiado' : 'Copiar URL' }}
                </button>
              </div>
            </label>

            <label class="block">
              <span class="text-xs font-black uppercase tracking-widest text-slate-400">
                Código iframe
              </span>
              <textarea
                :value="roundIframeCode"
                readonly
                rows="4"
                class="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-xs font-bold leading-5 text-slate-200 outline-none"
              ></textarea>
              <div class="mt-2 flex justify-end">
                <button
                  type="button"
                  class="rounded-2xl bg-linear-to-r from-cyan-500 to-fuchsia-500 px-5 py-3 text-xs font-black uppercase text-white shadow-lg shadow-cyan-950/25 transition hover:scale-[1.01]"
                  @click="copyToClipboard(roundIframeCode, 'iframe')"
                >
                  {{ copiedEmbed === 'iframe' ? 'Iframe copiado' : 'Copiar iframe' }}
                </button>
              </div>
            </label>

            <div
              v-if="groupEmbedRows.length"
              class="rounded-3xl border border-fuchsia-300/15 bg-fuchsia-400/8 p-3"
            >
              <p class="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300">
                Embeds por duelo
              </p>
              <p class="mt-1 text-xs text-slate-400">
                Usa estos si quieres pegar solo un versus específico, por ejemplo Duelo 1.
              </p>
              <div class="mt-3 grid gap-2 sm:grid-cols-2">
                <div
                  v-for="group in groupEmbedRows"
                  :key="`embed-group-${group.groupNumber}`"
                  class="rounded-2xl border border-white/10 bg-slate-950/45 p-3"
                >
                  <p class="text-sm font-black text-white">
                    {{ group.title }}
                  </p>
                  <p class="mt-1 truncate text-[10px] font-bold text-slate-500">
                    {{ group.url }}
                  </p>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <a
                      :href="group.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex min-h-9 items-center justify-center rounded-xl border border-white/10 bg-white/8 px-3 text-[10px] font-black uppercase text-slate-200 transition hover:bg-white/12"
                    >
                      Ver
                    </a>
                    <button
                      type="button"
                      class="inline-flex min-h-9 items-center justify-center rounded-xl border border-fuchsia-300/25 bg-fuchsia-400/10 px-3 text-[10px] font-black uppercase text-fuchsia-100 transition hover:bg-fuchsia-400/20"
                      @click="copyToClipboard(group.iframe, `duelo-${group.groupNumber}`)"
                    >
                      {{ copiedEmbed === `duelo-${group.groupNumber}` ? 'Copiado' : 'Copiar iframe' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>

      <article class="rounded-3xl border border-white/10 bg-white/4 p-4 sm:p-5">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300">
            Asignación
          </p>
          <h3 class="mt-1 text-xl font-black text-white">{{ $t('admin.round.assignArtists') }}</h3>
          <p class="mt-1 text-xs text-slate-400">
            <span v-if="roundForm.type === 'versus'">
              {{ availableArtistsHelp }} Despues genera los VS automaticamente.
            </span>
            <span v-else>{{ availableArtistsHelp }}</span>
          </p>
        </div>
        <p class="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
          {{ currentContestants.length }} participantes
        </p>
      </div>
      <p
        v-if="addingArtistId || removingContestantId || isRemovingContestant"
        class="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-100"
      >
        <i class="fa-solid fa-circle-notch fa-spin mr-2" aria-hidden="true"></i>
        Actualizando artistas de esta ronda...
      </p>

      <div
        v-if="roundForm.type === 'versus'"
        class="mt-4 rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4 shadow-lg shadow-cyan-950/10"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
              Crear VS rapido
            </p>
            <h4 class="mt-2 text-xl font-black text-white">
              {{ versusCompletedGroups.length ? 'Duelos organizados' : 'Genera los duelos en un clic' }}
            </h4>
            <p class="mt-1 text-sm leading-6 text-slate-300">
              {{ versusSetupHint }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
              {{ currentContestants.length }} artistas
            </span>
            <span class="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-fuchsia-100">
              {{ versusCompletedGroups.length }} VS listos
            </span>
            <button
              type="button"
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-linear-to-r from-cyan-500 to-fuchsia-500 px-5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-cyan-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canGenerateVersus || isGeneratingVersus"
              @click="generateVersusAuto"
            >
              <i
                v-if="isGeneratingVersus"
                class="fa-solid fa-circle-notch fa-spin"
                aria-hidden="true"
              ></i>
              {{ isGeneratingVersus ? 'Generando...' : (versusCompletedGroups.length ? 'Recrear VS auto' : 'Generar VS auto') }}
            </button>
          </div>
        </div>
      </div>

      <div class="mt-4 grid gap-4 xl:grid-cols-2">
        <section class="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
          <div class="flex items-center justify-between gap-3">
            <h4 class="text-lg font-black text-white">{{ $t('admin.round.available') }}</h4>
            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              {{ availableArtists.length }} / {{ availableArtistsBase.length }} artistas
            </span>
          </div>
          <label class="relative mt-3 block">
            <i
              class="fa-solid fa-magnifying-glass pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs text-slate-500"
              aria-hidden="true"
            ></i>
            <input
              v-model="artistSearch"
              type="search"
              class="min-h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-10 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40 focus:bg-white/8"
              placeholder="Buscar artista, fandom, pais o rol..."
            />
            <button
              v-if="artistSearch"
              type="button"
              class="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-xl border border-white/10 bg-white/5 text-xs font-black text-slate-300 transition hover:bg-white/10 hover:text-white"
              @click="artistSearch = ''"
            >
              ×
            </button>
          </label>
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
                class="inline-flex min-w-24 items-center justify-center gap-2 rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-2 text-xs font-black text-fuchsia-100 transition hover:bg-fuchsia-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="Boolean(addingArtistId)"
                @click="addRoundContestant(artist)"
              >
                <i
                  v-if="addingArtistId === artist.id"
                  class="fa-solid fa-circle-notch fa-spin"
                  aria-hidden="true"
                ></i>
                {{ addingArtistId === artist.id ? 'Agregando...' : 'Agregar' }}
              </button>
            </div>
            <p v-if="!availableArtists.length" class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400">
              <span v-if="previousRound && !previousWinnerIds.length">
                La ronda anterior aun no tiene ganadores seleccionados.
              </span>
              <span v-else-if="artistSearch">
                No encontramos artistas con esa busqueda.
              </span>
              <span v-else>{{ $t('admin.round.emptyAvailable') }}</span>
            </p>
          </div>
        </section>

        <section class="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
          <div class="flex items-center justify-between gap-3">
            <h4 class="text-lg font-black text-white">{{ $t('admin.round.inRound') }}</h4>
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
                  class="inline-flex min-w-24 items-center justify-center gap-2 rounded-full border border-red-300/25 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isRemovingContestant"
                  @click="removeRoundContestant(contestant)"
                >
                  <i
                    v-if="removingContestantId === contestant.id"
                    class="fa-solid fa-circle-notch fa-spin"
                    aria-hidden="true"
                  ></i>
                  {{ removingContestantId === contestant.id ? 'Quitando...' : 'Quitar' }}
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
        <p
          v-if="isReorderingVersus"
          class="mb-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-100"
        >
          <i class="fa-solid fa-circle-notch fa-spin mr-2" aria-hidden="true"></i>
          Guardando orden de duelos...
        </p>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300">
              Duelos
            </p>
            <h4 class="mt-1 text-lg font-black text-white">{{ $t('admin.round.generatedDuels') }}</h4>
            <p class="mt-1 text-xs font-bold text-slate-400">
              Arrastra una tarjeta sobre otra para cambiar quien va contra quien.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-fuchsia-100">
              {{ versusGroups.length }} grupos
            </span>
            <span
              v-if="versusIncompleteGroups.length"
              class="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-100"
            >
              {{ versusIncompleteGroups.length }} incompleto
            </span>
            <button
              type="button"
              class="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canGenerateVersus || isGeneratingVersus"
              @click="generateVersusAuto"
            >
              <i
                v-if="isGeneratingVersus"
                class="fa-solid fa-circle-notch fa-spin"
                aria-hidden="true"
              ></i>
              {{ isGeneratingVersus ? 'Generando...' : 'Auto' }}
            </button>
            <button
              type="button"
              class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-200 transition hover:bg-white/10"
              @click="openGroupModal"
            >
              Manual
            </button>
          </div>
        </div>

        <div class="mt-3 space-y-3">
          <article
            v-for="group in versusGroups"
            :key="`group-${group.groupNumber}`"
            class="rounded-3xl border border-white/10 bg-slate-950/45 p-4 transition hover:border-cyan-300/20 hover:bg-slate-950/60"
          >
            <div class="mb-3 flex items-center justify-between gap-3">
              <p class="text-xs font-black uppercase tracking-widest text-fuchsia-300">
                Duelo {{ group.groupNumber }}
              </p>
              <button
                v-if="group.contestants.some((contestant) => contestant.matchGroup)"
                type="button"
                class="rounded-full border border-red-300/25 bg-red-500/10 px-3 py-1 text-[10px] font-black text-red-100 transition hover:bg-red-500/20"
                @click="removeVersusGroup(group)"
              >
                Reiniciar
              </button>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              <div
                v-if="group.contestants[0]"
                draggable="true"
                class="flex min-h-20 cursor-grab items-center gap-3 rounded-2xl border border-violet-300/15 bg-white/5 p-3 transition hover:border-fuchsia-300/35 active:cursor-grabbing"
                :class="draggedVersusContestantId === group.contestants[0].id && 'opacity-50'"
                @dragstart="startVersusDrag(group.contestants[0])"
                @dragend="clearVersusDrag"
                @dragover.prevent
                @drop.prevent="dropVersusContestant(group.contestants[0], group.groupNumber, 0)"
              >
                <span class="grid size-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-[10px] font-black text-slate-300">
                  A
                </span>
                <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-xs font-black text-white">
                  <img
                    v-if="getArtistImage(group.contestants[0].artist)"
                    :src="getArtistImage(group.contestants[0].artist)"
                    :alt="group.contestants[0].artist?.name"
                    class="size-full object-cover"
                  />
                  <span v-else>{{ group.contestants[0].artist?.name?.charAt(0) || 'A' }}</span>
                </span>
                <span class="min-w-0">
                  <span class="block truncate font-black text-white">{{ group.contestants[0].artist?.name || 'Artista' }}</span>
                  <span class="block truncate text-xs text-slate-400">{{ getArtistGroup(group.contestants[0].artist) || 'Sin grupo' }}</span>
                </span>
              </div>
              <div
                v-if="group.contestants[1]"
                draggable="true"
                class="flex min-h-20 cursor-grab items-center gap-3 rounded-2xl border border-cyan-300/15 bg-white/5 p-3 transition hover:border-cyan-300/45 active:cursor-grabbing"
                :class="draggedVersusContestantId === group.contestants[1].id && 'opacity-50'"
                @dragstart="startVersusDrag(group.contestants[1])"
                @dragend="clearVersusDrag"
                @dragover.prevent
                @drop.prevent="dropVersusContestant(group.contestants[1], group.groupNumber, 1)"
              >
                <span class="grid size-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-[10px] font-black text-slate-300">
                  B
                </span>
                <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-cyan-500 to-blue-500 text-xs font-black text-white">
                  <img
                    v-if="getArtistImage(group.contestants[1].artist)"
                    :src="getArtistImage(group.contestants[1].artist)"
                    :alt="group.contestants[1].artist?.name"
                    class="size-full object-cover"
                  />
                  <span v-else>{{ group.contestants[1].artist?.name?.charAt(0) || 'B' }}</span>
                </span>
                <span class="min-w-0">
                  <span class="block truncate font-black text-white">{{ group.contestants[1].artist?.name || 'Artista' }}</span>
                  <span class="block truncate text-xs text-slate-400">{{ getArtistGroup(group.contestants[1].artist) || 'Sin grupo' }}</span>
                </span>
              </div>

              <p
                v-if="group.contestants.length === 1"
                class="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-xs font-bold text-amber-100 md:col-span-2"
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
          Tienes {{ ungroupedContestants.length }} artista(s) sin grupo. Usa "Generar VS auto" para ordenarlos rapido o "Manual" si quieres escoger el par.
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
        @click.self="!isRemovingContestant && (isRemoveContestantModalOpen = false)"
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
              class="inline-flex min-w-40 items-center justify-center gap-2 rounded-full bg-red-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/30 transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isRemovingContestant"
              @click="confirmRemoveRoundContestant"
            >
              <i
                v-if="isRemovingContestant"
                class="fa-solid fa-circle-notch fa-spin"
                aria-hidden="true"
              ></i>
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
