<script setup>
const bannerFeatures = [
  { icon: '✦', titleKey: 'home.features.global.title', textKey: 'home.features.global.text' },
  { icon: '◆', titleKey: 'home.features.secure.title', textKey: 'home.features.secure.text' },
  { icon: '◈', titleKey: 'home.features.realtime.title', textKey: 'home.features.realtime.text' },
  { icon: '♡', titleKey: 'home.features.voice.title', textKey: 'home.features.voice.text' },
]
</script>

<template>
  <div class="light-clean-surface mt-4 grid gap-3 border-y border-white/10 bg-white/5 p-4 sm:rounded-3xl sm:border sm:grid-cols-2 lg:grid-cols-4">
    <article
      v-for="feature in bannerFeatures"
      :key="feature.titleKey"
      class="flex min-h-24 items-center gap-4 rounded-2xl border border-white/5 bg-black/20 p-5"
    >
      <span class="grid size-14 shrink-0 place-items-center rounded-2xl bg-violet-500/20 text-xl text-violet-200 shadow-lg shadow-violet-500/10">
        {{ feature.icon }}
      </span>
      <span>
        <span class="block text-sm font-black uppercase sm:text-base">{{ $t(feature.titleKey) }}</span>
        <span class="mt-1 block text-xs text-slate-400">{{ $t(feature.textKey) }}</span>
      </span>
    </article>
  </div>
</template>
