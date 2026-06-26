<script setup>
import { computed, onMounted, ref } from 'vue'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../firebase'
import AdminArtistFormView from '../components/AdminArtistFormView.vue'
import AdminArtistsView from '../components/AdminArtistsView.vue'
import AdminDashboardView from '../components/AdminDashboardView.vue'
import AdminMissionsView from '../components/AdminMissionsView.vue'
import AdminPollCategoriesView from '../components/AdminPollCategoriesView.vue'
import AdminPollContestantsView from '../components/AdminPollContestantsView.vue'
import AdminPollFormView from '../components/AdminPollFormView.vue'
import AdminPollMonitorView from '../components/AdminPollMonitorView.vue'
import AdminPollsView from '../components/AdminPollsView.vue'
import AdminPollRoundView from '../components/AdminPollRoundView.vue'
import AdminPollWinnersView from '../components/AdminPollWinnersView.vue'
import AdminUsersView from '../components/AdminUsersView.vue'

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
const isMissionsView = computed(() => currentPath === '/admin/misiones')
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

  if (isUsersView.value) {
    return 'Usuarios'
  }

  if (isMissionsView.value) {
    return 'Misiones'
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

const userName = computed(() => currentUser.value?.displayName || 'Admin')
const userEmail = computed(() => currentUser.value?.email || '')
const shouldShowAvatarImage = computed(() => currentUser.value?.photoURL && !avatarImageFailed.value)
const userInitial = computed(() => {
  const source = currentUser.value?.displayName || currentUser.value?.email || 'A'

  return source.trim().charAt(0).toUpperCase()
})

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: 'fa-solid fa-chart-line' },
  { label: 'Votaciones', href: '/admin/votaciones', icon: 'fa-solid fa-check-to-slot' },
  { label: 'Categorías', href: '/admin/categorias', icon: 'fa-solid fa-trophy' },
  { label: 'Artistas', href: '/admin/artistas', icon: 'fa-solid fa-microphone-lines' },
  { label: 'Misiones', href: '/admin/misiones', icon: 'fa-solid fa-bullseye' },
  { label: 'Usuarios', href: '/admin/usuarios', icon: 'fa-solid fa-users' },
  { label: 'Reportes', href: '/admin/reportes', icon: 'fa-solid fa-flag' },
  { label: 'Ajustes', href: '/admin/ajustes', icon: 'fa-solid fa-gear' },
]

const isActiveItem = (item) =>
  currentPath === item.href || (item.href !== '/admin' && currentPath.startsWith(`${item.href}/`))

const handleAvatarError = () => {
  avatarImageFailed.value = true
}

const handleLogout = async () => {
  await signOut(auth)
  window.location.href = '/'
}

onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    currentUser.value = user
    avatarImageFailed.value = false

    if (!user) {
      hasAdminAccess.value = false
      isCheckingAccess.value = false
      return
    }

    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid))
      hasAdminAccess.value = (userSnap.data()?.role || '').toLowerCase() === 'admin'
    } catch {
      hasAdminAccess.value = false
    } finally {
      isCheckingAccess.value = false
    }
  })
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
      <aside class="hidden w-72 shrink-0 flex-col border-r border-white/10 bg-slate-950/65 p-5 backdrop-blur-xl lg:flex">
        <a href="/" class="flex items-center gap-3">
          <span class="grid size-12 place-items-center rounded-2xl bg-white/10">
            <img src="/logo-votos.png" alt="Votos Musica Mundial" class="size-10 object-contain" />
          </span>
          <span>
            <span class="block text-sm font-black uppercase leading-none">
              Votos Mundial
            </span>
            <span class="mt-1 block text-[10px] font-bold uppercase tracking-[0.26em] text-fuchsia-300">
              {{ $t('admin.page.adminPanel') }}
            </span>
          </span>
        </a>

        <nav class="mt-8 flex-1 space-y-2">
          <a
            v-for="item in navItems"
            :key="item.label"
            :href="item.href"
            class="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition"
            :class="
              isActiveItem(item)
                ? 'bg-fuchsia-400/15 text-white ring-1 ring-fuchsia-300/30'
                : 'text-slate-400 hover:bg-white/8 hover:text-white'
            "
          >
            <i class="w-5 text-center" :class="item.icon" aria-hidden="true"></i>
            {{ item.label }}
          </a>
        </nav>

        <div class="mt-6 rounded-3xl border border-white/10 bg-white/5 p-3">
          <div class="flex items-center gap-3">
            <span class="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white">
              <img
                v-if="shouldShowAvatarImage"
                :src="currentUser.photoURL"
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

      <div class="flex min-w-0 flex-1 flex-col">
        <header class="sticky top-0 z-20 border-b border-white/10 bg-[#050713]/80 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300">
                {{ $t('admin.page.administrativePanel') }}
              </p>
              <h1 class="mt-1 text-3xl font-black leading-tight sm:text-4xl">
                {{ pageTitle }}
              </h1>
            </div>

            <div class="flex items-center gap-3">
              <a
                href="/"
                class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                {{ $t('admin.page.viewWeb') }}
              </a>
              <button
                type="button"
                class="grid size-11 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-white"
                :aria-label="$t('admin.page.notifications')"
              >
                <i class="fa-solid fa-bell" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </header>

        <main class="flex-1 px-4 py-6 sm:px-6 lg:px-8">
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
          <AdminUsersView v-else-if="isUsersView" />
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
