<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { db, storage } from '../../firebase'
import { translate } from '../../i18n'

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
  categoryId: '',
  categoryName: '',
  year: new Date().getFullYear(),
}

const pollForm = ref({ ...emptyPoll })
const categories = ref([])
const isLoading = ref(false)
const isSaving = ref(false)
const isUploadingBanner = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isEditing = computed(() => Boolean(props.pollId))
const formTitle = computed(() => (isEditing.value ? translate('admin.pollForm.editTitle') : translate('admin.pollForm.createTitle')))
const selectedCategory = computed(() =>
  categories.value.find((category) => category.id === pollForm.value.categoryId) || null,
)

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
    errorMessage.value = translate('admin.pollForm.errors.imageType')
    return
  }

  const pollSlug = createSlug(pollForm.value.title || 'votacion')
  const fileName = sanitizeFileName(file.name)
  const bannerRef = storageRef(storage, `polls/${pollSlug}/${Date.now()}-banner-${fileName}`)

  isUploadingBanner.value = true

  try {
    await uploadBytes(bannerRef, file, { contentType: getImageContentType(file) })
    pollForm.value.banner = await getDownloadURL(bannerRef)
    successMessage.value = translate('admin.pollForm.uploaded')
  } catch {
    errorMessage.value = translate('admin.pollForm.errors.upload')
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

const loadCategories = async () => {
  const categoriesSnap = await getDocs(collection(db, 'pollCategories'))
  categories.value = categoriesSnap.docs.map((categoryDoc) => ({
    id: categoryDoc.id,
    ...categoryDoc.data(),
  })).sort((current, next) =>
    Number(next.year || 0) - Number(current.year || 0)
      || String(current.name || '').localeCompare(String(next.name || '')),
  )
}

const applySelectedCategory = () => {
  if (!selectedCategory.value) {
    pollForm.value.categoryName = ''
    return
  }

  pollForm.value.categoryName = selectedCategory.value.name || ''
  pollForm.value.year = Number(selectedCategory.value.year || new Date().getFullYear())

  if (!pollForm.value.title.trim()) {
    pollForm.value.title = selectedCategory.value.name || ''
  }
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
      errorMessage.value = translate('admin.pollForm.errors.missingPoll')
      return
    }

    const poll = pollSnap.data()
    pollForm.value = {
      title: poll.title || '',
      description: poll.description || '',
      banner: poll.banner || '',
      status: poll.status || 'draft',
      categoryId: poll.categoryId || '',
      categoryName: poll.categoryName || poll.title || '',
      year: Number(poll.year || new Date().getFullYear()),
    }
  } catch {
    errorMessage.value = translate('admin.pollForm.errors.load')
  } finally {
    isLoading.value = false
  }
}

const savePoll = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!pollForm.value.title.trim()) {
    errorMessage.value = translate('admin.pollForm.errors.titleRequired')
    return
  }

  isSaving.value = true

  const pollData = {
    title: pollForm.value.title.trim(),
    description: pollForm.value.description.trim(),
    banner: pollForm.value.banner.trim(),
    status: pollForm.value.status,
    categoryId: pollForm.value.categoryId || '',
    categoryName: selectedCategory.value?.name || pollForm.value.categoryName.trim() || pollForm.value.title.trim(),
    type: 'list',
    phase: 'initial',
    year: Number(pollForm.value.year || selectedCategory.value?.year || new Date().getFullYear()),
    slug: createSlug(pollForm.value.title),
    isLive: pollForm.value.status === 'live',
    winnersStatus: pollForm.value.status === 'closed' ? 'selected' : 'pending',
    updatedAt: serverTimestamp(),
  }

  try {
    if (isEditing.value) {
      await updateDoc(doc(db, 'polls', props.pollId), pollData)
      successMessage.value = translate('admin.pollForm.updated')
    } else {
      await addDoc(collection(db, 'polls'), {
        ...pollData,
        winnerIds: [],
        startAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      })
      successMessage.value = translate('admin.pollForm.created')
      pollForm.value = { ...emptyPoll }
    }
  } catch {
    errorMessage.value = translate('admin.pollForm.errors.save')
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  await loadCategories()
  await loadPoll()
})
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
          {{ $t('admin.pollForm.eyebrow') }}
        </p>
        <h2 class="mt-2 text-3xl font-black text-white">
          {{ formTitle }}
        </h2>
        <p class="mt-2 text-sm text-slate-400">
          {{ $t('admin.pollForm.formDescription') }}
        </p>
      </div>

      <a
        href="/admin/votaciones"
        class="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10 hover:text-white"
      >
        {{ $t('admin.pollForm.backToList') }}
      </a>
    </div>

    <article class="rounded-3xl border border-fuchsia-300/20 bg-[#090b19] p-5 shadow-2xl shadow-fuchsia-950/30 sm:p-6">
      <div
        v-if="isLoading"
        class="rounded-2xl border border-white/10 bg-slate-950/45 p-5 text-sm font-bold text-slate-300"
      >
        {{ $t('admin.pollForm.loading') }}
      </div>

      <form v-else class="grid gap-6 xl:grid-cols-[0.72fr_1fr]" @submit.prevent="savePoll">
        <div class="self-start overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60">
          <div class="relative h-72 bg-linear-to-br from-violet-950 to-fuchsia-950">
            <img
              v-if="pollForm.banner"
              :src="pollForm.banner"
              :alt="pollForm.title || $t('admin.pollForm.bannerAlt')"
              class="size-full object-cover"
            />
            <div v-else class="grid size-full place-items-center px-6 text-center">
              <div>
                <i class="fa-solid fa-image text-5xl text-white/30" aria-hidden="true"></i>
                <p class="mt-4 text-sm font-bold text-slate-400">
                  {{ $t('admin.pollForm.bannerHelp') }}
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
              {{ pollForm.title || $t('admin.pollForm.previewTitle') }}
            </h3>
            <p class="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">
              {{ pollForm.description || $t('admin.pollForm.previewDescription') }}
            </p>
          </div>
        </div>

        <div class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-[1fr_0.4fr]">
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.pollForm.category') }}</span>
              <select
                v-model="pollForm.categoryId"
                class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm text-white outline-none transition focus:border-fuchsia-300/40"
                @change="applySelectedCategory"
              >
                <option value="">{{ $t('admin.pollForm.noCategory') }}</option>
                <option
                  v-for="category in categories"
                  :key="category.id"
                  :value="category.id"
                >
                  {{ category.year }} · {{ category.name }}
                </option>
              </select>
              <span class="mt-2 block text-xs font-bold text-slate-500">
                {{ $t('admin.pollForm.categoryHelp') }}
              </span>
            </label>

            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.pollForm.year') }}</span>
              <input
                v-model.number="pollForm.year"
                type="number"
                min="2000"
                class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
              />
            </label>
          </div>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.pollForm.title') }}</span>
            <input
              v-model="pollForm.title"
              type="text"
              required
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
              :placeholder="$t('admin.pollForm.titlePlaceholder')"
            />
          </label>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.pollForm.hallName') }}</span>
            <input
              v-model="pollForm.categoryName"
              type="text"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
              :placeholder="$t('admin.pollForm.hallNamePlaceholder')"
            />
          </label>

          <label class="block">
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.pollForm.description') }}</span>
            <textarea
              v-model="pollForm.description"
              rows="4"
              class="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
              :placeholder="$t('admin.pollForm.descriptionPlaceholder')"
            ></textarea>
          </label>

          <div>
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.pollForm.banner') }}</span>
            <label
              class="mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-fuchsia-300/35 bg-fuchsia-400/10 px-4 text-center text-xs font-black uppercase tracking-wide text-fuchsia-100 transition hover:bg-fuchsia-400/20"
              @dragover.prevent
              @drop.prevent="handleBannerDrop"
            >
              <i class="fa-solid fa-cloud-arrow-up mb-2 text-2xl" aria-hidden="true"></i>
              {{ isUploadingBanner ? $t('admin.pollForm.uploadingBanner') : $t('admin.pollForm.selectBanner') }}
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
            <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.pollForm.status') }}</span>
            <select
              v-model="pollForm.status"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm text-white outline-none transition focus:border-fuchsia-300/40"
            >
              <option value="draft">{{ $t('common.status.draft') }}</option>
              <option value="scheduled">{{ $t('admin.pollForm.scheduled') }}</option>
              <option value="live">{{ $t('common.status.live') }}</option>
              <option value="closed">{{ $t('common.status.closed') }}</option>
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
              {{ isSaving ? $t('admin.common.saving') : isEditing ? $t('admin.pollForm.saveEdit') : $t('admin.pollForm.saveCreate') }}
            </button>
            <a
              href="/admin/votaciones"
              class="grid min-h-12 place-items-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
            >
              {{ $t('common.actions.cancel') }}
            </a>
          </div>
        </div>
      </form>
    </article>
  </section>
</template>
