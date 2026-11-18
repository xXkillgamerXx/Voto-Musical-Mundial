<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { adCookieConsent } from '../../../src/utils/cookieConsent'
import { isStoredAdminUser } from '../../../src/utils/suppressPageAds'
import { t } from '../lib/copy'

const props = defineProps<{ locale?: string }>()
const loc = () => (props.locale === 'en' ? 'en' : 'es')

const ADSENSE_SCRIPT_ID = 'google-adsense-script'
const ADSENSE_CLIENT = 'ca-pub-1078939545517246'
const ADSENSE_SLOT = '2327533014'

const slotEl = ref<HTMLElement | null>(null)
const hasPushedAd = ref(false)
const adFilled = ref(false)
let loadTimer = 0
let fillTimer = 0
let observer: MutationObserver | null = null

const isLocalHost = () =>
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', ''].includes(window.location.hostname)

const adsAllowed = () =>
  typeof window !== 'undefined' &&
  adCookieConsent.value &&
  !isStoredAdminUser() &&
  !document.documentElement.classList.contains('mm-no-ads')

const shouldRenderAd = ref(typeof window !== 'undefined' && !isStoredAdminUser())
const isLocal = typeof window !== 'undefined' && isLocalHost()

const loadAdSenseScript = () =>
  new Promise<void>((resolve, reject) => {
    if (document.getElementById(ADSENSE_SCRIPT_ID) || document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.id = ADSENSE_SCRIPT_ID
    script.async = true
    script.crossOrigin = 'anonymous'
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('adsense'))
    document.head.appendChild(script)
  })

const readFillStatus = () => {
  const status = slotEl.value?.getAttribute('data-ad-status')
  if (status === 'filled') {
    adFilled.value = true
    return true
  }
  if (status === 'unfilled') {
    adFilled.value = false
    return true
  }
  return false
}

const tryLoadAd = async () => {
  if (!shouldRenderAd.value || !adsAllowed() || isLocal || hasPushedAd.value) return
  try {
    await loadAdSenseScript()
    await nextTick()
    if (hasPushedAd.value || !slotEl.value || !adsAllowed()) return
    ;(window as any).adsbygoogle = (window as any).adsbygoogle || []
    ;(window as any).adsbygoogle.push({})
    hasPushedAd.value = true
    observer = new MutationObserver(() => {
      if (readFillStatus() && observer) observer.disconnect()
    })
    if (slotEl.value) {
      observer.observe(slotEl.value, { attributes: true, attributeFilter: ['data-ad-status'] })
    }
    readFillStatus()
    fillTimer = window.setTimeout(() => observer?.disconnect(), 4000)
  } catch {
    adFilled.value = false
  }
}

onMounted(() => {
  shouldRenderAd.value = !isStoredAdminUser()
  if (isLocal) {
    adFilled.value = true
    return
  }
  loadTimer = window.setTimeout(() => {
    void tryLoadAd()
  }, 300)
})

watch(adCookieConsent, (allowed) => {
  if (allowed) void tryLoadAd()
})

onUnmounted(() => {
  observer?.disconnect()
  if (loadTimer) window.clearTimeout(loadTimer)
  if (fillTimer) window.clearTimeout(fillTimer)
})
</script>

<template>
  <aside
    v-if="shouldRenderAd && (isLocal || adCookieConsent)"
    class="news-home-ad rise"
    aria-label="Advertisement"
  >
    <p class="news-home-ad-label">{{ t(loc(), 'advertisement') }}</p>
    <div v-if="isLocal" class="news-home-ad-local">
      <strong>{{ t(loc(), 'advertisement') }}</strong>
      <span>728 × 90 / responsive</span>
    </div>
    <div v-else class="news-home-ad-frame" :class="{ filled: adFilled }">
      <ins
        ref="slotEl"
        class="adsbygoogle news-home-ad-slot"
        style="display:block"
        :data-ad-client="ADSENSE_CLIENT"
        :data-ad-slot="ADSENSE_SLOT"
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  </aside>
</template>
