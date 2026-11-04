<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { getNewsCommentReportOptions, reportNewsComment } from '../../../src/services/api/newsApi'
import { t } from '../lib/copy'

const props = defineProps<{
  open: boolean
  slug: string
  commentId: string
  locale?: string
}>()

const emit = defineEmits<{ close: []; submitted: [] }>()

type Option = { key: string; label: string }

const loc = () => (props.locale === 'en' ? 'en' : 'es')
const options = ref<Option[]>([])
const reason = ref('')
const details = ref('')
const loading = ref(false)
const sending = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const reasonOpen = ref(false)
const reasonListId = 'mm-report-reason-list'

const selectedLabel = computed(
  () => options.value.find((option) => option.key === reason.value)?.label || '',
)

const loadOptions = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const payload = await getNewsCommentReportOptions(loc())
    options.value = payload.items || []
    if (!reason.value && options.value[0]) reason.value = options.value[0].key
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t(loc(), 'commentsReportError')
  } finally {
    loading.value = false
  }
}

const reset = () => {
  details.value = ''
  errorMessage.value = ''
  successMessage.value = ''
  sending.value = false
  reasonOpen.value = false
  if (options.value[0]) reason.value = options.value[0].key
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      reasonOpen.value = false
      return
    }
    reset()
    void loadOptions()
  },
)

onMounted(() => {
  if (props.open) void loadOptions()
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && reasonOpen.value) {
    reasonOpen.value = false
    event.stopPropagation()
  }
}

const close = () => emit('close')

const pickReason = (key: string) => {
  reason.value = key
  reasonOpen.value = false
}

const submit = async () => {
  if (sending.value || !reason.value || !props.commentId) return
  sending.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await reportNewsComment(props.slug, props.commentId, { reason: reason.value, details: details.value.trim() }, loc())
    successMessage.value = t(loc(), 'commentsReportSuccess')
    emit('submitted')
    window.setTimeout(() => close(), 900)
  } catch (error: any) {
    if (error?.status === 401) errorMessage.value = t(loc(), 'commentsReportLogin')
    else if (error?.status === 409) errorMessage.value = t(loc(), 'commentsReportAlready')
    else errorMessage.value = error instanceof Error ? error.message : t(loc(), 'commentsReportError')
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="notice-modal mm-report-modal" @click.self="close">
      <div
        class="notice-dialog mm-report-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="t(loc(), 'commentsReportTitle')"
        @click="reasonOpen = false"
      >
        <button class="mm-report-close" type="button" :aria-label="t(loc(), 'commentsCancelReply')" @click="close">×</button>
        <p class="mm-report-kicker">{{ t(loc(), 'commentsReportKicker') }}</p>
        <h3>{{ t(loc(), 'commentsReportTitle') }}</h3>
        <p class="mm-report-lead">{{ t(loc(), 'commentsReportLead') }}</p>

        <p v-if="loading" class="mm-report-status">{{ t(loc(), 'loadingStory') }}</p>
        <template v-else>
          <span class="mm-report-label" id="mm-report-reason-label">{{ t(loc(), 'commentsReportReason') }}</span>
          <div class="mm-report-select-wrap" :class="{ open: reasonOpen }" @click.stop>
            <button
              id="mm-report-reason"
              class="mm-report-select"
              type="button"
              :aria-expanded="reasonOpen"
              :aria-controls="reasonListId"
              aria-haspopup="listbox"
              aria-labelledby="mm-report-reason-label mm-report-reason"
              @click="reasonOpen = !reasonOpen"
            >
              <span>{{ selectedLabel }}</span>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M5.5 7.5 10 12l4.5-4.5" />
              </svg>
            </button>
            <ul
              v-if="reasonOpen"
              :id="reasonListId"
              class="mm-report-options"
              role="listbox"
              aria-labelledby="mm-report-reason-label"
            >
              <li
                v-for="option in options"
                :key="option.key"
                role="option"
                :aria-selected="option.key === reason"
                :class="{ on: option.key === reason }"
                @click="pickReason(option.key)"
              >
                {{ option.label }}
              </li>
            </ul>
          </div>

          <label class="mm-report-label" for="mm-report-details">{{ t(loc(), 'commentsReportDetails') }}</label>
          <textarea
            id="mm-report-details"
            v-model="details"
            class="mm-report-details"
            rows="4"
            maxlength="500"
            :placeholder="t(loc(), 'commentsReportDetailsPh')"
            @focus="reasonOpen = false"
          />

          <p v-if="errorMessage" class="mm-report-error">{{ errorMessage }}</p>
          <p v-else-if="successMessage" class="mm-report-ok">{{ successMessage }}</p>

          <div class="mm-report-actions">
            <button type="button" class="ghost" @click="close">{{ t(loc(), 'commentsCancelReply') }}</button>
            <button type="button" class="solid" :disabled="sending || !reason" @click="submit">
              {{ sending ? t(loc(), 'commentsSending') : t(loc(), 'commentsReportSubmit') }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
