<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { showWebAds } from '../utils/fanPerks'
import { isAdminLocation } from '../utils/appBase'
import { isStoredAdminUser } from '../utils/suppressPageAds'
import { adCookieConsent } from '../utils/cookieConsent'

const hasPushedAd = ref(false)
let loadTimer = 0
const ADSENSE_SCRIPT_ID = 'google-adsense-script'
const ADSENSE_CLIENT = 'ca-pub-1078939545517246'
const ADSENSE_SLOT = '2327533014'

const isLocalHost = () =>
  ['localhost', '127.0.0.1', ''].includes(window.location.hostname)

const adsAllowed = () =>
  adCookieConsent.value &&
  !isAdminLocation() &&
  !isStoredAdminUser() &&
  !document.documentElement.classList.contains('mm-no-ads')

const shouldRenderAd = ref(
  typeof window !== 'undefined' && !isLocalHost() && adsAllowed(),
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

const tryLoadAd = () => {
  if (hasPushedAd.value || typeof window === 'undefined' || !shouldRenderAd.value || !adsAllowed() || !showWebAds.value) {
    return
  }

  loadTimer = window.setTimeout(async () => {
    if (!showWebAds.value || hasPushedAd.value || !adsAllowed()) return
    try {
      await loadAdSenseScript()
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
      hasPushedAd.value = true
    } catch {
      // AdSense can be unavailable before the script finishes loading.
    }
  }, 250)
}

onMounted(tryLoadAd)
onUnmounted(() => {
  if (loadTimer) window.clearTimeout(loadTimer)
})
watch(showWebAds, (show) => {
  if (show) tryLoadAd()
})
watch(adCookieConsent, (allowed) => {
  if (allowed) {
    shouldRenderAd.value = typeof window !== 'undefined' && !isLocalHost() && adsAllowed()
    tryLoadAd()
  }
})
</script>

<template>
  <section
    v-if="shouldRenderAd && showWebAds && adCookieConsent && !isStoredAdminUser()"
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
