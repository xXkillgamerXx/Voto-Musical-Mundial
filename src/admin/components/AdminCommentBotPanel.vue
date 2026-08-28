<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AdminCommentBotModal from './AdminCommentBotModal.vue'
import { getAdminCommentBotCampaigns } from '../../services/api/adminApi'

const props = defineProps({
  pollId: {
    type: String,
    required: true,
  },
  contestants: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['campaign-created', 'open-history'])

const modalRef = ref(null)
const campaigns = ref([])
const formError = ref('')
const feedback = ref('')

let listTimer = null

const runningCampaigns = computed(() =>
  campaigns.value.filter((campaign) => campaign.status === 'running'),
)

const loadCampaigns = async () => {
  if (!props.pollId) return
  try {
    const rows = await getAdminCommentBotCampaigns(props.pollId)
    campaigns.value = Array.isArray(rows) ? rows : []
  } catch {
    // Silencioso: el historial completo vive en AdminBotCampaignsHistory
  }
}

const openModal = (contestant = null, options = {}) => {
  formError.value = ''
  modalRef.value?.open?.(contestant, options)
}

const openForArtist = (contestant, options = {}) => {
  openModal(contestant, options)
}

const onCampaignCreated = async () => {
  feedback.value = 'Campaña iniciada. Los comentarios van apareciendo poco a poco.'
  await loadCampaigns()
  emit('campaign-created')
}

const openHistory = () => {
  emit('open-history')
}

watch(
  () => props.pollId,
  () => {
    campaigns.value = []
    loadCampaigns()
  },
)

onMounted(() => {
  loadCampaigns()
  listTimer = setInterval(loadCampaigns, 10000)
})

onUnmounted(() => {
  if (listTimer) clearInterval(listTimer)
})

defineExpose({
  openModal,
  openForArtist,
})
</script>

<template>
  <section id="admin-comment-bot-panel">
    <article
      class="relative overflow-hidden rounded-3xl border border-cyan-300/15 bg-[#0a0c1c]/80 p-5 sm:p-6"
    >
      <div class="pointer-events-none absolute -left-16 -top-16 size-44 rounded-full bg-cyan-500/10 blur-3xl"></div>

      <div class="relative flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Bot de comentarios</p>
          <h3 class="mt-1 text-xl font-black text-white">Fans comentando apoyo al artista</h3>
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

      <div class="relative mt-5 space-y-4">
        <div
          v-if="runningCampaigns.length"
          class="rounded-2xl border border-emerald-300/25 bg-emerald-400/5 px-4 py-3 text-sm font-bold text-emerald-100"
        >
          {{ runningCampaigns.length }} campaña(s) publicando comentarios ahora mismo.
          <button
            type="button"
            class="ml-2 underline decoration-emerald-200/50 underline-offset-2"
            @click="openHistory"
          >
            Ver historial
          </button>
        </div>

        <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <p class="text-sm font-bold leading-6 text-slate-300">
            Elige artista e idioma, genera una <strong class="text-cyan-200">vista previa</strong> con IA
            (imita comentarios reales del feed) y lanza cuando te guste. No suma votos.
          </p>
          <ul class="mt-3 space-y-1 text-xs font-bold text-slate-500">
            <li>· Frases cortas, sin emojis, estilo humano</li>
            <li>· Analiza comentarios reales de la votación</li>
            <li>· Vista previa antes de publicar</li>
          </ul>
          <button
            type="button"
            class="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-cyan-500 to-emerald-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-cyan-950/40 transition hover:scale-[1.02]"
            @click="openModal()"
          >
            <i class="fa-solid fa-comment-dots" aria-hidden="true"></i>
            Nueva campaña
          </button>
        </div>
      </div>

      <AdminCommentBotModal
        ref="modalRef"
        :poll-id="pollId"
        :contestants="contestants"
        @created="onCampaignCreated"
      />
    </article>
  </section>
</template>
