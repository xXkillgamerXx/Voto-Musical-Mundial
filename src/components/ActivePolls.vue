<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'

const polls = ref([])
const now = ref(Date.now())

const timeLabels = ['Dias', 'Hrs', 'Min', 'Seg']

let unsubscribePolls = null
let clockTimer = null

const pollUrl = (poll) => `/votacion/${poll.year || new Date().getFullYear()}/${poll.slug || poll.id}`

const countdownFor = (poll) => {
  if (poll.status === 'selecting_winners') {
    return ['EN', 'PRO', 'CE', 'SO']
  }

  const endDate = poll.endAt?.toDate?.()

  if (!endDate) {
    return ['EN', 'VI', 'VO', '']
  }

  const remainingSeconds = Math.max(Math.floor((endDate.getTime() - now.value) / 1000), 0)
  const days = Math.floor(remainingSeconds / 86400)
  const hours = Math.floor((remainingSeconds % 86400) / 3600)
  const minutes = Math.floor((remainingSeconds % 3600) / 60)
  const seconds = remainingSeconds % 60
  const formatValue = (value) => String(value).padStart(2, '0')

  return [formatValue(days), formatValue(hours), formatValue(minutes), formatValue(seconds)]
}

const activePolls = computed(() =>
  polls.value.map((poll, index) => ({
    ...poll,
    question: poll.status === 'selecting_winners'
      ? 'Estamos contando los votos y eligiendo ganadores.'
      : poll.description || 'Votacion abierta en tiempo real.',
    statusLabel: poll.status === 'selecting_winners' ? 'En proceso' : 'En vivo',
    actionLabel: poll.status === 'selecting_winners' ? 'Ver proceso' : 'Votar',
    time: countdownFor(poll),
    visual: [
      'from-violet-950 via-fuchsia-700 to-indigo-950',
      'from-slate-800 via-violet-700 to-slate-950',
      'from-fuchsia-900 via-pink-700 to-slate-950',
    ][index % 3],
  })),
)

onMounted(() => {
  unsubscribePolls = onSnapshot(
    query(collection(db, 'polls'), where('status', 'in', ['live', 'selecting_winners'])),
    (pollsSnap) => {
      polls.value = pollsSnap.docs.map((pollDoc) => ({
        id: pollDoc.id,
        ...pollDoc.data(),
      }))
    },
  )

  clockTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  unsubscribePolls?.()
  window.clearInterval(clockTimer)
})
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-6 sm:px-6 lg:py-8">
    <div class="mb-5 flex items-center justify-between gap-4">
      <h2 class="flex items-center gap-2 text-lg font-black uppercase tracking-tight sm:text-xl">
        <span class="text-fuchsia-300">✦</span>
        Votaciones activas
      </h2>
      <span class="text-xs font-black uppercase tracking-wide text-violet-300">
        En vivo / proceso
      </span>
    </div>

    <p
      v-if="!activePolls.length"
      class="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm font-bold text-slate-400"
    >
      Todavia no hay votaciones en vivo o en proceso. Cuando lances una desde el panel admin aparecera aqui.
    </p>

    <div v-else class="mobile-active-polls-slider -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:hidden">
      <article
        v-for="poll in activePolls"
        :key="poll.id"
        class="min-w-[90%] snap-center overflow-hidden rounded-2xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25"
      >
        <div
          class="relative h-56 overflow-hidden bg-linear-to-br"
          :class="poll.visual"
        >
          <img
            v-if="poll.banner"
            :src="poll.banner"
            :alt="poll.title"
            class="absolute inset-0 size-full object-cover"
          />
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.26),transparent_24%),radial-gradient(circle_at_70%_70%,rgba(217,70,239,0.35),transparent_28%)]"></div>
          <div class="absolute inset-0 bg-linear-to-t from-[#080a17] via-transparent to-white/5"></div>
          <div class="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border border-white/20 bg-black/25 shadow-2xl shadow-fuchsia-500/20 backdrop-blur">
            <span class="text-2xl text-white/90">✦</span>
          </div>
        </div>

        <div class="p-5">
          <h3 class="text-lg font-black uppercase">{{ poll.title }}</h3>
          <p class="mt-1 text-sm text-slate-400">{{ poll.question }}</p>

          <div class="mt-5 grid grid-cols-4 gap-2">
            <div
              v-for="(value, index) in poll.time"
              :key="`${poll.id}-mobile-${index}`"
              class="rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-center shadow-inner shadow-black/30"
            >
              <p class="text-lg font-black">{{ value }}</p>
              <p class="text-[10px] font-bold uppercase text-slate-500">
                {{ poll.status === 'selecting_winners' ? '' : timeLabels[index] }}
              </p>
            </div>
          </div>

          <a
            :href="pollUrl(poll)"
            class="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-9 text-sm font-black uppercase tracking-wide shadow-lg shadow-fuchsia-500/25"
          >
            {{ poll.actionLabel }}
          </a>
        </div>
      </article>
    </div>

    <div v-if="activePolls.length" class="hidden space-y-3 md:block">
      <article
        v-for="poll in activePolls"
        :key="poll.id"
        class="grid min-h-50 overflow-hidden rounded-2xl border border-violet-300/10 bg-[#090b19]/85 shadow-xl shadow-violet-950/25 transition hover:border-fuchsia-300/30 hover:bg-[#101226] md:grid-cols-[20rem_1fr_auto_auto] md:items-center"
      >
        <div
          class="relative h-60 overflow-hidden bg-linear-to-br md:h-50"
          :class="poll.visual"
        >
          <img
            v-if="poll.banner"
            :src="poll.banner"
            :alt="poll.title"
            class="absolute inset-0 size-full object-cover"
          />
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.26),transparent_24%),radial-gradient(circle_at_70%_70%,rgba(217,70,239,0.35),transparent_28%)]"></div>
          <div class="absolute inset-0 bg-linear-to-t from-[#080a17] via-transparent to-white/5"></div>
          <div class="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border border-white/20 bg-black/25 shadow-2xl shadow-fuchsia-500/20 backdrop-blur">
            <span class="text-2xl text-white/90">✦</span>
          </div>
        </div>

        <div class="px-5 py-5 md:px-6">
          <h3 class="text-lg font-black uppercase">{{ poll.title }}</h3>
          <p class="mt-1 text-sm text-slate-400">{{ poll.question }}</p>
        </div>

        <div class="grid grid-cols-4 gap-2 px-4 md:px-2">
          <div
            v-for="(value, index) in poll.time"
            :key="`${poll.id}-${index}`"
            class="min-w-17 rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-center shadow-inner shadow-black/30"
          >
            <p class="text-xl font-black">{{ value }}</p>
            <p class="text-[10px] font-bold uppercase text-slate-500">
              {{ poll.status === 'selecting_winners' ? '' : timeLabels[index] }}
            </p>
          </div>
        </div>

        <a
          :href="pollUrl(poll)"
          class="m-4 flex min-h-12 min-w-28 items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-9 text-sm font-black uppercase tracking-wide shadow-lg shadow-fuchsia-500/25 md:ml-2"
        >
          {{ poll.actionLabel }}
        </a>
      </article>
    </div>
  </section>
</template>

<style scoped>
.mobile-active-polls-slider {
  scrollbar-width: none;
}

.mobile-active-polls-slider::-webkit-scrollbar {
  display: none;
}
</style>
