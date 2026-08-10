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
})

defineEmits(['share'])
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
          class="grid size-10 place-items-center overflow-hidden rounded-full bg-white p-1.5 transition hover:scale-105 disabled:opacity-60"
          :disabled="claiming"
          :aria-label="$t('polls.detail.shareStartly')"
          title="Startly"
          @click="$emit('share', 'startly')"
        >
          <img
            src="/startly-icon.png"
            alt=""
            class="size-full object-contain"
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          class="grid size-10 place-items-center rounded-full border border-blue-300/30 bg-blue-500 text-[1.25rem] leading-none text-white transition hover:scale-105 disabled:opacity-60"
          :disabled="claiming"
          @click="$emit('share', 'facebook')"
        >
          <i class="fa-brands fa-facebook-f" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="grid size-10 place-items-center rounded-full border border-green-300/30 bg-green-500 text-[1.25rem] leading-none text-white transition hover:scale-105 disabled:opacity-60"
          :disabled="claiming"
          @click="$emit('share', 'whatsapp')"
        >
          <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="inline-flex size-10 items-center justify-center overflow-hidden rounded-full border-2 border-[#2AABEE] bg-white p-0 text-[#2AABEE] transition hover:scale-105 disabled:opacity-60"
          :disabled="claiming"
          @click="$emit('share', 'telegram')"
        >
          <i
            class="fa-brands fa-telegram-plane text-[2.5rem] leading-none translate-x-[1px]"
            aria-hidden="true"
          ></i>
        </button>
        <button
          type="button"
          class="grid size-12 place-items-center rounded-full border border-white/15 bg-black text-[1.5rem] leading-none text-white transition hover:scale-105 disabled:opacity-60"
          :disabled="claiming"
          @click="$emit('share', 'twitter')"
        >
          <i class="fa-brands fa-x-twitter" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <p
      v-if="message"
      class="mt-2 text-center text-xs font-black text-emerald-200 sm:text-left"
    >
      {{ message }}
    </p>
  </div>
</template>
