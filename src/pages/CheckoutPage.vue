<script setup>
import FanCheckoutPanel from '../components/FanCheckoutPanel.vue'

const params = new URLSearchParams(window.location.search)
const sku = String(params.get('sku') || 'FAN').toUpperCase()
const currency = String(params.get('cur') || 'USD').toUpperCase() === 'COP' ? 'COP' : 'USD'
const yearly = String(params.get('cycle') || 'month').toLowerCase() === 'year'
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-8 sm:px-6 lg:py-12">
    <FanCheckoutPanel :sku="sku" :currency="currency" :yearly="yearly" />
  </section>
</template>
