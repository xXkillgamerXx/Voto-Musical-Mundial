<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'

const dbMissions = ref([])
let unsubscribeMissions = null

const fallbackMissions = [
  {
    icon: '✓',
    titleKey: 'home.missions.items.voteTen.title',
    textKey: 'home.missions.items.voteTen.text',
    reward: '+40 pts',
    progress: '4/10',
    percent: 40,
    statusKey: 'common.status.inProgress',
    featured: true,
  },
  {
    icon: '♡',
    titleKey: 'home.missions.items.likePoll.title',
    textKey: 'home.missions.items.likePoll.text',
    reward: '+15 pts',
    progress: '0/1',
    percent: 0,
    statusKey: 'common.status.pending',
  },
  {
    icon: '↗',
    titleKey: 'home.missions.items.shareFandom.title',
    textKey: 'home.missions.items.shareFandom.text',
    reward: '+25 pts',
    progress: '0/1',
    percent: 0,
    statusKey: 'common.status.pending',
  },
  {
    icon: '+',
    titleKey: 'home.missions.items.followAccount.title',
    textKey: 'home.missions.items.followAccount.text',
    reward: '+30 pts',
    progress: '1/1',
    percent: 100,
    statusKey: 'common.status.ready',
    done: true,
  },
]

const isFontAwesomeIcon = (icon) => String(icon || '').startsWith('fa-')

const missions = computed(() => {
  if (!dbMissions.value.length) {
    return fallbackMissions
  }

  return dbMissions.value
    .filter((mission) => mission.active !== false)
    .slice(0, 8)
    .map((mission) => {
      const target = Math.max(1, Number(mission.target || 1))

      return {
        id: mission.id,
        icon: mission.icon || 'fa-solid fa-check',
        title: mission.title || 'Mision',
        text: mission.description || '',
        reward: `+${Number(mission.rewardPoints || 0)} pts`,
        progress: `0/${target}`,
        percent: 0,
        statusKey: 'common.status.pending',
        featured: Boolean(mission.featured),
        done: false,
      }
    })
})

onMounted(() => {
  unsubscribeMissions = onSnapshot(
    query(collection(db, 'missions'), orderBy('order', 'asc')),
    (missionsSnap) => {
      dbMissions.value = missionsSnap.docs.map((missionDoc) => ({
        id: missionDoc.id,
        ...missionDoc.data(),
      }))
    },
    () => {
      dbMissions.value = []
    },
  )
})

onUnmounted(() => {
  unsubscribeMissions?.()
})
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-6 sm:px-6 lg:py-8">
    <div class="mb-5 flex items-center justify-between gap-4">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
          {{ $t('home.missions.eyebrow') }}
        </p>
        <h2 class="mt-2 text-2xl font-black uppercase tracking-tight sm:text-3xl">
          {{ $t('home.missions.title') }}
        </h2>
      </div>

      <span class="rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm font-black text-amber-100">
        {{ $t('common.points', { count: '2,450' }) }}
      </span>
    </div>

    <div class="missions-slider -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
      <article
        v-for="mission in missions"
        :key="mission.id || mission.titleKey"
        class="relative min-w-[86%] snap-center overflow-hidden rounded-3xl border p-5 shadow-xl shadow-violet-950/25 sm:min-w-[48%] lg:min-w-0"
        :class="[
          mission.featured && 'border-fuchsia-300/35 bg-fuchsia-500/10',
          mission.done && 'border-emerald-300/35 bg-emerald-500/10',
          !mission.featured && !mission.done && 'border-violet-300/10 bg-[#090b19]/85',
        ]"
      >
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(217,70,239,0.18),transparent_32%)]"></div>

        <div class="relative">
          <div class="flex items-start justify-between gap-4">
            <span
              class="grid size-12 place-items-center rounded-2xl border text-xl font-black"
              :class="mission.done ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200' : 'border-white/10 bg-white/5 text-fuchsia-200'"
            >
              <i
                v-if="isFontAwesomeIcon(mission.icon)"
                :class="mission.icon"
                aria-hidden="true"
              ></i>
              <span v-else>{{ mission.icon }}</span>
            </span>

            <span
              class="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide"
              :class="mission.done ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/5 text-slate-300'"
            >
              {{ $t(mission.statusKey) }}
            </span>
          </div>

          <h3 class="mt-5 text-lg font-black uppercase leading-tight">
            {{ mission.title || $t(mission.titleKey) }}
          </h3>
          <p class="mt-2 text-sm leading-6 text-slate-400">
            {{ mission.text || $t(mission.textKey) }}
          </p>

          <div class="mt-5 flex items-end justify-between gap-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-widest text-slate-500">{{ $t('common.labels.progress') }}</p>
              <p class="mt-1 text-sm font-black text-white">{{ mission.progress }}</p>
            </div>
            <p class="text-xl font-black text-fuchsia-200">{{ mission.reward }}</p>
          </div>

          <div class="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              class="h-full rounded-full bg-linear-to-r from-cyan-400 to-fuchsia-500"
              :style="{ width: `${mission.percent}%` }"
            ></div>
          </div>

          <button
            type="button"
            class="mt-5 min-h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-black uppercase text-slate-100 transition hover:bg-white/10"
          >
            {{ mission.done ? $t('common.status.completed') : $t('home.missions.doMission') }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.missions-slider {
  scrollbar-width: none;
}

.missions-slider::-webkit-scrollbar {
  display: none;
}
</style>
