<script setup>
import { computed, ref } from "vue";

const isFollowing = ref(false);
const isLiked = ref(false);

const artist = {
  name: "Jungkook",
  fandom: "BTS",
  role: "Vocalista · Bailarín · Solista",
  country: "Corea del Sur",
  image: "/contestants/jungkook.png",
  cover: "from-blue-950 via-violet-950 to-fuchsia-950",
  bio: "Artista global reconocido por su voz, performance y conexión con fans. Su comunidad impulsa votos, rankings y misiones cada día.",
  stats: [
    { label: "Seguidores", value: "1.8M" },
    { label: "Likes", value: "942K" },
    { label: "Votos de este año", value: "2,315,321" },
    { label: "Ranking", value: "#1" },
  ],
  achievements: ["Top Global Fan Vote", "Mejor Kpop Leader 2026", "Tendencia semanal"],
};

const publicMetrics = [
  { label: "Engagement", value: "89%", accent: "text-cyan-200" },
  { label: "Apoyo del fandom", value: "58.84%", accent: "text-fuchsia-100" },
  { label: "Crecimiento", value: "+12.4%", accent: "text-emerald-200" },
];

const activePolls = [
  { title: "Best Kpop Leaders 2026", type: "Lista", percent: "58.84%" },
  { title: "Jungkook vs Lisa", type: "Versus", percent: "57.8%" },
  { title: "Best Kpop Vocalists 2026", type: "Lista", percent: "42.1%" },
];

const followLabel = computed(() => (isFollowing.value ? "Siguiendo" : "Seguir"));
const likeCount = computed(() => (isLiked.value ? "943K" : "942K"));
</script>

<template>
  <section class="mx-auto max-w-352">
    <a
      href="/"
      class="inline-flex text-sm font-black text-fuchsia-300 transition hover:text-white"
    >
      ← Volver
    </a>

    <div class="mt-6 overflow-hidden rounded-3xl border border-violet-300/15 bg-[#090b19]/90 shadow-2xl shadow-fuchsia-950/20">
      <div class="relative min-h-72 bg-linear-to-br" :class="artist.cover">
        <img
          :src="artist.image"
          :alt="artist.name"
          class="absolute inset-0 size-full object-cover opacity-55"
        />
        <div class="absolute inset-0 bg-linear-to-t from-[#090b19] via-[#090b19]/30 to-transparent"></div>
        <div class="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div class="flex items-end gap-4">
              <div class="relative size-28 overflow-hidden rounded-3xl border-2 border-fuchsia-300/40 shadow-xl shadow-fuchsia-500/20 sm:size-36">
                <img :src="artist.image" :alt="artist.name" class="size-full object-cover" />
              </div>
              <div>
                <p class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
                  Perfil de artista
                </p>
                <h1 class="mt-2 text-4xl font-black leading-none text-white sm:text-6xl">
                  {{ artist.name }}
                </h1>
                <p class="mt-2 text-lg font-black uppercase text-amber-300">
                  {{ artist.fandom }}
                </p>
              </div>
            </div>

            <div class="flex gap-3">
              <button
                class="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                type="button"
                @click="isLiked = !isLiked"
              >
                ♥ {{ likeCount }}
              </button>
              <button
                class="rounded-full bg-linear-to-r from-pink-500 to-fuchsia-600 px-7 py-3 text-sm font-black uppercase text-white shadow-lg shadow-fuchsia-500/30 transition hover:scale-105"
                type="button"
                @click="isFollowing = !isFollowing"
              >
                {{ followLabel }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="grid gap-4 p-5 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
        <div>
          <p class="text-sm font-bold leading-7 text-slate-300">{{ artist.bio }}</p>

          <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div
              v-for="stat in artist.stats"
              :key="stat.label"
              class="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <p class="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                {{ stat.label }}
              </p>
              <p class="mt-1 text-2xl font-black text-white">{{ stat.value }}</p>
            </div>
          </div>

          <div class="mt-5 rounded-3xl border border-cyan-300/10 bg-cyan-500/5 p-4">
            <p class="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
              Estadísticas públicas
            </p>
            <div class="mt-4 grid gap-3 sm:grid-cols-3">
              <div
                v-for="metric in publicMetrics"
                :key="metric.label"
                class="rounded-2xl bg-white/7 p-4"
              >
                <p class="text-xs font-bold text-slate-400">{{ metric.label }}</p>
                <p class="mt-1 text-2xl font-black" :class="metric.accent">
                  {{ metric.value }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <aside class="space-y-4">
          <div class="rounded-3xl border border-violet-300/15 bg-white/7 p-4">
            <p class="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300">
              Datos
            </p>
            <div class="mt-4 space-y-3 text-sm font-bold text-slate-300">
              <p><span class="text-white">Rol:</span> {{ artist.role }}</p>
              <p><span class="text-white">País:</span> {{ artist.country }}</p>
              <p><span class="text-white">Fandom:</span> {{ artist.fandom }}</p>
            </div>
          </div>

          <div class="rounded-3xl border border-amber-300/15 bg-amber-500/5 p-4">
            <p class="text-xs font-black uppercase tracking-[0.22em] text-amber-300">
              Logros
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="achievement in artist.achievements"
                :key="achievement"
                class="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-100"
              >
                {{ achievement }}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <div class="mt-6 grid gap-4 lg:grid-cols-3">
      <article
        v-for="poll in activePolls"
        :key="poll.title"
        class="rounded-3xl border border-violet-300/10 bg-[#090b19]/90 p-4 shadow-xl shadow-black/20"
      >
        <p class="text-xs font-black uppercase text-fuchsia-300">{{ poll.type }}</p>
        <h3 class="mt-2 text-lg font-black text-white">{{ poll.title }}</h3>
        <div class="mt-4 flex items-center justify-between">
          <span class="text-xs font-bold text-slate-400">Apoyo actual</span>
          <span class="text-xl font-black text-fuchsia-100">{{ poll.percent }}</span>
        </div>
        <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            class="h-full rounded-full bg-linear-to-r from-amber-300 to-fuchsia-500"
            :style="{ width: poll.percent }"
          ></div>
        </div>
      </article>
    </div>
  </section>
</template>
