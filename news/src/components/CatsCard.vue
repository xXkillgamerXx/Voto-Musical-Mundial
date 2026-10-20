<script setup lang="ts">
defineProps<{
  card: {
    href: string
    image: string
    title: string
    sub: string
    icon: string
    tone: string
  }
}>()
</script>

<template>
  <a class="cats-card" :href="card.href" :data-tone="card.tone">
    <img :src="card.image" :alt="card.title" />
    <span class="cats-body">
      <span class="cats-ico">
        <svg v-if="card.icon === 'news'" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v14H7z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15 3v5h5M9 12h6M9 16h6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
        <svg v-else-if="card.icon === 'music'" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="7" cy="18" r="2.2" fill="currentColor"/><circle cx="17" cy="16" r="2.2" fill="currentColor"/></svg>
        <svg v-else-if="card.icon === 'film'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>
        <svg v-else-if="card.icon === 'series'" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 9v6l5-3z" fill="currentColor"/></svg>
        <svg v-else-if="card.icon === 'artist'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 19c1.2-3 3.2-4.5 6-4.5S16.8 16 18 19" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
        <svg v-else-if="card.icon === 'note'" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l9-2v13" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="7" cy="18" r="2.2" fill="currentColor"/></svg>
        <svg v-else-if="card.icon === 'live'" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 6.2L21 12l-6.8 2.8L12 21l-2.2-6.2L3 12l6.8-2.8z" fill="currentColor"/></svg>
      </span>
      <span><strong>{{ card.title }}</strong><small>{{ card.sub }}</small></span>
      <span class="cats-go">→</span>
    </span>
  </a>
</template>
