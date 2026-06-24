<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { db, storage } from '../../firebase'

const props = defineProps({
  artistId: {
    type: String,
    default: '',
  },
})

const emptyArtist = {
  name: '',
  group: '',
  country: '',
  role: '',
  image: '',
  banner: '',
  bio: '',
  status: 'active',
}

const artistForm = ref({ ...emptyArtist })
const isLoading = ref(false)
const isSaving = ref(false)
const isUploadingBanner = ref(false)
const isUploadingProfile = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isEditing = computed(() => Boolean(props.artistId))
const formTitle = computed(() => (isEditing.value ? 'Editar artista' : 'Crear artista'))

const getArtistImage = (artist) =>
  artist.image || artist.imageUrl || artist.photo || artist.photoURL || artist.foto || ''

const getArtistBanner = (artist) =>
  artist.banner || artist.bannerUrl || artist.cover || artist.coverImage || artist.portada || ''

const createSlug = (value) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const sanitizeFileName = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/(^-|-$)/g, '')

const uploadArtistImage = async (file, field) => {
  if (!file) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  if (!file.type.startsWith('image/')) {
    errorMessage.value = 'Solo puedes subir imagenes.'
    return
  }

  const isBanner = field === 'banner'
  const artistSlug = createSlug(artistForm.value.name || 'artista')
  const fileName = sanitizeFileName(file.name)
  const imageRef = storageRef(storage, `artists/${artistSlug}/${Date.now()}-${field}-${fileName}`)

  if (isBanner) {
    isUploadingBanner.value = true
  } else {
    isUploadingProfile.value = true
  }

  try {
    await uploadBytes(imageRef, file)
    artistForm.value[field] = await getDownloadURL(imageRef)
    successMessage.value = isBanner ? 'Banner subido.' : 'Foto de perfil subida.'
  } catch {
    errorMessage.value = 'No se pudo subir la imagen.'
  } finally {
    if (isBanner) {
      isUploadingBanner.value = false
    } else {
      isUploadingProfile.value = false
    }

  }
}

const handleImageInput = (event, field) => {
  const [file] = event.target.files || []
  uploadArtistImage(file, field)
  event.target.value = ''
}

const handleImageDrop = (event, field) => {
  const [file] = event.dataTransfer.files || []
  uploadArtistImage(file, field)
}

const loadArtist = async () => {
  if (!props.artistId) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const artistSnap = await getDoc(doc(db, 'artists', props.artistId))

    if (!artistSnap.exists()) {
      errorMessage.value = 'Ese artista no existe.'
      return
    }

    const artist = artistSnap.data()
    artistForm.value = {
      name: artist.name || '',
      group: artist.group || artist.fandom || '',
      country: artist.country || '',
      role: artist.role || '',
      image: getArtistImage(artist),
      banner: getArtistBanner(artist),
      bio: artist.bio || '',
      status: artist.status || 'active',
    }
  } catch {
    errorMessage.value = 'No se pudo cargar el artista.'
  } finally {
    isLoading.value = false
  }
}

const saveArtist = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!artistForm.value.name.trim()) {
    errorMessage.value = 'El nombre del artista es obligatorio.'
    return
  }

  isSaving.value = true

  const artistData = {
    ...artistForm.value,
    name: artistForm.value.name.trim(),
    group: artistForm.value.group.trim(),
    fandom: artistForm.value.group.trim(),
    country: artistForm.value.country.trim(),
    role: artistForm.value.role.trim(),
    image: artistForm.value.image.trim(),
    banner: artistForm.value.banner.trim(),
    bio: artistForm.value.bio.trim(),
    slug: createSlug(artistForm.value.name),
    updatedAt: serverTimestamp(),
  }

  try {
    if (isEditing.value) {
      await updateDoc(doc(db, 'artists', props.artistId), artistData)
      successMessage.value = 'Artista actualizado.'
    } else {
      await addDoc(collection(db, 'artists'), {
        ...artistData,
        createdAt: serverTimestamp(),
      })
      successMessage.value = 'Artista creado.'
      artistForm.value = { ...emptyArtist }
    }
  } catch {
    errorMessage.value = 'No se pudo guardar el artista.'
  } finally {
    isSaving.value = false
  }
}

onMounted(loadArtist)
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
          Artistas
        </p>
        <h2 class="mt-2 text-3xl font-black text-white">
          {{ formTitle }}
        </h2>
        <p class="mt-2 text-sm text-slate-400">
          Esta vista es aparte de la tabla y tiene su propia URL.
        </p>
      </div>

      <a
        href="/admin/artistas"
        class="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
      >
        Volver a la lista
      </a>
    </div>

    <article class="rounded-3xl border border-fuchsia-300/20 bg-[#090b19] p-5 shadow-2xl shadow-fuchsia-950/30 sm:p-6">
      <div
        v-if="isLoading"
        class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-300"
      >
        Cargando artista...
      </div>

      <form v-else class="grid gap-6 xl:grid-cols-[0.72fr_1fr]" @submit.prevent="saveArtist">
        <div class="self-start overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60">
          <div class="relative h-52 bg-linear-to-br from-violet-950 to-fuchsia-950">
            <img
              v-if="artistForm.banner"
              :src="artistForm.banner"
              :alt="artistForm.name || 'Banner del artista'"
              class="size-full object-cover"
            />
            <div v-else class="grid size-full place-items-center px-6 text-center">
              <div>
                <i class="fa-solid fa-image text-5xl text-white/30" aria-hidden="true"></i>
                <p class="mt-4 text-sm font-bold text-slate-400">
                  El banner aparece aqui cuando agregas una URL.
                </p>
              </div>
            </div>
            <div class="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
          </div>
          <div class="-mt-12 p-5">
            <span
              class="relative grid size-24 place-items-center overflow-hidden rounded-3xl border-4 border-slate-950 bg-linear-to-br from-violet-500 to-fuchsia-500 text-3xl font-black text-white shadow-xl shadow-black/30"
            >
              <img
                v-if="artistForm.image"
                :src="artistForm.image"
                :alt="artistForm.name || 'Foto del artista'"
                class="size-full object-cover"
              />
              <span v-else>{{ artistForm.name?.charAt(0) || 'A' }}</span>
            </span>
            <h3 class="mt-3 truncate text-2xl font-black text-white">
              {{ artistForm.name || 'Nombre del artista' }}
            </h3>
            <p class="mt-1 truncate text-sm font-bold uppercase text-fuchsia-200">
              {{ artistForm.group || 'Grupo musical / Banda' }}
            </p>
          </div>
        </div>

        <div class="space-y-4">
          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Nombre</span>
            <input
              v-model="artistForm.name"
              type="text"
              required
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
              placeholder="Jungkook"
            />
          </label>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Grupo musical / Banda</span>
              <input
                v-model="artistForm.group"
                type="text"
                class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
                placeholder="BLACKPINK, BTS, solista..."
              />
            </label>

            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Pais</span>
              <input
                v-model="artistForm.country"
                type="text"
                class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
                placeholder="Corea del Sur"
              />
            </label>
          </div>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Rol</span>
            <input
              v-model="artistForm.role"
              type="text"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
              placeholder="Vocalista, bailarin, solista"
            />
          </label>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Banner</span>
              <label
                class="mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-fuchsia-300/35 bg-fuchsia-400/10 px-4 text-center text-xs font-black uppercase tracking-wide text-fuchsia-100 transition hover:bg-fuchsia-400/20"
                @dragover.prevent
                @drop.prevent="handleImageDrop($event, 'banner')"
              >
                <i class="fa-solid fa-cloud-arrow-up mb-2 text-2xl" aria-hidden="true"></i>
                {{ isUploadingBanner ? 'Subiendo banner...' : 'Arrastra o selecciona banner' }}
                <span class="mt-1 text-[10px] font-bold normal-case tracking-normal text-slate-400">
                  JPG, PNG o WebP
                </span>
                <input
                  type="file"
                  accept="image/*"
                  class="sr-only"
                  :disabled="isUploadingBanner"
                  @change="handleImageInput($event, 'banner')"
                />
              </label>
            </div>

            <div>
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Foto de perfil</span>
              <label
                class="mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-300/35 bg-cyan-400/10 px-4 text-center text-xs font-black uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-400/20"
                @dragover.prevent
                @drop.prevent="handleImageDrop($event, 'image')"
              >
                <i class="fa-solid fa-cloud-arrow-up mb-2 text-2xl" aria-hidden="true"></i>
                {{ isUploadingProfile ? 'Subiendo foto...' : 'Arrastra o selecciona foto' }}
                <span class="mt-1 text-[10px] font-bold normal-case tracking-normal text-slate-400">
                  JPG, PNG o WebP
                </span>
                <input
                  type="file"
                  accept="image/*"
                  class="sr-only"
                  :disabled="isUploadingProfile"
                  @change="handleImageInput($event, 'image')"
                />
              </label>
            </div>
          </div>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Biografia</span>
            <textarea
              v-model="artistForm.bio"
              rows="4"
              class="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
              placeholder="Descripcion corta del artista"
            ></textarea>
          </label>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Estado</span>
            <select
              v-model="artistForm.status"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm text-white outline-none transition focus:border-fuchsia-300/40"
            >
              <option value="active">Activo</option>
              <option value="draft">Borrador</option>
              <option value="hidden">Oculto</option>
            </select>
          </label>

          <p
            v-if="errorMessage"
            class="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
          >
            {{ errorMessage }}
          </p>
          <p
            v-if="successMessage"
            class="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200"
          >
            {{ successMessage }}
          </p>

          <div class="grid gap-3 sm:grid-cols-2">
            <button
              type="submit"
              class="min-h-12 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isSaving || isUploadingBanner || isUploadingProfile"
            >
              {{ isSaving ? 'Guardando...' : isEditing ? 'Actualizar artista' : 'Crear artista' }}
            </button>
            <a
              href="/admin/artistas"
              class="grid min-h-12 place-items-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
            >
              Cancelar
            </a>
          </div>
        </div>
      </form>
    </article>
  </section>
</template>
