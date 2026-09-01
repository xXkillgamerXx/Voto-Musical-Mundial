<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AdminArtistFormView from '../components/AdminArtistFormView.vue'
import AdminArtistsView from '../components/AdminArtistsView.vue'
import AdminContentReportsView from '../components/AdminContentReportsView.vue'
import AdminDashboardView from '../components/AdminDashboardView.vue'
import AdminMailView from '../components/AdminMailView.vue'
import AdminMissionsView from '../components/AdminMissionsView.vue'
import AdminModerationView from '../components/AdminModerationView.vue'
import AdminDictionaryView from '../components/AdminDictionaryView.vue'
import AdminPollCategoriesView from '../components/AdminPollCategoriesView.vue'
import AdminPollContestantsView from '../components/AdminPollContestantsView.vue'
import AdminPollFormView from '../components/AdminPollFormView.vue'
import AdminPollMonitorView from '../components/AdminPollMonitorView.vue'
import AdminPollsView from '../components/AdminPollsView.vue'
import AdminNotificationCampaignsView from '../components/AdminNotificationCampaignsView.vue'
import AdminPushNotificationsView from '../components/AdminPushNotificationsView.vue'
import AdminPollRoundView from '../components/AdminPollRoundView.vue'
import AdminPollWinnersView from '../components/AdminPollWinnersView.vue'
import AdminSettingsView from '../components/AdminSettingsView.vue'
import AdminPrivacyView from '../components/AdminPrivacyView.vue'
import AdminTermsView from '../components/AdminTermsView.vue'
import AdminUsersView from '../components/AdminUsersView.vue'
import AdminUserProfileView from '../components/AdminUserProfileView.vue'
import { getCurrentApiAuth, getMe, logout } from '../../services/api/authApi'
import { getAdminNavCounts } from '../../services/api/adminApi'

const currentPath = window.location.pathname
const isPollsView = computed(() => currentPath === '/admin/votaciones')
const isPollCreateView = computed(() => currentPath === '/admin/votaciones/crear')
const isPollEditView = computed(() => currentPath.startsWith('/admin/votaciones/editar/'))
const pollEditId = computed(() => currentPath.replace('/admin/votaciones/editar/', ''))
const isPollParticipantsView = computed(() => currentPath.startsWith('/admin/votaciones/') && currentPath.endsWith('/participantes'))
const isPollMonitorView = computed(() => currentPath.startsWith('/admin/votaciones/') && currentPath.endsWith('/monitor'))
const isPollWinnersView = computed(() => currentPath.startsWith('/admin/votaciones/') && currentPath.endsWith('/ganadores'))
const isPollRoundView = computed(() => /^\/admin\/votaciones\/[^/]+\/rondas\/[^/]+$/.test(currentPath))
const isPollDetailView = computed(() => /^\/admin\/votaciones\/[^/]+$/.test(currentPath))
const pollActionId = computed(() => currentPath.split('/')[3] || '')
const roundActionId = computed(() => currentPath.split('/')[5] || '')
const isArtistsView = computed(() => currentPath === '/admin/artistas')
const isArtistCreateView = computed(() => currentPath === '/admin/artistas/crear')
const isArtistEditView = computed(() => currentPath.startsWith('/admin/artistas/editar/'))
const artistEditId = computed(() => currentPath.replace('/admin/artistas/editar/', ''))
const isUsersView = computed(() => currentPath === '/admin/usuarios')
const isUserProfileView = computed(() => /^\/admin\/usuarios\/[^/]+$/.test(currentPath))
const userProfileId = computed(() => {
  const match = currentPath.match(/^\/admin\/usuarios\/([^/]+)$/)
  return match ? match[1] : ''
})
const isMissionsView = computed(() => currentPath === '/admin/misiones')
const isPushNotificationsView = computed(() => currentPath === '/admin/notificaciones')
const isMailView = computed(() => currentPath === '/admin/correo')
const isNotificationCampaignsView = computed(() => currentPath === '/admin/notificaciones-programadas')
const isModerationView = computed(() => currentPath === '/admin/reportes')
const isDictionaryView = computed(() => currentPath === '/admin/diccionario')
const isContentReportsView = computed(() => currentPath === '/admin/denuncias')
const isSettingsView = computed(() => currentPath === '/admin/ajustes')
const isTermsView = computed(() => currentPath === '/admin/terminos')
const isPrivacyView = computed(() => currentPath === '/admin/privacidad')
const isCategoriesView = computed(() => currentPath === '/admin/categorias')
const isCategoryCreateView = computed(() => currentPath === '/admin/categorias/crear')
const pageTitle = computed(() => {
  if (isPollCreateView.value) {
    return 'Crear votacion'
  }

  if (isPollEditView.value) {
    return 'Editar votacion'
  }

  if (isPollParticipantsView.value) {
    return 'Participantes'
  }

  if (isPollMonitorView.value) {
    return 'Monitor'
  }

  if (isPollWinnersView.value) {
    return 'Ganadores'
  }

  if (isPollRoundView.value) {
    return 'Configurar ronda'
  }

  if (isPollDetailView.value) {
    return 'Gestionar votacion'
  }

  if (isPollsView.value) {
    return 'Votaciones'
  }

  if (isArtistCreateView.value) {
    return 'Crear artista'
  }

  if (isArtistEditView.value) {
    return 'Editar artista'
  }

  if (isArtistsView.value) {
    return 'Artistas'
  }

  if (isUserProfileView.value) {
    return 'Perfil de usuario'
  }

  if (isUsersView.value) {
    return 'Usuarios'
  }

  if (isMissionsView.value) {
    return 'Misiones'
  }

  if (isPushNotificationsView.value) {
    return 'Notificaciones Push'
  }

  if (isMailView.value) {
    return 'Correo'
  }

  if (isNotificationCampaignsView.value) {
    return 'Notificaciones programadas'
  }

  if (isModerationView.value) {
    return 'Reportes / Moderación'
  }

  if (isDictionaryView.value) {
    return 'Diccionario de moderación'
  }

  if (isContentReportsView.value) {
    return 'Denuncias de contenido'
  }

  if (isSettingsView.value) {
    return 'Ajustes'
  }

  if (isTermsView.value) {
    return 'Términos y condiciones'
  }

  if (isPrivacyView.value) {
    return 'Política de privacidad'
  }

  if (isCategoriesView.value) {
    return 'Categorías'
  }

  if (isCategoryCreateView.value) {
    return 'Crear categoría'
  }

  return 'Dashboard'
})
const isCheckingAccess = ref(true)
const hasAdminAccess = ref(false)
const currentUser = ref(null)
const avatarImageFailed = ref(false)
const isMobileNavOpen = ref(false)
const navCounts = ref({ openAlerts: 0, pendingDenuncias: 0 })

const navBadge = (item) => {
  if (!item.badgeKey) return 0
  return Number(navCounts.value[item.badgeKey] || 0)
}

const loadNavCounts = async () => {
  try {
    navCounts.value = await getAdminNavCounts()
  } catch {
    navCounts.value = { openAlerts: 0, pendingDenuncias: 0 }
  }
}

const userName = computed(() => currentUser.value?.displayName || 'Admin')
const userEmail = computed(() => currentUser.value?.email || '')
const shouldShowAvatarImage = computed(() => (currentUser.value?.photoUrl || currentUser.value?.photoURL) && !avatarImageFailed.value)
const userInitial = computed(() => {
  const source = currentUser.value?.displayName || currentUser.value?.email || 'A'

  return source.trim().charAt(0).toUpperCase()
})
const adminRoles = new Set(['admin', 'superadmin', 'owner'])

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: 'fa-solid fa-chart-line' },
  { label: 'Usuarios', href: '/admin/usuarios', icon: 'fa-solid fa-users' },
  { label: 'Votaciones', href: '/admin/votaciones', icon: 'fa-solid fa-check-to-slot' },
  { label: 'Categorías', href: '/admin/categorias', icon: 'fa-solid fa-trophy' },
  { label: 'Artistas', href: '/admin/artistas', icon: 'fa-solid fa-microphone-lines' },
  { label: 'Misiones', href: '/admin/misiones', icon: 'fa-solid fa-bullseye' },
  { label: 'Notificaciones', href: '/admin/notificaciones', icon: 'fa-solid fa-bell' },
  { label: 'Correo', href: '/admin/correo', icon: 'fa-solid fa-envelope' },
  { label: 'Programadas', href: '/admin/notificaciones-programadas', icon: 'fa-solid fa-clock-rotate-left' },
  { label: 'Reportes', href: '/admin/reportes', icon: 'fa-solid fa-shield-halved', badgeKey: 'openAlerts' },
  { label: 'Diccionario', href: '/admin/diccionario', icon: 'fa-solid fa-book' },
  { label: 'Denuncias', href: '/admin/denuncias', icon: 'fa-solid fa-flag', badgeKey: 'pendingDenuncias' },
  { label: 'Ajustes', href: '/admin/ajustes', icon: 'fa-solid fa-gear' },
  { label: 'Términos y condiciones', href: '/admin/terminos', icon: 'fa-solid fa-file-contract' },
  { label: 'Política de privacidad', href: '/admin/privacidad', icon: 'fa-solid fa-user-shield' },
]

const isActiveItem = (item) =>
  currentPath === item.href || (item.href !== '/admin' && currentPath.startsWith(`${item.href}/`))

const handleAvatarError = () => {
  avatarImageFailed.value = true
}

const closeMobileNav = () => {
  isMobileNavOpen.value = false
}

const toggleMobileNav = () => {
  isMobileNavOpen.value = !isMobileNavOpen.value
}

const handleLogout = async () => {
  logout()
  window.location.href = '/'
}

const handleEscapeKey = (event) => {
  if (event.key === 'Escape') {
    closeMobileNav()
  }
}

watch(isMobileNavOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onMounted(() => {
  window.addEventListener('keydown', handleEscapeKey)

  const authState = getCurrentApiAuth()
  currentUser.value = authState?.user || null
  avatarImageFailed.value = false

  if (!authState?.accessToken) {
    hasAdminAccess.value = false
    isCheckingAccess.value = false
    return
  }

  getMe()
    .then((user) => {
      currentUser.value = user
      hasAdminAccess.value = adminRoles.has(String(user?.role || '').trim().toLowerCase())
      if (hasAdminAccess.value) {
        loadNavCounts()
      }
    })
    .catch(() => {
      hasAdminAccess.value = false
    })
    .finally(() => {
      isCheckingAccess.value = false
    })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscapeKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <section class="min-h-screen bg-[#050713] text-white">
    <div class="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(217,70,239,0.2),transparent_30%),radial-gradient(circle_at_88%_14%,rgba(34,211,238,0.12),transparent_28%),linear-gradient(180deg,#080a18_0%,#050713_55%,#03040d_100%)]"></div>

    <div
      v-if="isCheckingAccess"
      class="relative z-10 grid min-h-screen place-items-center px-4 text-center"
    >
      <div class="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30">
        <p class="text-sm font-black uppercase tracking-[0.28em] text-fuchsia-300">
          {{ $t('admin.page.checkingAccess') }}
        </p>
        <h1 class="mt-3 text-3xl font-black">{{ $t('admin.page.panelTitle') }}</h1>
      </div>
    </div>

    <div
      v-else-if="!hasAdminAccess"
      class="relative z-10 grid min-h-screen place-items-center px-4 text-center"
    >
      <div class="max-w-md rounded-3xl border border-red-300/20 bg-red-500/10 p-8 shadow-2xl shadow-black/30">
        <p class="text-sm font-black uppercase tracking-[0.28em] text-red-200">
          {{ $t('admin.page.restricted') }}
        </p>
        <h1 class="mt-3 text-3xl font-black">{{ $t('admin.page.adminsOnly') }}</h1>
        <p class="mt-3 text-sm leading-6 text-red-100/80">
          {{ $t('admin.page.loginWithAdmin') }}
        </p>
        <a
          href="/"
          class="mt-6 inline-flex rounded-full bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
        >
          {{ $t('admin.page.backToWeb') }}
        </a>
      </div>
    </div>

    <div v-else class="relative z-10 flex min-h-screen">
      <div
        v-if="isMobileNavOpen"
        class="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        @click="closeMobileNav"
      ></div>

      <aside
        class="fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[min(18.5rem,88vw)] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-slate-950/95 p-4 backdrop-blur-xl transition-transform duration-300 ease-out sm:w-72 sm:p-5 lg:translate-x-0"
        :class="[
          isMobileNavOpen ? 'translate-x-0' : '-translate-x-full max-lg:pointer-events-none lg:translate-x-0',
        ]"
      >
        <div class="flex items-center justify-between gap-3">
          <a href="/" class="flex min-w-0 items-center gap-3" @click="closeMobileNav">
            <span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10 sm:size-12">
              <img src="/logo-votos.png" alt="Votos Musica Mundial" class="size-9 object-contain sm:size-10" />
            </span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-black uppercase leading-none">
                Music Mundial VOTING
              </span>
              <span class="mt-1 block text-[10px] font-bold uppercase tracking-[0.26em] text-fuchsia-300">
                {{ $t('admin.page.adminPanel') }}
              </span>
            </span>
          </a>

          <button
            type="button"
            class="grid size-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 lg:hidden"
            :aria-label="$t('admin.page.closeMenu')"
            @click="closeMobileNav"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <nav
          class="mt-6 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-1"
          :aria-label="$t('admin.page.navigation')"
        >
          <a
            v-for="item in navItems"
            :key="item.label"
            :href="item.href"
            class="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-black transition sm:px-4 sm:py-3"
            :class="
              isActiveItem(item)
                ? 'bg-fuchsia-400/15 text-white ring-1 ring-fuchsia-300/30'
                : 'text-slate-400 hover:bg-white/8 hover:text-white'
            "
            @click="closeMobileNav"
          >
            <i class="w-5 shrink-0 text-center" :class="item.icon" aria-hidden="true"></i>
            <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
            <span
              v-if="navBadge(item)"
              class="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white"
            >
              {{ navBadge(item) }}
            </span>
          </a>
        </nav>

        <div class="mt-4 shrink-0 rounded-3xl border border-white/10 bg-white/5 p-3">
          <div class="flex items-center gap-3">
            <span class="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white">
              <img
                v-if="shouldShowAvatarImage"
                :src="currentUser.photoUrl || currentUser.photoURL"
                alt=""
                class="size-full object-cover"
                referrerpolicy="no-referrer"
                @error="handleAvatarError"
              />
              <span v-else>{{ userInitial }}</span>
            </span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-black text-white">{{ userName }}</span>
              <span class="block truncate text-xs text-slate-400">{{ userEmail }}</span>
            </span>
          </div>

          <div class="mt-3 grid gap-2">
            <a
              href="/"
              class="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-100 transition hover:bg-white/10"
              @click="closeMobileNav"
            >
              <i class="fa-solid fa-globe" aria-hidden="true"></i>
              {{ $t('admin.page.goToWeb') }}
            </a>
            <button
              type="button"
              class="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 text-sm font-black text-red-100 transition hover:bg-red-500/20"
              @click="handleLogout"
            >
              <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
              {{ $t('admin.page.logout') }}
            </button>
          </div>
        </div>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col overflow-x-hidden lg:ml-72">
        <header class="sticky top-0 z-20 border-b border-white/10 bg-[#050713]/90 px-3 py-3 backdrop-blur-xl sm:px-6 sm:py-4 lg:px-8">
          <div class="flex items-start gap-3 sm:items-center sm:justify-between">
            <div class="flex min-w-0 flex-1 items-start gap-3">
              <button
                type="button"
                class="mt-0.5 grid size-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10 lg:hidden"
                :aria-label="isMobileNavOpen ? $t('admin.page.closeMenu') : $t('admin.page.openMenu')"
                :aria-expanded="isMobileNavOpen"
                @click="toggleMobileNav"
              >
                <i class="fa-solid" :class="isMobileNavOpen ? 'fa-xmark' : 'fa-bars'" aria-hidden="true"></i>
              </button>

              <div class="min-w-0">
                <p class="text-[10px] font-black uppercase tracking-[0.28em] text-fuchsia-300 sm:text-xs sm:tracking-[0.3em]">
                  {{ $t('admin.page.administrativePanel') }}
                </p>
                <h1 class="mt-1 truncate text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">
                  {{ pageTitle }}
                </h1>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-2 sm:gap-3">
              <a
                href="/"
                class="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                {{ $t('admin.page.viewWeb') }}
              </a>
              <a
                href="/admin/notificaciones"
                class="grid size-11 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-white"
                :aria-label="$t('admin.page.notifications')"
              >
                <i class="fa-solid fa-bell" aria-hidden="true"></i>
              </a>
            </div>
          </div>
        </header>

        <main class="min-w-0 flex-1 overflow-x-hidden px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
          <AdminPollFormView
            v-if="isPollCreateView"
          />
          <AdminPollFormView
            v-else-if="isPollEditView"
            :poll-id="pollEditId"
          />
          <AdminPollContestantsView
            v-else-if="isPollParticipantsView"
            :poll-id="pollActionId"
          />
          <AdminPollMonitorView
            v-else-if="isPollMonitorView"
            :poll-id="pollActionId"
          />
          <AdminPollWinnersView
            v-else-if="isPollWinnersView"
            :poll-id="pollActionId"
          />
          <AdminPollRoundView
            v-else-if="isPollRoundView"
            :poll-id="pollActionId"
            :round-id="roundActionId"
          />
          <AdminPollMonitorView
            v-else-if="isPollDetailView"
            :poll-id="pollActionId"
          />
          <AdminPollsView v-else-if="isPollsView" />
          <AdminArtistFormView
            v-else-if="isArtistCreateView"
          />
          <AdminArtistFormView
            v-else-if="isArtistEditView"
            :artist-id="artistEditId"
          />
          <AdminArtistsView v-else-if="isArtistsView" />
          <AdminMissionsView v-else-if="isMissionsView" />
          <AdminPushNotificationsView v-else-if="isPushNotificationsView" />
          <AdminMailView v-else-if="isMailView" />
          <AdminNotificationCampaignsView v-else-if="isNotificationCampaignsView" />
          <AdminModerationView v-else-if="isModerationView" />
          <AdminDictionaryView v-else-if="isDictionaryView" />
          <AdminContentReportsView v-else-if="isContentReportsView" />
          <AdminUserProfileView v-else-if="isUserProfileView" :user-id="userProfileId" />
          <AdminUsersView v-else-if="isUsersView" />
          <AdminSettingsView v-else-if="isSettingsView" />
          <AdminTermsView v-else-if="isTermsView" />
          <AdminPrivacyView v-else-if="isPrivacyView" />
          <AdminPollCategoriesView
            v-else-if="isCategoriesView || isCategoryCreateView"
            :show-form="isCategoryCreateView"
          />
          <AdminDashboardView v-else />
        </main>
      </div>
    </div>
  </section>
</template>
