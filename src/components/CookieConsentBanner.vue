<script setup>
import { onMounted, ref } from 'vue'

const consentKey = 'vmm_cookie_consent'
const consentChangeEvent = 'vmm-cookie-consent-change'

const isVisible = ref(false)
const isCustomizing = ref(false)
const options = ref({
  preferences: true,
  analytics: false,
  ads: false,
  pushPrompt: true,
})

const buildConsent = (mode, overrides = {}) => {
  const acceptAll = mode === 'all'
  return {
    mode,
    necessary: true,
    preferences: acceptAll ? true : Boolean(overrides.preferences),
    analytics: acceptAll ? true : Boolean(overrides.analytics),
    ads: acceptAll ? true : Boolean(overrides.ads),
    adStorage: acceptAll ? true : Boolean(overrides.ads),
    adUserData: acceptAll ? true : Boolean(overrides.ads),
    adPersonalization: acceptAll ? true : Boolean(overrides.ads),
    pushPrompt: acceptAll ? true : Boolean(overrides.pushPrompt),
    acceptedAt: new Date().toISOString(),
    version: 2,
  }
}

const saveConsent = (mode, overrides = {}) => {
  const consent = {
    ...buildConsent(mode, overrides),
  }

  window.localStorage.setItem(consentKey, JSON.stringify(consent))
  window.dispatchEvent(new CustomEvent(consentChangeEvent, { detail: consent }))
  isVisible.value = false
}

const acceptAll = () => saveConsent('all')
const rejectOptional = () => saveConsent('necessary')
const saveCustom = () => saveConsent('custom', options.value)

onMounted(() => {
  if (!window.localStorage.getItem(consentKey)) {
    window.setTimeout(() => {
      isVisible.value = true
    }, 900)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="cookie-consent">
      <div
        v-if="isVisible"
        class="fixed inset-x-3 bottom-3 z-90 mx-auto max-w-4xl rounded-4xl border border-cyan-300/20 bg-slate-950/96 p-4 text-white shadow-2xl shadow-cyan-950/35 backdrop-blur-xl sm:inset-x-6 sm:bottom-6 sm:p-5"
      >
        <div class="pointer-events-none absolute inset-0 rounded-4xl bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_92%_20%,rgba(217,70,239,0.14),transparent_30%)]"></div>

        <div class="relative grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div class="flex gap-3">
            <span class="grid size-12 shrink-0 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-300/20">
              <i class="fa-solid fa-shield-heart" aria-hidden="true"></i>
            </span>

            <div class="min-w-0">
              <p class="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">
                {{ $t('cookies.eyebrow') }}
              </p>
              <h2 class="mt-1 text-xl font-black text-white">
                {{ $t('cookies.title') }}
              </h2>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                {{ $t('cookies.description') }}
              </p>

              <div class="mt-3 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-wide text-slate-300">
                <span class="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-100">
                  {{ $t('cookies.badgeNecessary') }}
                </span>
                <span class="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-cyan-100">
                  {{ $t('cookies.badgeAnalytics') }}
                </span>
                <span class="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1.5 text-fuchsia-100">
                  {{ $t('cookies.badgePush') }}
                </span>
              </div>
            </div>
          </div>

          <div class="grid gap-2 sm:grid-cols-3 lg:min-w-96 lg:grid-cols-1">
            <button
              type="button"
              class="min-h-11 rounded-full bg-linear-to-r from-cyan-400 to-fuchsia-500 px-5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.02]"
              @click="acceptAll"
            >
              {{ $t('cookies.acceptAll') }}
            </button>
            <button
              type="button"
              class="min-h-11 rounded-full border border-white/10 bg-white/5 px-5 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
              @click="rejectOptional"
            >
              {{ $t('cookies.rejectOptional') }}
            </button>
            <button
              type="button"
              class="min-h-11 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 text-xs font-black uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-400/15"
              @click="isCustomizing = !isCustomizing"
            >
              {{ $t('cookies.configure') }}
            </button>
          </div>
        </div>

        <div
          v-if="isCustomizing"
          class="relative mt-4 grid gap-3 rounded-3xl border border-white/10 bg-slate-950/70 p-3 sm:grid-cols-2"
        >
          <label class="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <input
              v-model="options.preferences"
              type="checkbox"
              class="mt-1 size-4 accent-cyan-400"
            />
            <span>
              <span class="block text-sm font-black text-white">{{ $t('cookies.preferencesTitle') }}</span>
              <span class="text-xs leading-5 text-slate-400">{{ $t('cookies.preferencesText') }}</span>
            </span>
          </label>

          <label class="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <input
              v-model="options.analytics"
              type="checkbox"
              class="mt-1 size-4 accent-cyan-400"
            />
            <span>
              <span class="block text-sm font-black text-white">{{ $t('cookies.analyticsTitle') }}</span>
              <span class="text-xs leading-5 text-slate-400">{{ $t('cookies.analyticsText') }}</span>
            </span>
          </label>

          <label class="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <input
              v-model="options.ads"
              type="checkbox"
              class="mt-1 size-4 accent-cyan-400"
            />
            <span>
              <span class="block text-sm font-black text-white">{{ $t('cookies.adsTitle') }}</span>
              <span class="text-xs leading-5 text-slate-400">{{ $t('cookies.adsText') }}</span>
            </span>
          </label>

          <label class="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <input
              v-model="options.pushPrompt"
              type="checkbox"
              class="mt-1 size-4 accent-cyan-400"
            />
            <span>
              <span class="block text-sm font-black text-white">{{ $t('cookies.notificationsTitle') }}</span>
              <span class="text-xs leading-5 text-slate-400">{{ $t('cookies.notificationsText') }}</span>
            </span>
          </label>

          <div class="sm:col-span-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              class="min-h-11 rounded-full bg-white px-5 text-xs font-black uppercase tracking-wide text-slate-950 transition hover:scale-[1.02]"
              @click="saveCustom"
            >
              {{ $t('cookies.savePreferences') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cookie-consent-enter-active,
.cookie-consent-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.cookie-consent-enter-from,
.cookie-consent-leave-to {
  opacity: 0;
  transform: translateY(0.75rem) scale(0.98);
}
</style>
