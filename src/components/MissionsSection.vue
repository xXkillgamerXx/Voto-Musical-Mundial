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
import { routePath } from '../utils/localizedRoutes'

const props = defineProps({
  variant: {
    type: String,
    default: 'section',
    validator: (value) => ['section', 'page'].includes(value),
  },
})

const isPage = computed(() => props.variant === 'page')

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

const SOCIAL_MISSION_TYPES = new Set([
  'follow_social',
  'like_social_post',
  'comment_social_post',
  'share_poll',
  'share_whatsapp',
  'share_facebook',
  'share_twitter',
  'share_instagram_story',
  'referral_signup',
  'referral_signup_milestone',
  'referral_first_vote',
])

const READING_MISSION_TYPES = new Set([
  'visit_page',
])

const { locale, t } = useI18n()
const dbMissions = ref([])
const selectedMission = ref(null)
const missionFilter = ref('all')
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

const resolveMissionVisual = (mission) => {
  const type = String(mission?.type || '')
  const title = String(mission?.title || '').toLowerCase()
  const url = String(mission?.actionUrl || mission?.url || '').toLowerCase()
  const haystack = `${title} ${url}`

  if (haystack.includes('facebook')) {
    return { icon: 'fa-brands fa-facebook-f', tone: 'facebook' }
  }
  if (haystack.includes('instagram')) {
    return { icon: 'fa-brands fa-instagram', tone: 'instagram' }
  }
  if (haystack.includes('tiktok')) {
    return { icon: 'fa-brands fa-tiktok', tone: 'tiktok' }
  }
  if (haystack.includes('whatsapp')) {
    return { icon: 'fa-brands fa-whatsapp', tone: 'whatsapp' }
  }
  if (haystack.includes('twitter') || haystack.includes('x.com') || /\bx\b/.test(title)) {
    return { icon: 'fa-brands fa-x-twitter', tone: 'twitter' }
  }
  if (haystack.includes('google') || haystack.includes('news.google')) {
    return { icon: 'fa-brands fa-google', tone: 'google' }
  }
  if (type === 'visit_page' || haystack.includes('leer') || haystack.includes('nota') || haystack.includes('article')) {
    return { icon: 'fa-solid fa-newspaper', tone: 'reading' }
  }
  if (type.includes('vote') || type === 'daily_poll' || type === 'favorite_poll' || haystack.includes('vot')) {
    return { icon: 'fa-solid fa-check-to-slot', tone: 'vote' }
  }
  if (type.startsWith('referral') || type.startsWith('share')) {
    return { icon: 'fa-solid fa-share-nodes', tone: 'share' }
  }
  if (isFontAwesomeIcon(mission?.icon)) {
    return { icon: mission.icon, tone: 'default' }
  }
  return { icon: 'fa-solid fa-bolt', tone: 'default' }
}

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
    .map((mission) => {
      const target = Math.max(1, Number(mission.target || 1))
      const savedProgress = Number(mission.progress || 0)
      const currentProgress = mission.type === 'daily_streak'
        ? Math.max(savedProgress, Math.min(target, Number(userProfile.value?.dailyRewardStreak || 0)))
        : Math.min(target, savedProgress)
      const done = Boolean(mission.completedAt || mission.rewardedAt || currentProgress >= target)
      const type = mission.type || 'manual'
      const title = stripHtml(mission.title || 'Mision')
      const actionUrl = mission.actionUrl || mission.url || ''
      const visual = resolveMissionVisual({
        type,
        title,
        actionUrl,
        url: actionUrl,
        icon: mission.icon,
      })

      return {
        id: mission.id,
        icon: visual.icon,
        tone: visual.tone,
        title,
        text: stripHtml(mission.description || ''),
        type,
        actionUrl,
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
        category: SOCIAL_MISSION_TYPES.has(type)
          ? 'social'
          : READING_MISSION_TYPES.has(type)
            ? 'reading'
            : 'other',
      }
    })
})

const missionStats = computed(() => {
  const total = missions.value.length
  const completed = missions.value.filter((mission) => mission.done).length
  const pending = Math.max(0, total - completed)
  const totalPoints = missions.value
    .filter((mission) => mission.done)
    .reduce((sum, mission) => sum + Number(mission.rewardPoints || 0), 0)
  const availablePoints = missions.value
    .filter((mission) => !mission.done)
    .reduce((sum, mission) => sum + Number(mission.rewardPoints || 0), 0)
  const auth = getStoredAuth()
  const balance = Number(
    userProfile.value?.points
    ?? auth?.user?.points
    ?? 0,
  )
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return {
    total,
    completed,
    pending,
    totalPoints,
    availablePoints,
    balance: Number.isFinite(balance) ? balance : 0,
    percent,
    completedLabel: `${completed}/${total}`,
  }
})

const missionsPageHref = computed(() => routePath('missions', locale.value))
const showLoginHint = computed(() => {
  const auth = getStoredAuth()
  return !auth?.accessToken || !auth?.user || Boolean(auth.user.isAnonymous)
})

const HOME_MISSION_LIMIT = 4

const filteredMissions = computed(() => {
  const filter = missionFilter.value

  if (filter === 'completed') {
    return missions.value.filter((mission) => mission.done)
  }

  if (filter === 'social') {
    return missions.value.filter((mission) => mission.category === 'social')
  }

  if (filter === 'reading') {
    return missions.value.filter((mission) => mission.category === 'reading')
  }

  return missions.value
})

/** Home preview: up to 4 incomplete missions; completed ones leave and the next pending fills in. */
const displayedMissions = computed(() => {
  if (isPage.value) {
    return filteredMissions.value
  }

  const pending = missions.value.filter((mission) => !mission.done)
  if (pending.length) {
    return pending.slice(0, HOME_MISSION_LIMIT)
  }

  return missions.value.slice(0, HOME_MISSION_LIMIT)
})

const hasMoreMissions = computed(() => {
  if (isPage.value) {
    return false
  }

  const pending = missions.value.filter((mission) => !mission.done).length
  return missions.value.length > HOME_MISSION_LIMIT || pending > HOME_MISSION_LIMIT
})

const missionFilters = computed(() => ([
  { id: 'all', label: t('home.missions.filters.all') },
  { id: 'social', label: t('home.missions.filters.social') },
  { id: 'reading', label: t('home.missions.filters.reading') },
  { id: 'completed', label: t('home.missions.filters.completed') },
]))

const missionTitle = (mission) => mission?.title || (mission?.titleKey ? '' : 'Mision')
const missionText = (mission) => mission?.text || ''
const isLoggedIn = () => {
  const auth = getStoredAuth()
  return Boolean(auth?.accessToken && auth?.user && !auth.user.isAnonymous)
}
const requestLoginForMissions = () => {
  window.dispatchEvent(new CustomEvent('vmm:open-auth', { detail: { reason: 'missions' } }))
}
const openMissionModal = (mission) => {
  if (!isLoggedIn()) {
    requestLoginForMissions()
    return
  }

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
const missionCardCtaLabel = (mission) => {
  if (mission?.done) {
    return t('home.missions.cta.done')
  }

  const tone = mission?.tone || resolveMissionVisual(mission).tone
  if (
    mission?.type === 'follow_social'
    || mission?.type === 'like_social_post'
    || ['facebook', 'instagram', 'tiktok', 'google', 'twitter', 'whatsapp'].includes(tone)
  ) {
    return t('home.missions.cta.follow')
  }

  if (mission?.type === 'visit_page' || tone === 'reading') {
    return t('home.missions.cta.read')
  }

  if (
    mission?.type === 'vote_count'
    || mission?.type === 'daily_poll'
    || mission?.type === 'favorite_poll'
    || tone === 'vote'
  ) {
    return t('home.missions.cta.vote')
  }

  if (isShareMission(mission) || isReferralMission(mission) || tone === 'share') {
    return t('home.missions.cta.share')
  }

  if (mission?.actionUrl) {
    return t('home.missions.cta.open')
  }

  return t('home.missions.doMission')
}

const missionActionLabel = (mission) => {
  if (isPassiveMission(mission)) {
    return 'Se valida automaticamente'
  }

  if (isReferralMission(mission)) {
    return t('home.missions.cta.share')
  }

  if (mission?.type === 'follow_social') {
    return t('home.missions.cta.follow')
  }

  if (mission?.type === 'visit_page') {
    return t('home.missions.cta.read')
  }

  if (mission?.type?.startsWith('share_')) {
    return t('home.missions.cta.share')
  }

  return t('home.missions.doMission')
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

      // Same origin (www.musicmundial.com) is NOT the same app: Vote lives under /vote/,
      // news under /. Never pushState into news paths from Vote — that skips the visit token.
      let isSameSpa = false
      try {
        if (firstUrl) {
          const targetUrl = new URL(firstUrl)
          const sameOrigin = targetUrl.origin === window.location.origin
          const voteBase = String(import.meta.env.BASE_URL || '/vote/').replace(/\/$/, '') || '/vote'
          const pathIsVote = (pathname) => {
            const path = String(pathname || '/')
            return path === voteBase || path.startsWith(`${voteBase}/`)
          }
          isSameSpa = sameOrigin && pathIsVote(targetUrl.pathname) && pathIsVote(window.location.pathname)
        }
      } catch {
        isSameSpa = false
      }

      if (isSameSpa) {
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

        // External pages (Instagram, etc.) are credited when the visit token is created.
        // Music Mundial credits when mission-visit reports from the news tab.
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

        if (isSameSpa) {
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
  <section
    id="misiones"
    class="missions-surface mx-auto max-w-352 scroll-mt-28 px-4 py-6 sm:px-6"
    :class="isPage ? 'lg:py-10' : 'lg:py-8'"
  >
    <div
      v-if="isPage"
      class="mission-page-hero relative mb-6 overflow-hidden rounded-4xl border border-violet-300/20 p-5 shadow-2xl shadow-fuchsia-950/30 sm:p-7"
    >
      <div class="pointer-events-none absolute inset-0 bg-linear-to-br from-fuchsia-950/50 via-[#0a0d1a] to-cyan-950/40"></div>
      <div class="pointer-events-none absolute -left-16 -top-20 size-72 rounded-full bg-amber-300/15 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-24 right-0 size-80 rounded-full bg-fuchsia-500/20 blur-3xl"></div>

      <div class="relative grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-end">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            {{ $t('home.missions.page.eyebrow') }}
          </p>
          <h1 class="mt-2 text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
            {{ $t('home.missions.page.title') }}
          </h1>
          <p class="mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-300 sm:text-base">
            {{ $t('home.missions.page.subtitle') }}
          </p>
          <p
            v-if="showLoginHint"
            class="mt-3 text-xs font-bold text-amber-200/90"
          >
            {{ $t('home.missions.page.loginHint') }}
          </p>
        </div>

        <div class="rounded-3xl border border-white/10 bg-black/25 p-4 backdrop-blur-sm">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                {{ $t('home.missions.stats.progress') }}
              </p>
              <p class="mt-1 text-3xl font-black tabular-nums text-white">{{ missionStats.percent }}%</p>
            </div>
            <div
              class="mission-ring grid size-20 place-items-center rounded-full"
              :style="{ '--mission-progress': `${missionStats.percent}%` }"
              aria-hidden="true"
            >
              <span class="grid size-14 place-items-center rounded-full bg-[#0b0f1d] text-sm font-black text-fuchsia-100">
                {{ missionStats.completedLabel }}
              </span>
            </div>
          </div>
          <div class="mt-4 h-3.5 overflow-hidden rounded-full border border-white/10 bg-white/10">
            <div
              class="h-full rounded-full bg-linear-to-r from-amber-300 via-fuchsia-400 to-violet-500 transition-[width] duration-500"
              :style="{ width: `${missionStats.percent}%` }"
            ></div>
          </div>
        </div>
      </div>

      <div class="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3">
          <p class="text-[10px] font-black uppercase tracking-wide text-amber-100/70">{{ $t('home.missions.stats.balance') }}</p>
          <p class="mt-1 text-2xl font-black tabular-nums text-amber-100">{{ missionStats.balance }} pts</p>
        </div>
        <div class="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-400/10 px-4 py-3">
          <p class="text-[10px] font-black uppercase tracking-wide text-fuchsia-100/70">{{ $t('home.missions.stats.totalPoints') }}</p>
          <p class="mt-1 text-2xl font-black tabular-nums text-fuchsia-100">{{ missionStats.totalPoints }} pts</p>
        </div>
        <div class="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3">
          <p class="text-[10px] font-black uppercase tracking-wide text-emerald-100/70">{{ $t('home.missions.stats.completed') }}</p>
          <p class="mt-1 text-2xl font-black tabular-nums text-emerald-100">{{ missionStats.completed }}</p>
        </div>
        <div class="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3">
          <p class="text-[10px] font-black uppercase tracking-wide text-cyan-100/70">{{ $t('home.missions.stats.available') }}</p>
          <p class="mt-1 text-2xl font-black tabular-nums text-cyan-100">+{{ missionStats.availablePoints }}</p>
        </div>
      </div>
    </div>

    <div
      v-else
      class="mb-5 flex flex-col gap-4 lg:mb-6 lg:flex-row lg:items-end lg:justify-between"
    >
      <div class="min-w-0 max-w-2xl">
        <p class="missions-eyebrow text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
          {{ $t('home.missions.eyebrow') }}
        </p>
        <h2 class="mt-2 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
          {{ $t('home.missions.title') }}
        </h2>
        <p class="mt-2 text-sm font-semibold leading-6 text-slate-400 sm:text-base">
          {{ $t('home.missions.subtitle') }}
        </p>
      </div>

      <div
        v-if="missions.length"
        class="mission-stats grid shrink-0 grid-cols-2 gap-3 sm:min-w-80"
      >
        <div class="mission-stat mission-stat--points relative overflow-hidden rounded-2xl border border-amber-300/25 bg-[#15110a]/95 px-3.5 py-3 shadow-lg shadow-amber-950/20">
          <div class="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-amber-300/20 blur-2xl"></div>
          <div class="relative flex items-center gap-2.5">
            <span class="grid size-9 place-items-center rounded-xl border border-amber-200/30 bg-amber-300/15 text-amber-200">
              <i class="fa-solid fa-coins" aria-hidden="true"></i>
            </span>
            <div>
              <p class="text-lg font-black tabular-nums text-amber-100">{{ missionStats.totalPoints }} pts</p>
              <p class="text-[10px] font-bold uppercase tracking-wide text-amber-100/65">
                {{ $t('home.missions.stats.totalPoints') }}
              </p>
            </div>
          </div>
        </div>
        <div class="mission-stat mission-stat--done relative overflow-hidden rounded-2xl border border-fuchsia-300/20 bg-[#120b1a]/95 px-3.5 py-3 shadow-lg shadow-fuchsia-950/20">
          <div class="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-fuchsia-400/20 blur-2xl"></div>
          <div class="relative flex items-center gap-2.5">
            <span class="grid size-9 place-items-center rounded-xl border border-fuchsia-200/30 bg-fuchsia-400/15 text-fuchsia-100">
              <i class="fa-solid fa-trophy" aria-hidden="true"></i>
            </span>
            <div>
              <p class="text-lg font-black tabular-nums text-fuchsia-100">{{ missionStats.completedLabel }}</p>
              <p class="text-[10px] font-bold uppercase tracking-wide text-fuchsia-100/65">
                {{ $t('home.missions.stats.completed') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="isPage && missions.length"
      class="mb-5 flex flex-wrap gap-2"
      role="tablist"
      aria-label="Filtros de misiones"
    >
      <button
        v-for="filter in missionFilters"
        :key="filter.id"
        type="button"
        role="tab"
        class="mission-filter rounded-full border px-3.5 py-1.5 text-xs font-black uppercase tracking-wide transition"
        :class="missionFilter === filter.id
          ? 'mission-filter--on border-fuchsia-300/45 bg-linear-to-r from-amber-400/20 via-fuchsia-500/20 to-violet-500/20 text-white shadow-[0_0_24px_rgba(217,70,239,0.18)]'
          : 'border-white/10 bg-white/5 text-slate-400 hover:border-fuchsia-300/25 hover:text-white'"
        :aria-selected="missionFilter === filter.id"
        @click="missionFilter = filter.id"
      >
        {{ filter.label }}
      </button>
    </div>

    <div
      v-if="displayedMissions.length"
      class="grid items-stretch gap-4 sm:grid-cols-2"
      :class="isPage && 'xl:grid-cols-3'"
    >
      <article
        v-for="(mission, index) in displayedMissions"
        :key="mission.id || mission.titleKey"
        class="mission-card group relative flex h-full flex-col overflow-hidden rounded-4xl border p-5 shadow-2xl transition duration-300 hover:-translate-y-1"
        :class="[
          mission.done && 'mission-card--done border-emerald-300/30',
          mission.featured && !mission.done && 'mission-card--featured border-amber-300/35',
          !mission.featured && !mission.done && 'border-violet-300/15',
          selectedMission?.id === mission.id && 'ring-2 ring-fuchsia-300/45',
        ]"
        :style="{ animationDelay: `${Math.min(index, 6) * 70}ms` }"
      >
        <div class="pointer-events-none absolute inset-0 opacity-90" :class="`mission-card__wash mission-card__wash--${mission.tone}`"></div>
        <div class="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-fuchsia-400/15 blur-3xl transition duration-500 group-hover:bg-fuchsia-400/25"></div>
        <div class="pointer-events-none absolute -bottom-20 left-8 size-48 rounded-full bg-cyan-400/10 blur-3xl transition duration-500 group-hover:bg-amber-300/15"></div>

        <div class="relative flex items-start justify-between gap-3">
          <span
            class="mission-card__icon grid size-14 shrink-0 place-items-center rounded-3xl border text-xl shadow-xl shadow-black/25 backdrop-blur transition duration-300 group-hover:scale-105"
            :class="mission.done
              ? 'border-emerald-300/35 bg-emerald-400/15 text-emerald-200'
              : `mission-card__icon--${mission.tone}`"
          >
            <i
              v-if="mission.done"
              class="fa-solid fa-check"
              aria-hidden="true"
            ></i>
            <i
              v-else
              :class="mission.icon"
              aria-hidden="true"
            ></i>
          </span>

          <span
            class="mission-card__reward shrink-0 rounded-full border px-3 py-1 text-xs font-black tabular-nums shadow-lg"
            :class="mission.done
              ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200'
              : 'border-amber-200/35 bg-amber-300/15 text-amber-100'"
          >
            {{ mission.reward }}
          </span>
        </div>

        <h3 class="relative mt-4 min-h-12 text-[15px] font-black leading-snug text-white sm:text-base">
          {{ mission.title || $t(mission.titleKey) }}
        </h3>

        <div class="relative mt-auto pt-5">
          <div class="mb-3.5 flex items-center gap-2.5">
            <div class="mission-card__track h-3.5 min-w-0 flex-1 overflow-hidden rounded-full border border-white/10 bg-white/10">
              <div
                class="mission-card__bar h-full rounded-full"
                :class="mission.done
                  ? 'bg-emerald-400'
                  : 'bg-linear-to-r from-amber-300 via-fuchsia-400 to-violet-500'"
                :style="{ width: `${Math.max(mission.percent, mission.percent > 0 ? 8 : 0)}%` }"
              ></div>
            </div>
            <span class="shrink-0 text-xs font-extrabold tabular-nums text-slate-300">
              {{ mission.progress }}
            </span>
          </div>

          <button
            type="button"
            class="mission-card__cta flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black uppercase tracking-wide transition duration-300"
            :class="mission.done
              ? 'cursor-default border border-emerald-300/30 bg-emerald-400/10 text-emerald-200'
              : 'bg-linear-to-r from-amber-300 via-fuchsia-400 to-violet-500 text-slate-950 shadow-lg shadow-fuchsia-950/30 hover:scale-[1.02] hover:brightness-110'"
            :disabled="mission.done"
            @click="openMissionModal(mission)"
          >
            <span>{{ missionCardCtaLabel(mission) }}</span>
            <i
              v-if="!mission.done"
              class="fa-solid fa-arrow-right text-xs transition group-hover:translate-x-0.5"
              aria-hidden="true"
            ></i>
          </button>
        </div>
      </article>
    </div>

    <div
      v-if="!isPage && displayedMissions.length"
      class="mt-4 flex justify-center"
    >
      <a
        :href="missionsPageHref"
        class="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/10 px-6 text-sm font-black uppercase tracking-wide text-fuchsia-100 transition hover:border-fuchsia-300/50 hover:bg-fuchsia-400/20 hover:text-white"
      >
        {{ hasMoreMissions ? $t('home.missions.viewMore') : $t('home.missions.viewAll') }}
        <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
      </a>
    </div>

    <div
      v-if="isPage && missions.length && !displayedMissions.length"
      class="rounded-4xl border border-white/10 bg-[#12141f]/80 px-5 py-8 text-center"
    >
      <p class="text-sm font-bold text-slate-400">
        {{ $t('home.missions.filters.empty') }}
      </p>
    </div>

    <div
      v-if="!missions.length"
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
      v-if="missions.length"
      class="mission-howto relative mt-5 overflow-hidden rounded-4xl border border-violet-300/15 bg-[#080a18]/90 px-4 py-5 shadow-2xl shadow-violet-950/20 sm:px-5"
    >
      <div class="pointer-events-none absolute inset-0 bg-linear-to-r from-fuchsia-950/30 via-transparent to-cyan-950/20"></div>
      <p class="relative mb-4 text-[10px] font-black uppercase tracking-[0.24em] text-fuchsia-200/80">
        {{ $t('home.missions.howItWorks.title') }}
      </p>
      <div class="relative grid gap-4 sm:grid-cols-3 sm:gap-3">
        <div class="mission-howto__step flex items-start gap-3 rounded-2xl border border-white/8 bg-black/20 p-3 transition hover:border-fuchsia-300/25 hover:bg-white/5">
          <span class="grid size-11 shrink-0 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
            <i class="fa-solid fa-hand-pointer" aria-hidden="true"></i>
          </span>
          <div class="min-w-0">
            <p class="text-sm font-extrabold text-white">{{ $t('home.missions.howItWorks.step1Title') }}</p>
            <p class="mt-0.5 text-xs font-semibold text-slate-400">{{ $t('home.missions.howItWorks.step1Text') }}</p>
          </div>
        </div>
        <div class="mission-howto__step flex items-start gap-3 rounded-2xl border border-white/8 bg-black/20 p-3 transition hover:border-fuchsia-300/25 hover:bg-white/5">
          <span class="grid size-11 shrink-0 place-items-center rounded-2xl border border-violet-300/25 bg-violet-400/10 text-violet-200">
            <i class="fa-solid fa-bolt" aria-hidden="true"></i>
          </span>
          <div class="min-w-0">
            <p class="text-sm font-extrabold text-white">{{ $t('home.missions.howItWorks.step2Title') }}</p>
            <p class="mt-0.5 text-xs font-semibold text-slate-400">{{ $t('home.missions.howItWorks.step2Text') }}</p>
          </div>
        </div>
        <div class="mission-howto__step flex items-start gap-3 rounded-2xl border border-white/8 bg-black/20 p-3 transition hover:border-amber-300/25 hover:bg-white/5">
          <span class="grid size-11 shrink-0 place-items-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-amber-100">
            <i class="fa-solid fa-coins" aria-hidden="true"></i>
          </span>
          <div class="min-w-0">
            <p class="text-sm font-extrabold text-white">{{ $t('home.missions.howItWorks.step3Title') }}</p>
            <p class="mt-0.5 text-xs font-semibold text-slate-400">{{ $t('home.missions.howItWorks.step3Text') }}</p>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="selectedMission"
        class="fixed inset-0 z-80 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
        @click.self="closeMissionModal"
      >
        <article
          class="mission-detail-sheet relative flex max-h-[min(92vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-cyan-300/25 shadow-2xl shadow-cyan-950/40"
          role="dialog"
          aria-modal="true"
          :aria-label="selectedMission.title || $t('home.missions.detailEyebrow')"
        >
          <div class="mission-detail-sheet__glow pointer-events-none absolute inset-0" aria-hidden="true"></div>
          <div class="mission-detail-sheet__accent absolute inset-y-0 left-0 w-1.5" aria-hidden="true"></div>

          <div class="relative flex min-h-0 flex-1 flex-col">
            <div class="flex items-start justify-between gap-4 border-b border-white/8 px-5 pb-4 pt-5 pl-6 sm:px-6 sm:pl-7">
              <div class="flex min-w-0 items-start gap-3">
                <span class="mission-detail-sheet__icon grid size-12 shrink-0 place-items-center rounded-xl text-xl font-black">
                  <i
                    v-if="isFontAwesomeIcon(selectedMission.icon)"
                    :class="selectedMission.icon"
                    aria-hidden="true"
                  ></i>
                  <span v-else>{{ selectedMission.icon }}</span>
                </span>
                <div class="min-w-0">
                  <p class="mission-detail-sheet__eyebrow text-[10px] font-black uppercase tracking-[0.28em]">
                    {{ $t('home.missions.detailEyebrow') }}
                  </p>
                  <h3 class="mission-detail-sheet__title mt-1 text-xl font-black uppercase leading-tight sm:text-2xl">
                    {{ selectedMission.title || $t(selectedMission.titleKey) }}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                class="mission-detail-sheet__ghost grid size-10 shrink-0 place-items-center rounded-xl transition"
                aria-label="Cerrar"
                @click="closeMissionModal"
              >
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4 pl-6 sm:px-6 sm:pl-7">
              <div class="mission-detail-sheet__panel rounded-xl p-4">
                <p class="mission-detail-sheet__label text-[10px] font-black uppercase tracking-[0.22em]">
                  {{ $t('home.missions.objective') }}
                </p>
                <p class="mission-detail-sheet__body mt-2 whitespace-pre-line text-sm leading-6">
                  {{ selectedMission.text || $t(selectedMission.textKey) }}
                </p>
              </div>

              <p class="mission-detail-sheet__hint mt-3 rounded-xl px-4 py-3 text-xs font-bold leading-5">
                {{ missionValidationText(selectedMission) }}
              </p>
              <p
                v-if="isReferralMission(selectedMission) && referralCode"
                class="mission-detail-sheet__panel mt-3 break-all rounded-xl px-4 py-3 text-xs font-bold leading-5"
              >
                {{ referralUrl() }}
              </p>
              <p
                v-if="actionMessage"
                class="mission-detail-sheet__success mt-3 rounded-xl px-4 py-3 text-xs font-bold leading-5"
              >
                {{ actionMessage }}
              </p>

              <div class="mission-detail-sheet__panel mt-4 rounded-xl p-4">
                <div class="flex items-end justify-between gap-3">
                  <div>
                    <p class="mission-detail-sheet__label text-xs font-bold uppercase tracking-widest">{{ $t('common.labels.progress') }}</p>
                    <p class="mission-detail-sheet__title mt-1 text-sm font-black">{{ selectedMission.progress }}</p>
                  </div>
                  <p class="mission-detail-sheet__reward text-2xl font-black">{{ selectedMission.reward }}</p>
                </div>
                <div class="mission-detail-sheet__track mt-4 h-3.5 overflow-hidden rounded-full border border-white/10">
                  <div
                    class="h-full rounded-full bg-linear-to-r from-amber-300 via-fuchsia-400 to-violet-500 shadow-[0_0_16px_rgba(232,121,249,0.45)]"
                    :style="{ width: `${selectedMission.percent}%` }"
                  ></div>
                </div>
              </div>
            </div>

            <div class="shrink-0 border-t border-white/8 px-5 py-4 pl-6 sm:px-6 sm:pl-7">
              <div class="grid gap-3">
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
                    class="mission-detail-sheet__hint min-h-12 rounded-xl px-5 text-sm font-black uppercase tracking-wide transition"
                    @click="copyReferralUrl"
                  >
                    Copiar link
                  </button>
                  <button
                    type="button"
                    class="mission-detail-sheet__ghost min-h-12 rounded-xl px-5 text-sm font-black uppercase tracking-wide transition"
                    @click="closeMissionModal"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </Teleport>

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
.mission-page-hero {
  animation: mission-fade-up 0.5s ease both;
}

.mission-ring {
  background:
    radial-gradient(closest-side, #0b0f1d 78%, transparent 80% 100%),
    conic-gradient(from 180deg, #fbbf24, #e879f9, #8b5cf6 var(--mission-progress, 0%), rgba(255, 255, 255, 0.08) 0);
}

.missions-eyebrow {
  animation: mission-fade-up 0.45s ease both;
}

.mission-stat {
  animation: mission-fade-up 0.5s ease both;
}

.mission-stat--points {
  animation-delay: 60ms;
}

.mission-stat--done {
  animation-delay: 120ms;
}

.mission-card {
  background: linear-gradient(160deg, rgba(8, 10, 24, 0.96), rgba(18, 12, 32, 0.94));
  animation: mission-fade-up 0.55s ease both;
}

.mission-card__wash {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.04), transparent 42%),
    radial-gradient(circle at 0% 0%, rgba(168, 85, 247, 0.14), transparent 42%);
}

.mission-card__wash--facebook {
  background:
    linear-gradient(135deg, rgba(59, 89, 152, 0.22), transparent 48%),
    linear-gradient(160deg, rgba(8, 10, 24, 0.2), transparent 60%);
}

.mission-card__wash--instagram {
  background:
    linear-gradient(135deg, rgba(225, 48, 108, 0.2), transparent 48%),
    linear-gradient(160deg, rgba(131, 58, 180, 0.16), transparent 60%);
}

.mission-card__wash--google,
.mission-card__wash--reading {
  background:
    linear-gradient(135deg, rgba(34, 211, 238, 0.16), transparent 48%),
    linear-gradient(160deg, rgba(99, 102, 241, 0.12), transparent 60%);
}

.mission-card__wash--vote {
  background:
    linear-gradient(135deg, rgba(251, 191, 36, 0.16), transparent 48%),
    linear-gradient(160deg, rgba(217, 70, 239, 0.12), transparent 60%);
}

.mission-card__wash--tiktok,
.mission-card__wash--twitter,
.mission-card__wash--whatsapp,
.mission-card__wash--share,
.mission-card__wash--default {
  background:
    linear-gradient(135deg, rgba(168, 85, 247, 0.16), transparent 48%),
    linear-gradient(160deg, rgba(34, 211, 238, 0.1), transparent 60%);
}

.mission-card--featured {
  box-shadow: 0 18px 40px rgba(120, 53, 15, 0.28);
}

.mission-card--done {
  box-shadow: 0 18px 40px rgba(6, 78, 59, 0.22);
}

.mission-card__icon--facebook {
  border-color: rgba(96, 165, 250, 0.35);
  background: rgba(37, 99, 235, 0.22);
  color: #93c5fd;
}

.mission-card__icon--instagram {
  border-color: rgba(244, 114, 182, 0.35);
  background: linear-gradient(135deg, rgba(225, 48, 108, 0.28), rgba(131, 58, 180, 0.28));
  color: #fbcfe8;
}

.mission-card__icon--google {
  border-color: rgba(252, 165, 165, 0.35);
  background: rgba(239, 68, 68, 0.16);
  color: #fecaca;
}

.mission-card__icon--reading {
  border-color: rgba(34, 211, 238, 0.35);
  background: rgba(34, 211, 238, 0.14);
  color: #a5f3fc;
}

.mission-card__icon--vote {
  border-color: rgba(251, 191, 36, 0.35);
  background: rgba(251, 191, 36, 0.14);
  color: #fde68a;
}

.mission-card__icon--tiktok,
.mission-card__icon--twitter,
.mission-card__icon--whatsapp,
.mission-card__icon--share,
.mission-card__icon--default {
  border-color: rgba(196, 181, 253, 0.35);
  background: rgba(139, 92, 246, 0.16);
  color: #ddd6fe;
}

.mission-card__track {
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.35);
}

.mission-card__bar {
  min-height: 100%;
  transition: width 0.55s ease;
  box-shadow: 0 0 18px rgba(232, 121, 249, 0.55);
}

.mission-card__reward {
  transition: transform 0.25s ease;
}

.mission-card:hover .mission-card__reward {
  transform: translateY(-1px);
}

.mission-howto__step:hover span {
  transform: scale(1.06);
}

.mission-howto__step span {
  transition: transform 0.25s ease;
}

@keyframes mission-fade-up {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .missions-eyebrow,
  .mission-stat,
  .mission-card {
    animation: none;
  }

  .mission-card,
  .mission-card__cta,
  .mission-card__icon,
  .mission-howto__step span {
    transition: none;
  }
}

.mission-detail-sheet {
  background:
    radial-gradient(circle at 12% 0%, rgba(34, 211, 238, 0.16), transparent 34%),
    radial-gradient(circle at 100% 100%, rgba(168, 85, 247, 0.14), transparent 36%),
    linear-gradient(160deg, #0b0f1d 0%, #101528 55%, #0a0d18 100%);
  color: #e2e8f0;
}

.mission-detail-sheet__glow {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.04), transparent 42%);
}

.mission-detail-sheet__accent {
  background: linear-gradient(180deg, #22d3ee, #a855f7 55%, #f59e0b);
}

.mission-detail-sheet__icon {
  border: 1px solid rgba(34, 211, 238, 0.35);
  background: rgba(34, 211, 238, 0.12);
  color: #a5f3fc;
}

.mission-detail-sheet__eyebrow {
  color: #67e8f9;
}

.mission-detail-sheet__title {
  color: #fff;
}

.mission-detail-sheet__label {
  color: #94a3b8;
}

.mission-detail-sheet__body {
  color: #cbd5e1;
}

.mission-detail-sheet__panel {
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.55);
}

.mission-detail-sheet__hint {
  border: 1px solid rgba(34, 211, 238, 0.22);
  background: rgba(34, 211, 238, 0.1);
  color: #a5f3fc;
}

.mission-detail-sheet__success {
  border: 1px solid rgba(52, 211, 153, 0.28);
  background: rgba(16, 185, 129, 0.12);
  color: #a7f3d0;
}

.mission-detail-sheet__reward {
  color: #fcd34d;
}

.mission-detail-sheet__track {
  background: rgba(255, 255, 255, 0.1);
}

.mission-detail-sheet__ghost {
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.04);
  color: #e2e8f0;
}

.mission-detail-sheet__ghost:hover {
  background: rgba(255, 255, 255, 0.08);
}
</style>
