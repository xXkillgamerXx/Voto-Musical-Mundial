<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getCurrentApiAuth } from '../services/api/authApi'
import { onStoredAuthChange } from '../services/api/client'
import {
  isPushSupported,
  listenForegroundPushMessages,
  requestAndRegisterPushToken,
} from '../services/firebasePush'

const dismissedKey = 'vmm_push_prompt_dismissed_v2'
const enabledKey = 'vmm_push_enabled'
const cookieConsentKey = 'vmm_cookie_consent'
const cookieConsentChangeEvent = 'vmm-cookie-consent-change'

const currentUser = ref(null)
const isVisible = ref(false)
const isEnabling = ref(false)
const errorMessage = ref('')
const foregroundMessage = ref(null)
let unsubscribeAuth = null
let unsubscribeForeground = null
let showTimer = null

const hasCookieConsentForPush = () => {
  try {
    const consent = JSON.parse(window.localStorage.getItem(cookieConsentKey) || 'null')
    return consent?.mode === 'all' || consent?.pushPrompt === true
  } catch {
    return false
  }
}

const userName = computed(() => currentUser.value?.displayName || currentUser.value?.username || 'fan')
const friendlyPushError =
  'No pudimos activar las alertas en este navegador. Puedes seguir usando la web normal y volver a intentarlo mas tarde.'

const syncVisibility = async () => {
  errorMessage.value = ''
  const auth = getCurrentApiAuth()
  currentUser.value = auth?.user || null

  if (!currentUser.value || !hasCookieConsentForPush() || window.localStorage.getItem(dismissedKey) === '1') {
    isVisible.value = false
    return
  }

  const supported = await isPushSupported()
  if (!supported || Notification.permission === 'denied' || window.localStorage.getItem(enabledKey) === '1') {
    isVisible.value = false
    return
  }

  window.clearTimeout(showTimer)
  showTimer = window.setTimeout(() => {
    isVisible.value = true
  }, 1800)
}

const closePrompt = () => {
  window.localStorage.setItem(dismissedKey, '1')
  isVisible.value = false
}

const enableNotifications = async () => {
  isEnabling.value = true
  errorMessage.value = ''

  try {
    const result = await requestAndRegisterPushToken()
    if (result.ok) {
      window.localStorage.setItem(enabledKey, '1')
      isVisible.value = false
      return
    }

    if (result.permission === 'denied') {
      errorMessage.value = 'Las alertas estan bloqueadas en este navegador. Puedes activarlas desde los ajustes del sitio cuando quieras.'
    } else if (result.reason === 'token_error') {
      errorMessage.value = friendlyPushError
    } else {
      errorMessage.value = friendlyPushError
    }
  } catch (error) {
    console.error('[push] Notification permission failed', error)
    errorMessage.value = friendlyPushError
  } finally {
    isEnabling.value = false
  }
}

onMounted(() => {
  syncVisibility()
  unsubscribeAuth = onStoredAuthChange(syncVisibility)
  window.addEventListener(cookieConsentChangeEvent, syncVisibility)
  listenForegroundPushMessages((payload) => {
    const data = payload?.data || {}
    foregroundMessage.value = {
      title: payload?.notification?.title || data.title || 'Votos Mundial',
      body: payload?.notification?.body || data.body || data.message || 'Tienes una nueva notificacion.',
      url: data.url || '/',
    }
    window.setTimeout(() => {
      foregroundMessage.value = null
    }, 5500)
  }).then((unsubscribe) => {
    unsubscribeForeground = unsubscribe
  })
})

onUnmounted(() => {
  unsubscribeAuth?.()
  unsubscribeForeground?.()
  window.removeEventListener(cookieConsentChangeEvent, syncVisibility)
  window.clearTimeout(showTimer)
})

const openForegroundMessage = () => {
  foregroundMessage.value = null
  window.location.href = '/notificaciones'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="push-prompt">
      <div
        v-if="isVisible"
        class="fixed inset-0 z-90 grid place-items-center bg-slate-950/75 px-4 py-6 text-white backdrop-blur-md"
      >
        <div class="relative w-full max-w-lg overflow-hidden rounded-4xl border border-fuchsia-300/25 bg-slate-950/96 p-6 shadow-2xl shadow-fuchsia-950/45 sm:p-7">
          <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(217,70,239,0.24),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(34,211,238,0.16),transparent_28%)]"></div>

          <div class="relative text-center">
            <span class="mx-auto grid size-16 place-items-center rounded-3xl bg-fuchsia-400/15 text-2xl text-fuchsia-100 ring-1 ring-fuchsia-300/25 shadow-lg shadow-fuchsia-950/30">
              <i class="fa-solid fa-bell" aria-hidden="true"></i>
            </span>

            <p class="mt-5 text-xs font-black uppercase tracking-[0.28em] text-fuchsia-200">
              Notificaciones
            </p>
            <h2 class="mt-2 text-2xl font-black leading-tight text-white sm:text-3xl">
              Activa alertas importantes
            </h2>
            <p class="mt-2 text-sm font-bold text-cyan-100">
              {{ userName }}, no te pierdas regalos, finales ni avances de tus artistas.
            </p>
            <p class="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-300">
              Te pediremos permiso del navegador para enviarte avisos solo cuando sea relevante.
            </p>

            <div class="mt-5 grid gap-2 text-left text-sm font-bold text-slate-200">
              <div class="flex items-center gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3">
                <i class="fa-solid fa-gift text-amber-200" aria-hidden="true"></i>
                <span>Regalos y puntos recibidos</span>
              </div>
              <div class="flex items-center gap-3 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-400/10 px-4 py-3">
                <i class="fa-solid fa-star text-fuchsia-200" aria-hidden="true"></i>
                <span>Artistas seguidos que avanzan o ganan</span>
              </div>
              <div class="flex items-center gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3">
                <i class="fa-solid fa-clock text-cyan-200" aria-hidden="true"></i>
                <span>Votaciones urgentes por terminar</span>
              </div>
            </div>

            <p
              v-if="errorMessage"
              class="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
            >
              {{ errorMessage }}
            </p>

            <div class="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                class="min-h-12 rounded-full bg-linear-to-r from-fuchsia-500 to-cyan-400 px-5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="isEnabling"
                @click="enableNotifications"
              >
                {{ isEnabling ? 'Activando...' : 'Permitir alertas' }}
              </button>
              <button
                type="button"
                class="min-h-12 rounded-full border border-white/10 bg-white/5 px-5 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
                @click="closePrompt"
              >
                Luego
              </button>
            </div>

            <p class="mt-4 text-xs font-bold text-slate-500">
              Puedes cambiar este permiso luego desde los ajustes del navegador.
            </p>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="push-prompt">
      <button
        v-if="foregroundMessage"
        type="button"
        class="fixed right-4 top-24 z-80 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-cyan-300/25 bg-slate-950/96 p-0 text-left text-white shadow-2xl shadow-cyan-950/35 backdrop-blur-xl transition hover:scale-[1.01] hover:border-cyan-200/45"
        @click="openForegroundMessage"
      >
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_100%_25%,rgba(217,70,239,0.16),transparent_30%)]"></div>
        <div class="relative flex gap-3 p-4">
          <span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-300/25">
            <i class="fa-solid fa-bell" aria-hidden="true"></i>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">
              Notificación
            </span>
            <span class="mt-1 block truncate text-sm font-black text-white">
              {{ foregroundMessage.title }}
            </span>
            <span class="mt-1 block text-sm leading-5 text-slate-300">
              {{ foregroundMessage.body }}
            </span>
            <span class="mt-3 inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-cyan-100">
              Ver detalle
              <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </span>
          </span>
          <span
            class="grid size-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
            @click.stop="foregroundMessage = null"
          >
            ×
          </span>
        </div>
      </button>
    </Transition>
  </Teleport>
</template>

<style scoped>
.push-prompt-enter-active,
.push-prompt-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.push-prompt-enter-from,
.push-prompt-leave-to {
  opacity: 0;
  transform: translateY(0.75rem) scale(0.98);
}
</style>
