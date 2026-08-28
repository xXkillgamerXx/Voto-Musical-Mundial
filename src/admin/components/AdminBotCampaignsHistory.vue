<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  cancelAdminCommentBotCampaign,
  deleteAdminCommentBotComments,
  getAdminCommentBotCampaign,
  getAdminCommentBotCampaigns,
} from '../../services/api/adminApi'

const props = defineProps({
  pollId: {
    type: String,
    required: true,
  },
  voteCampaigns: {
    type: Array,
    default: () => [],
  },
  cancellingVoteId: {
    type: String,
    default: '',
  },
  voteStatusLabel: {
    type: Function,
    default: (status) => status || '—',
  },
  formatVoteEta: {
    type: Function,
    default: () => '',
  },
})

const emit = defineEmits(['refresh-votes', 'view-vote', 'cancel-vote'])

const isOpen = ref(false)
const activeTab = ref('votes')

const commentCampaigns = ref([])
const commentDetail = ref(null)
const commentDetailId = ref('')
const isLoadingCommentDetail = ref(false)
const cancellingCommentId = ref('')
const purgingCommentId = ref('')
const commentError = ref('')

let commentListTimer = null
let commentDetailTimer = null

const runningVoteCampaigns = computed(() =>
  (props.voteCampaigns || []).filter((c) => c.status === 'running' || c.status === 'paused'),
)

const runningCommentCampaigns = computed(() =>
  commentCampaigns.value.filter((c) => c.status === 'running'),
)

const totalCampaigns = computed(() =>
  (props.voteCampaigns?.length || 0) + commentCampaigns.value.length,
)

const runningTotal = computed(() =>
  runningVoteCampaigns.value.length + runningCommentCampaigns.value.length,
)

const commentStatusMeta = (status) => {
  if (status === 'running') {
    return { label: 'En curso', tone: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100' }
  }
  if (status === 'done') {
    return { label: 'Terminada', tone: 'border-slate-300/20 bg-white/5 text-slate-200' }
  }
  if (status === 'cancelled') {
    return { label: 'Detenida', tone: 'border-red-300/30 bg-red-500/10 text-red-100' }
  }
  return { label: status || '—', tone: 'border-white/10 bg-white/5 text-slate-200' }
}

const formatTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es')
}

const formatCommentEta = (campaign) => {
  if (campaign.status !== 'running') return ''
  const seconds = Math.max(0, Math.round(Number(campaign.etaMs || 0) / 1000))
  if (seconds <= 0) return 'Cerrando'
  const minutes = Math.floor(seconds / 60)
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    return `Faltan ~${hours} h ${minutes % 60} min`
  }
  if (minutes >= 1) return `Faltan ~${minutes} min`
  return `Faltan ~${seconds} s`
}

const loadCommentCampaigns = async () => {
  if (!props.pollId) return
  try {
    const rows = await getAdminCommentBotCampaigns(props.pollId)
    commentCampaigns.value = Array.isArray(rows) ? rows : []
    commentError.value = ''
  } catch (error) {
    commentError.value = error?.message || 'No se pudieron cargar las campañas de comentarios.'
  }
}

const loadCommentDetail = async (id) => {
  if (!id) return
  isLoadingCommentDetail.value = true
  try {
    commentDetail.value = await getAdminCommentBotCampaign(id)
  } catch (error) {
    commentError.value = error?.message || 'No se pudo cargar el detalle.'
  } finally {
    isLoadingCommentDetail.value = false
  }
}

const toggleCommentDetail = async (campaign) => {
  if (commentDetailId.value === campaign.id) {
    commentDetailId.value = ''
    commentDetail.value = null
    return
  }
  commentDetailId.value = campaign.id
  commentDetail.value = null
  await loadCommentDetail(campaign.id)
}

const stopCommentCampaign = async (campaign) => {
  if (!window.confirm('¿Detener el goteo de comentarios? Los ya publicados se mantienen.')) {
    return
  }
  cancellingCommentId.value = campaign.id
  try {
    await cancelAdminCommentBotCampaign(campaign.id)
    await loadCommentCampaigns()
    if (commentDetailId.value === campaign.id) {
      await loadCommentDetail(campaign.id)
    }
  } catch (error) {
    commentError.value = error?.message || 'No se pudo detener la campaña.'
  } finally {
    cancellingCommentId.value = ''
  }
}

const purgeCommentCampaign = async (campaign) => {
  if (!window.confirm('¿Borrar todos los comentarios de esta campaña? Esta acción no se puede deshacer.')) {
    return
  }
  purgingCommentId.value = campaign.id
  try {
    const result = await deleteAdminCommentBotComments(campaign.id)
    await loadCommentCampaigns()
    if (commentDetailId.value === campaign.id) {
      await loadCommentDetail(campaign.id)
    }
    commentError.value = ''
    void result
  } catch (error) {
    commentError.value = error?.message || 'No se pudieron borrar los comentarios.'
  } finally {
    purgingCommentId.value = ''
  }
}

const refreshAll = async () => {
  emit('refresh-votes')
  await loadCommentCampaigns()
}

const toggleOpen = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    emit('refresh-votes')
    loadCommentCampaigns()
  }
}

const setTab = (tab) => {
  activeTab.value = tab
  if (isOpen.value && tab === 'comments') {
    loadCommentCampaigns()
  }
  if (isOpen.value && tab === 'votes') {
    emit('refresh-votes')
  }
}

const open = (tab = 'votes') => {
  activeTab.value = tab
  isOpen.value = true
  emit('refresh-votes')
  loadCommentCampaigns()
}

watch(
  () => props.pollId,
  () => {
    commentCampaigns.value = []
    commentDetail.value = null
    commentDetailId.value = ''
    loadCommentCampaigns()
  },
)

onMounted(() => {
  loadCommentCampaigns()
  commentListTimer = setInterval(loadCommentCampaigns, 10000)
  commentDetailTimer = setInterval(() => {
    if (commentDetailId.value && commentDetail.value?.status === 'running') {
      loadCommentDetail(commentDetailId.value)
    }
  }, 5000)
})

onUnmounted(() => {
  if (commentListTimer) clearInterval(commentListTimer)
  if (commentDetailTimer) clearInterval(commentDetailTimer)
})

defineExpose({ open, refresh: refreshAll })
</script>

<template>
  <article
    id="admin-bot-campaigns-history"
    class="overflow-hidden rounded-3xl border border-white/10 bg-[#0a0c1c]/60"
  >
    <div class="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-90"
        :aria-expanded="isOpen"
        @click="toggleOpen"
      >
        <span class="grid size-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-300">
          <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
        </span>
        <span class="min-w-0">
          <span class="block text-sm font-black text-white">Historial de campañas</span>
          <span class="block text-xs font-bold text-slate-500">
            {{ totalCampaigns }} en total
            <span v-if="runningTotal"> · {{ runningTotal }} en curso</span>
          </span>
        </span>
      </button>
      <span class="flex shrink-0 items-center gap-2">
        <button
          v-if="isOpen"
          type="button"
          class="rounded-xl px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-slate-400 transition hover:bg-white/10 hover:text-white"
          @click="refreshAll"
        >
          Actualizar
        </button>
        <button
          type="button"
          class="grid size-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          :aria-label="isOpen ? 'Cerrar historial' : 'Abrir historial'"
          @click="toggleOpen"
        >
          <i
            class="fa-solid fa-chevron-down transition-transform"
            :class="{ 'rotate-180': isOpen }"
            aria-hidden="true"
          ></i>
        </button>
      </span>
    </div>

    <div v-show="isOpen" class="border-t border-white/10 px-5 pb-5 pt-4 sm:px-6">
      <div class="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-1">
        <button
          type="button"
          class="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black uppercase tracking-wide transition sm:flex-none sm:px-5"
          :class="activeTab === 'votes'
            ? 'bg-fuchsia-500/20 text-fuchsia-100 ring-1 ring-fuchsia-300/30'
            : 'text-slate-400 hover:bg-white/5 hover:text-white'"
          @click="setTab('votes')"
        >
          <i class="fa-solid fa-check-to-slot" aria-hidden="true"></i>
          Votos
          <span
            v-if="voteCampaigns.length"
            class="rounded-full bg-white/10 px-2 py-0.5 text-[10px]"
          >
            {{ voteCampaigns.length }}
          </span>
        </button>
        <button
          type="button"
          class="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black uppercase tracking-wide transition sm:flex-none sm:px-5"
          :class="activeTab === 'comments'
            ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-300/30'
            : 'text-slate-400 hover:bg-white/5 hover:text-white'"
          @click="setTab('comments')"
        >
          <i class="fa-solid fa-comment-dots" aria-hidden="true"></i>
          Comentarios
          <span
            v-if="commentCampaigns.length"
            class="rounded-full bg-white/10 px-2 py-0.5 text-[10px]"
          >
            {{ commentCampaigns.length }}
          </span>
        </button>
      </div>

      <p class="mt-3 text-xs font-bold text-slate-500">
        <template v-if="activeTab === 'votes'">
          Campañas que reparten votos con bots (desde «Ajustar votos» en el ranking).
        </template>
        <template v-else>
          Campañas que publican comentarios con IA (desde «Bot comentarios»).
        </template>
      </p>

      <!-- Votos -->
      <div v-show="activeTab === 'votes'" class="mt-4 space-y-3">
        <p
          v-if="!voteCampaigns.length"
          class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400"
        >
          Todavía no hay campañas de votos.
        </p>

        <div
          v-for="campaign in voteCampaigns"
          :key="campaign.id"
          class="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-black text-white">
                {{ campaign.artistName || 'Artista' }}
              </p>
              <p class="mt-1 text-xs font-bold text-slate-400">
                {{ voteStatusLabel(campaign.status) }}
                · {{ campaign.appliedAmount || 0 }} / {{ campaign.totalAmount || 0 }} votos
                · {{ campaign.percent || 0 }}%
              </p>
              <p
                v-if="campaign.status === 'running'"
                class="mt-1 text-[11px] font-bold text-fuchsia-100/80"
              >
                {{ formatVoteEta(campaign) }}
              </p>
            </div>
            <div class="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                class="rounded-xl border border-fuchsia-300/25 bg-fuchsia-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-fuchsia-100"
                @click="emit('view-vote', campaign)"
              >
                Ver
              </button>
              <button
                v-if="campaign.status === 'running' || campaign.status === 'paused'"
                type="button"
                class="rounded-xl border border-red-300/40 bg-red-500/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-red-100 disabled:opacity-50"
                :disabled="cancellingVoteId === campaign.id"
                @click="emit('cancel-vote', campaign)"
              >
                Detener
              </button>
            </div>
          </div>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              class="h-full rounded-full bg-linear-to-r from-fuchsia-400 to-cyan-400 transition-[width]"
              :style="{ width: `${campaign.percent || 0}%` }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Comentarios -->
      <div v-show="activeTab === 'comments'" class="mt-4 space-y-3">
        <p
          v-if="commentError"
          class="rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100"
        >
          {{ commentError }}
        </p>

        <p
          v-if="!commentCampaigns.length && !commentError"
          class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400"
        >
          Todavía no hay campañas de comentarios.
        </p>

        <div
          v-for="campaign in commentCampaigns"
          :key="campaign.id"
          class="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
        >
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                  :class="commentStatusMeta(campaign.status).tone"
                >
                  {{ commentStatusMeta(campaign.status).label }}
                </span>
                <span class="text-sm font-black text-white">
                  {{ campaign.appliedCount }} / {{ campaign.totalComments }} comentarios
                </span>
                <span class="text-xs font-bold text-slate-400">
                  {{ campaign.botsCount }} nombres · {{ Math.round((campaign.durationSeconds || 0) / 60) }} min
                </span>
              </div>
              <p class="mt-1 text-xs font-bold text-slate-500">
                Inicio {{ formatTime(campaign.startedAt) }}
                <span v-if="formatCommentEta(campaign)"> · {{ formatCommentEta(campaign) }}</span>
              </p>
            </div>

            <div class="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                class="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 text-xs font-black uppercase tracking-wide text-cyan-100"
                @click="toggleCommentDetail(campaign)"
              >
                {{ commentDetailId === campaign.id ? 'Ocultar' : 'Ver' }}
              </button>
              <button
                v-if="campaign.status === 'running'"
                type="button"
                class="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 text-xs font-black uppercase tracking-wide text-amber-100 disabled:opacity-50"
                :disabled="cancellingCommentId === campaign.id"
                @click="stopCommentCampaign(campaign)"
              >
                Detener
              </button>
              <button
                type="button"
                class="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-red-300/40 bg-red-500/10 px-4 text-xs font-black uppercase tracking-wide text-red-100 disabled:opacity-50"
                :disabled="purgingCommentId === campaign.id"
                @click="purgeCommentCampaign(campaign)"
              >
                Borrar comentarios
              </button>
            </div>
          </div>

          <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              class="h-full rounded-full bg-linear-to-r from-cyan-400 to-emerald-400 transition-[width]"
              :style="{ width: `${campaign.percent || 0}%` }"
            ></div>
          </div>

          <div
            v-if="commentDetailId === campaign.id"
            class="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4"
          >
            <p v-if="isLoadingCommentDetail && !commentDetail" class="text-sm font-bold text-slate-400">
              Cargando...
            </p>
            <template v-if="commentDetail">
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div class="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                  <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Publicados</p>
                  <p class="mt-1 text-xl font-black text-white">{{ commentDetail.stats?.posted ?? 0 }}</p>
                </div>
                <div class="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                  <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Borrados</p>
                  <p class="mt-1 text-xl font-black text-white">{{ commentDetail.stats?.deleted ?? 0 }}</p>
                </div>
                <div class="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                  <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Nombres</p>
                  <p class="mt-1 text-xl font-black text-white">{{ commentDetail.stats?.botsTotal ?? 0 }}</p>
                </div>
                <div class="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                  <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Frases</p>
                  <p class="mt-1 text-xl font-black text-white">{{ commentDetail.stats?.messagesTotal ?? 0 }}</p>
                </div>
              </div>
              <p class="mt-4 text-[11px] font-black uppercase tracking-widest text-slate-500">
                Últimos comentarios
              </p>
              <div class="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                <p
                  v-if="!commentDetail.recentComments?.length"
                  class="text-sm font-bold text-slate-500"
                >
                  Todavía no se publicó ningún comentario.
                </p>
                <div
                  v-for="comment in commentDetail.recentComments || []"
                  :key="comment.id"
                  class="rounded-xl border border-white/5 bg-slate-950/60 px-3 py-2"
                  :class="comment.deleted ? 'opacity-50' : ''"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="truncate text-xs font-black text-cyan-200">{{ comment.name }}</span>
                    <span class="shrink-0 text-[10px] font-bold text-slate-500">
                      {{ formatTime(comment.createdAt) }}
                    </span>
                  </div>
                  <p class="mt-1 text-sm font-bold text-slate-200">
                    {{ comment.text }}
                    <span v-if="comment.deleted" class="text-[10px] uppercase text-red-300"> (borrado)</span>
                  </p>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
