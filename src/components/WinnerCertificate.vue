<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  name: { type: String, default: '' },
  group: { type: String, default: '' },
  date: { type: String, default: '' },
})

const { locale } = useI18n()

const certificateHref = computed(() => {
  const params = new URLSearchParams({
    name: props.name || '',
    group: props.group || '',
    date: props.date || '',
    lang: locale.value === 'en' ? 'en' : 'es',
  })
  return `/certificate.html?${params.toString()}`
})
</script>

<template>
  <div
    class="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-xl shadow-2xl shadow-black/40"
    style="aspect-ratio: 819 / 1024"
  >
    <iframe
      :key="certificateHref"
      :src="certificateHref"
      title="Music Mundial Certificate"
      class="absolute inset-0 h-full w-full border-0 bg-transparent"
      loading="eager"
    />
  </div>
</template>
