<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getAppDownloadConfig } from '../services/api/appDownloadApi'
import {
  getGooglePlayOpenUrl,
  normalizePlayStoreWebUrl,
} from '../utils/openGooglePlay'

const DEFAULT_PLAY_URL =
  'https://play.google.com/store/apps/details?id=vote.musicmundial.com'

const DISMISS_KEY = 'vmm-android-download-modal-dismissed'

const { locale, t } = useI18n()

const playStoreUrl = ref(DEFAULT_PLAY_URL)
const isOpen = ref(false)
const firstOpenRewardPoints = ref(0)
const firstOpenRewardEnabled = ref(false)

const playOpenUrl = computed(() => getGooglePlayOpenUrl(playStoreUrl.value))

const isAndroid = () => /Android/i.test(navigator.userAgent || '')

const playBadgeSrc = computed(() =>
  String(locale.value || 'es').toLowerCase().startsWith('en')
    ? '/google-play-badge-en.png'
    : '/google-play-badge-es.png',
)

const wasDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

const markDismissed = () => {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // ignore
  }
}

const closeModal = () => {
  isOpen.value = false
  markDismissed()
}

onMounted(async () => {
  if (!isAndroid()) return

  let mode = 'redirect'
  let enabled = true

  try {
    const payload = await getAppDownloadConfig()
    if (payload?.enabled === false || payload?.visible === false) {
      enabled = false
    }
    const url = String(payload?.playStoreUrl || '').trim()
    if (url) playStoreUrl.value = normalizePlayStoreWebUrl(url)
    mode = String(payload?.androidEntryMode || 'redirect').toLowerCase()
    firstOpenRewardEnabled.value = payload?.firstOpenRewardEnabled !== false
    firstOpenRewardPoints.value = Math.max(
      0,
      Math.floor(Number(payload?.firstOpenRewardPoints ?? 0)),
    )
  } catch {
    // keep defaults
  }

  if (!enabled || mode === 'off') return

  if (mode === 'redirect') {
    window.location.replace(getGooglePlayOpenUrl(playStoreUrl.value))
    return
  }

  if (mode === 'modal' && !wasDismissed()) {
    isOpen.value = true
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-120 flex items-end justify-center bg-[#03030a]/80 px-4 py-5 backdrop-blur-md sm:items-center"
      role="dialog"
      :aria-label="t('home.downloadApp.modalAria')"
      @click.self="closeModal"
    >
      <div
        class="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-fuchsia-300/35 bg-linear-to-b from-[#2a0b3f] to-[#0d0820] p-5 text-white shadow-[0_0_40px_rgba(217,70,239,0.35)]"
        @click.stop
      >
        <button
          type="button"
          class="absolute right-3 top-3 grid size-10 place-items-center rounded-full border border-white/15 bg-white/8 text-xl font-black text-white/70 transition hover:bg-white/15 hover:text-white"
          :aria-label="t('home.downloadApp.modalClose')"
          @click="closeModal"
        >
          ×
        </button>

        <div class="flex items-center gap-4 pr-10">
          <img
            src="/app-download-phone.png"
            alt=""
            class="h-24 w-auto drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
            width="96"
            height="96"
            aria-hidden="true"
          />
          <div class="min-w-0">
            <p
              v-if="firstOpenRewardEnabled && firstOpenRewardPoints > 0"
              class="mb-1 inline-flex rounded-full border border-amber-300/35 bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-100"
            >
              +{{ firstOpenRewardPoints }} pts
            </p>
            <h2 class="text-xl font-black uppercase tracking-wide">
              {{ t('home.downloadApp.modalTitle') }}
            </h2>
            <p class="mt-1 text-sm font-semibold leading-5 text-white/75">
              {{ t('home.downloadApp.modalDescription') }}
            </p>
          </div>
        </div>

        <a
          :href="playOpenUrl"
          class="mt-5 flex min-h-12 w-full items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40"
          :aria-label="t('home.downloadApp.ctaAria')"
          @click="markDismissed"
        >
          <img
            :src="playBadgeSrc"
            :alt="t('home.downloadApp.badgeAlt')"
            class="h-10 w-auto"
            width="160"
            height="48"
          />
        </a>

        <button
          type="button"
          class="mt-3 min-h-10 w-full text-sm font-bold text-white/65 transition hover:text-white"
          @click="closeModal"
        >
          {{ t('home.downloadApp.modalClose') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>
