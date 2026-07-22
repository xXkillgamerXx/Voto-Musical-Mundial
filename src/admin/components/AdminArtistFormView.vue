<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  createAdminArtist,
  updateAdminArtist,
  uploadAdminImage,
} from '../../services/api/adminApi'
import { getArtist } from '../../services/api/artistsApi'
import { translate } from '../../i18n'
import { resolveArtistBanner } from '../../utils/artistMedia'

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
  bioEn: '',
  slug: '',
  slugEn: '',
  status: 'active',
}

const artistForm = ref({ ...emptyArtist })
const isLoading = ref(false)
const isSaving = ref(false)
const isUploadingBanner = ref(false)
const isUploadingProfile = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const activeLocale = ref('es')
const localeTabs = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
]

const previewBanner = computed(() => resolveArtistBanner(artistForm.value))
const isEditing = computed(() => Boolean(props.artistId))
const formTitle = computed(() => (isEditing.value ? 'Editar artista' : 'Crear artista'))

const getArtistImage = (artist) =>
  artist.image || artist.imageUrl || artist.photo || artist.photoURL || artist.foto || ''

const getArtistBanner = (artist) =>
  artist.banner || artist.bannerUrl || artist.cover || artist.coverImage || artist.portada || ''

const normalizeArtist = (artist) => {
  const metadata = artist?.metadata || {}

  return {
    ...metadata,
    ...artist,
    id: String(artist.id),
    group: metadata.group || metadata.fandom || artist.group || '',
    role: metadata.role || artist.role || artist.genre || '',
    image: getArtistImage({ ...metadata, ...artist }),
    banner: getArtistBanner({ ...metadata, ...artist }),
    bio: metadata.bio || artist.bio || '',
    bioEn: metadata.bioEn || artist.bioEn || '',
    slug: artist.slug || createSlug(artist.name || ''),
    slugEn: metadata.slugEn || '',
    status: metadata.status || artist.status || 'active',
  }
}

const createSlug = (value) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const isAcceptedImageFile = (file) => {
  const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']
  const acceptedExtensions = ['.jpg', '.jpeg', '.png', '.webp']
  const fileName = file.name.toLowerCase()

  return acceptedTypes.includes(file.type)
    || acceptedExtensions.some((extension) => fileName.endsWith(extension))
}

const uploadArtistImage = async (file, field) => {
  if (!file) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  if (!isAcceptedImageFile(file)) {
    errorMessage.value = translate('admin.artistForm.errors.imageType')
    return
  }

  const uploadType = field === 'banner' ? 'artist-banner' : 'artist-profile'
  const uploadingState = field === 'banner' ? isUploadingBanner : isUploadingProfile
  uploadingState.value = true

  try {
    const upload = await uploadAdminImage(uploadType, file)
    artistForm.value[field] = upload.path || upload.url || ''
    successMessage.value = field === 'banner'
      ? 'Banner subido correctamente.'
      : 'Foto subida correctamente.'
  } catch (error) {
    errorMessage.value = error.message || 'No se pudo subir la imagen.'
  } finally {
    uploadingState.value = false
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
    const artist = normalizeArtist(await getArtist(props.artistId))

    if (!artist?.id) {
      errorMessage.value = translate('admin.artistForm.errors.missingArtist')
      return
    }

    artistForm.value = {
      name: artist.name || '',
      group: artist.group || artist.fandom || '',
      country: artist.country || '',
      role: artist.role || '',
      image: getArtistImage(artist),
      banner: getArtistBanner(artist),
      bio: artist.bio || '',
      bioEn: artist.bioEn || '',
      slug: artist.slug || createSlug(artist.name || ''),
      slugEn: artist.slugEn || '',
      status: artist.status || 'active',
    }
    activeLocale.value = 'es'
  } catch {
    errorMessage.value = translate('admin.artistForm.errors.load')
  } finally {
    isLoading.value = false
  }
}

const saveArtist = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!artistForm.value.name.trim()) {
    errorMessage.value = translate('admin.artistForm.errors.nameRequired')
    return
  }

  isSaving.value = true

  const slugEs = createSlug(artistForm.value.slug || artistForm.value.name)
  const slugEn = createSlug(artistForm.value.slugEn || artistForm.value.name)

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
    bioEn: artistForm.value.bioEn.trim(),
    slug: slugEs,
    slugEn: slugEn || slugEs,
    imageUrl: artistForm.value.image.trim(),
    photoUrl: artistForm.value.image.trim(),
    genre: artistForm.value.role.trim(),
  }

  try {
    if (isEditing.value) {
      await updateAdminArtist(props.artistId, artistData)
      successMessage.value = translate('admin.artistForm.updated')
    } else {
      await createAdminArtist(artistData)
      successMessage.value = translate('admin.artistForm.created')
      artistForm.value = { ...emptyArtist }
    }
  } catch {
    errorMessage.value = translate('admin.artistForm.errors.save')
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
              :src="previewBanner"
              :alt="artistForm.name || 'Banner del artista'"
              class="size-full object-cover"
            />
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
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.artistForm.name') }}</span>
            <input
              v-model="artistForm.name"
              type="text"
              required
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
              :placeholder="$t('admin.artistForm.namePlaceholder')"
              @blur="!artistForm.slug && (artistForm.slug = createSlug(artistForm.name))"
            />
          </label>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Slug URL (ES)</span>
              <input
                v-model="artistForm.slug"
                type="text"
                class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
                placeholder="nombre-artista"
                @blur="artistForm.slug = createSlug(artistForm.slug || artistForm.name)"
              />
              <span class="mt-1 block text-[11px] font-bold text-slate-500">/artista/{{ artistForm.slug || '...' }}</span>
            </label>
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Slug URL (EN)</span>
              <input
                v-model="artistForm.slugEn"
                type="text"
                class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
                placeholder="artist-name"
                @blur="artistForm.slugEn = createSlug(artistForm.slugEn || artistForm.name)"
              />
              <span class="mt-1 block text-[11px] font-bold text-slate-500">/artist/{{ artistForm.slugEn || artistForm.slug || '...' }}</span>
            </label>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.artistForm.group') }}</span>
              <input
                v-model="artistForm.group"
                type="text"
                class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
                :placeholder="$t('admin.artistForm.groupPlaceholder')"
              />
            </label>

            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.artistForm.country') }}</span>
              <input
                v-model="artistForm.country"
                type="text"
                class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
                :placeholder="$t('admin.artistForm.countryPlaceholder')"
              />
            </label>
          </div>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.artistForm.role') }}</span>
            <input
              v-model="artistForm.role"
              type="text"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
              :placeholder="$t('admin.artistForm.rolePlaceholder')"
            />
          </label>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.artistForm.banner') }}</span>
              <input
                v-model="artistForm.banner"
                type="text"
                class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
                placeholder="/uploads/admin/artist-banner/imagen.webp"
              />
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
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  class="sr-only"
                  :disabled="isUploadingBanner"
                  @change="handleImageInput($event, 'banner')"
                />
              </label>
            </div>

            <div>
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.artistForm.profilePhoto') }}</span>
              <input
                v-model="artistForm.image"
                type="text"
                class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                placeholder="/uploads/admin/artist-profile/imagen.webp"
              />
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
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  class="sr-only"
                  :disabled="isUploadingProfile"
                  @change="handleImageInput($event, 'image')"
                />
              </label>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              v-for="tab in localeTabs"
              :key="tab.value"
              type="button"
              class="min-h-10 rounded-2xl px-4 text-xs font-black uppercase tracking-wide transition"
              :class="
                activeLocale === tab.value
                  ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              "
              @click="activeLocale = tab.value"
            >
              {{ tab.label }}
            </button>
          </div>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">
              {{ activeLocale === 'es' ? $t('admin.artistForm.bio') + ' (ES)' : 'Bio (EN)' }}
            </span>
            <textarea
              v-if="activeLocale === 'es'"
              v-model="artistForm.bio"
              rows="4"
              class="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
              :placeholder="$t('admin.artistForm.bioPlaceholder')"
            ></textarea>
            <textarea
              v-else
              v-model="artistForm.bioEn"
              rows="4"
              class="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
              placeholder="Artist biography in English"
            ></textarea>
          </label>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.artistForm.status') }}</span>
            <select
              v-model="artistForm.status"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm text-white outline-none transition focus:border-fuchsia-300/40"
            >
              <option value="active">{{ $t('admin.artistForm.active') }}</option>
              <option value="draft">{{ $t('common.status.draft') }}</option>
              <option value="hidden">{{ $t('admin.artistForm.hidden') }}</option>
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
