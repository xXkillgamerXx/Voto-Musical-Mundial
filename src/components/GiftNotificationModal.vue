<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getCurrentApiAuth } from '../services/api/authApi'
import { onStoredAuthChange } from '../services/api/client'
import { getNotifications, markNotificationRead } from '../services/api/notificationsApi'

const REFRESH_MS = 60 * 1000
const giftNotification = ref(null)
const isOpen = ref(false)
const isLoading = ref(false)

let refreshTimer = null
let unsubscribeAuth = null

const giftAmount = computed(() =>
  Number(giftNotification.value?.payload?.amount || 0).toLocaleString('es'),
)
const giftMessage = computed(() =>
  giftNotification.value?.payload?.message || `Recibiste ${giftAmount.value} puntos de regalo.`,
)

const loadGiftNotification = async () => {
  if (!getCurrentApiAuth()?.accessToken || isLoading.value || isOpen.value) {
    return
  }

  isLoading.value = true
  try {
    const notifications = await getNotifications(10)
    const nextGift = (notifications || []).find(
      (notification) => notification.type === 'admin_points_gift' && !notification.readAt,
    )

    if (nextGift) {
      giftNotification.value = nextGift
      isOpen.value = true
    }
  } catch {
    giftNotification.value = null
  } finally {
    isLoading.value = false
  }
}

const closeGift = async () => {
  const notificationId = giftNotification.value?.id
  isOpen.value = false
  giftNotification.value = null

  if (notificationId) {
    await markNotificationRead(notificationId).catch(() => {})
  }
}

const syncAuth = () => {
  if (!getCurrentApiAuth()?.accessToken) {
    isOpen.value = false
    giftNotification.value = null
    return
  }

  loadGiftNotification()
}

onMounted(() => {
  syncAuth()
  unsubscribeAuth = onStoredAuthChange(syncAuth)
  refreshTimer = window.setInterval(loadGiftNotification, REFRESH_MS)
})

onUnmounted(() => {
  unsubscribeAuth?.()
  window.clearInterval(refreshTimer)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-70 grid place-items-center bg-slate-950/80 px-4 py-6 text-white backdrop-blur-md"
      @click.self="closeGift"
    >
      <article class="relative w-full max-w-md overflow-hidden rounded-4xl border border-amber-200/30 bg-[#090b19] p-6 text-center shadow-2xl shadow-fuchsia-950/50">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(251,191,36,0.26),transparent_32%),radial-gradient(circle_at_100%_100%,rgba(217,70,239,0.26),transparent_34%)]"></div>
        <button
          type="button"
          class="absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-lg font-black text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Cerrar regalo"
          @click="closeGift"
        >
          x
        </button>

        <div class="relative z-10">
          <div class="mx-auto grid size-28 place-items-center rounded-full border border-amber-200/50 bg-linear-to-br from-amber-200 via-fuchsia-300 to-violet-500 text-5xl shadow-[0_0_70px_rgba(244,114,182,0.48)]">
            <i class="fa-solid fa-gift text-slate-950" aria-hidden="true"></i>
          </div>
          <p class="mt-6 text-xs font-black uppercase tracking-[0.32em] text-amber-200">
            Regalo recibido
          </p>
          <h2 class="mt-3 text-3xl font-black leading-tight">
            Te enviaron un regalo
          </h2>
          <p class="mt-3 text-sm font-bold leading-6 text-slate-300">
            {{ giftMessage }}
          </p>
          <p class="mt-5 rounded-2xl border border-amber-200/30 bg-amber-300/10 px-5 py-4 text-3xl font-black text-amber-100">
            +{{ giftAmount }} pts
          </p>
          <button
            type="button"
            class="mt-6 min-h-12 w-full rounded-2xl bg-linear-to-r from-amber-400 to-fuchsia-500 px-6 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01]"
            @click="closeGift"
          >
            Recibir regalo
          </button>
        </div>
      </article>
    </div>
  </Teleport>
</template>
