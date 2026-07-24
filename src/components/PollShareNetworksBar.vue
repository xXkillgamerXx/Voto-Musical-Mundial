<script setup>
defineProps({
  isBoostLive: {
    type: Boolean,
    default: false,
  },
  multiplier: {
    type: Number,
    default: 2,
  },
  remainingLabel: {
    type: String,
    default: '00:00',
  },
  title: {
    type: String,
    default: '',
  },
  hint: {
    type: String,
    default: '',
  },
  claiming: {
    type: Boolean,
    default: false,
  },
  message: {
    type: String,
    default: '',
  },
  facebookDraft: {
    type: String,
    default: '',
  },
  facebookHint: {
    type: String,
    default: '',
  },
  facebookCopyLabel: {
    type: String,
    default: '',
  },
})

defineEmits(['share', 'copy-facebook'])
</script>

<template>
  <div class="rounded-[18px] border border-cyan-300/30 bg-[#151725] px-3.5 py-3">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0 text-center sm:flex-1 sm:text-left">
        <p
          class="text-sm font-black"
          :class="isBoostLive ? 'text-cyan-100' : 'text-white'"
        >
          <template v-if="isBoostLive">
            x{{ multiplier }} activo ·
            <span class="tabular-nums">{{ remainingLabel }}</span>
          </template>
          <template v-else>
            {{ title }}
          </template>
        </p>
        <p
          v-if="!isBoostLive && hint"
          class="mt-0.5 text-[11px] font-semibold text-white/60"
        >
          {{ hint }}
        </p>
      </div>

      <div class="flex shrink-0 flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          class="grid size-10 place-items-center rounded-full border border-blue-300/30 bg-blue-500 text-white transition hover:scale-105 disabled:opacity-60"
          :disabled="claiming"
          @click="$emit('share', 'facebook')"
        >
          <i class="fa-brands fa-facebook-f" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="grid size-10 place-items-center rounded-full border border-green-300/30 bg-green-500 text-white transition hover:scale-105 disabled:opacity-60"
          :disabled="claiming"
          @click="$emit('share', 'whatsapp')"
        >
          <i class="fa-brands fa-whatsapp text-lg" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="grid size-10 place-items-center rounded-full border border-sky-300/30 bg-sky-500 text-white transition hover:scale-105 disabled:opacity-60"
          :disabled="claiming"
          @click="$emit('share', 'telegram')"
        >
          <i class="fa-brands fa-telegram text-lg" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="grid size-10 place-items-center rounded-full border border-white/15 bg-black text-white transition hover:scale-105 disabled:opacity-60"
          :disabled="claiming"
          @click="$emit('share', 'twitter')"
        >
          <i class="fa-brands fa-x-twitter" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="grid size-10 place-items-center rounded-full border border-violet-300/30 bg-violet-500 text-white transition hover:scale-105 disabled:opacity-60"
          :disabled="claiming"
          @click="$emit('share', 'startly')"
        >
          <i class="fa-solid fa-star" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <p
      v-if="message"
      class="mt-2 text-center text-xs font-black text-emerald-200 sm:text-left"
    >
      {{ message }}
    </p>

    <div
      v-if="facebookDraft"
      class="mt-2 rounded-2xl border border-blue-300/25 bg-slate-950/55 p-2.5 text-left"
    >
      <p class="text-[10px] font-black uppercase tracking-wide text-blue-200">
        {{ facebookHint }}
      </p>
      <p class="mt-1 whitespace-pre-wrap break-words text-[11px] font-bold leading-5 text-slate-100">
        {{ facebookDraft }}
      </p>
      <button
        type="button"
        class="mt-2 min-h-8 w-full rounded-xl border border-blue-300/30 bg-blue-500/20 text-[10px] font-black uppercase tracking-wide text-blue-100"
        @click="$emit('copy-facebook')"
      >
        {{ facebookCopyLabel }}
      </button>
    </div>
  </div>
</template>
