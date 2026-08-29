<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { translate } from '../i18n'
import { getMe, getCurrentApiAuth } from '../services/api/authApi'
import { getStoredAuth, onStoredAuthChange, setStoredAuth } from '../services/api/client'
import {
  completeMission,
  createMissionVisitToken,
  getMissions,
  reportMissionReferralShare,
  reportMissionShareAction,
  reportMissionVisitProgress,
} from '../services/api/missionsApi'

const MISSION_VISIT_TYPES = new Set([
  'visit_page',
  'follow_social',
  'like_social_post',
  'comment_social_post',
])

const PASSIVE_MISSION_TYPES = new Set([
  'referral_signup',
  'referral_signup_milestone',
  'referral_first_vote',
  'daily_streak',
  'daily_login',
  'daily_open',
  'daily_view_polls',
  'daily_poll',
  'vote_count',
  'follow_artist',
  'complete_profile',
])

const { locale } = useI18n()
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

const stripHtml = (value) =>
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

const loadMissions = () => {
  getMissions()
    .then((missionRows) => {
      dbMissions.value = Array.isArray(missionRows) ? missionRows : []
    })
    .catch(() => {
      dbMissions.value = []
    })
}
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
        title: stripHtml(mission.title || 'Mision'),
        text: stripHtml(mission.description || ''),
        type: mission.type || 'manual',
        actionUrl: mission.actionUrl || mission.url || '',
        visitMode: mission.visitMode === 'host' ? 'host' : 'exact',
        visitUrls: Array.isArray(mission.visitUrls) ? mission.visitUrls : [],
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
const referralUrl = () => {
  const url = new URL('/registro', window.location.origin)

  if (referralCode.value) {
    url.searchParams.set('ref', referralCode.value)
  }

  return url.toString()
}
const encodedReferralUrl = () => encodeURIComponent(referralUrl())
const isReferralMission = (mission) => mission?.type?.startsWith('referral_')
const isVisitMission = (mission) => MISSION_VISIT_TYPES.has(mission?.type)
const isPassiveMission = (mission) => PASSIVE_MISSION_TYPES.has(mission?.type)
const isShareMission = (mission) =>
  mission?.type?.startsWith('share_') || mission?.type === 'share_poll'

const sharePlatformForMission = (mission) => {
  if (mission?.type === 'share_whatsapp') return 'whatsapp'
  if (mission?.type === 'share_facebook') return 'facebook'
  if (mission?.type === 'share_twitter') return 'twitter'
  if (mission?.type === 'share_instagram_story') return 'instagram'
  return 'more'
}

const missionHasAction = (mission) => {
  if (!mission || mission.done || isPassiveMission(mission)) {
    return false
  }

  if (isReferralMission(mission)) {
    return Boolean(referralCode.value)
  }

  if (isVisitMission(mission)) {
    return Boolean(mission.actionUrl || mission.visitUrls?.length)
  }

  if (isShareMission(mission)) {
    return true
  }

  if (mission.type === 'manual' || mission.type === 'favorite_poll') {
    return true
  }

  return Boolean(mission.actionUrl)
}
const missionActionLabel = (mission) => {
  if (isPassiveMission(mission)) {
    return 'Se valida automaticamente'
  }

  if (isReferralMission(mission)) {
    return 'Compartir invitacion'
  }

  if (mission?.type === 'follow_social') {
    return 'Ir a la red social'
  }

  if (mission?.type === 'visit_page') {
    return translate('home.missions.openPage')
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
      ? translate('home.missions.validation.referralReady')
      : translate('home.missions.validation.referralLogin')
  }

  if (mission.type?.startsWith('share_')) {
    return translate('home.missions.validation.share')
  }

  if (mission.type === 'follow_social') {
    return translate('home.missions.validation.followSocial')
  }

  if (mission.type === 'visit_page') {
    if (mission.visitMode === 'host') {
      return translate('home.missions.validation.visitPageHost')
    }
    if (Number(mission.target || 1) > 1 || (mission.visitUrls || []).length > 1) {
      return translate('home.missions.validation.visitPageExact')
    }
    return translate('home.missions.validation.visitPage')
  }

  if (mission.actionUrl) {
    return translate('home.missions.validation.actionUrl')
  }

  return translate('home.missions.validation.manual')
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

const syncMissionFromServer = async (mission, wasDone) => {
  const rows = await getMissions()
  dbMissions.value = Array.isArray(rows) ? rows : []
  const updated = dbMissions.value.find((item) => String(item.id) === String(mission.id))
  if (!updated) {
    return { done: false, awarded: false }
  }

  const target = Math.max(1, Number(updated.target || mission.target || 1))
  const current = Math.min(target, Number(updated.progress || 0))
  const done = Boolean(
    updated.rewardedAt
    || updated.completedAt
    || current >= target,
  )

  mission.progress = `${current}/${target}`
  mission.percent = Math.round((current / target) * 100)
  mission.done = done
  if (done) {
    mission.statusKey = 'common.status.completed'
  }

  if (selectedMission.value && String(selectedMission.value.id) === String(mission.id)) {
    selectedMission.value.progress = mission.progress
    selectedMission.value.percent = mission.percent
    selectedMission.value.done = done
  }

  if (done && !wasDone) {
    markMissionCompletedLocally(mission)
    try {
      const me = await getMe()
      applyUpdatedPoints(me?.points)
      userProfile.value = me || userProfile.value
    } catch {
      // ignore profile refresh errors
    }
    selectedMission.value = null
    openMissionReward(mission)
  }

  return { done, awarded: done && !wasDone, progress: current }
}

const performMissionAction = async (mission) => {
  if (!mission || missionActionInProgress.value) {
    return
  }

  if (isReferralMission(mission)) {
    const wasDone = mission.done
    const url = referralUrl()
    const text = encodeURIComponent('Unete a Music Mundial VOTING con mi codigo de invitacion')

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Music Mundial VOTING',
          text: 'Unete a Music Mundial VOTING con mi codigo de invitacion',
          url,
        })
      } catch {
        // Usuario cancelo el share.
      }
    } else {
      window.open(`https://wa.me/?text=${text}%20${encodedReferralUrl()}`, '_blank', 'noopener,noreferrer')
    }

    try {
      missionActionInProgress.value = true
      actionMessage.value = translate('home.missions.socialOpened')
      const results = await reportMissionReferralShare()
      const match = Array.isArray(results)
        ? results.find((row) => String(row.missionId) === String(mission.id))
        : null
      if (match?.pointsAfter != null) {
        applyUpdatedPoints(match.pointsAfter)
      }
      await syncMissionFromServer(mission, wasDone)
    } catch {
      actionMessage.value = translate('home.missions.registerError')
    } finally {
      missionActionInProgress.value = false
    }

    return
  }

  if (isVisitMission(mission)) {
    const wasDone = mission.done
    const target = Math.max(1, Number(mission.target || 1))
    const firstUrl = String(mission.actionUrl || mission.visitUrls?.[0] || '').trim()

    try {
      missionActionInProgress.value = true
      actionMessage.value = translate('home.missions.visitOpening')

      let isSameOrigin = false
      try {
        isSameOrigin = Boolean(firstUrl) && new URL(firstUrl).origin === window.location.origin
      } catch {
        isSameOrigin = false
      }

      if (isSameOrigin) {
        const targetUrl = new URL(firstUrl)
        const nextPath = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
        const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`

        if (nextPath !== currentPath) {
          window.history.pushState({}, '', nextPath)
          window.dispatchEvent(new PopStateEvent('popstate'))
        } else {
          await reportMissionVisitProgress(window.location.href.split('#')[0])
        }

        actionMessage.value = mission.visitMode === 'host' || target > 1
          ? translate('home.missions.visitWaitingHost')
          : translate('home.missions.visitWaiting')
      } else {
        const visit = await createMissionVisitToken(mission.id)
        window.open(visit.url || firstUrl, '_blank', 'noopener,noreferrer')

        // External pages are credited when the visit token is created.
        if (
          visit?.awarded
          || Number(visit?.progress || 0) >= target
        ) {
          markMissionCompletedLocally(mission)
          applyUpdatedPoints(visit?.pointsAfter)
          try {
            const me = await getMe()
            applyUpdatedPoints(me?.points)
            userProfile.value = me || userProfile.value
          } catch {
            // ignore
          }
          selectedMission.value = null
          if (!wasDone) {
            openMissionReward(mission)
          }
          return
        }

        actionMessage.value = mission.visitMode === 'host' || target > 1
          ? translate('home.missions.visitWaitingHost')
          : translate('home.missions.visitWaiting')
      }

      let completed = false
      for (let attempt = 0; attempt < 24; attempt += 1) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 1500)
        })

        if (isSameOrigin) {
          await reportMissionVisitProgress(window.location.href.split('#')[0]).catch(() => {})
        }

        const rows = await getMissions()
        dbMissions.value = Array.isArray(rows) ? rows : []
        const updated = dbMissions.value.find((item) => String(item.id) === String(mission.id))
        const current = Math.min(target, Number(updated?.progress || 0))
        const done = Boolean(
          updated?.rewardedAt
          || updated?.completedAt
          || current >= Number(updated?.target || target),
        )

        mission.progress = `${current}/${target}`
        mission.percent = Math.round((current / target) * 100)
        if (selectedMission.value && String(selectedMission.value.id) === String(mission.id)) {
          selectedMission.value.progress = mission.progress
          selectedMission.value.percent = mission.percent
        }

        if (current > 0 && !done) {
          actionMessage.value = translate('home.missions.visitProgress', {
            current,
            target,
          })
        }

        if (done) {
          markMissionCompletedLocally(mission)
          try {
            const me = await getMe()
            applyUpdatedPoints(me?.points)
            userProfile.value = me || userProfile.value
          } catch {
            // ignore profile refresh errors
          }
          selectedMission.value = null
          completed = true

          if (!wasDone) {
            openMissionReward(mission)
          }
          break
        }
      }

      if (!completed) {
        actionMessage.value = translate('home.missions.visitPending')
      }
    } catch {
      actionMessage.value = translate('home.missions.registerError')
    } finally {
      missionActionInProgress.value = false
      missionActionCountdown.value = 0
    }

    return
  }

  if (isShareMission(mission)) {
    const wasDone = mission.done

    try {
      missionActionInProgress.value = true
      actionMessage.value = translate('home.missions.socialOpened')
      await shareMissionLink(mission)
      const results = await reportMissionShareAction(sharePlatformForMission(mission))
      const match = Array.isArray(results)
        ? results.find((row) => String(row.missionId) === String(mission.id))
        : null
      if (match?.pointsAfter != null) {
        applyUpdatedPoints(match.pointsAfter)
      }
      await syncMissionFromServer(mission, wasDone)
      if (!match?.awarded && !mission.done) {
        actionMessage.value = translate('home.missions.visitPending')
      }
    } catch {
      actionMessage.value = translate('home.missions.registerError')
    } finally {
      missionActionInProgress.value = false
    }

    return
  }

  if (mission.type === 'manual' || mission.type === 'favorite_poll') {
    await claimHonorMission(mission, {
      countdownSeconds: 2,
      waitingMessage: translate('home.missions.validation.manual'),
    })
    return
  }

  if (mission.actionUrl) {
    window.open(mission.actionUrl, '_blank', 'noopener,noreferrer')
    return
  }

  if (navigator.share) {
    try {
      await navigator.share({
        title: missionTitle(mission),
        text: missionText(mission),
        url: window.location.origin,
      })
    } catch {
      // Usuario cancelo el share.
    }
  }
}

const shareMissionLink = async (mission) => {
  const url = window.location.origin
  const title = missionTitle(mission)
  const text = `${title} - Music Mundial VOTING`

  if (mission.type === 'share_whatsapp') {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
      '_blank',
      'noopener,noreferrer',
    )
    return
  }

  if (mission.type === 'share_facebook') {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer',
    )
    return
  }

  if (mission.type === 'share_twitter') {
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer',
    )
    return
  }

  if (navigator.share) {
    await navigator.share({ title, text, url }).catch(() => {})
    return
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
  } catch {
    // ignore
  }
}

const claimHonorMission = async (mission, { countdownSeconds = 3, waitingMessage = '' } = {}) => {
  if (!mission || mission.done) {
    return
  }

  const wasDone = mission.done

  try {
    missionActionInProgress.value = true
    missionActionCountdown.value = countdownSeconds
    actionMessage.value = waitingMessage

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
    actionMessage.value = translate('home.missions.registerError')
  } finally {
    missionActionInProgress.value = false
    missionActionCountdown.value = 0
  }
}

const syncReferralCode = (authState = getCurrentApiAuth()) => {
  referralCode.value = ''
  userProfile.value = null

  const user = authState?.user
  if (!user || user.isAnonymous) {
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

const applyVisitProgressUpdates = (updates = []) => {
  if (!Array.isArray(updates) || !updates.length) {
    return
  }

  for (const update of updates) {
    const sourceMission = dbMissions.value.find((item) => String(item.id) === String(update.missionId))
    if (!sourceMission) {
      continue
    }

    const target = Math.max(1, Number(update.target || sourceMission.target || 1))
    const progress = Math.min(target, Number(update.progress || 0))
    sourceMission.progress = progress

    if (update.awarded) {
      sourceMission.completedAt = sourceMission.completedAt || new Date().toISOString()
      sourceMission.rewardedAt = sourceMission.rewardedAt || new Date().toISOString()
    }

    if (selectedMission.value && String(selectedMission.value.id) === String(update.missionId)) {
      selectedMission.value.progress = `${progress}/${target}`
      selectedMission.value.percent = Math.round((progress / target) * 100)
      if (progress > 0 && progress < target) {
        actionMessage.value = translate('home.missions.visitProgress', {
          current: progress,
          target,
        })
      }
    }
  }
}

const onVisitProgressEvent = (event) => {
  applyVisitProgressUpdates(event?.detail?.updates)
  loadMissions()
}

onMounted(() => {
  loadMissions()

  syncReferralCode()
  unsubscribeAuth = onStoredAuthChange(syncReferralCode)
  window.addEventListener('vmm:mission-visit-progress', onVisitProgressEvent)
  window.addEventListener('vmm:missions-refresh', loadMissions)
})

watch(locale, () => {
  loadMissions()
})

onUnmounted(() => {
  unsubscribeMissions?.()
  unsubscribeAuth?.()
  window.removeEventListener('vmm:mission-visit-progress', onVisitProgressEvent)
  window.removeEventListener('vmm:missions-refresh', loadMissions)
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
      class="flex flex-col gap-3"
    >
      <button
        v-for="mission in missions"
        :key="mission.id || mission.titleKey"
        type="button"
        class="mission-mini group rounded-2xl border-2 p-3.5 text-left shadow-[0_10px_28px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        :class="[
          mission.featured && !mission.done && 'border-amber-300/45 bg-[#1a150c] shadow-amber-950/30 hover:border-amber-200/65',
          mission.done && 'border-emerald-300/45 bg-[#0b2a22] shadow-emerald-950/30 hover:border-emerald-200/65',
          !mission.featured && !mission.done && 'border-cyan-300/35 bg-[#12141f] shadow-cyan-950/25 hover:border-cyan-200/55',
          selectedMission?.id === mission.id && 'ring-2 ring-cyan-300/50',
        ]"
        @click="openMissionModal(mission)"
      >
        <div class="flex items-start gap-3">
          <span
            class="grid size-12 shrink-0 place-items-center rounded-2xl border text-lg"
            :class="mission.done
              ? 'border-emerald-300/35 bg-emerald-400/15 text-emerald-200'
              : mission.featured
                ? 'border-amber-200/35 bg-amber-300/10 text-amber-100'
                : 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100'"
          >
            <i
              v-if="mission.done"
              class="fa-solid fa-check"
              aria-hidden="true"
            ></i>
            <i
              v-else-if="isFontAwesomeIcon(mission.icon)"
              :class="mission.icon"
              aria-hidden="true"
            ></i>
            <span v-else class="text-xs font-black">{{ mission.icon }}</span>
          </span>

          <div class="min-w-0 flex-1">
            <div class="flex items-start gap-2">
              <h3 class="min-w-0 flex-1 text-[15px] font-extrabold leading-snug text-white">
                {{ mission.title || $t(mission.titleKey) }}
              </h3>
              <span
                class="shrink-0 rounded-lg border px-2 py-1 text-xs font-black tabular-nums"
                :class="mission.done
                  ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200'
                  : mission.featured
                    ? 'border-amber-200/30 bg-amber-300/15 text-amber-100'
                    : 'border-cyan-300/30 bg-cyan-400/15 text-cyan-100'"
              >
                {{ mission.reward }}
              </span>
            </div>
            <p
              v-if="mission.text || mission.textKey"
              class="mt-1 truncate text-xs font-semibold text-slate-400"
            >
              {{ mission.text || $t(mission.textKey) }}
            </p>
          </div>
        </div>

        <div class="mt-3 flex items-center gap-2.5">
          <div class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              class="h-full rounded-full"
              :class="mission.done
                ? 'bg-emerald-400'
                : mission.featured
                  ? 'bg-amber-300'
                  : 'bg-cyan-400'"
              :style="{ width: `${mission.percent}%` }"
            ></div>
          </div>
          <span class="shrink-0 text-xs font-extrabold tabular-nums text-slate-300">
            {{ mission.progress }}
          </span>
          <i
            class="text-sm"
            :class="mission.done
              ? 'fa-solid fa-circle-check text-emerald-400'
              : 'fa-solid fa-chevron-right text-white/40'"
            aria-hidden="true"
          ></i>
        </div>
      </button>
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
      @click.self="closeMissionModal"
    >
      <article class="relative w-full max-w-lg overflow-hidden rounded-2xl border border-amber-200/25 bg-[#120f0a] p-0 shadow-2xl shadow-black/50">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(251,191,36,0.16),transparent_36%),radial-gradient(circle_at_90%_100%,rgba(34,211,238,0.1),transparent_40%),linear-gradient(180deg,rgba(28,22,14,0.95),rgba(12,14,26,0.98))]"></div>
        <div class="absolute inset-y-0 left-0 w-1.5 bg-linear-to-b from-amber-200 via-amber-400 to-cyan-400" aria-hidden="true"></div>

        <div class="relative p-5 pl-6 sm:p-6 sm:pl-7">
          <div class="flex items-start justify-between gap-4">
            <div class="flex min-w-0 items-start gap-3">
              <span
                class="grid size-12 shrink-0 place-items-center rounded-xl border border-amber-200/25 bg-amber-300/10 text-xl font-black text-amber-100"
              >
                <i
                  v-if="isFontAwesomeIcon(selectedMission.icon)"
                  :class="selectedMission.icon"
                  aria-hidden="true"
                ></i>
                <span v-else>{{ selectedMission.icon }}</span>
              </span>
              <div class="min-w-0">
                <p class="text-[10px] font-black uppercase tracking-[0.28em] text-amber-200/90">
                  {{ $t('home.missions.detailEyebrow') }}
                </p>
                <h3 class="mt-1 text-xl font-black uppercase leading-tight text-white sm:text-2xl">
                  {{ selectedMission.title || $t(selectedMission.titleKey) }}
                </h3>
              </div>
            </div>
            <button
              type="button"
              class="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
              aria-label="Cerrar"
              @click="closeMissionModal"
            >
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>

          <div class="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
            <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              {{ $t('home.missions.objective') }}
            </p>
            <p class="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300">
              {{ selectedMission.text || $t(selectedMission.textKey) }}
            </p>
          </div>

          <p class="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-xs font-bold leading-5 text-cyan-100">
            {{ missionValidationText(selectedMission) }}
          </p>
          <p
            v-if="isReferralMission(selectedMission) && referralCode"
            class="mt-3 break-all rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold leading-5 text-slate-300"
          >
            {{ referralUrl() }}
          </p>
          <p
            v-if="actionMessage"
            class="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-xs font-bold leading-5 text-emerald-100"
          >
            {{ actionMessage }}
          </p>

          <div class="mt-4 rounded-xl border border-amber-200/15 bg-amber-300/5 p-4">
            <div class="flex items-end justify-between gap-3">
              <div>
                <p class="text-xs font-bold uppercase tracking-widest text-slate-500">{{ $t('common.labels.progress') }}</p>
                <p class="mt-1 text-sm font-black text-white">{{ selectedMission.progress }}</p>
              </div>
              <p class="text-2xl font-black text-amber-100">{{ selectedMission.reward }}</p>
            </div>
            <div class="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                class="h-full rounded-full bg-linear-to-r from-amber-300 via-cyan-400 to-fuchsia-500"
                :style="{ width: `${selectedMission.percent}%` }"
              ></div>
            </div>
          </div>

          <div class="mt-5 grid gap-3">
            <button
              type="button"
              class="min-h-12 w-full rounded-xl bg-linear-to-r from-amber-400 via-fuchsia-500 to-violet-500 px-5 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-amber-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
              :disabled="missionActionInProgress || selectedMission.done || !missionHasAction(selectedMission)"
              @click="performMissionAction(selectedMission)"
            >
              {{
                selectedMission.done
                  ? $t('common.status.completed')
                  : missionActionInProgress
                    ? 'Validando...'
                    : missionActionLabel(selectedMission)
              }}
            </button>
            <div class="grid gap-3" :class="isReferralMission(selectedMission) && referralCode ? 'sm:grid-cols-2' : ''">
              <button
                v-if="isReferralMission(selectedMission) && referralCode"
                type="button"
                class="min-h-12 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-5 text-sm font-black uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-400/20"
                @click="copyReferralUrl"
              >
                Copiar link
              </button>
              <button
                type="button"
                class="min-h-12 rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
                @click="closeMissionModal"
              >
                Cerrar
              </button>
            </div>
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
.mission-mini {
  background-image:
    linear-gradient(135deg, rgba(255, 255, 255, 0.03), transparent 40%),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 11px,
      rgba(255, 255, 255, 0.015) 11px,
      rgba(255, 255, 255, 0.015) 12px
    );
}
</style>
