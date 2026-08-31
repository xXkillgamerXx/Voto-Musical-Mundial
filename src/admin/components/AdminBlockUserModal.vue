<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  userLabel: { type: String, default: '' },
  isSubmitting: { type: Boolean, default: false },
  defaultReason: { type: String, default: '' },
})

const emit = defineEmits(['close', 'confirm'])

const blockReason = ref('')
const blockDuration = ref(24)

const durationOptions = [
  { value: 1, labelKey: 'admin.users.blockDuration1h' },
  { value: 24, labelKey: 'admin.users.blockDuration24h' },
  { value: 168, labelKey: 'admin.users.blockDuration7d' },
  { value: 720, labelKey: 'admin.users.blockDuration30d' },
  { value: 0, labelKey: 'admin.users.blockDurationPermanent' },
]

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      blockReason.value = props.defaultReason || ''
      blockDuration.value = 24
    }
  },
)

const close = () => {
  if (props.isSubmitting) return
  emit('close')
}

const submit = () => {
  const reason = String(blockReason.value || '').trim()
  if (!reason) return
  emit('confirm', { reason, durationHours: blockDuration.value })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-80 grid place-items-center bg-black/80 px-4 py-6 text-white backdrop-blur-md"
      @click.self="close"
    >
      <article class="relative w-full max-w-lg overflow-hidden rounded-4xl border border-red-300/25 bg-[#090b19] p-6 shadow-2xl shadow-red-950/30">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(248,113,113,0.22),transparent_32%),radial-gradient(circle_at_100%_100%,rgba(217,70,239,0.16),transparent_34%)]"></div>

        <div class="relative z-10">
          <div class="flex items-start gap-4">
            <span class="grid size-13 shrink-0 place-items-center rounded-2xl border border-red-300/25 bg-red-500/10 text-xl text-red-100">
              <i class="fa-solid fa-user-lock" aria-hidden="true"></i>
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-black uppercase tracking-[0.28em] text-red-200">
                {{ $t('admin.users.blockTitle') }}
              </p>
              <h3 class="mt-2 text-2xl font-black text-white">{{ userLabel }}</h3>
              <p class="mt-3 text-sm font-bold leading-6 text-slate-300">
                {{ $t('admin.users.blockDescription') }}
              </p>
            </div>
            <button
              type="button"
              class="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-lg font-black text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isSubmitting"
              @click="close"
            >
              ×
            </button>
          </div>

          <div class="mt-6 grid gap-4">
            <label class="grid gap-2">
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {{ $t('admin.users.blockReason') }}
              </span>
              <textarea
                v-model="blockReason"
                rows="3"
                class="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-red-300/40"
                :placeholder="$t('admin.users.blockReasonPlaceholder')"
              />
            </label>

            <label class="grid gap-2">
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {{ $t('admin.users.blockDuration') }}
              </span>
              <select
                v-model.number="blockDuration"
                class="min-h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm font-bold text-white outline-none transition focus:border-red-300/40"
              >
                <option v-for="option in durationOptions" :key="option.value" :value="option.value">
                  {{ $t(option.labelKey) }}
                </option>
              </select>
            </label>
          </div>

          <div class="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isSubmitting"
              @click="close"
            >
              {{ $t('admin.users.deleteCancel') }}
            </button>
            <button
              type="button"
              class="min-h-12 rounded-2xl bg-red-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-red-950/40 transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isSubmitting || !blockReason.trim()"
              @click="submit"
            >
              {{ isSubmitting ? $t('admin.common.saving') : $t('admin.users.blockSubmit') }}
            </button>
          </div>
        </div>
      </article>
    </div>
  </Teleport>
</template>
