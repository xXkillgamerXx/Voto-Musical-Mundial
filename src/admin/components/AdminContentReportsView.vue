<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  getAdminContentReports,
  updateAdminContentReport,
} from '../../services/api/adminApi'

const statusOptions = [
  { value: '', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'reviewed', label: 'Revisadas' },
  { value: 'dismissed', label: 'Descartadas' },
  { value: 'action_taken', label: 'Acción tomada' },
]

const reasonLabels = {
  spam: 'Spam',
  offensive: 'Ofensivo',
  sexual: 'Sexual / porno',
  harassment: 'Acoso',
  other: 'Otro',
}

const targetLabels = {
  comment: 'Comentario',
  user_profile: 'Perfil',
}

const statusMeta = {
  pending: { label: 'Pendiente', classes: 'border-amber-300/30 bg-amber-500/15 text-amber-200' },
  reviewed: { label: 'Revisada', classes: 'border-cyan-300/30 bg-cyan-500/15 text-cyan-200' },
  dismissed: { label: 'Descartada', classes: 'border-slate-300/20 bg-slate-500/15 text-slate-300' },
  action_taken: { label: 'Acción tomada', classes: 'border-red-300/30 bg-red-500/15 text-red-200' },
}

const selectedStatus = ref('pending')
const reports = ref([])
const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')
const busyId = ref('')

const pendingCount = computed(() =>
  reports.value.filter((report) => report.status === 'pending').length,
)

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const reporterLabel = (report) =>
  report.reporter?.displayName
  || report.reporter?.username
  || report.reporter?.email
  || `Usuario #${report.reporterId}`

const reportedLabel = (report) =>
  report.reportedUser?.displayName
  || report.reportedUser?.username
  || (report.targetPreview?.displayName || report.targetPreview?.username)
  || '—'

const previewText = (report) => {
  if (report.targetType === 'comment') {
    if (report.targetPreview?.missing) return 'Comentario no disponible'
    if (report.targetPreview?.deleted) return `[Eliminado] ${report.targetPreview?.text || ''}`
    return report.targetPreview?.text || report.metadata?.commentText || '—'
  }

  return report.targetPreview?.bio || report.metadata?.bio || 'Perfil reportado'
}

const loadReports = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    reports.value = await getAdminContentReports(selectedStatus.value, 100)
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudieron cargar las denuncias.'
  } finally {
    isLoading.value = false
  }
}

const updateReport = async (report, status) => {
  busyId.value = report.id
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await updateAdminContentReport(report.id, { status })
    successMessage.value = 'Denuncia actualizada.'
    await loadReports()
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo actualizar la denuncia.'
  } finally {
    busyId.value = ''
  }
}

onMounted(loadReports)
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.24em] text-red-300">
          Contenido reportado
        </p>
        <h2 class="mt-2 text-3xl font-black text-white">
          Denuncias de usuarios
        </h2>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Revisa comentarios y perfiles reportados por spam, lenguaje ofensivo, contenido sexual u otros motivos.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <select
          v-model="selectedStatus"
          class="min-h-12 rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition focus:border-red-300/40"
          @change="loadReports"
        >
          <option
            v-for="option in statusOptions"
            :key="option.value || 'all'"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
        <button
          type="button"
          class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
          @click="loadReports"
        >
          Actualizar
        </button>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-3">
      <article class="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-4">
        <p class="text-xs font-black uppercase tracking-widest text-amber-200">Pendientes</p>
        <p class="mt-2 text-3xl font-black text-white">{{ pendingCount }}</p>
      </article>
      <article class="rounded-3xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
        <p class="text-xs font-black uppercase tracking-widest text-slate-400">Total cargadas</p>
        <p class="mt-2 text-3xl font-black text-white">{{ reports.length }}</p>
      </article>
    </div>

    <p
      v-if="errorMessage"
      class="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
    >
      {{ errorMessage }}
    </p>
    <p
      v-if="successMessage"
      class="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200"
    >
      {{ successMessage }}
    </p>

    <div
      v-if="isLoading"
      class="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm font-bold text-slate-400"
    >
      Cargando denuncias...
    </div>

    <div
      v-else-if="!reports.length"
      class="rounded-3xl border border-white/10 bg-white/5 p-8 text-center"
    >
      <p class="text-lg font-black text-white">No hay denuncias en este filtro</p>
      <p class="mt-2 text-sm text-slate-400">Cuando un usuario reporte contenido, aparecerá aquí.</p>
    </div>

    <div v-else class="space-y-4">
      <article
        v-for="report in reports"
        :key="report.id"
        class="rounded-3xl border border-white/10 bg-[#090b19] p-5 shadow-xl shadow-black/20"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                :class="statusMeta[report.status]?.classes || statusMeta.pending.classes"
              >
                {{ statusMeta[report.status]?.label || report.status }}
              </span>
              <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
                {{ targetLabels[report.targetType] || report.targetType }}
              </span>
              <span class="rounded-full border border-red-300/20 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-200">
                {{ reasonLabels[report.reason] || report.reason }}
              </span>
            </div>

            <p class="mt-4 text-sm font-bold leading-6 text-slate-200">
              {{ previewText(report) }}
            </p>

            <div
              v-if="report.targetPreview?.gif?.url"
              class="mt-3 max-w-xs overflow-hidden rounded-2xl border border-white/10"
            >
              <img
                :src="report.targetPreview.gif.url"
                alt="GIF reportado"
                class="max-h-40 w-full object-cover"
              />
            </div>

            <dl class="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
              <div>
                <dt class="font-black uppercase tracking-widest">Reportado por</dt>
                <dd class="mt-1 font-bold text-slate-200">{{ reporterLabel(report) }}</dd>
              </div>
              <div>
                <dt class="font-black uppercase tracking-widest">Usuario reportado</dt>
                <dd class="mt-1 font-bold text-slate-200">{{ reportedLabel(report) }}</dd>
              </div>
              <div>
                <dt class="font-black uppercase tracking-widest">Fecha</dt>
                <dd class="mt-1 font-bold text-slate-200">{{ formatDate(report.createdAt) }}</dd>
              </div>
              <div v-if="report.poll?.title">
                <dt class="font-black uppercase tracking-widest">Votación</dt>
                <dd class="mt-1 font-bold text-slate-200">{{ report.poll.title }}</dd>
              </div>
            </dl>

            <p
              v-if="report.details"
              class="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300"
            >
              {{ report.details }}
            </p>
          </div>

          <div
            v-if="report.status === 'pending'"
            class="flex shrink-0 flex-wrap gap-2 lg:w-52 lg:flex-col"
          >
            <button
              type="button"
              class="min-h-10 rounded-2xl bg-red-500/15 px-4 py-2 text-xs font-black uppercase text-red-200 transition hover:bg-red-500/25 disabled:opacity-50"
              :disabled="busyId === report.id"
              @click="updateReport(report, 'action_taken')"
            >
              Eliminar / acción
            </button>
            <button
              type="button"
              class="min-h-10 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-50"
              :disabled="busyId === report.id"
              @click="updateReport(report, 'reviewed')"
            >
              Marcar revisada
            </button>
            <button
              type="button"
              class="min-h-10 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
              :disabled="busyId === report.id"
              @click="updateReport(report, 'dismissed')"
            >
              Descartar
            </button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
