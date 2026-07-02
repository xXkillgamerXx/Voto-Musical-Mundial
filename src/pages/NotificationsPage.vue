<script setup>
import { computed, onMounted, ref } from 'vue'
import { getCurrentApiAuth } from '../services/api/authApi'
import { getNotifications, markNotificationRead } from '../services/api/notificationsApi'
import { isPushSupported, requestAndRegisterPushToken } from '../services/firebasePush'
import {
  getNotificationBody,
  getNotificationIcon,
  getNotificationTitle,
  shouldDisplayNotification,
} from '../utils/notificationDisplay'

const notifications = ref([])
const isLoading = ref(true)
const isEnablingPush = ref(false)
const errorMessage = ref('')
const pushSupported = ref(false)
const pushPermission = ref(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

const visibleNotifications = computed(() =>
  notifications.value.filter(shouldDisplayNotification),
)
const unreadCount = computed(() =>
  visibleNotifications.value.filter((item) => !item.readAt).length,
)

const titleFor = getNotificationTitle
const bodyFor = getNotificationBody
const iconFor = getNotificationIcon

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('es', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const loadNotifications = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    if (!getCurrentApiAuth()?.accessToken) {
      notifications.value = []
      return
    }
    notifications.value = await getNotifications(100)
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudieron cargar tus notificaciones.'
  } finally {
    isLoading.value = false
  }
}

const openNotification = async (notification) => {
  if (!notification?.id || notification.readAt) {
    return
  }

  notification.readAt = new Date().toISOString()
  await markNotificationRead(notification.id).catch(() => {})

  const url = notification?.payload?.url
  if (url) {
    window.location.href = url
  }
}

const markAllRead = async () => {
  const unread = visibleNotifications.value.filter((item) => !item.readAt)
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
        ? `No se pudo activar push (${result.code}).`
        : 'No se pudo activar push en este navegador.'
    }
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo activar push.'
  } finally {
    isEnablingPush.value = false
  }
}

onMounted(async () => {
  pushSupported.value = await isPushSupported()
  pushPermission.value = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  await loadNotifications()
})
</script>

<template>
  <section class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <div class="rounded-4xl border border-white/10 bg-slate-950/70 p-5 text-white shadow-2xl shadow-fuchsia-950/20 sm:p-7">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
            Centro de notificaciones
          </p>
          <h1 class="mt-2 text-3xl font-black text-white sm:text-4xl">
            Tus notificaciones
          </h1>
          <p class="mt-2 text-sm font-bold text-slate-400">
            {{ unreadCount }} sin leer · regalos, artistas, misiones y avisos importantes.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-if="unreadCount"
            type="button"
            class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
            @click="markAllRead"
          >
            Marcar leídas
          </button>
          <button
            type="button"
            class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
            @click="loadNotifications"
          >
            Actualizar
          </button>
        </div>
      </div>

      <div
        v-if="pushSupported && pushPermission !== 'granted'"
        class="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4"
      >
        <p class="text-lg font-black text-cyan-100">Activa push notifications</p>
        <p class="mt-1 text-sm leading-6 text-slate-300">
          Recibe regalos, avances de artistas y avisos urgentes aunque no tengas la web abierta.
        </p>
        <button
          type="button"
          class="mt-3 rounded-full bg-linear-to-r from-cyan-400 to-fuchsia-500 px-5 py-2 text-xs font-black uppercase tracking-wide text-white disabled:opacity-60"
          :disabled="isEnablingPush"
          @click="enablePush"
        >
          {{ isEnablingPush ? 'Activando...' : 'Activar push' }}
        </button>
      </div>

      <p
        v-if="errorMessage"
        class="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
      >
        {{ errorMessage }}
      </p>
    </div>

    <div class="mt-6 space-y-3">
      <div
        v-if="isLoading"
        class="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm font-bold text-slate-300"
      >
        Cargando notificaciones...
      </div>

      <button
        v-for="notification in visibleNotifications"
        :key="notification.id"
        type="button"
        class="group flex w-full gap-4 rounded-3xl border border-white/10 bg-slate-950/65 p-4 text-left text-white transition hover:border-fuchsia-300/30 hover:bg-white/7"
        :class="notification.readAt ? 'opacity-75' : 'shadow-lg shadow-fuchsia-950/10'"
        @click="openNotification(notification)"
      >
        <span class="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/8 ring-1 ring-white/10">
          <i :class="iconFor(notification)" aria-hidden="true"></i>
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex items-start justify-between gap-3">
            <span class="text-base font-black text-white">{{ titleFor(notification) }}</span>
            <span
              v-if="!notification.readAt"
              class="mt-1 rounded-full bg-fuchsia-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white"
            >
              Nuevo
            </span>
          </span>
          <span class="mt-1 block text-sm leading-6 text-slate-300">{{ bodyFor(notification) }}</span>
          <span class="mt-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
            {{ formatDate(notification.createdAt) }}
          </span>
        </span>
        <span
          v-if="notification?.payload?.url"
          class="hidden shrink-0 items-center gap-2 rounded-full border border-fuchsia-300/25 bg-linear-to-r from-fuchsia-500/20 to-cyan-400/20 px-4 py-2 text-[11px] font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/20 transition group-hover:inline-flex group-hover:scale-[1.02]"
        >
          Abrir
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </span>
      </button>

      <div
        v-if="!isLoading && !visibleNotifications.length"
        class="rounded-4xl border border-white/10 bg-white/5 p-8 text-center"
      >
        <div class="mx-auto grid size-16 place-items-center rounded-3xl bg-white/8 text-2xl text-fuchsia-200">
          <i class="fa-regular fa-bell" aria-hidden="true"></i>
        </div>
        <h2 class="mt-4 text-2xl font-black text-white">No tienes notificaciones</h2>
        <p class="mt-2 text-sm font-bold text-slate-400">
          Cuando recibas regalos, avisos de artistas o misiones, aparecerán aquí.
        </p>
      </div>
    </div>
  </section>
</template>
