<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  createAdminPoll,
  getAdminPollCategories,
  updateAdminPoll,
  uploadAdminImage,
} from '../../services/api/adminApi'
import { getPoll } from '../../services/api/pollsApi'
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
  anonymousVotingEnabled: true,
  anonymousVotingCooldownMinutes: 60,
  anonymousVotingBlockByIp: true,
  hideVoteCounts: false,
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
  categories.value.find((category) => String(category.id) === String(pollForm.value.categoryId)) || null,
)

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

const normalizeCategory = (category) => {
  const metadata = category?.metadata || {}

  return {
    ...metadata,
    ...category,
    id: String(category.id),
    year: Number(metadata.year || category.year || new Date().getFullYear()),
    icon: metadata.icon || category.icon || '',
    visual: metadata.visual || category.visual || '',
  }
}

const normalizePoll = (poll) => {
  const metadata = poll?.metadata || poll?.config || {}
  const category = poll?.category || null

  return {
    ...metadata,
    ...poll,
    id: String(poll.id),
    banner: metadata.banner || poll.banner || '',
    categoryId: poll.categoryId ? String(poll.categoryId) : metadata.categoryId || '',
    categoryName: category?.name || metadata.categoryName || poll.categoryName || poll.title || '',
    year: Number(metadata.year || poll.year || new Date().getFullYear()),
    anonymousVoting: metadata.anonymousVoting || poll.anonymousVoting || {},
  }
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

  isUploadingBanner.value = true

  try {
    const upload = await uploadAdminImage('poll-banner', file)
    pollForm.value.banner = upload.path || upload.url || ''
    successMessage.value = 'Banner subido correctamente.'
  } catch (error) {
    errorMessage.value = error.message || 'No se pudo subir el banner.'
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
  const rows = await getAdminPollCategories()
  categories.value = rows.map(normalizeCategory).sort((current, next) =>
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
    const poll = normalizePoll(await getPoll(props.pollId))
    pollForm.value = {
      title: poll.title || '',
      description: poll.description || '',
      banner: poll.banner || '',
      status: poll.status || 'draft',
      categoryId: poll.categoryId || '',
      categoryName: poll.categoryName || poll.title || '',
      year: Number(poll.year || new Date().getFullYear()),
      anonymousVotingEnabled: poll.anonymousVoting?.enabled !== false,
      anonymousVotingCooldownMinutes: Number(poll.anonymousVoting?.cooldownMinutes || 60),
      anonymousVotingBlockByIp: poll.anonymousVoting?.blockByIp !== false,
      hideVoteCounts: Boolean(poll.hideVoteCounts),
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
    type: 'standard',
    displayType: 'list',
    phase: 'initial',
    year: Number(pollForm.value.year || selectedCategory.value?.year || new Date().getFullYear()),
    slug: createSlug(pollForm.value.title),
    anonymousVoting: {
      enabled: Boolean(pollForm.value.anonymousVotingEnabled),
      cooldownMinutes: Math.max(
        1,
        Math.floor(Number(pollForm.value.anonymousVotingCooldownMinutes || 60)),
      ),
      blockByIp: Boolean(pollForm.value.anonymousVotingBlockByIp),
    },
    hideVoteCounts: Boolean(pollForm.value.hideVoteCounts),
    isLive: pollForm.value.status === 'live',
    winnersStatus: pollForm.value.status === 'closed' ? 'selected' : 'pending',
  }

  try {
    if (isEditing.value) {
      await updateAdminPoll(props.pollId, pollData)
      successMessage.value = translate('admin.pollForm.updated')
    } else {
      await createAdminPoll({
        ...pollData,
        winnerIds: [],
      })
      window.location.href = '/admin/votaciones'
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
            <input
              v-model="pollForm.banner"
              type="text"
              class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-300/40"
              placeholder="/uploads/admin/poll-banner/imagen.webp"
            />
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

          <div class="rounded-3xl border border-violet-300/20 bg-violet-400/10 p-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span class="text-xs font-bold uppercase tracking-widest text-violet-200">{{ $t('admin.pollForm.hideVoteCounts') }}</span>
                <p class="mt-1 text-sm leading-6 text-slate-300">
                  {{ $t('admin.pollForm.hideVoteCountsHelp') }}
                </p>
              </div>
              <label class="inline-flex items-center gap-3 text-sm font-black text-violet-100">
                <input
                  v-model="pollForm.hideVoteCounts"
                  type="checkbox"
                  class="size-5 accent-violet-400"
                />
                {{ $t('admin.pollForm.hideVoteCountsEnabled') }}
              </label>
            </div>
          </div>

          <div class="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span class="text-xs font-bold uppercase tracking-widest text-cyan-200">{{ $t('admin.pollForm.anonymousVoting') }}</span>
                <p class="mt-1 text-sm leading-6 text-slate-300">
                  {{ $t('admin.pollForm.anonymousVotingHelp') }}
                </p>
              </div>
              <label class="inline-flex items-center gap-3 text-sm font-black text-cyan-100">
                <input
                  v-model="pollForm.anonymousVotingEnabled"
                  type="checkbox"
                  class="size-5 accent-cyan-400"
                />
                {{ $t('admin.pollForm.anonymousVotingEnabled') }}
              </label>
            </div>

            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400">{{ $t('admin.pollForm.anonymousCooldown') }}</span>
                <input
                  v-model.number="pollForm.anonymousVotingCooldownMinutes"
                  type="number"
                  min="1"
                  max="1440"
                  class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                />
              </label>

              <label class="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-black text-slate-200">
                <input
                  v-model="pollForm.anonymousVotingBlockByIp"
                  type="checkbox"
                  class="size-5 accent-cyan-400"
                />
                {{ $t('admin.pollForm.anonymousBlockByIp') }}
              </label>
            </div>
          </div>

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
