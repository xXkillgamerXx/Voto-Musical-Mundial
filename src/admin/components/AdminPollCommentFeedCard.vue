<script setup>
defineProps({
  displayName: {
    type: String,
    default: 'Fan',
  },
  photoUrl: {
    type: String,
    default: '',
  },
  text: {
    type: String,
    required: true,
  },
  timeLabel: {
    type: String,
    default: '',
  },
  muted: {
    type: Boolean,
    default: false,
  },
})

const getInitial = (name) => String(name || 'F').trim().charAt(0).toUpperCase() || 'F'
</script>

<template>
  <article
    class="grid grid-cols-[3rem_1fr] gap-3"
    :class="muted ? 'opacity-90' : ''"
  >
    <div
      class="grid size-10 place-items-center overflow-hidden rounded-full border border-cyan-300/10 bg-linear-to-br from-slate-700 to-slate-900 text-sm font-black text-white shadow-lg shadow-black/20"
    >
      <img
        v-if="photoUrl"
        :src="photoUrl"
        :alt="displayName"
        class="size-full object-cover"
        referrerpolicy="no-referrer"
      />
      <span v-else>{{ getInitial(displayName) }}</span>
    </div>
    <div class="rounded-2xl border border-white/8 bg-white/7 p-4 shadow-lg shadow-black/10">
      <p class="text-sm font-black text-white">
        {{ displayName || 'Fan' }}
        <span
          v-if="timeLabel"
          class="ml-2 text-[10px] font-bold text-slate-500"
        >
          {{ timeLabel }}
        </span>
      </p>
      <p class="mt-4 text-sm font-bold text-slate-200">
        {{ text }}
      </p>
    </div>
  </article>
</template>
