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
    <div class="relative">
      <div class="relative mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 class="text-xl font-black uppercase tracking-tight text-violet-100">En tiempo real</h2>
          <p class="mt-1 text-sm text-slate-400">Usuarios votando ahora</p>
        </div>
        <div>
          <span class="rounded-md border border-red-300/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-red-200">
            Live
          </span>
        </div>
      </div>

      <div class="live-scroll relative max-h-[520px] space-y-2 overflow-y-auto sm:max-h-[650px] sm:space-y-3 sm:pr-2">
        <article
          v-for="activity in activities"
          :key="`${activity.user}-${activity.time}`"
          class="relative min-h-24 overflow-hidden rounded-xl border border-white/8 bg-[#070b1a]/90 p-3 shadow-lg shadow-black/20 sm:min-h-32 sm:p-4"
        >
          <div class="absolute inset-y-0 right-0 w-32 bg-linear-to-l opacity-95 sm:w-72" :class="activity.visual">
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_76%_30%,rgba(255,255,255,0.24),transparent_18%),linear-gradient(90deg,#070b1a_0%,rgba(7,11,26,0.72)_38%,transparent_78%)] sm:bg-[radial-gradient(circle_at_72%_28%,rgba(255,255,255,0.28),transparent_18%),linear-gradient(90deg,#070b1a_0%,rgba(7,11,26,0.55)_34%,transparent_72%)]"></div>
            <div class="absolute bottom-0 right-5 h-24 w-28 rounded-t-full bg-black/25 blur-sm sm:right-10 sm:h-28 sm:w-36"></div>
            <div class="absolute right-5 top-1/2 -translate-y-1/2 text-5xl font-black text-white/55 drop-shadow-[0_0_24px_rgba(255,255,255,0.22)] sm:right-16 sm:text-8xl sm:text-white/70">
              {{ activity.artist.charAt(0) }}
            </div>
          </div>

          <div class="relative z-10 flex min-h-18 items-center gap-3 pr-24 sm:min-h-24 sm:gap-4 sm:pr-60">
            <span class="grid size-12 shrink-0 place-items-center rounded-full bg-linear-to-br text-base font-black shadow-lg shadow-black/30 ring-2 ring-white/10 sm:size-16 sm:text-xl" :class="activity.color">
              {{ activity.user.charAt(0) }}
            </span>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-black leading-tight text-white sm:text-base">{{ activity.user }}</h3>
                <span class="text-sm leading-none text-violet-300">✦</span>
              </div>
              <p class="mt-0.5 text-xs leading-tight text-slate-300 sm:text-sm">acaba de votar por</p>
              <p class="mt-0.5 text-sm font-black uppercase leading-tight text-white sm:text-base">{{ activity.artist }}</p>
              <p class="mt-1 text-[11px] text-slate-500 sm:text-xs">{{ activity.time }}</p>
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
