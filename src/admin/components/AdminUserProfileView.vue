<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { translate } from '../../i18n'
import {
  blockModerationUser,
  deleteAdminUserComment,
  dismissModerationAlert,
  getAdminUserActivity,
  getAdminUserActivityDays,
  getAdminUserAlerts,
  getAdminUserComments,
  getAdminUserProfile,
  unblockModerationUser,
} from '../../services/api/adminApi'
import AdminBlockUserModal from './AdminBlockUserModal.vue'

const props = defineProps({
  userId: {
    type: String,
    required: true,
  },
})

const profile = ref(null)
const activity = ref([])
const calendar = ref(null)
const alerts = ref([])
const comments = ref([])
const commentsPage = ref(1)
const commentsTotalPages = ref(1)
const isLoadingMoreComments = ref(false)
const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')
const typeFilter = ref('')
const dismissingAlertId = ref('')
const showBlockModal = ref(false)
const isBlocking = ref(false)
const isUpdatingStatus = ref(false)
const deletingCommentId = ref('')

const EVENT_TYPES = [
  { value: '', label: 'Todo' },
  { value: 'vote', label: 'Votos' },
  { value: 'comment', label: 'Comentarios' },
  { value: 'daily_reward', label: 'Recompensas' },
  { value: 'mission', label: 'Misiones' },
  { value: 'referral', label: 'Referidos' },
  { value: 'follow', label: 'Seguidos' },
  { value: 'report', label: 'Denuncias' },
  { value: 'notification', label: 'Notificaciones' },
]

const EVENT_STYLES = {
  vote: { icon: 'fa-bolt', tone: 'text-amber-200 border-amber-300/25 bg-amber-400/10' },
  comment: { icon: 'fa-comment', tone: 'text-cyan-200 border-cyan-300/25 bg-cyan-400/10' },
  daily_reward: { icon: 'fa-gift', tone: 'text-emerald-200 border-emerald-300/25 bg-emerald-400/10' },
  mission: { icon: 'fa-flag-checkered', tone: 'text-violet-200 border-violet-300/25 bg-violet-400/10' },
  referral: { icon: 'fa-user-plus', tone: 'text-fuchsia-200 border-fuchsia-300/25 bg-fuchsia-400/10' },
  follow: { icon: 'fa-heart', tone: 'text-rose-200 border-rose-300/25 bg-rose-400/10' },
  report: { icon: 'fa-flag', tone: 'text-red-200 border-red-300/25 bg-red-500/10' },
  notification: { icon: 'fa-bell', tone: 'text-slate-200 border-white/10 bg-white/5' },
  signup: { icon: 'fa-star', tone: 'text-sky-200 border-sky-300/25 bg-sky-400/10' },
}

const ALERT_TYPE_LABELS = {
  comment_promo: 'Promo / red social',
  comment_diversion: 'Sacar votos afuera',
  comment_external_link: 'Enlace externo',
  spawn_signup: 'Spawn (cuentas por IP)',
}

const styleFor = (type) => EVENT_STYLES[type] || EVENT_STYLES.notification

const filteredActivity = computed(() =>
  typeFilter.value ? activity.value.filter((event) => event.type === typeFilter.value) : activity.value,
)

const userName = computed(
  () =>
    profile.value?.user?.displayName ||
    profile.value?.user?.username ||
    profile.value?.user?.email ||
    translate('admin.users.fallbackUser'),
)

const presenceLabel = computed(() => {
  const stats = profile.value?.stats
  if (!stats) return ''
  if (stats.seenToday) return 'Activo hoy'
  if (stats.seenYesterday) return 'Activo ayer'
  if (!profile.value?.user?.lastSeenAt) return 'Sin actividad registrada'
  return `Última vez ${formatDate(profile.value.user.lastSeenAt)}`
})

const alertByCommentId = computed(() => {
  const map = new Map()
  for (const alert of alerts.value) {
    if (alert.commentId) {
      map.set(String(alert.commentId), alert)
    }
  }
  return map
})

const openAlerts = computed(() => alerts.value.filter((alert) => alert.status === 'open'))

const calendarWeeks = computed(() => {
  const series = calendar.value?.series || []
  const weeks = []
  for (let i = 0; i < series.length; i += 7) {
    weeks.push(series.slice(i, i + 7))
  }
  return weeks
})

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es')
}

function reporterTrustLabel(label) {
  if (label === 'confiable') return 'Confiable'
  if (label === 'regular') return 'Regular'
  if (label === 'sospechoso') return 'Sospechoso'
  return 'Nuevo'
}

const formatNumber = (value) => Number(value || 0).toLocaleString('es')

const cellTone = (entry) => {
  if (!entry.active) return 'bg-white/5'
  if (entry.hits >= 12) return 'bg-emerald-300'
  if (entry.hits >= 5) return 'bg-emerald-400/80'
  if (entry.hits >= 2) return 'bg-emerald-500/60'
  return 'bg-emerald-600/45'
}

const formatBlockExpiry = () => {
  const block = profile.value?.accountBlock
  if (!block?.blocked) return ''
  if (block.permanent || !block.expiresAt) return 'Bloqueo permanente'
  return `Hasta ${formatDate(block.expiresAt)}`
}

const loadComments = async (id, page = 1, append = false) => {
  const data = await getAdminUserComments(id, 50, page)
  const items = Array.isArray(data?.items) ? data.items : []
  comments.value = append ? [...comments.value, ...items] : items
  commentsPage.value = Number(data?.page || page)
  commentsTotalPages.value = Math.max(1, Number(data?.totalPages || 1))
}

const loadMoreComments = async () => {
  if (commentsPage.value >= commentsTotalPages.value || isLoadingMoreComments.value) return
  isLoadingMoreComments.value = true
  try {
    await loadComments(props.userId, commentsPage.value + 1, true)
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudieron cargar más comentarios.'
  } finally {
    isLoadingMoreComments.value = false
  }
}

const deleteComment = async (comment) => {
  if (!comment?.id || comment.deletedAt) return
  if (!window.confirm('¿Eliminar este comentario?')) return
  deletingCommentId.value = comment.id
  errorMessage.value = ''
  try {
    await deleteAdminUserComment(props.userId, comment.id)
    comment.deletedAt = new Date().toISOString()
    successMessage.value = 'Comentario eliminado.'
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo eliminar el comentario.'
  } finally {
    deletingCommentId.value = ''
  }
}

const unblockAccount = async () => {
  isUpdatingStatus.value = true
  errorMessage.value = ''
  try {
    await unblockModerationUser(props.userId)
    profile.value.accountStatus = 'active'
    profile.value.accountBlock = null
    successMessage.value = 'Usuario desbloqueado.'
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo desbloquear.'
  } finally {
    isUpdatingStatus.value = false
  }
}

const confirmBlockUser = async ({ reason, durationHours }) => {
  isBlocking.value = true
  errorMessage.value = ''
  try {
    const result = await blockModerationUser(props.userId, reason, durationHours)
    profile.value.accountStatus = 'blocked'
    profile.value.accountBlock = {
      blocked: true,
      reason,
      expiresAt: result?.expiresAt || null,
      permanent: Boolean(result?.permanent),
    }
    showBlockModal.value = false
    successMessage.value = 'Usuario bloqueado.'
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo bloquear.'
  } finally {
    isBlocking.value = false
  }
}

const dismissAlert = async (alertId) => {
  dismissingAlertId.value = alertId
  try {
    await dismissModerationAlert(alertId)
    alerts.value = alerts.value.map((alert) =>
      alert.id === alertId ? { ...alert, status: 'dismissed' } : alert,
    )
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo descartar la alerta.'
  } finally {
    dismissingAlertId.value = ''
  }
}

const load = async (id) => {
  if (!id) return
  isLoading.value = true
  errorMessage.value = ''
  try {
    const [profileData, activityData, daysData, alertsData] = await Promise.all([
      getAdminUserProfile(id),
      getAdminUserActivity(id, 150),
      getAdminUserActivityDays(id, 91),
      getAdminUserAlerts(id, 80),
    ])
    profile.value = profileData
    activity.value = Array.isArray(activityData?.items) ? activityData.items : []
    calendar.value = daysData
    alerts.value = Array.isArray(alertsData) ? alertsData : []
    commentsPage.value = 1
    await loadComments(id, 1, false)
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo cargar el perfil del usuario.'
    profile.value = null
    activity.value = []
    calendar.value = null
    alerts.value = []
    comments.value = []
  } finally {
    isLoading.value = false
  }
}

onMounted(() => load(props.userId))

watch(
  () => props.userId,
  (id) => {
    typeFilter.value = ''
    load(id)
  },
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <a
        href="/admin/usuarios"
        class="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
      >
        <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
        Volver a usuarios
      </a>
      <a
        href="/admin/reportes"
        class="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-amber-300/25 bg-amber-500/10 px-4 text-xs font-black uppercase tracking-wide text-amber-100 transition hover:bg-amber-500/20"
      >
        <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
        Reportes
      </a>
      <a
        href="/admin/denuncias"
        class="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 text-xs font-black uppercase tracking-wide text-red-100 transition hover:bg-red-500/20"
      >
        Denuncias
      </a>
    </div>

    <p v-if="successMessage" class="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200">
      {{ successMessage }}
    </p>

    <p v-if="isLoading" class="rounded-3xl border border-white/10 bg-white/4 p-6 text-sm font-bold text-slate-300">
      Cargando perfil...
    </p>
    <p
      v-else-if="errorMessage"
      class="rounded-3xl border border-red-300/25 bg-red-500/10 p-6 text-sm font-bold text-red-100"
    >
      {{ errorMessage }}
    </p>

    <template v-else-if="profile">
      <header class="rounded-3xl border border-white/10 bg-white/4 p-6">
        <div class="flex flex-wrap items-start gap-5">
          <img
            v-if="profile.user.photoUrl"
            :src="profile.user.photoUrl"
            :alt="userName"
            class="size-20 shrink-0 rounded-full object-cover ring-2 ring-fuchsia-300/30"
          />
          <span
            v-else
            class="grid size-20 shrink-0 place-items-center rounded-full bg-white/10 text-2xl font-black text-white ring-2 ring-white/10"
          >
            {{ userName.charAt(0).toUpperCase() }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">Perfil de usuario</p>
            <h2 class="mt-1 truncate text-3xl font-black text-white">{{ userName }}</h2>
            <p class="mt-1 text-sm font-bold text-slate-400">
              #{{ profile.user.id }}
              <span v-if="profile.user.email"> · {{ profile.user.email }}</span>
              <span v-if="profile.user.username"> · @{{ profile.user.username }}</span>
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <span
                class="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                :class="
                  profile.accountStatus === 'blocked'
                    ? 'border-red-300/30 bg-red-500/10 text-red-100'
                    : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
                "
              >
                {{ profile.accountStatus === 'blocked' ? 'Bloqueado' : 'Activo' }}
              </span>
              <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
                {{ profile.user.role || 'user' }}
              </span>
              <span
                class="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                :class="
                  profile.stats.seenToday
                    ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
                    : 'border-white/10 bg-white/5 text-slate-300'
                "
              >
                {{ presenceLabel }}
              </span>
            </div>
            <p
              v-if="profile.accountStatus === 'blocked' && profile.accountBlock?.reason"
              class="mt-3 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100"
            >
              {{ profile.accountBlock.reason }}
              <span v-if="formatBlockExpiry()" class="block text-xs text-red-200/80">{{ formatBlockExpiry() }}</span>
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              <button
                v-if="profile.accountStatus === 'blocked'"
                type="button"
                class="min-h-10 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 text-xs font-black uppercase text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
                :disabled="isUpdatingStatus"
                @click="unblockAccount"
              >
                {{ isUpdatingStatus ? '...' : 'Desbloquear' }}
              </button>
              <button
                v-else
                type="button"
                class="min-h-10 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 text-xs font-black uppercase text-red-100 transition hover:bg-red-500/20"
                @click="showBlockModal = true"
              >
                Bloquear usuario
              </button>
            </div>
          </div>
        </div>
      </header>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div class="rounded-2xl border border-white/10 bg-white/4 p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Votos emitidos</p>
          <p class="mt-1 text-2xl font-black">{{ formatNumber(profile.stats.votes) }}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-white/4 p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Comentarios</p>
          <p class="mt-1 text-2xl font-black">{{ formatNumber(profile.stats.comments) }}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-white/4 p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Puntos</p>
          <p class="mt-1 text-2xl font-black">{{ formatNumber(profile.user.points) }}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-white/4 p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Referidos</p>
          <p class="mt-1 text-2xl font-black">{{ formatNumber(profile.stats.referrals) }}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-white/4 p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Días activos</p>
          <p class="mt-1 text-2xl font-black">{{ formatNumber(profile.stats.activeDays) }}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-white/4 p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Misiones</p>
          <p class="mt-1 text-2xl font-black">{{ formatNumber(profile.stats.missionsCompleted) }}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-white/4 p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Denuncias recibidas</p>
          <p class="mt-1 text-2xl font-black">{{ formatNumber(profile.stats.reportsReceived) }}</p>
        </div>
        <div class="rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-cyan-200/80">Denuncias enviadas</p>
          <p class="mt-1 text-2xl font-black text-cyan-100">{{ formatNumber(profile.stats.reportsSent) }}</p>
          <p v-if="profile.stats.reporterTrust" class="mt-1 text-[11px] font-bold text-slate-400">
            Colaboración {{ profile.stats.reporterTrust.score }}
            · {{ reporterTrustLabel(profile.stats.reporterTrust.label) }}
          </p>
        </div>
        <div class="rounded-2xl border border-amber-300/20 bg-amber-500/5 p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-amber-200/80">Alertas abiertas</p>
          <p class="mt-1 text-2xl font-black text-amber-100">{{ formatNumber(openAlerts.length) }}</p>
        </div>
      </div>

      <section class="rounded-3xl border border-amber-300/20 bg-amber-500/5 p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-sm font-black uppercase tracking-widest text-amber-200">Alertas de moderación</h3>
          <span class="text-xs font-bold text-slate-400">{{ alerts.length }} en total</span>
        </div>
        <p v-if="!alerts.length" class="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-5 text-sm font-bold text-slate-400">
          Sin alertas para este usuario.
        </p>
        <div v-else class="mt-4 space-y-3">
          <article
            v-for="alert in alerts"
            :key="alert.id"
            class="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-4"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-amber-100">
                    {{ ALERT_TYPE_LABELS[alert.type] || alert.type }}
                  </span>
                  <span
                    class="rounded-full border px-2 py-0.5 text-[10px] font-black uppercase"
                    :class="
                      alert.status === 'open'
                        ? 'border-amber-300/30 bg-amber-500/15 text-amber-100'
                        : 'border-white/10 bg-white/5 text-slate-400'
                    "
                  >
                    {{ alert.status === 'open' ? 'Abierta' : 'Descartada' }}
                  </span>
                  <span class="text-[11px] font-bold text-slate-500">{{ formatDate(alert.at) }}</span>
                </div>
                <p class="mt-2 text-sm font-bold text-slate-200">{{ alert.reason }}</p>
                <p v-if="alert.sample" class="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-slate-300">
                  «{{ alert.sample }}»
                </p>
                <p v-if="alert.signals?.length" class="mt-2 text-[11px] font-bold text-slate-500">
                  Señales: {{ alert.signals.join(', ') }}
                </p>
              </div>
              <button
                v-if="alert.status === 'open'"
                type="button"
                class="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                :disabled="dismissingAlertId === alert.id"
                @click="dismissAlert(alert.id)"
              >
                {{ dismissingAlertId === alert.id ? '...' : 'Descartar' }}
              </button>
            </div>
          </article>
        </div>
      </section>

      <section class="rounded-3xl border border-white/10 bg-white/4 p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-sm font-black uppercase tracking-widest text-slate-300">Comentarios</h3>
          <span class="text-xs font-bold text-slate-400">{{ comments.length }} mostrados</span>
        </div>
        <p v-if="!comments.length" class="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-5 text-sm font-bold text-slate-400">
          Este usuario no ha comentado.
        </p>
        <div v-else class="mt-4 space-y-3">
          <article
            v-for="comment in comments"
            :key="comment.id"
            class="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-4"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-[11px] font-bold text-slate-500">{{ formatDate(comment.createdAt) }}</span>
              <a
                v-if="comment.pollId"
                :href="`/admin/votaciones/editar/${comment.pollId}`"
                class="truncate text-xs font-black text-fuchsia-200 transition hover:text-fuchsia-100"
              >
                {{ comment.pollTitle || `Votación #${comment.pollId}` }}
              </a>
              <span v-else-if="comment.pollTitle" class="truncate text-xs font-black text-fuchsia-200">
                {{ comment.pollTitle }}
              </span>
              <span
                v-if="comment.deletedAt"
                class="rounded-full border border-red-300/25 bg-red-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-red-100"
              >
                Borrado
              </span>
              <span
                v-if="alertByCommentId.has(comment.id)"
                class="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-amber-100"
              >
                {{ ALERT_TYPE_LABELS[alertByCommentId.get(comment.id)?.type] || 'Alerta' }}
              </span>
            </div>
            <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p class="min-w-0 flex-1 whitespace-pre-wrap text-sm font-bold text-white">{{ comment.text }}</p>
              <button
                v-if="!comment.deletedAt"
                type="button"
                class="shrink-0 rounded-2xl border border-red-300/25 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
                :disabled="deletingCommentId === comment.id"
                @click="deleteComment(comment)"
              >
                {{ deletingCommentId === comment.id ? '...' : 'Eliminar' }}
              </button>
            </div>
          </article>
        </div>
        <button
          v-if="commentsPage < commentsTotalPages"
          type="button"
          class="mt-4 min-h-10 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          :disabled="isLoadingMoreComments"
          @click="loadMoreComments"
        >
          {{ isLoadingMoreComments ? 'Cargando...' : 'Cargar más comentarios' }}
        </button>
      </section>

      <section v-if="calendar" class="rounded-3xl border border-white/10 bg-white/4 p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="text-sm font-black uppercase tracking-widest text-slate-300">
            Conexiones de los últimos {{ calendar.days }} días
          </h3>
          <p class="text-xs font-bold text-slate-400">
            {{ calendar.activeDays }} días activos ({{ calendar.rate }}%) · racha {{ calendar.currentStreak }}
          </p>
        </div>
        <div class="mt-4 flex gap-1 overflow-x-auto pb-1">
          <div v-for="(week, weekIndex) in calendarWeeks" :key="`week-${weekIndex}`" class="grid shrink-0 gap-1">
            <span
              v-for="entry in week"
              :key="entry.day"
              class="size-4 rounded-[4px]"
              :class="cellTone(entry)"
              :title="`${entry.day}: ${entry.active ? `${entry.hits} sesiones` : 'sin actividad'}`"
            ></span>
          </div>
        </div>
      </section>

      <section v-if="profile.devices?.length" class="rounded-3xl border border-white/10 bg-white/4 p-6">
        <h3 class="text-sm font-black uppercase tracking-widest text-slate-300">Dispositivos</h3>
        <div class="mt-4 space-y-2">
          <div
            v-for="device in profile.devices"
            :key="device.id"
            class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3"
          >
            <span class="text-sm font-black capitalize">{{ device.platform }}</span>
            <span class="min-w-0 flex-1 truncate text-xs font-bold text-slate-500">
              {{ device.userAgent || 'Sin user agent' }}
            </span>
            <span class="text-xs font-bold text-slate-400">{{ formatDate(device.updatedAt) }}</span>
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-white/10 bg-white/4 p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-sm font-black uppercase tracking-widest text-slate-300">Historial de actividad</h3>
          <select
            v-model="typeFilter"
            class="min-h-10 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm font-bold text-white outline-none focus:border-fuchsia-300/50"
          >
            <option v-for="option in EVENT_TYPES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
        <p
          v-if="!filteredActivity.length"
          class="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-5 text-sm font-bold text-slate-400"
        >
          No hay acciones registradas para este filtro.
        </p>
        <ol v-else class="mt-4 space-y-2">
          <li
            v-for="event in filteredActivity"
            :key="event.id"
            class="flex gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3"
          >
            <span
              class="grid size-9 shrink-0 place-items-center rounded-xl border text-sm"
              :class="styleFor(event.type).tone"
            >
              <i class="fa-solid" :class="styleFor(event.type).icon" aria-hidden="true"></i>
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-baseline justify-between gap-2">
                <span class="text-sm font-black text-white">{{ event.title }}</span>
                <span class="text-[11px] font-bold text-slate-500">{{ formatDate(event.at) }}</span>
              </span>
              <span v-if="event.detail" class="mt-1 block text-xs font-bold text-slate-400">{{ event.detail }}</span>
            </span>
            <span
              v-if="event.points"
              class="shrink-0 self-center text-xs font-black"
              :class="event.points > 0 ? 'text-emerald-300' : 'text-amber-300'"
            >
              {{ event.points > 0 ? '+' : '' }}{{ formatNumber(event.points) }}
            </span>
          </li>
        </ol>
      </section>
    </template>

    <AdminBlockUserModal
      :open="showBlockModal"
      :user-label="userName"
      :is-submitting="isBlocking"
      @close="showBlockModal = false"
      @confirm="confirmBlockUser"
    />
  </div>
</template>
