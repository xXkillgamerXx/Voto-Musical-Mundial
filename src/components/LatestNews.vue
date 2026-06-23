<script setup>
const newsItems = [
  {
    title: 'Nuevas votaciones abiertas',
    tag: 'Nuevo',
    time: 'hace 2 horas',
    visual: 'from-violet-950 via-fuchsia-700 to-indigo-950',
  },
  {
    title: 'Ranking semanal actualizado',
    tag: 'Ranking',
    time: 'hace 5 horas',
    visual: 'from-indigo-950 via-purple-700 to-fuchsia-900',
  },
  {
    title: 'Doble puntos este fin de semana',
    tag: 'Bonus',
    time: 'hace 1 dia',
    visual: 'from-amber-900 via-fuchsia-700 to-violet-950',
  },
]
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-6 sm:px-6 lg:py-8">
    <div class="mb-5 flex items-center justify-between gap-4">
      <h2 class="flex items-center gap-2 text-lg font-black uppercase tracking-tight sm:text-xl">
        <span class="text-fuchsia-300">✦</span>
        Ultimas noticias
      </h2>
      <a href="#" class="text-xs font-black uppercase tracking-wide text-violet-300 hover:text-white">
        Ver todas
      </a>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <article
        v-for="item in newsItems"
        :key="item.title"
        class="overflow-hidden rounded-3xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25 transition hover:-translate-y-1 hover:border-fuchsia-300/30"
      >
        <div class="relative h-40 bg-linear-to-br" :class="item.visual">
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.22),transparent_24%),radial-gradient(circle_at_70%_70%,rgba(217,70,239,0.35),transparent_28%)]"></div>
          <span class="absolute left-4 top-4 rounded-full bg-black/35 px-3 py-1 text-xs font-black uppercase text-white backdrop-blur">
            {{ item.tag }}
          </span>
        </div>

        <div class="p-5">
          <h3 class="text-lg font-black">{{ item.title }}</h3>
          <p class="mt-2 text-sm text-slate-500">{{ item.time }}</p>
        </div>
      </article>
    </div>
  </section>
</template>
