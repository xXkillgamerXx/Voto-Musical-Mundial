<script setup>
const categories = [
  {
    title: 'Artista del Ano',
    action: 'Votar',
    visual: 'from-violet-950 via-fuchsia-700 to-indigo-950',
  },
  {
    title: 'Grupo del Ano',
    action: 'Votar',
    visual: 'from-slate-800 via-violet-700 to-slate-950',
  },
  {
    title: 'Cancion del Ano',
    action: 'Votar',
    visual: 'from-fuchsia-900 via-pink-700 to-slate-950',
  },
  {
    title: 'Album del Ano',
    action: 'Votar',
    visual: 'from-indigo-950 via-purple-700 to-fuchsia-900',
  },
  {
    title: 'Rookie del Ano',
    action: 'Votar',
    visual: 'from-violet-900 via-slate-800 to-indigo-950',
  },
]
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-6 sm:px-6 lg:py-8">
    <div class="mb-5 flex items-center justify-between gap-4">
      <h2 class="flex items-center gap-2 text-lg font-black uppercase tracking-tight sm:text-xl">
        <span class="text-fuchsia-300">✦</span>
        Categorias principales
      </h2>
      <a href="#" class="text-xs font-black uppercase tracking-wide text-violet-300 hover:text-white">
        Ver todas
      </a>
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <article
        v-for="category in categories"
        :key="category.title"
        class="group overflow-hidden rounded-2xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25 transition hover:-translate-y-1 hover:border-fuchsia-300/30 hover:bg-[#101226]"
      >
        <div
          class="relative h-52 overflow-hidden bg-linear-to-br shadow-lg shadow-violet-950/30 sm:h-60"
          :class="category.visual"
        >
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.26),transparent_24%),radial-gradient(circle_at_70%_70%,rgba(217,70,239,0.35),transparent_28%)]"></div>
          <div class="absolute inset-0 bg-linear-to-t from-[#080a17] via-transparent to-white/5"></div>
          <div class="absolute inset-x-6 bottom-3 h-10 rounded-full bg-fuchsia-300/20 blur-xl"></div>
          <div class="absolute left-1/2 top-1/2 grid size-18 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-3xl border border-white/20 bg-black/25 shadow-2xl shadow-fuchsia-500/20 backdrop-blur">
            <span class="text-4xl text-white/90">✦</span>
          </div>
        </div>

        <div class="px-4 py-4">
          <h3 class="text-sm font-black uppercase leading-tight text-white">
            {{ category.title }}
          </h3>
          <a
            href="#"
            class="mt-2 inline-flex text-xs font-black uppercase tracking-wide text-fuchsia-300 transition hover:text-white"
          >
            {{ category.action }}
          </a>
        </div>
      </article>
    </div>
  </section>
</template>
