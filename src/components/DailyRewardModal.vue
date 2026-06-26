<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { doc, getDoc, increment, runTransaction, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { translate } from '../i18n'

const DAILY_REWARD_STATE_KEY = 'vmm-daily-reward-state'
const MS_PER_DAY = 24 * 60 * 60 * 1000

const rewardSchedule = [
  { day: 1, points: 10 },
  { day: 2, points: 15 },
  { day: 3, points: 20 },
  { day: 4, points: 25 },
  { day: 5, points: 30 },
  { day: 6, points: 40 },
  { day: 7, points: 50, crown: true },
]

const isOpen = ref(false)
const claimed = ref(false)
const isClaiming = ref(false)
const showClaimSuccess = ref(false)
const claimError = ref('')
const pointsBeforeClaim = ref(0)
const pointsAfterClaim = ref(0)
const rewardState = ref({
  lastClaimDate: '',
  streak: 0,
})

const getTodayKey = () => new Date().toISOString().slice(0, 10)
const getDateFromKey = (dateKey) => new Date(`${dateKey}T00:00:00`)

const daysBetween = (nextDateKey, previousDateKey) => {
  if (!nextDateKey || !previousDateKey) {
    return Number.POSITIVE_INFINITY
  }

  return Math.round((getDateFromKey(nextDateKey) - getDateFromKey(previousDateKey)) / MS_PER_DAY)
}

const getRewardDayFromStreak = (streak) => Math.min(7, Math.max(1, Number(streak || 1)))

const nextStreakForClaim = computed(() => {
  const lastClaimDate = rewardState.value.lastClaimDate
  const currentStreak = Number(rewardState.value.streak || 0)

  if (lastClaimDate === getTodayKey()) {
    return Math.max(1, currentStreak)
  }

  return daysBetween(getTodayKey(), lastClaimDate) === 1
    ? currentStreak + 1
    : 1
})

const activeRewardDay = computed(() => getRewardDayFromStreak(nextStreakForClaim.value))
const rewards = computed(() =>
  rewardSchedule.map((reward) => ({
    ...reward,
    status: reward.day < activeRewardDay.value
      ? 'claimed'
      : reward.day === activeRewardDay.value
        ? 'today'
        : 'locked',
  })),
)
const todaysReward = computed(() => rewards.value.find((reward) => reward.status === 'today') || rewards.value[0])
const rewardPoints = computed(() => Number(todaysReward.value?.points || 0))
const tomorrowReward = computed(() => {
  const nextDay = getRewardDayFromStreak(nextStreakForClaim.value + 1)
  return rewardSchedule.find((reward) => reward.day === nextDay) || rewardSchedule.at(-1)
})

const getStoredDailyRewardState = () => {
  try {
    return JSON.parse(window.localStorage.getItem(DAILY_REWARD_STATE_KEY) || '{}')
  } catch {
    return {}
  }
}

const saveDailyRewardState = (state) => {
  window.localStorage.setItem(DAILY_REWARD_STATE_KEY, JSON.stringify({
    ...getStoredDailyRewardState(),
    ...state,
    date: getTodayKey(),
  }))
}

const shouldShowDailyReward = () => {
  const state = getStoredDailyRewardState()

  return state.date !== getTodayKey() || !state.dismissed
}

const syncClaimedState = async () => {
  const user = auth.currentUser
  claimed.value = false
  rewardState.value = {
    lastClaimDate: '',
    streak: 0,
  }

  if (!user || user.isAnonymous) {
    return
  }

  const [userSnap, claimSnap] = await Promise.all([
    getDoc(doc(db, 'users', user.uid)),
    getDoc(doc(db, 'users', user.uid, 'dailyRewards', getTodayKey())),
  ])
  const userData = userSnap.data() || {}

  rewardState.value = {
    lastClaimDate: userData.lastDailyRewardClaimDate || '',
    streak: Number(userData.dailyRewardStreak || 0),
  }
  claimed.value = claimSnap.exists()
}

const openModal = async () => {
  await syncClaimedState()
  showClaimSuccess.value = false
  claimError.value = ''
  isOpen.value = true
}

const closeModal = () => {
  saveDailyRewardState({ dismissed: true })
  isOpen.value = false
}

const handleEscape = (event) => {
  if (event.key === 'Escape') {
    closeModal()
  }
}

const claimReward = async () => {
  if (isClaiming.value || claimed.value) {
    return
  }

  isClaiming.value = true
  claimError.value = ''

  const user = auth.currentUser
  const todayKey = getTodayKey()
  let nextPointsTotal = rewardPoints.value
  let claimedPoints = rewardPoints.value
  let claimedStreak = nextStreakForClaim.value

  try {
    if (!user || user.isAnonymous) {
      claimError.value = translate('rewards.loginRequired')
      return
    }

    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', user.uid)
      const claimRef = doc(db, 'users', user.uid, 'dailyRewards', todayKey)
      const [userSnap, claimSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(claimRef),
      ])

      if (claimSnap.exists()) {
        throw new Error('daily-reward-already-claimed')
      }

      const userData = userSnap.data() || {}
      const currentPoints = Number(userData.points || 0)
      const currentStreak = Number(userData.dailyRewardStreak || 0)
      const lastClaimDate = userData.lastDailyRewardClaimDate || ''
      const nextStreak = daysBetween(todayKey, lastClaimDate) === 1
        ? currentStreak + 1
        : 1
      const streakDay = getRewardDayFromStreak(nextStreak)
      const nextReward = rewardSchedule.find((reward) => reward.day === streakDay) || rewardSchedule[0]

      claimedPoints = nextReward.points
      claimedStreak = nextStreak
      nextPointsTotal = currentPoints + claimedPoints
      pointsBeforeClaim.value = currentPoints
      pointsAfterClaim.value = nextPointsTotal

      transaction.set(claimRef, {
        userId: user.uid,
        claimDate: todayKey,
        points: claimedPoints,
        streak: nextStreak,
        streakDay,
        claimedAt: serverTimestamp(),
      })
      transaction.update(userRef, {
        points: increment(claimedPoints),
        lastDailyRewardClaimDate: todayKey,
        dailyRewardStreak: nextStreak,
        dailyRewardStreakDay: streakDay,
        dailyRewardClaimedAt: serverTimestamp(),
      })
    })

    rewardState.value = {
      lastClaimDate: todayKey,
      streak: claimedStreak,
    }
    claimed.value = true
    showClaimSuccess.value = true
    saveDailyRewardState({
      claimed: true,
      dismissed: true,
      points: claimedPoints,
      pointsTotal: nextPointsTotal,
    })
  } catch (error) {
    if (error.message === 'daily-reward-already-claimed') {
      await syncClaimedState()
      claimed.value = true
      showClaimSuccess.value = true
      saveDailyRewardState({ claimed: true, dismissed: true, points: rewardPoints.value })
      return
    }

    claimError.value = translate('rewards.claimError')
  } finally {
    isClaiming.value = false
  }
}

onMounted(async () => {
  await syncClaimedState()
  isOpen.value = Boolean(auth.currentUser && !auth.currentUser.isAnonymous && shouldShowDailyReward())

  window.addEventListener('keydown', handleEscape)
  window.addEventListener('open-daily-reward-modal', openModal)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
  window.removeEventListener('open-daily-reward-modal', openModal)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-3 py-4 backdrop-blur-md sm:px-4 sm:py-6"
      @click.self="closeModal"
    >
      <div class="daily-modal relative w-full max-w-4xl overflow-hidden rounded-3xl border border-violet-300/25 bg-[#090b19] p-4 text-white shadow-2xl shadow-fuchsia-950/40 sm:p-7">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(236,72,153,0.24),transparent_32%),radial-gradient(circle_at_95%_100%,rgba(124,58,237,0.35),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(24,8,45,0.96))]"></div>
        <div class="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
        <div class="pointer-events-none absolute -bottom-20 left-1/4 size-56 rounded-full bg-cyan-400/10 blur-3xl"></div>

        <button
          type="button"
          class="absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-lg font-black text-slate-300 transition hover:bg-white/10 hover:text-white"
          :aria-label="$t('versus.closeModal')"
          @click="closeModal"
        >
          ×
        </button>

        <div v-if="showClaimSuccess" class="reward-success relative z-10 grid min-h-112 place-items-center text-center">
          <div class="pointer-events-none absolute inset-0 overflow-hidden">
            <span
              v-for="index in 18"
              :key="index"
              class="reward-confetti absolute rounded-full"
              :style="{
                left: `${(index * 17) % 100}%`,
                animationDelay: `${index * 0.08}s`,
                background: index % 3 === 0 ? '#22d3ee' : index % 3 === 1 ? '#f0abfc' : '#fde047',
              }"
            ></span>
          </div>

          <div class="relative mx-auto max-w-md">
            <div class="reward-coin mx-auto grid size-32 place-items-center rounded-full border border-amber-200/50 bg-linear-to-br from-amber-200 via-fuchsia-300 to-violet-500 text-5xl font-black text-slate-950 shadow-[0_0_80px_rgba(244,114,182,0.55)]">
              +{{ rewardPoints }}
            </div>
            <p class="mt-6 text-xs font-black uppercase tracking-[0.32em] text-emerald-300">
              {{ $t('rewards.claimedTitle') }}
            </p>
            <h2 class="mt-3 text-3xl font-black leading-tight text-white sm:text-5xl">
              {{ $t('rewards.pointsAdded', { points: rewardPoints }) }}
            </h2>
            <p class="mt-3 text-sm leading-6 text-slate-300">
              {{ $t('rewards.claimedDescription', { points: rewardPoints }) }}
            </p>
            <p
              v-if="pointsAfterClaim"
              class="reward-total mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-100"
            >
              {{ $t('rewards.totalAfterClaim', { points: pointsAfterClaim.toLocaleString() }) }}
            </p>
            <button
              type="button"
              class="mt-6 min-h-12 w-full rounded-2xl bg-linear-to-r from-cyan-400 to-violet-500 px-6 text-sm font-black uppercase text-white shadow-lg shadow-violet-950/40 transition hover:scale-[1.02]"
              @click="closeModal"
            >
              {{ $t('rewards.continue') }}
            </button>
          </div>
        </div>

        <div v-else class="relative z-10">
          <div class="flex flex-col gap-4 pr-10 sm:flex-row sm:items-start sm:justify-between sm:pr-0">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.32em] text-pink-300">
                {{ $t('rewards.dailyReward') }}
              </p>
              <h2 class="mt-3 text-2xl font-black leading-tight sm:text-4xl">
                {{ $t('rewards.sevenDayStreak') }}
              </h2>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                {{ $t('rewards.dailyDescription') }}
              </p>
            </div>

            <div class="self-start rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-left">
              <p class="text-[10px] font-black uppercase tracking-widest text-emerald-300">{{ $t('rewards.today') }}</p>
              <p class="mt-1 text-lg font-black text-emerald-100">
                {{ claimed ? `✓ ${$t('rewards.claimed')}` : $t('rewards.pointsAdded', { points: rewardPoints }) }}
              </p>
            </div>
          </div>

          <div class="daily-rewards-slider mt-6 flex snap-x gap-3 overflow-x-auto pb-2 pl-4 pr-4 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-7">
            <article
              v-for="reward in rewards"
              :key="reward.day"
              class="relative min-w-28 snap-start overflow-hidden rounded-2xl border p-4 text-center transition sm:min-w-0"
              :class="[
                reward.status === 'claimed' && 'border-emerald-300/50 bg-emerald-400/10',
                reward.status === 'today' && 'daily-today border-fuchsia-300/70 bg-fuchsia-400/25 shadow-lg shadow-fuchsia-950/40',
                reward.status === 'locked' && 'border-white/10 bg-black/20 opacity-70',
              ]"
            >
              <span
                v-if="reward.status === 'claimed' || (claimed && reward.status === 'today')"
                class="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-emerald-400 text-xs font-black text-slate-950"
              >
                ✓
              </span>

              <div
                class="mx-auto grid size-14 place-items-center rounded-full border text-2xl"
                :class="reward.status === 'locked' ? 'border-white/10 bg-white/5 text-slate-500' : 'border-white/20 bg-white/10 text-white'"
              >
                {{ reward.crown ? '♛' : '☆' }}
              </div>

              <p class="mt-3 text-xs font-black uppercase tracking-widest text-slate-400">
                {{ $t('rewards.day', { day: reward.day }) }}
              </p>
              <p
                class="mt-1 text-2xl font-black"
                :class="reward.status === 'today' ? 'text-pink-200' : reward.status === 'claimed' ? 'text-emerald-200' : 'text-slate-400'"
              >
                +{{ reward.points }}
              </p>
              <p class="text-xs font-bold uppercase text-slate-500">{{ $t('rewards.pointsShort') }}</p>
            </article>
          </div>

          <div class="mt-5 overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex items-center gap-3">
                <span class="grid size-12 place-items-center rounded-full bg-emerald-400/15 text-2xl text-emerald-300 ring-1 ring-emerald-300/30">
                  ✓
                </span>
                <div>
                  <p class="font-black text-emerald-100">
                    {{ claimed ? $t('rewards.claimedToday', { points: rewardPoints }) : $t('rewards.todayReady') }}
                  </p>
                  <p class="mt-1 text-sm text-slate-300">{{ $t('rewards.tomorrow') }} <span class="font-black text-white">+{{ tomorrowReward.points }} pts</span> · {{ $t('rewards.day', { day: tomorrowReward.day }) }}</p>
                  <p v-if="claimError" class="mt-2 text-sm font-bold text-red-200">
                    {{ claimError }}
                  </p>
                </div>
              </div>

              <button
                type="button"
                class="min-h-12 w-full rounded-2xl bg-linear-to-r from-cyan-400 to-violet-500 px-6 text-sm font-black uppercase text-white shadow-lg shadow-violet-950/40 transition hover:scale-[1.02] sm:w-auto"
                :disabled="isClaiming || claimed"
                @click="claimReward"
              >
                {{ isClaiming ? $t('rewards.claiming') : claimed ? $t('rewards.claimed') : $t('rewards.claimNow') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.daily-modal {
  animation: daily-modal-enter 0.32s ease-out both;
}

.reward-success {
  animation: reward-success-enter 0.36s ease-out both;
}

.reward-coin {
  animation: reward-coin-pop 0.72s cubic-bezier(0.2, 1.4, 0.3, 1) both, reward-coin-glow 1.8s ease-in-out infinite;
}

.reward-total {
  animation: reward-total-slide 0.48s ease-out 0.42s both;
}

.reward-confetti {
  top: -1rem;
  width: 0.5rem;
  height: 0.5rem;
  opacity: 0;
  animation: reward-confetti-fall 1.35s ease-out forwards;
}

.daily-rewards-slider::-webkit-scrollbar {
  display: none;
}

.daily-rewards-slider {
  scrollbar-width: none;
}

.daily-today {
  isolation: isolate;
}

.daily-today::before {
  content: "";
  position: absolute;
  inset: -40%;
  z-index: 0;
  border-radius: inherit;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(255, 255, 255, 0.42) 42deg,
    rgba(244, 114, 182, 0.5) 78deg,
    rgba(168, 85, 247, 0.34) 118deg,
    transparent 165deg,
    transparent 360deg
  );
  filter: blur(0.5px) drop-shadow(0 0 14px rgba(244, 114, 182, 0.55));
  animation: daily-shine 3.2s linear infinite;
  pointer-events: none;
}

.daily-today::after {
  content: "";
  position: absolute;
  inset: 2px;
  z-index: 1;
  border-radius: calc(1rem - 2px);
  background: linear-gradient(180deg, rgba(88, 28, 135, 0.72), rgba(25, 8, 43, 0.88));
  box-shadow: inset 0 0 24px rgba(255, 255, 255, 0.06);
  pointer-events: none;
}

.daily-today > * {
  position: relative;
  z-index: 2;
}

@keyframes daily-modal-enter {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.96);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes reward-success-enter {
  from {
    opacity: 0;
    transform: translateY(14px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes reward-coin-pop {
  0% {
    opacity: 0;
    transform: scale(0.3) rotate(-18deg);
  }

  68% {
    opacity: 1;
    transform: scale(1.12) rotate(4deg);
  }

  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes reward-coin-glow {
  0%,
  100% {
    box-shadow: 0 0 60px rgba(244, 114, 182, 0.42);
  }

  50% {
    box-shadow: 0 0 95px rgba(34, 211, 238, 0.52);
  }
}

@keyframes reward-total-slide {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.96);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes reward-confetti-fall {
  0% {
    opacity: 0;
    transform: translateY(0) rotate(0deg) scale(0.7);
  }

  10% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translateY(28rem) rotate(540deg) scale(1.05);
  }
}

@keyframes daily-shine {
  to {
    rotate: 360deg;
  }
}
</style>
