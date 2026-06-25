<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase'

const pathParts = window.location.pathname.split('/').filter(Boolean)
const routeUsername = pathParts[0] === 'user' ? (pathParts[1] || '').toLowerCase() : ''

const currentUser = ref(null)
const userProfile = ref(null)
const profileUserId = ref('')
const followedArtists = ref([])
const isLoading = ref(true)
const errorMessage = ref('')
let unsubscribeAuth = null
let unsubscribeUser = null
let unsubscribeFollowedArtists = null

const isPublicProfile = computed(() => Boolean(routeUsername))
const isOwnProfile = computed(() => currentUser.value?.uid && currentUser.value.uid === profileUserId.value)

const displayName = computed(() =>
  userProfile.value?.name || (!isPublicProfile.value ? currentUser.value?.displayName || currentUser.value?.email : '') || 'Usuario',
)

const userInitial = computed(() => displayName.value.trim().charAt(0).toUpperCase())

const artistUrl = (artist) => `/artista/${artist.artistSlug || artist.artistId}`

const listenUserProfileById = (userId, errorText = 'No se pudo cargar el perfil.') => {
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
      errorMessage.value = 'No encontramos ese usuario.'
      userProfile.value = null
      followedArtists.value = []
      isLoading.value = false
      return
    }

    listenUserProfileById(usernameSnap.data().uid, 'Este perfil no está disponible públicamente.')
  } catch {
    errorMessage.value = 'No se pudo cargar el perfil de usuario.'
    isLoading.value = false
  }
}

onMounted(() => {
  unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    currentUser.value = user

    if (isPublicProfile.value) {
      return
    }

    listenUserProfileById(user?.uid, 'No se pudo cargar tu perfil.')
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
      Cargando perfil...
    </div>

    <div
      v-else-if="!isPublicProfile && !currentUser"
      class="rounded-4xl border border-white/10 bg-white/5 p-8 text-center"
    >
      <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
        Perfil
      </p>
      <h1 class="mt-3 text-3xl font-black text-white">Inicia sesión</h1>
      <p class="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
        Necesitas iniciar sesión para ver tu perfil y tus artistas seguidos.
      </p>
      <a
        href="/registro"
        class="mt-6 inline-flex rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-black uppercase tracking-wide text-white"
      >
        Crear cuenta
      </a>
    </div>

    <div
      v-else-if="isPublicProfile && !userProfile"
      class="rounded-4xl border border-white/10 bg-white/5 p-8 text-center"
    >
      <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
        Perfil de usuario
      </p>
      <h1 class="mt-3 text-3xl font-black text-white">Usuario no disponible</h1>
      <p class="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
        {{ errorMessage || 'No encontramos ese perfil de usuario.' }}
      </p>
      <a
        href="/"
        class="mt-6 inline-flex rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-black uppercase tracking-wide text-white"
      >
        Volver al inicio
      </a>
    </div>

    <template v-else>
      <p
        v-if="errorMessage"
        class="mb-6 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
      >
        {{ errorMessage }}
      </p>

      <div class="overflow-hidden rounded-4xl border border-violet-300/15 bg-[#090b19]/90 shadow-2xl shadow-fuchsia-950/20">
        <div class="relative min-h-60 bg-linear-to-br from-violet-950 via-fuchsia-950 to-slate-950">
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(217,70,239,0.28),transparent_30%),radial-gradient(circle_at_78%_35%,rgba(34,211,238,0.2),transparent_28%)]"></div>
          <div class="absolute inset-x-0 bottom-0 p-6 sm:p-8">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
              <span class="grid size-28 shrink-0 place-items-center overflow-hidden rounded-4xl border-2 border-fuchsia-300/40 bg-linear-to-br from-violet-500 to-fuchsia-500 text-4xl font-black text-white">
                <img
                  v-if="currentUser?.photoURL && (!isPublicProfile || isOwnProfile)"
                  :src="currentUser.photoURL"
                  alt=""
                  class="size-full object-cover"
                  referrerpolicy="no-referrer"
                />
                <span v-else>{{ userInitial }}</span>
              </span>
              <div>
                <p class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
                  Perfil de usuario
                </p>
                <h1 class="mt-2 text-4xl font-black leading-none text-white sm:text-6xl">
                  {{ displayName }}
                </h1>
                <p class="mt-2 text-sm font-bold text-slate-300">
                  @{{ userProfile?.username || 'usuario' }} · {{ userProfile?.country || 'Sin país' }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="grid gap-4 p-5 sm:grid-cols-3 sm:p-8">
          <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Artistas seguidos</p>
            <p class="mt-1 text-3xl font-black text-white">{{ followedArtists.length }}</p>
          </div>
          <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {{ isPublicProfile && !isOwnProfile ? 'Usuario' : 'Correo' }}
            </p>
            <p class="mt-1 truncate text-sm font-black text-white">
              {{ isPublicProfile && !isOwnProfile ? `@${userProfile?.username || routeUsername}` : currentUser?.email }}
            </p>
          </div>
          <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Rol</p>
            <p class="mt-1 text-3xl font-black capitalize text-fuchsia-100">{{ userProfile?.role || 'fan' }}</p>
          </div>
        </div>
      </div>

      <section class="mt-8 rounded-4xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
              Favoritos
            </p>
            <h2 class="mt-2 text-2xl font-black text-white">Artistas seguidos</h2>
          </div>
          <a
            href="/artistas"
            class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-200 transition hover:bg-white/10"
          >
            Ver populares
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
              <span class="block truncate font-black text-white">{{ artist.artistName || 'Artista' }}</span>
              <span class="block text-xs font-bold text-slate-500">Siguiendo</span>
            </span>
          </a>
        </div>

        <p v-else class="mt-5 rounded-3xl border border-white/10 bg-slate-950/45 p-6 text-sm font-bold text-slate-400">
          Todavía no sigues artistas. Entra a un perfil de artista y pulsa seguir.
        </p>
      </section>
    </template>
  </section>
</template>
