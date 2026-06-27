<script setup>
const missions = [
  { title: 'Vota 1 vez', reward: '+25 pts', progress: '1/1', done: true },
  { title: 'Comparte una votacion', reward: '+50 pts', progress: '0/1', done: false },
  { title: 'Entra 3 dias seguidos', reward: '+120 pts', progress: '2/3', done: false },
]

const pointPacks = [
  { points: '100', price: '$0.99' },
  { points: '500', price: '$3.99', popular: true },
  { points: '1000', price: '$6.99' },
]
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-6 sm:px-6 lg:py-8">
    <div class="mb-5 flex items-center justify-between gap-4">
      <h2 class="flex items-center gap-2 text-lg font-black uppercase tracking-tight sm:text-xl">
        <span class="text-fuchsia-300">✦</span>
        {{ $t('rewards.hubTitle') }}
      </h2>
    </div>

    <div class="grid gap-4 lg:grid-cols-[1fr_1.2fr_1fr]">
      <article class="overflow-hidden rounded-3xl border border-violet-300/10 bg-[#090b19]/85 p-5 shadow-xl shadow-violet-950/30">
        <p class="text-xs font-black uppercase tracking-[0.28em] text-amber-300">
          {{ $t('rewards.dailyReward') }}
        </p>
        <h3 class="mt-3 text-2xl font-black">{{ $t('rewards.freePoints') }}</h3>
        <p class="mt-2 text-sm leading-6 text-slate-400">
          {{ $t('rewards.hubDescription') }}
        </p>

        <div class="mt-6 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-center">
          <p class="text-4xl font-black text-amber-200">+150</p>
          <p class="text-xs font-bold uppercase tracking-widest text-amber-100/70">{{ $t('rewards.dailyPoints') }}</p>
        </div>

        <a href="#" class="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-linear-to-r from-amber-300 to-fuchsia-500 px-5 text-sm font-black uppercase text-slate-950">
          {{ $t('rewards.claimNow') }}
        </a>
      </article>

      <article class="rounded-3xl border border-violet-300/10 bg-[#090b19]/85 p-5 shadow-xl shadow-violet-950/30">
        <p class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
          {{ $t('rewards.missions') }}
        </p>
        <div class="mt-4 space-y-3">
          <div
            v-for="mission in missions"
            :key="mission.title"
            class="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/25 p-4"
          >
            <div>
              <h3 class="font-black">{{ mission.title }}</h3>
              <p class="mt-1 text-xs text-slate-500">{{ $t('rewards.completed', { progress: mission.progress }) }}</p>
            </div>
            <div class="text-right">
              <p class="font-black text-fuchsia-300">{{ mission.reward }}</p>
              <p class="text-xs font-bold uppercase" :class="mission.done ? 'text-emerald-300' : 'text-slate-500'">
                {{ mission.done ? 'Listo' : 'Pendiente' }}
              </p>
            </div>
          </div>
        </div>
      </article>

      <article class="rounded-3xl border border-violet-300/10 bg-[#090b19]/85 p-5 shadow-xl shadow-violet-950/30">
        <p class="text-xs font-black uppercase tracking-[0.28em] text-violet-300">
          Comprar puntos
        </p>
        <div class="mt-4 space-y-3">
          <a
            v-for="pack in pointPacks"
            :key="pack.points"
            href="#"
            class="flex items-center justify-between rounded-2xl border p-4 transition hover:bg-white/10"
            :class="pack.popular ? 'border-fuchsia-300/40 bg-fuchsia-500/10' : 'border-white/10 bg-black/25'"
          >
            <span>
              <span class="block text-xl font-black">{{ pack.points }} pts</span>
              <span class="text-xs uppercase tracking-widest text-slate-500">
                {{ pack.popular ? 'Mas popular' : 'Paquete' }}
              </span>
            </span>
            <span class="font-black text-white">{{ pack.price }}</span>
          </a>
        </div>

        <a href="#" class="mt-5 flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black uppercase text-slate-200">
          Gana puntos extra
        </a>
      </article>
    </div>
  </section>
</template>
