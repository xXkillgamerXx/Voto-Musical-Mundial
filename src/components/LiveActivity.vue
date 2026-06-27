<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { subscribeArtistsCached, subscribeLivePollsCached } from '../services/firebaseCache'

const artists = ref([])
const recentVotes = ref([])
const publicPollActivities = ref([])
let unsubscribeArtists = null
let unsubscribeLivePolls = null

const colorOptions = [
  'from-fuchsia-500 to-violet-500',
  'from-pink-500 to-rose-500',
  'from-blue-500 to-violet-500',
  'from-violet-500 to-fuchsia-500',
  'from-cyan-400 to-emerald-400',
  'from-orange-400 to-rose-500',
]
const visualOptions = [
  'from-slate-950 via-indigo-950 to-black',
  'from-slate-950 via-fuchsia-950 to-black',
  'from-slate-950 via-blue-950 to-black',
  'from-slate-950 via-purple-950 to-black',
  'from-slate-950 via-cyan-950 to-black',
  'from-slate-950 via-orange-950 to-black',
]

const getArtist = (artistId) => artists.value.find((artist) => artist.id === artistId)
const getArtistImage = (artist) =>
  artist?.image || artist?.imageUrl || artist?.photo || artist?.photoURL || artist?.foto || artist?.banner || ''

const formatTime = (createdAt) => {
  const date = createdAt?.toDate?.()

  if (!date) {
    return 'ahora'
  }

  const seconds = Math.max(Math.floor((Date.now() - date.getTime()) / 1000), 0)

  if (seconds < 60) {
    return `hace ${seconds || 1} segundos`
  }

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) {
    return `hace ${minutes} min`
  }

  return `hace ${Math.floor(minutes / 60)} h`
}

const userLabel = (userId) => `Fan ${String(userId || '').slice(-4).toUpperCase() || 'VMM'}`

const realActivities = computed(() =>
  recentVotes.value.map((vote, index) => {
    const artist = getArtist(vote.artistId)
    const artistName = artist?.name || 'Artista'

    return {
      user: userLabel(vote.userId),
      artist: artistName,
      artistImage: getArtistImage(artist),
      time: formatTime(vote.createdAt),
      votes: Number(vote.amount || 1),
      streak: '+1',
      color: colorOptions[index % colorOptions.length],
      visual: visualOptions[index % visualOptions.length],
    }
  }),
)
const activities = computed(() => {
  if (realActivities.value.length) {
    return realActivities.value
  }

  if (publicPollActivities.value.length) {
    return publicPollActivities.value
  }
  return []
})

const activeUsers = computed(() =>
  realActivities.value.length
    ? new Set(recentVotes.value.map((vote) => vote.userId).filter(Boolean)).size
    : publicPollActivities.value.length,
)
const votesPerMinute = computed(() =>
  realActivities.value.length
    ? recentVotes.value
      .filter((vote) => {
        const voteTime = vote.createdAt?.toMillis?.()
        return voteTime && Date.now() - voteTime <= 60000
      })
      .reduce((total, vote) => total + Number(vote.amount || 1), 0)
    : publicPollActivities.value.reduce((total, activity) => total + Number(activity.votes || 0), 0),
)
const onlineFandoms = computed(() =>
  realActivities.value.length
    ? new Set(recentVotes.value.map((vote) => vote.artistId).filter(Boolean)).size
    : new Set(publicPollActivities.value.map((activity) => activity.artist).filter(Boolean)).size,
)

const liveStats = computed(() => [
  {
    label: 'Usuarios activos',
    value: activeUsers.value.toLocaleString('es'),
    icon: 'fa-solid fa-users',
  },
  {
    label: 'Votos por minuto',
    value: votesPerMinute.value.toLocaleString('es'),
    icon: 'fa-solid fa-bolt',
  },
  {
    label: 'Fandoms online',
    value: onlineFandoms.value.toLocaleString('es'),
    icon: 'fa-solid fa-fire',
  },
])

const buildPublicPollActivities = (pollRows) => {
  publicPollActivities.value = pollRows
    .flatMap((poll) => poll.publicActivity || [])
    .filter((entry) => entry.artistId && Number(entry.amount || entry.votes || 0) > 0)
    .slice(0, 8)
    .map((entry, index) => ({
      user: entry.userDisplayName || userLabel(entry.userId),
      artist: getArtist(entry.artistId)?.name || 'Artista',
      artistImage: getArtistImage(getArtist(entry.artistId)),
      time: 'en vivo',
      votes: Number(entry.amount || entry.votes || 0),
      streak: index < 3 ? 'Top' : '+1',
      color: colorOptions[index % colorOptions.length],
      visual: visualOptions[index % visualOptions.length],
    }))
}

onMounted(() => {
  unsubscribeArtists = subscribeArtistsCached(null, (artistRows) => {
    artists.value = artistRows
  })

  unsubscribeLivePolls = subscribeLivePollsCached(
    null,
    (pollRows) => {
      buildPublicPollActivities(pollRows)
    },
    () => {
      publicPollActivities.value = []
    },
  )
})

onUnmounted(() => {
  unsubscribeArtists?.()
  unsubscribeLivePolls?.()
})
</script>

<template>
  <section class="live-activity-surface mx-auto max-w-352 px-4 py-6 sm:px-6 lg:py-8">
    <div class="relative overflow-hidden rounded-4xl border border-violet-300/15 bg-[#070918]/90 p-4 shadow-2xl shadow-violet-950/20 sm:p-6">
      <div class="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-fuchsia-400/15 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-24 right-0 size-80 rounded-full bg-cyan-400/10 blur-3xl"></div>

      <div class="relative mb-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div class="flex items-start gap-4">
          <span class="live-orb grid size-13 shrink-0 place-items-center rounded-3xl border border-fuchsia-300/25 bg-fuchsia-400/10 text-fuchsia-100 shadow-xl shadow-fuchsia-950/30">
            <i class="fa-solid fa-signal" aria-hidden="true"></i>
          </span>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
                En tiempo real
              </h2>
              <span class="inline-flex items-center gap-2 rounded-full border border-red-300/30 bg-red-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-100">
                <span class="size-2 rounded-full bg-red-300 shadow-[0_0_12px_rgba(252,165,165,0.9)]"></span>
                Live
              </span>
            </div>
            <p class="mt-1 text-sm text-slate-400">
              Usuarios votando ahora. Cada voto empuja a tu artista en el ranking.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div
            v-for="stat in liveStats"
            :key="stat.label"
            class="rounded-2xl border border-white/10 bg-white/6 px-3 py-3 text-center shadow-inner shadow-black/20"
          >
            <i class="text-sm text-fuchsia-200" :class="stat.icon" aria-hidden="true"></i>
            <p class="mt-1 text-lg font-black text-white">{{ stat.value }}</p>
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">{{ stat.label }}</p>
          </div>
        </div>
      </div>

      <div
        v-if="activities.length"
        class="live-scroll relative max-h-[520px] space-y-2 overflow-y-auto sm:max-h-[650px] sm:space-y-3 sm:pr-2"
      >
        <article
          v-for="(activity, index) in activities"
          :key="`${activity.user}-${activity.time}`"
          class="group relative min-h-24 overflow-hidden rounded-3xl border border-white/8 bg-[#070b1a]/90 p-3 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-fuchsia-300/25 hover:bg-[#101429] sm:min-h-32 sm:p-4"
        >
          <div class="absolute inset-y-0 right-0 w-32 bg-linear-to-l opacity-95 sm:w-72" :class="activity.visual">
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_76%_30%,rgba(255,255,255,0.24),transparent_18%),linear-gradient(90deg,#070b1a_0%,rgba(7,11,26,0.72)_38%,transparent_78%)] sm:bg-[radial-gradient(circle_at_72%_28%,rgba(255,255,255,0.28),transparent_18%),linear-gradient(90deg,#070b1a_0%,rgba(7,11,26,0.55)_34%,transparent_72%)]"></div>
            <div class="absolute bottom-0 right-5 h-24 w-28 rounded-t-full bg-black/25 blur-sm sm:right-10 sm:h-28 sm:w-36"></div>
            <div
              class="absolute right-5 top-1/2 grid size-18 -translate-y-1/2 place-items-center overflow-hidden rounded-full border border-white/15 bg-black/25 text-5xl font-black text-white/55 shadow-2xl shadow-black/30 drop-shadow-[0_0_24px_rgba(255,255,255,0.22)] sm:right-16 sm:size-28 sm:text-8xl sm:text-white/70"
            >
              <img
                v-if="activity.artistImage"
                :src="activity.artistImage"
                :alt="activity.artist"
                class="size-full object-cover"
              />
              <span v-else>
              {{ activity.artist.charAt(0) }}
              </span>
            </div>
          </div>

          <div class="relative z-10 flex min-h-18 items-center gap-3 pr-24 sm:min-h-24 sm:gap-4 sm:pr-60">
            <span class="relative grid size-12 shrink-0 place-items-center rounded-full bg-linear-to-br text-base font-black shadow-lg shadow-black/30 ring-2 ring-white/10 sm:size-16 sm:text-xl" :class="activity.color">
              {{ activity.user.charAt(0) }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-black leading-tight text-white sm:text-base">{{ activity.user }}</h3>
                <span class="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-200">
                  {{ $t('widgets.activity.online') }}
                </span>
              </div>
              <p class="mt-0.5 text-xs leading-tight text-slate-300 sm:text-sm">{{ $t('widgets.activity.justVotedFor') }}</p>
              <p class="mt-0.5 text-sm font-black uppercase leading-tight text-white sm:text-base">{{ activity.artist }}</p>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <span class="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1 text-[11px] font-black text-fuchsia-100">
                  <i class="fa-solid fa-heart mr-1" aria-hidden="true"></i>
                  {{ $t('widgets.activity.votes', { count: activity.votes }) }}
                </span>
                <span class="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-black text-cyan-100">
                  {{ $t('widgets.activity.streak', { count: activity.streak }) }}
                </span>
                <span class="text-[11px] text-slate-500 sm:text-xs">{{ activity.time }}</span>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div
        v-else
        class="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 text-center"
      >
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(217,70,239,0.16),transparent_34%),radial-gradient(circle_at_85%_75%,rgba(34,211,238,0.12),transparent_30%)]"></div>
        <div class="relative mx-auto grid size-14 place-items-center rounded-3xl border border-cyan-200/20 bg-cyan-300/10 text-xl text-cyan-200">
          <i class="fa-solid fa-user-clock" aria-hidden="true"></i>
        </div>
        <h3 class="relative mt-4 text-lg font-black uppercase text-white">
          No hay usuarios activos ahora
        </h3>
        <p class="relative mx-auto mt-2 max-w-lg text-sm font-bold leading-6 text-slate-400">
          Cuando alguien vote en una votacion activa, la actividad aparecera aqui en tiempo real.
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.live-scroll {
  scrollbar-color: rgba(168, 85, 247, 0.85) rgba(255, 255, 255, 0.08);
  scrollbar-width: thin;
}

.live-scroll::-webkit-scrollbar {
  width: 6px;
}

.live-scroll::-webkit-scrollbar-track {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.live-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: linear-gradient(180deg, #a855f7, #22d3ee);
}

.live-orb {
  animation: live-orb 2.5s ease-in-out infinite;
}

@keyframes live-orb {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 18px 38px rgba(217, 70, 239, 0.2);
  }

  50% {
    transform: scale(1.08);
    box-shadow: 0 0 52px rgba(217, 70, 239, 0.42);
  }
}
</style>
