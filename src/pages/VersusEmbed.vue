<script setup>
import { ref } from "vue";

const contestants = [
  {
    name: "Jungkook",
    fandom: "BTS",
    percent: 57.8,
    image: "/contestants/jungkook.png",
    accent: "from-blue-500 to-violet-700",
  },
  {
    name: "Lisa",
    fandom: "BLACKPINK",
    percent: 42.2,
    image: "/contestants/lisa.png",
    accent: "from-pink-500 to-fuchsia-700",
  },
];

const selectedContestant = ref(null);

const openVoteModal = (contestant) => {
  selectedContestant.value = contestant;
};

const closeVoteModal = () => {
  selectedContestant.value = null;
};
</script>

<template>
  <section class="min-h-screen bg-[#03040d] p-3 text-white">
    <div class="relative mx-auto grid max-w-5xl grid-cols-2 items-stretch gap-0">
      <template
        v-for="(contestant, index) in contestants"
        :key="contestant.name"
      >
        <article
          class="relative mx-auto w-full min-w-0 cursor-pointer overflow-hidden border border-violet-300/10 bg-[#201b35]/95 shadow-xl shadow-black/20 transition hover:border-fuchsia-300/35"
          :class="[
            index === 0 ? 'rounded-l-2xl border-r-0 border-amber-300/40 bg-[#211735] md:rounded-l-3xl' : 'rounded-r-2xl border-l-0 border-slate-300/35 bg-[#202438] md:rounded-r-3xl',
            index === 0 ? 'col-start-1' : 'col-start-2',
          ]"
          @click="openVoteModal(contestant)"
        >
          <div
            class="relative aspect-square overflow-hidden bg-linear-to-br"
            :class="contestant.accent"
          >
            <img
              :src="contestant.image"
              :alt="contestant.name"
              class="absolute inset-0 size-full object-cover"
            />
            <div class="absolute inset-0 bg-linear-to-t from-[#201b35] via-transparent to-black/15"></div>
            <div class="absolute left-2 top-2 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase backdrop-blur md:left-4 md:top-4 md:px-3 md:py-1 md:text-[10px]" :class="index === 0 ? 'border-amber-300/50 bg-amber-400/25 text-amber-100' : 'border-slate-200/50 bg-slate-300/20 text-slate-100'">
              {{ index === 0 ? 'Opción A' : 'Opción B' }}
            </div>
          </div>

          <div class="p-2 md:p-4">
            <div class="flex items-start justify-between gap-2 md:gap-3">
              <div class="min-w-0">
                <h2 class="truncate text-xl font-black leading-tight md:text-3xl">
                  {{ contestant.name }}
                </h2>
                <p class="truncate text-xs font-black uppercase text-amber-300 md:text-base">
                  {{ contestant.fandom }}
                </p>
              </div>
              <p class="shrink-0 text-lg font-black text-fuchsia-100 drop-shadow-[0_0_10px_rgba(217,70,239,0.35)] md:text-3xl">
                {{ contestant.percent }}%
              </p>
            </div>

            <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/10 md:mt-4 md:h-3">
              <div
                class="h-full rounded-full bg-linear-to-r from-amber-300 to-fuchsia-500"
                :style="{ width: `${contestant.percent}%` }"
              ></div>
            </div>

            <button
              class="mt-3 flex min-h-10 w-full items-center justify-center rounded-xl bg-linear-to-r from-pink-500 to-fuchsia-600 px-2 text-[10px] font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-500/30 transition hover:scale-[1.02] md:mt-5 md:min-h-12 md:rounded-2xl md:text-sm"
              type="button"
              @click.stop="openVoteModal(contestant)"
            >
              Votar
            </button>
          </div>
        </article>

        <div
          v-if="index === 0"
          class="absolute left-1/2 top-1/2 z-30 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white/20 bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-sm font-black shadow-2xl shadow-fuchsia-500/40 ring-4 ring-fuchsia-500/15 md:size-20 md:text-2xl"
        >
          VS
        </div>
      </template>
    </div>

    <Teleport to="body">
      <div
        v-if="selectedContestant"
        class="fixed inset-0 z-9999 grid place-items-center bg-[#050514]/90 px-4 py-6 backdrop-blur-sm"
        @click.self="closeVoteModal"
      >
        <div class="relative w-full max-w-sm rounded-3xl border border-violet-300/25 bg-[#130f25]/95 p-5 text-center shadow-2xl shadow-fuchsia-950/40">
          <button
            class="absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-white/15 bg-white/10 text-2xl leading-none text-white/80 transition hover:bg-white/20"
            type="button"
            aria-label="Cerrar modal"
            @click="closeVoteModal"
          >
            ×
          </button>
          <div class="mx-auto size-24 overflow-hidden rounded-2xl border border-fuchsia-300/30">
            <img :src="selectedContestant.image" :alt="selectedContestant.name" class="size-full object-cover" />
          </div>
          <h3 class="mt-4 text-2xl font-black text-white">
            Votar por {{ selectedContestant.name }}
          </h3>
          <button
            class="mt-5 flex min-h-11 w-full items-center justify-center rounded-2xl bg-linear-to-r from-pink-500 to-fuchsia-600 text-sm font-black uppercase tracking-wide text-white"
            type="button"
            @click="closeVoteModal"
          >
            Votar ahora
          </button>
        </div>
      </div>
    </Teleport>
  </section>
</template>
