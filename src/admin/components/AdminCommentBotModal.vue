<script setup>
import { computed, ref, watch } from 'vue'
import AdminPollCommentFeedCard from './AdminPollCommentFeedCard.vue'
import {
  createAdminCommentBotCampaign,
  suggestAdminCommentBotMessages,
} from '../../services/api/adminApi'

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

const emit = defineEmits(['close', 'created'])

const isOpen = ref(false)
const step = ref('form')
const modalError = ref('')
const modalFeedback = ref('')
const isCreating = ref(false)
const isPreviewLoading = ref(false)
const preview = ref(null)
const selectedContestantId = ref('')
const rivalArtistName = ref('')

const LANGUAGE_OPTIONS = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'auto', label: 'Auto (según comentarios reales)' },
]

const form = ref({
  totalComments: 40,
  botsCount: 20,
  durationMinutes: 60,
  language: 'es',
  topic: '',
  brief: '',
})

const contestantOptions = computed(() =>
  (props.contestants || [])
    .map((row) => ({
      id: String(row.id || ''),
      artistId: String(row.artistId || row.artist?.id || ''),
      name: row.artist?.name || '',
      artist: row.artist,
    }))
    .filter((row) => row.id && row.name),
)

const selectedContestant = computed(() =>
  contestantOptions.value.find((row) => row.id === selectedContestantId.value) || null,
)

const selectedArtistName = computed(() => selectedContestant.value?.name || '')

const canPreview = computed(() => Boolean(selectedContestant.value) && !isPreviewLoading.value && !isCreating.value)
const canLaunch = computed(() => Boolean(selectedContestant.value) && Boolean(preview.value?.messages?.length) && !isCreating.value)

const previewCount = computed(() => Math.min(20, Math.max(8, Number(form.value.totalComments || 20))))

const normalizeFeedComment = (row, fallbackName = 'Fan') => {
  if (typeof row === 'string') {
    return { displayName: fallbackName, photoUrl: '', text: row }
  }
  return {
    displayName: String(row?.displayName || fallbackName).trim() || fallbackName,
    photoUrl: String(row?.photoUrl || ''),
    text: String(row?.text || '').trim(),
  }
}

const sampleFeedComments = computed(() => {
  const rows = preview.value?.sampleCommentsPreview || []
  return rows
    .map((row) => normalizeFeedComment(row))
    .filter((row) => row.text)
})

const botFeedComments = computed(() => {
  const names = preview.value?.botNamesPreview || []
  const messages = preview.value?.messages || []
  return messages.map((text, index) => ({
    displayName: names[index % Math.max(names.length, 1)] || `Fan${index + 1}`,
    photoUrl: '',
    text: String(text || '').trim(),
  })).filter((row) => row.text)
})

const DEFAULT_HUMAN_BRIEF =
  'Suena a fans reales en celular: informal, sin emojis. Mezcla frases cortas y frases un poco más largas como en el feed. Varía aperturas. Nada de marketing ni repetir la misma estructura.'

const buildArtistTopic = (artistName, rival = '') => {
  if (rival) {
    return `Duelo en vivo: fans de ${artistName} pidiendo votos para ganarle a ${rival}. Van apretados y quieren remontar antes de que cierre.`
  }
  return `Fans de ${artistName} en votación con ranking. Algunos acaban de votar, otros piden apoyo porque va muy reñido.`
}

const buildPrompt = () => {
  const topic = String(form.value.topic || '').trim()
  const brief = String(form.value.brief || '').trim()
  if (topic && brief) {
    return `${topic}\n\nInstrucciones extra: ${brief}`
  }
  return topic || brief
}

const buildPayload = () => ({
  totalComments: Number(form.value.totalComments || 0),
  botsCount: Number(form.value.botsCount || 0),
  durationMinutes: Number(form.value.durationMinutes || 0),
  topic: buildPrompt() || undefined,
  artistId: selectedContestant.value?.artistId || undefined,
  artistName: selectedArtistName.value,
  rivalArtistName: rivalArtistName.value || undefined,
  language: form.value.language || 'es',
})

const resetForm = () => {
  step.value = 'form'
  preview.value = null
  modalError.value = ''
  modalFeedback.value = ''
  form.value = {
    totalComments: 40,
    botsCount: 20,
    durationMinutes: 60,
    language: 'es',
    topic: '',
    brief: '',
  }
}

const applyContestant = (contestant, options = {}) => {
  selectedContestantId.value = String(contestant?.id || '')
  rivalArtistName.value = String(options.rivalArtistName || '').trim()
  form.value.topic = buildArtistTopic(
    contestant?.artist?.name || '',
    rivalArtistName.value,
  )
  form.value.brief = DEFAULT_HUMAN_BRIEF
}

const open = (contestant = null, options = {}) => {
  resetForm()
  isOpen.value = true
  if (contestant?.id) {
    applyContestant(contestant, options)
    return
  }
  selectedContestantId.value = ''
  rivalArtistName.value = ''
}

const close = () => {
  if (isCreating.value || isPreviewLoading.value) {
    return
  }
  isOpen.value = false
  emit('close')
}

watch(selectedContestantId, (nextId) => {
  if (!nextId || !isOpen.value) {
    return
  }
  const row = contestantOptions.value.find((item) => item.id === nextId)
  if (!row) {
    return
  }
  if (!form.value.topic.trim() || form.value.topic.includes('Fans apoyando a') || form.value.topic.includes('Duelo en vivo') || form.value.topic.includes('Fans de')) {
    form.value.topic = buildArtistTopic(row.name, rivalArtistName.value)
  }
  if (!form.value.brief.trim()) {
    form.value.brief = DEFAULT_HUMAN_BRIEF
  }
  preview.value = null
  step.value = 'form'
  modalFeedback.value = ''
})

watch(
  () => [form.value.language, form.value.topic, form.value.brief, form.value.totalComments],
  () => {
    if (!isOpen.value) {
      return
    }
    preview.value = null
    if (step.value === 'preview') {
      step.value = 'form'
    }
  },
)

const runPreview = async () => {
  modalError.value = ''
  modalFeedback.value = ''

  if (!selectedContestant.value) {
    modalError.value = 'Selecciona el artista que van a apoyar.'
    return
  }

  isPreviewLoading.value = true
  try {
    preview.value = await suggestAdminCommentBotMessages(props.pollId, {
      ...buildPayload(),
      count: previewCount.value,
    })
    step.value = 'preview'
    modalFeedback.value = `Vista previa lista (${preview.value?.messages?.length || 0} frases). Revisa antes de lanzar.`
  } catch (error) {
    modalError.value = error?.message || 'No se pudo generar la vista previa.'
  } finally {
    isPreviewLoading.value = false
  }
}

const backToForm = () => {
  step.value = 'form'
  modalFeedback.value = ''
}

const submit = async () => {
  modalError.value = ''
  modalFeedback.value = ''

  if (!selectedContestant.value) {
    modalError.value = 'Selecciona el artista que van a apoyar.'
    return
  }

  if (!preview.value?.messages?.length) {
    modalError.value = 'Genera una vista previa antes de lanzar.'
    return
  }

  isCreating.value = true
  try {
    await createAdminCommentBotCampaign(props.pollId, {
      ...buildPayload(),
      messages: preview.value.messages,
    })

    isOpen.value = false
    emit('created')
  } catch (error) {
    modalError.value = error?.message || 'No se pudo iniciar la campaña.'
  } finally {
    isCreating.value = false
  }
}

defineExpose({ open, close })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[95] flex items-end justify-center bg-black/80 px-4 py-4 backdrop-blur-md sm:items-center sm:py-8"
      @click.self="close"
    >
      <article
        class="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-4xl border border-cyan-300/25 bg-[#080a18] text-white shadow-2xl shadow-cyan-950/30"
        @click.stop
      >
        <div class="shrink-0 border-b border-white/10 px-5 py-5 sm:px-6">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
                Bot de comentarios
              </p>
              <h2 class="mt-2 text-2xl font-black sm:text-3xl">
                {{ step === 'preview' ? 'Vista previa' : 'Nueva campaña' }}
              </h2>
              <p class="mt-2 text-sm leading-6 text-slate-300">
                <template v-if="step === 'preview'">
                  Así se verían los comentarios. Si te gustan, lanza la campaña.
                </template>
                <template v-else>
                  Configura y pulsa <strong class="text-cyan-200">Vista previa</strong> para ver qué escribiría la IA.
                  <strong class="text-white"> No vota.</strong>
                </template>
              </p>
            </div>
            <button
              type="button"
              class="grid size-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
              @click="close"
            >
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <template v-if="step === 'form'">
            <label class="block">
              <span class="text-[11px] font-black uppercase tracking-widest text-cyan-200">
                Artista a apoyar (obligatorio)
              </span>
              <select
                v-model="selectedContestantId"
                class="mt-2 min-h-12 w-full rounded-2xl border border-cyan-300/30 bg-slate-950 px-4 text-sm font-bold text-white outline-none focus:border-cyan-300/60"
              >
                <option disabled value="">— Elige el artista —</option>
                <option
                  v-for="option in contestantOptions"
                  :key="option.id"
                  :value="option.id"
                >
                  {{ option.name }}
                </option>
              </select>
            </label>

            <div
              v-if="selectedContestant"
              class="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3"
            >
              <p class="text-[10px] font-black uppercase tracking-widest text-cyan-200">
                Comentarios sobre
              </p>
              <p class="mt-1 text-xl font-black text-white">{{ selectedArtistName }}</p>
              <p v-if="rivalArtistName" class="mt-1 text-sm font-bold text-amber-100">
                Duelo contra {{ rivalArtistName }}
              </p>
            </div>

            <label class="block">
              <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Idioma
              </span>
              <select
                v-model="form.language"
                class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
              >
                <option
                  v-for="option in LANGUAGE_OPTIONS"
                  :key="option.code"
                  :value="option.code"
                >
                  {{ option.label }}
                </option>
              </select>
              <span class="mt-2 block text-xs font-bold text-slate-400">
                Imita el largo y tono de los comentarios reales del feed. Sin emojis.
              </span>
            </label>

            <div class="grid gap-4 sm:grid-cols-3">
              <label class="block">
                <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">Comentarios</span>
                <input
                  v-model.number="form.totalComments"
                  type="number"
                  min="1"
                  max="2000"
                  class="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 text-sm font-black text-white outline-none focus:border-cyan-300/50"
                />
              </label>
              <label class="block">
                <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">Usuarios</span>
                <input
                  v-model.number="form.botsCount"
                  type="number"
                  min="1"
                  max="500"
                  class="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 text-sm font-black text-white outline-none focus:border-cyan-300/50"
                />
              </label>
              <label class="block">
                <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">Duración (min)</span>
                <input
                  v-model.number="form.durationMinutes"
                  type="number"
                  min="1"
                  max="720"
                  class="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 text-sm font-black text-white outline-none focus:border-cyan-300/50"
                />
              </label>
            </div>

            <label class="block">
              <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Contexto para la IA (opcional)
              </span>
              <textarea
                v-model="form.topic"
                rows="2"
                placeholder="Ej: Duelo apretado, van perdiendo por 2%. Fans nerviosos pidiendo remonta antes del cierre."
                class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
              ></textarea>
              <p class="mt-1.5 text-[11px] font-bold text-slate-500">
                Qué está pasando en la votación ahora (situación, emoción, rival).
              </p>
            </label>

            <label class="block">
              <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Instrucciones extra (opcional)
              </span>
              <textarea
                v-model="form.brief"
                rows="2"
                placeholder="Ej: Informal, sin emojis, como WhatsApp. Mezcla ya voté / voten / vamos. Nada repetido."
                class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
              ></textarea>
              <p class="mt-1.5 text-[11px] font-bold text-slate-500">
                Cómo debe escribir (tono humano, errores leves, variedad).
              </p>
            </label>
          </template>

          <template v-else-if="preview">
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div class="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Origen</p>
                <p
                  class="mt-1 text-sm font-black"
                  :class="preview.source === 'ai' ? 'text-emerald-200' : preview.source === 'reference' ? 'text-cyan-200' : 'text-amber-200'"
                >
                  {{
                    preview.source === 'ai'
                      ? 'IA'
                      : preview.source === 'reference'
                        ? 'Feed real'
                        : 'Plantilla'
                  }}
                </p>
              </div>
              <div class="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Longitud real (mediana)</p>
                <p class="mt-1 text-sm font-black text-white">
                  {{ preview.lengthProfile?.median || '—' }} chars
                </p>
              </div>
              <div class="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Longitud bot (promedio)</p>
                <p class="mt-1 text-sm font-black text-white">
                  {{ preview.previewAvgLength || '—' }} chars
                </p>
              </div>
              <div class="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Referencias leídas</p>
                <p class="mt-1 text-sm font-black text-white">{{ preview.sampleCommentsCount || 0 }}</p>
              </div>
            </div>

            <p
              v-if="preview.source === 'template'"
              class="rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-100"
            >
              Sin IA disponible (DeepSeek/OpenAI sin créditos). Se usaron plantillas genéricas. Recarga créditos API o usa modo «Feed real» si hay comentarios en la votación.
            </p>
            <p
              v-else-if="preview.source === 'reference'"
              class="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-100"
            >
              IA no disponible: los comentarios del bot se basan en variaciones de comentarios reales del feed (misma longitud y tono).
            </p>

            <div
              v-if="sampleFeedComments.length"
              class="rounded-3xl border border-violet-300/15 bg-[#090b19]/90 p-4 shadow-xl shadow-fuchsia-950/20"
            >
              <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Comentarios reales de esta votación
              </p>
              <p class="mt-1 text-xs font-bold text-slate-400">
                Así se ven en el feed. La IA imita este estilo (no copia literal).
              </p>
              <div class="mt-4 space-y-4">
                <AdminPollCommentFeedCard
                  v-for="(comment, index) in sampleFeedComments"
                  :key="`sample-${index}`"
                  :display-name="comment.displayName"
                  :photo-url="comment.photoUrl"
                  :text="comment.text"
                  time-label="en la votación"
                  muted
                />
              </div>
            </div>

            <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Prompt / contexto enviado
              </p>
              <p class="mt-2 text-sm font-bold leading-6 text-slate-300">
                {{ preview.promptSummary || preview.topic || '—' }}
              </p>
            </div>

            <div class="rounded-3xl border border-cyan-300/15 bg-[#090b19]/90 p-4 shadow-xl shadow-cyan-950/20">
              <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Vista previa del bot
              </p>
              <p class="mt-1 text-xs font-bold text-slate-400">
                Así quedarían publicados en el feed. Longitud similar a los comentarios reales de arriba.
              </p>
              <div class="mt-4 max-h-80 space-y-4 overflow-y-auto pr-1">
                <AdminPollCommentFeedCard
                  v-for="(comment, index) in botFeedComments"
                  :key="`bot-${index}`"
                  :display-name="comment.displayName"
                  :photo-url="comment.photoUrl"
                  :text="comment.text"
                  time-label="al publicar"
                />
              </div>
            </div>
          </template>

          <p
            v-if="modalFeedback"
            class="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100"
          >
            {{ modalFeedback }}
          </p>
          <p
            v-if="modalError"
            class="rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100"
          >
            {{ modalError }}
          </p>
        </div>

        <div class="shrink-0 grid gap-3 border-t border-white/10 p-5 sm:grid-cols-2 sm:px-6">
          <template v-if="step === 'form'">
            <button
              type="button"
              class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
              :disabled="isPreviewLoading"
              @click="close"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-violet-500 to-cyan-500 px-5 text-sm font-black uppercase tracking-wide text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canPreview"
              @click="runPreview"
            >
              <i
                class="fa-solid"
                :class="isPreviewLoading ? 'fa-circle-notch fa-spin' : 'fa-eye'"
                aria-hidden="true"
              ></i>
              {{ isPreviewLoading ? 'Generando...' : 'Vista previa' }}
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
              :disabled="isCreating"
              @click="backToForm"
            >
              Volver a editar
            </button>
            <button
              type="button"
              class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-cyan-500 to-emerald-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-cyan-950/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canLaunch"
              @click="submit"
            >
              <i
                class="fa-solid"
                :class="isCreating ? 'fa-circle-notch fa-spin' : 'fa-rocket'"
                aria-hidden="true"
              ></i>
              {{ isCreating ? 'Lanzando...' : 'Lanzar campaña' }}
            </button>
          </template>
        </div>
      </article>
    </div>
  </Teleport>
</template>
