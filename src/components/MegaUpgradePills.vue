<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { findStoreItem } from '../services/fanStore'

const MEGA_EXTRA = 10

const props = defineProps({
  sku: { type: String, default: 'FAN' },
})

const { locale } = useI18n()
const plan = computed(() => findStoreItem(props.sku))
const sku = computed(() => String(plan.value?.sku || props.sku || 'FAN').toUpperCase())
const isMega = computed(() => sku.value === 'MEGA')
const isSuper = computed(() => sku.value === 'SUPER')
const extra = MEGA_EXTRA
const points = computed(() => Number(plan.value?.welcomePts || 0))
const isEn = computed(() => String(locale.value || 'es').startsWith('en'))

const badgeClass = computed(() => {
  if (isMega.value) return 'bg-linear-to-r from-amber-700 to-amber-300 text-amber-950'
  if (isSuper.value) return 'bg-linear-to-r from-violet-600 to-fuchsia-500 text-white'
  return 'bg-linear-to-r from-blue-600 to-sky-400 text-white'
})

const badgeIcon = computed(() => {
  if (isMega.value) return 'fa-solid fa-crown'
  if (isSuper.value) return 'fa-solid fa-bolt'
  return 'fa-solid fa-star'
})

const pillClass = computed(() => {
  if (isMega.value) return 'border-amber-300 text-amber-300'
  if (isSuper.value) return 'border-fuchsia-400 text-fuchsia-200'
  return 'border-sky-400 text-sky-300'
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-2.5">
    <span
      class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black italic tracking-wide"
      :class="badgeClass"
    >
      <i class="fa-fw text-base" :class="badgeIcon" aria-hidden="true"></i>
      {{ plan.name }}
    </span>
    <span
      class="rounded-full border-2 px-4 py-2 text-sm font-black"
      :class="pillClass"
    >
      +{{ points }} {{ isEn ? 'points' : 'puntos' }}
    </span>
    <span
      v-if="isMega"
      class="rounded-full border-2 px-4 py-2 text-sm font-black"
      :class="pillClass"
    >
      +{{ extra }} {{ isEn ? 'extra now' : 'extra ahora' }}
    </span>
  </div>
</template>
