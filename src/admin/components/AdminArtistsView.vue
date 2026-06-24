<script setup>
import { onMounted, ref } from 'vue'
import { collection, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase'

const artists = ref([])
const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')

const getArtistImage = (artist) =>
  artist.image
  || artist.imageUrl
  || artist.photo
  || artist.photoURL
  || artist.foto
  || artist.banner
  || artist.bannerUrl
  || artist.cover
  || artist.coverImage
  || artist.portada
  || ''

const getArtistGroup = (artist) => artist.group || artist.fandom || ''

const loadArtists = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const artistsQuery = query(collection(db, 'artists'), orderBy('createdAt', 'desc'))
    const artistsSnap = await getDocs(artistsQuery)

    artists.value = artistsSnap.docs.map((artistDoc) => ({
      id: artistDoc.id,
      ...artistDoc.data(),
    }))
  } catch {
    errorMessage.value = 'No se pudieron cargar los artistas. Revisa permisos de admin.'
  } finally {
    isLoading.value = false
  }
}

const removeArtist = async (artist) => {
  const shouldDelete = window.confirm(`Eliminar a ${artist.name}?`)

  if (!shouldDelete) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await deleteDoc(doc(db, 'artists', artist.id))
    successMessage.value = 'Artista eliminado.'
    await loadArtists()
  } catch {
    errorMessage.value = 'No se pudo eliminar el artista.'
  }
}

onMounted(loadArtists)
</script>

<template>
  <section class="space-y-6">
    <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            Base de datos
          </p>
          <h2 class="mt-2 text-3xl font-black text-white">
            Lista de artistas
          </h2>
          <p class="mt-2 text-sm text-slate-400">
            Tabla principal para ver, editar y eliminar artistas.
          </p>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            class="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
            @click="loadArtists"
          >
            Actualizar
          </button>
          <a
            href="/admin/artistas/crear"
            class="rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01]"
          >
            <i class="fa-solid fa-plus mr-2" aria-hidden="true"></i>
            Crear artista
          </a>
        </div>
      </div>

      <p
        v-if="successMessage"
        class="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200"
      >
        {{ successMessage }}
      </p>
      <p
        v-if="errorMessage"
        class="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
      >
        {{ errorMessage }}
      </p>

      <div
        v-if="isLoading"
        class="mt-6 rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-300"
      >
        Cargando artistas...
      </div>

      <div v-else class="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/45">
        <div class="overflow-x-auto">
          <table class="min-w-full text-left">
            <thead class="bg-white/5 text-xs font-black uppercase tracking-widest text-slate-400">
              <tr>
                <th class="px-4 py-4">Foto</th>
                <th class="px-4 py-4">Artista</th>
                <th class="px-4 py-4">Grupo/Banda</th>
                <th class="px-4 py-4">Pais</th>
                <th class="px-4 py-4">Rol</th>
                <th class="px-4 py-4">Estado</th>
                <th class="px-4 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/10">
              <tr
                v-for="artist in artists"
                :key="artist.id"
                class="text-sm text-slate-300 transition hover:bg-white/3"
              >
                <td class="px-4 py-4">
                  <span
                    class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-lg font-black text-white"
                  >
                    <img
                      v-if="getArtistImage(artist)"
                      :src="getArtistImage(artist)"
                      :alt="artist.name"
                      class="size-full object-cover"
                    />
                    <span v-else>{{ artist.name?.charAt(0) || 'A' }}</span>
                  </span>
                </td>
                <td class="max-w-64 px-4 py-4">
                  <p class="truncate font-black text-white">{{ artist.name }}</p>
                  <p class="mt-1 line-clamp-1 text-xs text-slate-500">
                    {{ artist.bio || 'Sin biografia' }}
                  </p>
                </td>
                <td class="px-4 py-4 font-bold text-fuchsia-200">
                  {{ getArtistGroup(artist) || '-' }}
                </td>
                <td class="px-4 py-4">
                  {{ artist.country || '-' }}
                </td>
                <td class="px-4 py-4">
                  {{ artist.role || '-' }}
                </td>
                <td class="px-4 py-4">
                  <span
                    class="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300"
                  >
                    {{ artist.status || 'active' }}
                  </span>
                </td>
                <td class="px-4 py-4">
                  <div class="flex justify-end gap-2">
                    <a
                      :href="`/admin/artistas/editar/${artist.id}`"
                      class="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/20"
                    >
                      Editar
                    </a>
                    <button
                      type="button"
                      class="rounded-full border border-red-300/25 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 transition hover:bg-red-500/20"
                      @click="removeArtist(artist)"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!artists.length">
                <td colspan="7" class="px-4 py-10 text-center">
                  <p class="text-lg font-black text-white">Todavia no hay artistas.</p>
                  <p class="mt-2 text-sm text-slate-400">
                    Crea el primer artista para verlo aqui con su foto.
                  </p>
                  <a
                    href="/admin/artistas/crear"
                    class="mt-5 inline-flex rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white"
                  >
                    Crear artista
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>
  </section>
</template>
