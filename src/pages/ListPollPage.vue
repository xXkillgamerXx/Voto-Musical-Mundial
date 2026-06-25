<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";

const pathParts = window.location.pathname.split("/").filter(Boolean);
const routeYear = Number(pathParts[1]) || new Date().getFullYear();
const routeSlug = pathParts[2] || "";
const roundQueryParam = "ronda";

const poll = ref(null);
const currentPollId = ref("");
const artists = ref([]);
const contestants = ref([]);
const rounds = ref([]);
const selectedRoundContestants = ref([]);
const currentUser = ref(null);
const isLoading = ref(true);
const isLoadingSelectedRound = ref(false);
const isVoting = ref("");
const errorMessage = ref("");
const shareMessage = ref("");
const now = ref(Date.now());
const selectedRoundId = ref("");

let unsubscribeAuth = null;
let unsubscribePoll = null;
let unsubscribeContestants = null;
let unsubscribeRounds = null;
let clockTimer = null;

const getArtist = (artistId) =>
  artists.value.find((artist) => artist.id === artistId);

const getArtistImage = (artist) =>
  artist?.image ||
  artist?.imageUrl ||
  artist?.photo ||
  artist?.photoURL ||
  artist?.foto ||
  artist?.banner ||
  "";

const getArtistGroup = (artist) => artist?.group || artist?.fandom || "";

const activeRound = computed(() =>
  poll.value?.status === "closed"
    ? rounds.value.filter((round) => round.status === "closed").at(-1) ||
      rounds.value.at(-1) ||
      null
    : rounds.value.find((round) => round.id === poll.value?.activeRoundId) ||
      rounds.value.find((round) => round.status === "live") ||
      rounds.value[0] ||
      null,
);
const pollEndDate = computed(
  () =>
    activeRound.value?.endAt?.toDate?.() ||
    poll.value?.endAt?.toDate?.() ||
    null,
);
const hasEnded = computed(() =>
  Boolean(pollEndDate.value && pollEndDate.value.getTime() <= now.value),
);
const isVotingOpen = computed(
  () => poll.value?.status === "live" && !hasEnded.value,
);
const isSelectingWinners = computed(
  () =>
    poll.value?.status === "selecting_winners" ||
    (poll.value?.status === "live" && hasEnded.value),
);
const isClosed = computed(() => poll.value?.status === "closed");

const rankedContestants = computed(() =>
  contestants.value
    .map((contestant) => {
      const totalVotes = Number(
        contestant.totalVotes ??
          (contestant.votes || 0) + (contestant.manualVotes || 0),
      );
      return {
        ...contestant,
        artist: getArtist(contestant.artistId),
        totalVotes,
      };
    })
    .sort((current, next) => next.totalVotes - current.totalVotes),
);

const activeContestants = computed(() =>
  contestants.value
    .map((contestant, index) => {
      const totalVotes = Number(
        contestant.totalVotes ??
          (contestant.votes || 0) + (contestant.manualVotes || 0),
      );
      return {
        ...contestant,
        order: Number(contestant.order ?? index),
        matchGroup: Number(contestant.matchGroup || 0),
        matchOrder: Number(contestant.matchOrder ?? index),
        artist: getArtist(contestant.artistId),
        totalVotes,
      };
    })
    .sort((current, next) => current.order - next.order),
);

const versusMatches = computed(() => {
  const manualGroups = activeContestants.value.reduce((groups, contestant) => {
    if (!contestant.matchGroup) {
      return groups;
    }

    const group = groups.get(contestant.matchGroup) || [];
    group.push(contestant);
    groups.set(contestant.matchGroup, group);
    return groups;
  }, new Map());

  if (manualGroups.size) {
    return [...manualGroups.entries()]
      .sort(([currentGroup], [nextGroup]) => currentGroup - nextGroup)
      .map(([groupNumber, contestants]) => ({
        id: `${activeRound.value?.id || "round"}-${groupNumber}`,
        title: `Duelo ${groupNumber}`,
        contestants: contestants.sort(
          (current, next) => current.matchOrder - next.matchOrder,
        ),
      }));
  }

  const matches = [];

  for (let index = 0; index < activeContestants.value.length; index += 2) {
    matches.push({
      id: `${activeRound.value?.id || "round"}-${index}`,
      title: `Duelo ${Math.floor(index / 2) + 1}`,
      contestants: activeContestants.value.slice(index, index + 2),
    });
  }

  return matches;
});

const totalVotes = computed(() =>
  rankedContestants.value.reduce(
    (total, contestant) => total + contestant.totalVotes,
    0,
  ),
);

const displayedContestants = computed(() =>
  selectedRoundStep.value?.status === "closed"
    ? selectedRoundContestants.value
    : rankedContestants.value,
);

const displayedTotalVotes = computed(() =>
  displayedContestants.value.reduce(
    (total, contestant) => total + contestant.totalVotes,
    0,
  ),
);

const shouldShowVoteButtons = computed(
  () => isVotingOpen.value && selectedRoundStep.value?.status !== "closed",
);

const winners = computed(() =>
  rankedContestants.value.filter(
    (contestant) =>
      contestant.isWinner ||
      poll.value?.winnerIds?.includes(contestant.artistId),
  ),
);

const winnerSourceRound = computed(() => {
  if (selectedRoundStep.value?.status === "closed") {
    return selectedRoundStep.value;
  }

  return activeRound.value?.status === "closed" ? activeRound.value : null;
});

const hasRoundWinners = computed(() =>
  Boolean(winnerSourceRound.value?.winnerIds?.length),
);

const isContestantWinner = (contestant) =>
  hasRoundWinners.value &&
  (contestant.isWinner ||
    winnerSourceRound.value?.winnerIds?.includes(contestant.artistId));

const contestantWinnerRank = (contestant) => {
  if (!isContestantWinner(contestant)) {
    return null;
  }

  return (
    contestant.winnerRank ||
    (winnerSourceRound.value?.winnerIds || []).indexOf(contestant.artistId) + 1
  );
};

const winnerToneClasses = (contestant, type = "card") => {
  const rank = contestantWinnerRank(contestant);
  const tones = {
    1: {
      card: "border-amber-300/60 bg-amber-400/10 shadow-xl shadow-amber-950/20",
      rank: "text-amber-200",
      badge: "border border-amber-300/35 bg-amber-300/15 text-amber-100",
    },
    2: {
      card: "border-slate-200/60 bg-slate-200/10 shadow-xl shadow-slate-950/20",
      rank: "text-slate-100",
      badge: "border border-slate-200/35 bg-slate-200/15 text-slate-100",
    },
    3: {
      card: "border-orange-300/60 bg-orange-400/10 shadow-xl shadow-orange-950/20",
      rank: "text-orange-200",
      badge: "border border-orange-300/35 bg-orange-300/15 text-orange-100",
    },
    default: {
      card: "border-white/10 bg-white/5",
      rank: "text-fuchsia-200",
      badge: "border border-white/10 bg-white/5 text-slate-300",
    },
  };

  return (tones[rank] || tones.default)[type];
};

const finalWinnerArtists = computed(() => {
  const finalRound = rounds.value
    .filter((round) => round.status === "closed" && round.winnerIds?.length)
    .at(-1);
  const winnerIds = poll.value?.winnerIds?.length
    ? poll.value.winnerIds
    : finalRound?.winnerIds || [];

  return winnerIds
    .slice(0, 1)
    .map((artistId) => getArtist(artistId))
    .filter(Boolean);
});

const finalWinnerEntries = computed(() => {
  const finalRound = rounds.value
    .filter((round) => round.status === "closed" && round.winnerIds?.length)
    .at(-1);
  const winnerIds = poll.value?.winnerIds?.length
    ? poll.value.winnerIds
    : finalRound?.winnerIds || [];

  return winnerIds
    .slice(0, 1)
    .map((artistId) => {
      const artist = getArtist(artistId);
      const contestant = rankedContestants.value.find(
        (item) => item.artistId === artistId,
      );
      const votes = Number(contestant?.totalVotes || 0);
      const percent = totalVotes.value ? (votes / totalVotes.value) * 100 : 0;

      return {
        id: artistId,
        artist,
        votes,
        percent,
        percentLabel: `${percent.toFixed(2)}%`,
        percentWidth: `${Math.min(percent, 100)}%`,
      };
    })
    .filter((entry) => entry.artist);
});

const finalRankingEntries = computed(() =>
  rankedContestants.value
    .map((contestant, index) => {
      const votes = Number(contestant.totalVotes || 0);
      const percent = totalVotes.value ? (votes / totalVotes.value) * 100 : 0;

      return {
        id: contestant.id,
        rank: index + 1,
        artist: contestant.artist,
        votes,
        percent,
        percentLabel: `${percent.toFixed(2)}%`,
        percentWidth: `${Math.min(percent, 100)}%`,
      };
    })
    .filter((entry) => entry.artist),
);

const podiumEntries = computed(() => finalRankingEntries.value.slice(1, 3));
const remainingRankingEntries = computed(() =>
  finalRankingEntries.value.slice(3),
);

const shareFinalWinner = async (winner) => {
  shareMessage.value = "";
  errorMessage.value = "";

  const title = `${winner.name} ganó ${poll.value?.title || "la votación"}`;
  const text = `El ganador final es ${winner.name}.`;
  const url = window.location.href;

  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }

    await navigator.clipboard.writeText(`${title}\n${text}\n${url}`);
    shareMessage.value = "Link del ganador copiado.";
    window.setTimeout(() => {
      shareMessage.value = "";
    }, 3000);
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }

    errorMessage.value = "No se pudo compartir el ganador.";
  }
};

const activeRoundIndex = computed(() =>
  rounds.value.findIndex((round) => round.id === activeRound.value?.id),
);

const previousRound = computed(() => {
  if (activeRoundIndex.value <= 0) {
    return null;
  }

  return rounds.value[activeRoundIndex.value - 1] || null;
});

const previousRoundWinners = computed(() =>
  (previousRound.value?.winnerIds || [])
    .map((artistId) => getArtist(artistId))
    .filter(Boolean),
);

const roundIntroRemainingSeconds = computed(() => {
  const startedAt = activeRound.value?.liveStartedAt?.toDate?.();

  if (!startedAt) {
    return 0;
  }

  return Math.max(
    Math.ceil((10000 - (now.value - startedAt.getTime())) / 1000),
    0,
  );
});

const isRoundIntroVisible = computed(
  () =>
    isVotingOpen.value &&
    previousRoundWinners.value.length > 0 &&
    roundIntroRemainingSeconds.value > 0,
);

const roundSteps = computed(() =>
  rounds.value
    .map((round, index) => {
      const isActive = activeRound.value?.id === round.id && isVotingOpen.value;
      const activeRoundIndex = rounds.value.findIndex(
        (item) => item.id === activeRound.value?.id,
      );
      const isBeforeActiveRound =
        activeRoundIndex > -1 && index < activeRoundIndex;
      const isFinalResultVisible = isClosed.value && round.status === "closed";

      return {
        ...round,
        number: index + 1,
        isActive,
        isVisible: isActive || isBeforeActiveRound || isFinalResultVisible,
        winners: (round.winnerIds || [])
          .map((artistId) => getArtist(artistId))
          .filter(Boolean),
      };
    })
    .filter((round) => round.isVisible),
);

const selectedRoundStep = computed(
  () =>
    roundSteps.value.find((round) => round.id === selectedRoundId.value) ||
    null,
);

const updateSelectedRoundUrl = (roundId) => {
  const url = new URL(window.location.href);

  if (roundId) {
    url.searchParams.set(roundQueryParam, roundId);
  } else {
    url.searchParams.delete(roundQueryParam);
  }

  window.history.replaceState(
    {},
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
};

const findRoundFromUrl = () => {
  const roundParam = new URLSearchParams(window.location.search).get(
    roundQueryParam,
  );

  if (!roundParam) {
    return null;
  }

  return (
    roundSteps.value.find((round) => round.id === roundParam) ||
    roundSteps.value.find((round) => String(round.number) === roundParam) ||
    null
  );
};

const syncSelectedRoundFromUrl = async () => {
  if (selectedRoundId.value || !roundSteps.value.length) {
    return;
  }

  const round = findRoundFromUrl();

  if (!round) {
    return;
  }

  selectedRoundId.value = round.id;
  await loadSelectedRoundContestants(round);
};

const selectRoundStep = async (round) => {
  if (selectedRoundId.value === round.id) {
    selectedRoundId.value = "";
    selectedRoundContestants.value = [];
    updateSelectedRoundUrl("");
    return;
  }

  selectedRoundId.value = round.id;
  updateSelectedRoundUrl(round.id);
  await loadSelectedRoundContestants(round);
};

const shouldShowUpcomingRound = computed(() =>
  Boolean(
    rounds.value.length &&
    !rounds.value.some((round) => round.status === "live"),
  ),
);

const countdown = computed(() => {
  if (!pollEndDate.value) {
    return [
      { label: "Días", value: "00" },
      { label: "Horas", value: "00" },
      { label: "Min", value: "00" },
      { label: "Seg", value: "00" },
    ];
  }

  const remainingSeconds = Math.max(
    Math.floor((pollEndDate.value.getTime() - now.value) / 1000),
    0,
  );
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const formatValue = (value) => String(value).padStart(2, "0");

  return [
    { label: "Días", value: formatValue(days) },
    { label: "Horas", value: formatValue(hours) },
    { label: "Min", value: formatValue(minutes) },
    { label: "Seg", value: formatValue(seconds) },
  ];
});

const percentFor = (votes) => {
  if (!totalVotes.value) {
    return "0.00%";
  }

  return `${((votes / totalVotes.value) * 100).toFixed(2)}%`;
};

const percentForDisplayed = (votes) => {
  if (!displayedTotalVotes.value) {
    return "0.00%";
  }

  return `${((votes / displayedTotalVotes.value) * 100).toFixed(2)}%`;
};

const percentForMatch = (contestant, match) => {
  const totalMatchVotes = match.contestants.reduce(
    (total, item) => total + item.totalVotes,
    0,
  );

  if (!totalMatchVotes) {
    return "0.00%";
  }

  return `${((contestant.totalVotes / totalMatchVotes) * 100).toFixed(2)}%`;
};

const listenContestants = (pollId) => {
  unsubscribeContestants?.();

  const contestantsCollection = activeRound.value
    ? collection(
        db,
        "polls",
        pollId,
        "rounds",
        activeRound.value.id,
        "contestants",
      )
    : collection(db, "polls", pollId, "contestants");

  unsubscribeContestants = onSnapshot(
    contestantsCollection,
    (contestantsSnap) => {
      contestants.value = contestantsSnap.docs.map((contestantDoc) => ({
        id: contestantDoc.id,
        ...contestantDoc.data(),
      }));
    },
    () => {
      errorMessage.value = "No se pudieron cargar los participantes.";
    },
  );
};

const loadSelectedRoundContestants = async (round) => {
  selectedRoundContestants.value = [];
  const selectedPollId = poll.value?.id || currentPollId.value;

  if (!selectedPollId || round.status !== "closed") {
    return;
  }

  isLoadingSelectedRound.value = true;

  try {
    const contestantsSnap = await getDocs(
      collection(
        db,
        "polls",
        selectedPollId,
        "rounds",
        round.id,
        "contestants",
      ),
    );

    selectedRoundContestants.value = contestantsSnap.docs
      .map((contestantDoc) => {
        const contestant = contestantDoc.data();
        const totalVotes = Number(
          contestant.totalVotes ??
            (contestant.votes || 0) + (contestant.manualVotes || 0),
        );

        return {
          id: contestantDoc.id,
          ...contestant,
          artist: getArtist(contestant.artistId || contestantDoc.id),
          totalVotes,
        };
      })
      .filter((contestant) => contestant.artist)
      .sort((current, next) => {
        const currentWinnerIndex = (round.winnerIds || []).indexOf(
          current.artistId,
        );
        const nextWinnerIndex = (round.winnerIds || []).indexOf(next.artistId);
        const currentRank =
          currentWinnerIndex >= 0
            ? currentWinnerIndex
            : Number.POSITIVE_INFINITY;
        const nextRank =
          nextWinnerIndex >= 0 ? nextWinnerIndex : Number.POSITIVE_INFINITY;

        return currentRank - nextRank || next.totalVotes - current.totalVotes;
      });
  } catch {
    errorMessage.value = "No se pudieron cargar los participantes de la ronda.";
  } finally {
    isLoadingSelectedRound.value = false;
  }
};

const listenRounds = (pollId) => {
  unsubscribeRounds?.();
  unsubscribeRounds = onSnapshot(
    query(
      collection(db, "polls", pollId, "rounds"),
      orderBy("createdAt", "asc"),
    ),
    (roundsSnap) => {
      rounds.value = roundsSnap.docs.map((roundDoc) => ({
        id: roundDoc.id,
        ...roundDoc.data(),
      }));
      listenContestants(pollId);
      syncSelectedRoundFromUrl();
    },
    () => {
      errorMessage.value = "No se pudieron cargar las rondas.";
    },
  );
};

const loadArtists = async () => {
  const artistsSnap = await getDocs(collection(db, "artists"));
  artists.value = artistsSnap.docs.map((artistDoc) => ({
    id: artistDoc.id,
    ...artistDoc.data(),
  }));
};

const loadPoll = async () => {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    await loadArtists();

    const pollsQuery = routeSlug
      ? query(collection(db, "polls"), where("slug", "==", routeSlug))
      : query(collection(db, "polls"), where("type", "==", "list"));
    const pollsSnap = await getDocs(pollsQuery);
    const pollDoc =
      pollsSnap.docs.find((docSnap) => {
        const data = docSnap.data();
        return !data.year || data.year === routeYear;
      }) || pollsSnap.docs[0];

    if (!pollDoc) {
      errorMessage.value = "No encontramos esa votacion.";
      poll.value = null;
      currentPollId.value = "";
      return;
    }

    currentPollId.value = pollDoc.id;
    unsubscribePoll = onSnapshot(doc(db, "polls", pollDoc.id), (pollSnap) => {
      poll.value = pollSnap.exists()
        ? { id: pollSnap.id, ...pollSnap.data() }
        : null;
    });
    listenRounds(pollDoc.id);
  } catch {
    errorMessage.value = "No se pudo cargar la votacion.";
  } finally {
    isLoading.value = false;
  }
};

const voteFor = async (contestant) => {
  errorMessage.value = "";

  if (!currentUser.value) {
    errorMessage.value = "Inicia sesion para votar.";
    return;
  }

  if (!poll.value?.id || !isVotingOpen.value) {
    errorMessage.value = "La votacion no esta abierta.";
    return;
  }

  isVoting.value = contestant.artistId;

  try {
    await addDoc(collection(db, "polls", poll.value.id, "votes"), {
      userId: currentUser.value.uid,
      artistId: contestant.artistId,
      roundId: activeRound.value?.id || null,
      amount: 1,
      createdAt: serverTimestamp(),
    });

    const contestantRef = activeRound.value
      ? doc(
          db,
          "polls",
          poll.value.id,
          "rounds",
          activeRound.value.id,
          "contestants",
          contestant.artistId,
        )
      : doc(db, "polls", poll.value.id, "contestants", contestant.artistId);

    await updateDoc(contestantRef, {
      votes: increment(1),
      totalVotes: increment(1),
    });
  } catch {
    errorMessage.value = "No se pudo registrar tu voto.";
  } finally {
    isVoting.value = "";
  }
};

onMounted(() => {
  unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    currentUser.value = user;
  });
  clockTimer = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
  loadPoll();
});

onUnmounted(() => {
  unsubscribeAuth?.();
  unsubscribePoll?.();
  unsubscribeContestants?.();
  unsubscribeRounds?.();
  window.clearInterval(clockTimer);
});
</script>

<template>
  <section class="mx-auto max-w-352 px-4 pb-16 sm:px-6">
    <div
      v-if="isLoading"
      class="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm font-bold text-slate-300"
    >
      Cargando votacion...
    </div>

    <div
      v-else-if="errorMessage && !poll"
      class="rounded-3xl border border-red-300/20 bg-red-500/10 p-8 text-center text-sm font-bold text-red-200"
    >
      {{ errorMessage }}
    </div>

    <template v-else>
      <article
        class="overflow-hidden rounded-4xl border border-violet-300/20 bg-[#080a18] shadow-2xl shadow-fuchsia-950/25"
      >
        <div
          class="relative min-h-80 bg-linear-to-br from-violet-950 to-fuchsia-950"
        >
          <img
            v-if="poll?.banner"
            :src="poll.banner"
            :alt="poll.title"
            class="absolute inset-0 size-full object-cover"
          />
          <div
            class="absolute inset-0 bg-linear-to-t from-[#080a18] via-[#080a18]/45 to-black/20"
          ></div>
          <div class="absolute inset-x-0 bottom-0 p-5 sm:p-8">
            <p
              class="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300"
            >
              Votacion en vivo
            </p>
            <h1
              class="mt-3 text-4xl font-black leading-none text-white sm:text-6xl"
            >
              {{ poll?.title }}
            </h1>
            <p
              class="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base"
            >
              {{ poll?.description }}
            </p>
          </div>
        </div>
      </article>

      <div class="mt-6 flex justify-center">
        <div
          class="grid w-full max-w-2xl grid-cols-4 gap-2 rounded-3xl border border-white/10 bg-white/5 p-4"
        >
          <div
            v-for="item in countdown"
            :key="item.label"
            class="rounded-2xl bg-slate-950/60 p-3 text-center"
          >
            <p class="text-2xl font-black text-white">{{ item.value }}</p>
            <p
              class="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400"
            >
              {{ item.label }}
            </p>
          </div>
        </div>
      </div>

      <section
        v-if="roundSteps.length && !isClosed"
        class="mt-6 rounded-4xl border border-white/10 bg-white/5 p-4 sm:p-5"
      >
        <div class="flex items-center justify-between gap-4">
          <p
            class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300"
          >
            Proceso de rondas
          </p>
          <p class="text-xs font-bold text-slate-500">
            Ganadores y ronda actual
          </p>
        </div>

        <div class="mt-5 overflow-x-auto pb-1">
          <div class="flex min-w-max items-start gap-1">
            <button
              v-for="(round, index) in roundSteps"
              :key="round.id"
              type="button"
              class="relative flex w-42 mr-2 cursor-pointer flex-col items-center rounded-3xl border px-2 pb-3 pt-3 text-center transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300"
              :class="
                selectedRoundId === round.id
                  ? 'border-fuchsia-300/35 bg-white/8 ring-2 ring-fuchsia-300/20'
                  : 'border-transparent'
              "
              :aria-pressed="selectedRoundId === round.id"
              @click="selectRoundStep(round)"
            >
              <div
                v-if="index < roundSteps.length - 1"
                class="absolute left-[calc(50%+2rem)] top-10 h-px"
              >
                <div class="ml-4 w-20 border-b border-white/25"></div>
              </div>
              <div
                class="relative z-10 grid size-14 place-items-center rounded-full border text-sm font-black"
                :class="
                  round.isActive
                    ? 'border-cyan-300/50 bg-cyan-400/20 text-cyan-100 shadow-lg shadow-cyan-950/30'
                    : round.status === 'closed'
                      ? 'border-amber-300/45 bg-amber-400/15 text-amber-100'
                      : 'border-white/15 bg-slate-950 text-slate-300'
                "
              >
                {{ round.number }}
              </div>

              <p class="mt-2 max-w-36 truncate text-sm font-black text-white">
                {{ round.title }}
              </p>
              <p
                class="mt-1 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest"
                :class="
                  round.isActive
                    ? 'bg-cyan-400/10 text-cyan-200'
                    : round.status === 'closed'
                      ? 'bg-amber-400/10 text-amber-200'
                      : 'bg-white/5 text-slate-500'
                "
              >
                <span v-if="round.isActive">En progreso</span>
                <span v-else-if="round.status === 'closed'">Finalizada</span>
                <span v-else>Preparando</span>
              </p>

              <p class="mt-3 text-xs font-bold text-slate-500">
                Toca para ver detalle
              </p>
            </button>

            <div
              v-if="shouldShowUpcomingRound"
              class="flex w-42 flex-col items-center text-center"
            >
              <div
                class="grid size-14 place-items-center rounded-full border border-dashed border-white/20 bg-slate-950/50 text-lg font-black text-slate-500"
              >
                +
              </div>
              <p
                class="mt-3 text-xs font-black uppercase tracking-widest text-slate-500"
              >
                Siguiente
              </p>
              <p class="mt-1 text-sm font-black text-white">Próximamente</p>
            </div>
          </div>
        </div>
      </section>

      <p
        v-if="errorMessage && poll"
        class="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
      >
        {{ errorMessage }}
      </p>
      <p
        v-if="shareMessage"
        class="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200"
      >
        {{ shareMessage }}
      </p>

      <section
        v-if="isClosed && finalWinnerEntries.length"
        class="winner-modal relative mt-8 overflow-hidden rounded-4xl border border-amber-300/30 bg-[#080a18] p-6 text-center shadow-2xl shadow-amber-950/25 sm:p-10"
      >
        <div
          class="winner-light pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-amber-300/20 blur-3xl"
        ></div>
        <div
          class="winner-light-secondary pointer-events-none absolute -bottom-24 right-0 size-96 rounded-full bg-fuchsia-400/15 blur-3xl"
        ></div>
        <div
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.18),transparent_34%),radial-gradient(circle_at_85%_30%,rgba(217,70,239,0.14),transparent_28%)]"
        ></div>

        <div class="relative">
          <div
            class="winner-crown mx-auto grid size-20 place-items-center rounded-4xl border border-amber-300/30 bg-amber-300/10 text-4xl shadow-xl shadow-amber-950/30"
          >
            ♛
          </div>
          <p
            class="mt-6 text-xs font-black uppercase tracking-[0.32em] text-amber-200"
          >
            Resultado final
          </p>
          <h2 class="mt-3 text-4xl font-black text-white sm:text-6xl">
            Ganador
          </h2>
          <p
            class="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base"
          >
            La votación terminó. Este es el artista ganador.
          </p>
        </div>

        <div class="relative mx-auto mt-10 max-w-3xl">
          <article
            v-for="(winnerEntry, index) in finalWinnerEntries"
            :key="winnerEntry.id"
            class="winner-card overflow-hidden rounded-4xl border border-amber-300/25 bg-slate-950/60 text-left shadow-2xl shadow-amber-950/25 md:grid md:grid-cols-[18rem_1fr]"
          >
            <span
              class="relative grid min-h-72 place-items-center overflow-hidden bg-linear-to-br from-amber-300/30 via-fuchsia-500/20 to-slate-950 text-5xl font-black text-white"
            >
              <img
                v-if="getArtistImage(winnerEntry.artist)"
                :src="getArtistImage(winnerEntry.artist)"
                :alt="winnerEntry.artist.name"
                class="absolute inset-0 size-full object-cover"
              />
              <span
                class="absolute inset-0 bg-linear-to-t from-[#080a18]/85 via-transparent to-transparent"
              ></span>
              <span
                v-if="!getArtistImage(winnerEntry.artist)"
                class="relative z-10"
              >
                {{ winnerEntry.artist.name?.charAt(0) || "A" }}
              </span>
              <span
                class="absolute left-5 top-5 z-10 grid size-13 place-items-center rounded-2xl border border-amber-300/30 bg-amber-300/20 text-sm font-black text-amber-100 backdrop-blur"
              >
                #{{ index + 1 }}
              </span>
            </span>

            <span class="flex flex-col justify-center p-6 sm:p-8">
              <span
                class="text-xs font-black uppercase tracking-[0.28em] text-amber-200"
              >
                Artista ganador
              </span>
              <span
                class="mt-3 block text-4xl font-black leading-none text-white sm:text-5xl"
                >{{ winnerEntry.artist.name }}</span
              >
              <span class="mt-3 text-base font-bold uppercase text-amber-100">{{
                getArtistGroup(winnerEntry.artist) || "Ganador final"
              }}</span>
              <span
                class="winner-stats mt-6 overflow-hidden rounded-3xl border border-amber-300/25 bg-amber-400/10 p-4"
              >
                <span
                  class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
                >
                  <span>
                    <span
                      class="block text-xs font-black uppercase tracking-[0.24em] text-amber-200"
                    >
                      Ganó con
                    </span>
                    <span
                      class="mt-2 block text-4xl font-black leading-none text-white sm:text-5xl"
                    >
                      {{ winnerEntry.votes.toLocaleString("es") }}
                    </span>
                    <span
                      class="mt-1 block text-xs font-bold uppercase tracking-widest text-slate-300"
                    >
                      votos
                    </span>
                  </span>
                  <span class="text-left sm:text-right">
                    <span
                      class="block text-xs font-black uppercase tracking-[0.24em] text-fuchsia-200"
                    >
                      Porcentaje
                    </span>
                    <span
                      class="winner-percent mt-2 block text-5xl font-black leading-none text-amber-100 sm:text-6xl"
                    >
                      {{ winnerEntry.percentLabel }}
                    </span>
                  </span>
                </span>
                <span
                  class="mt-5 block h-4 overflow-hidden rounded-full bg-white/10"
                >
                  <span
                    class="winner-percent-bar block h-full rounded-full bg-linear-to-r from-amber-300 via-pink-400 to-fuchsia-400"
                    :style="{ width: winnerEntry.percentWidth }"
                  ></span>
                </span>
              </span>
              <span
                class="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-slate-200"
              >
                Gracias por participar. Esta artista se queda con el primer
                lugar de la votación.
              </span>
            </span>
          </article>

          <div
            v-for="winnerEntry in finalWinnerEntries"
            :key="`${winnerEntry.id}-actions`"
            class="winner-actions relative mx-auto mt-5 max-w-2xl overflow-hidden rounded-4xl border border-white/10 bg-white/8 p-3 shadow-2xl shadow-fuchsia-950/20 backdrop-blur sm:mt-6"
          >
            <span
              class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_50%,rgba(251,191,36,0.22),transparent_30%),radial-gradient(circle_at_82%_40%,rgba(217,70,239,0.24),transparent_32%)]"
            ></span>
            <span
              class="relative flex flex-col items-stretch gap-3 sm:flex-row"
            >
              <a
                href="/salon-de-la-fama"
                class="group inline-flex min-h-16 flex-1 items-center justify-center gap-3 rounded-3xl bg-linear-to-r from-amber-300 via-pink-400 to-fuchsia-500 px-5 py-3 text-center text-sm font-black uppercase leading-tight tracking-wide text-white shadow-lg shadow-amber-950/30 transition hover:-translate-y-0.5 hover:shadow-fuchsia-900/35"
              >
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-2xl bg-white/18 text-base"
                >
                  <i class="fa-solid fa-trophy" aria-hidden="true"></i>
                </span>
                <span>Ver salón de la fama</span>
              </a>
              <button
                type="button"
                class="group inline-flex min-h-16 flex-1 items-center justify-center gap-3 rounded-3xl border border-white/15 bg-slate-950/55 px-5 py-3 text-center text-sm font-black uppercase leading-tight tracking-wide text-white shadow-lg shadow-slate-950/25 transition hover:-translate-y-0.5 hover:border-fuchsia-200/35 hover:bg-white/12"
                @click="shareFinalWinner(winnerEntry.artist)"
              >
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-2xl bg-white/10 text-base"
                >
                  <i class="fa-solid fa-share-nodes" aria-hidden="true"></i>
                </span>
                <span>Compartir ganador</span>
              </button>
            </span>
          </div>
        </div>
      </section>

      <section
        v-if="
          isClosed &&
          finalWinnerEntries.length &&
          (podiumEntries.length || remainingRankingEntries.length)
        "
        class="relative mt-6 rounded-4xl border border-white/10 bg-white/4 p-4 shadow-xl shadow-fuchsia-950/15 sm:p-6"
      >
        <p
          v-if="podiumEntries.length"
          class="text-center text-xs font-black uppercase tracking-[0.28em] text-fuchsia-200"
        >
          También destacaron
        </p>
        <div v-if="podiumEntries.length" class="mt-4 grid gap-4 lg:grid-cols-2">
          <article
            v-for="entry in podiumEntries"
            :key="entry.id"
            class="winner-podium-card rounded-3xl border border-white/10 bg-slate-950/55 p-4"
          >
            <div class="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
              <div class="flex min-w-0 items-center gap-3">
                <span
                  class="grid size-12 shrink-0 place-items-center rounded-2xl border text-sm font-black"
                  :class="
                    entry.rank === 2
                      ? 'border-slate-200/35 bg-slate-200/15 text-slate-100'
                      : 'border-amber-600/35 bg-amber-700/15 text-amber-100'
                  "
                >
                  #{{ entry.rank }}
                </span>
                <span
                  class="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-xl font-black text-white"
                >
                  <img
                    v-if="getArtistImage(entry.artist)"
                    :src="getArtistImage(entry.artist)"
                    :alt="entry.artist.name"
                    class="size-full object-cover"
                  />
                  <span v-else>{{ entry.artist.name?.charAt(0) || "A" }}</span>
                </span>
                <span class="min-w-0">
                  <span class="block truncate text-lg font-black text-white">{{
                    entry.artist.name
                  }}</span>
                  <span
                    class="block truncate text-xs font-bold uppercase text-slate-400"
                    >{{ getArtistGroup(entry.artist) || "Finalista" }}</span
                  >
                </span>
              </div>

              <div class="grid grid-cols-2 gap-2 sm:min-w-56">
                <div class="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p
                    class="text-[10px] font-black uppercase tracking-widest text-slate-500"
                  >
                    Votos
                  </p>
                  <p class="mt-1 text-xl font-black text-white">
                    {{ entry.votes.toLocaleString("es") }}
                  </p>
                </div>
                <div class="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p
                    class="text-[10px] font-black uppercase tracking-widest text-slate-500"
                  >
                    Porcentaje
                  </p>
                  <p class="mt-1 text-xl font-black text-fuchsia-100">
                    {{ entry.percentLabel }}
                  </p>
                </div>
              </div>
            </div>

            <span
              class="mt-3 block h-2 overflow-hidden rounded-full bg-white/10"
            >
              <span
                class="winner-percent-bar block h-full rounded-full bg-linear-to-r from-cyan-300 to-fuchsia-300"
                :style="{ width: entry.percentWidth }"
              ></span>
            </span>
          </article>
        </div>

        <div
          v-if="remainingRankingEntries.length"
          class="mt-4 rounded-3xl border border-white/10 bg-slate-950/35 p-4 text-left"
        >
          <p
            class="text-xs font-black uppercase tracking-[0.24em] text-slate-400"
          >
            Más lugares
          </p>
          <div class="mt-3 space-y-2">
            <div
              v-for="entry in remainingRankingEntries"
              :key="entry.id"
              class="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3"
            >
              <span
                class="grid size-9 place-items-center rounded-xl bg-white/5 text-xs font-black text-slate-300"
              >
                #{{ entry.rank }}
              </span>
              <span class="min-w-0">
                <span class="block truncate text-sm font-black text-white">{{
                  entry.artist.name
                }}</span>
                <span class="block truncate text-xs font-bold text-slate-500"
                  >{{ entry.votes.toLocaleString("es") }} votos</span
                >
              </span>
              <span
                class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-fuchsia-100"
              >
                {{ entry.percentLabel }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="isRoundIntroVisible"
        class="winner-modal relative mt-8 overflow-hidden rounded-4xl border border-amber-300/30 bg-[#080a18] p-6 text-center shadow-2xl shadow-amber-950/25 sm:p-10"
      >
        <div
          class="winner-light pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-amber-300/20 blur-3xl"
        ></div>
        <div
          class="winner-light-secondary pointer-events-none absolute -bottom-24 right-0 size-96 rounded-full bg-fuchsia-400/15 blur-3xl"
        ></div>
        <div
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.18),transparent_34%),radial-gradient(circle_at_85%_30%,rgba(217,70,239,0.14),transparent_28%)]"
        ></div>

        <div class="relative">
          <div
            class="winner-crown mx-auto grid size-20 place-items-center rounded-4xl border border-amber-300/30 bg-amber-300/10 text-4xl shadow-xl shadow-amber-950/30"
          >
            ♛
          </div>
          <p
            class="mt-6 text-xs font-black uppercase tracking-[0.32em] text-amber-200"
          >
            {{ previousRound?.title || "Ronda anterior" }}
          </p>
          <h2 class="mt-3 text-4xl font-black text-white sm:text-6xl">
            Ganó la ronda
          </h2>
          <p
            class="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base"
          >
            En unos segundos comienza
            {{ activeRound?.title || "la siguiente ronda" }}.
          </p>
        </div>

        <div class="relative mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
          <article
            v-for="(winner, index) in previousRoundWinners"
            :key="winner.id"
            class="winner-card flex items-center gap-4 rounded-3xl border border-amber-300/25 bg-slate-950/60 p-4 text-left shadow-xl shadow-amber-950/20"
          >
            <span
              class="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-300/15 text-sm font-black text-amber-100"
            >
              #{{ index + 1 }}
            </span>
            <span
              class="grid size-20 shrink-0 place-items-center overflow-hidden rounded-3xl bg-linear-to-br from-amber-300 to-fuchsia-500 text-xl font-black text-white"
            >
              <img
                v-if="getArtistImage(winner)"
                :src="getArtistImage(winner)"
                :alt="winner.name"
                class="size-full object-cover"
              />
              <span v-else>{{ winner.name?.charAt(0) || "A" }}</span>
            </span>
            <span class="min-w-0">
              <span class="block truncate text-2xl font-black text-white">{{
                winner.name
              }}</span>
              <span class="text-sm font-bold uppercase text-amber-100">{{
                getArtistGroup(winner) || "Ganador de ronda"
              }}</span>
            </span>
          </article>
        </div>

        <div
          class="relative mx-auto mt-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 shadow-xl shadow-amber-950/20 backdrop-blur"
        >
          <span class="size-2 animate-bounce rounded-full bg-amber-300"></span>
          <span
            class="text-xs font-black uppercase tracking-widest text-slate-300"
          >
            Nueva ronda en {{ roundIntroRemainingSeconds }}s
          </span>
        </div>
      </section>

      <section
        v-else-if="isSelectingWinners"
        class="waiting-card relative mt-8 grid min-h-[460px] place-items-center overflow-hidden rounded-4xl border border-fuchsia-300/25 bg-[#080a18] p-8 text-center shadow-2xl shadow-fuchsia-950/25 sm:min-h-[560px] sm:p-12"
      >
        <div
          class="waiting-aurora pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-fuchsia-500/20 blur-3xl"
        ></div>
        <div
          class="waiting-aurora-secondary pointer-events-none absolute -bottom-28 right-0 size-96 rounded-full bg-cyan-400/15 blur-3xl"
        ></div>
        <div
          class="waiting-orbit pointer-events-none absolute left-1/2 top-1/2 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-300/10"
        ></div>
        <div
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(217,70,239,0.22),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.16),transparent_25%)]"
        ></div>
        <div
          class="pointer-events-none absolute left-0 top-0 h-px w-full animate-pulse bg-linear-to-r from-transparent via-fuchsia-300/70 to-transparent"
        ></div>

        <div class="relative mx-auto max-w-3xl">
          <div
            class="waiting-symbol relative mx-auto grid size-24 place-items-center rounded-4xl border border-fuchsia-300/25 bg-fuchsia-400/10 text-4xl text-fuchsia-100 shadow-xl shadow-fuchsia-950/30 sm:size-28"
          >
            ✦
          </div>
          <p
            class="relative mt-8 text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300"
          >
            Conteo en proceso
          </p>
          <h2
            class="relative mx-auto mt-4 max-w-2xl text-4xl font-black text-white sm:text-6xl"
          >
            Estamos contando los votos
          </h2>
          <p
            class="relative mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg"
          >
            La votación terminó. Estamos revisando los resultados en tiempo real
            y eligiendo a los ganadores. Espera un momento.
          </p>

          <div
            class="relative mx-auto mt-9 flex max-w-md items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 shadow-xl shadow-fuchsia-950/20 backdrop-blur"
          >
            <span
              class="size-2 animate-bounce rounded-full bg-fuchsia-300"
            ></span>
            <span
              class="size-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:150ms]"
            ></span>
            <span
              class="size-2 animate-bounce rounded-full bg-violet-300 [animation-delay:300ms]"
            ></span>
            <span
              class="text-xs font-black uppercase tracking-widest text-slate-300"
              >Procesando resultados en vivo</span
            >
          </div>
        </div>
      </section>

      <section
        v-else-if="isClosed"
        class="mt-8 rounded-4xl border border-white/10 bg-white/5 p-8 text-center"
      >
        <p
          class="text-xs font-black uppercase tracking-[0.28em] text-slate-400"
        >
          Votación finalizada
        </p>
        <h2 class="mt-3 text-3xl font-black text-white">
          Ganadores pendientes
        </h2>
        <p class="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
          El equipo todavía no publicó los ganadores finales.
        </p>
      </section>

      <section
        v-else-if="activeRound?.type === 'versus'"
        class="mt-8 space-y-6"
      >
        <article
          v-for="match in versusMatches"
          :key="match.id"
          class="rounded-4xl border border-white/10 bg-white/5 p-4 sm:p-5"
        >
          <p
            class="mb-4 text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300"
          >
            {{ match.title }}
          </p>

          <div class="relative space-y-3">
            <div
              v-for="(contestant, index) in match.contestants"
              :key="contestant.id"
              class="relative overflow-hidden rounded-3xl border border-violet-300/10 bg-slate-950/55"
            >
              <div
                class="grid gap-0 md:grid-cols-[14rem_1fr_auto] md:items-center"
              >
                <div
                  class="relative min-h-52 overflow-hidden bg-linear-to-br from-violet-950 via-fuchsia-950 to-slate-950 md:min-h-56"
                >
                  <img
                    v-if="getArtistImage(contestant.artist)"
                    :src="getArtistImage(contestant.artist)"
                    :alt="contestant.artist?.name"
                    class="absolute inset-0 size-full object-cover"
                  />
                  <div
                    class="absolute inset-0 bg-linear-to-t from-[#080a18] via-[#080a18]/30 to-transparent"
                  ></div>
                  <span
                    class="absolute left-4 top-4 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur"
                  >
                    Opción {{ index === 0 ? "A" : "B" }}
                  </span>
                </div>

                <div class="p-4 sm:p-5">
                  <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                      <h3 class="truncate text-3xl font-black text-white">
                        {{ contestant.artist?.name || "Artista" }}
                      </h3>
                      <p
                        class="mt-1 text-sm font-black uppercase text-fuchsia-200"
                      >
                        {{ getArtistGroup(contestant.artist) || "Solista" }}
                      </p>
                    </div>
                    <p class="shrink-0 text-2xl font-black text-cyan-100">
                      {{ percentForMatch(contestant, match) }}
                    </p>
                  </div>

                  <div
                    class="mt-4 h-3 overflow-hidden rounded-full bg-white/10"
                  >
                    <div
                      class="h-full rounded-full bg-linear-to-r from-cyan-300 to-fuchsia-300"
                      :style="{ width: percentForMatch(contestant, match) }"
                    ></div>
                  </div>
                  <p class="mt-2 text-sm font-bold text-slate-300">
                    {{ contestant.totalVotes }} votos
                  </p>
                </div>

                <button
                  type="button"
                  class="m-4 flex min-h-12 items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 md:min-w-32"
                  :disabled="!isVotingOpen || isVoting === contestant.artistId"
                  @click="voteFor(contestant)"
                >
                  {{
                    isVoting === contestant.artistId ? "Votando..." : "Votar"
                  }}
                </button>
              </div>

              <div
                v-if="index === 0 && match.contestants.length === 2"
                class="absolute -bottom-7 left-1/2 z-20 grid size-14 -translate-x-1/2 place-items-center rounded-full border-4 border-white/15 bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-sm font-black text-white shadow-2xl shadow-fuchsia-500/40"
              >
                VS
              </div>
            </div>
          </div>
        </article>

        <p
          v-if="!versusMatches.length"
          class="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm font-bold text-slate-400"
        >
          Esta ronda versus todavía no tiene participantes.
        </p>
      </section>

      <section v-else class="mt-8 space-y-4">
        <template v-if="isLoadingSelectedRound">
          <article
            v-for="index in 4"
            :key="`selected-round-skeleton-${index}`"
            class="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5"
          >
            <div class="flex flex-col gap-4 md:flex-row md:items-center">
              <div class="h-8 w-10 animate-pulse rounded-xl bg-white/10"></div>
              <div
                class="size-28 shrink-0 animate-pulse rounded-3xl border-2 border-white/10 bg-white/10 sm:size-32"
              ></div>
              <div class="min-w-0 flex-1">
                <div
                  class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <span class="min-w-0 flex-1">
                    <span
                      class="block h-7 w-44 animate-pulse rounded-xl bg-white/15"
                    ></span>
                    <span
                      class="mt-2 block h-4 w-24 animate-pulse rounded-full bg-white/10"
                    ></span>
                  </span>
                  <span class="shrink-0 sm:text-right">
                    <span
                      class="block h-3 w-20 animate-pulse rounded-full bg-white/10"
                    ></span>
                    <span
                      class="mt-2 block h-10 w-28 animate-pulse rounded-2xl bg-white/15"
                    ></span>
                  </span>
                </div>
                <div
                  class="mt-4 h-3 animate-pulse rounded-full bg-white/10"
                ></div>
              </div>
            </div>
          </article>
        </template>

        <template v-else>
          <article
            v-for="(contestant, index) in displayedContestants"
            :key="contestant.id"
            class="rounded-3xl border p-4 transition sm:p-5"
            :class="[
              isContestantWinner(contestant)
                ? winnerToneClasses(contestant, 'card')
                : hasRoundWinners
                  ? 'border-white/10 bg-white/3 opacity-55 grayscale hover:opacity-75'
                  : 'border-white/10 bg-white/5 hover:bg-white/8',
            ]"
          >
            <div class="relative grid grid-cols-[auto_1fr] gap-3 md:flex md:flex-row md:items-center md:gap-4">
              <span
                class="absolute -left-1 -top-1 z-10 rounded-2xl bg-[#080a18]/80 px-2 py-1 text-xl font-black backdrop-blur sm:text-4xl md:static md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-0"
                :class="
                  isContestantWinner(contestant)
                    ? winnerToneClasses(contestant, 'rank')
                    : 'text-fuchsia-200'
                "
              >
                #{{ index + 1 }}
              </span>
              <span
                class="grid size-24 shrink-0 place-items-center overflow-hidden rounded-3xl border-2 border-fuchsia-300/35 bg-linear-to-br from-violet-500 to-fuchsia-500 text-3xl font-black text-white shadow-xl shadow-fuchsia-950/20 sm:size-32"
              >
                <img
                  v-if="getArtistImage(contestant.artist)"
                  :src="getArtistImage(contestant.artist)"
                  :alt="contestant.artist?.name"
                  class="size-full object-cover"
                />
                <span v-else>{{
                  contestant.artist?.name?.charAt(0) || "A"
                }}</span>
              </span>
              <div class="min-w-0 flex-1 pr-1">
                <div
                  class="flex items-start justify-between gap-3"
                >
                  <span class="min-w-0">
                    <span class="flex flex-wrap items-center gap-2 sm:gap-3">
                      <h3 class="truncate text-xl font-black leading-none text-white sm:text-3xl">
                        {{ contestant.artist?.name || "Artista" }}
                      </h3>
                      <span
                        v-if="hasRoundWinners"
                        class="inline-flex rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-widest sm:px-5 sm:py-2 sm:text-sm"
                        :class="
                          isContestantWinner(contestant)
                            ? winnerToneClasses(contestant, 'badge')
                            : 'border border-white/10 bg-white/5 text-slate-500'
                        "
                      >
                        {{
                          isContestantWinner(contestant)
                            ? `Ganador #${contestantWinnerRank(contestant)}`
                            : "No ganó"
                        }}
                      </span>
                    </span>
                    <p
                      class="mt-1 text-xs font-bold uppercase text-fuchsia-200 sm:text-sm"
                    >
                      {{ getArtistGroup(contestant.artist) || "Solista" }}
                    </p>
                  </span>
                  <span class="shrink-0 text-right">
                  <span
                    class="block text-[10px] font-black uppercase tracking-widest text-slate-300 sm:text-sm"
                  >
                      {{ contestant.totalVotes }} votos
                    </span>
                  <span
                    class="block text-2xl font-black leading-none text-fuchsia-100 sm:text-4xl"
                  >
                      {{ percentForDisplayed(contestant.totalVotes) }}
                    </span>
                  </span>
                </div>
                <div class="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    class="h-full rounded-full bg-linear-to-r from-cyan-300 to-fuchsia-300"
                    :style="{
                      width: percentForDisplayed(contestant.totalVotes),
                    }"
                  ></div>
                </div>
              </div>
              <button
                v-if="shouldShowVoteButtons"
                type="button"
                class="col-span-3 min-h-12 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 md:col-span-1"
                :disabled="!isVotingOpen || isVoting === contestant.artistId"
                @click="voteFor(contestant)"
              >
                {{ isVoting === contestant.artistId ? "Votando..." : "Votar" }}
              </button>
            </div>
          </article>
        </template>

        <p
          v-if="!isLoadingSelectedRound && !displayedContestants.length"
          class="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm font-bold text-slate-400"
        >
          Esta votacion todavia no tiene participantes.
        </p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.waiting-card {
  isolation: isolate;
}

.waiting-aurora {
  animation: waiting-aurora 8s ease-in-out infinite alternate;
}

.waiting-aurora-secondary {
  animation: waiting-aurora-secondary 10s ease-in-out infinite alternate;
}

.waiting-orbit {
  animation: waiting-orbit 12s linear infinite;
  box-shadow: 0 0 80px rgba(217, 70, 239, 0.18);
}

.waiting-symbol {
  animation: waiting-symbol 2.8s ease-in-out infinite;
}

.winner-light {
  animation: winner-light 7s ease-in-out infinite alternate;
}

.winner-light-secondary {
  animation: winner-light-secondary 9s ease-in-out infinite alternate;
}

.winner-crown {
  animation: winner-crown 2.6s ease-in-out infinite;
}

.winner-card {
  animation: winner-card 0.7s ease-out both;
}

.winner-stats {
  animation: winner-stats 0.8s ease-out 220ms both;
}

.winner-percent {
  animation: winner-percent 2.2s ease-in-out infinite;
}

.winner-percent-bar {
  animation: winner-percent-bar 1.1s ease-out 420ms both;
  transform-origin: left center;
}

.winner-podium-card {
  animation: winner-stats 0.75s ease-out 320ms both;
}

.winner-podium-card:nth-child(2) {
  animation-delay: 460ms;
}

.winner-card:nth-child(2) {
  animation-delay: 120ms;
}

.winner-card:nth-child(3) {
  animation-delay: 240ms;
}

@keyframes winner-light {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0.6;
  }

  100% {
    transform: translate3d(90px, 70px, 0) scale(1.2);
    opacity: 1;
  }
}

@keyframes winner-light-secondary {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0.5;
  }

  100% {
    transform: translate3d(-80px, -70px, 0) scale(1.18);
    opacity: 0.95;
  }
}

@keyframes winner-crown {
  0%,
  100% {
    transform: translateY(0) scale(1);
    box-shadow: 0 0 30px rgba(251, 191, 36, 0.2);
  }

  50% {
    transform: translateY(-5px) scale(1.06);
    box-shadow: 0 0 70px rgba(251, 191, 36, 0.38);
  }
}

@keyframes winner-card {
  from {
    transform: translateY(18px) scale(0.98);
    opacity: 0;
  }

  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

@keyframes winner-stats {
  from {
    transform: translateY(12px) scale(0.98);
    opacity: 0;
  }

  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

@keyframes winner-percent {
  0%,
  100% {
    transform: scale(1);
    text-shadow: 0 0 24px rgba(251, 191, 36, 0.22);
  }

  50% {
    transform: scale(1.04);
    text-shadow: 0 0 48px rgba(217, 70, 239, 0.36);
  }
}

@keyframes winner-percent-bar {
  from {
    transform: scaleX(0);
    filter: brightness(0.8);
  }

  to {
    transform: scaleX(1);
    filter: brightness(1.15);
  }
}

@keyframes waiting-aurora {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0.7;
  }

  100% {
    transform: translate3d(90px, 70px, 0) scale(1.18);
    opacity: 1;
  }
}

@keyframes waiting-aurora-secondary {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0.55;
  }

  100% {
    transform: translate3d(-110px, -80px, 0) scale(1.16);
    opacity: 0.95;
  }
}

@keyframes waiting-orbit {
  from {
    transform: translate(-50%, -50%) rotate(0deg) scale(0.95);
  }

  to {
    transform: translate(-50%, -50%) rotate(360deg) scale(1.08);
  }
}

@keyframes waiting-symbol {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 30px rgba(217, 70, 239, 0.22);
  }

  50% {
    transform: scale(1.08);
    box-shadow: 0 0 70px rgba(217, 70, 239, 0.45);
  }
}
</style>
