<script setup>
const stats = [
  {
    labelKey: 'admin.dashboard.stats.votesToday',
    value: '48,920',
    trend: '+12.4%',
    icon: 'fa-solid fa-check-to-slot',
    accent: 'from-fuchsia-500 to-violet-500',
  },
  {
    labelKey: 'admin.dashboard.stats.activeUsers',
    value: '8,231',
    trend: '+6.8%',
    icon: 'fa-solid fa-users',
    accent: 'from-cyan-500 to-blue-500',
  },
  {
    labelKey: 'admin.dashboard.stats.openPolls',
    value: '14',
    trendKey: 'admin.dashboard.stats.closeToday',
    icon: 'fa-solid fa-ranking-star',
    accent: 'from-amber-400 to-orange-500',
  },
  {
    labelKey: 'admin.dashboard.stats.pendingReports',
    value: '7',
    trendKey: 'admin.dashboard.stats.review',
    icon: 'fa-solid fa-triangle-exclamation',
    accent: 'from-rose-500 to-pink-500',
  },
]

const quickActions = [
  'admin.dashboard.quickActions.createPoll',
  'admin.dashboard.quickActions.addArtist',
  'admin.dashboard.quickActions.reviewReports',
  'admin.dashboard.quickActions.publishNews',
]

const recentActivity = [
  {
    titleKey: 'admin.dashboard.activity.newPoll',
    detail: 'Best Kpop Leaders 2026',
    timeKey: 'admin.dashboard.activity.twelveMin',
  },
  {
    titleKey: 'admin.dashboard.activity.verifiedUser',
    detail: 'fan.global@email.com',
    timeKey: 'admin.dashboard.activity.twentyFourMin',
  },
  {
    titleKey: 'admin.dashboard.activity.reportReceived',
    detailKey: 'admin.dashboard.activity.reportDetail',
    timeKey: 'admin.dashboard.activity.fortyOneMin',
  },
]
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
          {{ stat.trendKey ? $t(stat.trendKey) : stat.trend }}
        </p>
      </article>
    </div>

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
          <button
            type="button"
            class="rounded-full border border-fuchsia-300/30 bg-fuchsia-400/10 px-4 py-2 text-sm font-black text-fuchsia-100 transition hover:bg-fuchsia-400/20"
          >
            {{ $t('admin.dashboard.viewAll') }}
          </button>
        </div>

        <div class="mt-6 grid gap-4 md:grid-cols-3">
          <div class="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <p class="text-sm font-bold text-slate-300">{{ $t('admin.dashboard.voteConversion') }}</p>
            <p class="mt-3 text-3xl font-black text-cyan-200">74%</p>
            <div class="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div class="h-full w-[74%] rounded-full bg-cyan-300"></div>
            </div>
          </div>
          <div class="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <p class="text-sm font-bold text-slate-300">{{ $t('admin.dashboard.fanParticipation') }}</p>
            <p class="mt-3 text-3xl font-black text-fuchsia-200">89%</p>
            <div class="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div class="h-full w-[89%] rounded-full bg-fuchsia-300"></div>
            </div>
          </div>
          <div class="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <p class="text-sm font-bold text-slate-300">{{ $t('admin.dashboard.systemHealth') }}</p>
            <p class="mt-3 text-3xl font-black text-emerald-200">OK</p>
            <div class="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div class="h-full w-[96%] rounded-full bg-emerald-300"></div>
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
            <button
              v-for="action in quickActions"
              :key="action"
              type="button"
              class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-black text-white transition hover:border-fuchsia-300/35 hover:bg-white/10"
            >
              {{ $t(action) }}
            </button>
          </div>
        </article>

        <article class="rounded-3xl border border-white/10 bg-white/4 p-5">
          <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
            {{ $t('admin.dashboard.recentActivity') }}
          </p>
          <div class="mt-4 space-y-4">
            <div
              v-for="activity in recentActivity"
              :key="activity.titleKey"
              class="border-b border-white/10 pb-4 last:border-0 last:pb-0"
            >
              <p class="font-black text-white">{{ $t(activity.titleKey) }}</p>
              <p class="mt-1 text-sm text-slate-300">{{ activity.detailKey ? $t(activity.detailKey) : activity.detail }}</p>
              <p class="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                {{ $t(activity.timeKey) }}
              </p>
            </div>
          </div>
        </article>
      </aside>
    </div>
  </section>
</template>
