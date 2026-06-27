<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const dbMissions = ref([])
const selectedMission = ref(null)
const referralCode = ref('')
let unsubscribeMissions = null
let unsubscribeAuth = null
let unsubscribeUserProfile = null
let isEnsuringReferralCode = false

const fallbackMissions = [
  {
    icon: '✓',
    titleKey: 'home.missions.items.voteTen.title',
    textKey: 'home.missions.items.voteTen.text',
    reward: '+40 pts',
    progress: '4/10',
    percent: 40,
    statusKey: 'common.status.inProgress',
    featured: true,
  },
  {
    icon: '♡',
    titleKey: 'home.missions.items.likePoll.title',
    textKey: 'home.missions.items.likePoll.text',
    reward: '+15 pts',
    progress: '0/1',
    percent: 0,
    statusKey: 'common.status.pending',
  },
  {
    icon: '↗',
    titleKey: 'home.missions.items.shareFandom.title',
    textKey: 'home.missions.items.shareFandom.text',
    reward: '+25 pts',
    progress: '0/1',
    percent: 0,
    statusKey: 'common.status.pending',
  },
  {
    icon: '+',
    titleKey: 'home.missions.items.followAccount.title',
    textKey: 'home.missions.items.followAccount.text',
    reward: '+30 pts',
    progress: '1/1',
    percent: 100,
    statusKey: 'common.status.ready',
    done: true,
  },
]

const isFontAwesomeIcon = (icon) => String(icon || '').startsWith('fa-')

const missions = computed(() => {
  if (!dbMissions.value.length) {
    return fallbackMissions
  }

  return dbMissions.value
    .filter((mission) => mission.active !== false)
    .slice(0, 8)
    .map((mission) => {
      const target = Math.max(1, Number(mission.target || 1))

      return {
        id: mission.id,
        icon: mission.icon || 'fa-solid fa-check',
        title: mission.title || 'Mision',
        text: mission.description || '',
        type: mission.type || 'manual',
        actionUrl: mission.actionUrl || mission.url || '',
        reward: `+${Number(mission.rewardPoints || 0)} pts`,
        progress: `0/${target}`,
        percent: 0,
        statusKey: 'common.status.pending',
        featured: Boolean(mission.featured),
        done: false,
      }
    })
})

const missionTitle = (mission) => mission?.title || (mission?.titleKey ? '' : 'Mision')
const missionText = (mission) => mission?.text || ''
const openMissionModal = (mission) => {
  selectedMission.value = mission
}
const closeMissionModal = () => {
  selectedMission.value = null
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
const missionValidationText = (mission) => {
  if (!mission) {
    return ''
  }

  if (mission.type?.startsWith('referral_')) {
    return referralCode.value
      ? 'Comparte tu enlace. Cuando alguien se registre con ese codigo quedara afiliado a tu cuenta y se sumaran los puntos.'
      : 'Inicia sesion para generar y compartir tu codigo afiliado.'
  }

  if (mission.type?.startsWith('share_')) {
    return 'Se abrira la app para compartir. Las misiones de amigos usan el enlace de referido.'
  }

  if (mission.actionUrl) {
    return 'Se abrira el enlace configurado. Para confirmar esta mision puede requerirse revision manual o conexion con la red social.'
  }

  return 'Esta mision necesita validacion manual o una automatizacion adicional para confirmar que fue completada.'
}
const performMissionAction = (mission) => {
  if (!mission) {
    return
  }

  if (mission.type?.startsWith('referral_')) {
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

onMounted(() => {
  unsubscribeMissions = onSnapshot(
    query(collection(db, 'missions'), orderBy('order', 'asc')),
    (missionsSnap) => {
      dbMissions.value = missionsSnap.docs.map((missionDoc) => ({
        id: missionDoc.id,
        ...missionDoc.data(),
      }))
    },
    () => {
      dbMissions.value = []
    },
  )
  unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    unsubscribeUserProfile?.()
    referralCode.value = ''

    if (!user || user.isAnonymous) {
      return
    }

    unsubscribeUserProfile = onSnapshot(doc(db, 'users', user.uid), (userSnap) => {
      const userData = userSnap.data() || {}
      const code = String(userData.referralCode || userData.username || '').trim().toLowerCase()
      referralCode.value = code

      if (!userData.referralCode && code && !isEnsuringReferralCode) {
        isEnsuringReferralCode = true
        Promise.all([
          setDoc(doc(db, 'referralCodes', code), {
            uid: user.uid,
            username: userData.username || code,
            code,
            createdAt: serverTimestamp(),
          }, { merge: true }),
          updateDoc(doc(db, 'users', user.uid), {
            referralCode: code,
            referralCodeUpdatedAt: serverTimestamp(),
          }),
        ]).finally(() => {
          isEnsuringReferralCode = false
        })
      }
    })
  })
})

onUnmounted(() => {
  unsubscribeMissions?.()
  unsubscribeUserProfile?.()
  unsubscribeAuth?.()
})
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-6 sm:px-6 lg:py-8">
    <div class="mb-5 flex items-center justify-between gap-4">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
          {{ $t('home.missions.eyebrow') }}
        </p>
        <h2 class="mt-2 text-2xl font-black uppercase tracking-tight sm:text-3xl">
          {{ $t('home.missions.title') }}
        </h2>
      </div>

      <span class="rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm font-black text-amber-100">
        {{ $t('common.points', { count: '2,450' }) }}
      </span>
    </div>

    <div class="missions-slider -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
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
          v-if="selectedMission.type?.startsWith('referral_') && referralCode"
          class="mt-3 break-all rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold leading-5 text-slate-300"
        >
          {{ referralUrl() }}
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

        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            class="min-h-12 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01]"
            @click="performMissionAction(selectedMission)"
          >
            Hacer mision
          </button>
          <button
            type="button"
            class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
            @click="closeMissionModal"
          >
            Cerrar
          </button>
        </div>
      </article>
    </div>
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
