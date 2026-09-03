<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale, translate } from '../i18n'
import { checkUsername, getCurrentApiAuth, getMe, getMyActivity, updateMe, uploadProfileImage as uploadProfileImageFile } from '../services/api/authApi'
import { onStoredAuthChange } from '../services/api/client'
import { cancelFanPurchase } from '../services/api/fanApi'
import { loadFanMe, clearFanMe } from '../utils/fanPerks'
import { clearFanMembership, hydrateMembership } from '../utils/fanMembership'
import { downloadFanInvoice } from '../utils/fanInvoice'
import { canSeeFanStore, checkoutPath, findStoreItem, getFanPlans, loadFanStore } from '../services/fanStore'
import { pickLocalized, pickLocalizedList } from '../utils/localizedCopy'
import { routePath } from '../utils/localizedRoutes'
import MegaUpgradePills from '../components/MegaUpgradePills.vue'

const SECTIONS = ['profile', 'plan', 'payments', 'activity']
const ACTIVITY_PAGE_SIZE = 10
const ACTIVITY_ICONS = {
  vote: 'fa-solid fa-check-to-slot',
  daily_reward: 'fa-solid fa-gift',
  mission: 'fa-solid fa-flag-checkered',
  follow: 'fa-solid fa-heart',
  referral: 'fa-solid fa-user-plus',
  comment: 'fa-solid fa-comment',
  signup: 'fa-solid fa-star',
}

const { locale } = useI18n()
const isLoading = ref(true)
const me = ref(null)
const membership = ref(null)
const purchases = ref([])
const activity = ref([])
const activityPage = ref(1)
const errorMessage = ref('')
const successMessage = ref('')
const isCancelling = ref(false)
const isCancelOpen = ref(false)
const isCancelDoneOpen = ref(false)
const cancelledPlan = ref(null)
const downloadingInvoiceId = ref('')
const isSavingProfile = ref(false)
const isUploadingPhoto = ref(false)
const isUploadingBanner = ref(false)
const isCheckingUsername = ref(false)
const usernameStatus = ref(null)
const section = ref('profile')
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
let unsubscribeAuth = null
let usernameCheckTimer = null

const isSignedIn = computed(() => Boolean(getCurrentApiAuth()?.accessToken))
const plansHref = computed(() => routePath('plans', locale.value))
const storeTick = ref(0)
const canOpenPlans = computed(() => {
  storeTick.value
  return canSeeFanStore(getCurrentApiAuth()?.user)
})
const notificationsHref = computed(() => routePath('notifications', locale.value))
const publicProfileHref = computed(() => {
  const username = me.value?.username || getCurrentApiAuth()?.user?.username
  return username ? `/user/${username}` : routePath('profile', locale.value)
})
const menuItems = computed(() => [
  { id: 'profile', label: translate('accountSettings.navProfile'), icon: 'fa-solid fa-user' },
  { id: 'plan', label: translate('accountSettings.navPlan'), icon: 'fa-solid fa-crown' },
  { id: 'payments', label: translate('accountSettings.navPayments'), icon: 'fa-solid fa-receipt' },
  { id: 'activity', label: translate('accountSettings.navActivity'), icon: 'fa-solid fa-clock-rotate-left' },
])
const currentUsername = computed(() => String(me.value?.username || '').trim().toLowerCase())
const isUsernameBlocked = computed(() => {
  const username = editForm.value.username.trim().toLowerCase()
  if (!username || username === currentUsername.value) return false
  if (isCheckingUsername.value) return true
  return Boolean(usernameStatus.value && !usernameStatus.value.available)
})
const userInitial = computed(() => {
  const source = editForm.value.name || me.value?.displayName || me.value?.email || 'U'
  return source.trim().charAt(0).toUpperCase()
})

const readHash = () => {
  const hash = String(window.location.hash || '').replace('#', '')
  if (hash === 'reward') {
    section.value = 'activity'
    return
  }
  section.value = SECTIONS.includes(hash) ? hash : 'profile'
}

const goSection = (id) => {
  section.value = id
  const url = `${window.location.pathname}${window.location.search}#${id}`
  window.history.replaceState({}, '', url)
}

const fillForm = (profile) => {
  editForm.value = {
    name: profile?.name || profile?.displayName || '',
    username: profile?.username || '',
    country: profile?.country || '',
    bio: profile?.bio || '',
    photoURL: profile?.photoURL || profile?.photoUrl || '',
    banner: profile?.banner || profile?.bannerUrl || '',
    emailCampaigns: profile?.emailCampaigns !== false,
    locale: profile?.locale === 'es' ? 'es' : 'en',
  }
}

const purchaseDate = (row) => {
  const date = row?.startedAt || row?.createdAt
  if (!date) return ''
  return new Date(date).toLocaleDateString(String(locale.value || 'es').startsWith('en') ? 'en-US' : 'es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const money = (row) => {
  if (row?.currency === 'COP') return `$${Number(row.total || 0).toLocaleString()}`
  return `USD ${Number(row.total || 0).toFixed(2)}`
}

const formatPlanDate = (value) => {
  if (!value) return ''
  return new Date(value).toLocaleDateString(String(locale.value || 'es').startsWith('en') ? 'en-US' : 'es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

const planStoreItem = computed(() => findStoreItem(membership.value?.sku))
const planBenefits = computed(() => pickLocalizedList(planStoreItem.value?.benefits, locale.value))
const planArtists = computed(() =>
  (membership.value?.artists || []).map((row) => row?.name).filter(Boolean),
)
const planExpiresLabel = computed(() => formatPlanDate(membership.value?.expiresAt))
const planDescription = computed(() => {
  const item = planStoreItem.value
  if (!item) return ''
  const yearly = Boolean(membership.value?.yearly)
  return pickLocalized(yearly ? item.descYear || item.desc : item.desc, locale.value)
})
const previewPlans = computed(() => {
  storeTick.value
  return getFanPlans().slice(0, 3)
})
const featuredPreview = computed(() =>
  previewPlans.value.find((plan) => plan.featured) || previewPlans.value[1] || previewPlans.value[0] || null,
)
const megaPreview = computed(() =>
  previewPlans.value.find((plan) => plan.sku === 'MEGA' || plan.mega) || null,
)

const planCheckoutHref = (sku) =>
  checkoutPath(sku, { locale: String(locale.value || 'es').startsWith('en') ? 'en' : 'es' })

const planBadgeClass = (sku) => {
  const key = String(sku || '').toUpperCase()
  if (key === 'MEGA') return 'bg-linear-to-r from-amber-700 to-amber-300 text-amber-950'
  if (key === 'SUPER') return 'bg-linear-to-r from-violet-600 to-fuchsia-500 text-white'
  return 'bg-linear-to-r from-blue-600 to-sky-400 text-white'
}

const planBadgeIcon = (sku) => {
  const key = String(sku || '').toUpperCase()
  if (key === 'MEGA') return 'fa-solid fa-crown'
  if (key === 'SUPER') return 'fa-solid fa-bolt'
  return 'fa-solid fa-star'
}

const snapshotPlan = (record) => {
  if (!record) return null
  const item = findStoreItem(record.sku)
  return {
    name: record.name || item?.name || 'FAN',
    sku: record.sku || item?.sku || 'FAN',
    multiplier: Number(record.multiplier || item?.multiplier || 1),
    welcomePts: Number(record.welcomePts || item?.welcomePts || 0),
  }
}

const activityWhen = (row) => {
  if (!row?.at) return ''
  return new Date(row.at).toLocaleString(String(locale.value || 'es').startsWith('en') ? 'en-US' : 'es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const activityPoints = (row) => {
  const value = Number(row?.points || 0)
  if (!value) return ''
  return value > 0 ? `+${value} pts` : `${value} pts`
}

const activityIcon = (type) => ACTIVITY_ICONS[type] || 'fa-solid fa-circle'
const activityTotalPages = computed(() =>
  Math.max(1, Math.ceil(activity.value.length / ACTIVITY_PAGE_SIZE)),
)
const pagedActivity = computed(() => {
  const page = Math.min(Math.max(activityPage.value, 1), activityTotalPages.value)
  const start = (page - 1) * ACTIVITY_PAGE_SIZE
  return activity.value.slice(start, start + ACTIVITY_PAGE_SIZE)
})
const activityPageButtons = computed(() => {
  const total = activityTotalPages.value
  const current = activityPage.value
  const start = Math.max(1, Math.min(current - 2, total - 4))
  const end = Math.min(total, start + 4)
  const pages = []
  for (let page = Math.max(1, start); page <= end; page += 1) pages.push(page)
  return pages
})
const goActivityPage = (page) => {
  activityPage.value = Math.min(Math.max(1, Number(page) || 1), activityTotalPages.value)
}
const invoiceLang = computed(() => (String(locale.value || 'es').startsWith('en') ? 'en' : 'es'))

const downloadReceipt = async (row) => {
  const key = row?.invoiceId || row?.id
  if (!row || downloadingInvoiceId.value) return
  downloadingInvoiceId.value = String(key)
  errorMessage.value = ''
  try {
    await downloadFanInvoice(
      {
        ...row,
        buyerName: row.buyerName || me.value?.displayName || me.value?.name || '',
        buyerEmail: row.buyerEmail || me.value?.email || '',
        country: row.countryName || row.country || '',
        phone: row.phone || '—',
      },
      invoiceLang.value,
    )
  } catch {
    errorMessage.value = translate('accountSettings.downloadError')
  } finally {
    downloadingInvoiceId.value = ''
  }
}

const load = async () => {
  isLoading.value = true
  errorMessage.value = ''
  if (!getCurrentApiAuth()?.accessToken) {
    me.value = null
    membership.value = null
    purchases.value = []
    activity.value = []
    activityPage.value = 1
    isLoading.value = false
    return
  }
  try {
    const [payload, profile, activityPayload] = await Promise.all([
      loadFanMe().catch(() => ({ membership: null, purchases: [] })),
      getMe().catch(() => null),
      getMyActivity().catch(() => ({ items: [] })),
    ])
    me.value = profile
    fillForm(profile)
    membership.value = hydrateMembership(payload.membership)
    purchases.value = payload.purchases || []
    activity.value = (activityPayload?.items || []).filter((row) => row.type !== 'notification' && row.type !== 'report')
    activityPage.value = 1
  } catch (error) {
    errorMessage.value = error?.message || translate('profile.membership.cancelError')
  } finally {
    isLoading.value = false
  }
}

const isAcceptedImageFile = (file) => {
  const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']
  const acceptedExtensions = ['.jpg', '.jpeg', '.png', '.webp']
  const fileName = file.name.toLowerCase()
  return acceptedTypes.includes(file.type) || acceptedExtensions.some((extension) => fileName.endsWith(extension))
}

const uploadProfileImage = async (file, field) => {
  if (!file) return
  errorMessage.value = ''
  successMessage.value = ''
  if (!isAcceptedImageFile(file)) {
    errorMessage.value = translate('profile.edit.imageTypeError')
    return
  }
  const isBanner = field === 'banner'
  if (isBanner) isUploadingBanner.value = true
  else isUploadingPhoto.value = true
  try {
    const uploaded = await uploadProfileImageFile(file)
    editForm.value[field] = uploaded.url
  } catch {
    errorMessage.value = translate('profile.edit.uploadError')
  } finally {
    if (isBanner) isUploadingBanner.value = false
    else isUploadingPhoto.value = false
  }
}

const handleProfileImageInput = (event, field) => {
  const [file] = event.target.files || []
  uploadProfileImage(file, field)
  event.target.value = ''
}

const saveProfile = async () => {
  const nextName = editForm.value.name.trim()
  const nextUsername = editForm.value.username.trim().toLowerCase()
  if (!nextName) {
    errorMessage.value = translate('profile.edit.nameRequired')
    return
  }
  if (isUsernameBlocked.value) {
    errorMessage.value = usernameStatus.value?.message || translate('profile.edit.saveError')
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
    me.value = updated
    fillForm(updated)
    if (updated?.locale) setLocale(updated.locale === 'es' ? 'es' : 'en')
    successMessage.value = translate('profile.edit.saved')
  } catch (error) {
    errorMessage.value = error.message || translate('profile.edit.saveError')
  } finally {
    isSavingProfile.value = false
  }
}

const openCancel = () => {
  errorMessage.value = ''
  isCancelOpen.value = true
}

const closeCancel = () => {
  if (!isCancelling.value) isCancelOpen.value = false
}

const confirmCancel = async () => {
  const id = membership.value?.id
  if (isCancelling.value) return
  isCancelling.value = true
  errorMessage.value = ''
  try {
    cancelledPlan.value = snapshotPlan(membership.value)
    if (id) await cancelFanPurchase(id)
    clearFanMembership()
    clearFanMe()
    isCancelOpen.value = false
    isCancelDoneOpen.value = true
    await load()
  } catch (error) {
    errorMessage.value = error?.message || translate('profile.membership.cancelError')
  } finally {
    isCancelling.value = false
  }
}

watch(
  () => editForm.value.username,
  (value) => {
    window.clearTimeout(usernameCheckTimer)
    const username = value.trim().toLowerCase()
    usernameStatus.value = null
    if (!username || username === currentUsername.value) {
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

onMounted(() => {
  readHash()
  window.addEventListener('hashchange', readHash)
  unsubscribeAuth = onStoredAuthChange(load)
  load()
  loadFanStore().then(() => { storeTick.value += 1 })
})

onUnmounted(() => {
  window.removeEventListener('hashchange', readHash)
  window.clearTimeout(usernameCheckTimer)
  unsubscribeAuth?.()
})
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-8 sm:px-6 lg:pt-8 lg:pb-12">
    <header class="lg:hidden">
      <p class="text-sm text-slate-400">
        <a :href="publicProfileHref" class="hover:text-white">← {{ $t('accountSettings.back') }}</a>
      </p>
      <h1 class="mt-4 text-3xl font-black text-white">{{ $t('accountSettings.title') }}</h1>
      <p class="mt-1 text-sm text-slate-500">{{ $t('accountSettings.onlyYou') }}</p>
    </header>

    <p
      v-if="errorMessage"
      class="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
    >
      {{ errorMessage }}
    </p>
    <p
      v-if="successMessage"
      class="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
    >
      {{ successMessage }}
    </p>

    <p v-if="!isSignedIn" class="mt-8 text-sm text-slate-300">
      {{ $t('accountSettings.login') }}
    </p>

    <div v-else class="mt-8 grid gap-6 lg:mt-0 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
      <aside class="sticky top-20 z-30 -mx-4 bg-[#050713] px-4 py-2 sm:top-24 lg:top-24 lg:mx-0 lg:bg-transparent lg:px-0 lg:py-0">
        <header class="mb-5 hidden lg:block">
          <p class="text-sm text-slate-400">
            <a :href="publicProfileHref" class="hover:text-white">← {{ $t('accountSettings.back') }}</a>
          </p>
          <h1 class="mt-3 text-3xl font-black text-white">{{ $t('accountSettings.title') }}</h1>
          <p class="mt-1 text-sm text-slate-500">{{ $t('accountSettings.onlyYou') }}</p>
        </header>
        <nav class="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:rounded-3xl lg:border lg:border-violet-300/15 lg:bg-[#090b19] lg:p-3">
          <button
            v-for="item in menuItems"
            :key="item.id"
            type="button"
            class="inline-flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-wide transition"
            :class="section === item.id
              ? 'bg-linear-to-r from-violet-500/30 to-fuchsia-500/20 text-white'
              : 'text-slate-400 hover:bg-white/8 hover:text-white'"
            @click="goSection(item.id)"
          >
            <i class="w-4 text-center" :class="item.icon" aria-hidden="true"></i>
            {{ item.label }}
          </button>
          <a
            :href="notificationsHref"
            class="inline-flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-400 transition hover:bg-white/8 hover:text-white"
          >
            <i class="fa-solid fa-bell w-4 text-center" aria-hidden="true"></i>
            {{ $t('accountSettings.navNotifications') }}
          </a>
          <a
            :href="publicProfileHref"
            class="inline-flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-400 transition hover:bg-white/8 hover:text-white"
          >
            <i class="fa-solid fa-arrow-up-right-from-square w-4 text-center" aria-hidden="true"></i>
            {{ $t('accountSettings.navPublic') }}
          </a>
        </nav>
      </aside>

      <div
        v-if="isLoading"
        class="grid min-h-[min(36rem,calc(100vh-12rem))] place-items-center rounded-3xl border border-violet-300/15 bg-[#090b19]/90"
        aria-busy="true"
        aria-live="polite"
      >
        <div class="flex flex-col items-center gap-4">
          <span class="settings-loading-spinner" aria-hidden="true"></span>
          <p class="text-sm text-slate-400">{{ $t('common.loading') }}</p>
        </div>
      </div>

      <div
        v-else
        class="min-w-0 overflow-hidden rounded-3xl border border-violet-300/15 bg-[#090b19]/90 shadow-2xl shadow-fuchsia-950/20"
      >
        <section v-if="section === 'profile'" class="p-5 sm:p-6">
          <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">{{ $t('profile.edit.eyebrow') }}</p>
          <h2 class="mt-2 text-2xl font-black text-white">{{ $t('profile.edit.title') }}</h2>
          <p class="mt-1 text-sm font-bold text-slate-500">{{ me?.email }}</p>

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

            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('profile.edit.country') }}</span>
              <input
                v-model="editForm.country"
                type="text"
                class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white outline-none transition focus:border-fuchsia-300/40"
              />
            </label>

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
                  <input v-model="editForm.emailCampaigns" type="checkbox" class="size-5 accent-cyan-400" />
                  {{ $t('profile.edit.emailCampaignsEnabled') }}
                </label>
              </div>
            </div>

            <button
              type="submit"
              class="min-h-12 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isSavingProfile || isUploadingPhoto || isUploadingBanner || isUsernameBlocked"
            >
              {{ isSavingProfile ? $t('profile.edit.saving') : $t('profile.edit.save') }}
            </button>
          </form>
        </section>

        <section v-else-if="section === 'plan'" class="min-h-[min(36rem,calc(100vh-12rem))] p-5 sm:p-6">
          <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">{{ $t('plans.eyebrow') }}</p>
          <h2 class="mt-2 text-2xl font-black text-white">{{ $t('accountSettings.navPlan') }}</h2>
          <p class="mt-1 text-sm font-bold text-slate-500">{{ $t('accountSettings.planHelp') }}</p>

          <div v-if="membership && !membership.expired" class="mt-6 space-y-6">
            <div class="relative overflow-hidden rounded-4xl border border-fuchsia-300/20 bg-[#060713] p-5 shadow-xl shadow-fuchsia-950/20 sm:p-6">
              <div class="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-fuchsia-500/18 blur-3xl"></div>
              <div class="pointer-events-none absolute -bottom-20 left-0 size-44 rounded-full bg-amber-400/10 blur-3xl"></div>
              <div class="relative">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="flex items-center gap-3">
                      <span class="flex size-12 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-white/7 text-xl">
                        <i class="fa-fw" :class="planStoreItem?.icon || planBadgeIcon(membership.sku)" aria-hidden="true"></i>
                      </span>
                      <h3 class="text-3xl font-black uppercase tracking-tight text-white">{{ membership.name }}</h3>
                    </div>
                    <p v-if="planDescription" class="mt-3 max-w-xl text-sm font-bold leading-6 text-fuchsia-200">
                      {{ planDescription }}
                    </p>
                    <div class="mt-4 flex flex-wrap items-center gap-2">
                      <span
                        class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black italic tracking-wide"
                        :class="planBadgeClass(membership.sku)"
                      >
                        <i class="fa-solid" :class="planBadgeIcon(membership.sku)" aria-hidden="true"></i>
                        {{ membership.name }}
                      </span>
                      <span
                        v-if="Number(membership.welcomePts || 0) > 0"
                        class="rounded-full border border-amber-300/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-200"
                      >
                        {{ $t('accountSettings.pointsPill', { n: membership.welcomePts }) }}
                      </span>
                    </div>
                    <p class="mt-3 text-sm font-bold text-slate-400">
                      {{ $t('accountSettings.days', { n: membership.daysLeft }) }}
                      · {{ membership.yearly ? $t('accountSettings.planYearly') : $t('accountSettings.planMonthly') }}
                      <span v-if="planExpiresLabel"> · {{ $t('accountSettings.planExpires', { date: planExpiresLabel }) }}</span>
                    </p>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <a
                      v-if="canOpenPlans"
                      :href="plansHref"
                      class="inline-flex min-h-11 items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-4 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01]"
                    >
                      {{ $t('profile.membership.changePlan') }}
                    </a>
                    <button
                      type="button"
                      class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
                      @click="openCancel"
                    >
                      {{ $t('profile.membership.cancel') }}
                    </button>
                  </div>
                </div>

                <div class="mt-5 grid grid-cols-2 gap-3">
                  <div class="rounded-3xl border border-white/10 bg-black/25 p-4">
                    <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{{ $t('plans.eachVote') }}</p>
                    <p class="mt-1 text-2xl font-black text-white">×{{ membership.multiplier }}</p>
                  </div>
                  <div class="rounded-3xl border border-white/10 bg-black/25 p-4">
                    <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{{ $t('plans.welcome') }}</p>
                    <p class="mt-1 text-2xl font-black text-fuchsia-200">+{{ membership.welcomePts || 0 }} pts</p>
                  </div>
                </div>

                <MegaUpgradePills class="mt-5" :sku="membership.sku" />
              </div>
            </div>

            <div v-if="planArtists.length">
              <h3 class="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{{ $t('accountSettings.planArtists') }}</h3>
              <ul class="mt-3 flex flex-wrap gap-2">
                <li
                  v-for="name in planArtists"
                  :key="name"
                  class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-bold text-slate-200"
                >
                  {{ name }}
                </li>
              </ul>
            </div>

            <div v-if="planBenefits.length">
              <h3 class="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{{ $t('accountSettings.planBenefits') }}</h3>
              <ul class="mt-3 grid gap-2 sm:grid-cols-2">
                <li
                  v-for="line in planBenefits"
                  :key="line"
                  class="flex items-start gap-2 text-sm text-slate-300"
                >
                  <i class="fa-solid fa-check mt-0.5 text-fuchsia-300" aria-hidden="true"></i>
                  {{ line }}
                </li>
              </ul>
            </div>
          </div>

          <div
            v-else
            class="relative mt-6 overflow-hidden rounded-4xl border border-fuchsia-300/20 bg-[#060713] px-5 py-8 text-center shadow-xl shadow-fuchsia-950/20 sm:px-8 sm:py-10"
          >
            <div class="pointer-events-none absolute -left-16 -top-20 size-56 rounded-full bg-fuchsia-500/20 blur-3xl"></div>
            <div class="pointer-events-none absolute -bottom-24 right-0 size-64 rounded-full bg-amber-400/10 blur-3xl"></div>
            <div class="relative mx-auto max-w-xl">
              <div class="mx-auto grid size-16 place-items-center rounded-3xl border border-fuchsia-300/30 bg-fuchsia-400/10 text-2xl text-fuchsia-100 shadow-xl shadow-fuchsia-950/25">
                <i class="fa-solid fa-crown" aria-hidden="true"></i>
              </div>
              <p class="mt-5 text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
                {{ $t('accountSettings.navPlan') }}
              </p>
              <h3 class="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                {{ $t('profile.membership.noPlan') }}
              </h3>
              <p class="mx-auto mt-3 max-w-md text-sm font-bold leading-6 text-slate-300">
                {{ $t('accountSettings.noPlanHelp') }}
              </p>

              <div v-if="featuredPreview" class="mt-6 grid grid-cols-2 gap-3 text-left">
                <div class="rounded-3xl border border-white/10 bg-black/25 p-4">
                  <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{{ $t('plans.eachVote') }}</p>
                  <p class="mt-1 text-2xl font-black text-white">×{{ featuredPreview.multiplier }}</p>
                </div>
                <div class="rounded-3xl border border-white/10 bg-black/25 p-4">
                  <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{{ $t('plans.welcome') }}</p>
                  <p class="mt-1 text-2xl font-black text-fuchsia-200">+{{ featuredPreview.welcomePts }} pts</p>
                </div>
              </div>

              <MegaUpgradePills v-if="featuredPreview" class="mt-5" :sku="featuredPreview.sku" />

              <a
                v-if="canOpenPlans"
                :href="plansHref"
                class="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01]"
              >
                {{ $t('accountSettings.seePlans') }}
                <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
              </a>
            </div>
          </div>
        </section>

        <section v-else-if="section === 'payments'" class="p-5 sm:p-6">
          <h2 class="text-lg font-semibold text-white">{{ $t('accountSettings.navPayments') }}</h2>
          <ul v-if="purchases.length" class="mt-5 divide-y divide-white/10">
            <li
              v-for="row in purchases"
              :key="row.invoiceId || row.id"
              class="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
            >
              <div>
                <p class="text-sm font-black text-white">{{ row.name }}</p>
                <p class="mt-0.5 text-xs text-slate-500">
                  {{ row.invoiceId }}
                  · {{ row.status === 'cancelled' ? $t('profile.membership.statusCancelled') : $t('profile.membership.statusPaid') }}
                  <span v-if="purchaseDate(row)"> · {{ purchaseDate(row) }}</span>
                </p>
              </div>
              <div class="flex items-center gap-3">
                <p class="text-sm font-bold text-slate-200">{{ money(row) }}</p>
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-100 transition hover:bg-white/12 disabled:opacity-60"
                  :disabled="Boolean(downloadingInvoiceId)"
                  @click="downloadReceipt(row)"
                >
                  <i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i>
                  {{
                    downloadingInvoiceId === String(row.invoiceId || row.id)
                      ? $t('accountSettings.downloadingReceipt')
                      : $t('accountSettings.downloadReceipt')
                  }}
                </button>
              </div>
            </li>
          </ul>
          <p v-else class="mt-5 text-sm text-slate-400">{{ $t('profile.membership.historyEmpty') }}</p>
        </section>

        <section v-else class="p-5 sm:p-6">
          <h2 class="text-lg font-black text-white">{{ $t('accountSettings.navActivity') }}</h2>
          <p class="mt-1 text-sm text-slate-500">{{ $t('accountSettings.activityHelp') }}</p>
          <ul v-if="pagedActivity.length" class="mt-5 divide-y divide-white/10">
            <li
              v-for="row in pagedActivity"
              :key="row.id"
              class="flex gap-3 py-3 first:pt-0"
            >
              <span class="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-white/8 text-fuchsia-200">
                <i class="fa-fw" :class="activityIcon(row.type)" aria-hidden="true"></i>
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-bold text-white">{{ row.title }}</p>
                <p v-if="row.detail" class="mt-0.5 truncate text-xs text-slate-500">{{ row.detail }}</p>
                <p class="mt-1 text-xs text-slate-400">{{ activityWhen(row) }}</p>
              </div>
              <p
                v-if="activityPoints(row)"
                class="shrink-0 text-sm font-black"
                :class="Number(row.points) > 0 ? 'text-emerald-300' : 'text-amber-200'"
              >
                {{ activityPoints(row) }}
              </p>
            </li>
          </ul>
          <p v-else class="mt-5 text-sm text-slate-400">{{ $t('accountSettings.activityEmpty') }}</p>
          <div
            v-if="activityTotalPages > 1"
            class="mt-6 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-4 sm:flex-row"
          >
            <p class="text-xs font-bold text-slate-500">
              {{ $t('accountSettings.pageOf', { page: activityPage, total: activityTotalPages }) }}
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="min-h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-black uppercase tracking-wide text-slate-200 hover:bg-white/10 disabled:opacity-40"
                :disabled="activityPage <= 1"
                @click="goActivityPage(activityPage - 1)"
              >
                {{ $t('common.actions.previous') }}
              </button>
              <button
                v-for="page in activityPageButtons"
                :key="page"
                type="button"
                class="grid size-10 place-items-center rounded-xl text-xs font-black"
                :class="page === activityPage
                  ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'"
                @click="goActivityPage(page)"
              >
                {{ page }}
              </button>
              <button
                type="button"
                class="min-h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-black uppercase tracking-wide text-slate-200 hover:bg-white/10 disabled:opacity-40"
                :disabled="activityPage >= activityTotalPages"
                @click="goActivityPage(activityPage + 1)"
              >
                {{ $t('common.actions.next') }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="isCancelOpen"
        class="fixed inset-0 z-90 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="'cancel-plan-title'"
        @click.self="closeCancel"
      >
        <article
          class="relative w-full max-w-md overflow-hidden rounded-4xl border border-fuchsia-300/25 bg-[#090b19] p-6 text-white shadow-2xl shadow-fuchsia-950/50"
          @click.stop
        >
          <div class="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-fuchsia-500/20 blur-3xl"></div>
          <div class="pointer-events-none absolute -bottom-24 left-0 size-64 rounded-full bg-cyan-400/10 blur-3xl"></div>
          <div class="relative text-center">
            <div class="mx-auto grid size-16 place-items-center rounded-3xl border border-fuchsia-300/30 bg-fuchsia-400/10 text-2xl text-fuchsia-100">
              <i class="fa-solid fa-crown" aria-hidden="true"></i>
            </div>
            <p class="mt-5 text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
              {{ $t('accountSettings.plan') }}
            </p>
            <h2 id="cancel-plan-title" class="mt-3 text-3xl font-black tracking-tight text-white">
              {{ $t('accountSettings.cancelTitle') }}
            </h2>
            <p v-if="membership?.name" class="mt-2 text-sm font-black uppercase tracking-wide text-amber-200">
              {{ membership.name }}
              <span v-if="membership.daysLeft" class="text-slate-400">
                · {{ $t('accountSettings.days', { n: membership.daysLeft }) }}
              </span>
            </p>
            <div v-if="membership" class="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span
                class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black italic tracking-wide"
                :class="planBadgeClass(membership.sku)"
              >
                <i class="fa-solid" :class="planBadgeIcon(membership.sku)" aria-hidden="true"></i>
                {{ membership.name }}
              </span>
              <span
                v-if="Number(membership.welcomePts || 0) > 0"
                class="rounded-full border border-amber-300/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-200"
              >
                {{ $t('accountSettings.pointsPill', { n: membership.welcomePts }) }}
              </span>
            </div>
            <div v-if="membership" class="mt-4 grid grid-cols-2 gap-3 text-left">
              <div class="rounded-3xl border border-white/10 bg-black/25 p-4">
                <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{{ $t('plans.eachVote') }}</p>
                <p class="mt-1 text-2xl font-black">×{{ membership.multiplier }}</p>
              </div>
              <div class="rounded-3xl border border-white/10 bg-black/25 p-4">
                <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{{ $t('plans.welcome') }}</p>
                <p class="mt-1 text-2xl font-black text-fuchsia-200">+{{ membership.welcomePts || 0 }} pts</p>
              </div>
            </div>
            <p class="mx-auto mt-3 max-w-sm text-sm font-bold leading-6 text-slate-300">
              {{ $t('profile.membership.cancelConfirm') }}
            </p>
            <div class="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="isCancelling"
                @click="closeCancel"
              >
                {{ $t('accountSettings.keep') }}
              </button>
              <button
                type="button"
                class="min-h-12 rounded-2xl bg-linear-to-r from-pink-500 to-fuchsia-600 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/35 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="isCancelling"
                @click="confirmCancel"
              >
                {{ isCancelling ? $t('profile.membership.cancelling') : $t('accountSettings.cancelConfirm') }}
              </button>
            </div>
          </div>
        </article>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="isCancelDoneOpen"
        class="fixed inset-0 z-90 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-plan-done-title"
        @click.self="isCancelDoneOpen = false"
      >
        <article
          class="relative w-full max-w-md overflow-hidden rounded-4xl border border-fuchsia-300/25 bg-[#090b19] p-6 text-white shadow-2xl shadow-fuchsia-950/50"
          @click.stop
        >
          <div class="pointer-events-none absolute -left-20 -top-20 size-56 rounded-full bg-fuchsia-500/20 blur-3xl"></div>
          <div class="pointer-events-none absolute -bottom-24 right-0 size-64 rounded-full bg-amber-400/10 blur-3xl"></div>
          <div class="relative text-center">
            <div class="mx-auto grid size-16 place-items-center rounded-3xl border border-emerald-300/30 bg-emerald-400/10 text-2xl text-emerald-100">
              <i class="fa-solid fa-check" aria-hidden="true"></i>
            </div>
            <p class="mt-5 text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
              {{ $t('accountSettings.plan') }}
            </p>
            <h2 id="cancel-plan-done-title" class="mt-3 text-3xl font-black tracking-tight text-white">
              {{ $t('profile.membership.cancelled') }}
            </h2>
            <div v-if="cancelledPlan" class="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span
                class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black italic tracking-wide"
                :class="planBadgeClass(cancelledPlan.sku)"
              >
                <i class="fa-solid" :class="planBadgeIcon(cancelledPlan.sku)" aria-hidden="true"></i>
                {{ cancelledPlan.name }}
              </span>
              <span
                v-if="Number(cancelledPlan.welcomePts || 0) > 0"
                class="rounded-full border border-amber-300/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-200"
              >
                {{ $t('accountSettings.pointsPill', { n: cancelledPlan.welcomePts }) }}
              </span>
            </div>
            <div v-if="cancelledPlan" class="mt-4 grid grid-cols-2 gap-3 text-left">
              <div class="rounded-3xl border border-white/10 bg-black/25 p-4">
                <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{{ $t('plans.eachVote') }}</p>
                <p class="mt-1 text-2xl font-black">×{{ cancelledPlan.multiplier }}</p>
              </div>
              <div class="rounded-3xl border border-white/10 bg-black/25 p-4">
                <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{{ $t('plans.welcome') }}</p>
                <p class="mt-1 text-2xl font-black text-fuchsia-200">+{{ cancelledPlan.welcomePts || 0 }} pts</p>
              </div>
            </div>
            <p class="mx-auto mt-3 max-w-sm text-sm font-bold leading-6 text-slate-300">
              {{ $t('profile.membership.cancelledHelp') }}
            </p>
            <button
              type="button"
              class="mt-6 min-h-12 w-full rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/35 transition hover:scale-[1.01]"
              @click="isCancelDoneOpen = false"
            >
              {{ $t('profile.membership.cancelledOk') }}
            </button>
          </div>
        </article>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.settings-loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid rgba(255, 255, 255, 0.12);
  border-top-color: #c4b5fd;
  border-radius: 999px;
  animation: settings-loading-spin 0.7s linear infinite;
}

@keyframes settings-loading-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .settings-loading-spinner {
    animation: none;
    border-top-color: rgba(255, 255, 255, 0.35);
  }
}
</style>
