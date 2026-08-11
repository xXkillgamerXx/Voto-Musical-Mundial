<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  cancelAdminCommentBotCampaign,
  createAdminCommentBotCampaign,
  deleteAdminCommentBotComments,
  getAdminCommentBotCampaign,
  getAdminCommentBotCampaigns,
} from '../../services/api/adminApi'

const props = defineProps({
  pollId: {
    type: String,
    required: true,
  },
})

const campaigns = ref([])
const detail = ref(null)
const detailId = ref('')
const isLoadingDetail = ref(false)
const isCreating = ref(false)
const cancellingId = ref('')
const purgingId = ref('')
const formError = ref('')
const feedback = ref('')
const isFormOpen = ref(false)

const form = ref({
  totalComments: 40,
  botsCount: 20,
  durationMinutes: 60,
  messages: '',
})

let listTimer = null
let detailTimer = null

const runningCampaigns = computed(() =>
  campaigns.value.filter((campaign) => campaign.status === 'running'),
)

const statusMeta = (status) => {
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

const formatEta = (campaign) => {
  if (campaign.status !== 'running') {
    return ''
  }
  const seconds = Math.max(0, Math.round(Number(campaign.etaMs || 0) / 1000))
  if (seconds <= 0) {
    return 'Cerrando'
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    return `Faltan ~${hours} h ${minutes % 60} min`
  }
  if (minutes >= 1) {
    return `Faltan ~${minutes} min`
  }
  return `Faltan ~${seconds} s`
}

const formatTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es')
}

const loadCampaigns = async () => {
  if (!props.pollId) return
  try {
    const rows = await getAdminCommentBotCampaigns(props.pollId)
    campaigns.value = Array.isArray(rows) ? rows : []
  } catch (error) {
    formError.value = error?.message || 'No se pudieron cargar las campañas.'
  }
}

const loadDetail = async (id) => {
  if (!id) return
  isLoadingDetail.value = true
  try {
    detail.value = await getAdminCommentBotCampaign(id)
  } catch (error) {
    formError.value = error?.message || 'No se pudo cargar el detalle.'
  } finally {
    isLoadingDetail.value = false
  }
}

const toggleDetail = async (campaign) => {
  if (detailId.value === campaign.id) {
    detailId.value = ''
    detail.value = null
    return
  }
  detailId.value = campaign.id
  detail.value = null
  await loadDetail(campaign.id)
}

const submit = async () => {
  formError.value = ''
  feedback.value = ''
  isCreating.value = true
  try {
    const messages = String(form.value.messages || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    await createAdminCommentBotCampaign(props.pollId, {
      totalComments: Number(form.value.totalComments || 0),
      botsCount: Number(form.value.botsCount || 0),
      durationMinutes: Number(form.value.durationMinutes || 0),
      messages,
    })

    feedback.value = 'Campaña iniciada. Los comentarios van a ir apareciendo de a poco.'
    form.value.messages = ''
    isFormOpen.value = false
    await loadCampaigns()
  } catch (error) {
    formError.value = error?.message || 'No se pudo iniciar la campaña.'
  } finally {
    isCreating.value = false
  }
}

const stopCampaign = async (campaign) => {
  if (!window.confirm('¿Detener el goteo de comentarios? Los ya publicados se mantienen.')) {
    return
  }
  cancellingId.value = campaign.id
  try {
    await cancelAdminCommentBotCampaign(campaign.id)
    await loadCampaigns()
    if (detailId.value === campaign.id) {
      await loadDetail(campaign.id)
    }
  } catch (error) {
    formError.value = error?.message || 'No se pudo detener la campaña.'
  } finally {
    cancellingId.value = ''
  }
}

const purgeCampaign = async (campaign) => {
  if (!window.confirm('¿Borrar todos los comentarios de esta campaña? Esta acción no se puede deshacer.')) {
    return
  }
  purgingId.value = campaign.id
  try {
    const result = await deleteAdminCommentBotComments(campaign.id)
    feedback.value = `Se borraron ${result?.removed ?? 0} comentarios.`
    await loadCampaigns()
    if (detailId.value === campaign.id) {
      await loadDetail(campaign.id)
    }
  } catch (error) {
    formError.value = error?.message || 'No se pudieron borrar los comentarios.'
  } finally {
    purgingId.value = ''
  }
}

watch(
  () => props.pollId,
  () => {
    campaigns.value = []
    detail.value = null
    detailId.value = ''
    loadCampaigns()
  },
)

onMounted(() => {
  loadCampaigns()
  listTimer = setInterval(loadCampaigns, 10000)
  detailTimer = setInterval(() => {
    if (detailId.value && detail.value?.status === 'running') {
      loadDetail(detailId.value)
    }
  }, 5000)
})

onUnmounted(() => {
  if (listTimer) clearInterval(listTimer)
  if (detailTimer) clearInterval(detailTimer)
})
</script>

<template>
  <article class="relative overflow-hidden rounded-3xl border border-violet-300/15 bg-[#0a0c1c]/80 p-5 sm:p-6">
    <div class="pointer-events-none absolute -left-16 -top-16 size-44 rounded-full bg-violet-500/10 blur-3xl"></div>

    <div class="relative flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-black uppercase tracking-[0.24em] text-violet-300">Bot de comentarios</p>
        <h3 class="mt-1 text-xl font-black text-white">Animar el feed de esta votación</h3>
        <p class="mt-2 max-w-2xl text-sm font-bold leading-6 text-slate-400">
          Publica comentarios con nombres de fans a lo largo del tiempo que elijas. Van saliendo de a
          poco y en vivo, igual que los comentarios reales.
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          class="text-[11px] font-black uppercase tracking-wide text-slate-400 transition hover:text-white"
          @click="loadCampaigns"
        >
          Actualizar
        </button>
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.02]"
          @click="isFormOpen = !isFormOpen"
        >
          <i class="fa-solid" :class="isFormOpen ? 'fa-xmark' : 'fa-comment-dots'" aria-hidden="true"></i>
          {{ isFormOpen ? 'Cerrar' : 'Nueva campaña' }}
        </button>
      </div>
    </div>

    <p
      v-if="feedback"
      class="relative mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100"
    >
      {{ feedback }}
    </p>
    <p
      v-if="formError"
      class="relative mt-4 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100"
    >
      {{ formError }}
    </p>

    <div
      v-if="isFormOpen"
      class="relative mt-5 rounded-3xl border border-white/10 bg-slate-950/60 p-4 sm:p-5"
    >
      <div class="grid gap-4 sm:grid-cols-3">
        <label class="block">
          <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">Comentarios</span>
          <input
            v-model.number="form.totalComments"
            type="number"
            min="1"
            max="2000"
            class="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-violet-300/50"
          />
        </label>
        <label class="block">
          <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">Nombres distintos</span>
          <input
            v-model.number="form.botsCount"
            type="number"
            min="1"
            max="500"
            class="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-violet-300/50"
          />
        </label>
        <label class="block">
          <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">Duración (min)</span>
          <input
            v-model.number="form.durationMinutes"
            type="number"
            min="1"
            max="720"
            class="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-violet-300/50"
          />
        </label>
      </div>

      <label class="mt-4 block">
        <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">
          Frases propias (una por línea, opcional)
        </span>
        <textarea
          v-model="form.messages"
          rows="4"
          placeholder="Vamos con todo!!&#10;Ya voté, no se olviden de votar"
          class="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-violet-300/50"
        ></textarea>
        <span class="mt-2 block text-xs font-bold text-slate-500">
          Si lo dejas vacío se generan frases automáticas, algunas con el nombre de los artistas de
          esta votación.
        </span>
      </label>

      <button
        type="button"
        class="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-emerald-500 to-cyan-500 px-6 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-emerald-950/40 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="isCreating"
        @click="submit"
      >
        <i
          class="fa-solid"
          :class="isCreating ? 'fa-circle-notch fa-spin' : 'fa-play'"
          aria-hidden="true"
        ></i>
        {{ isCreating ? 'Iniciando...' : 'Iniciar goteo' }}
      </button>
    </div>

    <div
      v-if="runningCampaigns.length"
      class="relative mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-400/5 px-4 py-3 text-sm font-bold text-emerald-100"
    >
      {{ runningCampaigns.length }} campaña(s) publicando comentarios ahora mismo.
    </div>

    <div class="relative mt-5 space-y-3">
      <p
        v-if="!campaigns.length"
        class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400"
      >
        Todavía no creaste ninguna campaña de comentarios para esta votación.
      </p>

      <div
        v-for="campaign in campaigns"
        :key="campaign.id"
        class="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
      >
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                :class="statusMeta(campaign.status).tone"
              >
                {{ statusMeta(campaign.status).label }}
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
              <span v-if="formatEta(campaign)"> · {{ formatEta(campaign) }}</span>
            </p>
          </div>

          <div class="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 text-sm font-black uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-400/20"
              @click="toggleDetail(campaign)"
            >
              <i class="fa-solid fa-list" aria-hidden="true"></i>
              {{ detailId === campaign.id ? 'Ocultar' : 'Ver' }}
            </button>
            <button
              v-if="campaign.status === 'running'"
              type="button"
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 text-sm font-black uppercase tracking-wide text-amber-100 transition hover:bg-amber-400/20 disabled:opacity-50"
              :disabled="cancellingId === campaign.id"
              @click="stopCampaign(campaign)"
            >
              <i
                class="fa-solid"
                :class="cancellingId === campaign.id ? 'fa-circle-notch fa-spin' : 'fa-stop'"
                aria-hidden="true"
              ></i>
              Detener
            </button>
            <button
              type="button"
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-300/40 bg-red-500/10 px-4 text-sm font-black uppercase tracking-wide text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
              :disabled="purgingId === campaign.id"
              @click="purgeCampaign(campaign)"
            >
              <i
                class="fa-solid"
                :class="purgingId === campaign.id ? 'fa-circle-notch fa-spin' : 'fa-trash'"
                aria-hidden="true"
              ></i>
              Borrar comentarios
            </button>
          </div>
        </div>

        <div class="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
          <div
            class="h-full rounded-full bg-linear-to-r from-violet-400 to-fuchsia-400 transition-[width]"
            :style="{ width: `${campaign.percent || 0}%` }"
          ></div>
        </div>

        <div v-if="detailId === campaign.id" class="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
          <p v-if="isLoadingDetail && !detail" class="text-sm font-bold text-slate-400">Cargando...</p>

          <template v-if="detail">
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div class="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Publicados</p>
                <p class="mt-1 text-xl font-black text-white">{{ detail.stats?.posted ?? 0 }}</p>
              </div>
              <div class="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Borrados</p>
                <p class="mt-1 text-xl font-black text-white">{{ detail.stats?.deleted ?? 0 }}</p>
              </div>
              <div class="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Nombres</p>
                <p class="mt-1 text-xl font-black text-white">{{ detail.stats?.botsTotal ?? 0 }}</p>
              </div>
              <div class="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Frases</p>
                <p class="mt-1 text-xl font-black text-white">{{ detail.stats?.messagesTotal ?? 0 }}</p>
              </div>
            </div>

            <p class="mt-4 text-[11px] font-black uppercase tracking-widest text-slate-500">
              Últimos comentarios
            </p>
            <div class="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
              <p
                v-if="!detail.recentComments?.length"
                class="text-sm font-bold text-slate-500"
              >
                Todavía no se publicó ningún comentario.
              </p>
              <div
                v-for="comment in detail.recentComments || []"
                :key="comment.id"
                class="rounded-xl border border-white/5 bg-slate-950/60 px-3 py-2"
                :class="comment.deleted ? 'opacity-50' : ''"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate text-xs font-black text-violet-200">{{ comment.name }}</span>
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
  </article>
</template>
