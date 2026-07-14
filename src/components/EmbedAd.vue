<script setup>
import { onMounted, ref } from 'vue'

const hasPushedAd = ref(false)
const ADSENSE_SCRIPT_ID = 'google-adsense-script'
const ADSENSE_CLIENT = 'ca-pub-1078939545517246'
const ADSENSE_SLOT = '2327533014'

const isLocalHost = () =>
  ['localhost', '127.0.0.1', ''].includes(window.location.hostname)

const shouldRenderAd = ref(
  typeof window !== 'undefined' && !isLocalHost(),
)

const loadAdSenseScript = () =>
  new Promise((resolve, reject) => {
    const existingScript = document.getElementById(ADSENSE_SCRIPT_ID)

    if (existingScript) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.id = ADSENSE_SCRIPT_ID
    script.async = true
    script.crossOrigin = 'anonymous'
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })

onMounted(() => {
  if (hasPushedAd.value || typeof window === 'undefined' || !shouldRenderAd.value) {
    return
  }

  window.setTimeout(async () => {
    try {
      await loadAdSenseScript()
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
      hasPushedAd.value = true
    } catch {
      // AdSense can be unavailable before the script finishes loading.
    }
  }, 250)
})
</script>

<template>
  <section
    v-if="shouldRenderAd"
    class="mt-3 w-full sm:mt-4"
    aria-label="Advertisement"
  >
    <p class="mb-1 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
      - Advertisement -
    </p>
    <div class="overflow-hidden rounded-2xl border border-white/10 bg-white">
      <ins
        class="adsbygoogle embed-ad-slot"
        style="display:block"
        :data-ad-client="ADSENSE_CLIENT"
        :data-ad-slot="ADSENSE_SLOT"
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  </section>
</template>

<style scoped>
.embed-ad-slot {
  display: block;
  min-height: 90px;
  width: 100%;
  overflow: hidden;
}

:deep(.embed-ad-slot iframe) {
  max-width: 100%;
}
</style>
