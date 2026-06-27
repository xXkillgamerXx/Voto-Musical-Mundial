<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { translate } from '../i18n'
import { checkUsername, getCurrentApiAuth, getMe, getPublicProfile, updateMe, uploadProfileImage as uploadProfileImageFile } from '../services/api/authApi'
import { onStoredAuthChange } from '../services/api/client'

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
let unsubscribeAuth = null
let usernameCheckTimer = null

const isPublicProfile = computed(() => Boolean(routeUsername))
const isOwnProfile = computed(() => currentUser.value?.id && String(currentUser.value.id) === String(profileUserId.value))
const todayKey = computed(() => new Date().toISOString().slice(0, 10))
const hasClaimedDailyReward = computed(() => userProfile.value?.lastDailyRewardClaimDate === todayKey.value)

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
const isUsernameBlocked = computed(() => {
  const username = editForm.value.username.trim().toLowerCase()
  const currentUsername = (userProfile.value?.username || currentUser.value?.username || '').toLowerCase()

  if (!username) return false
  if (username === currentUsername) return false
  return isCheckingUsername.value || !usernameStatus.value?.valid || !usernameStatus.value?.available
})

const artistUrl = (artist) => `/artista/${artist.artistSlug || artist.artistId}`

const openDailyRewardModal = () => {
  window.dispatchEvent(new CustomEvent('open-daily-reward-modal'))
}

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
    })
    currentUser.value = updated
    userProfile.value = updated
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
  }
  unsubscribeAuth = onStoredAuthChange(syncAuth)
  syncAuth()

  if (isPublicProfile.value) {
    loadPublicProfile()
  }
})

onUnmounted(() => {
  unsubscribeAuth?.()
  window.clearTimeout(usernameCheckTimer)
})
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-8 sm:px-6 lg:py-12">
    <div
      v-if="isLoading"
      class="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm font-bold text-slate-300"
    >
      {{ $t('profile.loading') }}
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

      <div class="overflow-hidden rounded-3xl border border-violet-300/15 bg-[#090b19]/90 shadow-2xl shadow-fuchsia-950/20">
        <div class="relative min-h-72 bg-linear-to-br from-blue-950 via-violet-950 to-fuchsia-950">
          <img
            v-if="profileBanner"
            :src="profileBanner"
            :alt="displayName"
            class="absolute inset-0 size-full object-cover opacity-55"
          />
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(217,70,239,0.28),transparent_30%),radial-gradient(circle_at_78%_35%,rgba(34,211,238,0.2),transparent_28%)]"></div>
          <div class="absolute inset-0 bg-linear-to-t from-[#090b19] via-[#090b19]/30 to-transparent"></div>
          <div class="absolute inset-x-0 bottom-0 p-6 sm:p-8">
            <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div class="flex items-end gap-4">
                <span class="grid size-28 shrink-0 place-items-center overflow-hidden rounded-3xl border-2 border-fuchsia-300/40 bg-linear-to-br from-violet-500 to-fuchsia-500 text-4xl font-black text-white shadow-xl shadow-fuchsia-500/20 sm:size-36">
                  <img
                    v-if="profilePhoto"
                    :src="profilePhoto"
                    alt=""
                    class="size-full object-cover"
                    referrerpolicy="no-referrer"
                  />
                  <span v-else>{{ userInitial }}</span>
                </span>
                <div>
                  <p class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
                    {{ $t('profile.publicTitle') }}
                  </p>
                  <h1 class="mt-2 text-4xl font-black leading-none text-white sm:text-6xl">
                    {{ displayName }}
                  </h1>
                  <p class="mt-2 text-lg font-black text-amber-300">
                    @{{ userProfile?.username || $t('profile.fallbackUsername') }}
                  </p>
                </div>
              </div>
              <button
                v-if="isOwnProfile"
                type="button"
                class="rounded-full bg-linear-to-r from-pink-500 to-fuchsia-600 px-7 py-3 text-sm font-black uppercase text-white shadow-lg shadow-fuchsia-500/30 transition hover:scale-105"
                @click="openEditProfile"
              >
                {{ $t('profile.edit.open') }}
              </button>
            </div>
          </div>
        </div>

        <div class="p-5 lg:p-8">
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
            href="/artistas"
            class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-200 transition hover:bg-white/10"
          >
            {{ $t('profile.viewPopular') }}
          </a>
        </div>

        <div v-if="followedArtists.length" class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <a
            v-for="artist in followedArtists"
            :key="artist.id"
            :href="artistUrl(artist)"
            class="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-950/45 p-3 transition hover:bg-white/8"
          >
            <span class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-lg font-black text-white">
              <img
                v-if="artist.artistImage"
                :src="artist.artistImage"
                :alt="artist.artistName"
                class="size-full object-cover"
              />
              <span v-else>{{ artist.artistName?.charAt(0) || 'A' }}</span>
            </span>
            <span class="min-w-0">
              <span class="block truncate font-black text-white">{{ artist.artistName || $t('profile.defaultArtist') }}</span>
              <span class="block text-xs font-bold text-slate-500">{{ $t('profile.following') }}</span>
            </span>
          </a>
        </div>

        <p v-else class="mt-5 rounded-3xl border border-white/10 bg-slate-950/45 p-6 text-sm font-bold text-slate-400">
          {{ $t('profile.emptyFollowing') }}
        </p>
      </section>

      <section
        v-if="isOwnProfile"
        class="mt-8 overflow-hidden rounded-4xl border border-amber-300/20 bg-amber-300/8 p-5 shadow-2xl shadow-amber-950/10 sm:p-6"
      >
        <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex items-start gap-4">
            <span class="grid size-14 shrink-0 place-items-center rounded-3xl border border-amber-200/30 bg-linear-to-br from-amber-200 via-fuchsia-300 to-violet-500 text-2xl font-black text-slate-950 shadow-lg shadow-fuchsia-950/20">
              ✦
            </span>
            <div>
              <p class="text-xs font-black uppercase tracking-[0.28em] text-amber-200">
                {{ $t('rewards.dailyReward') }}
              </p>
              <h2 class="mt-2 text-2xl font-black text-white">{{ $t('rewards.profileCardTitle') }}</h2>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                {{ $t('rewards.profileCardDescription') }}
              </p>
            </div>
          </div>

          <div class="grid gap-3 sm:min-w-64">
            <span
              class="rounded-2xl border px-4 py-3 text-center text-sm font-black"
              :class="hasClaimedDailyReward ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100' : 'border-fuchsia-300/25 bg-fuchsia-400/10 text-fuchsia-100'"
            >
              {{ hasClaimedDailyReward ? $t('rewards.profileCardClaimed') : $t('rewards.profileCardReady') }}
            </span>
            <button
              type="button"
              class="min-h-12 rounded-2xl bg-linear-to-r from-amber-300 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-fuchsia-950/20 transition hover:scale-[1.01]"
              @click="openDailyRewardModal"
            >
              {{ $t('rewards.openReward') }}
            </button>
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
                    {{ isCheckingUsername ? 'Verificando username...' : usernameStatus.message }}
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
    </template>
  </section>
</template>
