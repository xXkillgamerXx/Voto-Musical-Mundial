<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import FanCheckoutPanel from '../components/FanCheckoutPanel.vue'
import {
  canSeeFanStore,
  getFanStoreViewer,
  isFanStoreAdmin,
  loadFanStore,
  waitForFanStore,
} from '../services/fanStore'
import { routePath } from '../utils/localizedRoutes'

const params = new URLSearchParams(window.location.search)
const sku = String(params.get('sku') || 'FAN').toUpperCase()
const currency = String(params.get('cur') || 'USD').toUpperCase() === 'COP' ? 'COP' : 'USD'
const yearly = String(params.get('cycle') || 'month').toLowerCase() === 'year'
const ready = ref(false)
const { locale } = useI18n()

onMounted(async () => {
  const viewer = getFanStoreViewer()
  if (isFanStoreAdmin(viewer)) {
    ready.value = true
    loadFanStore()
    return
  }
  await waitForFanStore()
  if (!canSeeFanStore(viewer)) {
    window.location.replace(routePath('home', locale.value))
    return
  }
  ready.value = true
})
</script>

<template>
  <section v-if="ready" class="mx-auto max-w-352 px-4 py-8 sm:px-6 lg:py-12">
    <FanCheckoutPanel :sku="sku" :currency="currency" :yearly="yearly" />
  </section>
</template>
