<script setup>
import { computed, ref, watch } from 'vue'
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
const modalError = ref('')
const modalFeedback = ref('')
const isCreating = ref(false)
const isGenerating = ref(false)
const messageSource = ref('')
const referenceCommentsCount = ref(0)
const selectedContestantId = ref('')
const rivalArtistName = ref('')

const form = ref({
  totalComments: 40,
  botsCount: 20,
  durationMinutes: 60,
  topic: '',
  brief: '',
  messages: '',
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

const buildArtistTopic = (artistName, rival = '') => {
  if (rival) {
    return `Fans apoyando a ${artistName} en el duelo contra ${rival}. Pedir votos, hype, remonta y emoción.`
  }
  return `Fans apoyando a ${artistName}: pedir votos, hype, talento y emoción por su candidatura.`
}

const buildPrompt = () => {
  const topic = String(form.value.topic || '').trim()
  const brief = String(form.value.brief || '').trim()
  if (topic && brief) {
    return `${topic}\n\nInstrucciones extra: ${brief}`
  }
  return topic || brief
}

const resetForm = () => {
  modalError.value = ''
  modalFeedback.value = ''
  messageSource.value = ''
  referenceCommentsCount.value = 0
  form.value = {
    totalComments: 40,
    botsCount: 20,
    durationMinutes: 60,
    topic: '',
    brief: '',
    messages: '',
  }
}

const applyContestant = (contestant, options = {}) => {
  selectedContestantId.value = String(contestant?.id || '')
  rivalArtistName.value = String(options.rivalArtistName || '').trim()
  form.value.topic = buildArtistTopic(
    contestant?.artist?.name || '',
    rivalArtistName.value,
  )
  form.value.brief = ''
  form.value.messages = ''
  messageSource.value = ''
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
  if (isCreating.value || isGenerating.value) {
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
  if (!form.value.topic.trim() || form.value.topic.includes('Fans apoyando a')) {
    form.value.topic = buildArtistTopic(row.name, rivalArtistName.value)
  }
})

const generateMessages = async () => {
  modalError.value = ''
  modalFeedback.value = ''

  if (!selectedContestant.value) {
    modalError.value = 'Selecciona el artista que van a apoyar en los comentarios.'
    return
  }

  const topic = buildPrompt()
  if (!topic) {
    modalError.value = 'Escribe el contexto del apoyo o instrucciones para la IA.'
    return
  }

  isGenerating.value = true
  try {
    const result = await suggestAdminCommentBotMessages(props.pollId, {
      topic: topic || buildArtistTopic(selectedArtistName.value, rivalArtistName.value),
      count: Math.min(80, Math.max(10, Number(form.value.totalComments || 25))),
      artistId: selectedContestant.value.artistId || undefined,
      artistName: selectedArtistName.value,
      rivalArtistName: rivalArtistName.value || undefined,
    })
    const lines = Array.isArray(result?.messages) ? result.messages : []
    if (!lines.length) {
      modalError.value = 'No se pudieron generar comentarios. Revisa la API de IA en el servidor.'
      return
    }
    form.value.messages = lines.join('\n')
    messageSource.value = result?.source === 'ai' ? 'ia' : 'plantilla'
    referenceCommentsCount.value = Number(result?.sampleCommentsCount || 0)
    modalFeedback.value =
      result?.source === 'ai'
        ? `Listo: ${lines.length} comentarios sobre ${selectedArtistName.value}. Revísalos antes de lanzar.`
        : `IA no disponible: se usaron ${lines.length} frases automáticas.`
  } catch (error) {
    modalError.value = error?.message || 'No se pudieron generar los comentarios.'
  } finally {
    isGenerating.value = false
  }
}

const submit = async () => {
  modalError.value = ''
  modalFeedback.value = ''

  if (!selectedContestant.value) {
    modalError.value = 'Selecciona el artista que van a apoyar.'
    return
  }

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
      topic: buildPrompt() || undefined,
      artistId: selectedContestant.value.artistId || undefined,
      artistName: selectedArtistName.value,
      rivalArtistName: rivalArtistName.value || undefined,
      messages,
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
                Fans comentando en vivo
              </h2>
              <p class="mt-2 text-sm leading-6 text-slate-300">
                Publica comentarios de apoyo con nombres de usuario reales. Esto
                <strong class="text-white">no vota</strong> — solo anima el feed. Para votos automáticos usa
                <strong class="text-violet-200">Bot de votos</strong>.
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
            <span
              v-if="!contestantOptions.length"
              class="mt-2 block text-xs font-bold text-amber-200"
            >
              No hay artistas en la fase activa. Abre una fase con participantes primero.
            </span>
          </label>

          <div
            v-if="selectedContestant"
            class="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3"
          >
            <p class="text-[10px] font-black uppercase tracking-widest text-cyan-200">
              Comentarios sobre
            </p>
            <p class="mt-1 text-xl font-black text-white">{{ selectedArtistName }}</p>
            <p
              v-if="rivalArtistName"
              class="mt-1 text-sm font-bold text-amber-100"
            >
              Duelo contra {{ rivalArtistName }}
            </p>
          </div>

          <div class="grid gap-4 sm:grid-cols-3">
            <label class="block">
              <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Comentarios
              </span>
              <input
                v-model.number="form.totalComments"
                type="number"
                min="1"
                max="2000"
                class="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 text-sm font-black text-white outline-none focus:border-cyan-300/50"
              />
            </label>
            <label class="block">
              <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Usuarios distintos
              </span>
              <input
                v-model.number="form.botsCount"
                type="number"
                min="1"
                max="500"
                class="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 text-sm font-black text-white outline-none focus:border-cyan-300/50"
              />
            </label>
            <label class="block">
              <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Duración (min)
              </span>
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
              Contexto del apoyo
            </span>
            <textarea
              v-model="form.topic"
              rows="2"
              placeholder="Ej: pedir remonta en el duelo, hype por nuevo single, urgencia porque cierra hoy..."
              class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
            ></textarea>
          </label>

          <label class="block">
            <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Instrucciones extra para la IA (opcional)
            </span>
            <textarea
              v-model="form.brief"
              rows="2"
              placeholder="Ej: tono emocionado, pedir votos al grupo, mencionar que van perdiendo..."
              class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
            ></textarea>
          </label>

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-5 text-sm font-black uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isGenerating || isCreating || !selectedContestant"
              @click="generateMessages"
            >
              <i
                class="fa-solid"
                :class="isGenerating ? 'fa-circle-notch fa-spin' : 'fa-wand-magic-sparkles'"
                aria-hidden="true"
              ></i>
              {{ isGenerating ? 'Generando...' : 'Generar comentarios con IA' }}
            </button>
            <span
              v-if="messageSource === 'ia'"
              class="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-100"
            >
              IA lista
            </span>
          </div>

          <label class="block">
            <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Comentarios (uno por línea)
            </span>
            <textarea
              v-model="form.messages"
              rows="7"
              placeholder="Pulsa «Generar comentarios con IA» o escribe las frases aquí..."
              class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
            ></textarea>
          </label>

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
          <button
            type="button"
            class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
            :disabled="isCreating || isGenerating"
            @click="close"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-cyan-500 to-emerald-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-cyan-950/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isCreating || !selectedContestant"
            @click="submit"
          >
            <i
              class="fa-solid"
              :class="isCreating ? 'fa-circle-notch fa-spin' : 'fa-comment-dots'"
              aria-hidden="true"
            ></i>
            {{ isCreating ? 'Iniciando...' : 'Lanzar comentarios' }}
          </button>
        </div>
      </article>
    </div>
  </Teleport>
</template>
