<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getMe, getCurrentApiAuth } from '../services/api/authApi'
import { getStoredAuth, onStoredAuthChange, setStoredAuth } from '../services/api/client'
import { completeMission, getMissions } from '../services/api/missionsApi'

const dbMissions = ref([])
const selectedMission = ref(null)
const referralCode = ref('')
const userProfile = ref(null)
const actionMessage = ref('')
const completedMissionReward = ref(null)
const missionActionInProgress = ref(false)
const missionActionCountdown = ref(0)
let unsubscribeMissions = null
let unsubscribeAuth = null
let missionActionTimer = null

const isFontAwesomeIcon = (icon) => String(icon || '').startsWith('fa-')

const missions = computed(() => {
  return dbMissions.value
    .filter((mission) => mission.active !== false)
    .slice(0, 8)
    .map((mission) => {
      const target = Math.max(1, Number(mission.target || 1))
      const savedProgress = Number(mission.progress || 0)
      const currentProgress = mission.type === 'daily_streak'
        ? Math.max(savedProgress, Math.min(target, Number(userProfile.value?.dailyRewardStreak || 0)))
        : Math.min(target, savedProgress)
      const done = Boolean(mission.completedAt || mission.rewardedAt || currentProgress >= target)

      return {
        id: mission.id,
        icon: mission.icon || 'fa-solid fa-check',
        title: mission.title || 'Mision',
        text: mission.description || '',
        type: mission.type || 'manual',
        actionUrl: mission.actionUrl || mission.url || '',
        reward: `+${Number(mission.rewardPoints || 0)} pts`,
        rewardPoints: Number(mission.rewardPoints || 0),
        target,
        progress: `${currentProgress}/${target}`,
        percent: Math.round((currentProgress / target) * 100),
        statusKey: done ? 'common.status.completed' : 'common.status.pending',
        featured: Boolean(mission.featured),
        done,
      }
    })
})

const missionTitle = (mission) => mission?.title || (mission?.titleKey ? '' : 'Mision')
const missionText = (mission) => mission?.text || ''
const openMissionModal = (mission) => {
  actionMessage.value = ''
  missionActionInProgress.value = false
  missionActionCountdown.value = 0
  selectedMission.value = mission
}
const closeMissionModal = () => {
  actionMessage.value = ''
  window.clearInterval(missionActionTimer)
  missionActionInProgress.value = false
  missionActionCountdown.value = 0
  selectedMission.value = null
}
const closeMissionReward = () => {
  completedMissionReward.value = null
}
const shareTextForMission = (mission) =>
  encodeURIComponent(`${missionTitle(mission)} - Votos Mundial`)
const shareUrl = () => encodeURIComponent(window.location.origin)
const referralUrl = () => {
  const url = new URL('/registro', window.location.origin)

  if (referralCode.value) {
    url.searchParams.set('ref', referralCode.value)
  }

  return url.toString()
}
const encodedReferralUrl = () => encodeURIComponent(referralUrl())
const isReferralMission = (mission) => mission?.type?.startsWith('referral_')
const missionActionLabel = (mission) => {
  if (isReferralMission(mission)) {
    return 'Compartir invitacion'
  }

  if (mission?.type === 'follow_social') {
    return 'Ir a la red social'
  }

  if (mission?.type?.startsWith('share_')) {
    return 'Compartir'
  }

  return 'Hacer mision'
}
const copyReferralUrl = async () => {
  if (!referralCode.value) {
    return
  }

  const url = referralUrl()

  try {
    await navigator.clipboard.writeText(url)
  } catch {
    const input = document.createElement('input')
    input.value = url
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
  }
}
const missionValidationText = (mission) => {
  if (!mission) {
    return ''
  }

  if (isReferralMission(mission)) {
    return referralCode.value
      ? 'Comparte tu enlace. Cuando alguien se registre con ese codigo quedara afiliado a tu cuenta y se sumaran los puntos.'
      : 'Inicia sesion para generar y compartir tu codigo afiliado.'
  }

  if (mission.type?.startsWith('share_')) {
    return 'Se abrira la app para compartir. Las misiones de amigos usan el enlace de referido.'
  }

  if (mission.type === 'follow_social') {
    return 'Abre la red social configurada. Al tocar el boton se registrara esta accion y se entregaran los puntos si aun no la completaste.'
  }

  if (mission.actionUrl) {
    return 'Se abrira el enlace configurado. Para confirmar esta mision puede requerirse revision manual o conexion con la red social.'
  }

  return 'Esta mision necesita validacion manual o una automatizacion adicional para confirmar que fue completada.'
}
const markMissionCompletedLocally = (mission) => {
  if (!mission) {
    return
  }

  const target = Math.max(1, Number(mission.target || 1))
  mission.progress = `${target}/${target}`
  mission.percent = 100
  mission.done = true
  mission.statusKey = 'common.status.completed'

  const sourceMission = dbMissions.value.find((item) => String(item.id) === String(mission.id))
  if (sourceMission) {
    sourceMission.progress = target
    sourceMission.completedAt = sourceMission.completedAt || new Date().toISOString()
    sourceMission.rewardedAt = sourceMission.rewardedAt || new Date().toISOString()
  }
}

const openMissionReward = (mission) => {
  completedMissionReward.value = {
    title: missionTitle(mission),
    text: missionText(mission),
    reward: mission.reward,
    icon: mission.icon || 'fa-solid fa-gift',
  }
}

const applyUpdatedPoints = (pointsAfter) => {
  const nextPoints = Number(pointsAfter)

  if (!Number.isFinite(nextPoints)) {
    return
  }

  const auth = getStoredAuth()
  if (auth?.user && !auth.user.isAnonymous) {
    setStoredAuth({
      ...auth,
      user: {
        ...auth.user,
        points: nextPoints,
      },
    })
  }
}

const performMissionAction = async (mission) => {
  if (!mission || missionActionInProgress.value) {
    return
  }

  if (isReferralMission(mission)) {
    const url = referralUrl()
    const text = encodeURIComponent('Unete a Votos Mundial con mi codigo de invitacion')

    if (navigator.share) {
      navigator.share({
        title: 'Votos Mundial',
        text: 'Unete a Votos Mundial con mi codigo de invitacion',
        url,
      }).catch(() => {})
      return
    }

    window.open(`https://wa.me/?text=${text}%20${encodedReferralUrl()}`, '_blank', 'noopener,noreferrer')
    return
  }

  if (mission.actionUrl) {
    window.open(mission.actionUrl, '_blank', 'noopener,noreferrer')

    if (mission.type === 'follow_social') {
      const wasDone = mission.done

      try {
        missionActionInProgress.value = true
        missionActionCountdown.value = 10
        actionMessage.value = 'Se abrio la red social. Estamos verificando la mision para registrar tus puntos.'

        await new Promise((resolve) => {
          missionActionTimer = window.setInterval(() => {
            missionActionCountdown.value = Math.max(0, missionActionCountdown.value - 1)

            if (missionActionCountdown.value <= 0) {
              window.clearInterval(missionActionTimer)
              missionActionTimer = null
              resolve()
            }
          }, 1000)
        })

        const response = await completeMission(mission.id)
        markMissionCompletedLocally(mission)
        applyUpdatedPoints(response?.pointsAfter)
        selectedMission.value = null

        if (!wasDone && response?.awarded !== false) {
          openMissionReward(mission)
        }
      } catch {
        actionMessage.value = 'No se pudo registrar la mision. Inicia sesion e intenta otra vez.'
      } finally {
        missionActionInProgress.value = false
        missionActionCountdown.value = 0
      }
    }

    return
  }

  if (mission.type === 'share_whatsapp') {
    window.open(`https://wa.me/?text=${shareTextForMission(mission)}%20${shareUrl()}`, '_blank', 'noopener,noreferrer')
    return
  }

  if (mission.type === 'share_facebook') {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl()}`, '_blank', 'noopener,noreferrer')
    return
  }

  if (mission.type === 'share_twitter') {
    window.open(`https://twitter.com/intent/tweet?text=${shareTextForMission(mission)}&url=${shareUrl()}`, '_blank', 'noopener,noreferrer')
    return
  }

  if (navigator.share) {
    navigator.share({
      title: missionTitle(mission),
      text: missionText(mission),
      url: window.location.origin,
    }).catch(() => {})
  }
}

const syncReferralCode = (authState = getCurrentApiAuth()) => {
  referralCode.value = ''
  userProfile.value = null

  const user = authState?.user
  if (!user) {
    return
  }

  referralCode.value = String(user.referralCode || user.username || user.displayName || user.email?.split('@')[0] || '')
    .trim()
    .toLowerCase()

  getMe()
    .then((userData) => {
      if (userData) {
        userProfile.value = userData
        referralCode.value = String(userData.referralCode || userData.username || referralCode.value || '')
          .trim()
          .toLowerCase()
      }
    })
    .catch(() => {})
}

onMounted(() => {
  getMissions()
    .then((missionRows) => {
      dbMissions.value = missionRows
    })
    .catch(() => {
      dbMissions.value = []
    })

  syncReferralCode()
  unsubscribeAuth = onStoredAuthChange(syncReferralCode)
})

onUnmounted(() => {
  unsubscribeMissions?.()
  unsubscribeAuth?.()
  window.clearInterval(missionActionTimer)
})
</script>

<template>
  <section id="misiones" class="mx-auto max-w-352 scroll-mt-28 px-4 py-6 sm:px-6 lg:py-8">
    <div class="mb-5 flex items-center justify-between gap-4">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
          {{ $t('home.missions.eyebrow') }}
        </p>
        <h2 class="mt-2 text-2xl font-black uppercase tracking-tight sm:text-3xl">
          {{ $t('home.missions.title') }}
        </h2>
      </div>
    </div>

    <div
      v-if="missions.length"
      class="missions-slider -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0"
    >
      <article
        v-for="mission in missions"
        :key="mission.id || mission.titleKey"
        class="relative min-w-[86%] snap-center overflow-hidden rounded-3xl border p-5 shadow-xl shadow-violet-950/25 sm:min-w-[48%] lg:min-w-0"
        :class="[
          mission.featured && 'border-fuchsia-300/35 bg-fuchsia-500/10',
          mission.done && 'border-emerald-300/35 bg-emerald-500/10',
          !mission.featured && !mission.done && 'border-violet-300/10 bg-[#090b19]/85',
        ]"
      >
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(217,70,239,0.18),transparent_32%)]"></div>

        <div class="relative">
          <div class="flex items-start justify-between gap-4">
            <span
              class="grid size-12 place-items-center rounded-2xl border text-xl font-black"
              :class="mission.done ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200' : 'border-white/10 bg-white/5 text-fuchsia-200'"
            >
              <i
                v-if="isFontAwesomeIcon(mission.icon)"
                :class="mission.icon"
                aria-hidden="true"
              ></i>
              <span v-else>{{ mission.icon }}</span>
            </span>

            <span
              class="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide"
              :class="mission.done ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/5 text-slate-300'"
            >
              {{ $t(mission.statusKey) }}
            </span>
          </div>

          <h3 class="mt-5 text-lg font-black uppercase leading-tight">
            {{ mission.title || $t(mission.titleKey) }}
          </h3>
          <p class="mt-2 text-sm leading-6 text-slate-400">
            {{ mission.text || $t(mission.textKey) }}
          </p>

          <div class="mt-5 flex items-end justify-between gap-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-widest text-slate-500">{{ $t('common.labels.progress') }}</p>
              <p class="mt-1 text-sm font-black text-white">{{ mission.progress }}</p>
            </div>
            <p class="text-xl font-black text-fuchsia-200">{{ mission.reward }}</p>
          </div>

          <div class="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              class="h-full rounded-full bg-linear-to-r from-cyan-400 to-fuchsia-500"
              :style="{ width: `${mission.percent}%` }"
            ></div>
          </div>

          <button
            type="button"
            class="mt-5 min-h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-black uppercase text-slate-100 transition hover:bg-white/10"
            @click="openMissionModal(mission)"
          >
            {{ mission.done ? $t('common.status.completed') : $t('home.missions.doMission') }}
          </button>
        </div>
      </article>
    </div>

    <div
      v-else
      class="relative overflow-hidden rounded-4xl border border-cyan-300/15 bg-[#090b19]/90 p-8 text-center shadow-2xl shadow-cyan-950/15"
    >
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_85%_70%,rgba(217,70,239,0.14),transparent_30%)]"></div>
      <div class="relative mx-auto grid size-16 place-items-center rounded-3xl border border-cyan-200/20 bg-cyan-300/10 text-2xl text-cyan-200 shadow-lg shadow-cyan-950/20">
        <i class="fa-solid fa-bolt" aria-hidden="true"></i>
      </div>
      <h3 class="relative mt-5 text-xl font-black uppercase text-white">
        Nuevas misiones pronto
      </h3>
      <p class="relative mx-auto mt-2 max-w-xl text-sm font-bold leading-6 text-slate-400">
        Estamos preparando retos para que puedas ganar puntos extra. Vuelve mas tarde para encontrar nuevas actividades.
      </p>
    </div>

    <div
      v-if="selectedMission"
      class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
    >
      <article class="w-full max-w-lg overflow-hidden rounded-3xl border border-fuchsia-300/25 bg-[#090b19] p-5 shadow-2xl shadow-fuchsia-950/40">
        <div class="flex items-start justify-between gap-4">
          <span
            class="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-xl font-black text-fuchsia-200"
          >
            <i
              v-if="isFontAwesomeIcon(selectedMission.icon)"
              :class="selectedMission.icon"
              aria-hidden="true"
            ></i>
            <span v-else>{{ selectedMission.icon }}</span>
          </span>
          <button
            type="button"
            class="grid size-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
            aria-label="Cerrar"
            @click="closeMissionModal"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <p class="mt-5 text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
          Gana puntos extra
        </p>
        <h3 class="mt-2 text-2xl font-black uppercase leading-tight text-white">
          {{ selectedMission.title || $t(selectedMission.titleKey) }}
        </h3>
        <p class="mt-3 text-sm leading-6 text-slate-400">
          {{ selectedMission.text || $t(selectedMission.textKey) }}
        </p>
        <p class="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-xs font-bold leading-5 text-cyan-100">
          {{ missionValidationText(selectedMission) }}
        </p>
        <p
          v-if="isReferralMission(selectedMission) && referralCode"
          class="mt-3 break-all rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold leading-5 text-slate-300"
        >
          {{ referralUrl() }}
        </p>
        <p
          v-if="actionMessage"
          class="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-xs font-bold leading-5 text-emerald-100"
        >
          {{ actionMessage }}
        </p>

        <div class="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div class="flex items-end justify-between gap-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-widest text-slate-500">{{ $t('common.labels.progress') }}</p>
              <p class="mt-1 text-sm font-black text-white">{{ selectedMission.progress }}</p>
            </div>
            <p class="text-2xl font-black text-fuchsia-200">{{ selectedMission.reward }}</p>
          </div>
          <div class="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              class="h-full rounded-full bg-linear-to-r from-cyan-400 to-fuchsia-500"
              :style="{ width: `${selectedMission.percent}%` }"
            ></div>
          </div>
        </div>

        <div class="mt-5 grid gap-3">
          <button
            type="button"
            class="min-h-12 w-full rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
            :disabled="missionActionInProgress"
            @click="performMissionAction(selectedMission)"
          >
            {{ missionActionInProgress ? 'Validando...' : missionActionLabel(selectedMission) }}
          </button>
          <div class="grid gap-3" :class="isReferralMission(selectedMission) && referralCode ? 'sm:grid-cols-2' : ''">
            <button
              v-if="isReferralMission(selectedMission) && referralCode"
              type="button"
              class="min-h-12 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-5 text-sm font-black uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-400/20"
              @click="copyReferralUrl"
            >
              Copiar link
            </button>
            <button
              type="button"
              class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
              @click="closeMissionModal"
            >
              Cerrar
            </button>
          </div>
        </div>
      </article>
    </div>

    <Teleport to="body">
      <div
        v-if="completedMissionReward"
        class="fixed inset-0 z-90 grid place-items-center bg-black/80 px-4 py-6 text-white backdrop-blur-md"
        @click.self="closeMissionReward"
      >
        <article class="relative w-full max-w-xl overflow-hidden rounded-4xl border border-amber-200/30 bg-[#090b19] p-6 text-center shadow-2xl shadow-fuchsia-950/50 sm:p-8">
          <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(251,191,36,0.28),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(217,70,239,0.24),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(35,10,50,0.96))]"></div>
          <div class="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-amber-300/20 blur-3xl"></div>
          <div class="pointer-events-none absolute -bottom-24 right-0 size-80 rounded-full bg-fuchsia-400/20 blur-3xl"></div>

          <button
            type="button"
            class="absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-lg font-black text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Cerrar recompensa"
            @click="closeMissionReward"
          >
            ×
          </button>

          <div class="relative z-10">
            <div class="mx-auto grid size-24 place-items-center rounded-4xl border border-amber-200/45 bg-linear-to-br from-amber-200 via-fuchsia-300 to-violet-500 text-5xl shadow-[0_0_80px_rgba(244,114,182,0.5)]">
              <i
                v-if="isFontAwesomeIcon(completedMissionReward.icon)"
                :class="completedMissionReward.icon"
                aria-hidden="true"
              ></i>
              <span v-else>{{ completedMissionReward.icon }}</span>
            </div>

            <p class="mt-6 text-xs font-black uppercase tracking-[0.32em] text-amber-200">
              Mision completada
            </p>
            <h3 class="mt-3 text-3xl font-black uppercase leading-tight text-white">
              {{ completedMissionReward.title }}
            </h3>
            <p class="mx-auto mt-3 max-w-md text-sm font-bold leading-6 text-slate-300">
              {{ completedMissionReward.text || 'Completaste la mision y recibiste tu recompensa.' }}
            </p>

            <div class="mx-auto mt-6 max-w-xs rounded-3xl border border-amber-200/25 bg-amber-300/10 px-5 py-4">
              <p class="text-xs font-black uppercase tracking-widest text-amber-100">Recompensa</p>
              <p class="mt-1 text-4xl font-black text-amber-100">{{ completedMissionReward.reward }}</p>
            </div>

            <button
              type="button"
              class="mt-7 min-h-12 w-full rounded-2xl bg-linear-to-r from-amber-300 via-fuchsia-400 to-violet-500 px-5 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01] sm:w-auto sm:min-w-56"
              @click="closeMissionReward"
            >
              Genial
            </button>
          </div>
        </article>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.missions-slider {
  scrollbar-width: none;
}

.missions-slider::-webkit-scrollbar {
  display: none;
}
</style>
