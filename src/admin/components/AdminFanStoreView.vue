<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { availableLocales, translate } from '../../i18n'
import { getAdminFanStore, updateAdminFanStore } from '../../services/api/adminApi'
import { applyFanStore } from '../../services/fanStore'

const store = ref(null)
const isLoading = ref(true)
const isSaving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const activeLocale = ref('es')

const localeTabs = computed(() =>
  availableLocales.map((item) => ({
    value: item.code,
    label: translate(item.labelKey),
  })),
)

const visibilityOptions = [
  { id: 'public', label: 'Público', hint: 'Todos ven /planes y el link del menú.' },
  { id: 'admin', label: 'Solo admin', hint: 'Solo cuentas admin, superadmin u owner.' },
  { id: 'hidden', label: 'Oculto', hint: 'Nadie lo ve en la web. Tú sí puedes previsualizarlo.' },
]

const ensureLocaleMap = (map, locale, empty) => {
  const next = map && typeof map === 'object' && !Array.isArray(map) ? map : {}
  if (next[locale] == null) next[locale] = empty
  return next
}

const ensureStoreLocale = (locale = activeLocale.value) => {
  const current = store.value
  if (!current || !locale) return
  current.headline = ensureLocaleMap(current.headline, locale, '')
  current.subhead = ensureLocaleMap(current.subhead, locale, '')
  for (const plan of current.plans || []) {
    plan.tagline = ensureLocaleMap(plan.tagline, locale, '')
    plan.desc = ensureLocaleMap(plan.desc, locale, '')
    plan.descYear = ensureLocaleMap(plan.descYear, locale, '')
    plan.benefits = ensureLocaleMap(plan.benefits, locale, [])
  }
  for (const pack of current.packs || []) {
    pack.note = ensureLocaleMap(pack.note, locale, '')
  }
}

const benefitsText = (plan, lang) => (plan.benefits?.[lang] || []).join('\n')

const setBenefits = (plan, lang, value) => {
  plan.benefits = ensureLocaleMap(plan.benefits, lang, [])
  plan.benefits[lang] = String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const visibilityLabel = computed(() => {
  const option = visibilityOptions.find((item) => item.id === store.value?.visibility)
  return option?.label || 'Público'
})

const loadStore = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    store.value = await getAdminFanStore()
    availableLocales.forEach((item) => ensureStoreLocale(item.code))
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo cargar Planes.'
  } finally {
    isLoading.value = false
  }
}

const saveStore = async () => {
  if (!store.value) return
  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const payload = {
      ...store.value,
      plans: (store.value.plans || []).map((plan) => ({
        ...plan,
        usdYTotal: Number((Number(plan.usdY || 0) * 12).toFixed(2)),
        copYTotal: Math.round(Number(plan.copY || 0) * 12),
      })),
    }
    store.value = await updateAdminFanStore(payload)
    availableLocales.forEach((item) => ensureStoreLocale(item.code))
    applyFanStore(store.value)
    successMessage.value = `Planes guardados. Visibilidad: ${visibilityLabel.value}.`
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo guardar Planes.'
  } finally {
    isSaving.value = false
  }
}

watch(activeLocale, (locale) => ensureStoreLocale(locale))

const nextPackSku = (pts = 100) => {
  const used = new Set((store.value?.packs || []).map((pack) => String(pack.sku || '').toUpperCase()))
  const base = `P${Math.max(1, Number(pts) || 100)}`
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`) && n < 99) n += 1
  return `${base}-${n}`
}

const addPack = () => {
  if (!store.value) return
  if (!Array.isArray(store.value.packs)) store.value.packs = []
  const note = {}
  availableLocales.forEach((item) => {
    note[item.code] = ''
  })
  store.value.packs.push({
    sku: nextPackSku(100),
    enabled: true,
    pts: 100,
    usd: 0.99,
    cop: 3900,
    note,
  })
  ensureStoreLocale()
}

const removePack = (index) => {
  if (!store.value?.packs) return
  store.value.packs.splice(index, 1)
}

onMounted(loadStore)
</script>

<template>
  <article class="rounded-4xl border border-amber-300/20 bg-amber-500/8 p-5 sm:p-6">
    <p class="text-xs font-black uppercase tracking-[0.28em] text-amber-300">
      Planes
    </p>
    <h2 class="mt-2 text-2xl font-black text-white">
      Apartado /planes
    </h2>
    <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
      Aquí controlas si el apartado se ve en la web, y todos los textos y precios de FAN, SUPER, MEGA y packs.
      Los textos se editan por idioma, no mezclados. Si mañana hay otro idioma, aparece otra pestaña.
    </p>

    <div v-if="isLoading" class="mt-5 py-8 text-center text-sm font-bold text-slate-400">
      Cargando planes...
    </div>

    <template v-else-if="store">
      <div class="mt-5 grid gap-3 sm:grid-cols-3">
        <button
          v-for="option in visibilityOptions"
          :key="option.id"
          type="button"
          class="rounded-3xl border p-4 text-left transition"
          :class="store.visibility === option.id
            ? 'border-amber-300/40 bg-amber-400/15 text-amber-100'
            : 'border-white/10 bg-slate-950/45 text-slate-300 hover:bg-white/5'"
          @click="store.visibility = option.id"
        >
          <span class="block text-sm font-black uppercase">{{ option.label }}</span>
          <span class="mt-2 block text-xs leading-5 text-slate-400">{{ option.hint }}</span>
        </button>
      </div>

      <div class="mt-6 flex flex-wrap gap-2">
        <button
          v-for="tab in localeTabs"
          :key="tab.value"
          type="button"
          class="min-h-10 rounded-2xl px-4 text-xs font-black uppercase tracking-wide transition"
          :class="activeLocale === tab.value
            ? 'bg-linear-to-r from-amber-400 to-orange-500 text-slate-950'
            : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'"
          @click="activeLocale = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
      <p class="mt-3 text-xs font-bold text-slate-500">
        Editando {{ localeTabs.find((tab) => tab.value === activeLocale)?.label || activeLocale }}.
        Precios y visibilidad son iguales para todos los idiomas.
      </p>

      <div class="mt-5 grid gap-4 lg:grid-cols-2">
        <label class="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
          <span class="block text-xs font-black uppercase tracking-[0.24em] text-amber-300">Título</span>
          <input v-model="store.headline[activeLocale]" class="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-amber-300/40" />
        </label>
        <label class="rounded-3xl border border-white/10 bg-slate-950/45 p-4 lg:col-span-2">
          <span class="block text-xs font-black uppercase tracking-[0.24em] text-amber-300">Subtítulo</span>
          <textarea v-model="store.subhead[activeLocale]" rows="3" class="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-amber-300/40"></textarea>
        </label>
      </div>

      <div class="mt-6 grid gap-4">
        <article
          v-for="plan in store.plans"
          :key="plan.sku"
          class="rounded-3xl border border-white/10 bg-slate-950/45 p-4 sm:p-5"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-lg font-black text-white">{{ plan.sku }} · {{ plan.name }}</h3>
            <button
              type="button"
              class="rounded-full border px-4 py-2 text-xs font-black uppercase"
              :class="plan.enabled !== false
                ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100'
                : 'border-white/10 bg-white/5 text-slate-400'"
              @click="plan.enabled = plan.enabled === false"
            >
              {{ plan.enabled === false ? 'Apagado' : 'Activo' }}
            </button>
          </div>
          <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label class="text-xs font-black uppercase tracking-widest text-slate-500">
              Nombre
              <input v-model="plan.name" class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none" />
            </label>
            <label class="text-xs font-black uppercase tracking-widest text-slate-500">
              Multiplicador
              <input v-model.number="plan.multiplier" type="number" min="1" class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none" />
            </label>
            <label class="text-xs font-black uppercase tracking-widest text-slate-500">
              Artistas
              <input v-model.number="plan.maxArtists" type="number" min="1" max="3" class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none" />
            </label>
            <label class="text-xs font-black uppercase tracking-widest text-slate-500">
              Pts bienvenida
              <input v-model.number="plan.welcomePts" type="number" min="0" class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none" />
            </label>
            <label class="text-xs font-black uppercase tracking-widest text-slate-500">USD mes
              <input v-model.number="plan.usdM" type="number" step="0.01" class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none" />
            </label>
            <label class="text-xs font-black uppercase tracking-widest text-slate-500">USD año /mes
              <input v-model.number="plan.usdY" type="number" step="0.01" class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none" />
            </label>
            <label class="text-xs font-black uppercase tracking-widest text-slate-500">COP mes
              <input v-model.number="plan.copM" type="number" class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none" />
            </label>
            <label class="text-xs font-black uppercase tracking-widest text-slate-500">COP año /mes
              <input v-model.number="plan.copY" type="number" class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none" />
            </label>
          </div>
          <div class="mt-4 grid gap-3">
            <label class="text-xs font-black uppercase tracking-widest text-slate-500">
              Tagline
              <input v-model="plan.tagline[activeLocale]" class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none" />
            </label>
            <label class="text-xs font-black uppercase tracking-widest text-slate-500">
              Beneficios (un renglón cada uno)
              <textarea
                :value="benefitsText(plan, activeLocale)"
                rows="5"
                class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none"
                @input="setBenefits(plan, activeLocale, $event.target.value)"
              ></textarea>
            </label>
          </div>
        </article>
      </div>

      <div class="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-lg font-black text-white">Packs de puntos</h3>
        <button
          type="button"
          class="rounded-full border border-amber-300/30 bg-amber-400/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-amber-100 transition hover:bg-amber-400/25"
          @click="addPack"
        >
          + Agregar pack
        </button>
      </div>
      <p class="mt-2 text-xs font-bold text-slate-500">
        Puedes crear los que quieras. Cada pack tiene sus puntos, precio y nota por idioma.
      </p>
      <div v-if="!store.packs?.length" class="mt-3 rounded-3xl border border-dashed border-white/15 bg-slate-950/30 px-4 py-8 text-center text-sm font-bold text-slate-400">
        No hay packs. Agrega uno para vender puntos sueltos.
      </div>
      <div v-else class="mt-3 grid gap-3 lg:grid-cols-3">
        <article v-for="(pack, index) in store.packs" :key="`${pack.sku}-${index}`" class="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
          <div class="flex items-center justify-between gap-2">
            <p class="font-black text-white">{{ pack.sku || `Pack ${index + 1}` }}</p>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded-full border px-3 py-1 text-[10px] font-black uppercase"
                :class="pack.enabled !== false
                  ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100'
                  : 'border-white/10 bg-white/5 text-slate-400'"
                @click="pack.enabled = pack.enabled === false"
              >
                {{ pack.enabled === false ? 'Off' : 'On' }}
              </button>
              <button
                type="button"
                class="rounded-full border border-red-300/25 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase text-red-100 hover:bg-red-500/20"
                @click="removePack(index)"
              >
                Quitar
              </button>
            </div>
          </div>
          <label class="mt-3 block text-xs font-black uppercase tracking-widest text-slate-500">
            Código
            <input v-model="pack.sku" class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold uppercase tracking-normal text-white outline-none" />
          </label>
          <label class="mt-3 block text-xs font-black uppercase tracking-widest text-slate-500">
            Puntos
            <input v-model.number="pack.pts" type="number" min="1" class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none" />
          </label>
          <label class="mt-3 block text-xs font-black uppercase tracking-widest text-slate-500">
            USD
            <input v-model.number="pack.usd" type="number" step="0.01" class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none" />
          </label>
          <label class="mt-3 block text-xs font-black uppercase tracking-widest text-slate-500">
            COP
            <input v-model.number="pack.cop" type="number" class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none" />
          </label>
          <label class="mt-3 block text-xs font-black uppercase tracking-widest text-slate-500">
            Nota
            <input v-model="pack.note[activeLocale]" class="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none" />
          </label>
        </article>
      </div>

      <p v-if="errorMessage" class="mt-4 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
        {{ errorMessage }}
      </p>
      <p v-if="successMessage" class="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100">
        {{ successMessage }}
      </p>

      <button
        type="button"
        class="mt-5 min-h-12 rounded-2xl bg-linear-to-r from-amber-400 to-orange-500 px-6 text-sm font-black uppercase text-slate-950 shadow-lg shadow-amber-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="isSaving"
        @click="saveStore"
      >
        {{ isSaving ? 'Guardando...' : 'Guardar planes' }}
      </button>
    </template>
  </article>
</template>
