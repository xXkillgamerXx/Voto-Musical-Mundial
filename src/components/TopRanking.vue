<script setup>
const topArtists = [
  {
    rank: 2,
    name: 'Jimin',
    group: 'BTS',
    percent: '24.7%',
    votes: '1,754,892',
    accent: 'from-sky-400 to-violet-500',
    border: 'border-sky-300/35',
  },
  {
    rank: 1,
    name: 'Jungkook',
    group: 'BTS',
    percent: '32.5%',
    votes: '2,135,321',
    accent: 'from-amber-300 to-fuchsia-500',
    border: 'border-amber-300/45',
    featured: true,
  },
  {
    rank: 3,
    name: 'Lisa',
    group: 'BLACKPINK',
    percent: '18.6%',
    votes: '1,321,654',
    accent: 'from-orange-400 to-pink-500',
    border: 'border-orange-300/40',
  },
]
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-6 sm:px-6 lg:py-8">
    <div class="mb-5 flex items-center justify-between gap-4">
      <h2 class="flex items-center gap-2 text-lg font-black uppercase tracking-tight sm:text-xl">
        <span class="text-amber-300">✦</span>
        Ranking Top 3
      </h2>
      <a href="#" class="text-xs font-black uppercase tracking-wide text-violet-300 hover:text-white">
        Ver ranking
      </a>
    </div>

    <div class="relative overflow-visible rounded-4xl border border-violet-300/10 bg-[#050716] px-4 pb-10 pt-20 shadow-2xl shadow-violet-950/30 sm:px-6 lg:px-10 lg:pb-14 lg:pt-24">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_115%,rgba(168,85,247,0.55),transparent_32%),radial-gradient(circle_at_50%_5%,rgba(59,130,246,0.18),transparent_30%)]"></div>
      <div class="absolute bottom-8 left-1/2 h-52 w-[110%] -translate-x-1/2 rounded-[100%] border-t border-fuchsia-300/30 bg-fuchsia-500/8 shadow-[0_0_100px_rgba(217,70,239,0.28)]"></div>
      <div class="absolute bottom-0 left-0 h-36 w-full bg-linear-to-t from-[#050716] via-[#050716]/75 to-transparent"></div>

      <div class="relative mx-auto grid max-w-5xl gap-4 sm:grid-cols-3 sm:items-end">
        <article
          v-for="artist in topArtists"
          :key="artist.name"
          class="relative rounded-3xl border bg-black/25 shadow-2xl shadow-black/40 backdrop-blur"
          :class="[artist.border, artist.featured ? 'min-h-112 sm:min-h-120 sm:-translate-y-6' : 'min-h-104 sm:min-h-112']"
        >
          <div class="absolute inset-x-0 bottom-0 z-10 h-80 rounded-b-3xl bg-[linear-gradient(0deg,#000_0%,rgba(0,0,0,0.98)_36%,rgba(0,0,0,0.68)_68%,transparent_100%)]"></div>
          <div class="absolute -right-16 -top-16 size-40 rounded-full bg-white/10 blur-3xl"></div>

          <div
            class="absolute inset-x-0 top-0 overflow-hidden rounded-t-3xl bg-linear-to-br"
            :class="[artist.accent, artist.featured ? 'h-96' : 'h-88']"
          >
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(255,255,255,0.25),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.48))]"></div>
            <div class="absolute left-1/2 top-1/2 grid size-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/25 backdrop-blur">
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
            <h3 class="text-2xl font-black uppercase">{{ artist.name }}</h3>
            <p class="text-sm font-bold uppercase text-slate-300">{{ artist.group }}</p>

            <div class="mt-4">
              <p
                class="text-3xl font-black"
                :class="artist.rank === 1 ? 'text-amber-300' : 'text-violet-200'"
              >
                {{ artist.percent }}
              </p>
              <p class="mt-1 text-sm text-slate-300">{{ artist.votes }} votos</p>
            </div>
          </div>

          <div
            v-if="artist.rank === 1"
            class="absolute -top-4 left-1/2 h-12 w-28 -translate-x-1/2 rounded-full border border-amber-200/40 bg-amber-300/10 blur-sm"
          ></div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rank-star {
  animation: rank-star-pop 1.45s ease-in-out infinite;
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

