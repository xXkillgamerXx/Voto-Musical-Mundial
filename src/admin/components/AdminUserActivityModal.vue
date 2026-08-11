<script setup>
import { computed, ref, watch } from 'vue'
import {
  getAdminUserActivity,
  getAdminUserActivityDays,
  getAdminUserProfile,
} from '../../services/api/adminApi'

const props = defineProps({
  userId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close'])

const profile = ref(null)
const activity = ref([])
const calendar = ref(null)
const isLoading = ref(false)
const errorMessage = ref('')
const typeFilter = ref('')

const EVENT_TYPES = [
  { value: '', label: 'Todo' },
  { value: 'vote', label: 'Votos' },
  { value: 'comment', label: 'Comentarios' },
  { value: 'daily_reward', label: 'Recompensas' },
  { value: 'mission', label: 'Misiones' },
  { value: 'referral', label: 'Referidos' },
  { value: 'follow', label: 'Seguidos' },
  { value: 'report', label: 'Denuncias' },
  { value: 'notification', label: 'Notificaciones' },
]

const EVENT_STYLES = {
  vote: { icon: 'fa-bolt', tone: 'text-amber-200 border-amber-300/25 bg-amber-400/10' },
  comment: { icon: 'fa-comment', tone: 'text-cyan-200 border-cyan-300/25 bg-cyan-400/10' },
  daily_reward: { icon: 'fa-gift', tone: 'text-emerald-200 border-emerald-300/25 bg-emerald-400/10' },
  mission: { icon: 'fa-flag-checkered', tone: 'text-violet-200 border-violet-300/25 bg-violet-400/10' },
  referral: { icon: 'fa-user-plus', tone: 'text-fuchsia-200 border-fuchsia-300/25 bg-fuchsia-400/10' },
  follow: { icon: 'fa-heart', tone: 'text-rose-200 border-rose-300/25 bg-rose-400/10' },
  report: { icon: 'fa-flag', tone: 'text-red-200 border-red-300/25 bg-red-500/10' },
  notification: { icon: 'fa-bell', tone: 'text-slate-200 border-white/10 bg-white/5' },
  signup: { icon: 'fa-star', tone: 'text-sky-200 border-sky-300/25 bg-sky-400/10' },
}

const styleFor = (type) => EVENT_STYLES[type] || EVENT_STYLES.notification

const filteredActivity = computed(() =>
  typeFilter.value ? activity.value.filter((event) => event.type === typeFilter.value) : activity.value,
)

const userName = computed(
  () =>
    profile.value?.user?.displayName ||
    profile.value?.user?.username ||
    profile.value?.user?.email ||
    'Usuario',
)

const presenceLabel = computed(() => {
  const stats = profile.value?.stats
  if (!stats) return ''
  if (stats.seenToday) return 'Activo hoy'
  if (stats.seenYesterday) return 'Activo ayer'
  if (!profile.value?.user?.lastSeenAt) return 'Sin actividad registrada'
  return `Última vez ${formatDate(profile.value.user.lastSeenAt)}`
})

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es')
}

const formatNumber = (value) => Number(value || 0).toLocaleString('es')

const calendarWeeks = computed(() => {
  const series = calendar.value?.series || []
  const weeks = []
  for (let i = 0; i < series.length; i += 7) {
    weeks.push(series.slice(i, i + 7))
  }
  return weeks
})

const cellTone = (entry) => {
  if (!entry.active) return 'bg-white/5'
  if (entry.hits >= 12) return 'bg-emerald-300'
  if (entry.hits >= 5) return 'bg-emerald-400/80'
  if (entry.hits >= 2) return 'bg-emerald-500/60'
  return 'bg-emerald-600/45'
}

const load = async (id) => {
  if (!id) return
  isLoading.value = true
  errorMessage.value = ''
  try {
    const [profileData, activityData, daysData] = await Promise.all([
      getAdminUserProfile(id),
      getAdminUserActivity(id, 150),
      getAdminUserActivityDays(id, 91),
    ])
    profile.value = profileData
    activity.value = Array.isArray(activityData?.items) ? activityData.items : []
    calendar.value = daysData
  } catch (error) {
    errorMessage.value = error?.message || 'No se pudo cargar la actividad del usuario.'
  } finally {
    isLoading.value = false
  }
}

watch(
  () => props.userId,
  (id) => {
    profile.value = null
    activity.value = []
    calendar.value = null
    typeFilter.value = ''
    if (id) load(id)
  },
  { immediate: true },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="userId"
      class="fixed inset-0 z-80 grid place-items-center bg-black/80 px-4 py-6 backdrop-blur-md"
      @click.self="emit('close')"
    >
      <article class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-4xl border border-white/10 bg-[#080a18] text-white shadow-2xl">
        <header class="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div class="min-w-0">
            <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
              Actividad del usuario
            </p>
            <h3 class="mt-1 truncate text-2xl font-black">{{ userName }}</h3>
            <p class="mt-1 text-sm font-bold text-slate-400">
              #{{ userId }}
              <span v-if="profile?.user?.email"> · {{ profile.user.email }}</span>
            </p>
          </div>
          <button
            type="button"
            class="grid size-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            @click="emit('close')"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <p v-if="isLoading" class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-300">
            Cargando actividad...
          </p>
          <p
            v-else-if="errorMessage"
            class="rounded-2xl border border-red-300/25 bg-red-500/10 p-5 text-sm font-bold text-red-100"
          >
            {{ errorMessage }}
          </p>

          <template v-else-if="profile">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-widest"
                :class="
                  profile.stats.seenToday
                    ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
                    : 'border-white/10 bg-white/5 text-slate-300'
                "
              >
                {{ presenceLabel }}
              </span>
              <span class="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-slate-300">
                Registro {{ formatDate(profile.user.createdAt) }}
              </span>
              <span
                v-if="profile.user.referredBy"
                class="rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-fuchsia-100"
              >
                Invitado por {{ profile.user.referredBy.name }}
              </span>
            </div>

            <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <div class="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Votos emitidos</p>
                <p class="mt-1 text-2xl font-black">{{ formatNumber(profile.stats.votes) }}</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Comentarios</p>
                <p class="mt-1 text-2xl font-black">{{ formatNumber(profile.stats.comments) }}</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Días activos</p>
                <p class="mt-1 text-2xl font-black">{{ formatNumber(profile.stats.activeDays) }}</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Racha diaria</p>
                <p class="mt-1 text-2xl font-black">{{ formatNumber(profile.user.dailyRewardStreak) }}</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Puntos</p>
                <p class="mt-1 text-2xl font-black">{{ formatNumber(profile.user.points) }}</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Referidos</p>
                <p class="mt-1 text-2xl font-black">{{ formatNumber(profile.stats.referrals) }}</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Misiones</p>
                <p class="mt-1 text-2xl font-black">{{ formatNumber(profile.stats.missionsCompleted) }}</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Denuncias recibidas</p>
                <p class="mt-1 text-2xl font-black">{{ formatNumber(profile.stats.reportsReceived) }}</p>
              </div>
            </div>

            <section v-if="calendar" class="mt-6 rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <h4 class="text-sm font-black uppercase tracking-widest text-slate-300">
                  Conexiones de los últimos {{ calendar.days }} días
                </h4>
                <p class="text-xs font-bold text-slate-400">
                  {{ calendar.activeDays }} días activos ({{ calendar.rate }}%) · racha actual
                  {{ calendar.currentStreak }}
                </p>
              </div>

              <div class="mt-4 flex gap-1 overflow-x-auto pb-1">
                <div
                  v-for="(week, weekIndex) in calendarWeeks"
                  :key="`week-${weekIndex}`"
                  class="grid shrink-0 gap-1"
                >
                  <span
                    v-for="entry in week"
                    :key="entry.day"
                    class="size-4 rounded-[4px]"
                    :class="cellTone(entry)"
                    :title="`${entry.day}: ${entry.active ? `${entry.hits} sesiones` : 'sin actividad'}`"
                  ></span>
                </div>
              </div>

              <p class="mt-3 text-xs font-bold text-slate-500">
                El registro de conexiones empieza a contar desde que se activó el seguimiento, así que
                los días anteriores aparecen vacíos.
              </p>
            </section>

            <section v-if="profile.devices?.length" class="mt-6">
              <h4 class="text-sm font-black uppercase tracking-widest text-slate-300">Dispositivos</h4>
              <div class="mt-3 space-y-2">
                <div
                  v-for="device in profile.devices"
                  :key="device.id"
                  class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3"
                >
                  <span class="text-sm font-black capitalize">{{ device.platform }}</span>
                  <span class="min-w-0 flex-1 truncate text-xs font-bold text-slate-500">
                    {{ device.userAgent || 'Sin user agent' }}
                  </span>
                  <span class="text-xs font-bold text-slate-400">{{ formatDate(device.updatedAt) }}</span>
                </div>
              </div>
            </section>

            <section class="mt-6">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h4 class="text-sm font-black uppercase tracking-widest text-slate-300">Historial</h4>
                <select
                  v-model="typeFilter"
                  class="min-h-10 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm font-bold text-white outline-none focus:border-fuchsia-300/50"
                >
                  <option v-for="option in EVENT_TYPES" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>

              <p
                v-if="!filteredActivity.length"
                class="mt-3 rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-400"
              >
                No hay acciones registradas para este filtro.
              </p>

              <ol class="mt-3 space-y-2">
                <li
                  v-for="event in filteredActivity"
                  :key="event.id"
                  class="flex gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3"
                >
                  <span
                    class="grid size-9 shrink-0 place-items-center rounded-xl border text-sm"
                    :class="styleFor(event.type).tone"
                  >
                    <i class="fa-solid" :class="styleFor(event.type).icon" aria-hidden="true"></i>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="flex flex-wrap items-baseline justify-between gap-2">
                      <span class="text-sm font-black text-white">{{ event.title }}</span>
                      <span class="text-[11px] font-bold text-slate-500">{{ formatDate(event.at) }}</span>
                    </span>
                    <span v-if="event.detail" class="mt-1 block truncate text-xs font-bold text-slate-400">
                      {{ event.detail }}
                    </span>
                  </span>
                  <span
                    v-if="event.points"
                    class="shrink-0 self-center text-xs font-black"
                    :class="event.points > 0 ? 'text-emerald-300' : 'text-amber-300'"
                  >
                    {{ event.points > 0 ? '+' : '' }}{{ formatNumber(event.points) }}
                  </span>
                </li>
              </ol>
            </section>
          </template>
        </div>
      </article>
    </div>
  </Teleport>
</template>
