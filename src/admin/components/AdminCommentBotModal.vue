<script setup>
import { computed, ref, watch } from 'vue'
import {
  createAdminCommentBotCampaign,
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

const canLaunch = computed(() => Boolean(selectedContestant.value) && !isCreating.value)

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
  form.value.brief = ''
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
  if (isCreating.value) {
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
  modalFeedback.value = ''
})

watch(
  () => form.value.language,
  (next, prev) => {
    if (!isOpen.value || next === prev) {
      return
    }
    modalFeedback.value = ''
  },
)

const submit = async () => {
  modalError.value = ''
  modalFeedback.value = ''

  if (!selectedContestant.value) {
    modalError.value = 'Selecciona el artista que van a apoyar.'
    return
  }

  isCreating.value = true
  try {
    modalFeedback.value = 'La IA está generando comentarios y arrancando el bot...'

    await createAdminCommentBotCampaign(props.pollId, {
      totalComments: Number(form.value.totalComments || 0),
      botsCount: Number(form.value.botsCount || 0),
      durationMinutes: Number(form.value.durationMinutes || 0),
      topic: buildPrompt() || undefined,
      artistId: selectedContestant.value.artistId || undefined,
      artistName: selectedArtistName.value,
      rivalArtistName: rivalArtistName.value || undefined,
      language: form.value.language || 'es',
    })

    isOpen.value = false
    emit('created')
  } catch (error) {
    modalError.value = error?.message || 'No se pudo iniciar la campaña.'
    modalFeedback.value = ''
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
                Elige artista, idioma y cantidad. Al pulsar <strong class="text-cyan-200">Lanzar</strong>,
                el bot genera los comentarios con IA y los publica solo, poco a poco.
                Esto <strong class="text-white">no vota</strong>.
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

          <label class="block">
            <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Idioma de los comentarios
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
              La IA escribe frases cortas (8–120 caracteres) como fan real, en el idioma elegido.
            </span>
          </label>

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
              Contexto para la IA (opcional)
            </span>
            <textarea
              v-model="form.topic"
              rows="2"
              placeholder="Ej: pedir remonta en el duelo, hype por nuevo single..."
              class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
            ></textarea>
          </label>

          <label class="block">
            <span class="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Instrucciones extra (opcional)
            </span>
            <textarea
              v-model="form.brief"
              rows="2"
              placeholder="Ej: tono emocionado, pedir votos al grupo..."
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
            :disabled="isCreating"
            @click="close"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-cyan-500 to-emerald-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-cyan-950/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!canLaunch"
            @click="submit"
          >
            <i
              class="fa-solid"
              :class="isCreating ? 'fa-circle-notch fa-spin' : 'fa-comment-dots'"
              aria-hidden="true"
            ></i>
            {{ isCreating ? 'Lanzando bot...' : 'Lanzar comentarios' }}
          </button>
        </div>
      </article>
    </div>
  </Teleport>
</template>
