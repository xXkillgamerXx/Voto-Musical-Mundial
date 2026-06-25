<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import PollComments from "../components/PollComments.vue";

const remainingSeconds = ref(31 * 24 * 60 * 60 + 1 * 60 * 60 + 4 * 60 + 21);
let countdownTimer;

const formatTimeValue = (value) => String(value).padStart(2, "0");

const countdown = computed(() => {
  const days = Math.floor(remainingSeconds.value / 86400);
  const hours = Math.floor((remainingSeconds.value % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds.value % 3600) / 60);
  const seconds = remainingSeconds.value % 60;

  return [
    { value: formatTimeValue(days), label: "Días" },
    { value: formatTimeValue(hours), label: "Horas" },
    { value: formatTimeValue(minutes), label: "Min" },
    { value: formatTimeValue(seconds), label: "Seg" },
  ];
});

onMounted(() => {
  countdownTimer = window.setInterval(() => {
    remainingSeconds.value = Math.max(remainingSeconds.value - 1, 0);
  }, 1000);
});

onUnmounted(() => {
  window.clearInterval(countdownTimer);
});

const contestants = [
  {
    name: "Jungkook",
    fandom: "BTS",
    votes: "1,642,802",
    percent: 57.8,
    image: "/contestants/jungkook.png",
    accent: "from-blue-500 to-violet-700",
  },
  {
    name: "Lisa",
    fandom: "BLACKPINK",
    votes: "1,197,748",
    percent: 42.2,
    image: "/contestants/lisa.png",
    accent: "from-pink-500 to-fuchsia-700",
  },
];

const versusMatches = [
  { id: 1, title: "Batalla principal", contestants },
  { id: 2, title: "Duelo de fandoms", contestants },
  { id: 3, title: "Ronda especial", contestants },
  { id: 4, title: "Voto relámpago", contestants },
];

const selectedContestant = ref(null);
const voteModalStep = ref("vote");

const openVoteModal = (contestant) => {
  selectedContestant.value = contestant;
  voteModalStep.value = "vote";
};

const closeVoteModal = () => {
  selectedContestant.value = null;
  voteModalStep.value = "vote";
};

const confirmVote = () => {
  voteModalStep.value = "success";
};
</script>

<template>
  <section class="mx-auto max-w-352">
    <a
      href="/"
      class="inline-flex text-sm font-black text-fuchsia-300 transition hover:text-white"
    >
      ← Volver a votaciones
    </a>

    <div class="mt-5">
      <div class="mx-auto max-w-3xl text-left sm:text-center">
        <p class="text-xs font-black uppercase tracking-[0.35em] text-fuchsia-300">
          Tipo Versus
        </p>
        <h1 class="mt-3 text-3xl font-black leading-tight sm:text-5xl">
          Jungkook vs Lisa
        </h1>
        <p class="mt-4 text-sm leading-7 text-slate-400">
          Elige tu favorito en esta batalla. Cada voto mueve el porcentaje en
          tiempo real y ayuda a tu fandom a dominar el ranking.
        </p>
      </div>

      <div
        class="mx-auto mt-7 max-w-xl rounded-3xl border border-violet-300/10 bg-black/25 p-3 shadow-xl shadow-violet-950/20 sm:mt-8 sm:p-4"
      >
        <div class="flex items-center justify-center gap-3">
          <p class="text-center text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            En tiempo real
          </p>
          <span
            class="inline-flex items-center gap-1 rounded-md border border-red-300/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-red-200"
          >
            <span class="size-1.5 rounded-full bg-red-300 shadow-[0_0_10px_rgba(252,165,165,0.9)]"></span>
            Live
          </span>
        </div>
        <p class="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
          La votación termina en
        </p>
        <div class="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
          <div
            v-for="item in countdown"
            :key="item.label"
            class="rounded-2xl border border-cyan-300/10 bg-[#080a18] p-3 text-center shadow-inner shadow-cyan-950/20 sm:p-4"
          >
            <p class="text-xl font-black text-white sm:text-2xl">
              {{ item.value }}
            </p>
            <p class="mt-1 text-[10px] font-bold uppercase text-cyan-300/70">
              {{ item.label }}
            </p>
          </div>
        </div>
      </div>

      <div class="mx-auto mt-8 max-w-5xl space-y-6">
        <section
          v-for="match in versusMatches"
          :key="match.id"
        >
          <p class="mb-3 text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300">
            {{ match.title }}
          </p>
          <div class="relative grid grid-cols-2 items-stretch gap-0">
            <template
              v-for="(contestant, index) in match.contestants"
              :key="`${match.id}-${contestant.name}`"
            >
              <article
                class="relative mx-auto w-full min-w-0 cursor-pointer overflow-hidden border border-violet-300/10 bg-[#201b35]/95 shadow-xl shadow-black/20 transition hover:border-fuchsia-300/35"
                :class="[
                  index === 0 ? 'rounded-l-2xl border-r-0 border-amber-300/40 bg-[#211735] md:rounded-l-3xl' : 'rounded-r-2xl border-l-0 border-slate-300/35 bg-[#202438] md:rounded-r-3xl',
                  index === 0 ? 'col-start-1' : 'col-start-2',
                ]"
                role="button"
                tabindex="0"
                @click="openVoteModal(contestant)"
                @keydown.enter="openVoteModal(contestant)"
                @keydown.space.prevent="openVoteModal(contestant)"
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
        </section>
      </div>
    </div>

    <PollComments />

    <Teleport to="body">
      <div
        v-if="selectedContestant"
        class="fixed inset-0 z-9999 grid place-items-center bg-[#050514]/90 px-4 py-6 backdrop-blur-sm"
        @click.self="closeVoteModal"
      >
        <div
          class="relative w-full max-w-lg rounded-3xl border border-violet-300/25 bg-[#130f25]/95 p-5 text-center shadow-2xl shadow-fuchsia-950/40"
        >
          <button
            class="absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-white/15 bg-white/10 text-2xl leading-none text-white/80 transition hover:bg-white/20"
            type="button"
            :aria-label="$t('versus.closeModal')"
            @click="closeVoteModal"
          >
            ×
          </button>
          <div
            class="rounded-3xl border border-fuchsia-300/20 bg-linear-to-r from-amber-400/10 via-fuchsia-500/10 to-violet-500/10 p-3"
          >
            <div class="flex items-center gap-3 pr-10 text-left">
              <div class="size-24 shrink-0 overflow-hidden rounded-2xl border border-fuchsia-300/30">
                <img
                  :src="selectedContestant.image"
                  :alt="selectedContestant.name"
                  class="size-full object-cover"
                />
              </div>
              <div class="min-w-0">
                <h3 class="text-xl font-black text-white">
                  {{ selectedContestant.name }} {{ selectedContestant.fandom }}
                </h3>
                <p class="mt-2 text-sm font-black text-white">
                  <span class="text-pink-400">♥</span>
                  {{ $t('versus.votes', { count: selectedContestant.votes }) }}
                </p>
                <p class="mt-2 text-xs font-black text-amber-300">
                  📣 {{ $t('versus.fandomNeedsShare', { fandom: selectedContestant.fandom, name: selectedContestant.name }) }}
                </p>
              </div>
            </div>
          </div>

          <template v-if="voteModalStep === 'vote'">
            <button
              class="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-linear-to-r from-pink-500 to-fuchsia-600 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-500/30 transition hover:scale-[1.02]"
              type="button"
              @click="confirmVote"
            >
              {{ $t('versus.voteNow') }}
            </button>

            <div
              class="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-500/10 p-4 text-center"
            >
              <p class="text-[10px] font-black uppercase text-slate-300">
                {{ $t('versus.doubleVoteUnlock') }}
              </p>
              <p class="mt-1 text-lg font-black text-cyan-200">{{ $t('versus.doubleVotePower') }}</p>
              <p class="text-xs font-bold text-slate-300">{{ $t('versus.voteCountsDouble') }}</p>
            </div>

            <div class="mt-5 text-center">
              <h4 class="text-lg font-black text-white">
                {{ $t('versus.shareAndSupport', { name: selectedContestant.name }) }}
              </h4>
              <p class="mt-1 text-sm font-bold text-slate-300">
                {{ $t('versus.shareWithFandom', { fandom: selectedContestant.fandom }) }}
              </p>
              <div class="mt-4 flex items-center justify-center gap-3">
                <button class="group grid size-12 place-items-center rounded-full border border-blue-300/30 bg-blue-500 text-white shadow-lg shadow-blue-500/30 transition hover:scale-105 hover:bg-blue-400" type="button" :aria-label="$t('versus.shareFacebook')">
                  <svg class="size-5" viewBox="0 0 320 512" fill="currentColor" aria-hidden="true">
                    <path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06H297V6.26S260.43 0 225.36 0C152.14 0 104.11 44.38 104.11 124.72v70.62H22.89V288h81.22v224h100.34V288z" />
                  </svg>
                </button>
                <button class="group grid size-12 place-items-center rounded-full border border-white/15 bg-black text-white shadow-lg shadow-black/30 transition hover:scale-105 hover:bg-zinc-800" type="button" :aria-label="$t('versus.shareX')">
                  <svg class="size-5" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
                    <path d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8l164.9-188.5L26.8 48h145.6l100.5 132.9L389.2 48zm-24.8 373.8h39.1L151.1 88h-42l255.3 333.8z" />
                  </svg>
                </button>
                <button class="group grid size-12 place-items-center rounded-full border border-green-300/30 bg-green-500 text-white shadow-lg shadow-green-500/30 transition hover:scale-105 hover:bg-green-400" type="button" :aria-label="$t('versus.shareWhatsapp')">
                  <svg class="size-6" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
                    <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32 101 32 1 132.1 1 255c0 39.3 10.3 77.6 29.8 111.3L0 480l116.4-30.5c32.4 17.7 68.9 27 107.4 27h.1c122.9 0 222.9-100.1 222.9-223 0-59.3-23.1-115-65.9-157.4zM223.9 438.7c-34.3 0-67.9-9.2-97.2-26.6l-7-4.2-69 18.1 18.4-67.3-4.5-7.3C45.6 321 35.5 288.4 35.5 255c0-103.9 84.5-188.4 188.5-188.4 50.3 0 97.6 19.6 133.2 55.2 35.6 35.7 55.2 83 55.1 133.3 0 103.9-84.5 188.6-188.4 188.6zm103.3-141.3c-5.6-2.8-33.2-16.4-38.3-18.2-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18.2-17.6 22-3.2 3.7-6.5 4.2-12.1 1.4-33.2-16.6-55-29.6-76.9-67-5.8-10 5.8-9.3 16.6-30.9 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3s19.9 53.7 22.6 57.4c2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.8 10.7-1.6 33.2-13.6 37.9-26.7 4.7-13.1 4.7-24.3 3.2-26.7-1.3-2.5-5-3.9-10.6-6.7z" />
                  </svg>
                </button>
                <button class="group grid size-12 place-items-center rounded-full border border-sky-300/30 bg-sky-500 text-white shadow-lg shadow-sky-500/30 transition hover:scale-105 hover:bg-sky-400" type="button" :aria-label="$t('versus.shareTelegram')">
                  <svg class="size-6" viewBox="0 0 496 512" fill="currentColor" aria-hidden="true">
                    <path d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm121.8 169.9l-40.7 191.8c-3 13.6-11.1 16.9-22.4 10.5l-62-45.7-29.9 28.8c-3.3 3.3-6.1 6.1-12.5 6.1l4.5-63.1 114.9-103.8c5-4.5-1.1-7-7.8-2.5L171.8 289.4l-61.2-19.1c-13.3-4.2-13.6-13.3 2.8-19.7l239.1-92.2c11.1-4.2 20.8 2.7 17.3 19.5z" />
                  </svg>
                </button>
                <button class="group grid size-12 place-items-center rounded-full border border-violet-300/30 bg-violet-500 text-white shadow-lg shadow-violet-500/30 transition hover:scale-105 hover:bg-violet-400" type="button" :aria-label="$t('versus.copyLink')">
                  <svg class="size-5" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
                    <path d="M384 336h-192c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16h140.1L400 115.9V320c0 8.8-7.2 16-16 16zM192 384h192c35.3 0 64-28.7 64-64V115.9c0-17-6.7-33.3-18.7-45.3L377.4 18.7C365.4 6.7 349.1 0 332.1 0H192c-35.3 0-64 28.7-64 64v256c0 35.3 28.7 64 64 64zM64 128c-35.3 0-64 28.7-64 64v256c0 35.3 28.7 64 64 64h192c35.3 0 64-28.7 64-64v-32h-48v32c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V192c0-8.8 7.2-16 16-16h32v-48H64z" />
                  </svg>
                </button>
              </div>
            </div>
          </template>

          <template v-else>
            <div
              class="mt-4 rounded-3xl border border-violet-300/20 bg-[#19152d] p-5 text-center"
            >
              <div
                class="mx-auto grid size-14 place-items-center rounded-full border-4 border-violet-400 text-2xl text-white shadow-lg shadow-violet-500/30"
              >
                <i class="fa-solid fa-check" aria-hidden="true"></i>
              </div>
              <h3 class="mt-4 text-3xl font-black text-white">
                +1 voto agregado
              </h3>
              <p class="mt-1 text-sm font-black text-slate-300">
                para {{ selectedContestant.name }}
                <span class="text-amber-300">{{ selectedContestant.fandom }}</span>
              </p>

              <div
                class="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <p class="text-xs font-black uppercase text-amber-300">
                  Impulsa a tu fandom
                </p>
                <p class="mt-2 text-sm font-black text-white">
                  {{ selectedContestant.name }} lleva {{ selectedContestant.percent }}%
                  en esta batalla
                </p>
                <p class="mt-1 text-xs font-bold text-amber-100">
                  Comparte esta nominación para mantener el impulso.
                </p>
              </div>

              <button
                class="mt-4 flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-white/10"
                type="button"
                @click="closeVoteModal"
              >
                Ver batalla
              </button>

              <button
                class="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-linear-to-r from-amber-300 to-orange-500 text-sm font-black text-[#23120a] shadow-xl shadow-amber-500/30 transition hover:scale-[1.02]"
                type="button"
              >
                Crear certificado
              </button>
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </section>
</template>
