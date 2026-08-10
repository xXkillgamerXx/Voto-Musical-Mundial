<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  createAdminNotificationCampaign,
  deleteAdminNotificationCampaign,
  getAdminNotificationCampaigns,
  sendAdminNotificationCampaignNow,
  updateAdminNotificationCampaign,
} from '../../services/api/adminApi'

const campaigns = ref([])
const isLoading = ref(true)
const isSaving = ref(false)
const busyId = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const editingId = ref('')
const activeLocale = ref('es')

const localeTabs = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
]

const platformOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
  { value: 'web', label: 'Web' },
]

const unitOptions = [
  { value: 'minutes', label: 'minutos', factor: 1 },
  { value: 'hours', label: 'horas', factor: 60 },
  { value: 'days', label: 'días', factor: 1440 },
]

const emptyForm = () => ({
  title: '',
  titleEn: '',
  body: '',
  bodyEn: '',
  url: '/',
  platform: 'all',
  status: 'paused',
  intervalValue: 12,
  intervalUnit: 'hours',
  maxSends: '',
})

const form = ref(emptyForm())

const intervalMinutes = computed(() => {
  const unit = unitOptions.find((item) => item.value === form.value.intervalUnit) || unitOptions[0]
  return Math.max(5, Math.round(Number(form.value.intervalValue || 0) * unit.factor))
})

const isEditing = computed(() => Boolean(editingId.value))

const describeInterval = (minutes) => {
  const value = Number(minutes || 0)
  if (value % 1440 === 0) return `cada ${value / 1440} día(s)`
  if (value % 60 === 0) return `cada ${value / 60} hora(s)`
  return `cada ${value} minuto(s)`
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

const statusLabel = (status) => {
  if (status === 'active') return 'Activa'
  if (status === 'done') return 'Finalizada'
  return 'Pausada'
}

const statusClass = (status) => {
  if (status === 'active') return 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
  if (status === 'done') return 'border-slate-300/20 bg-slate-400/10 text-slate-200'
  return 'border-amber-300/25 bg-amber-400/10 text-amber-100'
}

const loadCampaigns = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    campaigns.value = await getAdminNotificationCampaigns()
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudieron cargar las campañas.'
  } finally {
    isLoading.value = false
  }
}

const resetForm = () => {
  form.value = emptyForm()
  editingId.value = ''
  activeLocale.value = 'es'
}

const startEdit = (campaign) => {
  const minutes = Number(campaign.intervalMinutes || 60)
  const unit = minutes % 1440 === 0 ? 'days' : minutes % 60 === 0 ? 'hours' : 'minutes'
  const factor = unitOptions.find((item) => item.value === unit)?.factor || 1

  editingId.value = String(campaign.id)
  form.value = {
    title: campaign.title || '',
    titleEn: campaign.titleEn || '',
    body: campaign.body || '',
    bodyEn: campaign.bodyEn || '',
    url: campaign.url || '/',
    platform: campaign.platform || 'all',
    status: campaign.status || 'paused',
    intervalValue: minutes / factor,
    intervalUnit: unit,
    maxSends: campaign.maxSends ?? '',
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const saveCampaign = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!form.value.title.trim() || !form.value.body.trim()) {
    errorMessage.value = 'Titulo y mensaje en español son obligatorios.'
    return
  }

  const payload = {
    title: form.value.title,
    titleEn: form.value.titleEn,
    body: form.value.body,
    bodyEn: form.value.bodyEn,
    url: form.value.url || '/',
    platform: form.value.platform,
    status: form.value.status,
    intervalMinutes: intervalMinutes.value,
    maxSends: form.value.maxSends === '' ? null : Number(form.value.maxSends),
  }

  isSaving.value = true

  try {
    if (isEditing.value) {
      await updateAdminNotificationCampaign(editingId.value, payload)
      successMessage.value = 'Campaña actualizada.'
    } else {
      await createAdminNotificationCampaign(payload)
      successMessage.value = 'Campaña creada.'
    }
    resetForm()
    await loadCampaigns()
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo guardar la campaña.'
  } finally {
    isSaving.value = false
  }
}

const runAction = async (campaign, action) => {
  errorMessage.value = ''
  successMessage.value = ''
  busyId.value = String(campaign.id)

  try {
    await action()
    await loadCampaigns()
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo completar la accion.'
  } finally {
    busyId.value = ''
  }
}

const toggleStatus = (campaign) =>
  runAction(campaign, async () => {
    const status = campaign.status === 'active' ? 'paused' : 'active'
    await updateAdminNotificationCampaign(campaign.id, { status })
    successMessage.value = status === 'active' ? 'Campaña activada.' : 'Campaña pausada.'
  })

const sendNow = (campaign) =>
  runAction(campaign, async () => {
    const result = await sendAdminNotificationCampaignNow(campaign.id)
    successMessage.value = `Enviado ahora: ${result.sent}/${result.total} tokens.`
  })

const removeCampaign = (campaign) => {
  if (!window.confirm(`¿Eliminar la campaña "${campaign.title}"?`)) return
  return runAction(campaign, async () => {
    await deleteAdminNotificationCampaign(campaign.id)
    if (editingId.value === String(campaign.id)) resetForm()
    successMessage.value = 'Campaña eliminada.'
  })
}

onMounted(loadCampaigns)
</script>

<template>
  <section class="space-y-6">
    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            Notificaciones programadas
          </p>
          <h2 class="mt-2 text-2xl font-black text-white">
            Campañas automáticas a toda la plataforma
          </h2>
          <p class="mt-1 text-sm text-slate-400">
            Cada campaña se envía sola cada X tiempo a todos los usuarios con push activo (web y app).
          </p>
        </div>
        <button
          type="button"
          class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
          @click="loadCampaigns"
        >
          Actualizar
        </button>
      </div>

      <p
        v-if="errorMessage"
        class="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
      >
        {{ errorMessage }}
      </p>
      <p
        v-if="successMessage"
        class="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200"
      >
        {{ successMessage }}
      </p>
    </article>

    <div class="grid gap-6 xl:grid-cols-[0.95fr_1fr]">
      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-lg font-black text-white">
            {{ isEditing ? 'Editar campaña' : 'Nueva campaña' }}
          </h3>
          <button
            v-if="isEditing"
            type="button"
            class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-200 transition hover:bg-white/10"
            @click="resetForm"
          >
            Cancelar
          </button>
        </div>

        <div class="mt-4 grid gap-3">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="tab in localeTabs"
              :key="tab.value"
              type="button"
              class="min-h-10 rounded-2xl px-4 text-xs font-black uppercase tracking-wide transition"
              :class="
                activeLocale === tab.value
                  ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              "
              @click="activeLocale = tab.value"
            >
              {{ tab.label }}
            </button>
          </div>

          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">
              {{ activeLocale === 'es' ? 'Titulo (ES)' : 'Title (EN)' }}
            </span>
            <input
              v-if="activeLocale === 'es'"
              v-model="form.title"
              class="min-h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
              placeholder="Vota por tu artista favorito"
            />
            <input
              v-else
              v-model="form.titleEn"
              class="min-h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
              placeholder="Vote for your favorite artist"
            />
          </label>

          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">
              {{ activeLocale === 'es' ? 'Mensaje (ES)' : 'Message (EN)' }}
            </span>
            <textarea
              v-if="activeLocale === 'es'"
              v-model="form.body"
              rows="4"
              class="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
              placeholder="Texto que vera el usuario"
            ></textarea>
            <textarea
              v-else
              v-model="form.bodyEn"
              rows="4"
              class="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
              placeholder="Text the user will see"
            ></textarea>
          </label>

          <label class="grid gap-2">
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">Link al abrir</span>
            <input
              v-model="form.url"
              class="min-h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/50"
              placeholder="/votaciones"
            />
          </label>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="grid gap-2">
              <span class="text-xs font-black uppercase tracking-widest text-slate-400">Enviar cada</span>
              <div class="flex gap-2">
                <input
                  v-model="form.intervalValue"
                  type="number"
                  min="1"
                  class="min-h-12 w-24 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm font-bold text-white outline-none transition focus:border-cyan-300/50"
                />
                <select
                  v-model="form.intervalUnit"
                  class="min-h-12 flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm font-bold text-white outline-none transition focus:border-cyan-300/50"
                >
                  <option v-for="unit in unitOptions" :key="unit.value" :value="unit.value">
                    {{ unit.label }}
                  </option>
                </select>
              </div>
              <span class="text-[11px] font-bold text-slate-500">Mínimo 5 minutos ({{ intervalMinutes }} min).</span>
            </label>

            <label class="grid gap-2">
              <span class="text-xs font-black uppercase tracking-widest text-slate-400">Plataforma</span>
              <select
                v-model="form.platform"
                class="min-h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm font-bold text-white outline-none transition focus:border-cyan-300/50"
              >
                <option v-for="option in platformOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="grid gap-2">
              <span class="text-xs font-black uppercase tracking-widest text-slate-400">Máximo de envíos</span>
              <input
                v-model="form.maxSends"
                type="number"
                min="1"
                class="min-h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm font-bold text-white outline-none transition focus:border-cyan-300/50"
                placeholder="Vacío = sin límite"
              />
            </label>

            <label class="grid gap-2">
              <span class="text-xs font-black uppercase tracking-widest text-slate-400">Estado</span>
              <select
                v-model="form.status"
                class="min-h-12 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm font-bold text-white outline-none transition focus:border-cyan-300/50"
              >
                <option value="paused">Pausada</option>
                <option value="active">Activa</option>
              </select>
            </label>
          </div>

          <p class="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-xs font-bold text-slate-400">
            Al activarla, el primer envío ocurre dentro de {{ describeInterval(intervalMinutes).replace('cada ', '') }}.
            Usa "Enviar ahora" si quieres dispararla de inmediato.
          </p>

          <button
            type="button"
            class="min-h-12 rounded-full bg-linear-to-r from-fuchsia-500 to-cyan-400 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isSaving"
            @click="saveCampaign"
          >
            {{ isSaving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear campaña' }}
          </button>
        </div>
      </article>

      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <h3 class="text-lg font-black text-white">Lista de notificaciones</h3>
        <p class="mt-1 text-sm text-slate-400">
          {{ campaigns.length }} campaña(s) configurada(s).
        </p>

        <div v-if="isLoading" class="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-300">
          Cargando campañas...
        </div>

        <div v-else class="mt-5 space-y-3">
          <div
            v-for="campaign in campaigns"
            :key="campaign.id"
            class="rounded-2xl border border-white/10 bg-slate-950/45 p-4"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-black text-white">{{ campaign.title }}</p>
                <p class="mt-1 line-clamp-2 text-xs text-slate-400">{{ campaign.body }}</p>
              </div>
              <span
                class="rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wide"
                :class="statusClass(campaign.status)"
              >
                {{ statusLabel(campaign.status) }}
              </span>
            </div>

            <div class="mt-3 grid gap-1 text-[11px] font-bold text-slate-400 sm:grid-cols-2">
              <p>Frecuencia: {{ describeInterval(campaign.intervalMinutes) }}</p>
              <p>Plataforma: {{ campaign.platform }}</p>
              <p>Próximo envío: {{ formatDate(campaign.nextRunAt) }}</p>
              <p>Último envío: {{ formatDate(campaign.lastSentAt) }}</p>
              <p>
                Enviados: {{ campaign.sentCount }}<span v-if="campaign.maxSends"> / {{ campaign.maxSends }}</span>
              </p>
              <p v-if="campaign.lastResult?.sent !== undefined">
                Último resultado: {{ campaign.lastResult.sent }}/{{ campaign.lastResult.total }} tokens
              </p>
              <p v-else-if="campaign.lastResult?.reason === 'no_tokens'" class="text-amber-200">
                Último resultado: sin tokens disponibles
              </p>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                :disabled="busyId === String(campaign.id) || campaign.status === 'done'"
                @click="toggleStatus(campaign)"
              >
                {{ campaign.status === 'active' ? 'Pausar' : 'Activar' }}
              </button>
              <button
                type="button"
                class="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-50"
                :disabled="busyId === String(campaign.id)"
                @click="sendNow(campaign)"
              >
                Enviar ahora
              </button>
              <button
                type="button"
                class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black text-slate-200 transition hover:bg-white/10"
                @click="startEdit(campaign)"
              >
                Editar
              </button>
              <button
                type="button"
                class="rounded-full border border-red-300/20 bg-red-500/10 px-3 py-1.5 text-xs font-black text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
                :disabled="busyId === String(campaign.id)"
                @click="removeCampaign(campaign)"
              >
                Eliminar
              </button>
            </div>
          </div>

          <div v-if="!campaigns.length" class="rounded-2xl border border-white/10 px-4 py-6 text-sm font-bold text-slate-400">
            Todavía no hay campañas. Crea la primera con el formulario de la izquierda.
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
