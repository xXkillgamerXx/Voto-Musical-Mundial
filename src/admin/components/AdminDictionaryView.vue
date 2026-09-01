<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  getModerationDictionary,
  testModerationDictionary,
  updateModerationDictionary,
} from '../../services/api/adminApi'

const isLoading = ref(true)
const isSaving = ref(false)
const isTesting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const updatedAt = ref(null)

const activeTab = ref('promo')
const searchQuery = ref('')
const newPhraseType = ref('promo')
const newPhraseText = ref('')
const showAddForm = computed(() => ['promo', 'diversion', 'custom'].includes(activeTab.value))
const testText = ref('')
const testResult = ref(null)

const config = ref({
  customPromo: [],
  customDiversion: [],
  disabledKeys: [],
})

const promoEntries = ref([])
const diversionEntries = ref([])
const regexEntries = ref([])
const stats = ref(null)

const tabs = [
  { value: 'promo', label: 'Promo' },
  { value: 'diversion', label: 'Diversion' },
  { value: 'custom', label: 'Personalizadas' },
  { value: 'regex', label: 'Regex' },
  { value: 'test', label: 'Probar' },
]

const filteredPromo = computed(() => filterEntries(promoEntries.value))
const filteredDiversion = computed(() => filterEntries(diversionEntries.value))
const customEntries = computed(() => [
  ...promoEntries.value.filter((entry) => entry.source === 'custom'),
  ...diversionEntries.value.filter((entry) => entry.source === 'custom'),
])

const filterEntries = (entries) => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return entries
  return entries.filter(
    (entry) =>
      entry.phrase?.toLowerCase().includes(query) ||
      entry.categoryLabel?.toLowerCase().includes(query) ||
      entry.id?.toLowerCase().includes(query),
  )
}

const formatUpdatedAt = (value) => {
  if (!value) return 'Sin cambios guardados'
  try {
    return new Date(value).toLocaleString('es-ES')
  } catch {
    return value
  }
}

const applyPayload = (payload) => {
  config.value = {
    customPromo: payload?.config?.customPromo || [],
    customDiversion: payload?.config?.customDiversion || [],
    disabledKeys: payload?.config?.disabledKeys || [],
  }
  promoEntries.value = payload?.promo || []
  diversionEntries.value = payload?.diversion || []
  regexEntries.value = payload?.regexes || []
  stats.value = payload?.stats || null
  updatedAt.value = payload?.config?.updatedAt || null
}

const loadDictionary = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    applyPayload(await getModerationDictionary())
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo cargar el diccionario.'
  } finally {
    isLoading.value = false
  }
}

const saveConfig = async () => {
  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const payload = await updateModerationDictionary({
      customPromo: config.value.customPromo,
      customDiversion: config.value.customDiversion,
      disabledKeys: config.value.disabledKeys,
    })
    applyPayload(payload)
    successMessage.value = 'Diccionario guardado.'
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo guardar el diccionario.'
  } finally {
    isSaving.value = false
  }
}

const toggleBuiltin = (entry) => {
  if (entry.source !== 'builtin') return
  const disabled = new Set(config.value.disabledKeys)
  if (entry.enabled) {
    disabled.add(entry.key)
  } else {
    disabled.delete(entry.key)
  }
  config.value.disabledKeys = [...disabled]
  promoEntries.value = promoEntries.value.map((row) =>
    row.key === entry.key ? { ...row, enabled: !entry.enabled } : row,
  )
  diversionEntries.value = diversionEntries.value.map((row) =>
    row.key === entry.key ? { ...row, enabled: !entry.enabled } : row,
  )
}

const parseNewPhrases = () =>
  [...new Set(
    String(newPhraseText.value || '')
      .split(/[\n,;]+/)
      .map((phrase) => phrase.trim())
      .filter((phrase) => phrase.length >= 2),
  )]

const addCustomPhrase = async () => {
  const phrases = parseNewPhrases()
  if (!phrases.length) {
    errorMessage.value = 'Escribe al menos una frase (mínimo 2 caracteres). Puedes pegar varias, una por línea.'
    return
  }

  const listKey = newPhraseType.value === 'diversion' ? 'customDiversion' : 'customPromo'
  const id = newPhraseType.value === 'diversion' ? 'custom_diversion' : 'custom_promo'
  const existing = new Set(
    [...config.value.customPromo, ...config.value.customDiversion].map((entry) =>
      entry.phrase.toLowerCase(),
    ),
  )
  const added = []
  for (const phrase of phrases) {
    if (phrase.length > 120 || existing.has(phrase.toLowerCase())) continue
    existing.add(phrase.toLowerCase())
    added.push({ id, phrase })
  }

  if (!added.length) {
    errorMessage.value = phrases.length === 1
      ? 'Esa frase ya existe en el diccionario.'
      : 'Esas frases ya están en el diccionario.'
    return
  }

  config.value[listKey] = [...config.value[listKey], ...added]
  newPhraseText.value = ''
  errorMessage.value = ''
  await saveConfig()
  successMessage.value = added.length === 1
    ? `Regla agregada: “${added[0].phrase}”.`
    : `${added.length} reglas agregadas.`
}

watch(activeTab, (tab) => {
  if (tab === 'promo' || tab === 'diversion') {
    newPhraseType.value = tab
  }
})

const removeCustomPhrase = async (entry) => {
  if (entry.source !== 'custom') return
  const listKey = entry.type === 'diversion' ? 'customDiversion' : 'customPromo'
  config.value[listKey] = config.value[listKey].filter((row) => row.phrase !== entry.phrase)
  await saveConfig()
}

const runTest = async () => {
  isTesting.value = true
  errorMessage.value = ''
  testResult.value = null
  try {
    testResult.value = await testModerationDictionary(testText.value)
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo probar el texto.'
  } finally {
    isTesting.value = false
  }
}

const primaryTypeLabels = {
  none: 'Ninguna',
  promo: 'Promo',
  diversion: 'Diversion',
  external_link: 'Enlace externo',
}

onMounted(loadDictionary)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
          Moderacion
        </p>
        <h2 class="mt-1 text-2xl font-black">Diccionario de alertas</h2>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-white/65">
          Agrega las frases que quieras: cada una dispara una alerta en comentarios.
          Puedes pegar varias, una por línea. Las integradas se pueden desactivar.
        </p>
        <p class="mt-2 text-xs text-white/45">
          Ultima actualizacion: {{ formatUpdatedAt(updatedAt) }}
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <a
          href="/admin/reportes"
          class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-white/80 transition hover:bg-white/10"
        >
          <i class="fa-solid fa-shield-halved"></i>
          Volver a reportes
        </a>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-full bg-fuchsia-500 px-4 py-2 text-xs font-black text-white transition hover:bg-fuchsia-400 disabled:opacity-60"
          :disabled="isSaving || isLoading"
          @click="saveConfig"
        >
          <i class="fa-solid fa-floppy-disk"></i>
          {{ isSaving ? 'Guardando...' : 'Guardar cambios' }}
        </button>
      </div>
    </div>

    <div
      v-if="stats"
      class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-wider text-white/45">Promo activas</p>
        <p class="mt-1 text-2xl font-black">{{ stats.enabledPromo }}</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-wider text-white/45">Diversion activas</p>
        <p class="mt-1 text-2xl font-black">{{ stats.enabledDiversion }}</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-wider text-white/45">Personalizadas</p>
        <p class="mt-1 text-2xl font-black">{{ stats.customPromo + stats.customDiversion }}</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-wider text-white/45">Integradas desactivadas</p>
        <p class="mt-1 text-2xl font-black">{{ stats.disabledCount }}</p>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100"
    >
      {{ errorMessage }}
    </div>
    <div
      v-if="successMessage"
      class="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
    >
      {{ successMessage }}
    </div>

    <div class="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
      <div class="flex flex-wrap gap-2 border-b border-white/10 pb-4">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          class="rounded-full px-4 py-2 text-xs font-black transition"
          :class="activeTab === tab.value ? 'bg-fuchsia-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <div
        v-if="activeTab !== 'test'"
        class="mt-4"
      >
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Buscar frase o categoria..."
          class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-fuchsia-400/40"
        />
      </div>

      <div
        v-if="!isLoading && showAddForm"
        class="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-4"
      >
        <p class="text-xs font-black uppercase tracking-widest text-cyan-200">Agregar reglas</p>
        <p class="mt-1 text-xs text-white/50">
          Una frase por línea. Promo = publicidad / redes. Diversion = llevar votos a otra página.
        </p>
        <div class="mt-3 grid gap-3 md:grid-cols-[10rem,1fr,auto]">
          <select
            v-model="newPhraseType"
            class="h-11 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none"
          >
            <option value="promo">Promo</option>
            <option value="diversion">Diversion</option>
          </select>
          <textarea
            v-model="newPhraseText"
            rows="3"
            maxlength="4000"
            placeholder="sigueme en tiktok&#10;vote on another site&#10;link en mi bio"
            class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-cyan-400/40"
          />
          <button
            type="button"
            class="h-11 self-end rounded-2xl bg-cyan-500 px-5 text-xs font-black text-white transition hover:bg-cyan-400 disabled:opacity-60"
            :disabled="isSaving"
            @click="addCustomPhrase"
          >
            {{ isSaving ? 'Guardando...' : 'Agregar' }}
          </button>
        </div>
      </div>

      <div
        v-if="isLoading"
        class="py-16 text-center text-sm text-white/50"
      >
        Cargando diccionario...
      </div>

      <div
        v-else-if="activeTab === 'promo'"
        class="mt-4 space-y-2"
      >
        <div
          v-for="entry in filteredPromo"
          :key="entry.key"
          class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
        >
          <div>
            <p class="text-sm font-semibold text-white">{{ entry.phrase }}</p>
            <p class="mt-1 text-xs text-white/45">{{ entry.categoryLabel }}</p>
          </div>
          <button
            v-if="entry.source === 'builtin'"
            type="button"
            class="rounded-full px-3 py-1.5 text-xs font-black transition"
            :class="entry.enabled ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-white/50'"
            @click="toggleBuiltin(entry)"
          >
            {{ entry.enabled ? 'Activa' : 'Desactivada' }}
          </button>
          <span
            v-else
            class="flex items-center gap-2"
          >
            <span class="rounded-full bg-cyan-500/15 px-3 py-1.5 text-xs font-black text-cyan-200">
              Personalizada
            </span>
            <button
              type="button"
              class="rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-black text-red-200 transition hover:bg-red-500/25 disabled:opacity-60"
              :disabled="isSaving"
              @click="removeCustomPhrase(entry)"
            >
              Eliminar
            </button>
          </span>
        </div>
        <p
          v-if="!filteredPromo.length"
          class="py-8 text-center text-sm text-white/45"
        >
          No hay frases que coincidan con la busqueda.
        </p>
      </div>

      <div
        v-else-if="activeTab === 'diversion'"
        class="mt-4 space-y-2"
      >
        <div
          v-for="entry in filteredDiversion"
          :key="entry.key"
          class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
        >
          <div>
            <p class="text-sm font-semibold text-white">{{ entry.phrase }}</p>
            <p class="mt-1 text-xs text-white/45">{{ entry.categoryLabel }}</p>
          </div>
          <button
            v-if="entry.source === 'builtin'"
            type="button"
            class="rounded-full px-3 py-1.5 text-xs font-black transition"
            :class="entry.enabled ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-white/50'"
            @click="toggleBuiltin(entry)"
          >
            {{ entry.enabled ? 'Activa' : 'Desactivada' }}
          </button>
          <span
            v-else
            class="flex items-center gap-2"
          >
            <span class="rounded-full bg-cyan-500/15 px-3 py-1.5 text-xs font-black text-cyan-200">
              Personalizada
            </span>
            <button
              type="button"
              class="rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-black text-red-200 transition hover:bg-red-500/25 disabled:opacity-60"
              :disabled="isSaving"
              @click="removeCustomPhrase(entry)"
            >
              Eliminar
            </button>
          </span>
        </div>
        <p
          v-if="!filteredDiversion.length"
          class="py-8 text-center text-sm text-white/45"
        >
          No hay frases que coincidan con la busqueda.
        </p>
      </div>

      <div
        v-else-if="activeTab === 'custom'"
        class="mt-4 space-y-2"
      >
        <div
          v-for="entry in customEntries"
          :key="entry.key"
          class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
        >
          <div>
            <p class="text-sm font-semibold text-white">{{ entry.phrase }}</p>
            <p class="mt-1 text-xs text-white/45">{{ entry.categoryLabel }}</p>
          </div>
          <button
            type="button"
            class="rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-black text-red-200 transition hover:bg-red-500/25 disabled:opacity-60"
            :disabled="isSaving"
            @click="removeCustomPhrase(entry)"
          >
            Eliminar
          </button>
        </div>
        <p
          v-if="!customEntries.length"
          class="py-8 text-center text-sm text-white/45"
        >
          Aun no hay frases personalizadas. Usa el recuadro de arriba para agregar.
        </p>
      </div>

      <div
        v-else-if="activeTab === 'regex'"
        class="mt-4 space-y-2"
      >
        <p class="text-sm text-white/55">
          Patrones regex integrados (solo lectura). Siempre activos.
        </p>
        <div
          v-for="entry in regexEntries"
          :key="entry.id"
          class="rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
        >
          <p class="text-sm font-semibold text-white">{{ entry.label }}</p>
          <p class="mt-1 text-xs text-white/45">{{ entry.categoryLabel }}</p>
          <code class="mt-2 block overflow-x-auto rounded-xl bg-black/30 px-3 py-2 text-xs text-cyan-200">
            {{ entry.pattern }}
          </code>
        </div>
      </div>

      <div
        v-else-if="activeTab === 'test'"
        class="mt-4 space-y-4"
      >
        <textarea
          v-model="testText"
          rows="4"
          maxlength="500"
          placeholder="Escribe un comentario de prueba..."
          class="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-fuchsia-400/40"
        ></textarea>
        <button
          type="button"
          class="rounded-full bg-fuchsia-500 px-5 py-2.5 text-xs font-black text-white transition hover:bg-fuchsia-400 disabled:opacity-60"
          :disabled="isTesting"
          @click="runTest"
        >
          {{ isTesting ? 'Probando...' : 'Probar texto' }}
        </button>

        <div
          v-if="testResult?.scan"
          class="rounded-2xl border border-white/10 bg-black/20 p-4"
        >
          <p class="text-sm font-black text-white">
            Resultado:
            <span
              class="ml-2 rounded-full px-2 py-0.5 text-xs"
              :class="testResult.scan.suspicious ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'"
            >
              {{ testResult.scan.suspicious ? 'Sospechoso' : 'Limpio' }}
            </span>
          </p>
          <p class="mt-2 text-xs text-white/55">
            Tipo principal: {{ primaryTypeLabels[testResult.scan.primaryType] || testResult.scan.primaryType }}
          </p>
          <ul
            v-if="testResult.scan.matches?.length"
            class="mt-3 space-y-2"
          >
            <li
              v-for="(match, index) in testResult.scan.matches"
              :key="`${match.category}-${index}`"
              class="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/80"
            >
              <span class="font-black text-fuchsia-200">{{ match.category }}</span>
              · {{ match.label }}
            </li>
          </ul>
          <p
            v-if="testResult.scan.externalUrls?.length"
            class="mt-3 text-xs text-red-200"
          >
            Enlaces externos detectados: {{ testResult.scan.externalUrls.join(', ') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
