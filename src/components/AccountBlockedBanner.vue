<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getCurrentApiAuth, getMe } from '../services/api/authApi'
import { onStoredAuthChange } from '../services/api/client'

const { t, locale } = useI18n()
const accountBlock = ref(null)
const dismissed = ref(false)

const isBlocked = computed(() => Boolean(accountBlock.value?.blocked) && !dismissed.value)

const expiryLabel = computed(() => {
  const block = accountBlock.value
  if (!block?.blocked) return ''
  if (block.permanent || !block.expiresAt) {
    return t('accountBlock.permanent')
  }
  const date = new Date(block.expiresAt)
  if (Number.isNaN(date.getTime())) return ''
  return t('accountBlock.until', {
    date: date.toLocaleString(locale.value === 'en' ? 'en-US' : 'es-ES'),
  })
})

const loadBlockStatus = async () => {
  const auth = getCurrentApiAuth()
  if (!auth?.user || auth.user.isAnonymous) {
    accountBlock.value = null
    dismissed.value = false
    return
  }

  try {
    const me = await getMe()
    accountBlock.value = me?.accountBlock?.blocked ? me.accountBlock : null
    if (!accountBlock.value?.blocked) {
      dismissed.value = false
    }
  } catch {
    accountBlock.value = null
  }
}

let unsubscribeAuth = null

onMounted(() => {
  loadBlockStatus()
  unsubscribeAuth = onStoredAuthChange(() => {
    loadBlockStatus()
  })
})

onUnmounted(() => {
  unsubscribeAuth?.()
})
</script>

<template>
  <div
    v-if="isBlocked"
    class="fixed inset-x-0 top-16 z-50 px-3 sm:top-[4.5rem] sm:px-4"
    role="alert"
  >
    <div class="mx-auto flex max-w-4xl items-start gap-3 rounded-2xl border border-red-300/30 bg-red-950/95 px-4 py-3 shadow-xl shadow-red-950/40 backdrop-blur-md">
      <span class="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-red-300/25 bg-red-500/15 text-red-100">
        <i class="fa-solid fa-user-lock" aria-hidden="true"></i>
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-black text-red-100">
          {{ $t('accountBlock.title') }}
        </p>
        <p class="mt-1 text-sm font-bold leading-6 text-red-100/90">
          {{ accountBlock.reason }}
        </p>
        <p v-if="expiryLabel" class="mt-1 text-xs font-bold uppercase tracking-wide text-red-200/80">
          {{ expiryLabel }}
        </p>
        <p class="mt-2 text-xs font-bold text-red-100/75">
          {{ $t('accountBlock.restricted') }}
        </p>
      </div>
      <button
        type="button"
        class="grid size-8 shrink-0 place-items-center rounded-full border border-red-300/20 bg-red-500/10 text-lg font-black text-red-100 transition hover:bg-red-500/20"
        :aria-label="$t('accountBlock.dismiss')"
        @click="dismissed = true"
      >
        ×
      </button>
    </div>
  </div>
</template>
