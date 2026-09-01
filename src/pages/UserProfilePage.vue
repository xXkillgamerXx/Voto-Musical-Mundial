<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale, translate } from '../i18n'
import { checkUsername, getCurrentApiAuth, getMe, getPublicProfile, updateMe, uploadProfileImage as uploadProfileImageFile } from '../services/api/authApi'
import { onStoredAuthChange } from '../services/api/client'
import ReportModal from '../components/ReportModal.vue'
import { artistUrl as buildArtistUrl } from '../utils/pollLocale'
import { routePath } from '../utils/localizedRoutes'
import { loadFanMe } from '../utils/fanPerks'
import { getFanMembership, getMySupportedArtists, hydrateMembership, isMegaFanIdentity, membershipTone, membershipAccent, membershipShell } from '../utils/fanMembership'

const { locale } = useI18n()
const pathParts = window.location.pathname.split('/').filter(Boolean)
const routeUsername = pathParts[0] === 'user' ? (pathParts[1] || '').toLowerCase() : ''

const currentUser = ref(null)
const userProfile = ref(null)
const profileUserId = ref('')
const followedArtists = ref([])
const editForm = ref({
  name: '',
  username: '',
  country: '',
  bio: '',
  photoURL: '',
  banner: '',
  emailCampaigns: true,
  locale: 'en',
})
const isLoading = ref(true)
const isEditOpen = ref(false)
const isSavingProfile = ref(false)
const isUploadingPhoto = ref(false)
const isUploadingBanner = ref(false)
const isCheckingUsername = ref(false)
const usernameStatus = ref(null)
const errorMessage = ref('')
const successMessage = ref('')
const isReportModalOpen = ref(false)
const fanMembership = ref(null)
let unsubscribeAuth = null
let usernameCheckTimer = null

const isPublicProfile = computed(() => Boolean(routeUsername))
const isOwnHandle = computed(() => {
  const mine = String(currentUser.value?.username || '').trim().toLowerCase()
  return Boolean(routeUsername && mine && mine === routeUsername)
})
const isOwnProfile = computed(() =>
  Boolean(
    (currentUser.value?.id && String(currentUser.value.id) === String(profileUserId.value)) ||
      isOwnHandle.value,
  ),
)
const settingsHref = computed(() => routePath('profileSettings', locale.value))
const canReportProfile = computed(() => isPublicProfile.value && userProfile.value && !isOwnProfile.value)
const openReportProfile = () => {
  isReportModalOpen.value = true
}

const closeReportProfile = () => {
  isReportModalOpen.value = false
}

const displayName = computed(() =>
  userProfile.value?.name || userProfile.value?.displayName || (!isPublicProfile.value ? currentUser.value?.displayName || currentUser.value?.email : '') || translate('profile.fallbackName'),
)

const profilePhoto = computed(() =>
  userProfile.value?.photoURL || userProfile.value?.photoUrl || (!isPublicProfile.value || isOwnProfile.value ? currentUser.value?.photoUrl || currentUser.value?.photoURL : '') || '',
)
const profileBanner = computed(() => userProfile.value?.banner || userProfile.value?.bannerUrl || '')
const userInitial = computed(() => displayName.value.trim().charAt(0).toUpperCase())
const profileStats = computed(() => [
  {
    label: translate('profile.followedArtists'),
    value: followedArtists.value.length.toLocaleString(),
  },
])

const loadFanMembership = async () => {
  if (isPublicProfile.value) {
    const fromProfile = hydrateMembership(userProfile.value?.fanMembership)
    fanMembership.value = fromProfile && !fromProfile.expired ? fromProfile : null
    return
  }
  if (!isOwnProfile.value) return
  try {
    const payload = await loadFanMe()
    fanMembership.value = hydrateMembership(payload.membership)
  } catch {
    fanMembership.value = hydrateMembership(userProfile.value?.fanMembership) || getFanMembership()
  }
}

const artistMatchId = (artist) => String(artist?.artistId || artist?.id || '')
const artistMatchName = (artist) => String(artist?.artistName || artist?.name || '').trim().toLowerCase()

const isSameArtist = (artist, supported) => {
  const artistId = artistMatchId(artist)
  const artistName = artistMatchName(artist)
  const id = String(supported?.id || supported?.artistId || '')
  const name = String(supported?.name || supported?.artistName || '').trim().toLowerCase()
  return (artistId && id && artistId === id) || (artistName && name && artistName === name)
}

const supportedArtists = computed(() => {
  if (fanMembership.value?.expired) return []
  const fromPlan = fanMembership.value?.artists || []
  if (fromPlan.length) return fromPlan
  return getMySupportedArtists(userProfile.value || currentUser.value).map((row) => {
    const followed = followedArtists.value.find((artist) => isSameArtist(artist, row))
    return {
      ...row,
      name: row.name || followed?.artistName || followed?.name || '',
      image: row.image || followed?.artistImage || '',
    }
  })
})

const isSupportedArtist = (artist) =>
  supportedArtists.value.some((row) => isSameArtist(artist, row))

const isMegaFan = computed(() =>
  Boolean(
    (fanMembership.value &&
      !fanMembership.value.expired &&
      (fanMembership.value.sku === 'MEGA' || fanMembership.value.mega)) ||
      isMegaFanIdentity(userProfile.value),
  ),
)

const isSuperFan = computed(() =>
  Boolean(
    fanMembership.value &&
      !fanMembership.value.expired &&
      !isMegaFan.value &&
      (fanMembership.value.sku === 'SUPER' || fanMembership.value.featured),
  ),
)

const isMegaSupported = (artist) => isMegaFan.value && isSupportedArtist(artist)

const favoriteArtists = computed(() => {
  const followed = followedArtists.value || []
  const extras = supportedArtists.value
    .filter((row) => !followed.some((artist) => isSameArtist(artist, row)))
    .map((row) => ({
      id: `support-${row.id}`,
      artistId: row.id,
      artistName: row.name,
      artistImage: row.image,
    }))
  return [...followed, ...extras].sort(
    (a, b) => Number(isSupportedArtist(b)) - Number(isSupportedArtist(a)),
  )
})

const membershipDaysLabel = computed(() => {
  const days = Number(fanMembership.value?.daysLeft || 0)
  if (String(locale.value || '').startsWith('en')) {
    return days === 1 ? 'day left' : 'days left'
  }
  return days === 1 ? 'día restante' : 'días restantes'
})

const isUsernameBlocked = computed(() => {
  const username = editForm.value.username.trim().toLowerCase()
  const currentUsername = (userProfile.value?.username || currentUser.value?.username || '').toLowerCase()

  if (!username) return false
  if (username === currentUsername) return false
  return isCheckingUsername.value || !usernameStatus.value?.valid || !usernameStatus.value?.available
})

const artistUrl = (artist) =>
  buildArtistUrl(
    { id: artist.artistId, slug: artist.artistSlug, slugEn: artist.artistSlugEn },
    locale.value,
  )

const emptyFollowingActions = computed(() => [
  {
    title: translate('profile.emptyFollowingActions.artists.title'),
    text: translate('profile.emptyFollowingActions.artists.text'),
    href: routePath('artists', locale.value),
    icon: 'fa-solid fa-microphone-lines',
    visual: 'from-violet-950 via-fuchsia-700 to-indigo-950',
  },
  {
    title: translate('profile.emptyFollowingActions.ranking.title'),
    text: translate('profile.emptyFollowingActions.ranking.text'),
    href: routePath('rankingPopularity', locale.value),
    icon: 'fa-solid fa-ranking-star',
    visual: 'from-slate-800 via-violet-700 to-slate-950',
  },
  {
    title: translate('profile.emptyFollowingActions.polls.title'),
    text: translate('profile.emptyFollowingActions.polls.text'),
    href: routePath('polls', locale.value),
    icon: 'fa-solid fa-check-to-slot',
    visual: 'from-fuchsia-900 via-pink-700 to-slate-950',
  },
])

const isAcceptedImageFile = (file) => {
  const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']
  const acceptedExtensions = ['.jpg', '.jpeg', '.png', '.webp']
  const fileName = file.name.toLowerCase()

  return acceptedTypes.includes(file.type)
    || acceptedExtensions.some((extension) => fileName.endsWith(extension))
}

const openEditProfile = () => {
  editForm.value = {
    name: displayName.value,
    username: userProfile.value?.username || currentUser.value?.username || '',
    country: userProfile.value?.country || '',
    bio: userProfile.value?.bio || '',
    photoURL: profilePhoto.value,
    banner: profileBanner.value,
    emailCampaigns:
      userProfile.value?.emailCampaigns !== false &&
      currentUser.value?.emailCampaigns !== false,
    locale:
      userProfile.value?.locale === 'es' || currentUser.value?.locale === 'es'
        ? 'es'
        : 'en',
  }
  errorMessage.value = ''
  successMessage.value = ''
  usernameStatus.value = null
  isEditOpen.value = true
}

const closeEditProfile = () => {
  isEditOpen.value = false
}

const uploadProfileImage = async (file, field) => {
  if (!file) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''
  if (!isAcceptedImageFile(file)) {
    errorMessage.value = translate('profile.edit.imageTypeError')
    return
  }

  const isBanner = field === 'banner'
  if (isBanner) {
    isUploadingBanner.value = true
  } else {
    isUploadingPhoto.value = true
  }

  try {
    const uploaded = await uploadProfileImageFile(file)
    editForm.value[field] = uploaded.url
  } catch {
    errorMessage.value = translate('profile.edit.uploadError')
  } finally {
    if (isBanner) {
      isUploadingBanner.value = false
    } else {
      isUploadingPhoto.value = false
    }
  }
}

const handleProfileImageInput = (event, field) => {
  const [file] = event.target.files || []
  uploadProfileImage(file, field)
  event.target.value = ''
}

const saveProfile = async () => {
  if (!currentUser.value?.id || !isOwnProfile.value) {
    return
  }

  const nextName = editForm.value.name.trim()
  const nextUsername = editForm.value.username.trim().toLowerCase()

  if (!nextName) {
    errorMessage.value = translate('profile.edit.nameRequired')
    return
  }

  if (isUsernameBlocked.value) {
    errorMessage.value = usernameStatus.value?.message || 'Verifica el username antes de guardar.'
    return
  }

  errorMessage.value = ''
  successMessage.value = ''
  isSavingProfile.value = true

  try {
    const updated = await updateMe({
      name: nextName,
      displayName: nextName,
      username: nextUsername,
      country: editForm.value.country.trim(),
      bio: editForm.value.bio.trim(),
      photoURL: editForm.value.photoURL,
      banner: editForm.value.banner,
      emailCampaigns: Boolean(editForm.value.emailCampaigns),
      locale: editForm.value.locale === 'es' ? 'es' : 'en',
    })
    currentUser.value = updated
    userProfile.value = updated
    if (updated?.locale) {
      setLocale(updated.locale === 'es' ? 'es' : 'en')
    }
    profileUserId.value = updated.id
    successMessage.value = translate('profile.edit.saved')
    isEditOpen.value = false
  } catch (error) {
    errorMessage.value = error.message || translate('profile.edit.saveError')
  } finally {
    isSavingProfile.value = false
  }
}

watch(
  () => editForm.value.username,
  (value) => {
    if (!isEditOpen.value) return
    window.clearTimeout(usernameCheckTimer)

    const username = value.trim().toLowerCase()
    const currentUsername = (userProfile.value?.username || currentUser.value?.username || '').toLowerCase()

    usernameStatus.value = null
    if (!username || username === currentUsername) {
      isCheckingUsername.value = false
      return
    }

    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      isCheckingUsername.value = false
      usernameStatus.value = {
        valid: false,
        available: false,
        message: 'Usa 3 a 32 caracteres: letras, numeros o guion bajo.',
      }
      return
    }

    isCheckingUsername.value = true
    usernameCheckTimer = window.setTimeout(async () => {
      try {
        usernameStatus.value = await checkUsername(username)
      } catch {
        usernameStatus.value = {
          valid: false,
          available: false,
          message: 'No se pudo verificar el username.',
        }
      } finally {
        isCheckingUsername.value = false
      }
    }, 350)
  },
)

const setUserProfile = (profile) => {
  profileUserId.value = profile?.id || ''
  userProfile.value = profile || null
  followedArtists.value = profile?.followedArtists || []
  loadFanMembership()
  isLoading.value = false
}

const loadOwnProfile = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const profile = await getMe()
    currentUser.value = profile
    setUserProfile(profile)
  } catch {
    errorMessage.value = translate('profile.ownLoadError')
    setUserProfile(null)
  }
}

const loadPublicProfile = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    setUserProfile(await getPublicProfile(routeUsername))
  } catch {
    errorMessage.value = translate('profile.userLoadError')
    setUserProfile(null)
  }
}

onMounted(() => {
  const syncAuth = (authState = getCurrentApiAuth()) => {
    currentUser.value = authState?.user || null
    if (!isPublicProfile.value) loadOwnProfile()
    else loadFanMembership()
  }
  unsubscribeAuth = onStoredAuthChange(syncAuth)
  syncAuth()

  if (isPublicProfile.value) {
    loadPublicProfile()
  }

  window.addEventListener('vmm-fan-membership-changed', loadFanMembership)
})

watch([isOwnProfile, userProfile], loadFanMembership)

onUnmounted(() => {
  unsubscribeAuth?.()
  window.clearTimeout(usernameCheckTimer)
  window.removeEventListener('vmm-fan-membership-changed', loadFanMembership)
})
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-8 sm:px-6 lg:py-12">
    <div v-if="isLoading" class="profile-loading" aria-busy="true" aria-live="polite">
      <div class="overflow-hidden rounded-3xl border border-violet-300/15 bg-[#090b19]/90 shadow-2xl shadow-fuchsia-950/20">
        <div class="relative min-h-72 bg-white/5">
          <div class="profile-loading-shimmer absolute inset-0"></div>
          <div class="absolute inset-x-0 bottom-0 p-6 sm:p-8">
            <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div class="flex items-end gap-4">
                <div class="size-28 rounded-3xl bg-white/10 sm:size-36"></div>
                <div>
                  <div class="h-3 w-32 rounded-full bg-white/10"></div>
                  <div class="mt-4 h-10 w-52 rounded-2xl bg-white/10 sm:h-14 sm:w-80"></div>
                  <div class="mt-3 h-4 w-28 rounded-full bg-white/10"></div>
                </div>
              </div>
              <div class="h-12 w-36 rounded-full bg-white/10"></div>
            </div>
          </div>
        </div>
        <div class="p-5 lg:p-8">
          <div class="h-4 w-full max-w-3xl rounded-full bg-white/10"></div>
          <div class="mt-3 h-4 w-2/3 rounded-full bg-white/10"></div>
          <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div v-for="index in 3" :key="index" class="h-24 rounded-2xl border border-white/10 bg-white/5"></div>
          </div>
        </div>
      </div>
      <div class="mt-8 rounded-4xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <div class="h-3 w-24 rounded-full bg-white/10"></div>
        <div class="mt-3 h-7 w-48 rounded-2xl bg-white/10"></div>
        <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="index in 6" :key="`fav-${index}`" class="h-20 rounded-3xl border border-white/10 bg-white/5"></div>
        </div>
      </div>
      <p class="profile-loading-label mt-6 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
        <span class="profile-loading-orb" aria-hidden="true"></span>
        {{ $t('profile.loading') }}
      </p>
    </div>

    <div
      v-else-if="!isPublicProfile && !currentUser"
      class="rounded-4xl border border-white/10 bg-white/5 p-8 text-center"
    >
      <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
        {{ $t('profile.title') }}
      </p>
      <h1 class="mt-3 text-3xl font-black text-white">{{ $t('profile.loginTitle') }}</h1>
      <p class="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
        {{ $t('profile.loginDescription') }}
      </p>
      <a
        href="/registro"
        class="mt-6 inline-flex rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-black uppercase tracking-wide text-white"
      >
        {{ $t('profile.createAccount') }}
      </a>
    </div>

    <div
      v-else-if="isPublicProfile && !userProfile"
      class="rounded-4xl border border-white/10 bg-white/5 p-8 text-center"
    >
      <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
        {{ $t('profile.publicTitle') }}
      </p>
      <h1 class="mt-3 text-3xl font-black text-white">{{ $t('profile.unavailableTitle') }}</h1>
      <p class="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
        {{ errorMessage || $t('profile.notFoundDescription') }}
      </p>
      <a
        href="/"
        class="mt-6 inline-flex rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-black uppercase tracking-wide text-white"
      >
        {{ $t('profile.backHome') }}
      </a>
    </div>

    <template v-else>
      <p
        v-if="errorMessage"
        class="mb-6 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
      >
        {{ errorMessage }}
      </p>
      <p
        v-if="successMessage"
        class="mb-6 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200"
      >
        {{ successMessage }}
      </p>

      <div
        class="overflow-hidden rounded-3xl border bg-[#090b19]/90 shadow-2xl"
        :class="isMegaFan
          ? 'profile-mega-shell border-amber-300/40 shadow-amber-950/40'
          : 'border-violet-300/15 shadow-fuchsia-950/20'"
      >
        <div
          class="relative min-h-72"
          :class="isMegaFan
            ? 'profile-mega-hero'
            : 'bg-linear-to-br from-blue-950 via-violet-950 to-fuchsia-950'"
        >
          <img
            v-if="profileBanner"
            :src="profileBanner"
            :alt="displayName"
            class="absolute inset-0 size-full object-cover opacity-55"
          />
          <div
            class="absolute inset-0"
            :class="isMegaFan
              ? 'bg-[radial-gradient(circle_at_12%_20%,rgba(245,197,24,0.32),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(251,191,36,0.18),transparent_30%)]'
              : 'bg-[radial-gradient(circle_at_25%_25%,rgba(217,70,239,0.28),transparent_30%),radial-gradient(circle_at_78%_35%,rgba(34,211,238,0.2),transparent_28%)]'"
          ></div>
          <div class="absolute inset-0 bg-linear-to-t from-[#090b19] via-[#090b19]/30 to-transparent"></div>
          <div class="absolute inset-x-0 bottom-0 p-6 sm:p-8">
            <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div class="flex items-end gap-4">
                <span class="relative shrink-0">
                  <span
                    class="grid size-28 place-items-center overflow-hidden rounded-3xl text-4xl font-black sm:size-36"
                    :class="isMegaFan
                      ? 'profile-mega-avatar border-3 border-amber-300 bg-[#4a2f08] text-amber-200'
                      : 'border-2 border-fuchsia-300/40 bg-linear-to-br from-violet-500 to-fuchsia-500 text-white shadow-xl shadow-fuchsia-500/20'"
                  >
                    <img
                      v-if="profilePhoto"
                      :src="profilePhoto"
                      alt=""
                      class="size-full object-cover"
                      referrerpolicy="no-referrer"
                    />
                    <span v-else>{{ userInitial }}</span>
                  </span>
                  <span
                    v-if="isMegaFan"
                    class="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border-2 border-[#090b19] bg-amber-400 text-[11px] text-slate-950"
                  >
                    <i class="fa-solid fa-crown" aria-hidden="true"></i>
                  </span>
                  <span
                    v-else-if="isSuperFan"
                    class="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border-2 border-[#090b19] bg-linear-to-br from-violet-500 to-fuchsia-500 text-[11px] text-white"
                  >
                    <i class="fa-solid fa-bolt" aria-hidden="true"></i>
                  </span>
                </span>
                <div>
                  <p
                    class="text-xs font-black uppercase tracking-[0.28em]"
                    :class="isMegaFan ? 'text-amber-300' : 'text-cyan-300'"
                  >
                    {{ $t('profile.publicTitle') }}
                  </p>
                  <div class="mt-2 flex flex-wrap items-center gap-3">
                    <h1
                      class="text-4xl font-black leading-none sm:text-6xl"
                      :class="isMegaFan ? 'profile-mega-name text-amber-50' : 'text-white'"
                    >
                      {{ displayName }}
                    </h1>
                    <span
                      v-if="isMegaFan"
                      class="profile-mega-badge inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-amber-700 to-amber-300 px-3 py-1 text-[10px] font-black tracking-wide text-amber-950"
                    >
                      <i class="fa-solid fa-crown" aria-hidden="true"></i>
                      MEGA FAN
                    </span>
                    <span
                      v-else-if="isSuperFan"
                      class="inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-violet-600 to-fuchsia-500 px-3 py-1 text-[10px] font-black tracking-wide text-white"
                    >
                      <i class="fa-solid fa-bolt" aria-hidden="true"></i>
                      SUPER FAN
                    </span>
                  </div>
                  <p class="mt-2 text-lg font-black text-amber-300">
                    @{{ userProfile?.username || $t('profile.fallbackUsername') }}
                  </p>
                  <p
                    v-if="fanMembership && !fanMembership.expired"
                    class="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-black uppercase tracking-wide"
                    :class="membershipTone(fanMembership)"
                  >
                    <i class="fa-fw leading-none" :class="fanMembership.icon" aria-hidden="true"></i>
                    {{ $t('profile.membership.youAre') }} {{ fanMembership.name }}
                    · {{ fanMembership.daysLeft }} {{ membershipDaysLabel }}
                  </p>
                </div>
              </div>
              <div v-if="isOwnProfile" class="flex flex-wrap gap-2">
                <a
                  :href="settingsHref"
                  class="rounded-full border border-white/15 bg-white/8 px-5 py-3 text-sm font-black uppercase text-slate-200 transition hover:bg-white/12"
                >
                  {{ $t('nav.accountSettings') }}
                </a>
                <button
                  type="button"
                  class="rounded-full bg-linear-to-r from-pink-500 to-fuchsia-600 px-7 py-3 text-sm font-black uppercase text-white shadow-lg shadow-fuchsia-500/30 transition hover:scale-105"
                  @click="openEditProfile"
                >
                  {{ $t('profile.edit.open') }}
                </button>
              </div>
              <button
                v-else-if="canReportProfile"
                type="button"
                class="rounded-full border border-red-300/25 bg-red-500/10 px-7 py-3 text-sm font-black uppercase text-red-100 transition hover:bg-red-500/20"
                @click="openReportProfile"
              >
                <i class="fa-solid fa-flag mr-2" aria-hidden="true"></i>
                {{ $t('report.button') }}
              </button>
            </div>
          </div>
        </div>

        <div class="p-5 lg:p-8">
          <article
            v-if="fanMembership && !fanMembership.expired"
            class="fan-tier-card relative mb-6 overflow-hidden rounded-4xl border p-5 shadow-2xl sm:p-6"
            :class="membershipShell(fanMembership)"
          >
            <div
              class="fan-tier-glow pointer-events-none absolute -right-10 -top-16 size-56 rounded-full opacity-40 blur-3xl"
              :class="`bg-linear-to-br ${membershipAccent(fanMembership)}`"
            ></div>
            <div
              class="fan-tier-glow fan-tier-glow--slow pointer-events-none absolute -bottom-16 right-8 size-40 rounded-full opacity-25 blur-3xl"
              :class="`bg-linear-to-br ${membershipAccent(fanMembership)}`"
            ></div>
            <div class="fan-tier-shine pointer-events-none absolute inset-0"></div>
            <div class="relative flex flex-wrap items-center gap-6 sm:gap-10">
              <span
                class="grid size-16 shrink-0 place-items-center rounded-full text-2xl"
                :class="isMegaFan
                  ? 'bg-amber-400 text-slate-950'
                  : isSuperFan
                    ? 'bg-linear-to-br from-violet-500 to-fuchsia-500 text-white'
                    : 'bg-violet-500 text-white'"
                aria-hidden="true"
              >
                <i class="fa-fw" :class="fanMembership.icon || 'fa-solid fa-star'"></i>
              </span>
              <div class="fan-tier-days min-w-24">
                <p class="text-7xl font-black leading-none tracking-tight text-white">
                  {{ fanMembership.daysLeft }}
                </p>
                <p class="mt-2 text-[11px] font-black uppercase tracking-[0.22em]" :class="membershipTone(fanMembership)">
                  {{ membershipDaysLabel }}
                </p>
              </div>
              <div class="fan-tier-copy min-w-0">
                <p class="text-xs font-black uppercase tracking-[0.28em]" :class="membershipTone(fanMembership)">
                  {{ $t('profile.membership.youAre') }}
                </p>
                <h2 class="fan-tier-title mt-1 text-4xl font-black uppercase tracking-tight sm:text-5xl" :class="membershipTone(fanMembership)">
                  {{ fanMembership.name }}
                </h2>
                <p class="mt-2 text-sm font-bold text-white/90">
                  {{ $t('profile.membership.votes', { n: fanMembership.multiplier }) }}
                  <span v-if="Number(fanMembership.welcomePts || 0) > 0">
                    · {{ $t('profile.membership.points', { pts: fanMembership.welcomePts }) }}
                  </span>
                </p>
                <p
                  v-if="supportedArtists.length"
                  class="mt-2 text-sm font-bold text-amber-100/90"
                >
                  {{ $t('profile.membership.supporting') }}
                  {{ supportedArtists.map((row) => row.name).filter(Boolean).join(', ') }}
                </p>
              </div>
            </div>
          </article>

          <p class="text-sm font-bold leading-7 text-slate-300">
            {{ userProfile?.bio || $t('profile.profileSummary') }}
          </p>

          <div class="mt-5 grid grid-cols-1 gap-3">
            <div
              v-for="stat in profileStats"
              :key="stat.label"
              class="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <p class="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                {{ stat.label }}
              </p>
              <p class="mt-1 truncate text-2xl font-black text-white">
                {{ stat.value }}
              </p>
            </div>
          </div>

        </div>
      </div>

      <section class="mt-8 rounded-4xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
              {{ $t('profile.favorites') }}
            </p>
            <h2 class="mt-2 text-2xl font-black text-white">{{ $t('profile.followedArtists') }}</h2>
          </div>
          <a
            :href="routePath('rankingPopularity', locale)"
            class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-200 transition hover:bg-white/10"
          >
            {{ $t('profile.viewPopular') }}
          </a>
        </div>

        <div v-if="favoriteArtists.length" class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <a
            v-for="artist in favoriteArtists"
            :key="artist.id"
            :href="artistUrl(artist)"
            class="relative flex items-center gap-3 rounded-3xl border p-3 transition"
            :class="isMegaSupported(artist)
              ? 'fan-mega-card border-amber-300/70 bg-linear-to-r from-amber-400/20 via-amber-300/10 to-orange-500/20 shadow-lg shadow-amber-500/25 hover:border-amber-200 hover:shadow-amber-400/40'
              : isSupportedArtist(artist)
                ? 'border-amber-300/40 bg-amber-300/10 hover:border-amber-200/60 hover:bg-amber-300/16'
                : 'border-white/10 bg-slate-950/45 hover:bg-white/8'"
          >
            <span
              v-if="isMegaSupported(artist)"
              class="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-linear-to-br from-amber-300 to-orange-500 text-[11px] text-slate-950 shadow-md shadow-amber-700/40"
            >
              <i class="fa-solid fa-crown fa-fw leading-none" aria-hidden="true"></i>
            </span>
            <span
              class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl text-lg font-black"
              :class="isMegaSupported(artist)
                ? 'border-2 border-amber-300 bg-linear-to-br from-amber-300 to-orange-500 text-slate-950 shadow-md shadow-amber-500/40'
                : isSupportedArtist(artist)
                  ? 'border border-amber-300/30 bg-linear-to-br from-amber-400 to-orange-500 text-slate-950'
                  : 'bg-linear-to-br from-violet-500 to-fuchsia-500 text-white'"
            >
              <img
                v-if="artist.artistImage"
                :src="artist.artistImage"
                :alt="artist.artistName"
                class="size-full object-cover"
              />
              <span v-else>{{ artist.artistName?.charAt(0) || 'A' }}</span>
            </span>
            <span class="min-w-0 pr-8">
              <span
                class="block truncate font-black"
                :class="isMegaSupported(artist) ? 'text-amber-100' : isSupportedArtist(artist) ? 'text-amber-50' : 'text-white'"
              >
                {{ artist.artistName || $t('profile.defaultArtist') }}
              </span>
              <span
                class="block text-xs font-black uppercase tracking-wide"
                :class="isMegaSupported(artist) ? 'text-amber-200' : isSupportedArtist(artist) ? 'text-amber-200' : 'text-slate-500'"
              >
                {{ isMegaSupported(artist) ? 'MEGA · ' + $t('profile.supporting') : isSupportedArtist(artist) ? $t('profile.supporting') : $t('profile.following') }}
              </span>
            </span>
          </a>
        </div>

        <div v-else class="mt-5 overflow-hidden rounded-3xl border border-violet-300/15 bg-slate-950/45">
          <div class="relative p-5 sm:p-6">
            <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(217,70,239,0.18),transparent_32%),radial-gradient(circle_at_85%_35%,rgba(34,211,238,0.12),transparent_30%)]"></div>
            <div class="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
                  {{ $t('profile.emptyFollowingEyebrow') }}
                </p>
                <h3 class="mt-2 text-2xl font-black text-white">
                  {{ $t('profile.emptyFollowingTitle') }}
                </h3>
                <p class="mt-2 max-w-2xl text-sm font-bold leading-6 text-slate-400">
                  {{ $t('profile.emptyFollowing') }}
                </p>
              </div>
              <a
                :href="routePath('rankingPopularity', locale)"
                class="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01]"
              >
                {{ $t('profile.viewPopular') }}
              </a>
            </div>

            <div class="relative mt-5 grid gap-3 md:grid-cols-3">
              <a
                v-for="action in emptyFollowingActions"
                :key="action.href"
                :href="action.href"
                class="group overflow-hidden rounded-3xl border border-white/10 bg-[#090b19]/85 transition hover:-translate-y-1 hover:border-fuchsia-300/30"
              >
                <div class="relative h-32 bg-linear-to-br" :class="action.visual">
                  <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.25),transparent_24%),linear-gradient(to_top,rgba(8,10,23,0.95),transparent)]"></div>
                  <span class="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/35 text-3xl text-white shadow-2xl shadow-fuchsia-500/25 backdrop-blur transition group-hover:scale-110">
                    <i :class="action.icon" aria-hidden="true"></i>
                  </span>
                </div>
                <div class="p-4">
                  <h4 class="text-sm font-black uppercase text-white">{{ action.title }}</h4>
                  <p class="mt-2 line-clamp-2 text-xs font-bold leading-5 text-slate-400">{{ action.text }}</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      <Teleport to="body">
        <div
          v-if="isEditOpen"
          class="fixed inset-0 z-90 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
          @click.self="closeEditProfile"
        >
          <article class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-4xl border border-fuchsia-300/20 bg-[#090b19] p-5 text-white shadow-2xl shadow-fuchsia-950/30 sm:p-6">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
                  {{ $t('profile.edit.eyebrow') }}
                </p>
                <h2 class="mt-2 text-3xl font-black">{{ $t('profile.edit.title') }}</h2>
              </div>
              <button
                type="button"
                class="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-xl font-black text-slate-300 transition hover:bg-white/10 hover:text-white"
                :aria-label="$t('common.actions.close')"
                @click="closeEditProfile"
              >
                ×
              </button>
            </div>

            <form class="mt-6 grid gap-5" @submit.prevent="saveProfile">
              <section class="overflow-hidden rounded-4xl border border-white/10 bg-white/5">
                <label class="group relative block min-h-56 cursor-pointer overflow-hidden bg-linear-to-br from-violet-950 via-fuchsia-950 to-slate-950">
                  <img
                    v-if="editForm.banner"
                    :src="editForm.banner"
                    alt=""
                    class="absolute inset-0 size-full object-cover opacity-75 transition duration-300 group-hover:scale-105"
                  />
                  <div class="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(217,70,239,0.35),transparent_32%),linear-gradient(to_top,rgba(9,11,25,0.95),rgba(9,11,25,0.12))]"></div>
                  <span class="absolute right-4 top-4 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-xs font-black uppercase tracking-wide text-white backdrop-blur transition group-hover:bg-fuchsia-500">
                    {{ isUploadingBanner ? $t('profile.edit.uploadingBanner') : 'Subir banner' }}
                  </span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    class="sr-only"
                    :disabled="isUploadingBanner"
                    @change="handleProfileImageInput($event, 'banner')"
                  />
                </label>

                <div class="-mt-14 flex px-5 pb-5">
                  <label class="group relative z-10 grid cursor-pointer gap-3">
                    <span class="grid size-32 place-items-center overflow-hidden rounded-4xl border-4 border-[#090b19] bg-linear-to-br from-violet-500 to-fuchsia-500 text-4xl font-black text-white shadow-2xl shadow-fuchsia-500/25 transition group-hover:scale-105">
                      <img
                        v-if="editForm.photoURL"
                        :src="editForm.photoURL"
                        alt=""
                        class="size-full object-cover"
                      />
                      <span v-else>{{ userInitial }}</span>
                    </span>
                    <span class="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-center text-xs font-black uppercase tracking-wide text-slate-100 transition group-hover:bg-fuchsia-500">
                      {{ isUploadingPhoto ? $t('profile.edit.uploadingPhoto') : 'Subir foto' }}
                    </span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      class="sr-only"
                      :disabled="isUploadingPhoto"
                      @change="handleProfileImageInput($event, 'photoURL')"
                    />
                  </label>

                </div>
              </section>

              <div class="grid gap-4 sm:grid-cols-2">
                <label class="block">
                  <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('profile.edit.name') }}</span>
                  <input
                    v-model="editForm.name"
                    type="text"
                    class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/40"
                  />
                </label>

                <label class="block">
                  <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Username</span>
                  <input
                    v-model="editForm.username"
                    type="text"
                    class="mt-2 min-h-12 w-full rounded-2xl border bg-white/5 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/40"
                    :class="usernameStatus && !usernameStatus.available ? 'border-red-300/40' : usernameStatus?.available ? 'border-emerald-300/40' : 'border-white/10'"
                    placeholder="mi_username"
                  />
                  <p
                    v-if="isCheckingUsername || usernameStatus"
                    class="mt-2 text-xs font-black"
                    :class="usernameStatus?.available ? 'text-emerald-300' : 'text-amber-200'"
                  >
                    {{ isCheckingUsername ? $t('profile.edit.checkingUsername') : usernameStatus.message }}
                  </p>
                </label>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <label class="block">
                  <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('profile.edit.country') }}</span>
                  <input
                    v-model="editForm.country"
                    type="text"
                    class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/40"
                  />
                </label>
              </div>

              <label class="block">
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('profile.edit.bio') }}</span>
                <textarea
                  v-model="editForm.bio"
                  rows="4"
                  class="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/40"
                  :placeholder="$t('profile.profileSummary')"
                ></textarea>
              </label>

              <div class="rounded-3xl border border-violet-300/20 bg-violet-400/10 p-4">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span class="text-xs font-bold uppercase tracking-widest text-violet-200">
                      {{ $t('profile.edit.language') }}
                    </span>
                    <p class="mt-1 text-sm leading-6 text-slate-300">
                      {{ $t('profile.edit.languageHelp') }}
                    </p>
                  </div>
                  <select
                    v-model="editForm.locale"
                    class="min-h-11 rounded-2xl border border-white/15 bg-[#12081f] px-3 text-sm font-black text-white outline-none"
                  >
                    <option value="en">{{ $t('profile.edit.languageEnglish') }}</option>
                    <option value="es">{{ $t('profile.edit.languageSpanish') }}</option>
                  </select>
                </div>
              </div>

              <div class="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span class="text-xs font-bold uppercase tracking-widest text-cyan-200">
                      {{ $t('profile.edit.emailCampaigns') }}
                    </span>
                    <p class="mt-1 text-sm leading-6 text-slate-300">
                      {{ $t('profile.edit.emailCampaignsHelp') }}
                    </p>
                  </div>
                  <label class="inline-flex items-center gap-3 text-sm font-black text-cyan-100">
                    <input
                      v-model="editForm.emailCampaigns"
                      type="checkbox"
                      class="size-5 accent-cyan-400"
                    />
                    {{ $t('profile.edit.emailCampaignsEnabled') }}
                  </label>
                </div>
              </div>

              <p
                v-if="errorMessage"
                class="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
              >
                {{ errorMessage }}
              </p>

              <div class="grid gap-3 sm:grid-cols-2">
                <button
                  type="submit"
                  class="min-h-12 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isSavingProfile || isUploadingPhoto || isUploadingBanner || isUsernameBlocked"
                >
                  {{ isSavingProfile ? $t('profile.edit.saving') : $t('profile.edit.save') }}
                </button>
                <button
                  type="button"
                  class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
                  @click="closeEditProfile"
                >
                  {{ $t('common.actions.cancel') }}
                </button>
              </div>
            </form>
          </article>
        </div>
      </Teleport>

      <ReportModal
        v-if="canReportProfile"
        :open="isReportModalOpen"
        target-type="user_profile"
        :target-id="profileUserId || routeUsername"
        :reported-user-id="profileUserId"
        :context-label="`@${userProfile?.username || routeUsername}`"
        @close="closeReportProfile"
      />
    </template>
  </section>
</template>

<style scoped>
.fan-tier-card {
  animation: fan-tier-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.fan-tier-glow {
  animation: fan-tier-orb 6s ease-in-out infinite;
}

.fan-tier-glow--slow {
  animation-duration: 8.5s;
  animation-direction: reverse;
}

.fan-tier-shine {
  background: linear-gradient(110deg, transparent 20%, rgba(255, 255, 255, 0.12) 48%, transparent 72%);
  background-size: 180% 100%;
  animation: fan-tier-shine 4.2s ease-in-out infinite;
}

.fan-tier-days {
  animation: fan-tier-pop 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.fan-tier-copy {
  animation: fan-tier-slide 0.75s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
}

.fan-tier-title {
  animation: fan-tier-pulse 2.8s ease-in-out infinite;
}

.fan-mega-card {
  animation: fan-mega-glow 2.6s ease-in-out infinite;
}

.profile-mega-shell {
  box-shadow: 0 0 0 1px rgba(245, 197, 24, 0.12), 0 16px 40px rgba(245, 197, 24, 0.12);
  animation: champ-mega-wash 2.8s ease-in-out infinite;
}

.profile-mega-hero {
  background:
    radial-gradient(500px 160px at 0% 0%, rgba(245, 197, 24, 0.22), transparent 50%),
    linear-gradient(90deg, #2a1c08 0%, #1a1428 55%);
}

.profile-mega-avatar {
  animation: champ-mega-ring 2.2s ease-in-out infinite;
}

.profile-mega-name {
  text-shadow: 0 0 18px rgba(245, 197, 24, 0.45);
  animation: champ-mega-name 2.6s ease-in-out infinite;
}

.profile-mega-badge {
  animation: champ-mega-badge 2.4s ease-in-out infinite;
}

.profile-mega-hero::after {
  position: absolute;
  right: -40px;
  top: -40px;
  width: 220px;
  height: 220px;
  pointer-events: none;
  background: radial-gradient(circle, rgba(245, 197, 24, 0.22), transparent 70%);
  content: "";
  animation: fan-tier-orb 6s ease-in-out infinite;
}

@keyframes fan-tier-in {
  from { opacity: 0; transform: translateY(14px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes fan-tier-orb {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.35; }
  50% { transform: translate(-18px, 12px) scale(1.18); opacity: 0.55; }
}

@keyframes fan-tier-shine {
  0% { background-position: 120% 0; }
  100% { background-position: -40% 0; }
}

@keyframes fan-tier-pop {
  from { opacity: 0; transform: scale(0.82); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes fan-tier-slide {
  from { opacity: 0; transform: translateX(16px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes fan-tier-pulse {
  0%, 100% { filter: drop-shadow(0 0 0 currentColor); }
  50% { filter: drop-shadow(0 0 12px currentColor); }
}

@keyframes fan-mega-glow {
  0%, 100% { box-shadow: 0 10px 28px rgba(245, 158, 11, 0.18); }
  50% { box-shadow: 0 12px 36px rgba(251, 191, 36, 0.42); }
}

@keyframes champ-mega-wash {
  0%, 100% {
    box-shadow: 0 0 0 1px rgba(245, 197, 24, 0.12), 0 16px 40px rgba(245, 197, 24, 0.12);
  }
  50% {
    box-shadow: 0 0 0 1px rgba(245, 197, 24, 0.28), 0 18px 52px rgba(245, 197, 24, 0.28);
  }
}

@keyframes champ-mega-ring {
  0%, 100% {
    box-shadow: 0 0 0 4px rgba(245, 197, 24, 0.15), 0 0 18px rgba(245, 197, 24, 0.28);
  }
  50% {
    box-shadow: 0 0 0 7px rgba(245, 197, 24, 0.3), 0 0 34px rgba(245, 197, 24, 0.55);
  }
}

@keyframes champ-mega-name {
  0%, 100% { text-shadow: 0 0 12px rgba(245, 197, 24, 0.28); }
  50% { text-shadow: 0 0 26px rgba(245, 197, 24, 0.7); }
}

@keyframes champ-mega-badge {
  0%, 100% { box-shadow: 0 0 0 rgba(245, 197, 24, 0); transform: translateY(0); }
  50% { box-shadow: 0 8px 22px rgba(245, 197, 24, 0.35); transform: translateY(-1px); }
}

@media (prefers-reduced-motion: reduce) {
  .fan-tier-card,
  .fan-tier-glow,
  .fan-tier-shine,
  .fan-tier-days,
  .fan-tier-copy,
  .fan-tier-title,
  .fan-mega-card,
  .profile-mega-shell,
  .profile-mega-avatar,
  .profile-mega-name,
  .profile-mega-badge,
  .profile-mega-hero::after,
  .profile-loading-shimmer,
  .profile-loading-orb,
  .profile-loading-label {
    animation: none;
  }
}

.profile-loading-shimmer {
  background:
    linear-gradient(110deg, transparent 0%, rgba(255, 255, 255, 0.08) 45%, transparent 70%),
    radial-gradient(circle at 25% 20%, rgba(217, 70, 239, 0.22), transparent 32%),
    radial-gradient(circle at 80% 15%, rgba(34, 211, 238, 0.14), transparent 28%);
  animation: profile-loading-shimmer 1.6s ease-in-out infinite;
}

.profile-loading-orb {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, #c026d3, #22d3ee);
  box-shadow: 0 0 12px rgba(217, 70, 239, 0.55);
  animation: profile-loading-orb 0.9s ease-in-out infinite;
}

.profile-loading-label::after {
  content: "";
  animation: profile-loading-dots 1.2s steps(4, end) infinite;
}

@keyframes profile-loading-shimmer {
  0% { opacity: 0.45; transform: translateX(-12%); }
  50% { opacity: 1; }
  100% { opacity: 0.45; transform: translateX(12%); }
}

@keyframes profile-loading-orb {
  0%, 100% { transform: scale(0.85); opacity: 0.55; }
  50% { transform: scale(1.15); opacity: 1; }
}

@keyframes profile-loading-dots {
  0% { content: ""; }
  25% { content: "."; }
  50% { content: ".."; }
  75% { content: "..."; }
}
</style>
