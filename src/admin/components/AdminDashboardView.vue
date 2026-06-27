<script setup>
import { computed, onMounted, ref } from 'vue'
import { getAdminDashboard } from '../../services/api/adminApi'

const polls = ref([])
const users = ref([])
const artists = ref([])
const errorMessage = ref('')
const loadedSources = ref({
  polls: false,
  users: false,
  artists: false,
})

const quickActions = [
  { labelKey: 'admin.dashboard.quickActions.createPoll', href: '/admin/votaciones/crear', icon: 'fa-solid fa-plus' },
  { labelKey: 'admin.dashboard.quickActions.addArtist', href: '/admin/artistas/crear', icon: 'fa-solid fa-microphone-lines' },
  { labelKey: 'admin.dashboard.quickActions.manageUsers', href: '/admin/usuarios', icon: 'fa-solid fa-users-gear' },
  { labelKey: 'admin.dashboard.quickActions.manageCategories', href: '/admin/categorias', icon: 'fa-solid fa-trophy' },
]

const startOfToday = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

const endOfToday = () => {
  const date = new Date()
  date.setHours(23, 59, 59, 999)
  return date
}

const getMillis = (value) => value?.toMillis?.() || value?.toDate?.()?.getTime?.() || 0
const isToday = (value) => {
  const millis = getMillis(value)
  return millis >= startOfToday().getTime() && millis <= endOfToday().getTime()
}
const formatNumber = (value) => Number(value || 0).toLocaleString('es')
const boundPercent = (value) => Math.max(0, Math.min(100, Math.round(Number(value || 0))))
const isOpenPoll = (poll) => ['live', 'selecting_winners'].includes(poll.status) || poll.isLive
const isActiveArtist = (artist) => (artist.status || 'active') === 'active'
const userLabel = (vote) =>
  vote.userDisplayName || vote.username || vote.userEmail || vote.userId || 'user'

const markLoaded = (source) => {
  loadedSources.value = {
    ...loadedSources.value,
    [source]: true,
  }
}

const handleLoadError = (source) => {
  errorMessage.value = 'admin.dashboard.errors.load'
  markLoaded(source)
}

const dateLike = (value) => {
  if (!value || typeof value !== 'string') return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return { toDate: () => date, toMillis: () => date.getTime() }
}
const normalizeDateRows = (rows) => rows.map((row) => ({
  ...row,
  createdAt: dateLike(row.createdAt),
  updatedAt: dateLike(row.updatedAt),
  endAt: dateLike(row.endAt || row.endsAt),
  activeEndAt: dateLike(row.activeEndAt),
}))

const isLoading = computed(() => Object.values(loadedSources.value).some((isLoaded) => !isLoaded))
const openPolls = computed(() => polls.value.filter(isOpenPoll))
const closingTodayPolls = computed(() => openPolls.value.filter((poll) => isToday(poll.endAt || poll.activeEndAt)))
const usersCreatedToday = computed(() => users.value.filter((user) => isToday(user.createdAt)))
const activeArtists = computed(() => artists.value.filter(isActiveArtist))
const pollActivity = computed(() =>
  polls.value.flatMap((poll) =>
    (poll.publicActivity || []).map((activity, index) => ({
      id: `${poll.id}-${activity.id || index}`,
      pollId: poll.id,
      pollTitle: poll.title,
      ...activity,
    })),
  ),
)
const todayVotes = computed(() => pollActivity.value.filter((vote) => isToday(vote.createdAt)))
const activeUserIdsToday = computed(() =>
  new Set(todayVotes.value.map((vote) => vote.userId).filter(Boolean)),
)
const totalVotesToday = computed(() =>
  todayVotes.value.reduce((total, vote) => total + Number(vote.amount || 0), 0),
)
const totalPlatformVotes = computed(() =>
  polls.value.reduce((total, poll) => total + Number(poll.totalVotes || 0), 0),
)
const totalUserPoints = computed(() =>
  users.value.reduce((total, user) => total + Number(user.points || 0), 0),
)

const stats = computed(() => [
  {
    labelKey: 'admin.dashboard.stats.votesToday',
    value: formatNumber(totalVotesToday.value),
    trendKey: 'admin.dashboard.stats.voteBatchesToday',
    trendParams: { count: todayVotes.value.length },
    icon: 'fa-solid fa-check-to-slot',
    accent: 'from-fuchsia-500 to-violet-500',
  },
  {
    labelKey: 'admin.dashboard.stats.activeUsers',
    value: formatNumber(activeUserIdsToday.value.size),
    trendKey: 'admin.dashboard.stats.activeUsersToday',
    trendParams: { count: activeUserIdsToday.value.size },
    icon: 'fa-solid fa-user-check',
    accent: 'from-cyan-500 to-blue-500',
  },
  {
    labelKey: 'admin.dashboard.stats.registeredUsers',
    value: formatNumber(users.value.length),
    trendKey: 'admin.dashboard.stats.usersToday',
    trendParams: { count: usersCreatedToday.value.length },
    icon: 'fa-solid fa-users',
    accent: 'from-blue-500 to-indigo-500',
  },
  {
    labelKey: 'admin.dashboard.stats.openPolls',
    value: formatNumber(openPolls.value.length),
    trendKey: 'admin.dashboard.stats.closeToday',
    trendParams: { count: closingTodayPolls.value.length },
    icon: 'fa-solid fa-ranking-star',
    accent: 'from-amber-400 to-orange-500',
  },
])

const summaryCards = computed(() => [
  {
    labelKey: 'admin.dashboard.voteConversion',
    value: formatNumber(totalPlatformVotes.value),
    percent: boundPercent(totalPlatformVotes.value ? 100 : 0),
    barClass: 'bg-cyan-300',
    textClass: 'text-cyan-200',
  },
  {
    labelKey: 'admin.dashboard.fanParticipation',
    value: formatNumber(totalUserPoints.value),
    percent: boundPercent(users.value.length ? 100 : 0),
    barClass: 'bg-fuchsia-300',
    textClass: 'text-fuchsia-200',
  },
  {
    labelKey: 'admin.dashboard.activeArtistsSummary',
    value: errorMessage.value ? 'Error' : formatNumber(activeArtists.value.length),
    percent: errorMessage.value ? 35 : 100,
    barClass: errorMessage.value ? 'bg-rose-300' : 'bg-emerald-300',
    textClass: errorMessage.value ? 'text-rose-200' : 'text-emerald-200',
  },
])

const formatRelativeTime = (value) => {
  const millis = getMillis(value)

  if (!millis) {
    return ''
  }

  const seconds = Math.round((millis - Date.now()) / 1000)
  const divisions = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.345, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
  ]
  let duration = seconds

  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(duration), division.unit)
    }

    duration /= division.amount
  }

  return ''
}

const recentActivity = computed(() => {
  const voteItems = pollActivity.value.map((vote) => ({
    id: `vote-${vote.id}`,
    titleKey: 'admin.dashboard.activity.recentVote',
    detailKey: 'admin.dashboard.activity.voteDetail',
    detailParams: { user: userLabel(vote), count: formatNumber(vote.amount || 0) },
    createdAt: vote.createdAt,
  }))
  const pollItems = polls.value.slice(0, 4).map((poll) => ({
    id: `poll-${poll.id}`,
    titleKey: 'admin.dashboard.activity.newPoll',
    detail: poll.title || poll.id,
    createdAt: poll.createdAt,
  }))
  const userItems = users.value.slice(0, 4).map((user) => ({
    id: `user-${user.id}`,
    titleKey: 'admin.dashboard.activity.newUser',
    detail: user.email || user.name || user.username || user.id,
    createdAt: user.createdAt,
  }))

  return [...voteItems, ...pollItems, ...userItems]
    .filter((activity) => getMillis(activity.createdAt))
    .sort((current, next) => getMillis(next.createdAt) - getMillis(current.createdAt))
    .slice(0, 6)
    .map((activity) => ({
      ...activity,
      time: formatRelativeTime(activity.createdAt),
    }))
})

onMounted(() => {
  getAdminDashboard()
    .then((data) => {
      polls.value = normalizeDateRows(data.polls || [])
      users.value = normalizeDateRows(data.users || [])
      artists.value = normalizeDateRows(data.artists || [])
      markLoaded('polls')
      markLoaded('users')
      markLoaded('artists')
    })
    .catch(() => {
      handleLoadError('polls')
      handleLoadError('users')
      handleLoadError('artists')
    })
})
</script>

<template>
  <section class="space-y-6">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article
        v-for="stat in stats"
        :key="stat.labelKey"
        class="rounded-3xl border border-white/10 bg-white/4 p-5 shadow-xl shadow-black/20"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
              {{ $t(stat.labelKey) }}
            </p>
            <h3 class="mt-3 text-3xl font-black text-white">
              {{ stat.value }}
            </h3>
          </div>
          <span
            class="grid size-12 place-items-center rounded-2xl bg-linear-to-br text-lg text-white shadow-lg"
            :class="stat.accent"
          >
            <i :class="stat.icon" aria-hidden="true"></i>
          </span>
        </div>
        <p class="mt-4 text-sm font-bold text-emerald-200">
          {{ $t(stat.trendKey, stat.trendParams) }}
        </p>
      </article>
    </div>

    <p
      v-if="errorMessage"
      class="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
    >
      {{ $t(errorMessage) }}
    </p>

    <div class="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
              {{ $t('admin.dashboard.summary') }}
            </p>
            <h3 class="mt-1 text-2xl font-black text-white">
              {{ $t('admin.dashboard.platformStatus') }}
            </h3>
          </div>
          <a
            href="/admin/votaciones"
            class="rounded-full border border-fuchsia-300/30 bg-fuchsia-400/10 px-4 py-2 text-sm font-black text-fuchsia-100 transition hover:bg-fuchsia-400/20"
          >
            {{ $t('admin.dashboard.viewAll') }}
          </a>
        </div>

        <div class="mt-6 grid gap-4 md:grid-cols-3">
          <div
            v-for="card in summaryCards"
            :key="card.labelKey"
            class="rounded-2xl border border-white/10 bg-slate-950/45 p-4"
          >
            <p class="text-sm font-bold text-slate-300">{{ $t(card.labelKey) }}</p>
            <p class="mt-3 text-3xl font-black" :class="card.textClass">{{ card.value }}</p>
            <div class="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                class="h-full rounded-full"
                :class="card.barClass"
                :style="{ width: `${card.percent}%` }"
              ></div>
            </div>
          </div>
        </div>
      </article>

      <aside class="space-y-6">
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
              {{ $t(action.labelKey) }}
            </a>
          </div>
        </article>

        <article class="rounded-3xl border border-white/10 bg-white/4 p-5">
          <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
            {{ $t('admin.dashboard.recentActivity') }}
          </p>
          <div v-if="isLoading" class="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm font-bold text-slate-300">
            {{ $t('admin.dashboard.loading') }}
          </div>
          <div v-else-if="!recentActivity.length" class="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm font-bold text-slate-300">
            {{ $t('admin.dashboard.activity.empty') }}
          </div>
          <div v-else class="mt-4 space-y-4">
            <div
              v-for="activity in recentActivity"
              :key="activity.id"
              class="border-b border-white/10 pb-4 last:border-0 last:pb-0"
            >
              <p class="font-black text-white">{{ $t(activity.titleKey) }}</p>
              <p class="mt-1 text-sm text-slate-300">
                {{ activity.detailKey ? $t(activity.detailKey, activity.detailParams) : activity.detail }}
              </p>
              <p class="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                {{ activity.time }}
              </p>
            </div>
          </div>
        </article>
      </aside>
    </div>
  </section>
</template>
