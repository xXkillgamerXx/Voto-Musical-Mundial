<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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

const pageSizeOptions = [10, 20, 50, 100]

const selectedStatus = ref('pending')
const reports = ref([])
const totalReports = ref(0)
const totalPages = ref(1)
const currentPage = ref(1)
const pageSize = ref(20)
const pendingCount = ref(0)
const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')
const busyId = ref('')
const actionTarget = ref(null)
const actionAdminNote = ref('')
const actionBlockUser = ref(false)
const actionClearBio = ref(false)
const actionBlockReason = ref('')
const actionDuration = ref(24)
const noteDrafts = ref({})

const durationOptions = [
  { value: 1, label: '1 hora' },
  { value: 24, label: '24 horas' },
  { value: 168, label: '7 días' },
  { value: 720, label: '30 días' },
  { value: 0, label: 'Permanente' },
]

const pageWindow = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const start = Math.max(1, current - 2)
  const end = Math.min(total, start + 4)
  const adjustedStart = Math.max(1, end - 4)
  return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index)
})

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const userLabel = (user, fallbackId = '') =>
  user?.displayName || user?.username || user?.email || (fallbackId ? `Usuario #${fallbackId}` : '—')

const reporterId = (report) => report.reporter?.id || report.reporterId || ''
const reportedUserId = (report) =>
  report.reportedUser?.id || report.reportedUserId || report.targetPreview?.userId || ''

const previewText = (report) => {
  if (report.targetType === 'comment') {
    if (report.targetPreview?.missing) return 'Comentario no disponible'
    if (report.targetPreview?.deleted) return `[Eliminado] ${report.targetPreview?.text || ''}`
    return report.targetPreview?.text || report.metadata?.commentText || '—'
  }

  return report.targetPreview?.bio || report.metadata?.bio || 'Perfil reportado'
}

const loadReports = async ({ page = currentPage.value, keepMessages = false } = {}) => {
  isLoading.value = true
  if (!keepMessages) {
    errorMessage.value = ''
    successMessage.value = ''
  }
  currentPage.value = Math.max(1, Number(page) || 1)

  try {
    const response = await getAdminContentReports({
      status: selectedStatus.value,
      page: currentPage.value,
      limit: pageSize.value,
    })

    reports.value = Array.isArray(response?.items) ? response.items : []
    noteDrafts.value = reports.value.reduce((drafts, report) => {
      drafts[report.id] = report.adminNote || ''
      return drafts
    }, {})
    totalReports.value = Number(response?.total ?? reports.value.length)
    totalPages.value = Math.max(1, Number(response?.totalPages || 1))
    pendingCount.value = Number(response?.pendingCount ?? 0)
    currentPage.value = Math.min(
      Math.max(1, Number(response?.page || currentPage.value)),
      totalPages.value,
    )
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudieron cargar las denuncias.'
    reports.value = []
    totalReports.value = 0
    totalPages.value = 1
  } finally {
    isLoading.value = false
  }
}

const applyFilters = () => {
  loadReports({ page: 1 })
}

const goToPage = (page) => {
  const nextPage = Math.min(Math.max(1, Number(page) || 1), totalPages.value)
  if (nextPage === currentPage.value && !isLoading.value) return
  loadReports({ page: nextPage, keepMessages: true })
}

const updateReport = async (report, status, extra = {}) => {
  busyId.value = report.id
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await updateAdminContentReport(report.id, {
      status,
      adminNote: noteDrafts.value[report.id] ?? report.adminNote ?? '',
      ...extra,
    })
    successMessage.value = 'Denuncia actualizada.'
    await loadReports({ page: currentPage.value, keepMessages: true })
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo actualizar la denuncia.'
  } finally {
    busyId.value = ''
  }
}

const openActionModal = (report) => {
  actionTarget.value = report
  actionAdminNote.value = noteDrafts.value[report.id] || report.adminNote || ''
  actionBlockUser.value = false
  actionClearBio.value = report.targetType === 'user_profile'
  actionBlockReason.value = ''
  actionDuration.value = 24
}

const closeActionModal = () => {
  if (busyId.value) return
  actionTarget.value = null
}

const confirmAction = async () => {
  if (!actionTarget.value) return
  if (actionBlockUser.value && !String(actionBlockReason.value || '').trim()) {
    errorMessage.value = 'Indica el motivo del bloqueo.'
    return
  }
  const report = actionTarget.value
  busyId.value = report.id
  errorMessage.value = ''
  try {
    await updateAdminContentReport(report.id, {
      status: 'action_taken',
      adminNote: actionAdminNote.value,
      blockUser: actionBlockUser.value,
      clearBio: actionClearBio.value,
      blockReason: actionBlockReason.value,
      durationHours: actionDuration.value,
    })
    successMessage.value = 'Acción aplicada.'
    actionTarget.value = null
    await loadReports({ page: currentPage.value, keepMessages: true })
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo aplicar la acción.'
  } finally {
    busyId.value = ''
  }
}

watch(selectedStatus, () => applyFilters())
watch(pageSize, () => applyFilters())

onMounted(() => loadReports())
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
          Revisa comentarios y perfiles reportados. Cada fila indica quién denunció y a quién denunció.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <select
          v-model="selectedStatus"
          class="min-h-12 rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition focus:border-red-300/40"
        >
          <option
            v-for="option in statusOptions"
            :key="option.value || 'all'"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
        <select
          v-model.number="pageSize"
          class="min-h-12 rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition focus:border-red-300/40"
        >
          <option v-for="size in pageSizeOptions" :key="size" :value="size">
            {{ size }} / pág.
          </option>
        </select>
        <button
          type="button"
          class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
          @click="loadReports({ page: currentPage, keepMessages: true })"
        >
          Actualizar
        </button>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-3">
      <article class="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-4">
        <p class="text-xs font-black uppercase tracking-widest text-amber-200">Pendientes (total)</p>
        <p class="mt-2 text-3xl font-black text-white">{{ pendingCount }}</p>
      </article>
      <article class="rounded-3xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs font-black uppercase tracking-widest text-slate-400">En este filtro</p>
        <p class="mt-2 text-3xl font-black text-white">{{ totalReports }}</p>
      </article>
      <article class="rounded-3xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs font-black uppercase tracking-widest text-slate-400">Página</p>
        <p class="mt-2 text-3xl font-black text-white">{{ currentPage }} / {{ totalPages }}</p>
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

            <div class="mt-4 grid gap-3 lg:grid-cols-2">
              <div class="rounded-2xl border border-cyan-300/15 bg-cyan-500/5 p-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-cyan-200/80">Denunció</p>
                <div class="mt-2 flex items-center gap-3">
                  <img
                    v-if="report.reporter?.photoUrl"
                    :src="report.reporter.photoUrl"
                    :alt="userLabel(report.reporter)"
                    class="size-10 shrink-0 rounded-full object-cover"
                  />
                  <span
                    v-else
                    class="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-black text-white"
                  >
                    {{ userLabel(report.reporter, reporterId(report)).charAt(0).toUpperCase() }}
                  </span>
                  <div class="min-w-0">
                    <a
                      v-if="reporterId(report)"
                      :href="`/admin/usuarios/${reporterId(report)}`"
                      class="block truncate text-sm font-black text-white transition hover:text-cyan-200"
                    >
                      {{ userLabel(report.reporter, reporterId(report)) }}
                    </a>
                    <p v-else class="text-sm font-black text-white">{{ userLabel(report.reporter) }}</p>
                    <p v-if="report.reporter?.email" class="truncate text-xs font-bold text-slate-400">
                      {{ report.reporter.email }}
                    </p>
                    <p v-if="reporterId(report)" class="text-[11px] font-bold text-slate-500">
                      #{{ reporterId(report) }}
                      <span v-if="report.reporter?.username"> · @{{ report.reporter.username }}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div class="rounded-2xl border border-red-300/15 bg-red-500/5 p-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-red-200/80">Denunciado</p>
                <div class="mt-2 flex items-center gap-3">
                  <img
                    v-if="report.reportedUser?.photoUrl || report.targetPreview?.photoUrl"
                    :src="report.reportedUser?.photoUrl || report.targetPreview?.photoUrl"
                    :alt="userLabel(report.reportedUser)"
                    class="size-10 shrink-0 rounded-full object-cover"
                  />
                  <span
                    v-else
                    class="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-black text-white"
                  >
                    {{ userLabel(report.reportedUser, reportedUserId(report)).charAt(0).toUpperCase() }}
                  </span>
                  <div class="min-w-0">
                    <a
                      v-if="reportedUserId(report)"
                      :href="`/admin/usuarios/${reportedUserId(report)}`"
                      class="block truncate text-sm font-black text-white transition hover:text-red-200"
                    >
                      {{ userLabel(report.reportedUser, reportedUserId(report)) }}
                    </a>
                    <p v-else class="text-sm font-black text-white">—</p>
                    <p
                      v-if="report.reportedUser?.email || report.targetPreview?.email"
                      class="truncate text-xs font-bold text-slate-400"
                    >
                      {{ report.reportedUser?.email || report.targetPreview?.email }}
                    </p>
                    <p v-if="reportedUserId(report)" class="text-[11px] font-bold text-slate-500">
                      #{{ reportedUserId(report) }}
                      <span v-if="report.reportedUser?.username || report.targetPreview?.username">
                        · @{{ report.reportedUser?.username || report.targetPreview?.username }}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
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
                <dt class="font-black uppercase tracking-widest">Fecha</dt>
                <dd class="mt-1 font-bold text-slate-200">{{ formatDate(report.createdAt) }}</dd>
              </div>
              <div v-if="report.poll?.title">
                <dt class="font-black uppercase tracking-widest">Votación</dt>
                <dd class="mt-1 font-bold text-slate-200">
                  <a
                    v-if="report.poll?.id"
                    :href="`/admin/votaciones/editar/${report.poll.id}`"
                    class="text-fuchsia-200 transition hover:text-fuchsia-100"
                  >
                    {{ report.poll.title }}
                  </a>
                  <span v-else>{{ report.poll.title }}</span>
                </dd>
              </div>
              <div v-if="report.targetType === 'comment' && report.targetId">
                <dt class="font-black uppercase tracking-widest">Comentario</dt>
                <dd class="mt-1 font-bold text-slate-200">#{{ report.targetId }}</dd>
              </div>
            </dl>

            <label class="mt-3 grid gap-2">
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">Nota interna (admin)</span>
              <textarea
                v-model="noteDrafts[report.id]"
                rows="2"
                class="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
                placeholder="Contexto para otros moderadores..."
              />
            </label>

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
              @click="openActionModal(report)"
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

    <div
      v-if="!isLoading && totalReports > 0"
      class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p class="text-sm font-bold text-slate-400">
        Página {{ currentPage }} de {{ totalPages }} · {{ totalReports }} denuncias
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="min-h-10 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
        >
          Anterior
        </button>
        <button
          v-for="page in pageWindow"
          :key="`reports-page-${page}`"
          type="button"
          class="grid size-10 place-items-center rounded-2xl text-xs font-black transition"
          :class="
            page === currentPage
              ? 'bg-linear-to-r from-red-500 to-fuchsia-500 text-white'
              : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
          "
          @click="goToPage(page)"
        >
          {{ page }}
        </button>
        <button
          type="button"
          class="min-h-10 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="currentPage >= totalPages"
          @click="goToPage(currentPage + 1)"
        >
          Siguiente
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="actionTarget"
        class="fixed inset-0 z-80 grid place-items-center bg-black/80 px-4 py-6 backdrop-blur-md"
        @click.self="closeActionModal"
      >
        <article class="w-full max-w-lg rounded-4xl border border-red-300/25 bg-[#090b19] p-6 text-white shadow-2xl">
          <h3 class="text-xl font-black">Aplicar acción</h3>
          <p class="mt-2 text-sm text-slate-400">
            {{ targetLabels[actionTarget.targetType] || actionTarget.targetType }}
            · {{ reasonLabels[actionTarget.reason] || actionTarget.reason }}
          </p>

          <div class="mt-5 space-y-4">
            <label class="grid gap-2">
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">Nota interna</span>
              <textarea
                v-model="actionAdminNote"
                rows="2"
                class="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-bold text-white outline-none"
              />
            </label>

            <label v-if="actionTarget.targetType === 'user_profile'" class="flex items-center gap-2 text-sm font-bold">
              <input v-model="actionClearBio" type="checkbox" class="size-4 rounded" />
              Limpiar bio del perfil
            </label>

            <label class="flex items-center gap-2 text-sm font-bold">
              <input v-model="actionBlockUser" type="checkbox" class="size-4 rounded" />
              Bloquear usuario denunciado
            </label>

            <template v-if="actionBlockUser">
              <label class="grid gap-2">
                <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">Motivo bloqueo</span>
                <textarea
                  v-model="actionBlockReason"
                  rows="2"
                  class="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-bold text-white outline-none"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">Duración</span>
                <select
                  v-model.number="actionDuration"
                  class="min-h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm font-bold text-white"
                >
                  <option v-for="option in durationOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>
            </template>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200"
              :disabled="Boolean(busyId)"
              @click="closeActionModal"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="min-h-11 rounded-2xl bg-red-500 px-4 text-sm font-black text-white disabled:opacity-50"
              :disabled="Boolean(busyId)"
              @click="confirmAction"
            >
              {{ busyId ? 'Aplicando...' : 'Confirmar acción' }}
            </button>
          </div>
        </article>
      </div>
    </Teleport>
  </section>
</template>
