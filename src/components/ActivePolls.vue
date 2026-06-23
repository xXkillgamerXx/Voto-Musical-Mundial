<script setup>
const activePolls = [
  {
    title: 'Artista del Ano',
    question: '¿Quien es tu artista favorito del 2026?',
    time: ['12', '08', '34', '45'],
    visual: 'from-violet-950 via-fuchsia-700 to-indigo-950',
  },
  {
    title: 'Grupo del Ano',
    question: '¿Que grupo tuvo el ano mas iconico?',
    time: ['12', '08', '34', '45'],
    visual: 'from-slate-800 via-violet-700 to-slate-950',
  },
  {
    title: 'Cancion del Ano',
    question: 'Vota por el tema que domino la temporada.',
    time: ['10', '22', '18', '09'],
    visual: 'from-fuchsia-900 via-pink-700 to-slate-950',
  },
]

const timeLabels = ['Dias', 'Hrs', 'Min', 'Seg']
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-6 sm:px-6 lg:py-8">
    <div class="mb-5 flex items-center justify-between gap-4">
      <h2 class="flex items-center gap-2 text-lg font-black uppercase tracking-tight sm:text-xl">
        <span class="text-fuchsia-300">✦</span>
        Votaciones activas
      </h2>
      <a href="#" class="text-xs font-black uppercase tracking-wide text-violet-300 hover:text-white">
        Ver todas
      </a>
    </div>

    <div class="space-y-3">
      <article
        v-for="poll in activePolls"
        :key="poll.title"
        class="grid min-h-50 overflow-hidden rounded-2xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25 transition hover:border-fuchsia-300/30 hover:bg-[#101226] md:grid-cols-[20rem_1fr_auto_auto] md:items-center"
      >
        <div
          class="relative h-60 overflow-hidden bg-linear-to-br md:h-50"
          :class="poll.visual"
        >
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.26),transparent_24%),radial-gradient(circle_at_70%_70%,rgba(217,70,239,0.35),transparent_28%)]"></div>
          <div class="absolute inset-0 bg-linear-to-t from-[#080a17] via-transparent to-white/5"></div>
          <div class="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border border-white/20 bg-black/25 shadow-2xl shadow-fuchsia-500/20 backdrop-blur">
            <span class="text-2xl text-white/90">✦</span>
          </div>
        </div>

        <div class="px-5 py-5 md:px-6">
          <h3 class="text-lg font-black uppercase">{{ poll.title }}</h3>
          <p class="mt-1 text-sm text-slate-400">{{ poll.question }}</p>
        </div>

        <div class="grid grid-cols-4 gap-2 px-4 md:px-2">
          <div
            v-for="(value, index) in poll.time"
            :key="`${poll.title}-${index}`"
            class="min-w-17 rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-center shadow-inner shadow-black/30"
          >
            <p class="text-xl font-black">{{ value }}</p>
            <p class="text-[10px] font-bold uppercase text-slate-500">{{ timeLabels[index] }}</p>
          </div>
        </div>

        <a
          href="#"
          class="m-4 flex min-h-12 min-w-28 items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-9 text-sm font-black uppercase tracking-wide shadow-lg shadow-fuchsia-500/25 md:ml-2"
        >
          Votar
        </a>
      </article>
    </div>
  </section>
</template>
