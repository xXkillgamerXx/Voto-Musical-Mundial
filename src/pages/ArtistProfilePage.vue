<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { translate } from "../i18n";
import { getCurrentApiAuth } from "../services/api/authApi";
import {
  followArtist,
  getArtistFollowStatus,
  unfollowArtist,
} from "../services/api/artistsApi";
import { onStoredAuthChange } from "../services/api/client";
import { getPoll, getPolls } from "../services/api/pollsApi";
import { getArtistsCached } from "../services/firebaseCache";

const { locale } = useI18n();
const pathParts = window.location.pathname.split("/").filter(Boolean);
const routeArtistKey = pathParts[1] || "";

const artist = ref(null);
const artistPolls = ref([]);
const followersCount = ref(0);
const currentUser = ref(null);
const isFollowing = ref(false);
const isLoading = ref(true);
const isTogglingFollow = ref(false);
const isUnfollowModalOpen = ref(false);
const isFollowSuccessModalOpen = ref(false);
const errorMessage = ref("");

let unsubscribeAuth = null;

const getArtistImage = (artistData) =>
  artistData?.image ||
  artistData?.imageUrl ||
  artistData?.photo ||
  artistData?.photoURL ||
  artistData?.foto ||
  "";

const getArtistBanner = (artistData) =>
  artistData?.banner ||
  artistData?.bannerUrl ||
  artistData?.cover ||
  artistData?.coverImage ||
  artistData?.portada ||
  getArtistImage(artistData);

const getArtistGroup = (artistData) =>
  artistData?.group || artistData?.fandom || "";

const formattedFollowers = computed(() =>
  followersCount.value.toLocaleString(locale.value),
);

const totalVotes = computed(() =>
  artistPolls.value.reduce((total, poll) => total + poll.votes, 0)
    || Number(artist.value?.totalVotes || 0),
);

const averageSupport = computed(() => {
  const pollsWithVotes = artistPolls.value.filter(
    (poll) => poll.totalVotes > 0,
  );

  if (!pollsWithVotes.length) {
    return "0.00%";
  }

  const totalPercent = pollsWithVotes.reduce(
    (total, poll) => total + poll.percent,
    0,
  );
  return `${(totalPercent / pollsWithVotes.length).toFixed(2)}%`;
});

const popularityScore = computed(() =>
  Math.round(followersCount.value * 10 + totalVotes.value),
);

const stats = computed(() => [
  { label: translate("artists.profile.followers"), value: formattedFollowers.value },
  { label: translate("artists.profile.accumulatedVotes"), value: totalVotes.value.toLocaleString(locale.value) },
  { label: translate("artists.profile.averageSupport"), value: averageSupport.value },
  { label: translate("artists.profile.popularity"), value: popularityScore.value.toLocaleString(locale.value) },
]);

const followLabel = computed(() => {
  if (!currentUser.value) {
    return translate("artists.profile.loginToFollow");
  }

  return isFollowing.value ? translate("artists.profile.following") : translate("artists.profile.follow");
});

const closeUnfollowModal = () => {
  if (isTogglingFollow.value) {
    return;
  }

  isUnfollowModalOpen.value = false;
};

const loadArtist = async () => {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    const artistRows = await getArtistsCached(null);
    const matchedArtist = artistRows.find(
      (row) =>
        String(row.slug || "") === routeArtistKey ||
        String(row.id || "") === routeArtistKey,
    );

    if (!matchedArtist) {
      errorMessage.value = translate("artists.profileErrors.notFound");
      artist.value = null;
      return;
    }

    artist.value = { ...matchedArtist };
    followersCount.value = Number(artist.value.followersCount || 0);
    await loadArtistPollStats();
  } catch {
    errorMessage.value = translate("artists.profileErrors.load");
  } finally {
    isLoading.value = false;
  }
};

const syncFollowStatus = async () => {
  if (!currentUser.value || !artist.value?.id) {
    isFollowing.value = false;
    return;
  }

  try {
    const status = await getArtistFollowStatus(artist.value.id);
    isFollowing.value = Boolean(status?.following);
    followersCount.value = Number(status?.followersCount ?? followersCount.value);
  } catch {
    isFollowing.value = false;
  }
};

const normalizeStoredPollStats = () => {
  const storedStats = artist.value?.pollStats || artist.value?.recentPollStats || [];

  return storedStats
    .filter(Boolean)
    .map((stat) => ({
      ...stat,
      votes: Number(stat.votes || 0),
      totalVotes: Number(stat.totalVotes || 0),
      percent: Number(stat.percent || 0),
    }))
    .sort((current, next) => next.votes - current.votes)
    .slice(0, 6);
};

const normalizeContestantVotes = (contestant) =>
  Number(
    contestant.totalVotes ??
      Number(contestant.votes || 0) + Number(contestant.manualVotes || 0),
  );

const loadArtistPollStats = async () => {
  if (!artist.value?.id) {
    artistPolls.value = [];
    return;
  }

  const artistId = String(artist.value.id);
  const storedStats = normalizeStoredPollStats();

  try {
    const pollRows = await getPolls(60);
    const pollDetails = await Promise.all(
      pollRows.map((poll) =>
        getPoll(poll.slug || poll.id).catch(() => null),
      ),
    );
    const stats = [];

    pollDetails.filter(Boolean).forEach((poll) => {
      const contestants = (poll.contestants || []).filter(
        (contestant) => String(contestant.artistId || contestant.artist?.id || "") === artistId,
      );

      if (!contestants.length) {
        return;
      }

      const votes = contestants.reduce(
        (total, contestant) => total + normalizeContestantVotes(contestant),
        0,
      );
      const pollTotalVotes = (poll.contestants || []).reduce(
        (total, contestant) => total + normalizeContestantVotes(contestant),
        0,
      );
      const latestRound = (poll.rounds || [])
        .filter((round) => contestants.some((contestant) => String(contestant.roundId || "") === String(round.id)))
        .at(-1);

      stats.push({
        title: latestRound?.title || poll.title || "Votación",
        status: latestRound?.status || poll.status || "draft",
        votes,
        totalVotes: pollTotalVotes,
        percent: pollTotalVotes ? (votes / pollTotalVotes) * 100 : 0,
      });
    });

    artistPolls.value = stats.length
      ? stats.sort((current, next) => next.votes - current.votes).slice(0, 6)
      : storedStats;
  } catch {
    artistPolls.value = storedStats;
  }
};

const toggleFollow = async () => {
  if (!currentUser.value) {
    window.location.href = "/registro";
    return;
  }

  if (!artist.value?.id || isTogglingFollow.value) {
    return;
  }

  if (isFollowing.value) {
    isUnfollowModalOpen.value = true;
    return;
  }

  errorMessage.value = "";
  isTogglingFollow.value = true;

  try {
    const result = await followArtist(artist.value.id);
    isFollowing.value = true;
    followersCount.value = Number(result?.followersCount ?? followersCount.value + 1);
    isFollowSuccessModalOpen.value = true;
  } catch (error) {
    errorMessage.value = error?.message || translate("artists.profileErrors.follow");
  } finally {
    isTogglingFollow.value = false;
  }
};

const confirmUnfollow = async () => {
  if (!artist.value?.id || isTogglingFollow.value) {
    return;
  }

  errorMessage.value = "";
  isTogglingFollow.value = true;

  try {
    const result = await unfollowArtist(artist.value.id);
    isFollowing.value = false;
    followersCount.value = Number(result?.followersCount ?? Math.max(0, followersCount.value - 1));
    isUnfollowModalOpen.value = false;
  } catch (error) {
    errorMessage.value = error?.message || translate("artists.profileErrors.follow");
  } finally {
    isTogglingFollow.value = false;
  }
};

onMounted(async () => {
  const syncAuth = (authState = getCurrentApiAuth()) => {
    currentUser.value = authState?.user || null;
    syncFollowStatus();
  };

  syncAuth();
  unsubscribeAuth = onStoredAuthChange(syncAuth);

  await loadArtist();
  syncFollowStatus();
});

onUnmounted(() => {
  unsubscribeAuth?.();
});
</script>

<template>
  <section class="mx-auto max-w-352 px-4 sm:px-6">
    <a
      href="/"
      class="inline-flex text-sm font-black text-fuchsia-300 transition hover:text-white"
    >
      {{ $t("artists.profile.back") }}
    </a>

    <p
      v-if="errorMessage"
      class="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
    >
      {{ errorMessage }}
    </p>

    <div
      v-if="isLoading"
      class="artist-profile-skeleton mt-6 overflow-hidden rounded-3xl border border-violet-300/15 bg-[#090b19]/90 shadow-2xl shadow-fuchsia-950/20"
    >
      <div class="relative min-h-72 bg-white/5">
        <div class="absolute inset-0 skeleton-shimmer"></div>
        <div class="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div class="flex items-end gap-4">
              <div class="size-28 rounded-3xl bg-white/10 sm:size-36"></div>
              <div>
                <div class="h-3 w-36 rounded-full bg-white/10"></div>
                <div class="mt-4 h-10 w-56 rounded-2xl bg-white/10 sm:h-14 sm:w-80"></div>
                <div class="mt-3 h-4 w-32 rounded-full bg-white/10"></div>
              </div>
            </div>
            <div class="h-12 w-36 rounded-full bg-white/10"></div>
          </div>
        </div>
      </div>

      <div class="p-5 lg:p-8">
        <div class="h-4 w-full max-w-3xl rounded-full bg-white/10"></div>
        <div class="mt-3 h-4 w-2/3 rounded-full bg-white/10"></div>
        <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            v-for="index in 4"
            :key="index"
            class="h-24 rounded-2xl border border-white/10 bg-white/5"
          ></div>
        </div>
        <div class="mt-5 h-36 rounded-3xl border border-white/10 bg-white/5"></div>
      </div>
    </div>

    <div
      v-else-if="artist"
      class="mt-6 overflow-hidden rounded-3xl border border-violet-300/15 bg-[#090b19]/90 shadow-2xl shadow-fuchsia-950/20"
    >
      <div
        class="relative min-h-72 bg-linear-to-br from-blue-950 via-violet-950 to-fuchsia-950"
      >
        <img
          v-if="getArtistBanner(artist)"
          :src="getArtistBanner(artist)"
          :alt="artist.name"
          class="absolute inset-0 size-full object-cover opacity-55"
        />
        <div
          class="absolute inset-0 bg-linear-to-t from-[#090b19] via-[#090b19]/30 to-transparent"
        ></div>
        <div class="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <div
            class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
          >
            <div class="flex items-end gap-4">
              <div
                class="relative size-28 overflow-hidden rounded-3xl border-2 border-fuchsia-300/40 shadow-xl shadow-fuchsia-500/20 sm:size-36"
              >
                <img
                  v-if="getArtistImage(artist)"
                  :src="getArtistImage(artist)"
                  :alt="artist.name"
                  class="size-full object-cover"
                />
                <span
                  v-else
                  class="grid size-full place-items-center bg-linear-to-br from-violet-500 to-fuchsia-500 text-4xl font-black"
                >
                  {{ artist.name?.charAt(0) || "A" }}
                </span>
              </div>
              <div>
                <p
                  class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300"
                >
                  {{ $t("artists.profile.eyebrow") }}
                </p>
                <h1
                  class="mt-2 text-4xl font-black leading-none text-white sm:text-6xl"
                >
                  {{ artist.name }}
                </h1>
                <p class="mt-2 text-lg font-black uppercase text-amber-300">
                  {{ artist.fandom }}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap gap-3">
              <button
                class="rounded-full px-7 py-3 text-sm font-black uppercase transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-70"
                :class="
                  isFollowing
                    ? 'border border-fuchsia-300/45 bg-black/20 text-fuchsia-100 shadow-lg shadow-black/20 hover:bg-fuchsia-400/10'
                    : 'bg-linear-to-r from-pink-500 to-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/30'
                "
                type="button"
                :disabled="isTogglingFollow"
                @click="toggleFollow"
              >
                {{ isTogglingFollow ? $t("artists.profile.saving") : followLabel }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="p-5 lg:p-8">
        <div>
          <p class="text-sm font-bold leading-7 text-slate-300">
            {{ artist.bio }}
          </p>

          <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div
              v-for="stat in stats"
              :key="stat.label"
              class="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <p
                class="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500"
              >
                {{ stat.label }}
              </p>
              <p class="mt-1 text-2xl font-black text-white">
                {{ stat.value }}
              </p>
            </div>
          </div>

          <div class="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr]">
            <div class="rounded-3xl border border-violet-300/15 bg-white/7 p-4">
              <p
                class="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300"
              >
                {{ $t("artists.profile.data") }}
              </p>
              <div
                class="mt-3 flex flex-wrap gap-2 text-sm font-bold text-slate-200"
              >
                <span
                  class="rounded-full border border-white/10 bg-white/5 px-3 py-2"
                >
                  {{ $t("artists.profile.role", { value: artist.role || $t("artists.profile.defaultRole") }) }}
                </span>
                <span
                  class="rounded-full border border-white/10 bg-white/5 px-3 py-2"
                >
                  {{ $t("artists.profile.country", { value: artist.country || $t("artists.profile.noCountry") }) }}
                </span>
                <span
                  class="rounded-full border border-white/10 bg-white/5 px-3 py-2"
                >
                  {{ $t("artists.profile.fandom", { value: getArtistGroup(artist) || $t("artists.profile.noGroup") }) }}
                </span>
              </div>
            </div>

            <div
              class="rounded-3xl border border-amber-300/15 bg-amber-500/5 p-4"
            >
              <p
                class="text-xs font-black uppercase tracking-[0.22em] text-amber-300"
              >
                {{ $t("artists.profile.achievements") }}
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <span
                  v-for="poll in artistPolls.slice(0, 3)"
                  :key="poll.title"
                  class="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-100"
                >
                  {{ poll.title }}
                </span>
                <span
                  v-if="!artistPolls.length"
                  class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-400"
                >
                  {{ $t("artists.profile.noAchievements") }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-6 grid gap-4 lg:grid-cols-3">
      <article
        v-for="poll in artistPolls"
        :key="poll.title"
        class="rounded-3xl border border-violet-300/10 bg-[#090b19]/90 p-4 shadow-xl shadow-black/20"
      >
        <p class="text-xs font-black uppercase text-fuchsia-300">
          {{ poll.status }}
        </p>
        <h3 class="mt-2 text-lg font-black text-white">{{ poll.title }}</h3>
        <div class="mt-4 flex items-center justify-between">
          <span class="text-xs font-bold text-slate-400">{{ $t("artists.profile.currentSupport") }}</span>
          <span class="text-xl font-black text-fuchsia-100"
            >{{ poll.percent.toFixed(2) }}%</span
          >
        </div>
        <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            class="h-full rounded-full bg-linear-to-r from-amber-300 to-fuchsia-500"
            :style="{ width: `${Math.min(poll.percent, 100)}%` }"
          ></div>
        </div>
        <p class="mt-2 text-xs font-bold text-slate-500">
          {{ $t("artists.profile.votesCount", { count: poll.votes.toLocaleString(locale) }) }}
        </p>
      </article>
      <article
        v-if="!artistPolls.length && artist"
        class="relative overflow-hidden rounded-4xl border border-fuchsia-300/15 bg-[#090b19]/90 p-6 text-center shadow-2xl shadow-fuchsia-950/20 lg:col-span-3 sm:p-8"
      >
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(217,70,239,0.18),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(34,211,238,0.12),transparent_30%)]"></div>
        <div class="relative">
          <div class="mx-auto grid size-18 place-items-center rounded-4xl border border-fuchsia-300/25 bg-fuchsia-400/10 text-3xl text-fuchsia-100 shadow-xl shadow-fuchsia-950/20">
            <i class="fa-solid fa-music" aria-hidden="true"></i>
          </div>
          <p class="mt-5 text-xs font-black uppercase tracking-[0.28em] text-fuchsia-300">
            Sin rondas registradas
          </p>
          <h2 class="mt-3 text-2xl font-black text-white">
            Aún no hay votos de {{ artist.name }}
          </h2>
          <p class="mx-auto mt-3 max-w-xl text-sm font-bold leading-6 text-slate-300">
            Este artista todavía no aparece con votos registrados en rondas cerradas o activas. Cuando participe en una votación, aquí verás su apoyo, porcentaje y resultados.
          </p>
          <a
            href="/votaciones"
            class="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-linear-to-r from-fuchsia-500 to-cyan-400 px-6 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.02]"
          >
            Ver votaciones
          </a>
        </div>
      </article>
    </div>

  </section>
  <div class="mb-8"></div>

  <Teleport to="body">
    <div
      v-if="isUnfollowModalOpen"
      class="fixed inset-0 z-90 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
      @click="closeUnfollowModal"
    >
      <div
        class="relative w-full max-w-md overflow-hidden rounded-4xl border border-fuchsia-300/25 bg-[#090b19] p-6 text-white shadow-2xl shadow-fuchsia-950/50"
        @click.stop
      >
        <div class="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-fuchsia-500/20 blur-3xl"></div>
        <div class="pointer-events-none absolute -bottom-24 left-0 size-64 rounded-full bg-cyan-400/10 blur-3xl"></div>
        <div class="relative">
          <div class="mx-auto grid size-16 place-items-center rounded-3xl border border-fuchsia-300/30 bg-fuchsia-400/10 text-2xl text-fuchsia-100">
            <i class="fa-solid fa-user-minus" aria-hidden="true"></i>
          </div>
          <p class="mt-5 text-center text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            Confirmar accion
          </p>
          <h2 class="mt-3 text-center text-3xl font-black text-white">
            Dejar de seguir
          </h2>
          <p class="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-slate-300">
            Seguro quieres dejar de seguir a
            <strong class="text-fuchsia-100">{{ artist?.name || "este artista" }}</strong>?
          </p>

          <div class="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black uppercase text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isTogglingFollow"
              @click="closeUnfollowModal"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="min-h-12 rounded-2xl bg-linear-to-r from-pink-500 to-fuchsia-600 px-5 text-sm font-black uppercase text-white shadow-lg shadow-fuchsia-950/35 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isTogglingFollow"
              @click="confirmUnfollow"
            >
              {{ isTogglingFollow ? "Quitando..." : "Dejar de seguir" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="isFollowSuccessModalOpen"
      class="fixed inset-0 z-90 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
      @click.self="isFollowSuccessModalOpen = false"
    >
      <div class="relative w-full max-w-lg overflow-hidden rounded-4xl border border-emerald-300/25 bg-[#090b19] p-6 text-white shadow-2xl shadow-emerald-950/40">
        <div class="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-emerald-400/20 blur-3xl"></div>
        <div class="pointer-events-none absolute -bottom-24 right-0 size-72 rounded-full bg-fuchsia-400/15 blur-3xl"></div>

        <div class="relative text-center">
          <div class="mx-auto grid size-18 place-items-center rounded-4xl border border-emerald-300/30 bg-emerald-400/10 text-3xl text-emerald-100 shadow-xl shadow-emerald-950/25">
            <i class="fa-solid fa-bell" aria-hidden="true"></i>
          </div>
          <p class="mt-5 text-xs font-black uppercase tracking-[0.28em] text-emerald-300">
            Ahora sigues a este artista
          </p>
          <h2 class="mt-3 text-3xl font-black text-white">
            {{ artist?.name || "Artista" }} está en tus favoritos
          </h2>
          <p class="mx-auto mt-3 max-w-md text-sm font-bold leading-6 text-slate-300">
            Te avisaremos cuando participe en una votación, avance de ronda o gane una fase importante.
          </p>

          <div class="mt-5 grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 text-left">
            <p class="text-sm font-black text-white">
              <i class="fa-solid fa-check mr-2 text-emerald-300" aria-hidden="true"></i>
              Recibirás novedades de sus rondas activas.
            </p>
            <p class="text-sm font-black text-white">
              <i class="fa-solid fa-trophy mr-2 text-amber-300" aria-hidden="true"></i>
              Si gana, aparecerá en tus favoritos y actividad.
            </p>
          </div>

          <div class="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black uppercase text-slate-200 transition hover:bg-white/10"
              @click="isFollowSuccessModalOpen = false"
            >
              Seguir viendo
            </button>
            <a
              href="/perfil"
              class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-linear-to-r from-emerald-400 to-cyan-400 px-5 text-sm font-black uppercase text-slate-950 shadow-lg shadow-emerald-950/25 transition hover:scale-[1.01]"
            >
              Ver mi perfil
            </a>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.artist-profile-skeleton {
  position: relative;
}

.skeleton-shimmer {
  background:
    linear-gradient(110deg, transparent 0%, rgba(255, 255, 255, 0.08) 45%, transparent 70%),
    radial-gradient(circle at 25% 20%, rgba(217, 70, 239, 0.18), transparent 30%),
    radial-gradient(circle at 80% 15%, rgba(34, 211, 238, 0.12), transparent 28%);
  animation: skeleton-shimmer 1.6s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% {
    opacity: 0.45;
    transform: translateX(-12%);
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0.45;
    transform: translateX(12%);
  }
}
</style>
