<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getCurrentApiAuth } from '../services/api/authApi'
import { getStoredAuth, onStoredAuthChange, setStoredAuth } from '../services/api/client'
import { getNotifications, markNotificationRead } from '../services/api/notificationsApi'
import { subscribeUserRealtime } from '../services/api/realtimeApi'

const REFRESH_MS = 60 * 1000
const giftNotification = ref(null)
const isOpen = ref(false)
const isLoading = ref(false)
const giftRevealed = ref(false)
const displayPointsAfter = ref(0)

let refreshTimer = null
let autoCloseTimer = null
let pointsAnimationFrame = null
let unsubscribeAuth = null
let unsubscribeUserRealtime = null
let subscribedUserId = null

const applyGiftPoints = (points) => {
  const nextPoints = Number(points)

  if (points === undefined || points === null || !Number.isFinite(nextPoints)) {
    return
  }

  const stored = getStoredAuth()
  if (stored?.user && !stored.user.isAnonymous) {
    setStoredAuth({
      ...stored,
      user: { ...stored.user, points: nextPoints },
    })
  }
}

const subscribeRealtime = (userId) => {
  if (subscribedUserId === userId) {
    return
  }

  unsubscribeUserRealtime?.()
  unsubscribeUserRealtime = null
  subscribedUserId = userId || null

  if (!userId) {
    return
  }

  unsubscribeUserRealtime = subscribeUserRealtime(userId, {
    onUserEvent: (event) => {
      if (event?.type !== 'points_gift') {
        return
      }

      applyGiftPoints(event.points)
      loadGiftNotification()
    },
  })
}

const giftAmount = computed(() =>
  Number(
    giftNotification.value?.payload?.amount ||
    giftNotification.value?.payload?.rewardPoints ||
    0,
  ).toLocaleString('es'),
)
const isMissionGift = computed(() => giftNotification.value?.type === 'mission_completed')
const giftMessage = computed(() =>
  giftNotification.value?.payload?.message ||
  (isMissionGift.value
    ? `Completaste una misión y ganaste ${giftAmount.value} puntos.`
    : `Recibiste ${giftAmount.value} puntos de regalo.`),
)
const giftSender = computed(() =>
  isMissionGift.value
    ? 'Sistema de misiones'
    :
  giftNotification.value?.payload?.senderName ||
  giftNotification.value?.payload?.adminName ||
  'Equipo Voto Musica Mundial',
)
const pointsAfter = computed(() =>
  Number(displayPointsAfter.value || 0).toLocaleString('es'),
)

const animatePointsAfter = (from, to) => {
  const startValue = Number(from || 0)
  const target = Number(to || 0)

  if (pointsAnimationFrame) {
    window.cancelAnimationFrame(pointsAnimationFrame)
    pointsAnimationFrame = null
  }

  displayPointsAfter.value = startValue

  if (startValue === target) {
    displayPointsAfter.value = target
    return
  }

  const duration = Math.min(1200, Math.max(620, Math.abs(target - startValue) * 10))
  const startedAt = performance.now()

  const step = (nowTs) => {
    const progress = Math.min(1, (nowTs - startedAt) / duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    displayPointsAfter.value = Math.round(startValue + (target - startValue) * eased)

    if (progress < 1) {
      pointsAnimationFrame = window.requestAnimationFrame(step)
      return
    }

    displayPointsAfter.value = target
    pointsAnimationFrame = null
  }

  pointsAnimationFrame = window.requestAnimationFrame(step)
}

const scheduleAutoClose = () => {
  window.clearTimeout(autoCloseTimer)
}

const loadGiftNotification = async () => {
  if (!getCurrentApiAuth()?.accessToken || isLoading.value || isOpen.value) {
    return
  }

  isLoading.value = true
  try {
    const notifications = await getNotifications(10)
    const nextGift = (notifications || []).find(
      (notification) =>
        !notification.readAt &&
        (notification.type === 'admin_points_gift' || notification.type === 'mission_completed'),
    )

    if (nextGift) {
      giftNotification.value = nextGift
      giftRevealed.value = false
      isOpen.value = true
      scheduleAutoClose()
    }
  } catch {
    giftNotification.value = null
  } finally {
    isLoading.value = false
  }
}

const closeGift = async () => {
  const notificationId = giftNotification.value?.id
  window.clearTimeout(autoCloseTimer)
  if (pointsAnimationFrame) {
    window.cancelAnimationFrame(pointsAnimationFrame)
    pointsAnimationFrame = null
  }
  isOpen.value = false
  giftRevealed.value = false
  giftNotification.value = null

  if (notificationId) {
    await markNotificationRead(notificationId).catch(() => {})
  }
}

const revealGift = () => {
  giftRevealed.value = true
  const pointsAfterValue = Number(giftNotification.value?.payload?.pointsAfter || 0)
  const rewardValue = Number(
    giftNotification.value?.payload?.amount ||
    giftNotification.value?.payload?.rewardPoints ||
    0,
  )

  applyGiftPoints(pointsAfterValue)
  animatePointsAfter(
    giftNotification.value?.payload?.pointsBefore || Math.max(0, pointsAfterValue - rewardValue),
    pointsAfterValue,
  )
}

const syncAuth = () => {
  const auth = getCurrentApiAuth()

  if (!auth?.accessToken) {
    isOpen.value = false
    giftNotification.value = null
    subscribeRealtime(null)
    return
  }

  subscribeRealtime(auth.user?.id ? String(auth.user.id) : null)
  loadGiftNotification()
}

onMounted(() => {
  syncAuth()
  unsubscribeAuth = onStoredAuthChange(syncAuth)
  refreshTimer = window.setInterval(loadGiftNotification, REFRESH_MS)
})

onUnmounted(() => {
  unsubscribeAuth?.()
  unsubscribeUserRealtime?.()
  window.clearInterval(refreshTimer)
  window.clearTimeout(autoCloseTimer)
  if (pointsAnimationFrame) {
    window.cancelAnimationFrame(pointsAnimationFrame)
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-90 grid place-items-center bg-black/80 px-4 py-6 text-white backdrop-blur-md"
      @click.self="closeGift"
    >
      <article class="relative w-full max-w-2xl overflow-hidden rounded-4xl border border-amber-200/30 bg-[#090b19] p-6 shadow-2xl shadow-fuchsia-950/50 sm:p-8">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(251,191,36,0.28),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(217,70,239,0.24),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(35,10,50,0.96))]"></div>
        <div class="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-amber-300/20 blur-3xl"></div>
        <div class="pointer-events-none absolute -bottom-24 right-0 size-80 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
        <button
          type="button"
          class="absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-lg font-black text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Cerrar regalo"
          @click.stop.prevent="closeGift"
        >
          ×
        </button>

        <div class="relative z-10 text-center">
          <div
            class="mx-auto grid size-24 place-items-center rounded-4xl border border-amber-200/45 bg-linear-to-br from-amber-200 via-fuchsia-300 to-violet-500 text-5xl shadow-[0_0_80px_rgba(244,114,182,0.5)]"
            :class="!giftRevealed && 'animate-bounce'"
          >
            <i class="fa-solid fa-gift text-slate-950" aria-hidden="true"></i>
          </div>
          <p class="mt-6 text-xs font-black uppercase tracking-[0.32em] text-amber-200">
            {{ giftRevealed ? (isMissionGift ? 'Premio recibido' : 'Regalo abierto') : (isMissionGift ? 'Misión completada' : 'Tienes un regalo') }}
          </p>
          <h2 class="mt-3 text-5xl font-black leading-none text-white sm:text-7xl">
            {{ giftRevealed ? `+${giftAmount} pts` : (isMissionGift ? 'Premio' : 'Sorpresa') }}
          </h2>
          <p class="mx-auto mt-4 max-w-md text-base font-bold leading-7 text-slate-300">
            {{ giftRevealed ? giftMessage : (isMissionGift ? 'Completaste una misión. Abre tu premio para recibir los puntos.' : 'Alguien del equipo te envió un regalo. Ábrelo para descubrir cuántos puntos recibiste.') }}
          </p>

          <div
            v-if="giftRevealed"
            class="mx-auto mt-6 grid max-w-lg gap-3 text-left sm:grid-cols-2"
          >
            <div class="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Enviado por
              </p>
              <p class="mt-2 text-lg font-black text-white">
                {{ giftSender }}
              </p>
            </div>
            <p
              v-if="pointsAfter !== '0'"
              class="rounded-3xl border border-amber-200/25 bg-amber-300/10 p-4"
            >
              <span class="block text-[10px] font-black uppercase tracking-widest text-amber-200">
                Nuevo saldo
              </span>
              <span class="mt-2 block text-lg font-black text-white">
                {{ pointsAfter }} pts
              </span>
            </p>
          </div>

          <button
            type="button"
            class="mt-7 min-h-12 w-full max-w-sm rounded-2xl bg-linear-to-r from-amber-300 via-fuchsia-400 to-violet-500 px-6 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/35 transition hover:scale-[1.01]"
            @click="giftRevealed ? closeGift() : revealGift()"
          >
            {{ giftRevealed ? 'Listo' : 'Abrir regalo' }}
          </button>
        </div>
      </article>
    </div>
  </Teleport>
</template>
