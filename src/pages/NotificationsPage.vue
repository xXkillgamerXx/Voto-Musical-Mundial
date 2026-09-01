<script setup>
import { computed, onMounted, ref } from 'vue'
import { translate } from '../i18n'
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
    const auth = getCurrentApiAuth()
    if (!auth?.accessToken || !auth?.user || auth.user.isAnonymous) {
      notifications.value = []
      return
    }
    notifications.value = await getNotifications(100)
  } catch (error) {
    if (error?.status === 401) {
      notifications.value = []
      return
    }
    errorMessage.value = error?.message || translate('notifications.loadError')
  } finally {
    isLoading.value = false
  }
}

const openNotification = async (notification) => {
  if (!notification?.id) return

  if (!notification.readAt) {
    notification.readAt = new Date().toISOString()
    await markNotificationRead(notification.id).catch(() => {})
  }

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
        ? translate('notifications.enableErrorCode', { code: result.code })
        : translate('notifications.enableErrorBrowser')
    }
  } catch (error) {
    errorMessage.value = error?.message || translate('notifications.enableError')
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
  <section class="mx-auto max-w-352 px-4 py-8 sm:px-6 lg:py-12">
    <div class="rounded-3xl border border-violet-300/15 bg-[#090b19]/90 p-5 text-white shadow-2xl shadow-fuchsia-950/20 sm:p-7">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
            {{ $t('notifications.center') }}
          </p>
          <h1 class="mt-2 text-3xl font-black text-white sm:text-4xl">
            {{ $t('notifications.yourNotifications') }}
          </h1>
          <p class="mt-2 text-sm font-bold text-slate-400">
            {{ $t('notifications.unreadSummary', { count: unreadCount }) }}
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-if="unreadCount"
            type="button"
            class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
            @click="markAllRead"
          >
            {{ $t('notifications.markAllRead') }}
          </button>
          <button
            type="button"
            class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
            @click="loadNotifications"
          >
            {{ $t('notifications.refresh') }}
          </button>
        </div>
      </div>

      <div
        v-if="pushSupported && pushPermission !== 'granted'"
        class="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4"
      >
        <p class="text-lg font-black text-cyan-100">{{ $t('notifications.enablePush') }}</p>
        <p class="mt-1 text-sm leading-6 text-slate-300">
          {{ $t('notifications.enablePushDescription') }}
        </p>
        <button
          type="button"
          class="mt-3 rounded-full bg-linear-to-r from-cyan-400 to-fuchsia-500 px-5 py-2 text-xs font-black uppercase tracking-wide text-white disabled:opacity-60"
          :disabled="isEnablingPush"
          @click="enablePush"
        >
          {{ isEnablingPush ? $t('notifications.enabling') : $t('notifications.enablePushButton') }}
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
        {{ $t('notifications.loading') }}
      </div>

      <button
        v-for="notification in visibleNotifications"
        :key="notification.id"
        type="button"
        class="flex w-full items-start gap-4 rounded-3xl border p-4 text-left text-white transition hover:border-fuchsia-300/35 hover:bg-white/10"
        :class="notification.readAt
          ? 'border-white/10 bg-[#090b19]/70'
          : 'border-fuchsia-300/20 bg-fuchsia-500/8 shadow-lg shadow-fuchsia-950/10'"
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
              class="shrink-0 rounded-full bg-fuchsia-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white"
            >
              {{ $t('notifications.new') }}
            </span>
          </span>
          <span class="mt-1 block text-sm leading-6 text-slate-300">{{ bodyFor(notification) }}</span>
          <span class="mt-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
            {{ formatDate(notification.createdAt) }}
          </span>
        </span>
        <span
          v-if="notification?.payload?.url"
          class="mt-1 hidden shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-100 sm:inline-flex"
        >
          {{ $t('notifications.open') }}
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
        <h2 class="mt-4 text-2xl font-black text-white">{{ $t('notifications.empty') }}</h2>
        <p class="mt-2 text-sm font-bold text-slate-400">
          {{ $t('notifications.emptyDescription') }}
        </p>
      </div>
    </div>
  </section>
</template>
