<script setup>
import { computed, onMounted, ref } from 'vue'
import { i18n, translate } from '../i18n'
import {
  peekPendingVerifyEmail,
  resendEmailVerification,
  verifyEmailCode,
} from '../services/api/authApi'

const emailFromQuery = computed(() => {
  try {
    return new URLSearchParams(window.location.search).get('email') || ''
  } catch {
    return ''
  }
})

const email = ref('')
const code = ref('')
const isLoading = ref(false)
const isResending = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

onMounted(() => {
  email.value = (emailFromQuery.value || peekPendingVerifyEmail() || '').trim().toLowerCase()
})

const normalizeCode = (value) => String(value || '').replace(/\D/g, '').slice(0, 6)

const handleCodeInput = (event) => {
  code.value = normalizeCode(event.target.value)
}

const handleVerify = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  const normalizedEmail = email.value.trim().toLowerCase()
  const normalizedCode = normalizeCode(code.value)

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    errorMessage.value = translate('auth.errors.invalidEmail')
    return
  }

  if (normalizedCode.length !== 6) {
    errorMessage.value = translate('auth.verifyCodeInvalid')
    return
  }

  isLoading.value = true
  try {
    await verifyEmailCode({
      email: normalizedEmail,
      code: normalizedCode,
    })
    window.location.href = '/'
  } catch (error) {
    errorMessage.value = error?.message || translate('auth.errors.genericAction')
  } finally {
    isLoading.value = false
  }
}

const handleResend = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  const normalizedEmail = email.value.trim().toLowerCase()
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    errorMessage.value = translate('auth.errors.invalidEmail')
    return
  }

  isResending.value = true
  try {
    await resendEmailVerification({
      email: normalizedEmail,
      locale: i18n.global.locale.value === 'en' ? 'en' : 'es',
    })
    successMessage.value = translate('auth.verifyResent')
  } catch (error) {
    errorMessage.value = error?.message || translate('auth.errors.genericAction')
  } finally {
    isResending.value = false
  }
}
</script>

<template>
  <section class="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10 sm:px-6">
    <div class="w-full overflow-hidden rounded-4xl border border-violet-300/25 bg-[#080a18] p-1 text-white shadow-2xl shadow-fuchsia-950/40">
      <div class="rounded-[calc(2rem-4px)] bg-[#080a18]/95 p-6 sm:p-8">
        <a href="/" class="text-sm font-black text-fuchsia-300 transition hover:text-white">
          {{ $t('auth.goToLogin') }}
        </a>
        <p class="mt-6 text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300">
          {{ $t('auth.fanAccount') }}
        </p>
        <h1 class="mt-2 text-3xl font-black leading-tight sm:text-4xl">
          {{ $t('auth.verifyTitle') }}
        </h1>
        <p class="mt-2 text-sm leading-6 text-slate-300">
          {{ $t('auth.verifySubtitle') }}
        </p>
        <p
          v-if="email"
          class="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-50"
        >
          {{ email }}
        </p>
        <p class="mt-2 text-xs text-slate-500">
          {{ $t('auth.verifyInboxHint') }}
        </p>

        <form class="mt-6 space-y-4" @submit.prevent="handleVerify">
          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">
              {{ $t('auth.basicData') }}
            </span>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/20 focus:bg-white/8"
              :placeholder="$t('auth.emailPlaceholder')"
            />
          </label>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">
              {{ $t('auth.verifyCodeLabel') }}
            </span>
            <input
              :value="code"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="6"
              required
              autocomplete="one-time-code"
              class="mt-2 min-h-14 w-full rounded-lg border border-cyan-300/25 bg-cyan-400/5 px-5 text-center text-2xl font-black tracking-[0.4em] text-cyan-100 outline-none transition placeholder:tracking-normal placeholder:text-slate-500 focus:border-cyan-300/50"
              :placeholder="$t('auth.verifyCodePlaceholder')"
              @input="handleCodeInput"
            />
          </label>

          <p
            v-if="errorMessage"
            class="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
          >
            {{ errorMessage }}
          </p>
          <p
            v-if="successMessage"
            class="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100"
          >
            {{ successMessage }}
          </p>

          <button
            type="submit"
            class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-fuchsia-500 to-cyan-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isLoading"
          >
            <i
              v-if="isLoading"
              class="fa-solid fa-circle-notch fa-spin"
              aria-hidden="true"
            ></i>
            {{ isLoading ? $t('auth.processing') : $t('auth.verifySubmit') }}
          </button>

          <button
            type="button"
            class="min-h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            :disabled="isResending || isLoading"
            @click="handleResend"
          >
            {{ isResending ? $t('auth.processing') : $t('auth.verifyResend') }}
          </button>
        </form>
      </div>
    </div>
  </section>
</template>
