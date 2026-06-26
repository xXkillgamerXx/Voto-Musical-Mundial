<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../firebase";
import { translate } from "../i18n";
import ActivePolls from "../components/ActivePolls.vue";
import { getArtistsCached } from "../services/firebaseCache";
import {
  loadContestantMetadata,
  mergeContestantsWithPublicResults,
  subscribePublicResults,
} from "../services/pollResults";
import {
  createVoteQueue,
  shardCountForConcurrency,
} from "../services/voteQueue";

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
const finalResultContestants = ref([]);
const currentUser = ref(null);
const userPoints = ref(0);
const isLoading = ref(true);
const isLoadingSelectedRound = ref(false);
const isVoting = ref("");
const errorMessage = ref("");
const shareMessage = ref("");
const now = ref(Date.now());
const selectedRoundId = ref("");
const voteModalContestant = ref(null);
const voteAmount = ref(1);
const voteFeedbacks = ref({});
const optimisticVoteTotals = ref({});
const animatedVoteCounts = ref({});
const animatedDisplayedTotalVotes = ref(null);
const anonymousVoteStatus = ref(null);
const isLoadingAnonymousStatus = ref(false);

let unsubscribeAuth = null;
let unsubscribePoll = null;
let unsubscribeContestants = null;
let unsubscribeRounds = null;
let unsubscribeUserPoints = null;
let unsubscribePublicResults = null;
let unsubscribeVoteShards = null;
let clockTimer = null;
let voteQueue = null;
let listeningContestantsKey = "";
const voteFeedbackTimers = new Map();
const voteCountAnimationTimers = new Map();
let displayedTotalAnimationTimer = null;
const POINTS_PER_VOTE = 1;
const DEFAULT_ANONYMOUS_COOLDOWN_MINUTES = 60;
const getAnonymousVoteStatus = httpsCallable(
  functions,
  "getAnonymousVoteStatus",
);
const CAST_ANONYMOUS_VOTE_URL =
  "https://us-central1-votos-3420a.cloudfunctions.net/castAnonymousVoteHttp";

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

const getRoundCollectionRef = (pollId, roundId, collectionName) =>
  roundId
    ? collection(db, "polls", pollId, "rounds", roundId, collectionName)
    : collection(db, "polls", pollId, collectionName);

const getOptimisticVoteTotal = (artistId) =>
  Number(optimisticVoteTotals.value[artistId] || 0);

const getContestantArtistId = (contestant) =>
  contestant?.artistId || contestant?.id || "";

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
      const artistId = contestant.artistId || contestant.id;
      const serverTotalVotes = Number(
        contestant.totalVotes ??
          (contestant.votes || 0) + (contestant.manualVotes || 0),
      );
      const totalVotes = Math.max(
        serverTotalVotes,
        getOptimisticVoteTotal(artistId),
      );
      return {
        ...contestant,
        artist: getArtist(artistId),
        artistId,
        totalVotes,
      };
    })
    .sort((current, next) => next.totalVotes - current.totalVotes),
);

const activeContestants = computed(() =>
  contestants.value
    .map((contestant, index) => {
      const artistId = contestant.artistId || contestant.id;
      const serverTotalVotes = Number(
        contestant.totalVotes ??
          (contestant.votes || 0) + (contestant.manualVotes || 0),
      );
      const totalVotes = Math.max(
        serverTotalVotes,
        getOptimisticVoteTotal(artistId),
      );
      return {
        ...contestant,
        order: Number(contestant.order ?? index),
        matchGroup: Number(contestant.matchGroup || 0),
        matchOrder: Number(contestant.matchOrder ?? index),
        artist: getArtist(artistId),
        artistId,
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

const finalResultTotalVotes = computed(() =>
  finalResultContestants.value.reduce(
    (total, contestant) => total + contestant.totalVotes,
    0,
  ),
);

const finalResultSourceContestants = computed(() =>
  finalResultContestants.value.length
    ? finalResultContestants.value
    : rankedContestants.value,
);

const finalResultSourceTotalVotes = computed(() =>
  finalResultContestants.value.length
    ? finalResultTotalVotes.value
    : totalVotes.value,
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

const displayVoteCountFor = (contestant) => {
  const artistId = getContestantArtistId(contestant);
  const animatedCount = animatedVoteCounts.value[artistId];

  return Math.max(
    0,
    Math.round(Number(animatedCount ?? contestant?.totalVotes ?? 0)),
  );
};

const displayTotalVotes = computed(() =>
  Math.max(
    0,
    Math.round(
      Number(animatedDisplayedTotalVotes.value ?? displayedTotalVotes.value),
    ),
  ),
);

const shouldShowVoteButtons = computed(
  () => isVotingOpen.value && selectedRoundStep.value?.status !== "closed",
);
const anonymousVotingConfig = computed(() => ({
  enabled:
    activeRound.value?.anonymousVoting?.enabled ??
    poll.value?.anonymousVoting?.enabled ??
    true,
  blockByIp:
    activeRound.value?.anonymousVoting?.blockByIp ??
    poll.value?.anonymousVoting?.blockByIp ??
    true,
  cooldownMinutes: Math.max(
    1,
    Number(
      activeRound.value?.anonymousVoting?.cooldownMinutes ??
        poll.value?.anonymousVoting?.cooldownMinutes ??
        DEFAULT_ANONYMOUS_COOLDOWN_MINUTES,
    ),
  ),
}));
const anonymousNextVoteAtMs = computed(() => {
  const nextVoteAt = anonymousVoteStatus.value?.nextVoteAt;

  if (!nextVoteAt) {
    return 0;
  }

  const parsed = new Date(nextVoteAt).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
});
const anonymousRemainingMs = computed(() =>
  Math.max(0, anonymousNextVoteAtMs.value - now.value),
);
const canUseAnonymousVote = computed(
  () => anonymousVotingConfig.value.enabled && anonymousRemainingMs.value <= 0,
);
const isAnonymousVotingFlow = computed(() =>
  Boolean(
    voteModalContestant.value &&
    (!currentUser.value || currentUser.value.isAnonymous),
  ),
);
const hasEnoughPointsToVote = computed(() =>
  currentUser.value?.isAnonymous || !currentUser.value
    ? canUseAnonymousVote.value
    : Number(userPoints.value || 0) >= POINTS_PER_VOTE,
);
const formattedUserPoints = computed(() =>
  Number(userPoints.value || 0).toLocaleString("es"),
);
const maxVoteAmount = computed(() =>
  Math.max(0, Math.floor(Number(userPoints.value || 0) / POINTS_PER_VOTE)),
);
const normalizedVoteAmount = computed(() =>
  Math.min(
    maxVoteAmount.value,
    Math.max(1, Math.floor(Number(voteAmount.value || 1))),
  ),
);
const selectedVoteArtist = computed(
  () => voteModalContestant.value?.artist || null,
);
const anonymousCooldownLabel = computed(() => {
  const totalSeconds = Math.ceil(anonymousRemainingMs.value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
});
const anonymousVoteMessage = computed(() => {
  if (!anonymousVotingConfig.value.enabled) {
    return translate("polls.detail.anonymousDisabled");
  }

  if (anonymousRemainingMs.value > 0) {
    return translate("polls.detail.anonymousWait", {
      time: anonymousCooldownLabel.value,
    });
  }

  return translate("polls.detail.anonymousReady", {
    minutes: anonymousVotingConfig.value.cooldownMinutes,
  });
});

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

  if (!winnerIds.length && finalResultSourceContestants.value.length) {
    return finalResultSourceContestants.value
      .slice(0, 1)
      .map((contestant) => contestant.artist)
      .filter(Boolean);
  }

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

  if (!winnerIds.length && finalResultSourceContestants.value.length) {
    const contestant = finalResultSourceContestants.value[0];
    const votes = Number(contestant?.totalVotes || 0);
    const percent = finalResultSourceTotalVotes.value
      ? (votes / finalResultSourceTotalVotes.value) * 100
      : 0;

    return [
      {
        id: contestant.artistId || contestant.id,
        artist: contestant.artist,
        votes,
        percent,
        percentLabel: `${percent.toFixed(2)}%`,
        percentWidth: `${Math.min(percent, 100)}%`,
      },
    ].filter((entry) => entry.artist);
  }

  return winnerIds
    .slice(0, 1)
    .map((artistId) => {
      const artist = getArtist(artistId);
      const contestant = finalResultSourceContestants.value.find(
        (item) => item.artistId === artistId,
      );
      const votes = Number(contestant?.totalVotes || 0);
      const percent = finalResultSourceTotalVotes.value
        ? (votes / finalResultSourceTotalVotes.value) * 100
        : 0;

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
  finalResultSourceContestants.value
    .map((contestant, index) => {
      const votes = Number(contestant.totalVotes || 0);
      const percent = finalResultSourceTotalVotes.value
        ? (votes / finalResultSourceTotalVotes.value) * 100
        : 0;

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
const secondaryFinalRankingEntries = computed(() =>
  finalRankingEntries.value.slice(1),
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
    shareMessage.value = translate("polls.detail.shareFinalCopied");
    window.setTimeout(() => {
      shareMessage.value = "";
    }, 3000);
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }

    errorMessage.value = translate("polls.detail.shareFinalError");
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
  if (!displayTotalVotes.value) {
    return "0.00%";
  }

  return `${((votes / displayTotalVotes.value) * 100).toFixed(2)}%`;
};

const percentForDisplayedContestant = (contestant) =>
  percentForDisplayed(displayVoteCountFor(contestant));

const percentForMatch = (contestant, match) => {
  const totalMatchVotes = match.contestants.reduce(
    (total, item) => total + displayVoteCountFor(item),
    0,
  );

  if (!totalMatchVotes) {
    return "0.00%";
  }

  return `${((displayVoteCountFor(contestant) / totalMatchVotes) * 100).toFixed(2)}%`;
};

const mergeContestantsWithShardVotes = (baseContestants, shardVotesByArtist) =>
  baseContestants.map((contestant) => {
    const artistId = contestant.artistId || contestant.id;
    const legacyVotes = Number(contestant.votes || 0);
    const manualVotes = Number(contestant.manualVotes || 0);
    const shardVotes = Number(shardVotesByArtist.get(artistId) || 0);

    return {
      ...contestant,
      votes: legacyVotes + shardVotes,
      totalVotes: legacyVotes + manualVotes + shardVotes,
    };
  });

const setOptimisticVoteTotal = (artistId, totalVotes) => {
  if (!artistId) {
    return;
  }

  optimisticVoteTotals.value = {
    ...optimisticVoteTotals.value,
    [artistId]: Math.max(0, Number(totalVotes || 0)),
  };
};

const clearOptimisticVoteTotal = (artistId) => {
  if (!artistId) {
    return;
  }

  const nextTotals = { ...optimisticVoteTotals.value };
  delete nextTotals[artistId];
  optimisticVoteTotals.value = nextTotals;
};

const showVoteFeedback = (artistId, amount) => {
  if (!artistId || amount <= 0) {
    return;
  }

  window.clearTimeout(voteFeedbackTimers.get(artistId));
  voteFeedbacks.value = {
    ...voteFeedbacks.value,
    [artistId]: {
      amount,
      token: Date.now(),
    },
  };
  voteFeedbackTimers.set(
    artistId,
    window.setTimeout(() => {
      const nextFeedbacks = { ...voteFeedbacks.value };
      delete nextFeedbacks[artistId];
      voteFeedbacks.value = nextFeedbacks;
      voteFeedbackTimers.delete(artistId);
    }, 2800),
  );
};

const animateNumber = ({
  from,
  to,
  duration = 720,
  onUpdate,
  onDone = () => {},
  setTimer,
  clearTimer,
}) => {
  clearTimer();

  const distance = to - from;
  const steps = Math.max(1, Math.min(Math.abs(distance), 28));
  let currentStep = 0;
  const intervalMs = Math.max(24, Math.floor(duration / steps));

  if (!distance) {
    onUpdate(to);
    onDone();
    return;
  }

  const timer = window.setInterval(() => {
    currentStep += 1;
    const progress = Math.min(1, currentStep / steps);
    const value = Math.round(from + distance * progress);

    onUpdate(value);

    if (progress >= 1) {
      clearTimer();
      onDone();
    }
  }, intervalMs);

  setTimer(timer);
};

const animateVoteCount = (artistId, from, to) => {
  animateNumber({
    from,
    to,
    onUpdate: (value) => {
      animatedVoteCounts.value = {
        ...animatedVoteCounts.value,
        [artistId]: value,
      };
    },
    onDone: () => {
      window.setTimeout(() => {
        const nextCounts = { ...animatedVoteCounts.value };
        delete nextCounts[artistId];
        animatedVoteCounts.value = nextCounts;
      }, 900);
    },
    setTimer: (timer) => voteCountAnimationTimers.set(artistId, timer),
    clearTimer: () => {
      window.clearInterval(voteCountAnimationTimers.get(artistId));
      voteCountAnimationTimers.delete(artistId);
    },
  });
};

const clearAnimatedVoteCount = (artistId) => {
  window.clearInterval(voteCountAnimationTimers.get(artistId));
  voteCountAnimationTimers.delete(artistId);

  const nextCounts = { ...animatedVoteCounts.value };
  delete nextCounts[artistId];
  animatedVoteCounts.value = nextCounts;
};

const clearAnimatedDisplayedTotalVotes = () => {
  window.clearInterval(displayedTotalAnimationTimer);
  displayedTotalAnimationTimer = null;
  animatedDisplayedTotalVotes.value = null;
};

const animateDisplayedTotalVotes = (from, to) => {
  animateNumber({
    from,
    to,
    onUpdate: (value) => {
      animatedDisplayedTotalVotes.value = value;
    },
    onDone: () => {
      window.setTimeout(() => {
        animatedDisplayedTotalVotes.value = null;
      }, 900);
    },
    setTimer: (timer) => {
      displayedTotalAnimationTimer = timer;
    },
    clearTimer: () => {
      window.clearInterval(displayedTotalAnimationTimer);
      displayedTotalAnimationTimer = null;
    },
  });
};

const getRoundContestants = async (round) => {
  const selectedPollId = poll.value?.id || currentPollId.value;

  if (!selectedPollId || !round?.id) {
    return [];
  }

  const contestantsSnap = await getDocs(
    collection(db, "polls", selectedPollId, "rounds", round.id, "contestants"),
  );

  return contestantsSnap.docs
    .map((contestantDoc) => {
      const contestant = contestantDoc.data();
      const totalVotes = Number(
        contestant.totalVotes ??
          (contestant.votes || 0) + (contestant.manualVotes || 0),
      );

      return {
        id: contestantDoc.id,
        ...contestant,
        artistId: contestant.artistId || contestantDoc.id,
        artist: getArtist(contestant.artistId || contestantDoc.id),
        totalVotes,
      };
    })
    .filter((contestant) => contestant.artist)
    .sort((current, next) => next.totalVotes - current.totalVotes);
};

const listenContestants = async (pollId) => {
  const roundId = activeRound.value?.id || null;
  const contestantsKey = `${pollId}:${roundId || "root"}`;

  if (listeningContestantsKey === contestantsKey && contestants.value.length) {
    return;
  }

  unsubscribeContestants?.();
  unsubscribePublicResults?.();
  unsubscribeVoteShards?.();
  listeningContestantsKey = contestantsKey;

  try {
    const baseContestants = await loadContestantMetadata(db, pollId, roundId);
    let latestPublicResults = null;
    let latestShardVotesByArtist = null;

    const applyLatestResults = () => {
      if (latestShardVotesByArtist) {
        contestants.value = mergeContestantsWithShardVotes(
          baseContestants,
          latestShardVotesByArtist,
        );
        return;
      }

      contestants.value = latestPublicResults
        ? mergeContestantsWithPublicResults(
            baseContestants,
            latestPublicResults,
          )
        : baseContestants;
    };

    contestants.value = baseContestants;
    unsubscribePublicResults = subscribePublicResults(db, {
      pollId,
      roundId,
      onData: (publicResults) => {
        if (!publicResults) {
          return;
        }

        latestPublicResults = publicResults;
        applyLatestResults();
      },
      onError: () => {
        errorMessage.value = translate("polls.detail.liveResultsError");
      },
    });
    unsubscribeVoteShards = onSnapshot(
      getRoundCollectionRef(pollId, roundId, "voteShards"),
      (shardsSnap) => {
        const shardVotesByArtist = new Map();

        shardsSnap.docs.forEach((shardDoc) => {
          const shard = shardDoc.data();
          const artistId = shard.artistId;

          if (!artistId) {
            return;
          }

          shardVotesByArtist.set(
            artistId,
            (shardVotesByArtist.get(artistId) || 0) + Number(shard.votes || 0),
          );
        });

        latestShardVotesByArtist = shardVotesByArtist;
        applyLatestResults();
      },
      () => {
        errorMessage.value = translate("polls.detail.liveResultsError");
      },
    );
  } catch {
    errorMessage.value = translate("polls.detail.contestantsError");
  }
};

const loadSelectedRoundContestants = async (round) => {
  selectedRoundContestants.value = [];
  const selectedPollId = poll.value?.id || currentPollId.value;

  if (!selectedPollId || round.status !== "closed") {
    return;
  }

  isLoadingSelectedRound.value = true;

  try {
    selectedRoundContestants.value = (await getRoundContestants(round)).sort(
      (current, next) => {
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
      },
    );
  } catch {
    errorMessage.value = translate("polls.detail.roundContestantsError");
  } finally {
    isLoadingSelectedRound.value = false;
  }
};

const loadFinalResultContestants = async () => {
  finalResultContestants.value = [];

  if (!currentPollId.value || !rounds.value.length) {
    return;
  }

  const closedRounds = rounds.value
    .filter((round) => round.status === "closed")
    .slice();
  const totalsByArtist = new Map();

  for (const round of closedRounds) {
    try {
      const roundContestants = await getRoundContestants(round);

      roundContestants.forEach((contestant) => {
        const artistId = contestant.artistId || contestant.id;
        const currentTotal = totalsByArtist.get(artistId);
        const totalVotes =
          (currentTotal?.totalVotes || 0) + contestant.totalVotes;

        totalsByArtist.set(artistId, {
          ...contestant,
          artistId,
          totalVotes,
        });
      });
    } catch {
      // Skip rounds that cannot be read and continue aggregating the rest.
    }
  }

  finalResultContestants.value = [...totalsByArtist.values()]
    .filter((contestant) => contestant.artist)
    .sort((current, next) => next.totalVotes - current.totalVotes);
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
      if (poll.value?.status === "closed") {
        loadFinalResultContestants();
      }
    },
    () => {
      errorMessage.value = translate("polls.detail.roundsError");
    },
  );
};

const loadArtists = async () => {
  artists.value = await getArtistsCached(db);
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
      errorMessage.value = translate("polls.detail.notFound");
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
    errorMessage.value = translate("polls.detail.loadError");
  } finally {
    isLoading.value = false;
  }
};

const listenUserPoints = (user) => {
  unsubscribeUserPoints?.();
  userPoints.value = 0;

  if (!user) {
    return;
  }

  unsubscribeUserPoints = onSnapshot(doc(db, "users", user.uid), (userSnap) => {
    userPoints.value = Number(userSnap.data()?.points || 0);
  });
};

const refreshAnonymousVoteStatus = async () => {
  if (
    !currentUser.value?.isAnonymous ||
    !poll.value?.id ||
    !anonymousVotingConfig.value.enabled
  ) {
    anonymousVoteStatus.value = null;
    return;
  }

  isLoadingAnonymousStatus.value = true;

  try {
    const result = await getAnonymousVoteStatus({
      pollId: poll.value.id,
      roundId: activeRound.value?.id || null,
    });
    anonymousVoteStatus.value = result.data || null;
  } catch {
    anonymousVoteStatus.value = null;
  } finally {
    isLoadingAnonymousStatus.value = false;
  }
};

const ensureAnonymousUser = async () => {
  if (currentUser.value) {
    return currentUser.value;
  }

  const credential = await signInAnonymously(auth);
  currentUser.value = credential.user;
  return credential.user;
};

const callAnonymousVoteEndpoint = async (payload) => {
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("anonymous-token-missing");
  }

  const response = await fetch(CAST_ANONYMOUS_VOTE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error?.message || "anonymous-vote-failed");
    error.code = data?.error?.code
      ? `functions/${data.error.code}`
      : "functions/internal";
    error.details = data?.error?.details || null;
    throw error;
  }

  return data;
};

const voteButtonLabel = (contestant) => {
  if (isVoting.value === getContestantArtistId(contestant)) {
    return translate("polls.detail.voting");
  }

  if (currentUser.value?.isAnonymous || !currentUser.value) {
    return anonymousRemainingMs.value > 0
      ? translate("polls.detail.voteCountdown", {
          time: anonymousCooldownLabel.value,
        })
      : translate("polls.detail.freeVote");
  }

  return hasEnoughPointsToVote.value
    ? translate("polls.detail.vote")
    : translate("polls.detail.noPoints");
};

const closeVoteModal = () => {
  voteModalContestant.value = null;
  voteAmount.value = 1;
};

const openVoteModal = (contestant) => {
  errorMessage.value = "";

  if (!currentUser.value && !anonymousVotingConfig.value.enabled) {
    errorMessage.value = translate("polls.detail.loginToVote");
    return;
  }

  if (!poll.value?.id || !isVotingOpen.value) {
    errorMessage.value = translate("polls.detail.closedVoting");
    return;
  }

  if (!currentUser.value || currentUser.value.isAnonymous) {
    if (!canUseAnonymousVote.value) {
      errorMessage.value = anonymousVoteMessage.value;
      return;
    }

    voteModalContestant.value = contestant;
    voteAmount.value = 1;
    return;
  }

  if (!hasEnoughPointsToVote.value) {
    errorMessage.value = translate("polls.detail.notEnoughPoints");
    return;
  }

  voteModalContestant.value = contestant;
  voteAmount.value = Math.min(1, maxVoteAmount.value);
};

const setVoteAmount = (amount) => {
  voteAmount.value = Math.min(
    maxVoteAmount.value,
    Math.max(1, Math.floor(Number(amount || 1))),
  );
};

const adjustVoteAmount = (amount) => {
  setVoteAmount(Number(voteAmount.value || 1) + amount);
};

const voteAnonymouslyFor = async (contestant) => {
  if (!anonymousVotingConfig.value.enabled) {
    errorMessage.value = translate("polls.detail.anonymousDisabled");
    return;
  }

  if (anonymousRemainingMs.value > 0) {
    errorMessage.value = anonymousVoteMessage.value;
    return;
  }

  const artistId = getContestantArtistId(contestant);
  const currentContestant = displayedContestants.value.find(
    (item) => getContestantArtistId(item) === artistId,
  );
  const currentVotes = displayVoteCountFor(currentContestant || contestant);
  const currentTotalVotes = displayTotalVotes.value;

  try {
    await ensureAnonymousUser();
    isVoting.value = artistId;

    const result = await callAnonymousVoteEndpoint({
      pollId: poll.value.id,
      roundId: activeRound.value?.id || null,
      artistId,
      shardCount: shardCountForConcurrency(100000),
    });

    anonymousVoteStatus.value = result || null;
    setOptimisticVoteTotal(artistId, currentVotes + 1);
    animateVoteCount(artistId, currentVotes, currentVotes + 1);
    animateDisplayedTotalVotes(currentTotalVotes, currentTotalVotes + 1);
    showVoteFeedback(artistId, 1);
    shareMessage.value = translate("polls.detail.anonymousVoteSuccessLogin");
    closeVoteModal();
  } catch (error) {
    if (
      error.code === "functions/resource-exhausted" ||
      error.code === "resource-exhausted"
    ) {
      anonymousVoteStatus.value = {
        ...(anonymousVoteStatus.value || {}),
        nextVoteAt: error.details?.nextVoteAt || null,
        remainingMs: error.details?.remainingMs || 0,
      };
      errorMessage.value = translate("polls.detail.anonymousWait", {
        time: anonymousCooldownLabel.value,
      });
      return;
    }

    errorMessage.value = translate("polls.detail.anonymousVoteError");
  } finally {
    isVoting.value = "";
  }
};

const voteFor = async (contestant, amount = 1) => {
  errorMessage.value = "";

  if (!currentUser.value || currentUser.value.isAnonymous) {
    await voteAnonymouslyFor(contestant);
    return;
  }

  if (!poll.value?.id || !isVotingOpen.value) {
    errorMessage.value = translate("polls.detail.closedVoting");
    return;
  }

  const votesToAdd = Math.floor(Number(amount || 1));
  const pointsToSpend = votesToAdd * POINTS_PER_VOTE;

  if (!Number.isInteger(votesToAdd) || votesToAdd < 1) {
    errorMessage.value = translate("polls.detail.voteAmountRequired");
    return;
  }

  if (Number(userPoints.value || 0) < pointsToSpend) {
    errorMessage.value = translate("polls.detail.notEnoughPoints");
    return;
  }

  try {
    const artistId = contestant.artistId;
    const currentContestant = displayedContestants.value.find(
      (item) => getContestantArtistId(item) === artistId,
    );
    const currentVotes = displayVoteCountFor(currentContestant || contestant);
    const currentTotalVotes = displayTotalVotes.value;

    isVoting.value = contestant.artistId;
    voteQueue.enqueue({
      pollId: poll.value.id,
      roundId: activeRound.value?.id || null,
      artistId,
      userId: currentUser.value.uid,
      userDisplayName:
        currentUser.value.displayName || currentUser.value.email || "",
      userPhotoURL: currentUser.value.photoURL || "",
      amount: votesToAdd,
      pointsPerVote: POINTS_PER_VOTE,
      shardCount: shardCountForConcurrency(100000),
    });
    setOptimisticVoteTotal(artistId, currentVotes + votesToAdd);
    animateVoteCount(artistId, currentVotes, currentVotes + votesToAdd);
    animateDisplayedTotalVotes(
      currentTotalVotes,
      currentTotalVotes + votesToAdd,
    );
    showVoteFeedback(artistId, votesToAdd);
    userPoints.value = Math.max(
      0,
      Number(userPoints.value || 0) - pointsToSpend,
    );
    closeVoteModal();
  } catch (error) {
    errorMessage.value =
      error.message === "not-enough-points"
        ? "No tienes puntos suficientes para votar."
        : "No se pudo registrar tu voto.";
  } finally {
    isVoting.value = "";
  }
};

const confirmVoteAmount = () => {
  if (!voteModalContestant.value) {
    return;
  }

  if (isAnonymousVotingFlow.value) {
    voteFor(voteModalContestant.value, 1);
    return;
  }

  setVoteAmount(voteAmount.value);
  voteFor(voteModalContestant.value, normalizedVoteAmount.value);
};

watch(
  () => [currentUser.value?.uid, poll.value?.id, activeRound.value?.id],
  () => {
    refreshAnonymousVoteStatus();
  },
);

onMounted(() => {
  voteQueue = createVoteQueue({
    db,
    onBatchCommitted: (batch) => {
      window.setTimeout(() => {
        clearOptimisticVoteTotal(batch.artistId);
      }, 1200);
    },
    onError: (error, batches = []) => {
      batches.forEach((batch) => {
        clearOptimisticVoteTotal(batch.artistId);
        clearAnimatedVoteCount(batch.artistId);
        userPoints.value =
          Number(userPoints.value || 0) + batch.amount * batch.pointsPerVote;
      });
      clearAnimatedDisplayedTotalVotes();
      errorMessage.value =
        error.message === "not-enough-points"
          ? translate("polls.detail.notEnoughPoints")
          : translate("polls.detail.batchVoteError");
    },
  });
  unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    currentUser.value = user;
    listenUserPoints(user);
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
  unsubscribePublicResults?.();
  unsubscribeVoteShards?.();
  unsubscribeRounds?.();
  unsubscribeUserPoints?.();
  voteFeedbackTimers.forEach((timer) => window.clearTimeout(timer));
  voteFeedbackTimers.clear();
  voteCountAnimationTimers.forEach((timer) => window.clearInterval(timer));
  voteCountAnimationTimers.clear();
  clearAnimatedDisplayedTotalVotes();
  voteQueue?.flush().catch(() => {});
  voteQueue?.dispose();
  window.clearInterval(clockTimer);
});
</script>

<template>
  <section class="mx-auto max-w-352 px-4 pb-16 sm:px-6">
    <div
      v-if="isLoading"
      class="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm font-bold text-slate-300"
    >
      {{ $t("polls.detail.loading") }}
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
              {{ $t("polls.detail.liveEyebrow") }}
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
                <span v-if="round.isActive">{{
                  $t("polls.detail.inProgress")
                }}</span>
                <span v-else-if="round.status === 'closed'">{{
                  $t("polls.detail.finished")
                }}</span>
                <span v-else>{{ $t("polls.detail.preparing") }}</span>
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
              <p class="mt-1 text-sm font-black text-white">
                {{ $t("polls.detail.comingSoon") }}
              </p>
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
                      {{ $t("polls.detail.wonWith") }}
                    </span>
                    <span
                      class="mt-2 block text-4xl font-black leading-none text-white sm:text-5xl"
                    >
                      {{ winnerEntry.votes.toLocaleString("es") }}
                    </span>
                    <span
                      class="mt-1 block text-xs font-bold uppercase tracking-widest text-slate-300"
                    >
                      {{ $t("polls.detail.votesLabel") }}
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
                <span>{{ $t("polls.detail.viewHallOfFame") }}</span>
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
                <span>{{ $t("polls.detail.shareWinner") }}</span>
              </button>
            </span>
          </div>
        </div>
      </section>

      <section
        v-if="
          isClosed &&
          finalWinnerEntries.length &&
          secondaryFinalRankingEntries.length
        "
        class="relative mt-6 rounded-4xl border border-white/10 bg-white/4 p-4 shadow-xl shadow-fuchsia-950/15 sm:p-6"
      >
        <p
          class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-200"
        >
          Lugares finales
        </p>
        <div class="mt-4 space-y-3">
          <article
            v-for="entry in secondaryFinalRankingEntries"
            :key="entry.id"
            class="winner-podium-card rounded-3xl border border-white/10 bg-slate-950/55 p-3 sm:p-4"
          >
            <div class="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
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
                  class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-xl font-black text-white"
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

              <div class="sm:min-w-64 sm:text-right">
                <p
                  class="text-xs font-black uppercase tracking-widest text-slate-400"
                >
                  {{
                    $t("polls.detail.votesCount", {
                      count: entry.votes.toLocaleString("es"),
                    })
                  }}
                </p>
                <p class="mt-1 text-2xl font-black text-fuchsia-100">
                  {{ entry.percentLabel }}
                </p>
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
            {{ $t("polls.detail.countingVotesTitle") }}
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
              >{{ $t("polls.detail.processingLiveResults") }}</span
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
              :class="
                voteFeedbacks[contestant.artistId || contestant.id] &&
                'vote-feedback-card'
              "
            >
              <span
                v-if="voteFeedbacks[contestant.artistId || contestant.id]"
                :key="`notice-${voteFeedbacks[contestant.artistId || contestant.id].token}`"
                class="vote-feedback-notice"
              >
                {{ $t("polls.detail.voteCounted") }}
              </span>
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
                    {{ $t("polls.detail.optionLabel", { option: index === 0 ? "A" : "B" }) }}
                  </span>
                </div>

                <div class="p-4 sm:p-5">
                  <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                      <h3 class="truncate text-3xl font-black text-white">
                        {{ contestant.artist?.name || $t("polls.detail.voteFallback") }}
                      </h3>
                      <p
                        class="mt-1 text-sm font-black uppercase text-fuchsia-200"
                      >
                        {{ getArtistGroup(contestant.artist) || $t("polls.detail.soloist") }}
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
                  <p
                    class="relative mt-2 text-sm font-bold text-slate-300"
                    :class="
                      voteFeedbacks[contestant.artistId || contestant.id] &&
                      'text-emerald-200'
                    "
                  >
                    {{
                      $t("polls.detail.votesCount", {
                        count: displayVoteCountFor(contestant).toLocaleString("es"),
                      })
                    }}
                    <span
                      v-if="voteFeedbacks[contestant.artistId || contestant.id]"
                      :key="
                        voteFeedbacks[contestant.artistId || contestant.id]
                          .token
                      "
                      class="vote-feedback-badge"
                    >
                      {{
                        $t("polls.detail.votesAdded", {
                          count:
                            voteFeedbacks[contestant.artistId || contestant.id]
                              .amount,
                        })
                      }}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  class="m-4 flex min-h-12 items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 md:min-w-32"
                  :disabled="
                    !isVotingOpen ||
                    !hasEnoughPointsToVote ||
                    isVoting === getContestantArtistId(contestant)
                  "
                  @click="voteFor(contestant)"
                >
                  {{ voteButtonLabel(contestant) }}
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
        <div
          v-if="
            shouldShowVoteButtons && currentUser && !currentUser.isAnonymous
          "
          class="flex flex-col gap-2 rounded-3xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            Tus puntos:
            <strong class="text-lg text-amber-200"
              >{{ formattedUserPoints }} pts</strong
            >
          </span>
          <span class="text-xs uppercase tracking-widest text-amber-200/75">
            Cada voto cuesta {{ POINTS_PER_VOTE }} punto
          </span>
        </div>

        <div
          v-if="
            shouldShowVoteButtons && (!currentUser || currentUser.isAnonymous)
          "
          class="flex flex-col gap-2 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-100 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            {{ anonymousVoteMessage }}
          </span>
          <span class="text-xs uppercase tracking-widest text-cyan-200/75">
            {{
              isLoadingAnonymousStatus
                ? $t("polls.detail.checkingAnonymousVote")
                : $t("polls.detail.anonymousIpNotice")
            }}
          </span>
        </div>

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
            class="relative rounded-3xl border p-4 transition sm:p-5"
            :class="[
              isContestantWinner(contestant)
                ? winnerToneClasses(contestant, 'card')
                : hasRoundWinners
                  ? 'border-white/10 bg-white/3 opacity-55 grayscale hover:opacity-75'
                  : 'border-white/10 bg-white/5 hover:bg-white/8',
              voteFeedbacks[contestant.artistId || contestant.id] &&
                'vote-feedback-card',
            ]"
          >
            <span
              v-if="voteFeedbacks[contestant.artistId || contestant.id]"
              :key="`notice-${voteFeedbacks[contestant.artistId || contestant.id].token}`"
              class="vote-feedback-notice"
            >
              {{ $t("polls.detail.voteCounted") }}
            </span>
            <div
              class="relative grid grid-cols-[auto_1fr] gap-3 md:flex md:flex-row md:items-center md:gap-4"
            >
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
                <div class="flex items-start justify-between gap-3">
                  <span class="min-w-0">
                    <span class="flex flex-wrap items-center gap-2 sm:gap-3">
                      <h3
                        class="truncate text-xl font-black leading-none text-white sm:text-3xl"
                      >
                        {{ contestant.artist?.name || $t("polls.detail.voteFallback") }}
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
                            ? $t("polls.detail.winnerBadge", {
                                rank: contestantWinnerRank(contestant),
                              })
                            : $t("polls.detail.didNotWin")
                        }}
                      </span>
                    </span>
                    <p
                      class="mt-1 text-xs font-bold uppercase text-fuchsia-200 sm:text-sm"
                    >
                      {{ getArtistGroup(contestant.artist) || $t("polls.detail.soloist") }}
                    </p>
                  </span>
                  <span class="shrink-0 text-right">
                    <span
                      class="relative block text-[10px] font-black uppercase tracking-widest text-slate-300 sm:text-sm"
                      :class="
                        voteFeedbacks[contestant.artistId || contestant.id] &&
                        'text-emerald-200'
                      "
                    >
                      {{
                        $t("polls.detail.votesCount", {
                          count: displayVoteCountFor(contestant).toLocaleString("es"),
                        })
                      }}
                      <span
                        v-if="
                          voteFeedbacks[contestant.artistId || contestant.id]
                        "
                        :key="
                          voteFeedbacks[contestant.artistId || contestant.id]
                            .token
                        "
                        class="vote-feedback-badge right-0"
                      >
                        {{
                          $t("polls.detail.votesAdded", {
                            count:
                              voteFeedbacks[contestant.artistId || contestant.id]
                                .amount,
                          })
                        }}
                      </span>
                    </span>
                    <span
                      class="block text-2xl font-black leading-none text-fuchsia-100 sm:text-4xl"
                    >
                      {{ percentForDisplayedContestant(contestant) }}
                    </span>
                  </span>
                </div>
                <div class="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    class="h-full rounded-full bg-linear-to-r from-cyan-300 to-fuchsia-300"
                    :style="{
                      width: percentForDisplayedContestant(contestant),
                    }"
                  ></div>
                </div>
              </div>
              <button
                v-if="shouldShowVoteButtons"
                type="button"
                class="col-span-3 min-h-12 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-6 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 md:col-span-1"
                :disabled="
                  !isVotingOpen ||
                  !hasEnoughPointsToVote ||
                  isVoting === getContestantArtistId(contestant)
                "
                @click="openVoteModal(contestant)"
              >
                {{ voteButtonLabel(contestant) }}
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

    <div class="mt-12 border-t border-white/10 pt-4">
      <ActivePolls :exclude-poll-id="currentPollId" />
    </div>

    <Teleport to="body">
      <div
        v-if="voteModalContestant"
        class="fixed inset-0 z-90 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
      >
        <div
          class="w-full max-w-lg overflow-hidden rounded-4xl border border-fuchsia-300/30 bg-[#090b19] text-white shadow-2xl shadow-fuchsia-950/50"
          @click.stop
        >
          <div class="relative p-5 sm:p-6">
            <div
              class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(236,72,153,0.22),transparent_32%),radial-gradient(circle_at_95%_100%,rgba(34,211,238,0.18),transparent_34%)]"
            ></div>
            <button
              type="button"
              class="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-xl font-black text-slate-300 transition hover:bg-white/10 hover:text-white"
              :aria-label="$t('polls.detail.close')"
              @click="closeVoteModal"
            >
              ×
            </button>

            <div class="relative z-10">
              <div
                class="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-4"
              >
                <span
                  class="grid size-24 shrink-0 place-items-center overflow-hidden rounded-3xl border-2 border-fuchsia-300/40 bg-linear-to-br from-violet-500 to-fuchsia-500 text-3xl font-black"
                >
                  <img
                    v-if="getArtistImage(selectedVoteArtist)"
                    :src="getArtistImage(selectedVoteArtist)"
                    :alt="selectedVoteArtist?.name"
                    class="size-full object-cover"
                  />
                  <span v-else>{{
                    selectedVoteArtist?.name?.charAt(0) || "A"
                  }}</span>
                </span>
                <div class="min-w-0">
                  <p
                    class="text-[10px] font-black uppercase tracking-[0.24em] text-fuchsia-300"
                  >
                    {{
                      isAnonymousVotingFlow
                        ? $t("polls.detail.anonymousConfirmTitle")
                        : $t("polls.detail.confirmVotes")
                    }}
                  </p>
                  <h2 class="mt-2 truncate text-2xl font-black">
                    {{ selectedVoteArtist?.name || $t("polls.detail.voteFallback") }}
                  </h2>
                  <p class="mt-1 text-sm font-bold text-amber-200">
                    {{
                      isAnonymousVotingFlow
                        ? $t("polls.detail.anonymousOneFreeVote")
                        : $t("polls.detail.availablePoints", {
                            points: formattedUserPoints,
                          })
                    }}
                  </p>
                </div>
              </div>

              <form class="mt-5 space-y-4" @submit.prevent="confirmVoteAmount">
                <div
                  v-if="isAnonymousVotingFlow"
                  class="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4"
                >
                  <p
                    class="text-xs font-black uppercase tracking-widest text-cyan-200"
                  >
                    {{ $t("polls.detail.freeVote") }}
                  </p>
                  <p class="mt-2 text-sm leading-6 text-slate-200">
                    {{ $t("polls.detail.anonymousConfirmDescription") }}
                  </p>
                  <p
                    class="mt-3 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm font-bold text-cyan-100"
                  >
                    {{ anonymousVoteMessage }}
                  </p>
                </div>

                <label
                  v-else
                  class="block rounded-3xl border border-white/10 bg-white/5 p-4"
                >
                  <span
                    class="text-xs font-black uppercase tracking-widest text-slate-400"
                  >
                    {{ $t("polls.detail.voteQuestion") }}
                  </span>
                  <div class="mt-3 grid grid-cols-[auto_1fr_auto] gap-2">
                    <button
                      type="button"
                      class="grid min-h-14 min-w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-3xl font-black text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                      :disabled="normalizedVoteAmount <= 1"
                      :aria-label="$t('polls.detail.decrementVote')"
                      @click="adjustVoteAmount(-1)"
                    >
                      −
                    </button>
                    <input
                      v-model.number="voteAmount"
                      type="number"
                      min="1"
                      :max="maxVoteAmount"
                      step="1"
                      class="min-h-14 w-full rounded-2xl border border-fuchsia-300/25 bg-slate-950 px-4 text-center text-3xl font-black text-white outline-none transition focus:border-fuchsia-300/70"
                      @input="setVoteAmount(voteAmount)"
                    />
                    <button
                      type="button"
                      class="grid min-h-14 min-w-14 place-items-center rounded-2xl border border-fuchsia-300/25 bg-fuchsia-400/10 text-3xl font-black text-fuchsia-100 transition hover:bg-fuchsia-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                      :disabled="normalizedVoteAmount >= maxVoteAmount"
                      :aria-label="$t('polls.detail.incrementVote')"
                      @click="adjustVoteAmount(1)"
                    >
                      +
                    </button>
                  </div>
                  <span
                    class="mt-2 block text-center text-xs font-bold text-slate-400"
                  >
                    {{
                      $t("polls.detail.maxVotes", {
                        count: maxVoteAmount.toLocaleString("es"),
                      })
                    }}
                  </span>
                </label>

                <div
                  v-if="!isAnonymousVotingFlow"
                  class="grid grid-cols-4 gap-2"
                >
                  <button
                    v-for="quickAmount in [1, 5, 10, 25]"
                    :key="quickAmount"
                    type="button"
                    class="min-h-10 rounded-2xl border border-white/10 bg-white/5 text-sm font-black text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    :disabled="quickAmount > maxVoteAmount"
                    @click="setVoteAmount(quickAmount)"
                  >
                    {{
                      quickAmount === 1
                        ? $t("polls.detail.voteUnit", { count: quickAmount })
                        : $t("polls.detail.votesCount", { count: quickAmount })
                    }}
                  </button>
                </div>

                <p
                  v-if="errorMessage"
                  class="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
                >
                  {{ errorMessage }}
                </p>

                <div class="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
                    @click="closeVoteModal"
                  >
                    {{ $t("common.actions.cancel") }}
                  </button>
                  <button
                    type="submit"
                    class="min-h-12 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="
                      isVoting === getContestantArtistId(voteModalContestant) ||
                      (isAnonymousVotingFlow
                        ? !canUseAnonymousVote
                        : normalizedVoteAmount < 1 ||
                          normalizedVoteAmount > maxVoteAmount)
                    "
                  >
                    {{
                      isVoting === getContestantArtistId(voteModalContestant)
                        ? $t("polls.detail.voting")
                        : isAnonymousVotingFlow
                          ? $t("polls.detail.useFreeVote")
                          : $t("polls.detail.castVotes", {
                              count: normalizedVoteAmount.toLocaleString("es"),
                            })
                    }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
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

.vote-feedback-card {
  animation: vote-feedback-card 1.35s ease-out both;
}

.vote-feedback-badge {
  position: absolute;
  top: -1.85rem;
  right: 0;
  z-index: 20;
  white-space: nowrap;
  border-radius: 9999px;
  border: 1px solid rgba(110, 231, 183, 0.38);
  background: linear-gradient(
    90deg,
    rgba(16, 185, 129, 0.96),
    rgba(34, 211, 238, 0.96)
  );
  padding: 0.28rem 0.65rem;
  color: #052e2b;
  font-size: 0.7rem;
  font-weight: 1000;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: 0 0 28px rgba(45, 212, 191, 0.34);
  animation: vote-feedback-badge 1.45s ease-out both;
  pointer-events: none;
}

.vote-feedback-notice {
  position: absolute;
  right: 0.85rem;
  top: 0.85rem;
  z-index: 40;
  border-radius: 9999px;
  border: 1px solid rgba(110, 231, 183, 0.46);
  background: linear-gradient(
    90deg,
    rgba(6, 78, 59, 0.96),
    rgba(8, 47, 73, 0.96)
  );
  padding: 0.45rem 0.85rem;
  color: #d1fae5;
  font-size: 0.68rem;
  font-weight: 1000;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 0 30px rgba(16, 185, 129, 0.38);
  animation: vote-feedback-notice 2.35s ease-out both;
  pointer-events: none;
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

@keyframes vote-feedback-card {
  0% {
    border-color: rgba(110, 231, 183, 0.72);
    background-color: rgba(16, 185, 129, 0.12);
    box-shadow:
      0 0 0 0 rgba(45, 212, 191, 0.56),
      0 0 44px rgba(34, 211, 238, 0.28);
    transform: translateY(0) scale(1);
  }

  30% {
    border-color: rgba(244, 114, 182, 0.72);
    background-color: rgba(34, 211, 238, 0.1);
    box-shadow:
      0 0 0 10px rgba(45, 212, 191, 0),
      0 0 62px rgba(217, 70, 239, 0.36);
    transform: translateY(-3px) scale(1.012);
  }

  100% {
    box-shadow: none;
    transform: translateY(0) scale(1);
  }
}

@keyframes vote-feedback-badge {
  0% {
    opacity: 0;
    transform: translateY(0.45rem) scale(0.82);
  }

  18% {
    opacity: 1;
    transform: translateY(0) scale(1.06);
  }

  78% {
    opacity: 1;
    transform: translateY(-0.25rem) scale(1);
  }

  100% {
    opacity: 0;
    transform: translateY(-0.85rem) scale(0.96);
  }
}

@keyframes vote-feedback-notice {
  0% {
    opacity: 0;
    transform: translateY(-0.5rem) scale(0.88);
  }

  14% {
    opacity: 1;
    transform: translateY(0) scale(1.04);
  }

  74% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  100% {
    opacity: 0;
    transform: translateY(-0.35rem) scale(0.96);
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
