<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiRequest } from '../services/api/client'
import { routePath } from '../utils/localizedRoutes'

const { locale, t } = useI18n()

const email = ref('')
const confirm = ref('')
const busy = ref(false)
const message = ref('')
const messageType = ref('info')
const formHidden = ref(false)

const isEn = computed(() => String(locale.value || 'es').toLowerCase().startsWith('en'))

const showMsg = (type, text) => {
  messageType.value = type
  message.value = text
}

const confirmToken = async (token) => {
  busy.value = true
  showMsg('info', t('deleteAccount.confirming'))
  try {
    const data = await apiRequest('/account/deletion-confirm', {
      method: 'POST',
      body: { token },
    })
    formHidden.value = true
    showMsg('ok', data?.message || t('deleteAccount.confirmOk'))
  } catch (error) {
    showMsg('err', error?.message || t('deleteAccount.confirmErr'))
  } finally {
    busy.value = false
  }
}

const submitRequest = async () => {
  busy.value = true
  showMsg('info', t('deleteAccount.submitting'))
  try {
    const data = await apiRequest('/account/deletion-request', {
      method: 'POST',
      body: {
        email: email.value.trim(),
        confirm: confirm.value.trim(),
        locale: isEn.value ? 'en' : 'es',
      },
    })
    showMsg('ok', data?.message || t('deleteAccount.requestOk'))
  } catch (error) {
    showMsg('err', error?.message || t('deleteAccount.requestErr'))
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  const token = new URLSearchParams(window.location.search).get('token')
  if (token) confirmToken(token)
})
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
    <div class="overflow-hidden rounded-4xl border border-violet-300/20 bg-white/5 p-1 text-white shadow-2xl shadow-fuchsia-950/30">
      <div class="rounded-[calc(2rem-4px)] bg-[#080a18]/95 p-6 sm:p-8">
        <a :href="routePath('home', locale)" class="text-sm font-black text-fuchsia-300 transition hover:text-white">
          {{ $t('deleteAccount.backHome') }}
        </a>

        <p class="mt-6 text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300">
          {{ $t('deleteAccount.eyebrow') }}
        </p>
        <h1 class="mt-2 text-3xl font-black leading-tight sm:text-5xl">
          {{ $t('deleteAccount.title') }}
        </h1>
        <p class="mt-4 text-sm leading-6 text-slate-300">
          {{ $t('deleteAccount.lead') }}
        </p>

        <div class="mt-8 space-y-3 text-sm leading-6 text-slate-300">
          <h2 class="text-lg font-black text-white">{{ $t('deleteAccount.howTitle') }}</h2>
          <ol class="list-decimal space-y-2 pl-5">
            <li>{{ $t('deleteAccount.step1') }}</li>
            <li>{{ $t('deleteAccount.step2') }}</li>
            <li>{{ $t('deleteAccount.step3') }}</li>
          </ol>
          <p>
            {{ $t('deleteAccount.note') }}
          </p>
        </div>

        <form
          v-if="!formHidden"
          class="mt-8 grid gap-4"
          @submit.prevent="submitRequest"
        >
          <label class="grid gap-2 text-sm font-bold">
            <span>{{ $t('deleteAccount.emailLabel') }}</span>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-fuchsia-400"
              placeholder="tu@email.com"
            />
          </label>

          <label class="grid gap-2 text-sm font-bold">
            <span>{{ $t('deleteAccount.confirmLabel') }}</span>
            <input
              v-model="confirm"
              type="text"
              required
              autocomplete="off"
              class="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-fuchsia-400"
              :placeholder="isEn ? 'DELETE' : 'ELIMINAR'"
            />
          </label>

          <button
            type="submit"
            class="rounded-full bg-linear-to-r from-rose-400 via-fuchsia-400 to-cyan-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
            :disabled="busy"
          >
            {{ busy ? $t('deleteAccount.submitting') : $t('deleteAccount.submit') }}
          </button>
        </form>

        <p
          v-if="message"
          class="mt-5 rounded-2xl border px-4 py-3 text-sm"
          :class="{
            'border-emerald-400/30 bg-emerald-400/10 text-emerald-300': messageType === 'ok',
            'border-rose-400/30 bg-rose-400/10 text-rose-300': messageType === 'err',
            'border-cyan-400/30 bg-cyan-400/10 text-cyan-200': messageType === 'info',
          }"
        >
          {{ message }}
        </p>
      </div>
    </div>
  </section>
</template>
