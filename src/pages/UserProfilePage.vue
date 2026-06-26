<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onAuthStateChanged, updateProfile } from 'firebase/auth'
import { collection, doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { translate } from '../i18n'
import { auth, db, storage } from '../firebase'

const pathParts = window.location.pathname.split('/').filter(Boolean)
const routeUsername = pathParts[0] === 'user' ? (pathParts[1] || '').toLowerCase() : ''

const currentUser = ref(null)
const userProfile = ref(null)
const profileUserId = ref('')
const followedArtists = ref([])
const editForm = ref({
  name: '',
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
const errorMessage = ref('')
const successMessage = ref('')
let unsubscribeAuth = null
let unsubscribeUser = null
let unsubscribeFollowedArtists = null

const isPublicProfile = computed(() => Boolean(routeUsername))
const isOwnProfile = computed(() => currentUser.value?.uid && currentUser.value.uid === profileUserId.value)
const todayKey = computed(() => new Date().toISOString().slice(0, 10))
const hasClaimedDailyReward = computed(() => userProfile.value?.lastDailyRewardClaimDate === todayKey.value)

const displayName = computed(() =>
  userProfile.value?.name || (!isPublicProfile.value ? currentUser.value?.displayName || currentUser.value?.email : '') || translate('profile.fallbackName'),
)

const profilePhoto = computed(() =>
  userProfile.value?.photoURL || (!isPublicProfile.value || isOwnProfile.value ? currentUser.value?.photoURL : '') || '',
)
const profileBanner = computed(() => userProfile.value?.banner || userProfile.value?.bannerUrl || '')
const userInitial = computed(() => displayName.value.trim().charAt(0).toUpperCase())
const profileStats = computed(() => [
  {
    label: translate('profile.followedArtists'),
    value: followedArtists.value.length.toLocaleString(),
  },
])

const artistUrl = (artist) => `/artista/${artist.artistSlug || artist.artistId}`

const openDailyRewardModal = () => {
  window.dispatchEvent(new CustomEvent('open-daily-reward-modal'))
}

const sanitizeFileName = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/(^-|-$)/g, '')

const isAcceptedImageFile = (file) => {
  const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']
  const acceptedExtensions = ['.jpg', '.jpeg', '.png', '.webp']
  const fileName = file.name.toLowerCase()

  return acceptedTypes.includes(file.type)
    || acceptedExtensions.some((extension) => fileName.endsWith(extension))
}

const getImageContentType = (file) => {
  const fileName = file.name.toLowerCase()

  if (file.type) {
    return file.type
  }

  if (fileName.endsWith('.webp')) {
    return 'image/webp'
  }

  if (fileName.endsWith('.png')) {
    return 'image/png'
  }

  return 'image/jpeg'
}

const openEditProfile = () => {
  editForm.value = {
    name: displayName.value,
    country: userProfile.value?.country || '',
    bio: userProfile.value?.bio || '',
    photoURL: profilePhoto.value,
    banner: profileBanner.value,
  }
  errorMessage.value = ''
  successMessage.value = ''
  isEditOpen.value = true
}

const closeEditProfile = () => {
  isEditOpen.value = false
}

const uploadProfileImage = async (file, field) => {
  if (!file || !currentUser.value?.uid) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  if (!isAcceptedImageFile(file)) {
    errorMessage.value = translate('profile.edit.imageTypeError')
    return
  }

  const isBanner = field === 'banner'
  const fileName = sanitizeFileName(file.name)
  const imageRef = storageRef(storage, `users/${currentUser.value.uid}/${Date.now()}-${field}-${fileName}`)

  if (isBanner) {
    isUploadingBanner.value = true
  } else {
    isUploadingPhoto.value = true
  }

  try {
    await uploadBytes(imageRef, file, { contentType: getImageContentType(file) })
    editForm.value[field] = await getDownloadURL(imageRef)
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
  if (!currentUser.value?.uid || !isOwnProfile.value) {
    return
  }

  const nextName = editForm.value.name.trim()

  if (!nextName) {
    errorMessage.value = translate('profile.edit.nameRequired')
    return
  }

  errorMessage.value = ''
  successMessage.value = ''
  isSavingProfile.value = true

  try {
    await updateDoc(doc(db, 'users', currentUser.value.uid), {
      name: nextName,
      firstName: nextName.split(' ')[0] || nextName,
      country: editForm.value.country.trim(),
      bio: editForm.value.bio.trim(),
      photoURL: editForm.value.photoURL,
      banner: editForm.value.banner,
      updatedAt: serverTimestamp(),
    })
    await updateProfile(currentUser.value, {
      displayName: nextName,
      photoURL: editForm.value.photoURL || null,
    })
    successMessage.value = translate('profile.edit.saved')
    isEditOpen.value = false
  } catch {
    errorMessage.value = translate('profile.edit.saveError')
  } finally {
    isSavingProfile.value = false
  }
}

const listenUserProfileById = (userId, errorText = translate('profile.loadError')) => {
  unsubscribeUser?.()
  unsubscribeFollowedArtists?.()
  profileUserId.value = userId || ''

  if (!userId) {
    userProfile.value = null
    followedArtists.value = []
    isLoading.value = false
    return
  }

  unsubscribeUser = onSnapshot(
    doc(db, 'users', userId),
    (userSnap) => {
      userProfile.value = userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null
      isLoading.value = false
    },
    () => {
      errorMessage.value = errorText
      isLoading.value = false
    },
  )

  unsubscribeFollowedArtists = onSnapshot(
    collection(db, 'users', userId, 'followingArtists'),
    (artistsSnap) => {
      followedArtists.value = artistsSnap.docs.map((artistDoc) => ({
        id: artistDoc.id,
        ...artistDoc.data(),
      }))
    },
  )
}

const loadPublicProfile = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const usernameSnap = await getDoc(doc(db, 'usernames', routeUsername))

    if (!usernameSnap.exists()) {
      errorMessage.value = translate('profile.notFound')
      userProfile.value = null
      followedArtists.value = []
      isLoading.value = false
      return
    }

    listenUserProfileById(usernameSnap.data().uid, translate('profile.unavailable'))
  } catch {
    errorMessage.value = translate('profile.userLoadError')
    isLoading.value = false
  }
}

onMounted(() => {
  unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    currentUser.value = user

    if (isPublicProfile.value) {
      return
    }

    listenUserProfileById(user?.uid, translate('profile.ownLoadError'))
  })

  if (isPublicProfile.value) {
    loadPublicProfile()
  }
})

onUnmounted(() => {
  unsubscribeAuth?.()
  unsubscribeUser?.()
  unsubscribeFollowedArtists?.()
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
              <div class="grid gap-4 lg:grid-cols-[0.8fr_1fr]">
                <label
                  class="group relative grid min-h-48 cursor-pointer place-items-center overflow-hidden rounded-3xl border border-dashed border-fuchsia-300/35 bg-fuchsia-400/10 text-center"
                >
                  <img
                    v-if="editForm.banner"
                    :src="editForm.banner"
                    alt=""
                    class="absolute inset-0 size-full object-cover opacity-70"
                  />
                  <span class="relative z-10 rounded-2xl bg-black/45 px-4 py-3 text-xs font-black uppercase tracking-wide text-white backdrop-blur">
                    {{ isUploadingBanner ? $t('profile.edit.uploadingBanner') : $t('profile.edit.changeBanner') }}
                  </span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    class="sr-only"
                    :disabled="isUploadingBanner"
                    @change="handleProfileImageInput($event, 'banner')"
                  />
                </label>

                <div class="grid gap-4">
                  <label class="mx-auto grid cursor-pointer gap-3 text-center">
                    <span class="mx-auto grid size-32 place-items-center overflow-hidden rounded-4xl border-2 border-fuchsia-300/40 bg-linear-to-br from-violet-500 to-fuchsia-500 text-4xl font-black text-white shadow-xl shadow-fuchsia-500/20">
                      <img
                        v-if="editForm.photoURL"
                        :src="editForm.photoURL"
                        alt=""
                        class="size-full object-cover"
                      />
                      <span v-else>{{ userInitial }}</span>
                    </span>
                    <span class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10">
                      {{ isUploadingPhoto ? $t('profile.edit.uploadingPhoto') : $t('profile.edit.changePhoto') }}
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
              </div>

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
                  :disabled="isSavingProfile || isUploadingPhoto || isUploadingBanner"
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
