<script setup>
const popularPolls = [
  {
    title: 'Best Kpop Vocalists 2026',
    category: 'Kpop Vote',
    status: 'Abierta',
    votes: '4,912,709',
    endsIn: '6d 04h',
    leader: 'Jungkook',
    progress: 82,
    type: 'Lista',
    typeLabel: 'Lista',
    visual: 'from-violet-950 via-fuchsia-700 to-indigo-950',
    image: '/contestants/jungkook.png',
  },
  {
    title: 'Best Kpop Leaders 2026',
    category: 'Fan Choice',
    status: 'En vivo',
    votes: '3,284,120',
    endsIn: '12d 08h',
    leader: 'Seungmin',
    progress: 76,
    type: 'Lista',
    typeLabel: 'Lista',
    visual: 'from-indigo-950 via-violet-700 to-fuchsia-900',
    image: '/contestants/lisa.png',
  },
  {
    title: 'Karina vs Wonyoung',
    category: 'Batalla',
    status: 'VS activo',
    votes: '2,840,550',
    endsIn: '02h 45m',
    leader: 'Karina',
    progress: 58,
    type: 'VS',
    typeLabel: 'Versus',
    visual: 'from-slate-900 via-purple-700 to-violet-950',
    opponents: [
      { name: 'Jungkook', image: '/contestants/jungkook.png' },
      { name: 'Lisa', image: '/contestants/lisa.png' },
    ],
  },
]

</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-6 sm:px-6 lg:py-8">
    <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
          <span>✦</span>
          Vota ahora
        </p>
        <h2 class="mt-2 text-2xl font-black uppercase tracking-tight sm:text-3xl">
          Votaciones populares
        </h2>
      </div>
      <a href="#" class="text-sm font-bold text-violet-200 hover:text-white">
        Ver todas →
      </a>
    </div>

    <div class="mobile-polls-slider -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 lg:hidden">
      <article
        v-for="poll in popularPolls"
        :key="poll.title"
        class="group relative min-w-[90%] snap-center overflow-hidden rounded-3xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/30 sm:min-w-[72%]"
      >
        <div class="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-fuchsia-300/50 to-transparent"></div>
        <div class="absolute -right-16 -top-16 size-36 rounded-full bg-fuchsia-500/10 blur-3xl"></div>

        <div
          class="relative h-52 overflow-hidden bg-linear-to-br"
          :class="poll.visual"
        >
          <img
            v-if="poll.image"
            :src="poll.image"
            :alt="poll.leader"
            class="absolute inset-0 size-full object-cover"
          />
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.26),transparent_24%),radial-gradient(circle_at_70%_70%,rgba(217,70,239,0.35),transparent_28%)]"></div>
          <div class="absolute inset-0 bg-linear-to-t from-[#090b19] via-transparent to-white/5"></div>
          <div
            v-if="poll.type === 'VS'"
            class="absolute inset-0 grid grid-cols-2"
          >
            <div class="relative overflow-hidden">
              <img :src="poll.opponents[0].image" :alt="poll.opponents[0].name" class="size-full object-cover object-center" />
              <div class="absolute inset-0 bg-linear-to-t from-[#090b19]/80 via-transparent to-transparent"></div>
            </div>
            <div class="absolute left-1/2 top-1/2 z-10 grid size-13 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white/20 bg-linear-to-r from-violet-500 to-fuchsia-500 text-xs font-black shadow-xl shadow-fuchsia-500/30">
              VS
            </div>
            <div class="relative overflow-hidden">
              <img :src="poll.opponents[1].image" :alt="poll.opponents[1].name" class="size-full object-cover object-center" />
              <div class="absolute inset-0 bg-linear-to-t from-[#090b19]/80 via-transparent to-transparent"></div>
            </div>
          </div>

          <div
            v-else-if="!poll.image"
            class="absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-3xl border border-white/20 bg-black/25 shadow-2xl shadow-fuchsia-500/20 backdrop-blur"
          >
            <span class="text-4xl text-white/90">☷</span>
          </div>
          <div class="absolute left-4 top-4 rounded-full bg-violet-500/20 px-3 py-1 text-xs font-black uppercase text-violet-100 backdrop-blur">
            {{ poll.category }}
          </div>
          <div class="absolute right-4 top-4 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black uppercase text-emerald-300 backdrop-blur">
            {{ poll.status }}
          </div>
          <div class="absolute bottom-4 left-4 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-black uppercase text-white/85 backdrop-blur">
            Tipo {{ poll.typeLabel }}
          </div>
        </div>

        <div class="p-5">
          <h3 class="text-xl font-black leading-tight">{{ poll.title }}</h3>
          <p class="mt-2 text-sm text-slate-400">
            {{ poll.type === 'VS' ? 'Ganando ahora' : 'Lider actual' }}:
            <span class="font-bold text-white">{{ poll.leader }}</span>
          </p>

          <div class="mt-5 grid grid-cols-2 gap-3">
            <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p class="text-xs uppercase tracking-widest text-slate-500">Votos</p>
              <p class="mt-1 text-lg font-black">{{ poll.votes }}</p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p class="text-xs uppercase tracking-widest text-slate-500">Cierra en</p>
              <p class="mt-1 text-lg font-black">{{ poll.endsIn }}</p>
            </div>
          </div>

          <div class="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              class="h-full rounded-full bg-linear-to-r from-violet-400 to-fuchsia-400"
              :style="{ width: `${poll.progress}%` }"
            ></div>
          </div>

          <a
            :href="poll.type === 'Lista' ? '/votacion/lista' : '/votacion/versus'"
            class="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide shadow-lg shadow-fuchsia-500/20"
          >
            <span>Votar</span>
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </article>
    </div>

    <div class="hidden gap-4 lg:grid lg:grid-cols-3">
      <article
        v-for="poll in popularPolls"
        :key="poll.title"
        class="group relative overflow-hidden rounded-3xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/30 transition hover:border-fuchsia-300/30 hover:bg-[#101226]"
      >
        <div class="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-fuchsia-300/50 to-transparent"></div>
        <div class="absolute -right-16 -top-16 size-36 rounded-full bg-fuchsia-500/10 blur-3xl"></div>

        <div
          class="relative h-56 overflow-hidden bg-linear-to-br"
          :class="poll.visual"
        >
          <img
            v-if="poll.image"
            :src="poll.image"
            :alt="poll.leader"
            class="absolute inset-0 size-full object-cover"
          />
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.26),transparent_24%),radial-gradient(circle_at_70%_70%,rgba(217,70,239,0.35),transparent_28%)]"></div>
          <div class="absolute inset-0 bg-linear-to-t from-[#090b19] via-transparent to-white/5"></div>
          <div
            v-if="poll.type === 'VS'"
            class="absolute inset-0 grid grid-cols-2"
          >
            <div class="relative overflow-hidden">
              <img :src="poll.opponents[0].image" :alt="poll.opponents[0].name" class="size-full object-cover" />
            </div>
            <div class="absolute left-1/2 top-1/2 z-10 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 text-sm font-black shadow-xl shadow-fuchsia-500/30">
              VS
            </div>
            <div class="relative overflow-hidden">
              <img :src="poll.opponents[1].image" :alt="poll.opponents[1].name" class="size-full object-cover" />
            </div>
          </div>

          <div
            v-else-if="!poll.image"
            class="absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-3xl border border-white/20 bg-black/25 shadow-2xl shadow-fuchsia-500/20 backdrop-blur"
          >
            <span class="text-4xl text-white/90">☷</span>
          </div>
          <div class="absolute left-4 top-4 rounded-full bg-violet-500/20 px-3 py-1 text-xs font-black uppercase text-violet-100 backdrop-blur">
            {{ poll.category }}
          </div>
          <div class="absolute right-4 top-4 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black uppercase text-emerald-300 backdrop-blur">
            {{ poll.status }}
          </div>
          <div class="absolute bottom-4 left-4 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-black uppercase text-white/85 backdrop-blur">
            Tipo {{ poll.typeLabel }}
          </div>
        </div>

        <div class="p-5">
          <h3 class="text-xl font-black leading-tight">{{ poll.title }}</h3>
          <p class="mt-2 text-sm text-slate-400">
            {{ poll.type === 'VS' ? 'Ganando ahora' : 'Lider actual' }}:
            <span class="font-bold text-white">{{ poll.leader }}</span>
          </p>

          <div class="mt-6 grid grid-cols-2 gap-3">
            <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p class="text-xs uppercase tracking-widest text-slate-500">Votos</p>
              <p class="mt-1 text-lg font-black">{{ poll.votes }}</p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p class="text-xs uppercase tracking-widest text-slate-500">Cierra en</p>
              <p class="mt-1 text-lg font-black">{{ poll.endsIn }}</p>
            </div>
          </div>

          <div class="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              class="h-full rounded-full bg-linear-to-r from-violet-400 to-fuchsia-400 transition-all duration-700"
              :style="{ width: `${poll.progress}%` }"
            ></div>
          </div>

          <a
            :href="poll.type === 'Lista' ? '/votacion/lista' : '/votacion/versus'"
            class="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide shadow-lg shadow-fuchsia-500/20 transition group-hover:shadow-fuchsia-500/35"
          >
            <span>Votar</span>
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.mobile-polls-slider {
  scrollbar-width: none;
}

.mobile-polls-slider::-webkit-scrollbar {
  display: none;
}

</style>
