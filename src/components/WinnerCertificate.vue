<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getCertificateInstagramHandle } from '../utils/certificateBrand'

const props = defineProps({
  name: { type: String, default: '' },
  group: { type: String, default: '' },
  category: { type: String, default: '' },
  year: { type: [String, Number], default: '' },
})

const { locale } = useI18n()

const yearText = computed(() => {
  const raw = String(props.year || '').trim()
  if (/^\d{4}$/.test(raw)) return raw
  return String(new Date().getFullYear())
})

const certificateHref = computed(() => {
  const params = new URLSearchParams({
    name: props.name || '',
    group: props.group || '',
    category: props.category || '',
    year: yearText.value,
    lang: locale.value === 'en' ? 'en' : 'es',
    ig: getCertificateInstagramHandle(),
  })
  return `/certificate.html?${params.toString()}`
})
</script>

<template>
  <div
    class="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-xl shadow-2xl shadow-black/40"
    style="aspect-ratio: 3 / 3.85"
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
