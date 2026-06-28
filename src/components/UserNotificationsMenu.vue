<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getCurrentApiAuth } from '../services/api/authApi'
import { onStoredAuthChange } from '../services/api/client'
import { getNotifications, markNotificationRead } from '../services/api/notificationsApi'
import { isPushSupported, requestAndRegisterPushToken } from '../services/firebasePush'

const isOpen = ref(false)
const isLoading = ref(false)
const isEnablingPush = ref(false)
const errorMessage = ref('')
const notifications = ref([])
const currentUser = ref(null)
const pushSupported = ref(false)
const pushPermission = ref(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
const menuRef = ref(null)

let unsubscribeAuth = null
let refreshTimer = null

const unreadCount = computed(() => notifications.value.filter((item) => !item.readAt).length)
const hasSession = computed(() => Boolean(currentUser.value))

const notificationTitle = (notification) => {
  const payload = notification?.payload || {}
  if (payload.title) return payload.title
  if (notification.type === 'admin_points_gift') return 'Tienes un regalo'
  if (notification.type === 'mission_completed') return 'Mision completada'
  if (notification.type === 'admin_push') return 'Notificacion'
  return 'Notificacion'
}

const notificationBody = (notification) => {
  const payload = notification?.payload || {}
  return payload.message || payload.body || payload.description || 'Tienes una nueva notificacion.'
}

const notificationIcon = (notification) => {
  if (notification.type === 'admin_points_gift') return 'fa-solid fa-gift text-amber-200'
  if (notification.type === 'mission_completed') return 'fa-solid fa-bullseye text-emerald-200'
  if (notification.type === 'admin_push') return 'fa-solid fa-bell text-cyan-200'
  return 'fa-solid fa-circle-info text-fuchsia-200'
}

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const loadNotifications = async () => {
  if (!getCurrentApiAuth()?.accessToken || isLoading.value) return
  isLoading.value = true
  errorMessage.value = ''

  try {
    notifications.value = await getNotifications(40)
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudieron cargar notificaciones.'
  } finally {
    isLoading.value = false
  }
}

const toggleOpen = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) loadNotifications()
}

const closeMenu = () => {
  isOpen.value = false
}

const handleDocumentClick = (event) => {
  if (!isOpen.value) return
  if (menuRef.value?.contains(event.target)) return
  closeMenu()
}

const handleEscape = (event) => {
  if (event.key === 'Escape') closeMenu()
}

const readNotification = async (notification) => {
  if (!notification?.id || notification.readAt) return
  notification.readAt = new Date().toISOString()
  await markNotificationRead(notification.id).catch(() => {})
}

const openNotificationPage = (notification) => {
  if (!notification?.id) return
  closeMenu()
  window.location.href = `/notificaciones?id=${encodeURIComponent(notification.id)}`
}

const markAllRead = async () => {
  const unread = notifications.value.filter((item) => !item.readAt)
  unread.forEach((item) => {
    item.readAt = new Date().toISOString()
  })
  await Promise.all(unread.map((item) => markNotificationRead(item.id).catch(() => {})))
}

const enablePush = async () => {
  isEnablingPush.value = true
  errorMessage.value = ''

  try {
    const result = await requestAndRegisterPushToken()
    pushPermission.value = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
    if (!result.ok) {
      errorMessage.value = result.code
        ? `No se pudo registrar push (${result.code}).`
        : 'No se pudo activar push en este navegador.'
    }
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo activar push.'
  } finally {
    isEnablingPush.value = false
  }
}

const syncAuth = async () => {
  const auth = getCurrentApiAuth()
  currentUser.value = auth?.user || null
  if (!currentUser.value) {
    notifications.value = []
    isOpen.value = false
    return
  }
  await loadNotifications()
}

onMounted(async () => {
  pushSupported.value = await isPushSupported()
  pushPermission.value = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  await syncAuth()
  unsubscribeAuth = onStoredAuthChange(syncAuth)
  refreshTimer = window.setInterval(loadNotifications, 60 * 1000)
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  unsubscribeAuth?.()
  window.clearInterval(refreshTimer)
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <div v-if="hasSession" ref="menuRef" class="relative">
    <button
      type="button"
      class="relative grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-white"
      aria-label="Notificaciones"
      :aria-expanded="isOpen"
      @click.stop="toggleOpen"
    >
      <i class="fa-solid fa-bell" aria-hidden="true"></i>
      <span
        v-if="unreadCount"
        class="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-black text-white ring-2 ring-slate-950"
      >
        {{ unreadCount > 9 ? '9+' : unreadCount }}
      </span>
    </button>

    <div
      v-if="isOpen"
      class="absolute right-0 top-12 z-80 w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-3xl border border-white/10 bg-[#080a18] text-white shadow-2xl shadow-black/45"
    >
      <div class="border-b border-white/10 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
              Notificaciones
            </p>
            <h3 class="mt-1 text-lg font-black text-white">Tu actividad</h3>
          </div>
          <button
            v-if="unreadCount"
            type="button"
            class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
            @click="markAllRead"
          >
            Leer todo
          </button>
        </div>
        <a
          href="/notificaciones"
          class="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-400/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-fuchsia-100 transition hover:bg-fuchsia-400/15"
          @click="closeMenu"
        >
          Ver todas las notificaciones
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </a>

        <div
          v-if="pushSupported && pushPermission !== 'granted'"
          class="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3"
        >
          <p class="text-sm font-black text-cyan-100">Activa push notifications</p>
          <p class="mt-1 text-xs leading-5 text-slate-300">
            Recibe regalos, avances de artistas y avisos importantes aunque no tengas la web abierta.
          </p>
          <button
            type="button"
            class="mt-2 rounded-full bg-linear-to-r from-cyan-400 to-fuchsia-500 px-4 py-2 text-xs font-black uppercase tracking-wide text-white disabled:opacity-60"
            :disabled="isEnablingPush"
            @click="enablePush"
          >
            {{ isEnablingPush ? 'Activando...' : 'Activar push' }}
          </button>
        </div>

        <p
          v-if="errorMessage"
          class="mt-3 rounded-2xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200"
        >
          {{ errorMessage }}
        </p>
      </div>

      <div class="max-h-96 overflow-y-auto p-2">
        <div v-if="isLoading" class="p-4 text-sm font-bold text-slate-400">
          Cargando notificaciones...
        </div>

        <button
          v-for="notification in notifications"
          :key="notification.id"
          type="button"
          class="flex w-full gap-3 rounded-2xl p-3 text-left transition hover:bg-white/8"
          :class="notification.readAt ? 'opacity-70' : 'bg-white/5'"
          @click="openNotificationPage(notification)"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/8">
            <i :class="notificationIcon(notification)" aria-hidden="true"></i>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-black text-white">
              {{ notificationTitle(notification) }}
            </span>
            <span class="mt-1 block text-xs leading-5 text-slate-300">
              {{ notificationBody(notification) }}
            </span>
            <span class="mt-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {{ formatDate(notification.createdAt) }}
            </span>
          </span>
          <span
            v-if="!notification.readAt"
            class="mt-1 size-2 rounded-full bg-fuchsia-400"
          ></span>
        </button>

        <div
          v-if="!isLoading && !notifications.length"
          class="p-5 text-center text-sm font-bold text-slate-400"
        >
          Todavia no tienes notificaciones.
        </div>
      </div>
    </div>
  </div>
</template>
