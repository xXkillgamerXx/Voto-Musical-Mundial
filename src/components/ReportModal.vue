<script setup>
import { computed, ref, watch } from 'vue'
import { translate } from '../i18n'
import { createContentReport } from '../services/api/reportsApi'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  targetType: {
    type: String,
    required: true,
  },
  targetId: {
    type: String,
    required: true,
  },
  reportedUserId: {
    type: String,
    default: '',
  },
  pollId: {
    type: String,
    default: '',
  },
  contextLabel: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'submitted'])

const reason = ref('offensive')
const details = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const reasonOptions = computed(() => [
  { value: 'spam', label: translate('report.reasons.spam') },
  { value: 'offensive', label: translate('report.reasons.offensive') },
  { value: 'sexual', label: translate('report.reasons.sexual') },
  { value: 'harassment', label: translate('report.reasons.harassment') },
  { value: 'other', label: translate('report.reasons.other') },
])

const resetForm = () => {
  reason.value = 'offensive'
  details.value = ''
  errorMessage.value = ''
  successMessage.value = ''
  isSubmitting.value = false
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      resetForm()
    }
  },
)

const closeModal = () => {
  emit('close')
}

const submitReport = async () => {
  if (isSubmitting.value) {
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await createContentReport({
      targetType: props.targetType,
      targetId: props.targetId,
      reason: reason.value,
      details: details.value.trim() || undefined,
      reportedUserId: props.reportedUserId || undefined,
      pollId: props.pollId || undefined,
    })

    successMessage.value = translate('report.success')
    emit('submitted')
    window.setTimeout(() => {
      closeModal()
    }, 900)
  } catch (error) {
    if (error.status === 401) {
      errorMessage.value = translate('report.loginRequired')
    } else if (error.status === 409) {
      errorMessage.value = translate('report.alreadyReported')
    } else {
      errorMessage.value = error.message || translate('report.error')
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="report-modal">
      <div
        v-if="open"
        class="fixed inset-0 z-999 grid place-items-center bg-black/75 px-4 py-6 backdrop-blur-sm"
        @click.self="closeModal"
      >
        <div
          class="relative w-full max-w-lg overflow-hidden rounded-4xl border border-red-300/20 bg-[#070a18] p-5 text-white shadow-2xl shadow-red-950/30 sm:p-6"
          role="dialog"
          aria-modal="true"
          :aria-label="$t('report.title')"
        >
          <div class="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-red-500/10 blur-3xl"></div>

          <div class="relative flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.3em] text-red-300">
                {{ $t('report.eyebrow') }}
              </p>
              <h3 class="mt-1 text-2xl font-black text-white">
                {{ $t('report.title') }}
              </h3>
              <p v-if="contextLabel" class="mt-2 text-sm font-bold text-slate-400">
                {{ contextLabel }}
              </p>
            </div>
            <button
              type="button"
              class="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/8 text-lg font-black text-white transition hover:bg-white/15"
              @click="closeModal"
            >
              ×
            </button>
          </div>

          <form class="relative mt-5 space-y-4" @submit.prevent="submitReport">
            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">
                {{ $t('report.reasonLabel') }}
              </span>
              <select
                v-model="reason"
                class="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition focus:border-red-300/40"
              >
                <option
                  v-for="option in reasonOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="block">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">
                {{ $t('report.detailsLabel') }}
              </span>
              <textarea
                v-model="details"
                rows="3"
                maxlength="500"
                class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-red-300/40"
                :placeholder="$t('report.detailsPlaceholder')"
              ></textarea>
            </label>

            <p class="text-xs leading-5 text-slate-500">
              {{ $t('report.disclaimer') }}
            </p>

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
                type="button"
                class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
                @click="closeModal"
              >
                {{ $t('common.actions.cancel') }}
              </button>
              <button
                type="submit"
                class="min-h-12 rounded-2xl bg-linear-to-r from-red-500 to-rose-600 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-red-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="isSubmitting"
              >
                {{ isSubmitting ? $t('report.submitting') : $t('report.submit') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.report-modal-enter-active,
.report-modal-leave-active {
  transition: opacity 0.18s ease;
}

.report-modal-enter-from,
.report-modal-leave-to {
  opacity: 0;
}
</style>
