<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  getAdminContentReports,
  thankAdminContentReporter,
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
const actionThankReporter = ref(true)
const thankTarget = ref(null)
const thankPoints = ref(10)
const thankLocale = ref('es')
const thankTitle = ref('')
const thankMessage = ref('')
const thankDrafts = ref({
  es: { title: '', message: '' },
  en: { title: '', message: '' },
})
const noteDrafts = ref({})

const pointPresets = [0, 10, 25, 50]

const durationOptions = [
  { value: 1, label: '1 hora' },
  { value: 24, label: '24 horas' },
  { value: 168, label: '7 días' },
  { value: 720, label: '30 días' },
  { value: 0, label: 'Permanente' },
]

const trustMeta = {
  nuevo: {
    label: 'Nuevo',
    hint: 'Poca historia todavía',
    classes: 'border-slate-300/20 bg-slate-500/15 text-slate-300',
  },
  confiable: {
    label: 'Confiable',
    hint: 'Reporta bien',
    classes: 'border-emerald-300/30 bg-emerald-500/15 text-emerald-200',
  },
  regular: {
    label: 'Regular',
    hint: 'Resultados mixtos',
    classes: 'border-amber-300/30 bg-amber-500/15 text-amber-200',
  },
  sospechoso: {
    label: 'Sospechoso',
    hint: 'Reporta por reportar',
    classes: 'border-red-300/30 bg-red-500/15 text-red-200',
  },
}

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

const trustOf = (report) => report.reporterTrust || { score: 50, label: 'nuevo', total: 0, actionTaken: 0, dismissed: 0, helpfulRate: null }

const resolveThanksLocale = (report) => (report?.reporterLocale === 'en' ? 'en' : 'es')

const defaultThanksTitle = (locale) =>
  locale === 'en' ? 'Thanks for your report' : 'Gracias por tu reporte'

const defaultThanksMessage = (locale, points = 0) => {
  const amount = Math.max(0, Number(points) || 0)
  if (locale === 'en') {
    return amount > 0
      ? `Thanks for reporting. Reports like yours help keep the community safer. We gave you ${amount} points for helping out.`
      : 'Thanks for reporting. Reports like yours help keep the community safer.'
  }
  return amount > 0
    ? `Gracias por reportar. Denuncias como la tuya hacen la comunidad más segura. Te dimos ${amount} puntos por colaborar.`
    : 'Gracias por reportar. Denuncias como la tuya hacen la comunidad más segura.'
}

const emptyThanksDrafts = (points = 0) => ({
  es: { title: defaultThanksTitle('es'), message: defaultThanksMessage('es', points) },
  en: { title: defaultThanksTitle('en'), message: defaultThanksMessage('en', points) },
})

const syncThankDraft = () => {
  const locale = thankLocale.value === 'en' ? 'en' : 'es'
  thankDrafts.value = {
    ...thankDrafts.value,
    [locale]: {
      title: thankTitle.value,
      message: thankMessage.value,
    },
  }
}

const applyThankDraft = (locale) => {
  const nextLocale = locale === 'en' ? 'en' : 'es'
  const draft = thankDrafts.value[nextLocale] || emptyThanksDrafts(thankPoints.value)[nextLocale]
  thankTitle.value = draft.title
  thankMessage.value = draft.message
}

const initThanksForm = (report, points = 10) => {
  const locale = resolveThanksLocale(report)
  thankPoints.value = points
  thankLocale.value = locale
  thankDrafts.value = emptyThanksDrafts(points)
  applyThankDraft(locale)
}

const setThankLocale = (locale) => {
  const nextLocale = locale === 'en' ? 'en' : 'es'
  if (nextLocale === thankLocale.value) return
  syncThankDraft()
  thankLocale.value = nextLocale
  applyThankDraft(nextLocale)
}

const restoreThankDefault = () => {
  const locale = thankLocale.value === 'en' ? 'en' : 'es'
  thankTitle.value = defaultThanksTitle(locale)
  thankMessage.value = defaultThanksMessage(locale, thankPoints.value)
  syncThankDraft()
}

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
  actionThankReporter.value = !report.thanks
  initThanksForm(report, report.thanks ? 0 : 10)
}

const closeActionModal = () => {
  if (busyId.value) return
  actionTarget.value = null
}

const openThankModal = (report) => {
  thankTarget.value = report
  initThanksForm(report, 10)
}

const closeThankModal = () => {
  if (busyId.value) return
  thankTarget.value = null
}

const sendThanks = async (report, points) => {
  syncThankDraft()
  const locale = thankLocale.value === 'en' ? 'en' : 'es'
  await thankAdminContentReporter(report.id, {
    points: Math.max(0, Math.floor(Number(points) || 0)),
    locale,
    title: thankTitle.value,
    message: thankMessage.value,
    titleEs: thankDrafts.value.es.title,
    titleEn: thankDrafts.value.en.title,
    messageEs: thankDrafts.value.es.message,
    messageEn: thankDrafts.value.en.message,
  })
}

const confirmThanks = async () => {
  if (!thankTarget.value) return
  if (!String(thankMessage.value || '').trim()) {
    restoreThankDefault()
  }
  const report = thankTarget.value
  busyId.value = report.id
  errorMessage.value = ''
  try {
    await sendThanks(report, thankPoints.value)
    successMessage.value = Number(thankPoints.value) > 0
      ? `Agradecimiento enviado (${thankPoints.value} puntos).`
      : 'Agradecimiento enviado.'
    thankTarget.value = null
    await loadReports({ page: currentPage.value, keepMessages: true })
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo enviar el agradecimiento.'
  } finally {
    busyId.value = ''
  }
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
    if (actionThankReporter.value && !report.thanks) {
      try {
        await sendThanks(report, thankPoints.value)
        successMessage.value = 'Acción aplicada y agradecimiento enviado.'
      } catch (thankError) {
        successMessage.value = 'Acción aplicada, pero no se pudo enviar el agradecimiento.'
        errorMessage.value = thankError?.message || 'No se pudo enviar el agradecimiento.'
      }
    } else {
      successMessage.value = 'Acción aplicada.'
    }
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
watch(thankPoints, (next, prev) => {
  if (prev === undefined || Number(next) === Number(prev)) return
  syncThankDraft()
  thankDrafts.value = {
    es: {
      ...thankDrafts.value.es,
      message:
        thankDrafts.value.es.message === defaultThanksMessage('es', prev)
          ? defaultThanksMessage('es', next)
          : thankDrafts.value.es.message,
    },
    en: {
      ...thankDrafts.value.en,
      message:
        thankDrafts.value.en.message === defaultThanksMessage('en', prev)
          ? defaultThanksMessage('en', next)
          : thankDrafts.value.en.message,
    },
  }
  applyThankDraft(thankLocale.value)
})

const userInitial = (user, fallbackId = '') =>
  userLabel(user, fallbackId).charAt(0).toUpperCase() || '?'

const expandedId = ref('')

const toggleExpanded = (id) => {
  expandedId.value = expandedId.value === String(id) ? '' : String(id)
}

const isExpanded = (id) => expandedId.value === String(id)

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
          Una fila por denuncia. Clic para ver el texto completo, la nota y la colaboración del denunciante.
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

    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold">
      <p class="text-amber-200">{{ pendingCount }} pendientes</p>
      <p class="text-slate-400">{{ totalReports }} en este filtro</p>
      <p class="text-slate-400">Pág. {{ currentPage }} / {{ totalPages }}</p>
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

    <div v-else class="overflow-hidden rounded-3xl border border-white/10 bg-[#090b19]">
      <div class="overflow-x-auto">
        <table class="min-w-[980px] w-full text-left">
          <thead class="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <tr>
              <th class="px-4 py-3">Fecha</th>
              <th class="px-4 py-3">Tipo</th>
              <th class="px-4 py-3">Denunció</th>
              <th class="px-4 py-3">Denunciado</th>
              <th class="px-4 py-3">Contenido</th>
              <th class="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/10">
            <template v-for="report in reports" :key="report.id">
              <tr
                class="cursor-pointer align-top text-sm text-slate-300 transition hover:bg-white/4"
                :class="isExpanded(report.id) ? 'bg-white/4' : ''"
                @click="toggleExpanded(report.id)"
              >
                <td class="whitespace-nowrap px-4 py-3 text-xs font-bold text-slate-400">
                  {{ formatDate(report.createdAt) }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex w-max flex-col items-start gap-1">
                    <span
                      class="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest"
                      :class="statusMeta[report.status]?.classes || statusMeta.pending.classes"
                    >
                      {{ statusMeta[report.status]?.label || report.status }}
                    </span>
                    <span class="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-300">
                      {{ targetLabels[report.targetType] || report.targetType }}
                    </span>
                    <span class="rounded-full border border-red-300/20 bg-red-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-red-200">
                      {{ reasonLabels[report.reason] || report.reason }}
                    </span>
                  </div>
                </td>
                <td class="max-w-52 px-4 py-3">
                  <div class="flex items-center gap-2">
                    <img
                      v-if="report.reporter?.photoUrl"
                      :src="report.reporter.photoUrl"
                      :alt="userLabel(report.reporter)"
                      class="size-8 shrink-0 rounded-full object-cover"
                    />
                    <span
                      v-else
                      class="grid size-8 shrink-0 place-items-center rounded-full bg-cyan-500/20 text-[11px] font-black text-cyan-100"
                    >
                      {{ userInitial(report.reporter, reporterId(report)) }}
                    </span>
                    <div class="min-w-0">
                      <a
                        v-if="reporterId(report)"
                        :href="`/admin/usuarios/${reporterId(report)}`"
                        class="block truncate text-sm font-black text-white hover:text-cyan-200"
                        @click.stop
                      >
                        {{ userLabel(report.reporter, reporterId(report)) }}
                      </a>
                      <p v-else class="truncate text-sm font-black text-white">
                        {{ userLabel(report.reporter) }}
                      </p>
                      <p class="truncate text-[11px] font-bold text-slate-500">
                        <span
                          class="rounded px-1 py-px uppercase"
                          :class="trustMeta[trustOf(report).label]?.classes || trustMeta.nuevo.classes"
                        >
                          {{ trustOf(report).score }}
                        </span>
                        · {{ report.reporterLocale === 'en' ? 'EN' : 'ES' }}
                        <span v-if="report.thanks"> · agr.</span>
                      </p>
                    </div>
                  </div>
                </td>
                <td class="max-w-44 px-4 py-3">
                  <div class="flex items-center gap-2">
                    <img
                      v-if="report.reportedUser?.photoUrl || report.targetPreview?.photoUrl"
                      :src="report.reportedUser?.photoUrl || report.targetPreview?.photoUrl"
                      :alt="userLabel(report.reportedUser)"
                      class="size-8 shrink-0 rounded-full object-cover"
                    />
                    <span
                      v-else
                      class="grid size-8 shrink-0 place-items-center rounded-full bg-red-500/20 text-[11px] font-black text-red-100"
                    >
                      {{ userInitial(report.reportedUser, reportedUserId(report)) }}
                    </span>
                    <a
                      v-if="reportedUserId(report)"
                      :href="`/admin/usuarios/${reportedUserId(report)}`"
                      class="truncate text-sm font-black text-white hover:text-red-200"
                      @click.stop
                    >
                      {{ userLabel(report.reportedUser, reportedUserId(report)) }}
                    </a>
                    <p v-else class="truncate text-sm font-black text-white">—</p>
                  </div>
                </td>
                <td class="max-w-sm px-4 py-3">
                  <p class="line-clamp-2 text-sm font-bold leading-5 text-slate-200">
                    {{ previewText(report) }}
                  </p>
                  <p v-if="report.poll?.title" class="mt-1 truncate text-[11px] font-bold text-fuchsia-200/80">
                    {{ report.poll.title }}
                  </p>
                </td>
                <td class="px-4 py-3" @click.stop>
                  <div class="flex flex-wrap justify-end gap-1.5">
                    <button
                      v-if="!report.thanks"
                      type="button"
                      class="min-h-8 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-2.5 text-[10px] font-black uppercase text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-50"
                      :disabled="busyId === report.id"
                      @click="openThankModal(report)"
                    >
                      Agradecer
                    </button>
                    <template v-if="report.status === 'pending'">
                      <button
                        type="button"
                        class="min-h-8 rounded-xl bg-red-500/15 px-2.5 text-[10px] font-black uppercase text-red-200 hover:bg-red-500/25 disabled:opacity-50"
                        :disabled="busyId === report.id"
                        @click="openActionModal(report)"
                      >
                        Acción
                      </button>
                      <button
                        type="button"
                        class="min-h-8 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-2.5 text-[10px] font-black uppercase text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-50"
                        :disabled="busyId === report.id"
                        @click="updateReport(report, 'reviewed')"
                      >
                        Revisada
                      </button>
                      <button
                        type="button"
                        class="min-h-8 rounded-xl border border-white/10 bg-white/5 px-2.5 text-[10px] font-black uppercase text-slate-300 hover:bg-white/10 disabled:opacity-50"
                        :disabled="busyId === report.id"
                        @click="updateReport(report, 'dismissed')"
                      >
                        Descartar
                      </button>
                    </template>
                  </div>
                </td>
              </tr>
              <tr v-if="isExpanded(report.id)" class="bg-slate-950/50">
                <td colspan="6" class="px-4 py-4">
                  <div class="grid gap-4 lg:grid-cols-[1fr_16rem]">
                    <div>
                      <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Texto reportado</p>
                      <p class="mt-2 whitespace-pre-wrap text-sm font-bold leading-6 text-slate-200">
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
                      <p
                        v-if="report.details"
                        class="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300"
                      >
                        {{ report.details }}
                      </p>
                      <p class="mt-3 text-xs font-bold text-slate-500">
                        {{ formatDate(report.createdAt) }}
                        <span v-if="report.poll?.title">
                          ·
                          <a
                            v-if="report.poll?.id"
                            :href="`/admin/votaciones/editar/${report.poll.id}`"
                            class="text-fuchsia-200 hover:text-fuchsia-100"
                          >
                            {{ report.poll.title }}
                          </a>
                          <span v-else>{{ report.poll.title }}</span>
                        </span>
                        <span v-if="report.targetType === 'comment' && report.targetId">
                          · comentario #{{ report.targetId }}
                        </span>
                      </p>
                      <label class="mt-3 grid gap-1.5">
                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">Nota interna</span>
                        <textarea
                          v-model="noteDrafts[report.id]"
                          rows="2"
                          class="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-300/40"
                          placeholder="Contexto para otros moderadores..."
                        />
                      </label>
                    </div>
                    <div class="space-y-3 text-xs">
                      <div class="rounded-xl border border-cyan-300/15 bg-cyan-500/5 p-3">
                        <p class="font-black uppercase tracking-widest text-cyan-200/80">Denunció</p>
                        <p class="mt-1 font-black text-white">{{ userLabel(report.reporter, reporterId(report)) }}</p>
                        <p v-if="report.reporter?.email" class="truncate text-slate-400">{{ report.reporter.email }}</p>
                        <p class="mt-2 font-bold text-slate-300">
                          {{ trustMeta[trustOf(report).label]?.label }} · {{ trustOf(report).score }}
                        </p>
                        <p class="text-slate-500">
                          {{ trustOf(report).actionTaken }} útiles · {{ trustOf(report).dismissed }} descartadas · {{ trustOf(report).total }} total
                          <span v-if="trustOf(report).helpfulRate !== null"> · {{ trustOf(report).helpfulRate }}%</span>
                        </p>
                        <p v-if="report.thanks" class="mt-1 font-bold text-emerald-300/80">
                          Agradecido{{ report.thanks.points > 0 ? ` · +${report.thanks.points} pts` : '' }}
                        </p>
                      </div>
                      <div class="rounded-xl border border-red-300/15 bg-red-500/5 p-3">
                        <p class="font-black uppercase tracking-widest text-red-200/80">Denunciado</p>
                        <p class="mt-1 font-black text-white">{{ userLabel(report.reportedUser, reportedUserId(report)) }}</p>
                        <p
                          v-if="report.reportedUser?.email || report.targetPreview?.email"
                          class="truncate text-slate-400"
                        >
                          {{ report.reportedUser?.email || report.targetPreview?.email }}
                        </p>
                        <p v-if="reportedUserId(report)" class="text-slate-500">
                          #{{ reportedUserId(report) }}
                        </p>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
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
        <article class="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-4xl border border-red-300/25 bg-[#090b19] p-6 text-white shadow-2xl">
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

            <label v-if="!actionTarget.thanks" class="flex items-center gap-2 text-sm font-bold">
              <input v-model="actionThankReporter" type="checkbox" class="size-4 rounded" />
              Agradecer al denunciante
            </label>

            <template v-if="!actionTarget.thanks && actionThankReporter">
              <div class="rounded-2xl border border-emerald-300/20 bg-emerald-500/5 p-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-emerald-200/80">
                  Recompensa para
                </p>
                <div class="mt-2 flex items-center gap-3">
                  <img
                    v-if="actionTarget.reporter?.photoUrl"
                    :src="actionTarget.reporter.photoUrl"
                    :alt="userLabel(actionTarget.reporter)"
                    class="size-10 shrink-0 rounded-full object-cover"
                  />
                  <span
                    v-else
                    class="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-black text-white"
                  >
                    {{ userLabel(actionTarget.reporter, reporterId(actionTarget)).charAt(0).toUpperCase() }}
                  </span>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-black text-white">
                      {{ userLabel(actionTarget.reporter, reporterId(actionTarget)) }}
                    </p>
                    <p class="truncate text-xs font-bold text-slate-400">
                      <span v-if="actionTarget.reporter?.username">@{{ actionTarget.reporter.username }}</span>
                      <span v-if="actionTarget.reporter?.email">
                        <span v-if="actionTarget.reporter?.username"> · </span>{{ actionTarget.reporter.email }}
                      </span>
                    </p>
                    <p class="mt-1 text-[11px] font-bold text-emerald-200">
                      {{ Number(thankPoints) > 0 ? `+${thankPoints} puntos` : 'Sin puntos, solo mensaje' }}
                    </p>
                  </div>
                </div>
              </div>

              <div class="flex gap-2">
                <button
                  type="button"
                  class="min-h-10 flex-1 rounded-2xl border text-xs font-black uppercase transition"
                  :class="thankLocale === 'es' ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100' : 'border-white/10 bg-white/5 text-slate-300'"
                  @click="setThankLocale('es')"
                >
                  Español
                </button>
                <button
                  type="button"
                  class="min-h-10 flex-1 rounded-2xl border text-xs font-black uppercase transition"
                  :class="thankLocale === 'en' ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100' : 'border-white/10 bg-white/5 text-slate-300'"
                  @click="setThankLocale('en')"
                >
                  English
                </button>
              </div>
              <p class="text-[11px] font-bold text-slate-500">
                Por defecto: {{ resolveThanksLocale(actionTarget) === 'en' ? 'inglés' : 'español' }}
                (idioma de la cuenta). Puedes cambiarlo y editar el texto.
              </p>

              <label class="grid gap-2">
                <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">Título</span>
                <input
                  v-model="thankTitle"
                  maxlength="120"
                  class="min-h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm font-bold text-white outline-none"
                />
              </label>
              <label class="grid gap-2">
                <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">Mensaje</span>
                <textarea
                  v-model="thankMessage"
                  rows="4"
                  maxlength="800"
                  class="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm font-bold leading-6 text-white outline-none"
                />
              </label>
              <button
                type="button"
                class="justify-self-start text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-white"
                @click="restoreThankDefault"
              >
                Restaurar texto por defecto
              </button>

              <label class="grid gap-2">
                <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">Puntos</span>
                <input
                  v-model.number="thankPoints"
                  type="number"
                  min="0"
                  max="500"
                  class="min-h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm font-bold text-white outline-none"
                />
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

      <div
        v-if="thankTarget"
        class="fixed inset-0 z-80 grid place-items-center bg-black/80 px-4 py-6 backdrop-blur-md"
        @click.self="closeThankModal"
      >
        <article class="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-4xl border border-emerald-300/25 bg-[#090b19] p-6 text-white shadow-2xl">
          <h3 class="text-xl font-black">Agradecer al denunciante</h3>
          <p class="mt-2 text-sm text-slate-400">
            Elige español o inglés, edita el mensaje y confirma a quién se le dan los puntos.
          </p>

          <div class="mt-5 space-y-4">
            <div class="rounded-2xl border border-emerald-300/20 bg-emerald-500/5 p-4">
              <p class="text-[10px] font-black uppercase tracking-widest text-emerald-200/80">
                Recompensa para
              </p>
              <div class="mt-2 flex items-center gap-3">
                <img
                  v-if="thankTarget.reporter?.photoUrl"
                  :src="thankTarget.reporter.photoUrl"
                  :alt="userLabel(thankTarget.reporter)"
                  class="size-12 shrink-0 rounded-full object-cover"
                />
                <span
                  v-else
                  class="grid size-12 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-black text-white"
                >
                  {{ userLabel(thankTarget.reporter, reporterId(thankTarget)).charAt(0).toUpperCase() }}
                </span>
                <div class="min-w-0">
                  <p class="truncate text-base font-black text-white">
                    {{ userLabel(thankTarget.reporter, reporterId(thankTarget)) }}
                  </p>
                  <p class="truncate text-xs font-bold text-slate-400">
                    <span v-if="thankTarget.reporter?.username">@{{ thankTarget.reporter.username }}</span>
                    <span v-if="thankTarget.reporter?.email">
                      <span v-if="thankTarget.reporter?.username"> · </span>{{ thankTarget.reporter.email }}
                    </span>
                    <span v-if="reporterId(thankTarget)"> · #{{ reporterId(thankTarget) }}</span>
                  </p>
                  <p class="mt-1 text-sm font-black text-emerald-200">
                    {{ Number(thankPoints) > 0 ? `+${thankPoints} puntos` : 'Sin puntos, solo mensaje' }}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Idioma del mensaje</p>
              <div class="mt-2 flex gap-2">
                <button
                  type="button"
                  class="min-h-11 flex-1 rounded-2xl border text-sm font-black uppercase transition"
                  :class="thankLocale === 'es' ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'"
                  @click="setThankLocale('es')"
                >
                  Español
                </button>
                <button
                  type="button"
                  class="min-h-11 flex-1 rounded-2xl border text-sm font-black uppercase transition"
                  :class="thankLocale === 'en' ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'"
                  @click="setThankLocale('en')"
                >
                  English
                </button>
              </div>
              <p class="mt-2 text-[11px] font-bold text-slate-500">
                Por defecto: {{ resolveThanksLocale(thankTarget) === 'en' ? 'inglés' : 'español' }}
                (idioma de la cuenta). Cada idioma tiene su texto por defecto y se puede editar.
              </p>
            </div>

            <label class="grid gap-2">
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">Título</span>
              <input
                v-model="thankTitle"
                maxlength="120"
                class="min-h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm font-bold text-white outline-none focus:border-emerald-300/40"
              />
            </label>

            <label class="grid gap-2">
              <span class="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span>Mensaje</span>
                <button
                  type="button"
                  class="text-emerald-300/80 hover:text-emerald-200"
                  @click="restoreThankDefault"
                >
                  Restaurar defecto
                </button>
              </span>
              <textarea
                v-model="thankMessage"
                rows="5"
                maxlength="800"
                class="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm font-bold leading-6 text-white outline-none focus:border-emerald-300/40"
              />
            </label>

            <label class="grid gap-2">
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">Puntos de colaboración</span>
              <input
                v-model.number="thankPoints"
                type="number"
                min="0"
                max="500"
                class="min-h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm font-bold text-white outline-none"
              />
            </label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="preset in pointPresets"
                :key="`thanks-pts-${preset}`"
                type="button"
                class="min-h-9 rounded-xl border px-3 text-xs font-black uppercase transition"
                :class="
                  Number(thankPoints) === preset
                    ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                "
                @click="thankPoints = preset"
              >
                {{ preset === 0 ? 'Sin puntos' : `+${preset}` }}
              </button>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200"
              :disabled="Boolean(busyId)"
              @click="closeThankModal"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="min-h-11 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-slate-950 disabled:opacity-50"
              :disabled="Boolean(busyId)"
              @click="confirmThanks"
            >
              {{ busyId ? 'Enviando...' : 'Enviar agradecimiento' }}
            </button>
          </div>
        </article>
      </div>
    </Teleport>
  </section>
</template>
