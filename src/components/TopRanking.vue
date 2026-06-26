<script setup>
import { computed, onMounted, ref } from 'vue'
import { db } from '../firebase'
import { getArtistsWithFollowersCached } from '../services/firebaseCache'

const artists = ref([])
const WEEKLY_ROTATION_POOL_SIZE = 12

const accents = [
  { accent: 'from-amber-300 to-fuchsia-500', border: 'border-amber-300/45' },
  { accent: 'from-sky-400 to-violet-500', border: 'border-sky-300/35' },
  { accent: 'from-orange-400 to-pink-500', border: 'border-orange-300/40' },
]

const getArtistImage = (artist) =>
  artist?.image || artist?.imageUrl || artist?.photo || artist?.photoURL || artist?.foto || artist?.banner || ''

const getArtistGroup = (artist) => artist?.group || artist?.fandom || ''

const getWeeklyRotationIndex = (itemsLength) => {
  if (!itemsLength) {
    return 0
  }

  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const weekNumber = Math.floor((now - yearStart) / (7 * 24 * 60 * 60 * 1000))

  return weekNumber % itemsLength
}

const rotateWeekly = (items) => {
  const offset = getWeeklyRotationIndex(items.length)

  return [...items.slice(offset), ...items.slice(0, offset)]
}

const topArtists = computed(() =>
  rotateWeekly(artists.value
    .slice()
    .sort((current, next) =>
      next.followersCount - current.followersCount
        || next.popularityScore - current.popularityScore
        || current.name.localeCompare(next.name),
    )
    .slice(0, WEEKLY_ROTATION_POOL_SIZE))
    .slice(0, 3)
    .map((artist, index) => ({
      ...artist,
      rank: index + 1,
      featured: index === 0,
      ...accents[index],
    })),
)

const podiumArtists = computed(() => {
  const [first, second, third] = topArtists.value
  return [second, first, third].filter(Boolean)
})

const mobileTopArtists = computed(() => topArtists.value)

const loadArtists = async () => {
  artists.value = await getArtistsWithFollowersCached(db)
}

onMounted(loadArtists)
</script>

<template>
  <section class="top-ranking-surface mx-auto max-w-352 px-4 py-6 sm:px-6 lg:py-8">
    <div class="mb-5 flex items-center justify-between gap-4">
      <h2 class="flex items-center gap-2 text-lg font-black uppercase tracking-tight sm:text-xl">
        <span class="text-amber-300">✦</span>
        Artistas populares de la semana
      </h2>
      <a href="/artistas" class="text-xs font-black uppercase tracking-wide text-violet-300 hover:text-white">
        Ver artistas
      </a>
    </div>

    <div
      v-if="topArtists.length"
      class="relative overflow-visible rounded-4xl border border-violet-300/10 bg-[#050716] px-0 pb-5 pt-10 shadow-2xl shadow-violet-950/30 sm:px-6 sm:pt-20 lg:px-10 lg:pb-8 lg:pt-24"
    >
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_115%,rgba(168,85,247,0.55),transparent_32%),radial-gradient(circle_at_50%_5%,rgba(59,130,246,0.18),transparent_30%)]"></div>
      <div class="absolute bottom-8 left-1/2 h-52 w-[110%] -translate-x-1/2 rounded-[100%] border-t border-fuchsia-300/30 bg-fuchsia-500/8 shadow-[0_0_100px_rgba(217,70,239,0.28)]"></div>
      <div class="absolute bottom-0 left-0 h-36 w-full bg-linear-to-t from-[#050716] via-[#050716]/75 to-transparent"></div>

      <div class="mobile-ranking-slider relative flex snap-x gap-4 overflow-x-auto px-4 pb-2 pt-8 sm:hidden">
        <article
          v-for="artist in mobileTopArtists"
          :key="artist.id"
          class="top-ranking-card relative min-w-[88%] snap-center rounded-3xl border bg-black/25 shadow-2xl shadow-black/40 backdrop-blur"
          :class="[artist.border, artist.featured ? 'min-h-112' : 'min-h-96']"
        >
          <div class="top-ranking-info-overlay absolute inset-x-0 bottom-0 z-10 h-68 rounded-b-3xl bg-linear-to-t from-black/90 via-black/65 to-transparent"></div>
          <div class="absolute -right-16 -top-16 size-40 rounded-full bg-white/10 blur-3xl"></div>

          <div
            class="top-ranking-photo absolute inset-x-0 top-0 overflow-hidden rounded-t-3xl bg-linear-to-br"
            :class="[artist.accent, artist.featured ? 'h-96' : 'h-80']"
          >
            <img
              v-if="getArtistImage(artist)"
              :src="getArtistImage(artist)"
              :alt="artist.name"
              loading="lazy"
              decoding="async"
              class="absolute inset-0 size-full object-cover object-top"
            />
            <div class="top-ranking-image-overlay absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.16),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(0,0,0,0.08)_44%,rgba(0,0,0,0.42)_100%)]"></div>
            <div
              v-if="!getArtistImage(artist)"
              class="absolute left-1/2 top-1/2 grid size-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/25 backdrop-blur"
            >
              <span class="text-5xl font-black">{{ artist.name.charAt(0) }}</span>
            </div>
          </div>

          <span
            class="absolute top-0 left-1/2 z-20 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/35 bg-linear-to-r text-3xl font-black leading-none text-white shadow-[0_0_22px_rgba(168,85,247,0.65)] ring-4 ring-[#050716]"
            :class="artist.accent"
          >
            {{ artist.rank }}
          </span>
          <span
            v-if="artist.rank === 1"
            class="rank-star rank-star-left absolute top-0 left-1/2 z-30 -translate-x-16 -translate-y-1/2 text-lg leading-none text-amber-200 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]"
          >
            ✦
          </span>
          <span
            v-if="artist.rank === 1"
            class="rank-star rank-star-right absolute top-0 left-1/2 z-30 translate-x-12 -translate-y-1/2 text-lg leading-none text-amber-200 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]"
          >
            ✦
          </span>
          <span
            v-if="artist.rank === 1"
            class="rank-star rank-star-top absolute top-0 left-1/2 z-30 -translate-x-1/2 -translate-y-12 text-sm leading-none text-yellow-100 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]"
          >
            ✦
          </span>

          <div class="absolute inset-x-0 bottom-0 z-20 p-5">
            <h3 class="text-3xl font-black uppercase leading-none tracking-tight">{{ artist.name }}</h3>
            <p class="mt-1 text-xs font-black uppercase tracking-widest text-fuchsia-100">{{ getArtistGroup(artist) || $t('artists.list.noGroup') }}</p>

            <div class="mt-5 inline-grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/8 p-2 backdrop-blur">
              <div class="top-ranking-stat-card rounded-xl bg-black/25 px-3 py-2">
                <p
                  class="text-2xl font-black leading-none"
                  :class="artist.rank === 1 ? 'text-amber-300' : 'text-violet-200'"
                >
                  {{ artist.followersCount.toLocaleString('es') }}
                </p>
                <p class="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-300">{{ $t('artists.list.followers') }}</p>
              </div>
              <div class="top-ranking-stat-card rounded-xl bg-black/25 px-3 py-2">
                <p
                  class="text-2xl font-black leading-none"
                  :class="artist.rank === 1 ? 'text-fuchsia-200' : 'text-cyan-200'"
                >
                  {{ artist.popularityScore.toLocaleString('es') }}
                </p>
                <p class="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-300">pts</p>
              </div>
            </div>
          </div>

          <div
            v-if="artist.rank === 1"
            class="absolute -top-4 left-1/2 h-12 w-28 -translate-x-1/2 rounded-full border border-amber-200/40 bg-amber-300/10 blur-sm"
          ></div>
        </article>
      </div>

      <div class="relative mx-auto hidden max-w-5xl gap-4 sm:grid sm:grid-cols-3 sm:items-end">
        <article
          v-for="artist in podiumArtists"
          :key="artist.id"
          class="top-ranking-card relative rounded-3xl border bg-black/25 shadow-2xl shadow-black/40 backdrop-blur"
          :class="[artist.border, artist.featured ? 'min-h-112 sm:min-h-120 sm:-translate-y-6' : 'min-h-96 sm:min-h-104 sm:scale-[0.94]']"
        >
          <div class="top-ranking-info-overlay absolute inset-x-0 bottom-0 z-10 h-68 rounded-b-3xl bg-linear-to-t from-black/90 via-black/65 to-transparent"></div>
          <div class="absolute -right-16 -top-16 size-40 rounded-full bg-white/10 blur-3xl"></div>

          <div
            class="top-ranking-photo absolute inset-x-0 top-0 overflow-hidden rounded-t-3xl bg-linear-to-br"
            :class="[artist.accent, artist.featured ? 'h-96' : 'h-78']"
          >
            <img
              v-if="getArtistImage(artist)"
              :src="getArtistImage(artist)"
              :alt="artist.name"
              loading="lazy"
              decoding="async"
              class="absolute inset-0 size-full object-cover object-top"
            />
            <div class="top-ranking-image-overlay absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.16),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(0,0,0,0.08)_44%,rgba(0,0,0,0.42)_100%)]"></div>
            <div
              v-if="!getArtistImage(artist)"
              class="absolute left-1/2 top-1/2 grid size-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/25 backdrop-blur"
            >
              <span class="text-5xl font-black">{{ artist.name.charAt(0) }}</span>
            </div>
          </div>

          <span
            class="absolute top-0 left-1/2 z-20 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/35 bg-linear-to-r text-3xl font-black leading-none text-white shadow-[0_0_22px_rgba(168,85,247,0.65)] ring-4 ring-[#050716]"
            :class="artist.accent"
          >
            {{ artist.rank }}
          </span>
          <span
            v-if="artist.rank === 1"
            class="rank-star rank-star-left absolute top-0 left-1/2 z-30 -translate-x-16 -translate-y-1/2 text-lg leading-none text-amber-200 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]"
          >
            ✦
          </span>
          <span
            v-if="artist.rank === 1"
            class="rank-star rank-star-right absolute top-0 left-1/2 z-30 translate-x-12 -translate-y-1/2 text-lg leading-none text-amber-200 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]"
          >
            ✦
          </span>
          <span
            v-if="artist.rank === 1"
            class="rank-star rank-star-top absolute top-0 left-1/2 z-30 -translate-x-1/2 -translate-y-12 text-sm leading-none text-yellow-100 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]"
          >
            ✦
          </span>

          <div class="absolute inset-x-0 bottom-0 z-20 p-5">
            <h3 class="text-3xl font-black uppercase leading-none tracking-tight">{{ artist.name }}</h3>
            <p class="mt-1 text-xs font-black uppercase tracking-widest text-fuchsia-100">{{ getArtistGroup(artist) || $t('artists.list.noGroup') }}</p>

            <div class="mt-5 inline-grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/8 p-2 backdrop-blur">
              <div class="top-ranking-stat-card rounded-xl bg-black/25 px-3 py-2">
                <p
                  class="text-2xl font-black leading-none"
                  :class="artist.rank === 1 ? 'text-amber-300' : 'text-violet-200'"
                >
                  {{ artist.followersCount.toLocaleString('es') }}
                </p>
                <p class="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-300">{{ $t('artists.list.followers') }}</p>
              </div>
              <div class="top-ranking-stat-card rounded-xl bg-black/25 px-3 py-2">
                <p
                  class="text-2xl font-black leading-none"
                  :class="artist.rank === 1 ? 'text-fuchsia-200' : 'text-cyan-200'"
                >
                  {{ artist.popularityScore.toLocaleString('es') }}
                </p>
                <p class="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-300">pts</p>
              </div>
            </div>
          </div>

          <div
            v-if="artist.rank === 1"
            class="absolute -top-4 left-1/2 h-12 w-28 -translate-x-1/2 rounded-full border border-amber-200/40 bg-amber-300/10 blur-sm"
          ></div>
        </article>
      </div>
    </div>

    <p
      v-else
      class="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm font-bold text-slate-400"
    >
      Todavía no hay artistas populares para mostrar.
    </p>
  </section>
</template>

<style scoped>
.rank-star {
  animation: rank-star-pop 1.45s ease-in-out infinite;
}

.mobile-ranking-slider {
  scrollbar-width: none;
}

.mobile-ranking-slider::-webkit-scrollbar {
  display: none;
}

.rank-star-right {
  animation-delay: 0.25s;
}

.rank-star-top {
  animation-delay: 0.5s;
}

@keyframes rank-star-pop {
  0%,
  100% {
    opacity: 0.45;
    scale: 0.75;
    rotate: -12deg;
  }

  50% {
    opacity: 1;
    scale: 1.25;
    rotate: 12deg;
  }
}

</style>

