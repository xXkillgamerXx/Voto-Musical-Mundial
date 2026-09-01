<script setup>
import { computed, onMounted, ref } from 'vue'
import AdminFanStoreView from './AdminFanStoreView.vue'
import {
  getAdminAppDownload,
  getAdminDailyRewards,
  getAdminShareVoteBoost,
  updateAdminAppDownload,
  updateAdminDailyRewards,
  updateAdminShareVoteBoost,
} from '../../services/api/adminApi'

const DEFAULT_DAYS = [
  { day: 1, points: 5 },
  { day: 2, points: 10 },
  { day: 3, points: 15 },
  { day: 4, points: 20 },
  { day: 5, points: 25 },
  { day: 6, points: 30 },
  { day: 7, points: 50 },
]

const DEFAULT_PLAY_URL = 'https://play.google.com/store/apps/details?id=vote.musicmundial.com'

const days = ref(DEFAULT_DAYS.map((entry) => ({ ...entry })))
const shareBoost = ref({
  enabled: true,
  multiplier: 2,
  durationMinutes: 10,
  oncePerDay: false,
})
const appDownload = ref({
  enabled: true,
  playStoreUrl: DEFAULT_PLAY_URL,
  firstOpenRewardEnabled: true,
  firstOpenRewardPoints: 15,
  androidEntryMode: 'redirect',
})
const isLoading = ref(true)
const isSaving = ref(false)
const isSavingShareBoost = ref(false)
const isSavingAppDownload = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const shareBoostError = ref('')
const shareBoostSuccess = ref('')
const appDownloadError = ref('')
const appDownloadSuccess = ref('')

const weeklyTotal = computed(() =>
  days.value.reduce((total, entry) => total + Number(entry.points || 0), 0),
)

const loadSettings = async () => {
  isLoading.value = true
  errorMessage.value = ''
  shareBoostError.value = ''
  appDownloadError.value = ''

  try {
    const [rewardsPayload, boostPayload, downloadPayload] = await Promise.all([
      getAdminDailyRewards(),
      getAdminShareVoteBoost(),
      getAdminAppDownload(),
    ])
    days.value = (rewardsPayload?.days || DEFAULT_DAYS).map((entry) => ({
      day: Number(entry.day),
      points: Number(entry.points || 0),
    }))
    shareBoost.value = {
      enabled: boostPayload?.enabled !== false,
      multiplier: Math.max(2, Number(boostPayload?.multiplier || 2)),
      durationMinutes: Math.max(1, Number(boostPayload?.durationMinutes || 10)),
      oncePerDay: boostPayload?.oncePerDay === true,
    }
    appDownload.value = {
      enabled: downloadPayload?.enabled !== false,
      playStoreUrl: String(downloadPayload?.playStoreUrl || DEFAULT_PLAY_URL).trim() || DEFAULT_PLAY_URL,
      firstOpenRewardEnabled: downloadPayload?.firstOpenRewardEnabled !== false,
      firstOpenRewardPoints: Math.max(
        0,
        Math.floor(Number(downloadPayload?.firstOpenRewardPoints ?? 15)),
      ),
      androidEntryMode: ['off', 'redirect', 'modal'].includes(
        String(downloadPayload?.androidEntryMode || ''),
      )
        ? String(downloadPayload.androidEntryMode)
        : 'redirect',
    }
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo cargar la configuracion de recompensas.'
  } finally {
    isLoading.value = false
  }
}

const resetDefaults = () => {
  days.value = DEFAULT_DAYS.map((entry) => ({ ...entry }))
  successMessage.value = ''
  errorMessage.value = ''
}

const saveSettings = async () => {
  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const payload = await updateAdminDailyRewards({
      days: days.value.map((entry) => ({
        day: Number(entry.day),
        points: Math.max(0, Math.floor(Number(entry.points || 0))),
      })),
    })

    days.value = (payload?.days || days.value).map((entry) => ({
      day: Number(entry.day),
      points: Number(entry.points || 0),
    }))
    successMessage.value = 'Recompensas diarias guardadas correctamente.'
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo guardar la configuracion.'
  } finally {
    isSaving.value = false
  }
}

const saveShareBoost = async () => {
  isSavingShareBoost.value = true
  shareBoostError.value = ''
  shareBoostSuccess.value = ''

  try {
    const payload = await updateAdminShareVoteBoost({
      enabled: Boolean(shareBoost.value.enabled),
      multiplier: Math.max(2, Math.floor(Number(shareBoost.value.multiplier || 2))),
      durationMinutes: Math.max(1, Math.floor(Number(shareBoost.value.durationMinutes || 10))),
      oncePerDay: Boolean(shareBoost.value.oncePerDay),
    })
    shareBoost.value = {
      enabled: payload?.enabled !== false,
      multiplier: Math.max(2, Number(payload?.multiplier || 2)),
      durationMinutes: Math.max(1, Number(payload?.durationMinutes || 10)),
      oncePerDay: payload?.oncePerDay === true,
    }
    shareBoostSuccess.value = 'Boost por compartir guardado correctamente.'
  } catch (error) {
    shareBoostError.value = error?.message || 'No se pudo guardar el boost por compartir.'
  } finally {
    isSavingShareBoost.value = false
  }
}

const saveAppDownload = async () => {
  isSavingAppDownload.value = true
  appDownloadError.value = ''
  appDownloadSuccess.value = ''

  try {
    const payload = await updateAdminAppDownload({
      enabled: Boolean(appDownload.value.enabled),
      playStoreUrl: String(appDownload.value.playStoreUrl || '').trim(),
      firstOpenRewardEnabled: Boolean(appDownload.value.firstOpenRewardEnabled),
      firstOpenRewardPoints: Math.max(
        0,
        Math.floor(Number(appDownload.value.firstOpenRewardPoints || 0)),
      ),
      androidEntryMode: appDownload.value.androidEntryMode,
    })
    appDownload.value = {
      enabled: payload?.enabled !== false,
      playStoreUrl: String(payload?.playStoreUrl || DEFAULT_PLAY_URL).trim() || DEFAULT_PLAY_URL,
      firstOpenRewardEnabled: payload?.firstOpenRewardEnabled !== false,
      firstOpenRewardPoints: Math.max(
        0,
        Math.floor(Number(payload?.firstOpenRewardPoints ?? 15)),
      ),
      androidEntryMode: ['off', 'redirect', 'modal'].includes(
        String(payload?.androidEntryMode || ''),
      )
        ? String(payload.androidEntryMode)
        : 'redirect',
    }
    appDownloadSuccess.value = 'Seccion de descarga de la app guardada correctamente.'
  } catch (error) {
    appDownloadError.value = error?.message || 'No se pudo guardar la URL de Google Play.'
  } finally {
    isSavingAppDownload.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <section class="space-y-6">
    <AdminFanStoreView />

    <article class="rounded-4xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
        Ajustes
      </p>
      <h2 class="mt-2 text-2xl font-black text-white">
        Recompensa diaria (7 dias)
      </h2>
      <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        Configura cuantos puntos recibe un fan cada dia de la racha semanal. Los puntos son
        <strong class="text-white">sumatorios</strong>: si completa los 7 dias, la suma total sera la que aparece abajo.
        Tras el dia 7, la racha vuelve al dia 1 la semana siguiente. Si falta un dia, la racha reinicia.
      </p>
    </article>

    <article class="rounded-4xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div v-if="isLoading" class="py-10 text-center text-sm font-bold text-slate-400">
        Cargando configuracion...
      </div>

      <template v-else>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label
            v-for="entry in days"
            :key="entry.day"
            class="rounded-3xl border border-white/10 bg-slate-950/45 p-4"
          >
            <span class="block text-xs font-black uppercase tracking-[0.24em] text-violet-300">
              Dia {{ entry.day }}
            </span>
            <div class="mt-3 flex items-center gap-2">
              <span class="text-sm font-black text-slate-400">+</span>
              <input
                v-model.number="entry.points"
                type="number"
                min="1"
                max="100000"
                class="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-lg font-black text-white outline-none transition focus:border-fuchsia-300/40"
              />
              <span class="text-xs font-black uppercase text-slate-500">pts</span>
            </div>
          </label>
        </div>

        <div class="mt-5 flex flex-col gap-4 rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">
              Total semanal sumatorio
            </p>
            <p class="mt-1 text-3xl font-black text-emerald-100">
              {{ weeklyTotal.toLocaleString() }} pts
            </p>
          </div>
          <p class="max-w-xl text-sm leading-6 text-emerald-100/80">
            Si el fan reclama los 7 dias seguidos, la suma total sera {{ weeklyTotal.toLocaleString() }} pts.
          </p>
        </div>

        <p v-if="errorMessage" class="mt-4 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
          {{ errorMessage }}
        </p>
        <p v-if="successMessage" class="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100">
          {{ successMessage }}
        </p>

        <div class="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            class="min-h-12 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 text-sm font-black uppercase text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="isSaving"
            @click="saveSettings"
          >
            {{ isSaving ? 'Guardando...' : 'Guardar recompensas' }}
          </button>
          <button
            type="button"
            class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-6 text-sm font-black uppercase text-slate-200 transition hover:bg-white/10"
            :disabled="isSaving"
            @click="resetDefaults"
          >
            Restaurar valores por defecto
          </button>
        </div>
      </template>
    </article>

    <article class="rounded-4xl border border-cyan-300/20 bg-cyan-500/8 p-5 sm:p-6">
      <p class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
        Compartir
      </p>
      <h2 class="mt-2 text-2xl font-black text-white">
        Boost x{{ shareBoost.multiplier }} por compartir
      </h2>
      <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        Si un fan comparte la votacion en redes (Facebook, WhatsApp, Telegram, X, Startly u otras),
        todos sus votos valen x{{ shareBoost.multiplier }} durante {{ shareBoost.durationMinutes }} minutos.
        Cuando se acaba ese tiempo, puede volver a activarlo compartiendo otra vez
        (salvo que tengas “1 vez al dia” activo).
      </p>

      <div v-if="!isLoading" class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label class="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
          <span class="block text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
            Activo
          </span>
          <button
            type="button"
            class="mt-3 min-h-12 w-full rounded-2xl border px-4 text-sm font-black uppercase transition"
            :class="shareBoost.enabled
              ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100'
              : 'border-white/10 bg-white/5 text-slate-300'"
            @click="shareBoost.enabled = !shareBoost.enabled"
          >
            {{ shareBoost.enabled ? 'Activado' : 'Desactivado' }}
          </button>
        </label>

        <label class="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
          <span class="block text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
            1 vez al dia
          </span>
          <button
            type="button"
            class="mt-3 min-h-12 w-full rounded-2xl border px-4 text-sm font-black uppercase transition"
            :class="shareBoost.oncePerDay
              ? 'border-amber-300/30 bg-amber-400/15 text-amber-100'
              : 'border-white/10 bg-white/5 text-slate-300'"
            @click="shareBoost.oncePerDay = !shareBoost.oncePerDay"
          >
            {{ shareBoost.oncePerDay ? 'Si, solo 1/dia' : 'Sin limite diario' }}
          </button>
          <p class="mt-2 text-[11px] leading-4 text-slate-500">
            Con “Sin limite diario”, al terminar los {{ shareBoost.durationMinutes }} min puede
            volver a activar el x{{ shareBoost.multiplier }} compartiendo otra vez.
          </p>
        </label>

        <label class="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
          <span class="block text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
            Multiplicador
          </span>
          <div class="mt-3 flex items-center gap-2">
            <span class="text-sm font-black text-slate-400">x</span>
            <input
              v-model.number="shareBoost.multiplier"
              type="number"
              min="2"
              max="10"
              class="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-lg font-black text-white outline-none transition focus:border-cyan-300/40"
            />
          </div>
        </label>

        <label class="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
          <span class="block text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
            Duracion
          </span>
          <div class="mt-3 flex items-center gap-2">
            <input
              v-model.number="shareBoost.durationMinutes"
              type="number"
              min="1"
              max="1440"
              class="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-lg font-black text-white outline-none transition focus:border-cyan-300/40"
            />
            <span class="text-xs font-black uppercase text-slate-500">min</span>
          </div>
        </label>
      </div>

      <p class="mt-4 text-sm leading-6 text-slate-400">
        Con <strong class="text-white">1 vez al dia</strong>, el fan solo puede activar el x{{ shareBoost.multiplier }}
        una vez cada 24h. El contador de arriba muestra el tiempo restante mientras esta activo.
      </p>

      <p v-if="shareBoostError" class="mt-4 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
        {{ shareBoostError }}
      </p>
      <p v-if="shareBoostSuccess" class="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100">
        {{ shareBoostSuccess }}
      </p>

      <button
        type="button"
        class="mt-5 min-h-12 rounded-2xl bg-linear-to-r from-cyan-500 to-blue-500 px-6 text-sm font-black uppercase text-white shadow-lg shadow-cyan-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="isLoading || isSavingShareBoost"
        @click="saveShareBoost"
      >
        {{ isSavingShareBoost ? 'Guardando...' : 'Guardar boost por compartir' }}
      </button>
    </article>

    <article class="rounded-4xl border border-fuchsia-300/20 bg-fuchsia-500/8 p-5 sm:p-6">
      <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
        App movil
      </p>
      <h2 class="mt-2 text-2xl font-black text-white">
        Descargar en Google Play
      </h2>
      <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        Controla la seccion de descarga en la home, el bonus de puntos al abrir la app
        por primera vez, y que pasa cuando alguien entra a la web desde Android.
      </p>

      <div v-if="!isLoading" class="mt-5 grid gap-4 lg:grid-cols-[220px_1fr]">
        <label class="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
          <span class="block text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            Mostrar seccion
          </span>
          <button
            type="button"
            class="mt-3 min-h-12 w-full rounded-2xl border px-4 text-sm font-black uppercase transition"
            :class="appDownload.enabled
              ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100'
              : 'border-white/10 bg-white/5 text-slate-300'"
            @click="appDownload.enabled = !appDownload.enabled"
          >
            {{ appDownload.enabled ? 'Visible' : 'Oculta' }}
          </button>
        </label>

        <label class="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
          <span class="block text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            URL de Google Play
          </span>
          <input
            v-model="appDownload.playStoreUrl"
            type="url"
            placeholder="https://play.google.com/store/apps/details?id=vote.musicmundial.com"
            class="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-fuchsia-300/40"
          />
          <p class="mt-2 text-xs leading-5 text-slate-500">
            Ejemplo: https://play.google.com/store/apps/details?id=vote.musicmundial.com
          </p>
        </label>
      </div>

      <div v-if="!isLoading" class="mt-4 rounded-3xl border border-white/10 bg-slate-950/45 p-4">
        <span class="block text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
          Al entrar desde Android
        </span>
        <div class="mt-3 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            class="min-h-12 rounded-2xl border px-3 text-sm font-black uppercase transition"
            :class="appDownload.androidEntryMode === 'off'
              ? 'border-slate-300/30 bg-white/10 text-white'
              : 'border-white/10 bg-white/5 text-slate-400'"
            @click="appDownload.androidEntryMode = 'off'"
          >
            No salir
          </button>
          <button
            type="button"
            class="min-h-12 rounded-2xl border px-3 text-sm font-black uppercase transition"
            :class="appDownload.androidEntryMode === 'redirect'
              ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100'
              : 'border-white/10 bg-white/5 text-slate-400'"
            @click="appDownload.androidEntryMode = 'redirect'"
          >
            Redirigir a Play
          </button>
          <button
            type="button"
            class="min-h-12 rounded-2xl border px-3 text-sm font-black uppercase transition"
            :class="appDownload.androidEntryMode === 'modal'
              ? 'border-fuchsia-300/35 bg-fuchsia-400/15 text-fuchsia-100'
              : 'border-white/10 bg-white/5 text-slate-400'"
            @click="appDownload.androidEntryMode = 'modal'"
          >
            Mostrar modal
          </button>
        </div>
        <p class="mt-2 text-xs leading-5 text-slate-500">
          Solo aplica en navegadores Android. “No salir” deja usar la web normal.
          “Redirigir” manda a Google Play al entrar. “Modal” muestra un aviso para descargar.
        </p>
      </div>

      <div v-if="!isLoading" class="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
        <label class="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
          <span class="block text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            Bonus primera vez
          </span>
          <button
            type="button"
            class="mt-3 min-h-12 w-full rounded-2xl border px-4 text-sm font-black uppercase transition"
            :class="appDownload.firstOpenRewardEnabled
              ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100'
              : 'border-white/10 bg-white/5 text-slate-300'"
            @click="appDownload.firstOpenRewardEnabled = !appDownload.firstOpenRewardEnabled"
          >
            {{ appDownload.firstOpenRewardEnabled ? 'Activo' : 'Apagado' }}
          </button>
        </label>

        <label class="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
          <span class="block text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            Puntos al entrar a la app
          </span>
          <input
            v-model.number="appDownload.firstOpenRewardPoints"
            type="number"
            min="0"
            max="10000"
            step="1"
            class="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-fuchsia-300/40"
          />
          <p class="mt-2 text-xs leading-5 text-slate-500">
            Se otorgan 1 sola vez por cuenta cuando el usuario abre la app movil e inicia sesion.
            Ejemplo: 15.
          </p>
        </label>
      </div>

      <p v-if="appDownloadError" class="mt-4 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
        {{ appDownloadError }}
      </p>
      <p v-if="appDownloadSuccess" class="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100">
        {{ appDownloadSuccess }}
      </p>

      <button
        type="button"
        class="mt-5 min-h-12 rounded-2xl bg-linear-to-r from-fuchsia-500 to-violet-500 px-6 text-sm font-black uppercase text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="isLoading || isSavingAppDownload"
        @click="saveAppDownload"
      >
        {{ isSavingAppDownload ? 'Guardando...' : 'Guardar enlace de la app' }}
      </button>
    </article>
  </section>
</template>
