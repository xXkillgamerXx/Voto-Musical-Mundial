<script setup>
const missions = [
  {
    icon: '✓',
    title: 'Vota 10 veces',
    text: 'Apoya a tu artista favorito en cualquier votación activa.',
    reward: '+40 pts',
    progress: '4/10',
    percent: 40,
    status: 'En progreso',
    featured: true,
  },
  {
    icon: '♡',
    title: 'Da like a una votación',
    text: 'Marca como favorita una votación destacada del día.',
    reward: '+15 pts',
    progress: '0/1',
    percent: 0,
    status: 'Pendiente',
  },
  {
    icon: '↗',
    title: 'Comparte con tu fandom',
    text: 'Comparte un enlace para invitar más fans a votar.',
    reward: '+25 pts',
    progress: '0/1',
    percent: 0,
    status: 'Pendiente',
  },
  {
    icon: '+',
    title: 'Sigue nuestra cuenta',
    text: 'Sigue la página oficial para enterarte de nuevos rankings.',
    reward: '+30 pts',
    progress: '1/1',
    percent: 100,
    status: 'Listo',
    done: true,
  },
]
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-6 sm:px-6 lg:py-8">
    <div class="mb-5 flex items-center justify-between gap-4">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
          Gana puntos extra
        </p>
        <h2 class="mt-2 text-2xl font-black uppercase tracking-tight sm:text-3xl">
          Misiones
        </h2>
      </div>

      <span class="rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm font-black text-amber-100">
        2,450 pts
      </span>
    </div>

    <div class="missions-slider -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
      <article
        v-for="mission in missions"
        :key="mission.title"
        class="relative min-w-[86%] snap-center overflow-hidden rounded-3xl border p-5 shadow-xl shadow-violet-950/25 sm:min-w-[48%] lg:min-w-0"
        :class="[
          mission.featured && 'border-fuchsia-300/35 bg-fuchsia-500/10',
          mission.done && 'border-emerald-300/35 bg-emerald-500/10',
          !mission.featured && !mission.done && 'border-violet-300/10 bg-[#090b19]/85',
        ]"
      >
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(217,70,239,0.18),transparent_32%)]"></div>

        <div class="relative">
          <div class="flex items-start justify-between gap-4">
            <span
              class="grid size-12 place-items-center rounded-2xl border text-xl font-black"
              :class="mission.done ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200' : 'border-white/10 bg-white/5 text-fuchsia-200'"
            >
              {{ mission.icon }}
            </span>

            <span
              class="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide"
              :class="mission.done ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/5 text-slate-300'"
            >
              {{ mission.status }}
            </span>
          </div>

          <h3 class="mt-5 text-lg font-black uppercase leading-tight">
            {{ mission.title }}
          </h3>
          <p class="mt-2 text-sm leading-6 text-slate-400">
            {{ mission.text }}
          </p>

          <div class="mt-5 flex items-end justify-between gap-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-widest text-slate-500">Progreso</p>
              <p class="mt-1 text-sm font-black text-white">{{ mission.progress }}</p>
            </div>
            <p class="text-xl font-black text-fuchsia-200">{{ mission.reward }}</p>
          </div>

          <div class="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              class="h-full rounded-full bg-linear-to-r from-cyan-400 to-fuchsia-500"
              :style="{ width: `${mission.percent}%` }"
            ></div>
          </div>

          <button
            type="button"
            class="mt-5 min-h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-black uppercase text-slate-100 transition hover:bg-white/10"
          >
            {{ mission.done ? 'Completada' : 'Hacer misión' }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.missions-slider {
  scrollbar-width: none;
}

.missions-slider::-webkit-scrollbar {
  display: none;
}
</style>
