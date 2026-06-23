<script setup>
const activities = [
  { user: 'LunaArmy', artist: 'Jungkook', time: 'hace 5 segundos', color: 'from-fuchsia-500 to-violet-500', visual: 'from-slate-950 via-indigo-950 to-black' },
  { user: 'BlinkUniverse', artist: 'Lisa', time: 'hace 7 segundos', color: 'from-pink-500 to-rose-500', visual: 'from-slate-950 via-fuchsia-950 to-black' },
  { user: 'MochiJimin', artist: 'Jimin', time: 'hace 9 segundos', color: 'from-blue-500 to-violet-500', visual: 'from-slate-950 via-blue-950 to-black' },
  { user: 'StayTiny', artist: 'Stray Kids', time: 'hace 12 segundos', color: 'from-violet-500 to-fuchsia-500', visual: 'from-slate-950 via-purple-950 to-black' },
  { user: 'Once4Ever', artist: 'Twice', time: 'hace 14 segundos', color: 'from-pink-500 to-amber-400', visual: 'from-slate-950 via-pink-950 to-black' },
  { user: 'NanaNewJeans', artist: 'NewJeans', time: 'hace 16 segundos', color: 'from-cyan-400 to-emerald-400', visual: 'from-slate-950 via-cyan-950 to-black' },
  { user: 'EXOLove', artist: 'EXO', time: 'hace 18 segundos', color: 'from-orange-400 to-rose-500', visual: 'from-slate-950 via-orange-950 to-black' },
  { user: 'AeriMY', artist: 'AESPA', time: 'hace 20 segundos', color: 'from-violet-500 to-purple-400', visual: 'from-slate-950 via-violet-950 to-black' },
]
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-6 sm:px-6 lg:py-8">
    <div class="relative overflow-hidden rounded-3xl border border-violet-300/10 bg-[#090b19]/90 p-5 shadow-2xl shadow-violet-950/30 sm:p-6">
      <div class="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_84%_2%,rgba(168,85,247,0.35),transparent_26%),radial-gradient(circle_at_12%_100%,rgba(14,165,233,0.12),transparent_28%)]"></div>

      <div class="relative mb-4">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-black uppercase tracking-wide text-violet-100">En tiempo real</h2>
          <span class="rounded-md border border-red-300/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-red-200">
            Live
          </span>
        </div>
        <p class="mt-2 text-sm text-slate-400">Usuarios votando ahora</p>
      </div>

      <div class="live-scroll relative max-h-[650px] space-y-3 overflow-y-auto pr-2">
        <article
          v-for="activity in activities"
          :key="`${activity.user}-${activity.time}`"
          class="relative min-h-32 overflow-hidden rounded-xl border border-white/8 bg-[#070b1a]/90 p-4 shadow-lg shadow-black/20"
        >
          <div class="absolute inset-y-0 right-0 w-56 bg-linear-to-l opacity-95 sm:w-72" :class="activity.visual">
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_72%_28%,rgba(255,255,255,0.28),transparent_18%),linear-gradient(90deg,#070b1a_0%,rgba(7,11,26,0.55)_34%,transparent_72%)]"></div>
            <div class="absolute bottom-0 right-5 h-24 w-28 rounded-t-full bg-black/25 blur-sm sm:right-10 sm:h-28 sm:w-36"></div>
            <div class="absolute right-9 top-1/2 -translate-y-1/2 text-7xl font-black text-white/70 drop-shadow-[0_0_24px_rgba(255,255,255,0.28)] sm:right-16 sm:text-8xl">
              {{ activity.artist.charAt(0) }}
            </div>
          </div>

          <div class="relative z-10 flex min-h-24 items-center gap-4 pr-40 sm:pr-60">
            <span class="grid size-16 shrink-0 place-items-center rounded-full bg-linear-to-br text-xl font-black shadow-lg shadow-black/30 ring-2 ring-white/10" :class="activity.color">
              {{ activity.user.charAt(0) }}
            </span>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-black leading-tight text-white">{{ activity.user }}</h3>
                <span class="text-sm leading-none text-violet-300">✦</span>
              </div>
              <p class="mt-0.5 text-sm leading-tight text-slate-300">acaba de votar por</p>
              <p class="mt-0.5 text-base font-black uppercase leading-tight text-white">{{ activity.artist }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ activity.time }}</p>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.live-scroll {
  scrollbar-color: rgba(168, 85, 247, 0.85) rgba(255, 255, 255, 0.08);
  scrollbar-width: thin;
}

.live-scroll::-webkit-scrollbar {
  width: 6px;
}

.live-scroll::-webkit-scrollbar-track {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.live-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: linear-gradient(180deg, #a855f7, #22d3ee);
}
</style>
