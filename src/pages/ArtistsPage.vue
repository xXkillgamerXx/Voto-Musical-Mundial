<script setup>
import { computed, onMounted, ref } from 'vue'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

const artists = ref([])
const searchQuery = ref('')
const isLoading = ref(true)
const errorMessage = ref('')

const getArtistImage = (artist) =>
  artist?.image || artist?.imageUrl || artist?.photo || artist?.photoURL || artist?.foto || artist?.banner || ''

const getArtistBanner = (artist) =>
  artist?.banner || artist?.bannerUrl || artist?.cover || artist?.coverImage || artist?.portada || getArtistImage(artist)

const getArtistGroup = (artist) => artist?.group || artist?.fandom || ''

const artistUrl = (artist) => `/artista/${artist.slug || artist.id}`

const popularArtists = computed(() => {
  const normalizedQuery = searchQuery.value.trim().toLowerCase()
  const sourceArtists = normalizedQuery
    ? artists.value.filter((artist) => {
      const searchableText = [
        artist.name,
        artist.fandom,
        artist.group,
        artist.country,
        artist.role,
        artist.bio,
      ].filter(Boolean).join(' ').toLowerCase()

      return searchableText.includes(normalizedQuery)
    })
    : artists.value

  return sourceArtists
    .slice()
    .sort((current, next) =>
      next.followersCount - current.followersCount
        || next.popularityScore - current.popularityScore
        || current.name.localeCompare(next.name),
    )
})

const loadArtists = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const artistsSnap = await getDocs(collection(db, 'artists'))
    const artistRows = await Promise.all(
      artistsSnap.docs.map(async (artistDoc) => {
        const artist = {
          id: artistDoc.id,
          ...artistDoc.data(),
        }
        const followersSnap = await getDocs(collection(db, 'artists', artistDoc.id, 'followers'))
        const followersCount = followersSnap.size

        return {
          ...artist,
          followersCount,
          popularityScore: Number(artist.popularityScore || followersCount * 10),
        }
      }),
    )

    artists.value = artistRows
  } catch {
    errorMessage.value = 'No se pudieron cargar los artistas populares.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadArtists)
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-8 sm:px-6 lg:py-12">
    <div class="rounded-4xl border border-white/10 bg-white/4 p-6 shadow-2xl shadow-violet-950/20 sm:p-8">
      <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
        Artistas
      </p>
      <h1 class="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
        Artistas populares
      </h1>
      <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
        Ranking público por seguidores. Entra al perfil de cada artista para ver su popularidad, votos y apoyo del fandom.
      </p>
    </div>

    <div class="mt-6 rounded-3xl border border-white/10 bg-[#090b19]/80 p-4 shadow-xl shadow-violet-950/20 sm:p-5">
      <label class="relative block">
        <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fuchsia-200">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        </span>
        <input
          v-model="searchQuery"
          type="search"
          class="min-h-13 w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/45 focus:bg-white/8"
          placeholder="Buscar por artista, fandom, país o rol..."
        />
      </label>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-500">
        <span>
          {{ searchQuery ? `${popularArtists.length} resultado(s)` : `${artists.length} artistas disponibles` }}
        </span>
        <button
          v-if="searchQuery"
          type="button"
          class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-200 transition hover:bg-white/10"
          @click="searchQuery = ''"
        >
          Limpiar búsqueda
        </button>
      </div>
    </div>

    <p
      v-if="errorMessage"
      class="mt-6 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
    >
      {{ errorMessage }}
    </p>

    <div
      v-if="isLoading"
      class="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm font-bold text-slate-300"
    >
      Cargando artistas...
    </div>

    <div v-else-if="popularArtists.length" class="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="artist in popularArtists"
        :key="artist.id"
        class="group overflow-hidden rounded-4xl border border-white/10 bg-[#090b19]/90 shadow-2xl shadow-violet-950/20 transition hover:-translate-y-1 hover:border-fuchsia-300/35 hover:shadow-fuchsia-950/35"
      >
        <a :href="artistUrl(artist)" class="block">
          <div class="relative h-72 overflow-hidden bg-linear-to-br from-violet-950 via-fuchsia-950 to-slate-950">
            <img
              v-if="getArtistBanner(artist)"
              :src="getArtistBanner(artist)"
              :alt="artist.name"
              class="absolute inset-0 size-full object-cover opacity-75 transition duration-500 group-hover:scale-105"
            />
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.22),transparent_24%),linear-gradient(180deg,rgba(8,10,24,0.12),#080a18_92%)]"></div>
            <span class="absolute right-4 top-4 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
              Popular
            </span>

            <div class="absolute inset-x-0 bottom-0 p-5">
              <div class="flex items-end gap-3">
                <span class="grid size-20 shrink-0 place-items-center overflow-hidden rounded-3xl border-2 border-fuchsia-300/40 bg-linear-to-br from-violet-500 to-fuchsia-500 text-2xl font-black text-white shadow-xl shadow-fuchsia-950/25">
                  <img
                    v-if="getArtistImage(artist)"
                    :src="getArtistImage(artist)"
                    :alt="artist.name"
                    class="size-full object-cover"
                  />
                  <span v-else>{{ artist.name?.charAt(0) || 'A' }}</span>
                </span>
                <span class="min-w-0">
                  <span class="block truncate text-3xl font-black leading-none text-white">{{ artist.name }}</span>
                  <span class="mt-2 block truncate text-xs font-black uppercase tracking-widest text-fuchsia-200">{{ getArtistGroup(artist) || 'Sin grupo' }}</span>
                </span>
              </div>
            </div>
          </div>

          <div class="p-5">
            <p class="line-clamp-2 min-h-12 text-sm leading-6 text-slate-400">
              {{ artist.bio || 'Perfil público del artista con popularidad, seguidores y actividad en votaciones.' }}
            </p>

            <div class="mt-5 grid grid-cols-2 gap-3">
              <div class="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-cyan-200/80">Seguidores</p>
                <p class="mt-1 text-2xl font-black text-white">{{ artist.followersCount.toLocaleString('es') }}</p>
              </div>
              <div class="rounded-2xl border border-amber-300/15 bg-amber-400/10 p-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-amber-200/80">Popularidad</p>
                <p class="mt-1 text-2xl font-black text-white">{{ artist.popularityScore.toLocaleString('es') }}</p>
              </div>
            </div>

            <span class="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition group-hover:scale-[1.01]">
              Ver perfil
            </span>
          </div>
        </a>
      </article>
    </div>

    <div v-else class="mt-8 rounded-4xl border border-white/10 bg-slate-950/45">
      <p class="px-4 py-10 text-center text-sm font-bold text-slate-400">
        {{ searchQuery ? 'No encontramos artistas con esa búsqueda.' : 'Todavía no hay artistas para mostrar.' }}
      </p>
    </div>
  </section>
</template>
