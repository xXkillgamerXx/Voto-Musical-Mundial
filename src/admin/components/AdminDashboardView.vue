<script setup>
import { computed, onMounted, ref } from 'vue'
import { getAdminOverview } from '../../services/api/adminApi'
import AdminTrendChart from './AdminTrendChart.vue'

const overview = ref(null)
const isLoading = ref(true)
const errorMessage = ref('')
const rangeDays = ref(30)

const rangeOptions = [7, 30, 90]

const quickActions = [
  { labelKey: 'admin.dashboard.quickActions.createPoll', href: '/admin/votaciones/crear', icon: 'fa-solid fa-plus' },
  { labelKey: 'admin.dashboard.quickActions.addArtist', href: '/admin/artistas/crear', icon: 'fa-solid fa-microphone-lines' },
  { labelKey: 'admin.dashboard.quickActions.manageUsers', href: '/admin/usuarios', icon: 'fa-solid fa-users-gear' },
  { labelKey: 'admin.dashboard.quickActions.manageCategories', href: '/admin/categorias', icon: 'fa-solid fa-trophy' },
  { label: 'Alertas abiertas', href: '/admin/reportes', icon: 'fa-solid fa-shield-halved' },
  { label: 'Denuncias pendientes', href: '/admin/denuncias', icon: 'fa-solid fa-flag' },
]

const platformLabels = {
  web: 'Web',
  android: 'Android',
  ios: 'iOS',
}

const formatNumber = (value) => Number(value || 0).toLocaleString('es')

const formatCompact = (value) =>
  new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0))

const formatTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es', { day: '2-digit', month: 'short' })
}

const signed = (value) => `${Number(value) > 0 ? '+' : ''}${Number(value || 0)}%`
const growthClass = (value) => (Number(value) < 0 ? 'text-rose-300' : 'text-emerald-300')

const load = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    overview.value = await getAdminOverview(rangeDays.value)
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo cargar el dashboard.'
  } finally {
    isLoading.value = false
  }
}

const setRange = (days) => {
  if (rangeDays.value === days) return
  rangeDays.value = days
  load()
}

const users = computed(() => overview.value?.users || {})
const votes = computed(() => overview.value?.votes || {})
const content = computed(() => overview.value?.content || {})
const usersSeries = computed(() => overview.value?.series?.users || [])
const votesSeries = computed(() => overview.value?.series?.votes || [])
const pushByPlatform = computed(() => overview.value?.pushByPlatform || [])
const totalPushDevices = computed(() =>
  pushByPlatform.value.reduce((sum, row) => sum + Number(row.count || 0), 0),
)

const stats = computed(() => [
  {
    key: 'users',
    labelKey: 'admin.dashboard.totalUsers',
    value: formatNumber(users.value.total),
    trend: users.value.growthToday,
    trendLabelKey: 'admin.dashboard.vsYesterday',
    footKey: 'admin.dashboard.newToday',
    footParams: { count: formatNumber(users.value.today) },
    icon: 'fa-solid fa-users',
    accent: 'from-blue-500 to-indigo-500',
  },
  {
    key: 'votes',
    labelKey: 'admin.dashboard.totalVotes',
    value: formatCompact(votes.value.total),
    trend: votes.value.growthToday,
    trendLabelKey: 'admin.dashboard.vsYesterday',
    footKey: 'admin.dashboard.votesTodayCount',
    footParams: { count: formatNumber(votes.value.today) },
    icon: 'fa-solid fa-check-to-slot',
    accent: 'from-fuchsia-500 to-violet-500',
  },
  {
    key: 'polls',
    labelKey: 'admin.dashboard.stats.openPolls',
    value: formatNumber(content.value.openPolls),
    footKey: 'admin.dashboard.pollsTotal',
    footParams: {},
    footSuffix: formatNumber(content.value.polls),
    icon: 'fa-solid fa-ranking-star',
    accent: 'from-amber-400 to-orange-500',
  },
  {
    key: 'artists',
    labelKey: 'admin.dashboard.stats.artists',
    value: formatNumber(content.value.artists),
    footKey: 'admin.dashboard.commentsTotal',
    footParams: {},
    footSuffix: formatNumber(content.value.comments),
    icon: 'fa-solid fa-microphone-lines',
    accent: 'from-cyan-500 to-blue-500',
  },
])

const audienceRows = computed(() => [
  {
    labelKey: 'admin.dashboard.withPush',
    value: formatNumber(users.value.withPush),
    percent: users.value.total ? Math.round((users.value.withPush / users.value.total) * 100) : 0,
    barClass: 'bg-emerald-300',
  },
  {
    labelKey: 'admin.dashboard.referredUsers',
    value: formatNumber(users.value.referred),
    percent: users.value.total ? Math.round((users.value.referred / users.value.total) * 100) : 0,
    barClass: 'bg-fuchsia-300',
  },
])

const userLabel = (user) =>
  user.displayName || user.username || user.email || `#${user.id}`

const moderation = computed(() => overview.value?.moderation || { openAlerts: 0, blockedUsers: 0, alerts: [] })

const alertTypeLabel = (type) => {
  const map = {
    spawn_signup: 'admin.dashboard.alertSpawn',
    comment_promo: 'admin.dashboard.alertPromo',
    comment_diversion: 'admin.dashboard.alertDiversion',
    comment_external_link: 'admin.dashboard.alertExternalLink',
  }
  return map[type] || type
}

onMounted(load)
</script>

<template>
  <section class="space-y-6">
    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            {{ $t('admin.dashboard.summary') }}
          </p>
          <h2 class="mt-2 text-2xl font-black text-white">
            {{ $t('admin.dashboard.platformStatus') }}
          </h2>
          <p v-if="overview?.generatedAt" class="mt-1 text-xs font-bold text-slate-500">
            {{ $t('admin.dashboard.updatedAt', { time: formatTime(overview.generatedAt) }) }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
            <button
              v-for="option in rangeOptions"
              :key="option"
              type="button"
              class="rounded-full px-3 py-1.5 text-xs font-black transition"
              :class="
                rangeDays === option
                  ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white'
                  : 'text-slate-300 hover:bg-white/10'
              "
              @click="setRange(option)"
            >
              {{ $t('admin.dashboard.days', { count: option }) }}
            </button>
          </div>
          <button
            type="button"
            class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
            :disabled="isLoading"
            @click="load"
          >
            {{ isLoading ? $t('admin.dashboard.loading') : $t('admin.dashboard.refresh') }}
          </button>
        </div>
      </div>

      <p
        v-if="errorMessage"
        class="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
      >
        {{ errorMessage }}
      </p>
    </article>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article
        v-for="stat in stats"
        :key="stat.key"
        class="rounded-3xl border border-white/10 bg-white/4 p-5 shadow-xl shadow-black/20"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
              {{ $t(stat.labelKey) }}
            </p>
            <h3 class="mt-3 text-3xl font-black text-white">
              {{ stat.value }}
            </h3>
          </div>
          <span
            class="grid size-12 shrink-0 place-items-center rounded-2xl bg-linear-to-br text-lg text-white shadow-lg"
            :class="stat.accent"
          >
            <i :class="stat.icon" aria-hidden="true"></i>
          </span>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold">
          <span v-if="stat.trend !== undefined" :class="growthClass(stat.trend)">
            {{ signed(stat.trend) }}
            <span class="text-xs font-bold text-slate-500">{{ $t(stat.trendLabelKey) }}</span>
          </span>
          <span class="text-xs font-bold text-slate-400">
            {{ $t(stat.footKey, stat.footParams) }}<template v-if="stat.footSuffix">: {{ stat.footSuffix }}</template>
          </span>
        </div>
      </article>
    </div>

    <div class="grid gap-6 xl:grid-cols-2">
      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
              {{ $t('admin.dashboard.newUsersChart') }}
            </p>
            <h3 class="mt-2 text-2xl font-black text-white">
              {{ formatNumber(users.last7) }}
              <span class="text-sm font-bold text-slate-500">{{ $t('admin.dashboard.last7Days') }}</span>
            </h3>
          </div>
          <span
            class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black"
            :class="growthClass(users.growth7)"
          >
            {{ signed(users.growth7) }} {{ $t('admin.dashboard.vsPrevious') }}
          </span>
        </div>
        <div class="mt-5">
          <AdminTrendChart :points="usersSeries" type="area" color="#f0abfc" />
        </div>
      </article>

      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
              {{ $t('admin.dashboard.votesChart') }}
            </p>
            <h3 class="mt-2 text-2xl font-black text-white">
              {{ formatNumber(votes.last7) }}
              <span class="text-sm font-bold text-slate-500">{{ $t('admin.dashboard.last7Days') }}</span>
            </h3>
          </div>
          <span
            class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black"
            :class="growthClass(votes.growth7)"
          >
            {{ signed(votes.growth7) }} {{ $t('admin.dashboard.vsPrevious') }}
          </span>
        </div>
        <div class="mt-5">
          <AdminTrendChart :points="votesSeries" type="bars" color="#67e8f9" />
        </div>
      </article>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1fr_1fr_0.9fr]">
      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
          {{ $t('admin.dashboard.audience') }}
        </p>

        <div class="mt-4 space-y-4">
          <div v-for="row in audienceRows" :key="row.labelKey">
            <div class="flex items-baseline justify-between gap-3">
              <span class="text-sm font-bold text-slate-300">{{ $t(row.labelKey) }}</span>
              <span class="text-sm font-black text-white">{{ row.value }} · {{ row.percent }}%</span>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div class="h-full rounded-full" :class="row.barClass" :style="{ width: `${row.percent}%` }"></div>
            </div>
          </div>
        </div>

        <div class="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <div class="flex items-baseline justify-between">
            <span class="text-sm font-bold text-slate-300">{{ $t('admin.dashboard.pushDevices') }}</span>
            <span class="text-lg font-black text-cyan-200">{{ formatNumber(totalPushDevices) }}</span>
          </div>
          <div v-if="pushByPlatform.length" class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="row in pushByPlatform"
              :key="row.platform"
              class="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-100"
            >
              {{ platformLabels[row.platform] || row.platform }}: {{ formatNumber(row.count) }}
            </span>
          </div>
        </div>

        <div class="mt-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <div class="flex items-baseline justify-between">
            <span class="text-sm font-bold text-slate-300">{{ $t('admin.dashboard.pointsInCirculation') }}</span>
            <span class="text-lg font-black text-fuchsia-200">{{ formatCompact(content.points) }}</span>
          </div>
        </div>
      </article>

      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
            {{ $t('admin.dashboard.topPolls') }}
          </p>
          <a
            href="/admin/votaciones"
            class="text-xs font-black text-fuchsia-200 transition hover:text-fuchsia-100"
          >
            {{ $t('admin.dashboard.viewAll') }}
          </a>
        </div>

        <div class="mt-4 space-y-2">
          <a
            v-for="poll in overview?.topPolls || []"
            :key="poll.id"
            :href="`/admin/votaciones/editar/${poll.id}`"
            class="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 transition hover:border-fuchsia-300/30 hover:bg-white/5"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-black text-white">{{ poll.title }}</p>
              <p class="text-[11px] font-bold uppercase tracking-widest text-slate-500">{{ poll.status }}</p>
            </div>
            <span class="shrink-0 text-sm font-black text-cyan-200">{{ formatCompact(poll.totalVotes) }}</span>
          </a>

          <p v-if="!overview?.topPolls?.length" class="rounded-2xl border border-white/10 px-4 py-6 text-sm font-bold text-slate-400">
            {{ $t('admin.dashboard.noData') }}
          </p>
        </div>

        <p class="mt-5 text-xs font-black uppercase tracking-[0.24em] text-slate-400">
          {{ $t('admin.dashboard.topReferrers') }}
        </p>
        <div class="mt-3 space-y-2">
          <div
            v-for="referrer in overview?.topReferrers || []"
            :key="referrer.id"
            class="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-2.5"
          >
            <a
              :href="`/admin/usuarios/${referrer.id}`"
              class="truncate text-sm font-bold text-white transition hover:text-fuchsia-200"
            >
              {{ userLabel(referrer) }}
            </a>
            <span class="shrink-0 text-xs font-black text-emerald-200">
              {{ $t('admin.dashboard.invitedCount', { count: referrer.referralSignups }) }}
            </span>
          </div>

          <p v-if="!overview?.topReferrers?.length" class="rounded-2xl border border-white/10 px-4 py-4 text-sm font-bold text-slate-400">
            {{ $t('admin.dashboard.noData') }}
          </p>
        </div>
      </article>

      <aside class="space-y-6">
        <article class="rounded-3xl border border-white/10 bg-white/4 p-5">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
              {{ $t('admin.dashboard.latestUsers') }}
            </p>
            <a href="/admin/usuarios" class="text-xs font-black text-fuchsia-200 transition hover:text-fuchsia-100">
              {{ $t('admin.dashboard.viewAll') }}
            </a>
          </div>

          <div class="mt-4 space-y-3">
            <div
              v-for="user in overview?.recentUsers || []"
              :key="user.id"
              class="flex items-center gap-3 border-b border-white/10 pb-3 last:border-0 last:pb-0"
            >
              <a :href="`/admin/usuarios/${user.id}`" class="flex min-w-0 flex-1 items-center gap-3 transition hover:opacity-90">
              <img
                v-if="user.photoUrl"
                :src="user.photoUrl"
                :alt="userLabel(user)"
                class="size-9 shrink-0 rounded-full object-cover"
              />
              <span
                v-else
                class="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-black text-white"
              >
                {{ userLabel(user).charAt(0).toUpperCase() }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-black text-white">{{ userLabel(user) }}</p>
                <p class="truncate text-xs text-slate-500">
                  {{ formatDate(user.createdAt) }}
                  <span v-if="user.referredById" class="text-emerald-300"> · ref</span>
                </p>
              </div>
              <div class="flex shrink-0 flex-col items-end gap-1">
                <span
                  class="rounded-full border px-2 py-0.5 text-[10px] font-black uppercase"
                  :class="
                    user.accountStatus === 'blocked'
                      ? 'border-red-300/25 bg-red-500/10 text-red-100'
                      : 'border-emerald-300/20 bg-emerald-500/10 text-emerald-100'
                  "
                >
                  {{
                    user.accountStatus === 'blocked'
                      ? $t('admin.dashboard.userStatusBlocked')
                      : $t('admin.dashboard.userStatusActive')
                  }}
                </span>
                <span class="text-xs font-black text-fuchsia-200">{{ formatNumber(user.points) }}</span>
              </div>
              </a>
            </div>

            <p v-if="!overview?.recentUsers?.length" class="rounded-2xl border border-white/10 px-4 py-4 text-sm font-bold text-slate-400">
              {{ $t('admin.dashboard.noData') }}
            </p>
          </div>
        </article>

        <article class="rounded-3xl border border-amber-300/20 bg-amber-500/5 p-5">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs font-black uppercase tracking-[0.24em] text-amber-200">
              {{ $t('admin.dashboard.moderationTitle') }}
            </p>
            <div class="flex items-center gap-2">
              <a href="/admin/reportes" class="text-xs font-black text-amber-100 transition hover:text-white">
                {{ $t('admin.dashboard.moderationViewReports') }}
              </a>
              <a href="/admin/denuncias" class="text-xs font-black text-red-200 transition hover:text-white">
                Denuncias
              </a>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-3">
            <div class="rounded-2xl border border-white/10 bg-slate-950/45 p-3">
              <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {{ $t('admin.dashboard.moderationAlerts') }}
              </p>
              <p class="mt-1 text-2xl font-black text-amber-100">{{ formatNumber(moderation.openAlerts) }}</p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-slate-950/45 p-3">
              <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {{ $t('admin.dashboard.moderationBlocked') }}
              </p>
              <p class="mt-1 text-2xl font-black text-red-100">{{ formatNumber(moderation.blockedUsers) }}</p>
            </div>
          </div>

          <p class="mt-4 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
            {{ $t('admin.dashboard.moderationRecentAlerts') }}
          </p>
          <div class="mt-2 space-y-2">
            <a
              v-for="alert in moderation.alerts || []"
              :key="alert.id"
              :href="alert.userId ? `/admin/usuarios/${alert.userId}` : '/admin/reportes'"
              class="block rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2.5 transition hover:border-amber-300/30 hover:bg-slate-950/70"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-amber-100">
                  {{ $t(alertTypeLabel(alert.type)) }}
                </span>
                <span class="text-[10px] font-bold text-slate-500">{{ formatDate(alert.at) }}</span>
              </div>
              <p class="mt-1 truncate text-xs font-bold text-slate-200">{{ alert.reason }}</p>
              <p v-if="alert.userName" class="truncate text-[11px] text-slate-500">{{ alert.userName }}</p>
            </a>
            <p
              v-if="!(moderation.alerts || []).length"
              class="rounded-2xl border border-white/10 px-3 py-4 text-sm font-bold text-slate-400"
            >
              {{ $t('admin.dashboard.noData') }}
            </p>
          </div>
        </article>

        <article class="rounded-3xl border border-white/10 bg-white/4 p-5">
          <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
            {{ $t('admin.dashboard.quickActionsTitle') }}
          </p>
          <div class="mt-4 grid gap-3">
            <a
              v-for="action in quickActions"
              :key="action.href"
              :href="action.href"
              class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-black text-white transition hover:border-fuchsia-300/35 hover:bg-white/10"
            >
              <i class="mr-2 text-fuchsia-200" :class="action.icon" aria-hidden="true"></i>
              {{ action.label || $t(action.labelKey) }}
            </a>
          </div>
        </article>
      </aside>
    </div>
  </section>
</template>
