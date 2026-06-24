<script setup>
const stats = [
  {
    label: 'Votos hoy',
    value: '48,920',
    trend: '+12.4%',
    icon: 'fa-solid fa-check-to-slot',
    accent: 'from-fuchsia-500 to-violet-500',
  },
  {
    label: 'Usuarios activos',
    value: '8,231',
    trend: '+6.8%',
    icon: 'fa-solid fa-users',
    accent: 'from-cyan-500 to-blue-500',
  },
  {
    label: 'Votaciones abiertas',
    value: '14',
    trend: '3 cierran hoy',
    icon: 'fa-solid fa-ranking-star',
    accent: 'from-amber-400 to-orange-500',
  },
  {
    label: 'Reportes pendientes',
    value: '7',
    trend: 'Revisar',
    icon: 'fa-solid fa-triangle-exclamation',
    accent: 'from-rose-500 to-pink-500',
  },
]

const quickActions = [
  'Crear votacion',
  'Agregar artista',
  'Revisar reportes',
  'Publicar noticia',
]

const recentActivity = [
  {
    title: 'Nueva votacion creada',
    detail: 'Best Kpop Leaders 2026',
    time: 'Hace 12 min',
  },
  {
    title: 'Usuario verificado',
    detail: 'fan.global@email.com',
    time: 'Hace 24 min',
  },
  {
    title: 'Reporte recibido',
    detail: 'Comentario en Jungkook vs Lisa',
    time: 'Hace 41 min',
  },
]
</script>

<template>
  <section class="space-y-6">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article
        v-for="stat in stats"
        :key="stat.label"
        class="rounded-3xl border border-white/10 bg-white/4 p-5 shadow-xl shadow-black/20"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
              {{ stat.label }}
            </p>
            <h3 class="mt-3 text-3xl font-black text-white">
              {{ stat.value }}
            </h3>
          </div>
          <span
            class="grid size-12 place-items-center rounded-2xl bg-linear-to-br text-lg text-white shadow-lg"
            :class="stat.accent"
          >
            <i :class="stat.icon" aria-hidden="true"></i>
          </span>
        </div>
        <p class="mt-4 text-sm font-bold text-emerald-200">
          {{ stat.trend }}
        </p>
      </article>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
      <article class="rounded-3xl border border-white/10 bg-white/4 p-5 sm:p-6">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
              Resumen
            </p>
            <h3 class="mt-1 text-2xl font-black text-white">
              Estado general de la plataforma
            </h3>
          </div>
          <button
            type="button"
            class="rounded-full border border-fuchsia-300/30 bg-fuchsia-400/10 px-4 py-2 text-sm font-black text-fuchsia-100 transition hover:bg-fuchsia-400/20"
          >
            Ver todo
          </button>
        </div>

        <div class="mt-6 grid gap-4 md:grid-cols-3">
          <div class="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <p class="text-sm font-bold text-slate-300">Conversion de votos</p>
            <p class="mt-3 text-3xl font-black text-cyan-200">74%</p>
            <div class="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div class="h-full w-[74%] rounded-full bg-cyan-300"></div>
            </div>
          </div>
          <div class="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <p class="text-sm font-bold text-slate-300">Participacion fan</p>
            <p class="mt-3 text-3xl font-black text-fuchsia-200">89%</p>
            <div class="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div class="h-full w-[89%] rounded-full bg-fuchsia-300"></div>
            </div>
          </div>
          <div class="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <p class="text-sm font-bold text-slate-300">Salud del sistema</p>
            <p class="mt-3 text-3xl font-black text-emerald-200">OK</p>
            <div class="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div class="h-full w-[96%] rounded-full bg-emerald-300"></div>
            </div>
          </div>
        </div>
      </article>

      <aside class="space-y-6">
        <article class="rounded-3xl border border-white/10 bg-white/4 p-5">
          <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
            Acciones rapidas
          </p>
          <div class="mt-4 grid gap-3">
            <button
              v-for="action in quickActions"
              :key="action"
              type="button"
              class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-black text-white transition hover:border-fuchsia-300/35 hover:bg-white/10"
            >
              {{ action }}
            </button>
          </div>
        </article>

        <article class="rounded-3xl border border-white/10 bg-white/4 p-5">
          <p class="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
            Actividad reciente
          </p>
          <div class="mt-4 space-y-4">
            <div
              v-for="activity in recentActivity"
              :key="activity.title"
              class="border-b border-white/10 pb-4 last:border-0 last:pb-0"
            >
              <p class="font-black text-white">{{ activity.title }}</p>
              <p class="mt-1 text-sm text-slate-300">{{ activity.detail }}</p>
              <p class="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                {{ activity.time }}
              </p>
            </div>
          </div>
        </article>
      </aside>
    </div>
  </section>
</template>
