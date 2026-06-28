<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  blockModerationIp,
  blockModerationUser,
  getModerationBlocks,
  getModerationIpActivity,
  getModerationOverview,
  getModerationRecentVotes,
  unblockModerationIp,
  unblockModerationUser,
} from '../../services/api/adminApi'

const windowOptions = [
  { value: 1, label: 'Ultima hora' },
  { value: 24, label: 'Ultimas 24h' },
  { value: 72, label: 'Ultimos 3 dias' },
  { value: 168, label: 'Ultimos 7 dias' },
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
  ]
})

const formatNumber = (value) => Number(value || 0).toLocaleString('es')

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
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

const blockUser = async (vote) => {
  if (!vote.userId) return
  busyKey.value = `user:${vote.userId}`
  errorMessage.value = ''
  try {
    await blockModerationUser(vote.userId, 'Bloqueo desde actividad reciente')
    recentVotes.value.forEach((row) => {
      if (row.userId === vote.userId) row.userBlocked = true
    })
    flashSuccess('Usuario bloqueado.')
    await refreshBlocks()
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo bloquear el usuario.'
  } finally {
    busyKey.value = ''
  }
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
  } catch {
    // best-effort refresh
  }
}

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
            Detecta IPs que votan demasiado, multiples cuentas por IP y bloquea accesos.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
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

      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <h3 class="text-lg font-black text-white">Actividad por IP</h3>
        <p class="mt-1 text-sm text-slate-400">
          Una IP con muchos anonimos distintos o demasiados votos suele indicar abuso.
        </p>

        <div class="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div class="hidden grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.8fr_0.8fr_0.9fr] gap-3 bg-white/5 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-400 lg:grid">
            <span>IP (hash)</span>
            <span>Votos</span>
            <span>Anon</span>
            <span>Users</span>
            <span>Riesgo</span>
            <span>Ultimo</span>
            <span>Accion</span>
          </div>
          <div
            v-for="row in ipActivity"
            :key="row.ipHash"
            class="grid gap-3 border-t border-white/10 px-4 py-3 text-sm text-slate-200 lg:grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.8fr_0.8fr_0.9fr] lg:items-center"
          >
            <span class="font-mono text-xs text-slate-300" :title="row.ipHash">{{ row.ipShort }}</span>
            <span class="font-black text-white">{{ formatNumber(row.totalVotes) }}</span>
            <span :class="row.distinctAnon >= 4 ? 'font-black text-amber-200' : ''">{{ formatNumber(row.distinctAnon) }}</span>
            <span>{{ formatNumber(row.distinctUsers) }}</span>
            <span>
              <span class="rounded-full border px-2 py-1 text-[10px] font-black uppercase" :class="riskMeta[row.risk]?.classes">
                {{ riskMeta[row.risk]?.label || row.risk }}
              </span>
            </span>
            <span class="text-xs text-slate-400">{{ formatDate(row.lastVoteAt) }}</span>
            <span>
              <button
                v-if="!row.blocked"
                type="button"
                class="rounded-full border border-red-300/30 bg-red-500/10 px-3 py-1.5 text-xs font-black text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                :disabled="busyKey === `ip:${row.ipHash}`"
                @click="blockIp(row)"
              >
                {{ busyKey === `ip:${row.ipHash}` ? '...' : 'Bloquear' }}
              </button>
              <button
                v-else
                type="button"
                class="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-black text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
                :disabled="busyKey === `ip:${row.ipHash}`"
                @click="unblockIp(row.ipHash)"
              >
                {{ busyKey === `ip:${row.ipHash}` ? '...' : 'Desbloquear' }}
              </button>
            </span>
          </div>
          <div v-if="!ipActivity.length" class="border-t border-white/10 px-4 py-6 text-sm font-bold text-slate-400">
            No hay actividad de votos en esta ventana.
          </div>
        </div>
      </article>

      <div class="grid gap-6 xl:grid-cols-2">
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
                  <span v-if="vote.userName">{{ vote.userName }}</span>
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
                <p class="truncate text-sm font-bold text-white">{{ user.name }}</p>
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
  </section>
</template>
