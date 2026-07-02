<script setup>
import { computed, onMounted, ref } from 'vue'
import { getAdminDailyRewards, updateAdminDailyRewards } from '../../services/api/adminApi'

const DEFAULT_DAYS = [
  { day: 1, points: 5 },
  { day: 2, points: 10 },
  { day: 3, points: 15 },
  { day: 4, points: 20 },
  { day: 5, points: 25 },
  { day: 6, points: 30 },
  { day: 7, points: 50 },
]

const days = ref(DEFAULT_DAYS.map((entry) => ({ ...entry })))
const isLoading = ref(true)
const isSaving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const weeklyTotal = computed(() =>
  days.value.reduce((total, entry) => total + Number(entry.points || 0), 0),
)

const loadSettings = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const payload = await getAdminDailyRewards()
    days.value = (payload?.days || DEFAULT_DAYS).map((entry) => ({
      day: Number(entry.day),
      points: Number(entry.points || 0),
    }))
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

onMounted(loadSettings)
</script>

<template>
  <section class="space-y-6">
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
  </section>
</template>
