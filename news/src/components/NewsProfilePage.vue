<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  checkUsername,
  getCurrentApiAuth,
  getMe,
  getPublicProfile,
  updateMe,
  uploadProfileImage,
} from '../../../src/services/api/authApi'
import { onStoredAuthChange } from '../../../src/services/api/client'
import { loadFanMe } from '../../../src/utils/fanPerks'
import {
  getMySupportedArtists,
  hydrateMembership,
  isMegaFanIdentity,
} from '../../../src/utils/fanMembership'
import { publicMediaUrl } from '../../../src/utils/publicMediaUrl'
import { countriesFor, countryCode, countryFlag, countryLabel } from '../lib/countries'
import { t } from '../lib/copy'
import { withLocale } from '../lib/locale'

type FollowedArtist = {
  id?: string
  artistId?: string
  artistSlug?: string
  artistSlugEn?: string
  artistName?: string
  artistImage?: string
  name?: string
  image?: string
}

type Person = {
  id?: string
  username?: string
  displayName?: string
  name?: string
  email?: string
  photoUrl?: string
  photoURL?: string
  banner?: string
  bannerUrl?: string
  country?: string
  bio?: string
  locale?: string
  points?: number
  emailCampaigns?: boolean
  followedArtists?: FollowedArtist[]
  fanMembership?: Record<string, unknown> | null
} | null

const props = defineProps<{ locale?: string; username?: string; edit?: boolean }>()

const loc = computed(() => (props.locale === 'en' ? 'en' : 'es'))
const homeHref = computed(() => withLocale('/', loc.value))
const profilePath = computed(() => withLocale(loc.value === 'en' ? '/profile' : '/perfil', loc.value))
const editPath = computed(() => withLocale(loc.value === 'en' ? '/profile/edit' : '/perfil/editar', loc.value))
const isPublic = computed(() => Boolean(props.username))
const isEdit = computed(() => Boolean(props.edit) && !isPublic.value)

const loading = ref(true)
const currentUser = ref<Person>(null)
const person = ref<Person>(null)
const followedArtists = ref<FollowedArtist[]>([])
const fanMembership = ref<ReturnType<typeof hydrateMembership>>(null)
const errorMessage = ref('')
const successMessage = ref('')
const saving = ref(false)
const uploadingPhoto = ref(false)
const uploadingBanner = ref(false)
const checkingUsername = ref(false)
const usernameStatus = ref<{ valid?: boolean; available?: boolean; message?: string } | null>(null)
const photoFailed = ref(false)
let stopAuth: (() => void) | null = null
let usernameTimer: ReturnType<typeof setTimeout> | null = null

const form = ref({
  name: '',
  username: '',
  country: '',
  bio: '',
  photoURL: '',
  banner: '',
})

const isOwn = computed(() => {
  const mine = String(currentUser.value?.username || '').trim().toLowerCase()
  const id = String(currentUser.value?.id || '')
  if (id && person.value?.id && id === String(person.value.id)) return true
  if (props.username && mine && mine === props.username) return true
  return !isPublic.value && Boolean(currentUser.value)
})

const displayName = computed(() => {
  const fromPerson = person.value?.name || person.value?.displayName
  if (fromPerson) return fromPerson
  if (!isPublic.value || isOwn.value) {
    return currentUser.value?.displayName || currentUser.value?.name || currentUser.value?.email || ''
  }
  return ''
})

const handle = computed(() => person.value?.username || (!isPublic.value || isOwn.value ? currentUser.value?.username : '') || '')

const photo = computed(() => {
  const fromPerson = person.value?.photoURL || person.value?.photoUrl
  if (fromPerson) return publicMediaUrl(fromPerson)
  if (!isPublic.value || isOwn.value) {
    return publicMediaUrl(currentUser.value?.photoUrl || currentUser.value?.photoURL || '')
  }
  return ''
})

const banner = computed(() =>
  publicMediaUrl(person.value?.banner || person.value?.bannerUrl || ''),
)
const countryName = computed(() => countryLabel(person.value?.country, loc.value))
const countryMark = computed(() => countryFlag(person.value?.country))
const countryOptions = computed(() => countriesFor(loc.value))
const selectedFlag = computed(() => countryFlag(form.value.country))
const initial = computed(() => String(displayName.value || handle.value || 'M').trim().charAt(0).toUpperCase() || 'M')
const usernameBlocked = computed(() => {
  const next = form.value.username.trim().toLowerCase()
  const current = String(person.value?.username || currentUser.value?.username || '').toLowerCase()
  if (!next || next === current) return false
  return checkingUsername.value || !usernameStatus.value?.valid || !usernameStatus.value?.available
})

const isMegaFan = computed(() =>
  Boolean(
    (fanMembership.value &&
      !fanMembership.value.expired &&
      (fanMembership.value.sku === 'MEGA' || fanMembership.value.mega)) ||
      isMegaFanIdentity(person.value),
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

const membershipLabel = computed(() => {
  if (!fanMembership.value || fanMembership.value.expired) return ''
  return String(fanMembership.value.name || fanMembership.value.sku || '')
})

const membershipDaysLabel = computed(() => {
  const days = Number(fanMembership.value?.daysLeft || 0)
  if (loc.value === 'en') return days === 1 ? '1 day left' : `${days} days left`
  return days === 1 ? '1 día restante' : `${days} días restantes`
})

const artistMatchId = (artist: FollowedArtist) => String(artist?.artistId || artist?.id || '')
const artistMatchName = (artist: FollowedArtist) =>
  String(artist?.artistName || artist?.name || '')
    .trim()
    .toLowerCase()

const isSameArtist = (artist: FollowedArtist, supported: { id?: string; artistId?: string; name?: string; artistName?: string }) => {
  const artistId = artistMatchId(artist)
  const artistName = artistMatchName(artist)
  const id = String(supported?.id || supported?.artistId || '')
  const name = String(supported?.name || supported?.artistName || '')
    .trim()
    .toLowerCase()
  return (artistId && id && artistId === id) || (artistName && name && artistName === name)
}

const supportedArtists = computed(() => {
  if (fanMembership.value?.expired) return []
  const fromPlan = (fanMembership.value?.artists as FollowedArtist[] | undefined) || []
  if (fromPlan.length) return fromPlan
  return getMySupportedArtists(person.value || currentUser.value).map((row: FollowedArtist) => {
    const followed = followedArtists.value.find((artist) => isSameArtist(artist, row))
    return {
      ...row,
      name: row.name || followed?.artistName || followed?.name || '',
      image: row.image || followed?.artistImage || '',
    }
  })
})

const favoriteArtists = computed(() => {
  const followed = followedArtists.value || []
  const extras = supportedArtists.value
    .filter((row) => !followed.some((artist) => isSameArtist(artist, row)))
    .map((row) => ({
      id: `support-${row.id || row.artistId}`,
      artistId: row.id || row.artistId,
      artistName: row.name || row.artistName,
      artistImage: row.image || row.artistImage,
      artistSlug: row.artistSlug,
      artistSlugEn: row.artistSlugEn,
    }))
  return [...followed, ...extras]
})

const voteProfileHref = computed(() => {
  const username = handle.value
  if (username) return `/vote/user/${encodeURIComponent(username)}`
  return loc.value === 'en' ? '/vote/profile' : '/vote/perfil'
})

const txt = (key: Parameters<typeof t>[1]) => t(loc.value, key)

const voteArtistHref = (artist: FollowedArtist) => {
  const slug =
    loc.value === 'en'
      ? artist.artistSlugEn || artist.artistSlug || artist.artistId || ''
      : artist.artistSlug || artist.artistId || ''
  if (!slug) return '/vote/'
  const prefix = loc.value === 'en' ? 'artist' : 'artista'
  return `/vote/${prefix}/${encodeURIComponent(String(slug))}`
}

const artistTitle = (artist: FollowedArtist) => artist.artistName || artist.name || 'Artist'
const artistImage = (artist: FollowedArtist) =>
  publicMediaUrl(artist.artistImage || artist.image || '')
const isSupportedArtist = (artist: FollowedArtist) => supportedArtists.value.some((row) => isSameArtist(artist, row))

const acceptedImage = (file: File) => {
  const types = ['image/jpeg', 'image/png', 'image/webp']
  const name = file.name.toLowerCase()
  return types.includes(file.type) || ['.jpg', '.jpeg', '.png', '.webp'].some((ext) => name.endsWith(ext))
}

const openLogin = () => {
  window.location.hash = 'login'
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

const fillForm = () => {
  form.value = {
    name: displayName.value,
    username: handle.value,
    country: countryCode(person.value?.country),
    bio: person.value?.bio || '',
    photoURL: publicMediaUrl(photo.value),
    banner: publicMediaUrl(banner.value),
  }
  usernameStatus.value = null
  errorMessage.value = ''
  successMessage.value = ''
}

const applyProfile = (profile: Person) => {
  person.value = profile
  followedArtists.value = Array.isArray(profile?.followedArtists) ? profile.followedArtists : []
  photoFailed.value = false
}

const loadFanMembership = async () => {
  if (isPublic.value) {
    const fromProfile = hydrateMembership(person.value?.fanMembership)
    fanMembership.value = fromProfile && !fromProfile.expired ? fromProfile : null
    return
  }
  if (!isOwn.value) return
  try {
    const payload = await loadFanMe()
    fanMembership.value = hydrateMembership(payload.membership)
  } catch {
    fanMembership.value = hydrateMembership(person.value?.fanMembership)
  }
}

const loadOwn = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const me = await getMe()
    currentUser.value = me
    applyProfile(me)
    await loadFanMembership()
  } catch {
    errorMessage.value = txt('profileLoadError')
    applyProfile(null)
    fanMembership.value = null
  } finally {
    loading.value = false
  }
}

const loadPublic = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    applyProfile(await getPublicProfile(props.username))
    await loadFanMembership()
  } catch {
    errorMessage.value = txt('profileMissing')
    applyProfile(null)
    fanMembership.value = null
  } finally {
    loading.value = false
  }
}

const refresh = async () => {
  const auth = getCurrentApiAuth()
  currentUser.value = auth?.user && !auth.user.isAnonymous ? auth.user : null
  if (isPublic.value) {
    await loadPublic()
    return
  }
  if (!auth?.accessToken) {
    person.value = null
    followedArtists.value = []
    fanMembership.value = null
    loading.value = false
    return
  }
  await loadOwn()
}

const upload = async (file: File | undefined, field: 'photoURL' | 'banner') => {
  if (!file) return
  errorMessage.value = ''
  if (!acceptedImage(file)) {
    errorMessage.value = txt('profileImageType')
    return
  }
  if (field === 'banner') uploadingBanner.value = true
  else uploadingPhoto.value = true
  try {
    const uploaded = await uploadProfileImage(file)
    form.value[field] = uploaded.url
  } catch {
    errorMessage.value = txt('profileUploadError')
  } finally {
    uploadingPhoto.value = false
    uploadingBanner.value = false
  }
}

const save = async () => {
  const name = form.value.name.trim()
  const username = form.value.username.trim().toLowerCase()
  if (!name) {
    errorMessage.value = txt('profileNameRequired')
    return
  }
  if (usernameBlocked.value) {
    errorMessage.value = usernameStatus.value?.message || txt('profileUsernameHint')
    return
  }
  errorMessage.value = ''
  saving.value = true
  try {
    const updated = await updateMe({
      name,
      displayName: name,
      username,
      // Same stored shape as vote: keep ISO code when possible so both UIs stay in sync.
      country: form.value.country.trim() || countryCode(person.value?.country),
      bio: form.value.bio.trim(),
      photoURL: form.value.photoURL,
      banner: form.value.banner,
      locale: person.value?.locale === 'es' || loc.value === 'es' ? 'es' : 'en',
      emailCampaigns: person.value?.emailCampaigns !== false,
    })
    currentUser.value = updated
    applyProfile(updated)
    await loadFanMembership()
    window.location.href = profilePath.value
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : txt('profileSaveError')
  } finally {
    saving.value = false
  }
}

watch(
  () => form.value.username,
  (value) => {
    if (!isEdit.value) return
    if (usernameTimer) clearTimeout(usernameTimer)
    const username = value.trim().toLowerCase()
    const current = String(person.value?.username || currentUser.value?.username || '').toLowerCase()
    usernameStatus.value = null
    if (!username || username === current) {
      checkingUsername.value = false
      return
    }
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      checkingUsername.value = false
      usernameStatus.value = { valid: false, available: false, message: txt('profileUsernameHint') }
      return
    }
    checkingUsername.value = true
    usernameTimer = setTimeout(async () => {
      try {
        usernameStatus.value = await checkUsername(username)
      } catch {
        usernameStatus.value = { valid: false, available: false, message: txt('profileUsernameHint') }
      } finally {
        checkingUsername.value = false
      }
    }, 350)
  },
)

watch(
  () => [props.locale, props.username, props.edit] as const,
  () => {
    refresh()
  },
)

watch([person, isEdit], () => {
  if (isEdit.value && person.value) fillForm()
})

onMounted(() => {
  if (window.location.hash.replace('#', '').toLowerCase() === 'editar') {
    window.location.replace(editPath.value)
    return
  }
  document.title = `${txt(isEdit.value ? 'profileEdit' : isPublic.value ? 'profilePublicTitle' : 'profileTitle')} — Music Mundial`
  refresh()
  stopAuth = onStoredAuthChange(() => refresh())
  window.addEventListener('vmm-fan-membership-changed', loadFanMembership as EventListener)
})

onUnmounted(() => {
  stopAuth?.()
  if (usernameTimer) clearTimeout(usernameTimer)
  window.removeEventListener('vmm-fan-membership-changed', loadFanMembership as EventListener)
})
</script>

<template>
  <main class="news-profile">
    <section class="np-hero">
      <div class="container">
        <nav class="crumbs" aria-label="breadcrumb">
          <a :href="homeHref">Music Mundial</a>
          <span class="crumbs-sep" aria-hidden="true">›</span>
          <a v-if="isEdit" :href="profilePath">{{ txt('profileTitle') }}</a>
          <span v-if="isEdit" class="crumbs-sep" aria-hidden="true">›</span>
          <span class="crumbs-now">{{ txt(isEdit ? 'profileEdit' : isPublic ? 'profilePublicTitle' : 'profileTitle') }}</span>
        </nav>

        <div v-if="loading" class="article-loader article-loader-center" aria-live="polite">
          <div class="article-loader-eq" aria-hidden="true">
            <i v-for="n in 14" :key="n" :style="{ '--d': `${(n % 7) * 80}ms` }"></i>
          </div>
          <p class="article-loader-copy">{{ txt('profileLoading') }}</p>
        </div>

        <div v-else-if="!isPublic && !currentUser" class="np-gate">
          <p class="kicker" style="color: var(--blue); font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase">
            Music Mundial
          </p>
          <h1>{{ txt('profileLoginTitle') }}</h1>
          <p>{{ txt('profileLoginLead') }}</p>
          <div class="np-actions">
            <button class="solid" type="button" @click="openLogin">{{ txt('navLogin') }}</button>
            <a :href="homeHref">{{ txt('backHome') }}</a>
          </div>
        </div>

        <div v-else-if="isPublic && !person" class="np-missing">
          <h1>{{ txt('profileMissing') }}</h1>
          <p>{{ errorMessage }}</p>
          <div class="np-actions">
            <a class="solid" :href="homeHref">{{ txt('backHome') }}</a>
          </div>
        </div>

        <article v-else-if="isEdit" class="np-edit-card">
          <div class="np-preview">
            <label class="np-preview-banner">
              <img v-if="form.banner" :src="form.banner" alt="" />
              <span class="np-cover-btn">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l2-2h6l2 2h3v12H4z" /><circle cx="12" cy="13" r="3.4" /></svg>
                {{ uploadingBanner ? txt('profileUploading') : txt('profileChangeBanner') }}
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp" @change="upload(($event.target as HTMLInputElement).files?.[0], 'banner')" />
            </label>
            <div class="np-preview-user">
              <label class="np-avatar np-avatar-edit">
                <img v-if="form.photoURL" :src="form.photoURL" alt="" />
                <span v-else>{{ initial }}</span>
                <span class="np-avatar-btn" :title="uploadingPhoto ? txt('profileUploading') : txt('profileChangePhoto')">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l2-2h6l2 2h3v12H4z" /><circle cx="12" cy="13" r="3.4" /></svg>
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp" @change="upload(($event.target as HTMLInputElement).files?.[0], 'photoURL')" />
              </label>
              <div class="np-id">
                <h1>{{ form.name || displayName }}</h1>
                <p v-if="form.username || handle" class="handle">@{{ form.username || handle }}</p>
              </div>
            </div>
          </div>
          <form class="np-form auth-form" @submit.prevent="save">
            <p v-if="errorMessage" class="np-msg error">{{ errorMessage }}</p>
            <div class="np-form-grid">
              <label>
                {{ txt('profileName') }}
                <input v-model="form.name" type="text" required maxlength="80" />
              </label>
              <label>
                {{ txt('username') }}
                <input v-model="form.username" type="text" maxlength="32" autocomplete="username" />
                <p class="np-hint">{{ usernameStatus?.message || txt('profileUsernameHint') }}</p>
              </label>
              <label class="np-span">
                {{ txt('profileCountry') }}
                <span class="np-country">
                  <span class="np-country-flag" aria-hidden="true">{{ selectedFlag || '🌍' }}</span>
                  <select v-model="form.country">
                    <option value="">{{ txt('profileCountrySelect') }}</option>
                    <option v-for="row in countryOptions" :key="row.code" :value="row.code">
                      {{ countryFlag(row.code) }} {{ loc === 'en' ? row.en : row.es }}
                    </option>
                  </select>
                </span>
              </label>
              <label class="np-span">
                {{ txt('profileBio') }}
                <textarea v-model="form.bio" maxlength="280" :placeholder="txt('profileBioPlaceholder')"></textarea>
                <p class="np-hint">{{ form.bio.length }}/280</p>
              </label>
            </div>
            <div class="np-edit-actions">
              <a class="ghost" :href="profilePath">{{ txt('profileCancel') }}</a>
              <button class="solid" type="submit" :disabled="saving || checkingUsername">
                {{ saving ? txt('profileSaving') : txt('profileSave') }}
              </button>
            </div>
          </form>
        </article>

        <article v-else class="np-card" :class="{ 'is-mega': isMegaFan, 'is-super': isSuperFan && !isMegaFan }">
          <div class="np-banner">
            <img v-if="banner" :src="banner" alt="" />
          </div>
          <div class="np-body">
            <div class="np-head">
              <span class="np-avatar" :class="{ mega: isMegaFan, super: isSuperFan && !isMegaFan }">
                <img v-if="photo && !photoFailed" :src="photo" alt="" referrerpolicy="no-referrer" @error="photoFailed = true" />
                <span v-else>{{ initial }}</span>
              </span>
              <div class="np-id">
                <h1>{{ displayName || handle || txt('profilePublicTitle') }}</h1>
                <p v-if="handle" class="handle">@{{ handle }}</p>
                <div class="np-chips">
                  <span v-if="isMegaFan" class="np-chip np-chip-mega">MEGA FAN</span>
                  <span v-else-if="isSuperFan" class="np-chip np-chip-super">SUPER FAN</span>
                  <span v-if="membershipLabel" class="np-chip">{{ membershipLabel }} · {{ membershipDaysLabel }}</span>
                  <span v-else class="np-chip">{{ txt('profileMember') }} Music Mundial</span>
                  <span v-if="countryName" class="np-chip">{{ countryMark }} {{ countryName }}</span>
                </div>
              </div>
              <div v-if="isOwn" class="np-actions">
                <a class="solid" :href="editPath">{{ txt('profileEdit') }}</a>
                <a :href="voteProfileHref">{{ txt('profileVote') }}</a>
              </div>
            </div>
            <p v-if="successMessage" class="np-msg ok">{{ successMessage }}</p>
            <p v-if="errorMessage" class="np-msg error">{{ errorMessage }}</p>
            <section class="np-about">
              <h2>{{ txt('profileAbout') }}</h2>
              <p v-if="person?.bio" class="np-bio">{{ person.bio }}</p>
              <a v-else-if="isOwn" class="np-empty-bio" :href="editPath">
                {{ txt('profileAddBio') }}
              </a>
              <p v-else class="np-bio is-empty">{{ txt('profileBioEmpty') }}</p>
            </section>
            <section class="np-artists">
              <div class="np-artists-head">
                <div>
                  <p class="np-artists-kicker">{{ txt('profileFavorites') }}</p>
                  <h2>{{ txt('profileFollowed') }}</h2>
                </div>
                <a :href="voteProfileHref">{{ txt('profileOpenVote') }}</a>
              </div>
              <div v-if="favoriteArtists.length" class="np-artists-grid">
                <a
                  v-for="artist in favoriteArtists"
                  :key="artist.id || artist.artistId || artistTitle(artist)"
                  class="np-artist"
                  :class="{ supported: isSupportedArtist(artist) }"
                  :href="voteArtistHref(artist)"
                >
                  <span class="np-artist-photo">
                    <img v-if="artistImage(artist)" :src="artistImage(artist)" :alt="artistTitle(artist)" />
                    <span v-else>{{ artistTitle(artist).charAt(0).toUpperCase() }}</span>
                  </span>
                  <span class="np-artist-meta">
                    <strong>{{ artistTitle(artist) }}</strong>
                    <small v-if="isSupportedArtist(artist)">{{ txt('profileSupporting') }}</small>
                  </span>
                </a>
              </div>
              <p v-else class="np-artists-empty">{{ txt('profileFollowedEmpty') }}</p>
            </section>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>
