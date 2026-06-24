<script setup>
import { computed, onMounted, ref } from 'vue'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../firebase'
import AdminArtistFormView from '../components/AdminArtistFormView.vue'
import AdminArtistsView from '../components/AdminArtistsView.vue'
import AdminDashboardView from '../components/AdminDashboardView.vue'
import AdminUsersView from '../components/AdminUsersView.vue'

const currentPath = window.location.pathname
const isArtistsView = computed(() => currentPath === '/admin/artistas')
const isArtistCreateView = computed(() => currentPath === '/admin/artistas/crear')
const isArtistEditView = computed(() => currentPath.startsWith('/admin/artistas/editar/'))
const artistEditId = computed(() => currentPath.replace('/admin/artistas/editar/', ''))
const isUsersView = computed(() => currentPath === '/admin/usuarios')
const pageTitle = computed(() => {
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

  return 'Dashboard'
})
const isCheckingAccess = ref(true)
const hasAdminAccess = ref(false)

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: 'fa-solid fa-chart-line' },
  { label: 'Votaciones', href: '/admin/votaciones', icon: 'fa-solid fa-check-to-slot' },
  { label: 'Artistas', href: '/admin/artistas', icon: 'fa-solid fa-microphone-lines' },
  { label: 'Usuarios', href: '/admin/usuarios', icon: 'fa-solid fa-users' },
  { label: 'Reportes', href: '/admin/reportes', icon: 'fa-solid fa-flag' },
  { label: 'Ajustes', href: '/admin/ajustes', icon: 'fa-solid fa-gear' },
]

const isActiveItem = (item) =>
  currentPath === item.href || (item.href !== '/admin' && currentPath.startsWith(`${item.href}/`))

onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      hasAdminAccess.value = false
      isCheckingAccess.value = false
      return
    }

    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid))
      hasAdminAccess.value = userSnap.data()?.role === 'admin'
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
          Verificando acceso
        </p>
        <h1 class="mt-3 text-3xl font-black">Panel admin</h1>
      </div>
    </div>

    <div
      v-else-if="!hasAdminAccess"
      class="relative z-10 grid min-h-screen place-items-center px-4 text-center"
    >
      <div class="max-w-md rounded-3xl border border-red-300/20 bg-red-500/10 p-8 shadow-2xl shadow-black/30">
        <p class="text-sm font-black uppercase tracking-[0.28em] text-red-200">
          Acceso restringido
        </p>
        <h1 class="mt-3 text-3xl font-black">Solo admins</h1>
        <p class="mt-3 text-sm leading-6 text-red-100/80">
          Inicia sesion con una cuenta que tenga role admin para entrar al panel.
        </p>
        <a
          href="/"
          class="mt-6 inline-flex rounded-full bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
        >
          Volver a la web
        </a>
      </div>
    </div>

    <div v-else class="relative z-10 flex min-h-screen">
      <aside class="hidden w-72 shrink-0 border-r border-white/10 bg-slate-950/65 p-5 backdrop-blur-xl lg:block">
        <a href="/" class="flex items-center gap-3">
          <span class="grid size-12 place-items-center rounded-2xl bg-white/10">
            <img src="/logo-votos.png" alt="Votos Musica Mundial" class="size-10 object-contain" />
          </span>
          <span>
            <span class="block text-sm font-black uppercase leading-none">
              Votos Mundial
            </span>
            <span class="mt-1 block text-[10px] font-bold uppercase tracking-[0.26em] text-fuchsia-300">
              Admin panel
            </span>
          </span>
        </a>

        <nav class="mt-8 space-y-2">
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
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header class="sticky top-0 z-20 border-b border-white/10 bg-[#050713]/80 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300">
                Panel administrativo
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
                Ver web
              </a>
              <button
                type="button"
                class="grid size-11 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-white"
                aria-label="Notificaciones"
              >
                <i class="fa-solid fa-bell" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </header>

        <main class="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <AdminArtistFormView
            v-if="isArtistCreateView"
          />
          <AdminArtistFormView
            v-else-if="isArtistEditView"
            :artist-id="artistEditId"
          />
          <AdminArtistsView v-else-if="isArtistsView" />
          <AdminUsersView v-else-if="isUsersView" />
          <AdminDashboardView v-else />
        </main>
      </div>
    </div>
  </section>
</template>
