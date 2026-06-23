<script setup>
const bannerFeatures = [
  { icon: '✦', title: '100% global', text: 'Fans de todo el mundo' },
  { icon: '◆', title: 'Seguro y justo', text: 'Sistema verificado' },
  { icon: '◈', title: 'En tiempo real', text: 'Resultados actualizados' },
  { icon: '♡', title: 'Tu voz importa', text: 'Cada voto cuenta' },
]
</script>

<template>
  <div class="mt-4 grid gap-3 border-y border-white/10 bg-white/5 p-4 sm:rounded-3xl sm:border sm:grid-cols-2 lg:grid-cols-4">
    <article
      v-for="feature in bannerFeatures"
      :key="feature.title"
      class="flex min-h-24 items-center gap-4 rounded-2xl border border-white/5 bg-black/20 p-5"
    >
      <span class="grid size-14 shrink-0 place-items-center rounded-2xl bg-violet-500/20 text-xl text-violet-200 shadow-lg shadow-violet-500/10">
        {{ feature.icon }}
      </span>
      <span>
        <span class="block text-sm font-black uppercase sm:text-base">{{ feature.title }}</span>
        <span class="mt-1 block text-xs text-slate-400">{{ feature.text }}</span>
      </span>
    </article>
  </div>
</template>
