<script setup>
import { computed, onMounted, ref } from "vue";
import { collection, getDocs } from "firebase/firestore";
import { useI18n } from "vue-i18n";
import { translate } from "../i18n";
import { db } from "../firebase";

const { locale } = useI18n();
const artists = ref([]);
const isLoading = ref(true);
const isLoadingVotes = ref(false);
const errorMessage = ref("");
const minimumSkeletonDuration = 900;

const chartAccents = [
  {
    bar: "from-amber-300 via-pink-400 to-fuchsia-500",
    ring: "border-amber-300/45",
    text: "text-amber-200",
  },
  {
    bar: "from-cyan-300 via-sky-400 to-violet-500",
    ring: "border-cyan-300/35",
    text: "text-cyan-200",
  },
  {
    bar: "from-orange-300 via-rose-400 to-pink-500",
    ring: "border-orange-300/40",
    text: "text-orange-200",
  },
];

const getArtistImage = (artist) =>
  artist?.image ||
  artist?.imageUrl ||
  artist?.photo ||
  artist?.photoURL ||
  artist?.foto ||
  artist?.banner ||
  "";

const getArtistBanner = (artist) =>
  artist?.banner ||
  artist?.bannerUrl ||
  artist?.cover ||
  artist?.coverImage ||
  artist?.portada ||
  getArtistImage(artist);

const getArtistGroup = (artist) => artist?.group || artist?.fandom || "";

const artistUrl = (artist) => `/artista/${artist.slug || artist.id}`;

const wait = (milliseconds) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

const currentChartWeek = computed(() => {
  const now = new Date();
  const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDaysOfYear = Math.floor((now - firstDayOfYear) / 86400000);
  const weekNumber = Math.ceil(
    (pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7,
  );

  return translate("ranking.chartWeek", {
    year: now.getFullYear(),
    week: String(weekNumber).padStart(2, "0"),
  });
});

const rankedArtists = computed(() =>
  artists.value
    .slice()
    .sort(
      (current, next) =>
        next.popularityScore - current.popularityScore ||
        next.totalVotes - current.totalVotes ||
        next.followersCount - current.followersCount ||
        current.name.localeCompare(next.name),
    )
    .map((artist, index) => ({
      ...artist,
      rank: index + 1,
      lastWeekRank: artist.lastWeekRank || artist.lastWeek || "NEW",
      peakPosition: artist.peakPosition || artist.peak || index + 1,
      weeksOnChart: artist.weeksOnChart || artist.weeks || 1,
      accent: chartAccents[index] || chartAccents[index % chartAccents.length],
    })),
);

const featuredArtists = computed(() => rankedArtists.value.slice(0, 3));

const maxPopularityScore = computed(() =>
  Math.max(...rankedArtists.value.map((artist) => artist.popularityScore), 1),
);

const totalChartVotes = computed(() =>
  rankedArtists.value.reduce((total, artist) => total + artist.totalVotes, 0),
);

const formatNumber = (value) => Number(value || 0).toLocaleString(locale.value);

const barWidth = (value) =>
  `${Math.max(7, Math.round((Number(value || 0) / maxPopularityScore.value) * 100))}%`;

const applyVotesToArtists = (votesByArtist) => {
  artists.value = artists.value.map((artist) => {
    const totalVotes = votesByArtist.get(artist.id) || 0;

    return {
      ...artist,
      totalVotes,
      popularityScore: Math.round(artist.followersCount * 10 + totalVotes),
    };
  });
};

const loadPollVotesByArtist = async () => {
  const votesByArtist = new Map();
  const pollsSnap = await getDocs(collection(db, "polls"));

  await Promise.all(
    pollsSnap.docs.map(async (pollDoc) => {
      const roundsSnap = await getDocs(
        collection(db, "polls", pollDoc.id, "rounds"),
      );

      await Promise.all(
        roundsSnap.docs.map(async (roundDoc) => {
          const contestantsSnap = await getDocs(
            collection(
              db,
              "polls",
              pollDoc.id,
              "rounds",
              roundDoc.id,
              "contestants",
            ),
          );

          contestantsSnap.docs.forEach((contestantDoc) => {
            const contestant = contestantDoc.data();
            const artistId = contestant.artistId;

            if (!artistId) {
              return;
            }

            const totalVotes = Number(
              contestant.totalVotes ??
                (contestant.votes || 0) + (contestant.manualVotes || 0),
            );

            votesByArtist.set(
              artistId,
              (votesByArtist.get(artistId) || 0) + totalVotes,
            );
          });
        }),
      );
    }),
  );

  return votesByArtist;
};

const loadArtists = async () => {
  isLoading.value = true;
  isLoadingVotes.value = false;
  errorMessage.value = "";
  const skeletonDelay = wait(minimumSkeletonDuration);

  try {
    const artistsSnap = await getDocs(collection(db, "artists"));

    const artistRows = await Promise.all(
      artistsSnap.docs.map(async (artistDoc) => {
        const artist = {
          id: artistDoc.id,
          ...artistDoc.data(),
        };
        const followersSnap = await getDocs(
          collection(db, "artists", artistDoc.id, "followers"),
        );
        const followersCount = followersSnap.size;

        return {
          ...artist,
          followersCount,
          totalVotes: 0,
          popularityScore: Math.round(followersCount * 10),
        };
      }),
    );

    await skeletonDelay;
    artists.value = artistRows;

    isLoading.value = false;
    isLoadingVotes.value = true;
    const votesByArtist = await loadPollVotesByArtist();
    applyVotesToArtists(votesByArtist);
  } catch {
    await skeletonDelay;
    errorMessage.value = translate("ranking.errors.load");
  } finally {
    isLoading.value = false;
    isLoadingVotes.value = false;
  }
};

onMounted(loadArtists);
</script>

<template>
  <section class="mx-auto max-w-352 px-4 py-8 sm:px-6 lg:py-12">
    <div
      class="relative overflow-hidden rounded-4xl border border-fuchsia-300/15 bg-[#060713] p-6 shadow-2xl shadow-fuchsia-950/25 sm:p-8 lg:p-10"
    >
      <div
        class="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-fuchsia-400/20 blur-3xl"
      ></div>
      <div
        class="pointer-events-none absolute -bottom-28 left-8 size-96 rounded-full bg-cyan-400/10 blur-3xl"
      ></div>
      <div
        class="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end"
      >
        <template v-if="isLoading">
          <div>
            <div class="h-3 w-48 animate-pulse rounded-full bg-amber-300/25"></div>
            <div
              class="mt-5 h-14 w-full max-w-2xl animate-pulse rounded-3xl bg-white/12 sm:h-18"
            ></div>
            <div
              class="mt-4 h-4 w-full max-w-3xl animate-pulse rounded-full bg-white/10"
            ></div>
            <div
              class="mt-3 h-4 w-2/3 animate-pulse rounded-full bg-white/10"
            ></div>
            <div
              class="mt-5 h-9 w-44 animate-pulse rounded-full bg-amber-300/15"
            ></div>
          </div>

          <div class="rounded-3xl border border-white/10 bg-white/7 p-5 backdrop-blur">
            <div class="h-3 w-32 animate-pulse rounded-full bg-fuchsia-300/20"></div>
            <div class="mt-5 grid grid-cols-3 gap-3">
              <div
                v-for="metric in 3"
                :key="`hero-metric-skeleton-${metric}`"
                class="rounded-2xl bg-black/25 p-4"
              >
                <div class="h-3 w-16 animate-pulse rounded-full bg-white/10"></div>
                <div class="mt-3 h-7 w-20 animate-pulse rounded-xl bg-white/15"></div>
              </div>
            </div>
            <div class="mt-4 h-3 w-full animate-pulse rounded-full bg-white/10"></div>
          </div>
        </template>

        <template v-else>
          <div>
          <p
            class="text-xs font-black uppercase tracking-[0.32em] text-amber-300"
          >
            {{ $t("ranking.eyebrow") }}
          </p>
          <h1
            class="mt-4 text-4xl font-black uppercase leading-none tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            {{ $t("ranking.title") }}
          </h1>
          <p
            class="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base"
          >
            {{ $t("ranking.description") }}
          </p>
          <div
            class="mt-5 inline-flex rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-amber-100"
          >
            {{ currentChartWeek }}
          </div>
          </div>

          <div class="rounded-3xl border border-white/10 bg-white/7 p-5 backdrop-blur">
            <p class="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-200">
              {{ $t("ranking.metricsTitle") }}
            </p>
            <div class="mt-5 grid grid-cols-3 gap-3">
              <div class="rounded-2xl bg-black/25 p-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {{ $t("ranking.artists") }}
                </p>
                <p class="mt-1 text-2xl font-black text-white">
                  {{ rankedArtists.length }}
                </p>
              </div>
              <div class="rounded-2xl bg-black/25 p-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {{ $t("ranking.votes") }}
                </p>
                <p class="mt-1 text-2xl font-black text-white">
                  {{ formatNumber(totalChartVotes) }}
                </p>
              </div>
              <div class="rounded-2xl bg-black/25 p-4">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {{ $t("ranking.formula") }}
                </p>
                <p class="mt-1 text-sm font-black text-amber-200">
                  {{ $t("ranking.formulaValue") }}
                </p>
              </div>
            </div>
            <p class="mt-4 text-xs leading-5 text-slate-500">
              {{ $t("ranking.historyNote") }}
            </p>
            <p
              v-if="isLoadingVotes"
              class="mt-3 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black uppercase tracking-widest text-cyan-100"
            >
              {{ $t("ranking.updatingVotes") }}
            </p>
          </div>
        </template>
      </div>
    </div>

    <p
      v-if="errorMessage"
      class="mt-6 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
    >
      {{ errorMessage }}
    </p>

    <template v-if="isLoading">
      <div class="mt-8 grid gap-5 lg:grid-cols-3">
        <article
          v-for="index in 3"
          :key="`ranking-card-skeleton-${index}`"
          class="overflow-hidden rounded-4xl border border-white/10 bg-[#090b19] shadow-2xl shadow-violet-950/20"
        >
          <div
            class="relative h-86 overflow-hidden bg-linear-to-br from-slate-950 via-violet-950 to-fuchsia-950"
          >
            <div class="absolute inset-0 animate-pulse bg-white/8"></div>
            <div
              class="absolute left-5 top-5 h-10 w-20 animate-pulse rounded-full bg-white/15"
            ></div>
            <div class="absolute bottom-0 left-0 right-0 p-5">
              <div class="h-3 w-28 animate-pulse rounded-full bg-amber-300/20"></div>
              <div class="mt-3 h-9 w-48 animate-pulse rounded-2xl bg-white/15"></div>
              <div class="mt-3 h-3 w-32 animate-pulse rounded-full bg-fuchsia-200/15"></div>
            </div>
          </div>

          <div class="p-5">
            <div class="flex items-end justify-between gap-4">
              <div>
                <div class="h-3 w-32 animate-pulse rounded-full bg-white/10"></div>
                <div class="mt-3 h-10 w-36 animate-pulse rounded-2xl bg-white/15"></div>
              </div>
              <div class="h-9 w-24 animate-pulse rounded-full bg-white/10"></div>
            </div>

            <div class="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                class="h-full w-2/3 animate-pulse rounded-full bg-linear-to-r from-amber-300/40 to-fuchsia-500/40"
              ></div>
            </div>

            <div class="mt-5 grid grid-cols-2 gap-3">
              <div
                v-for="metric in 4"
                :key="`ranking-card-metric-skeleton-${index}-${metric}`"
                class="rounded-2xl bg-white/7 p-4"
              >
                <div class="h-3 w-20 animate-pulse rounded-full bg-white/10"></div>
                <div class="mt-3 h-6 w-16 animate-pulse rounded-xl bg-white/15"></div>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div
        class="mt-8 overflow-hidden rounded-4xl border border-white/10 bg-[#080a18]/90 shadow-2xl shadow-black/20"
      >
        <div class="border-b border-white/10 px-5 py-4 sm:px-6">
          <div class="h-3 w-28 animate-pulse rounded-full bg-fuchsia-300/20"></div>
        </div>

        <div
          v-for="index in 6"
          :key="`ranking-row-skeleton-${index}`"
          class="grid gap-4 border-b border-white/10 px-5 py-4 last:border-b-0 lg:grid-cols-[4.5rem_1fr_5rem_5rem_5rem_12rem] lg:items-center sm:px-6"
        >
          <div class="h-9 w-12 animate-pulse rounded-xl bg-white/15"></div>

          <div class="flex min-w-0 items-center gap-4">
            <div class="size-16 shrink-0 animate-pulse rounded-2xl bg-white/15"></div>
            <div class="min-w-0 flex-1">
              <div class="h-5 w-44 animate-pulse rounded-full bg-white/15"></div>
              <div class="mt-3 h-3 w-full max-w-96 animate-pulse rounded-full bg-white/10"></div>
              <div class="mt-3 h-2 w-full animate-pulse rounded-full bg-white/10"></div>
            </div>
          </div>

          <div
            v-for="metric in 4"
            :key="`ranking-row-metric-skeleton-${index}-${metric}`"
          >
            <div class="h-3 w-12 animate-pulse rounded-full bg-white/10"></div>
            <div class="mt-2 h-6 w-16 animate-pulse rounded-xl bg-white/15"></div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="rankedArtists.length">
      <div class="mt-8 grid gap-5 lg:grid-cols-3">
        <article
          v-for="artist in featuredArtists"
          :key="artist.id"
          class="group relative overflow-hidden rounded-4xl border bg-[#090b19] shadow-2xl shadow-violet-950/25 transition hover:-translate-y-1"
          :class="artist.accent.ring"
        >
          <a :href="artistUrl(artist)" class="block">
            <div
              class="relative h-86 overflow-hidden bg-linear-to-br from-slate-950 via-violet-950 to-fuchsia-950"
            >
              <img
                v-if="getArtistBanner(artist)"
                :src="getArtistBanner(artist)"
                :alt="artist.name"
                class="absolute inset-0 size-full object-cover opacity-70 transition duration-500 group-hover:scale-105"
              />
              <div
                class="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,4,13,0.08)_0%,rgba(3,4,13,0.22)_42%,#060713_100%)]"
              ></div>
              <div
                class="absolute left-5 top-5 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-sm font-black uppercase tracking-widest text-white backdrop-blur"
              >
                #{{ artist.rank }}
              </div>
              <div class="absolute bottom-0 left-0 right-0 p-5">
                <p
                  class="text-xs font-black uppercase tracking-[0.22em]"
                  :class="artist.accent.text"
                >
                  {{ $t("ranking.hotArtist") }}
                </p>
                <h2
                  class="mt-2 text-3xl font-black uppercase leading-none text-white"
                >
                  {{ artist.name }}
                </h2>
                <p
                  class="mt-2 text-xs font-black uppercase tracking-widest text-fuchsia-100"
                >
                  {{ getArtistGroup(artist) || $t("ranking.noGroup") }}
                </p>
              </div>
            </div>

            <div class="p-5">
              <div class="flex items-end justify-between gap-4">
                <div>
                  <p
                    class="text-[10px] font-black uppercase tracking-widest text-slate-500"
                  >
                    {{ $t("ranking.popularityScore") }}
                  </p>
                  <p class="mt-1 text-4xl font-black text-white">
                    {{ formatNumber(artist.popularityScore) }}
                  </p>
                </div>
                <span
                  class="rounded-full bg-white/8 px-3 py-2 text-xs font-black text-slate-200"
                >
                  {{ formatNumber(artist.totalVotes) }} {{ $t("ranking.votes").toLowerCase() }}
                </span>
              </div>

              <div class="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  class="h-full rounded-full bg-linear-to-r"
                  :class="artist.accent.bar"
                  :style="{ width: barWidth(artist.popularityScore) }"
                ></div>
              </div>

              <div class="mt-5 grid grid-cols-2 gap-3">
                <div class="rounded-2xl bg-white/7 p-4">
                  <p
                    class="text-[10px] font-black uppercase tracking-widest text-cyan-200/80"
                  >
                    {{ $t("ranking.followers") }}
                  </p>
                  <p class="mt-1 text-xl font-black text-white">
                    {{ formatNumber(artist.followersCount) }}
                  </p>
                </div>
                <div class="rounded-2xl bg-white/7 p-4">
                  <p
                    class="text-[10px] font-black uppercase tracking-widest text-amber-200/80"
                  >
                    {{ $t("ranking.lastWeek") }}
                  </p>
                  <p class="mt-1 text-xl font-black text-white">
                    {{ artist.lastWeekRank }}
                  </p>
                </div>
                <div class="rounded-2xl bg-white/7 p-4">
                  <p
                    class="text-[10px] font-black uppercase tracking-widest text-fuchsia-200/80"
                  >
                    {{ $t("ranking.peak") }}
                  </p>
                  <p class="mt-1 text-xl font-black text-white">
                    #{{ artist.peakPosition }}
                  </p>
                </div>
                <div class="rounded-2xl bg-white/7 p-4">
                  <p
                    class="text-[10px] font-black uppercase tracking-widest text-violet-200/80"
                  >
                    {{ $t("ranking.weeks") }}
                  </p>
                  <p class="mt-1 text-xl font-black text-white">
                    {{ artist.weeksOnChart }}
                  </p>
                </div>
              </div>
            </div>
          </a>
        </article>
      </div>

      <div
        class="mt-8 overflow-hidden rounded-4xl border border-white/10 bg-[#080a18]/90 shadow-2xl shadow-black/20"
      >
        <div class="border-b border-white/10 px-5 py-4 sm:px-6">
          <p
            class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300"
          >
            {{ $t("ranking.fullChart") }}
          </p>
        </div>

        <a
          v-for="artist in rankedArtists"
          :key="artist.id"
          :href="artistUrl(artist)"
          class="grid gap-4 border-b border-white/10 px-5 py-4 transition last:border-b-0 hover:bg-white/5 lg:grid-cols-[4.5rem_1fr_5rem_5rem_5rem_12rem] lg:items-center sm:px-6"
        >
          <div class="flex items-center gap-3">
            <span class="text-3xl font-black text-white"
              >#{{ artist.rank }}</span
            >
          </div>

          <div class="flex min-w-0 items-center gap-4">
            <span
              class="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-fuchsia-300/30 bg-linear-to-br from-violet-500 to-fuchsia-500 text-xl font-black text-white"
            >
              <img
                v-if="getArtistImage(artist)"
                :src="getArtistImage(artist)"
                :alt="artist.name"
                class="size-full object-cover"
              />
              <span v-else>{{ artist.name?.charAt(0) || "A" }}</span>
            </span>
            <span class="min-w-0">
              <span class="block truncate text-lg font-black text-white">{{
                artist.name
              }}</span>
              <span
                class="mt-1 block truncate text-xs font-black uppercase tracking-widest text-slate-500"
              >
                {{ $t("ranking.rowSummary", {
                  group: getArtistGroup(artist) || $t("ranking.noGroup"),
                  followers: formatNumber(artist.followersCount),
                  votes: formatNumber(artist.totalVotes),
                }) }}
              </span>
              <span
                class="mt-3 block h-2 overflow-hidden rounded-full bg-white/10"
              >
                <span
                  class="block h-full rounded-full bg-linear-to-r"
                  :class="artist.accent.bar"
                  :style="{ width: barWidth(artist.popularityScore) }"
                ></span>
              </span>
            </span>
          </div>

          <div>
            <p
              class="text-[10px] font-black uppercase tracking-widest text-slate-500"
            >
              {{ $t("ranking.last") }}
            </p>
            <p class="mt-1 text-lg font-black text-white">
              {{ artist.lastWeekRank }}
            </p>
          </div>

          <div>
            <p
              class="text-[10px] font-black uppercase tracking-widest text-slate-500"
            >
              {{ $t("ranking.peak") }}
            </p>
            <p class="mt-1 text-lg font-black text-white">
              #{{ artist.peakPosition }}
            </p>
          </div>

          <div>
            <p
              class="text-[10px] font-black uppercase tracking-widest text-slate-500"
            >
              {{ $t("ranking.weeks") }}
            </p>
            <p class="mt-1 text-lg font-black text-white">
              {{ artist.weeksOnChart }}
            </p>
          </div>

          <div class="lg:text-right">
            <p
              class="text-[10px] font-black uppercase tracking-widest text-slate-500"
            >
              {{ $t("common.labels.score") }}
            </p>
            <p class="mt-1 text-2xl font-black text-white">
              {{ formatNumber(artist.popularityScore) }}
            </p>
          </div>
        </a>
      </div>
    </template>

    <div v-else class="mt-8 rounded-4xl border border-white/10 bg-slate-950/45">
      <p class="px-4 py-10 text-center text-sm font-bold text-slate-400">
        {{ $t("ranking.empty") }}
      </p>
    </div>
  </section>
</template>
