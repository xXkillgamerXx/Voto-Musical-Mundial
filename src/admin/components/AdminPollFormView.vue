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
  pollId: {
    type: String,
    default: '',
  },
})

const emptyPoll = {
  title: '',
  description: '',
  banner: '',
  status: 'draft',
}

const pollForm = ref({ ...emptyPoll })
const isLoading = ref(false)
const isSaving = ref(false)
const isUploadingBanner = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isEditing = computed(() => Boolean(props.pollId))
const formTitle = computed(() => (isEditing.value ? 'Editar votacion' : 'Crear votacion'))

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

const isAcceptedImageFile = (file) => {
  const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']
  const acceptedExtensions = ['.jpg', '.jpeg', '.png', '.webp']
  const fileName = file.name.toLowerCase()

  return acceptedTypes.includes(file.type)
    || acceptedExtensions.some((extension) => fileName.endsWith(extension))
}

const getImageContentType = (file) => {
  const fileName = file.name.toLowerCase()

  if (file.type) {
    return file.type
  }

  if (fileName.endsWith('.webp')) {
    return 'image/webp'
  }

  if (fileName.endsWith('.png')) {
    return 'image/png'
  }

  return 'image/jpeg'
}

const uploadPollBanner = async (file) => {
  if (!file) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  if (!isAcceptedImageFile(file)) {
    errorMessage.value = 'Solo puedes subir imagenes JPG, PNG o WebP.'
    return
  }

  const pollSlug = createSlug(pollForm.value.title || 'votacion')
  const fileName = sanitizeFileName(file.name)
  const bannerRef = storageRef(storage, `polls/${pollSlug}/${Date.now()}-banner-${fileName}`)

  isUploadingBanner.value = true

  try {
    await uploadBytes(bannerRef, file, { contentType: getImageContentType(file) })
    pollForm.value.banner = await getDownloadURL(bannerRef)
    successMessage.value = 'Banner subido.'
  } catch {
    errorMessage.value = 'No se pudo subir el banner.'
  } finally {
    isUploadingBanner.value = false
  }
}

const handleBannerInput = (event) => {
  const [file] = event.target.files || []
  uploadPollBanner(file)
  event.target.value = ''
}

const handleBannerDrop = (event) => {
  const [file] = event.dataTransfer.files || []
  uploadPollBanner(file)
}

const loadPoll = async () => {
  if (!props.pollId) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const pollSnap = await getDoc(doc(db, 'polls', props.pollId))

    if (!pollSnap.exists()) {
      errorMessage.value = 'Esa votacion no existe.'
      return
    }

    const poll = pollSnap.data()
    pollForm.value = {
      title: poll.title || '',
      description: poll.description || '',
      banner: poll.banner || '',
      status: poll.status || 'draft',
    }
  } catch {
    errorMessage.value = 'No se pudo cargar la votacion.'
  } finally {
    isLoading.value = false
  }
}

const savePoll = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!pollForm.value.title.trim()) {
    errorMessage.value = 'El titulo de la votacion es obligatorio.'
    return
  }

  isSaving.value = true

  const pollData = {
    title: pollForm.value.title.trim(),
    description: pollForm.value.description.trim(),
    banner: pollForm.value.banner.trim(),
    status: pollForm.value.status,
    type: 'list',
    phase: 'initial',
    year: new Date().getFullYear(),
    slug: createSlug(pollForm.value.title),
    isLive: pollForm.value.status === 'live',
    winnersStatus: pollForm.value.status === 'closed' ? 'selected' : 'pending',
    updatedAt: serverTimestamp(),
  }

  try {
    if (isEditing.value) {
      await updateDoc(doc(db, 'polls', props.pollId), pollData)
      successMessage.value = 'Votacion actualizada.'
    } else {
      await addDoc(collection(db, 'polls'), {
        ...pollData,
        winnerIds: [],
        startAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      })
      successMessage.value = 'Votacion creada.'
      pollForm.value = { ...emptyPoll }
    }
  } catch {
    errorMessage.value = 'No se pudo guardar la votacion.'
  } finally {
    isSaving.value = false
  }
}

onMounted(loadPoll)
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
          Votaciones
        </p>
        <h2 class="mt-2 text-3xl font-black text-white">
          {{ formTitle }}
        </h2>
        <p class="mt-2 text-sm text-slate-400">
          Define la base visual y el estado general de la votacion.
        </p>
      </div>

      <a
        href="/admin/votaciones"
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
        Cargando votacion...
      </div>

      <form v-else class="grid gap-6 xl:grid-cols-[0.72fr_1fr]" @submit.prevent="savePoll">
        <div class="self-start overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60">
          <div class="relative h-72 bg-linear-to-br from-violet-950 to-fuchsia-950">
            <img
              v-if="pollForm.banner"
              :src="pollForm.banner"
              :alt="pollForm.title || 'Banner de la votacion'"
              class="size-full object-cover"
            />
            <div v-else class="grid size-full place-items-center px-6 text-center">
              <div>
                <i class="fa-solid fa-image text-5xl text-white/30" aria-hidden="true"></i>
                <p class="mt-4 text-sm font-bold text-slate-400">
                  El banner aparece aqui cuando subas una imagen.
                </p>
              </div>
            </div>
            <div class="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
            <span class="absolute left-5 top-5 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
              {{ pollForm.status }}
            </span>
          </div>
          <div class="p-5">
            <h3 class="text-2xl font-black text-white">
              {{ pollForm.title || 'Titulo de la votacion' }}
            </h3>
            <p class="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">
              {{ pollForm.description || 'Descripcion de la votacion' }}
            </p>
          </div>
        </div>

        <div class="space-y-4">
          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Titulo</span>
            <input
              v-model="pollForm.title"
              type="text"
              required
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
              placeholder="Best Global Artist 2026"
            />
          </label>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Descripcion</span>
            <textarea
              v-model="pollForm.description"
              rows="4"
              class="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
              placeholder="Describe la votacion para los usuarios."
            ></textarea>
          </label>

          <div>
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Banner</span>
            <label
              class="mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-fuchsia-300/35 bg-fuchsia-400/10 px-4 text-center text-xs font-black uppercase tracking-wide text-fuchsia-100 transition hover:bg-fuchsia-400/20"
              @dragover.prevent
              @drop.prevent="handleBannerDrop"
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
                @change="handleBannerInput"
              />
            </label>
          </div>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Estado</span>
            <select
              v-model="pollForm.status"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm text-white outline-none transition focus:border-fuchsia-300/40"
            >
              <option value="draft">Borrador</option>
              <option value="scheduled">Programada</option>
              <option value="live">En vivo</option>
              <option value="closed">Finalizada</option>
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
              :disabled="isSaving || isUploadingBanner"
            >
              {{ isSaving ? 'Guardando...' : isEditing ? 'Actualizar votacion' : 'Crear votacion' }}
            </button>
            <a
              href="/admin/votaciones"
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
