<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  blockModerationIp,
  blockModerationUser,
  dismissModerationAlert,
  getModerationAlerts,
  getModerationBlocks,
  getModerationIpActivity,
  getModerationOverview,
  getModerationRecentVotes,
  unblockModerationIp,
  unblockModerationUser,
} from '../../services/api/adminApi'
import AdminBlockUserModal from './AdminBlockUserModal.vue'

const windowOptions = [
  { value: 1, label: 'Ultima hora' },
  { value: 24, label: 'Ultimas 24h' },
  { value: 72, label: 'Ultimos 3 dias' },
  { value: 168, label: 'Ultimos 7 dias' },
]

const alertStatusOptions = [
  { value: '', label: 'Todas' },
  { value: 'open', label: 'Abiertas' },
  { value: 'dismissed', label: 'Revisadas' },
]

const alertTypeOptions = [
  { value: '', label: 'Todos los tipos' },
  { value: 'comment_promo', label: 'Promo' },
  { value: 'comment_diversion', label: 'Diversion' },
  { value: 'spawn_signup', label: 'Spawn' },
]

const selectedHours = ref(24)
const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')
const busyKey = ref('')

const overview = ref(null)
const ipActivity = ref([])
const recentVotes = ref([])
const blocks = ref({ ips: [], users: [] })
const alerts = ref([])
const mainTab = ref('alerts')
const expandedIpHash = ref('')
const alertPage = ref(1)
const alertPageSize = ref(20)
const alertTotal = ref(0)
const alertTotalPages = ref(1)
const alertStatusFilter = ref('open')
const alertTypeFilter = ref('')

const blockTarget = ref(null)
const isBlocking = ref(false)

const alertTypeLabels = {
  comment_promo: 'Promo / red social',
  comment_diversion: 'Sacar votos afuera',
  comment_external_link: 'Enlace externo',
  spawn_signup: 'Spawn (cuentas por IP)',
}

const riskMeta = {
  high: { label: 'Alto', classes: 'border-red-300/30 bg-red-500/15 text-red-200' },
  medium: { label: 'Medio', classes: 'border-amber-300/30 bg-amber-500/15 text-amber-200' },
  low: { label: 'Bajo', classes: 'border-emerald-300/30 bg-emerald-500/15 text-emerald-200' },
}

const overviewCards = computed(() => {
  const data = overview.value
  if (!data) return []
  return [
    { label: 'Votos en ventana', value: formatNumber(data.votesInWindow), icon: 'fa-solid fa-bolt', tone: 'text-cyan-200' },
    { label: 'IPs unicas', value: formatNumber(data.distinctIps), icon: 'fa-solid fa-network-wired', tone: 'text-fuchsia-200' },
    { label: 'Anonimos unicos', value: formatNumber(data.distinctAnon), icon: 'fa-solid fa-user-secret', tone: 'text-violet-200' },
    { label: 'Usuarios unicos', value: formatNumber(data.distinctUsers), icon: 'fa-solid fa-users', tone: 'text-sky-200' },
    { label: 'IPs bloqueadas', value: formatNumber(data.blockedIps), icon: 'fa-solid fa-ban', tone: 'text-red-200' },
    { label: 'Usuarios bloqueados', value: formatNumber(data.blockedUsers), icon: 'fa-solid fa-user-slash', tone: 'text-red-200' },
    { label: 'Alertas abiertas', value: formatNumber(data.openAlerts), icon: 'fa-solid fa-triangle-exclamation', tone: 'text-amber-200' },
  ]
})

const formatNumber = (value) => Number(value || 0).toLocaleString('es')

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const signalLabel = (signal) => {
  const value = String(signal || '')
  const spawnMatch = value.match(/^spawn:ip_accounts:(\d+)$/)
  if (spawnMatch) return `${spawnMatch[1]} cuentas desde la misma IP`
  if (value.startsWith('promo_')) return value.replace(/^[^:]+:/, 'Promo · ')
  if (value.startsWith('divert_')) return value.replace(/^[^:]+:/, 'Desvío · ')
  return value
}

const accountLabel = (account) =>
  account?.name || account?.displayName || account?.username || account?.email || (account?.id ? `#${account.id}` : '—')

const alertPageWindow = computed(() => {
  const total = alertTotalPages.value
  const current = alertPage.value
  const start = Math.max(1, current - 2)
  const end = Math.min(total, start + 4)
  const adjustedStart = Math.max(1, end - 4)
  return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index)
})

const loadAlerts = async () => {
  const data = await getModerationAlerts({
    limit: alertPageSize.value,
    page: alertPage.value,
    status: alertStatusFilter.value,
    type: alertTypeFilter.value,
  })
  alerts.value = data?.items || []
  alertTotal.value = Number(data?.total ?? alerts.value.length)
  alertTotalPages.value = Math.max(1, Number(data?.totalPages || 1))
  alertPage.value = Math.min(Math.max(1, Number(data?.page || alertPage.value)), alertTotalPages.value)
}

const loadAll = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const [overviewData, ipData, recentData, blocksData] = await Promise.all([
      getModerationOverview(selectedHours.value),
      getModerationIpActivity(selectedHours.value, 50),
      getModerationRecentVotes(80),
      getModerationBlocks(),
    ])
    overview.value = overviewData
    ipActivity.value = ipData?.items || []
    recentVotes.value = recentData || []
    blocks.value = { ips: blocksData?.ips || [], users: blocksData?.users || [] }
    await loadAlerts()
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo cargar el panel de moderacion.'
  } finally {
    isLoading.value = false
  }
}

const changeWindow = (hours) => {
  if (selectedHours.value === hours) return
  selectedHours.value = hours
  loadAll()
}

const flashSuccess = (message) => {
  successMessage.value = message
  window.setTimeout(() => {
    if (successMessage.value === message) successMessage.value = ''
  }, 4000)
}

const blockIp = async (row) => {
  busyKey.value = `ip:${row.ipHash}`
  errorMessage.value = ''
  try {
    await blockModerationIp(row.ipHash, `Bloqueo desde reportes (riesgo ${row.risk})`)
    row.blocked = true
    flashSuccess('IP bloqueada. No podra votar mas.')
    await refreshBlocks()
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo bloquear la IP.'
  } finally {
    busyKey.value = ''
  }
}

const unblockIp = async (ipHash) => {
  busyKey.value = `ip:${ipHash}`
  errorMessage.value = ''
  try {
    await unblockModerationIp(ipHash)
    ipActivity.value.forEach((row) => {
      if (row.ipHash === ipHash) row.blocked = false
    })
    flashSuccess('IP desbloqueada.')
    await refreshBlocks()
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo desbloquear la IP.'
  } finally {
    busyKey.value = ''
  }
}

const openBlockModal = (payload) => {
  blockTarget.value = payload
}

const closeBlockModal = () => {
  if (isBlocking.value) return
  blockTarget.value = null
}

const confirmBlockUser = async ({ reason, durationHours }) => {
  if (!blockTarget.value?.userId) return
  isBlocking.value = true
  errorMessage.value = ''
  try {
    await blockModerationUser(blockTarget.value.userId, reason, durationHours)
    recentVotes.value.forEach((row) => {
      if (row.userId === blockTarget.value.userId) row.userBlocked = true
    })
    flashSuccess('Usuario bloqueado.')
    closeBlockModal()
    await refreshBlocks()
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo bloquear el usuario.'
  } finally {
    isBlocking.value = false
  }
}

const blockUser = (vote) => {
  if (!vote.userId) return
  openBlockModal({
    userId: vote.userId,
    label: vote.userName || `#${vote.userId}`,
  })
}

const blockUserFromAlert = (alert) => {
  if (!alert.userId) return
  openBlockModal({
    userId: alert.userId,
    label: alert.userName || `#${alert.userId}`,
    defaultReason: alert.reason || '',
  })
}

const unblockUser = async (userId) => {
  busyKey.value = `user:${userId}`
  errorMessage.value = ''
  try {
    await unblockModerationUser(userId)
    recentVotes.value.forEach((row) => {
      if (row.userId === userId) row.userBlocked = false
    })
    flashSuccess('Usuario desbloqueado.')
    await refreshBlocks()
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo desbloquear el usuario.'
  } finally {
    busyKey.value = ''
  }
}

const refreshBlocks = async () => {
  try {
    const [overviewData, blocksData] = await Promise.all([
      getModerationOverview(selectedHours.value),
      getModerationBlocks(),
    ])
    overview.value = overviewData
    blocks.value = { ips: blocksData?.ips || [], users: blocksData?.users || [] }
    await loadAlerts()
  } catch {
    // best-effort refresh
  }
}

const applyAlertFilters = () => {
  alertPage.value = 1
  loadAlerts().catch(() => {})
}

const goToAlertPage = (page) => {
  alertPage.value = Math.min(Math.max(1, Number(page) || 1), alertTotalPages.value)
  loadAlerts().catch(() => {})
}

const dismissAlert = async (alert) => {
  busyKey.value = `alert:${alert.id}`
  errorMessage.value = ''
  try {
    await dismissModerationAlert(alert.id)
    alerts.value = alerts.value.map((row) =>
      row.id === alert.id ? { ...row, status: 'dismissed' } : row,
    )
    flashSuccess('Alerta marcada como revisada.')
    await refreshBlocks()
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo cerrar la alerta.'
  } finally {
    busyKey.value = ''
  }
}

const openAlerts = computed(() => alerts.value.filter((row) => row.status === 'open'))

const expandedAlertId = ref('')

const toggleAlertExpanded = (id) => {
  expandedAlertId.value = expandedAlertId.value === String(id) ? '' : String(id)
}

const isAlertExpanded = (id) => expandedAlertId.value === String(id)

const toggleIpExpanded = (ipHash) => {
  const key = String(ipHash || '')
  expandedIpHash.value = expandedIpHash.value === key ? '' : key
}

const isIpExpanded = (ipHash) => expandedIpHash.value === String(ipHash || '')

onMounted(loadAll)
</script>

<template>
  <section class="space-y-6">
    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            Moderacion
          </p>
          <h2 class="mt-2 text-2xl font-black text-white">
            Anti-abuso y actividad sospechosa
          </h2>
          <p class="mt-1 text-sm text-slate-400">
            Diccionario local (sin IA): alertas al admin. El usuario no se bloquea solo por sospecha.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <a
            href="/admin/diccionario"
            class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-200 transition hover:bg-white/10"
          >
            <i class="fa-solid fa-book"></i>
            Diccionario
          </a>
          <button
            v-for="option in windowOptions"
            :key="option.value"
            type="button"
            class="rounded-full border px-3 py-2 text-xs font-black transition"
            :class="selectedHours === option.value
              ? 'border-fuchsia-300/40 bg-fuchsia-400/15 text-white'
              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'"
            @click="changeWindow(option.value)"
          >
            {{ option.label }}
          </button>
          <button
            type="button"
            class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
            @click="loadAll"
          >
            Actualizar
          </button>
        </div>
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

    <div v-if="isLoading" class="rounded-3xl border border-white/10 bg-slate-950/45 p-6 text-sm font-bold text-slate-300">
      Cargando datos de moderacion…
    </div>

    <template v-else>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <article
          v-for="card in overviewCards"
          :key="card.label"
          class="rounded-2xl border border-white/10 bg-white/4 p-4"
        >
          <i class="text-lg" :class="[card.icon, card.tone]" aria-hidden="true"></i>
          <p class="mt-2 text-2xl font-black text-white">{{ card.value }}</p>
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">{{ card.label }}</p>
        </article>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-full px-4 py-2 text-xs font-black transition"
          :class="mainTab === 'alerts' ? 'bg-amber-500 text-white' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'"
          @click="mainTab = 'alerts'"
        >
          Alertas automáticas
        </button>
        <button
          type="button"
          class="rounded-full px-4 py-2 text-xs font-black transition"
          :class="mainTab === 'ips' ? 'bg-amber-500 text-white' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'"
          @click="mainTab = 'ips'"
        >
          Actividad por IP
        </button>
      </div>

      <article v-if="mainTab === 'alerts'" class="rounded-3xl border border-amber-300/20 bg-amber-500/5 p-5 sm:p-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-lg font-black text-white">Alertas automáticas</h3>
            <p class="mt-1 text-sm text-slate-400">
              Spawn, promo o intento de llevar votos a otra página. Revisa y bloquea manualmente si hace falta.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <select
              v-model="alertStatusFilter"
              class="min-h-10 rounded-2xl border border-white/10 bg-slate-950 px-3 text-xs font-bold text-white"
              @change="applyAlertFilters"
            >
              <option v-for="option in alertStatusOptions" :key="option.value || 'all'" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <select
              v-model="alertTypeFilter"
              class="min-h-10 rounded-2xl border border-white/10 bg-slate-950 px-3 text-xs font-bold text-white"
              @change="applyAlertFilters"
            >
              <option v-for="option in alertTypeOptions" :key="option.value || 'all-types'" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <span class="rounded-full border border-amber-300/30 bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-100">
              {{ openAlerts.length }} abiertas en página
            </span>
          </div>
        </div>

        <div class="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div v-if="!alerts.length" class="px-4 py-6 text-sm font-bold text-slate-400">
            Sin alertas por ahora.
          </div>
          <div v-else class="overflow-x-auto">
            <table class="min-w-[920px] w-full text-left">
              <thead class="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <tr>
                  <th class="px-4 py-3">Fecha</th>
                  <th class="px-4 py-3">Tipo</th>
                  <th class="px-4 py-3">Usuario</th>
                  <th class="px-4 py-3">Motivo</th>
                  <th class="px-4 py-3">Votación</th>
                  <th class="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/10">
                <template v-for="alert in alerts" :key="alert.id">
                  <tr
                    class="cursor-pointer align-top text-sm text-slate-300 transition hover:bg-white/4"
                    :class="[
                      isAlertExpanded(alert.id) ? 'bg-white/4' : '',
                      alert.status === 'dismissed' ? 'opacity-50' : '',
                    ]"
                    @click="toggleAlertExpanded(alert.id)"
                  >
                    <td class="whitespace-nowrap px-4 py-3 text-xs font-bold text-slate-400">
                      {{ formatDate(alert.at) }}
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex w-max flex-col items-start gap-1">
                        <span class="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-100">
                          {{ alertTypeLabels[alert.type] || alert.type }}
                        </span>
                        <span
                          class="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest"
                          :class="
                            alert.status === 'open'
                              ? 'border border-amber-300/30 bg-amber-500/15 text-amber-200'
                              : 'border border-white/10 bg-white/5 text-slate-400'
                          "
                        >
                          {{ alert.status === 'open' ? 'Abierta' : 'Revisada' }}
                        </span>
                      </div>
                    </td>
                    <td class="max-w-44 px-4 py-3">
                      <a
                        v-if="alert.userId"
                        :href="`/admin/usuarios/${alert.userId}`"
                        class="block truncate text-sm font-black text-white hover:text-fuchsia-200"
                        @click.stop
                      >
                        {{ alert.userName || `#${alert.userId}` }}
                      </a>
                      <p v-else class="truncate text-sm font-black text-white">{{ alert.userName || '—' }}</p>
                      <p v-if="alert.userId" class="text-[11px] font-bold text-slate-500">#{{ alert.userId }}</p>
                    </td>
                    <td class="max-w-sm px-4 py-3">
                      <p class="line-clamp-2 text-sm font-bold leading-5 text-amber-100">{{ alert.reason }}</p>
                      <p v-if="alert.sample" class="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                        “{{ alert.sample }}”
                      </p>
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 text-xs font-bold text-slate-400">
                      <a
                        v-if="alert.pollId"
                        :href="`/admin/votaciones/editar/${alert.pollId}`"
                        class="text-fuchsia-200 hover:text-fuchsia-100"
                        @click.stop
                      >
                        #{{ alert.pollId }}
                      </a>
                      <span v-else>—</span>
                      <p v-if="alert.poll?.title || alert.pollTitle" class="mt-1 truncate text-[11px] font-bold text-fuchsia-200/80">
                        {{ alert.pollTitle }}
                      </p>
                      <p v-if="alert.type === 'spawn_signup' && alert.relatedAccountCount" class="mt-1 text-[11px] font-bold text-amber-200">
                        {{ alert.relatedAccountCount }} cuentas
                      </p>
                    </td>
                    <td class="px-4 py-3" @click.stop>
                      <div class="flex flex-wrap justify-end gap-1.5">
                        <a
                          v-if="alert.userId"
                          :href="`/admin/usuarios/${alert.userId}`"
                          class="inline-flex min-h-8 items-center rounded-xl border border-fuchsia-300/25 bg-fuchsia-500/10 px-2.5 text-[10px] font-black uppercase text-fuchsia-100 hover:bg-fuchsia-500/20"
                        >
                          Perfil
                        </a>
                        <button
                          v-if="alert.userId && alert.status === 'open'"
                          type="button"
                          class="min-h-8 rounded-xl border border-red-300/30 bg-red-500/10 px-2.5 text-[10px] font-black uppercase text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                          :disabled="isBlocking"
                          @click="blockUserFromAlert(alert)"
                        >
                          Bloquear
                        </button>
                        <button
                          v-if="alert.status === 'open'"
                          type="button"
                          class="min-h-8 rounded-xl border border-white/10 bg-white/5 px-2.5 text-[10px] font-black uppercase text-slate-300 hover:bg-white/10 disabled:opacity-50"
                          :disabled="busyKey === `alert:${alert.id}`"
                          @click="dismissAlert(alert)"
                        >
                          {{ busyKey === `alert:${alert.id}` ? '...' : 'Revisada' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="isAlertExpanded(alert.id)" class="bg-slate-950/50">
                    <td colspan="6" class="px-4 py-4">
                      <div class="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                        <div class="space-y-4">
                          <div>
                            <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Motivo</p>
                            <p class="mt-1 text-sm font-bold text-amber-100">{{ alert.reason }}</p>
                            <p v-if="alert.sample" class="mt-3 whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold leading-6 text-slate-200">
                              “{{ alert.sample }}”
                            </p>
                            <p v-if="alert.signals?.length" class="mt-2 text-xs font-bold text-slate-400">
                              {{ alert.signals.map(signalLabel).join(' · ') }}
                            </p>
                          </div>

                          <div v-if="alert.relatedAccounts?.length">
                            <p class="text-[10px] font-black uppercase tracking-widest text-amber-200/80">
                              Cuentas de esta IP ({{ alert.relatedAccounts.length }})
                            </p>
                            <div class="mt-2 divide-y divide-white/10 overflow-hidden rounded-xl border border-amber-300/20">
                              <a
                                v-for="account in alert.relatedAccounts"
                                :key="account.id"
                                :href="`/admin/usuarios/${account.id}`"
                                class="flex items-center gap-3 px-3 py-2 transition hover:bg-white/5"
                              >
                                <img
                                  v-if="account.photoUrl"
                                  :src="account.photoUrl"
                                  :alt="accountLabel(account)"
                                  class="size-8 shrink-0 rounded-full object-cover"
                                />
                                <span
                                  v-else
                                  class="grid size-8 shrink-0 place-items-center rounded-full bg-amber-500/20 text-[11px] font-black text-amber-100"
                                >
                                  {{ accountLabel(account).charAt(0).toUpperCase() }}
                                </span>
                                <div class="min-w-0 flex-1">
                                  <p class="truncate text-sm font-black text-white">{{ accountLabel(account) }}</p>
                                  <p class="truncate text-[11px] font-bold text-slate-400">
                                    <span v-if="account.username">@{{ account.username }}</span>
                                    <span v-if="account.email">
                                      <span v-if="account.username"> · </span>{{ account.email }}
                                    </span>
                                    <span> · #{{ account.id }}</span>
                                  </p>
                                </div>
                                <p class="shrink-0 text-[11px] font-bold text-slate-500">
                                  {{ formatDate(account.createdAt) }}
                                </p>
                              </a>
                            </div>
                          </div>
                          <p
                            v-else-if="alert.type === 'spawn_signup'"
                            class="text-xs font-bold text-slate-500"
                          >
                            No se encontraron cuentas ligadas a esta IP (pueden ser anteriores a que se guardara el hash).
                          </p>
                        </div>

                        <div class="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-bold text-slate-300">
                          <div v-if="alert.userId">
                            <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Usuario de la alerta</p>
                            <a
                              :href="`/admin/usuarios/${alert.userId}`"
                              class="mt-1 block truncate text-sm font-black text-white hover:text-fuchsia-200"
                            >
                              {{ alert.userName || `#${alert.userId}` }}
                            </a>
                            <p v-if="alert.userUsername" class="text-slate-400">@{{ alert.userUsername }}</p>
                            <p v-if="alert.userEmail" class="truncate text-slate-400">{{ alert.userEmail }}</p>
                            <p class="text-slate-500">#{{ alert.userId }}</p>
                          </div>
                          <div>
                            <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">IP</p>
                            <p class="mt-1 break-all font-mono text-slate-200">{{ alert.ipHash || alert.ipShort || '—' }}</p>
                            <p v-if="alert.ipBlocked" class="mt-1 text-red-300">Esta IP ya está bloqueada</p>
                          </div>
                          <p v-if="alert.pollTitle || alert.pollId">
                            Votación:
                            <a
                              v-if="alert.pollId"
                              :href="`/admin/votaciones/editar/${alert.pollId}`"
                              class="text-fuchsia-200 hover:text-fuchsia-100"
                            >
                              {{ alert.pollTitle || `#${alert.pollId}` }}
                            </a>
                          </p>
                          <p v-if="alert.commentId">Comentario #{{ alert.commentId }}</p>
                          <p>{{ formatDate(alert.at) }}</p>
                          <button
                            v-if="alert.ipHash && !alert.ipBlocked"
                            type="button"
                            class="mt-1 inline-flex min-h-8 w-full items-center justify-center rounded-xl border border-red-300/30 bg-red-500/10 px-3 text-[10px] font-black uppercase text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                            :disabled="busyKey === `ip:${alert.ipHash}`"
                            @click="blockIp({ ipHash: alert.ipHash, risk: 'high' })"
                          >
                            {{ busyKey === `ip:${alert.ipHash}` ? '...' : 'Bloquear esta IP' }}
                          </button>
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
          v-if="alertTotalPages > 1"
          class="mt-4 flex flex-wrap items-center justify-between gap-3"
        >
          <p class="text-xs font-bold text-slate-400">
            Página {{ alertPage }} / {{ alertTotalPages }} · {{ alertTotal }} alertas
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="min-h-9 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200 disabled:opacity-40"
              :disabled="alertPage <= 1"
              @click="goToAlertPage(alertPage - 1)"
            >
              Anterior
            </button>
            <button
              v-for="page in alertPageWindow"
              :key="`alert-page-${page}`"
              type="button"
              class="grid size-9 place-items-center rounded-2xl text-xs font-black"
              :class="page === alertPage ? 'bg-amber-500 text-white' : 'border border-white/10 bg-white/5 text-slate-300'"
              @click="goToAlertPage(page)"
            >
              {{ page }}
            </button>
            <button
              type="button"
              class="min-h-9 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200 disabled:opacity-40"
              :disabled="alertPage >= alertTotalPages"
              @click="goToAlertPage(alertPage + 1)"
            >
              Siguiente
            </button>
          </div>
        </div>
      </article>

      <article v-else-if="mainTab === 'ips'" class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <h3 class="text-lg font-black text-white">Actividad por IP</h3>
        <p class="mt-1 text-sm text-slate-400">
          Cuentas reales que votaron o se registraron desde esa IP. Los anónimos no son usuarios: solo se cuenta cuántos votos anónimos hay.
        </p>

        <div class="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div v-if="!ipActivity.length" class="px-4 py-6 text-sm font-bold text-slate-400">
            No hay actividad de votos en esta ventana.
          </div>
          <div v-else class="overflow-x-auto">
            <table class="min-w-[920px] w-full text-left">
              <thead class="bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <tr>
                  <th class="px-4 py-3">IP</th>
                  <th class="px-4 py-3">Votos</th>
                  <th class="px-4 py-3">Cuentas</th>
                  <th class="px-4 py-3">Votos anónimos</th>
                  <th class="px-4 py-3">Riesgo</th>
                  <th class="px-4 py-3">Último</th>
                  <th class="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/10">
                <template v-for="row in ipActivity" :key="row.ipHash">
                  <tr
                    class="cursor-pointer align-top text-sm text-slate-300 transition hover:bg-white/4"
                    :class="isIpExpanded(row.ipHash) ? 'bg-white/4' : ''"
                    @click="toggleIpExpanded(row.ipHash)"
                  >
                    <td class="px-4 py-3">
                      <span class="font-mono text-xs text-slate-300" :title="row.ipHash">{{ row.ipShort }}</span>
                    </td>
                    <td class="px-4 py-3 font-black text-white">{{ formatNumber(row.totalVotes) }}</td>
                    <td class="max-w-72 px-4 py-3">
                      <p class="text-sm font-black text-white">{{ formatNumber(row.accountCount || row.accounts?.length || 0) }} cuentas</p>
                      <p v-if="row.accounts?.length" class="mt-1 line-clamp-2 text-[11px] font-bold text-slate-400">
                        {{ row.accounts.slice(0, 3).map(accountLabel).join(' · ') }}
                        <span v-if="row.accounts.length > 3"> +{{ row.accounts.length - 3 }}</span>
                      </p>
                      <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        {{ isIpExpanded(row.ipHash) ? 'Clic para cerrar' : 'Clic para ver cuentas' }}
                      </p>
                    </td>
                    <td class="px-4 py-3">
                      <span :class="row.distinctAnon >= 4 ? 'font-black text-amber-200' : 'font-bold text-slate-300'">
                        {{ formatNumber(row.distinctAnon) }}
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <span class="rounded-full border px-2 py-1 text-[10px] font-black uppercase" :class="riskMeta[row.risk]?.classes">
                        {{ riskMeta[row.risk]?.label || row.risk }}
                      </span>
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 text-xs font-bold text-slate-400">
                      {{ formatDate(row.lastVoteAt) }}
                    </td>
                    <td class="px-4 py-3" @click.stop>
                      <button
                        v-if="!row.blocked"
                        type="button"
                        class="min-h-8 rounded-xl border border-red-300/30 bg-red-500/10 px-2.5 text-[10px] font-black uppercase text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                        :disabled="busyKey === `ip:${row.ipHash}`"
                        @click="blockIp(row)"
                      >
                        {{ busyKey === `ip:${row.ipHash}` ? '...' : 'Bloquear' }}
                      </button>
                      <button
                        v-else
                        type="button"
                        class="min-h-8 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-2.5 text-[10px] font-black uppercase text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                        :disabled="busyKey === `ip:${row.ipHash}`"
                        @click="unblockIp(row.ipHash)"
                      >
                        {{ busyKey === `ip:${row.ipHash}` ? '...' : 'Quitar' }}
                      </button>
                    </td>
                  </tr>
                  <tr v-if="isIpExpanded(row.ipHash)" class="bg-slate-950/50">
                    <td colspan="7" class="px-4 py-4">
                      <p class="text-[10px] font-black uppercase tracking-widest text-amber-200/80">
                        Cuentas de esta IP ({{ row.accounts?.length || 0 }})
                      </p>
                      <div v-if="row.accounts?.length" class="mt-2 divide-y divide-white/10 overflow-hidden rounded-xl border border-amber-300/20">
                        <a
                          v-for="account in row.accounts"
                          :key="account.id"
                          :href="`/admin/usuarios/${account.id}`"
                          class="flex items-center gap-3 px-3 py-2 transition hover:bg-white/5"
                        >
                          <img
                            v-if="account.photoUrl"
                            :src="account.photoUrl"
                            :alt="accountLabel(account)"
                            class="size-8 shrink-0 rounded-full object-cover"
                          />
                          <span
                            v-else
                            class="grid size-8 shrink-0 place-items-center rounded-full bg-amber-500/20 text-[11px] font-black text-amber-100"
                          >
                            {{ accountLabel(account).charAt(0).toUpperCase() }}
                          </span>
                          <div class="min-w-0 flex-1">
                            <p class="truncate text-sm font-black text-white">{{ accountLabel(account) }}</p>
                            <p class="truncate text-[11px] font-bold text-slate-400">
                              <span v-if="account.username">@{{ account.username }}</span>
                              <span v-if="account.email">
                                <span v-if="account.username"> · </span>{{ account.email }}
                              </span>
                              <span> · #{{ account.id }}</span>
                            </p>
                          </div>
                          <p class="shrink-0 text-[11px] font-bold text-slate-500">
                            {{ account.votes ? `${account.votes} votos` : 'Alta en esta IP' }}
                            · {{ formatDate(account.createdAt) }}
                          </p>
                        </a>
                      </div>
                      <p v-else class="mt-2 text-sm font-bold text-slate-400">
                        No hay cuentas registradas. Solo votos anónimos ({{ formatNumber(row.distinctAnon) }}).
                      </p>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <div v-if="mainTab === 'ips'" class="grid gap-6 xl:grid-cols-2">
        <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
          <h3 class="text-lg font-black text-white">Votos recientes</h3>
          <div class="mt-4 space-y-2">
            <div
              v-for="vote in recentVotes"
              :key="vote.id"
              class="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-bold text-white">
                  <a
                    v-if="vote.userId"
                    :href="`/admin/usuarios/${vote.userId}`"
                    class="transition hover:text-fuchsia-200"
                  >
                    {{ vote.userName }}
                  </a>
                  <span v-else-if="vote.userName">{{ vote.userName }}</span>
                  <span v-else class="text-slate-300">Anonimo</span>
                  <span class="text-slate-500"> · {{ formatNumber(vote.amount) }} voto(s)</span>
                </p>
                <p class="truncate text-xs text-slate-400">
                  {{ vote.artistName || 'Artista' }}
                  <span v-if="vote.pollTitle"> · {{ vote.pollTitle }}</span>
                  · {{ formatDate(vote.createdAt) }}
                </p>
                <p class="truncate font-mono text-[10px] text-slate-500" :title="vote.ipHash || ''">
                  {{ vote.ipShort || 'sin ip' }}
                </p>
              </div>
              <button
                v-if="vote.userId && !vote.userBlocked"
                type="button"
                class="shrink-0 rounded-full border border-red-300/30 bg-red-500/10 px-3 py-1.5 text-xs font-black text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                :disabled="busyKey === `user:${vote.userId}`"
                @click="blockUser(vote)"
              >
                Bloquear
              </button>
              <span
                v-else-if="vote.userBlocked"
                class="shrink-0 rounded-full border border-red-300/30 bg-red-500/15 px-3 py-1.5 text-xs font-black text-red-200"
              >
                Bloqueado
              </span>
            </div>
            <div v-if="!recentVotes.length" class="rounded-2xl border border-white/10 px-4 py-6 text-sm font-bold text-slate-400">
              Aun no hay votos registrados.
            </div>
          </div>
        </article>

        <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
          <h3 class="text-lg font-black text-white">Bloqueados</h3>

          <p class="mt-4 text-xs font-black uppercase tracking-widest text-slate-400">IPs</p>
          <div class="mt-2 space-y-2">
            <div
              v-for="ip in blocks.ips"
              :key="ip.ipHash"
              class="flex items-center justify-between gap-3 rounded-2xl border border-red-300/20 bg-red-500/5 px-4 py-3"
            >
              <div class="min-w-0">
                <p class="truncate font-mono text-xs text-slate-200" :title="ip.ipHash">{{ ip.ipShort }}</p>
                <p class="truncate text-[11px] text-slate-400">{{ ip.reason }} · {{ formatDate(ip.at) }}</p>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                :disabled="busyKey === `ip:${ip.ipHash}`"
                @click="unblockIp(ip.ipHash)"
              >
                Quitar
              </button>
            </div>
            <p v-if="!blocks.ips.length" class="rounded-2xl border border-white/10 px-4 py-3 text-xs font-bold text-slate-400">
              Sin IPs bloqueadas.
            </p>
          </div>

          <p class="mt-5 text-xs font-black uppercase tracking-widest text-slate-400">Usuarios</p>
          <div class="mt-2 space-y-2">
            <div
              v-for="user in blocks.users"
              :key="user.userId"
              class="flex items-center justify-between gap-3 rounded-2xl border border-red-300/20 bg-red-500/5 px-4 py-3"
            >
              <div class="min-w-0">
                <a
                  :href="`/admin/usuarios/${user.userId}`"
                  class="truncate text-sm font-bold text-white transition hover:text-fuchsia-200"
                >
                  {{ user.name }}
                </a>
                <p class="truncate text-[11px] text-slate-400">{{ user.reason }} · {{ formatDate(user.at) }}</p>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                :disabled="busyKey === `user:${user.userId}`"
                @click="unblockUser(user.userId)"
              >
                Quitar
              </button>
            </div>
            <p v-if="!blocks.users.length" class="rounded-2xl border border-white/10 px-4 py-3 text-xs font-bold text-slate-400">
              Sin usuarios bloqueados.
            </p>
          </div>
        </article>
      </div>
    </template>

    <AdminBlockUserModal
      :open="Boolean(blockTarget)"
      :user-label="blockTarget?.label || ''"
      :default-reason="blockTarget?.defaultReason || ''"
      :is-submitting="isBlocking"
      @close="closeBlockModal"
      @confirm="confirmBlockUser"
    />
  </section>
</template>
