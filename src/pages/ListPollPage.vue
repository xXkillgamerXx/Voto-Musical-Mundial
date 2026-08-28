<script setup>
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { i18n, translate } from "../i18n";
import { applyPollLocale, pollUrl as buildPollUrl } from "../utils/pollLocale";
import {
  applyShareMeta,
  getPublicShareOrigin,
  resolvePollShareImage,
  shareWithOptionalImage,
} from "../utils/shareMeta";
import { routePath } from "../utils/localizedRoutes";
import { getArtistsCached } from "../services/firebaseCache";
import { getCurrentApiAuth, getMe } from "../services/api/authApi";
import {
  getStoredAuth,
  onStoredAuthChange,
  setStoredAuth,
} from "../services/api/client";
import { getPoll, getPolls, getPollResults } from "../services/api/pollsApi";
import { hasRichTextContent, richTextToHtml } from "../utils/richText";
import {
  castVote as castApiVote,
  claimShareVoteBoost,
  getAnonymousVoteStatus,
  getShareVoteBoost,
} from "../services/api/votesApi";
import { getMissions, reportMissionPollView } from "../services/api/missionsApi";
import { getAppDownloadConfig } from "../services/api/appDownloadApi";
import { openGooglePlay } from "../utils/openGooglePlay";
import { subscribePollRealtime } from "../services/api/realtimeApi";
import {
  loadContestantMetadata,
  mergeContestantsWithPublicResults,
  normalizeContestantVotes,
  subscribePublicResults,
} from "../services/pollResults";
import {
  createVoteQueue,
  shardCountForConcurrency,
} from "../services/voteQueue";
import {
  isTurnstileEnabled,
  isTurnstileMocked,
  removeTurnstileWidget,
  renderTurnstileWidget,
  resetTurnstileWidget,
} from "../services/turnstile";
import InFeedAd from "../components/InFeedAd.vue";

const ActivePolls = defineAsyncComponent(() => import("../components/ActivePolls.vue"));
const EmbedAd = defineAsyncComponent(() => import("../components/EmbedAd.vue"));
const PollComments = defineAsyncComponent(() => import("../components/PollComments.vue"));
const PollShareNetworksBar = defineAsyncComponent(
  () => import("../components/PollShareNetworksBar.vue"),
);
const WinnerCertificateModal = defineAsyncComponent(
  () => import("../components/WinnerCertificateModal.vue"),
);

const hallOfFameHref = computed(() => routePath("hallOfFame", i18n.global.locale.value));

const pathParts = window.location.pathname.split("/").filter(Boolean);
const routeYear = Number(pathParts[1]) || new Date().getFullYear();
const routeSlug = pathParts[2] || "";
const roundQueryParam = "ronda";
const embedQueryParam = "embed";
const matchQueryParam = "duelo";
const counterQueryParam = "contador";
const anonymousDefaultScope = "_round";
const finalRoundTabId = "__final";
const ANON_COOLDOWN_STORAGE_PREFIX = "vmm-anon-cooldown";

const poll = ref(null);
const currentPollId = ref("");
const artists = ref([]);
const contestants = ref([]);
const rounds = ref([]);
const selectedRoundContestants = ref([]);
const finalResultContestants = ref([]);
const finalOverallContestants = ref([]);
const currentUser = ref(null);
const userPoints = ref(0);
const displayUserPoints = ref(0);
const isLoading = ref(true);
const isLoadingSelectedRound = ref(false);
const isLoadingContestants = ref(false);
const isVoting = ref("");
const errorMessage = ref("");
const anonymousCooldownNotice = ref("");
const shareMessage = ref("");
const certificateModal = ref({
  open: false,
  name: "",
  group: "",
  date: "",
});
const shareBoostConfig = ref({
  enabled: true,
  multiplier: 2,
  durationMinutes: 10,
  oncePerDay: false,
});
const shareBoostActive = ref(null);
const shareBoostClaimedToday = ref(false);
const shareBoostCanClaim = ref(true);
const isClaimingShareBoost = ref(false);
const shareBoostMessage = ref("");
const now = ref(Date.now());
const isMobileViewport = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 639px)").matches;
const STARTLY_SHARE_URL = "https://startlyapp.com/musicmundial";
const selectedRoundId = ref("");
const voteModalContestant = ref(null);
const voteAmount = ref(1);
const voteFeedbacks = ref({});
const liveVoteFlashIds = ref({});
const optimisticVoteTotals = ref({});
const animatedVoteCounts = ref({});
const animatedDisplayedTotalVotes = ref(null);
const turnstileContainer = ref(null);
const turnstileToken = ref("");
const turnstileError = ref("");
const anonymousVoteStatuses = ref({});
const isLoadingAnonymousStatus = ref(false);
const isSignupPromptOpen = ref(false);
const pendingAnonymousVoteFeedback = ref(null);
const anonymousVoteSuccessToast = ref(null);
const missionsPrompt = ref(null);
const pendingMissionsCount = ref(null);
const DEFAULT_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=vote.musicmundial.com";
const appDownloadPrompt = ref({
  enabled: true,
  playStoreUrl: DEFAULT_PLAY_STORE_URL,
  firstOpenRewardEnabled: true,
  firstOpenRewardPoints: 15,
});
const roundDetailSection = ref(null);
const showSecondarySections = ref(false);

let unsubscribeAuth = null;
let unsubscribePoll = null;
let unsubscribeContestants = null;
let unsubscribeRounds = null;
let unsubscribeUserPoints = null;
let unsubscribePublicResults = null;
let unsubscribeRealtime = null;
let reloadPublicResults = null;
let realtimeResultsThrottle = 0;
let realtimeStateThrottle = 0;
let lastLiveVoteToastAt = 0;
const liveVoteFlashTimers = new Map();
const lastLiveVoteFlashAt = new Map();
const recentOwnVoteArtists = new Set();
const LIVE_VOTE_FLASH_COOLDOWN_MS = 1200;
const RECENT_OWN_VOTE_WINDOW_MS = 4000;
let missionsPromptTimer = null;
let clockTimer = null;
const handleAnonymousVisibilityRefresh = () => {
  if (document.visibilityState !== "visible") {
    return;
  }

  now.value = Date.now();
  refreshAnonymousVoteStatuses();
};
let secondarySectionsTimer = null;
let userPointsAnimationFrame = null;
let voteQueue = null;
let turnstileWidgetId = null;
let anonymousVoteToastTimer = null;
let listeningContestantsKey = "";
let embedResizeObserver = null;
let previousEmbedOverflowStyles = null;
const voteFeedbackTimers = new Map();
const voteCountAnimationTimers = new Map();
let displayedTotalAnimationTimer = null;
const POINTS_PER_VOTE_FALLBACK = 1;
const DEFAULT_ANONYMOUS_COOLDOWN_MINUTES = 60;
const resolvePointsPerVote = () => {
  const pollConfig = poll.value?.config || {};
  const pollVoting = pollConfig.voting || poll.value?.voting || {};
  const roundConfig = activeRound.value?.config || {};
  const roundVoting = roundConfig.voting || {};
  const merged = { ...pollVoting, ...roundVoting };
  const raw = Number(merged.costPerVote ?? POINTS_PER_VOTE_FALLBACK);
  const cost = Number.isFinite(raw) ? Math.floor(raw) : POINTS_PER_VOTE_FALLBACK;

  return Math.min(1000, Math.max(1, cost));
};

const pointsPerVote = computed(() => resolvePointsPerVote());
const db = null;

const applyCommittedVotes = (batch, result) => {
  if (result?.user && result.user.points !== undefined && result.user.points !== null) {
    syncStoredPoints(result.user.points, result.user.spentPoints);
  }

  const artistId = batch.artistId;
  const amount = Number(result?.amount || 0);

  if (!artistId || amount <= 0) {
    return;
  }

  const currentContestant = displayedContestants.value.find(
    (item) => getContestantArtistId(item) === artistId,
  );
  const currentVotes = displayVoteCountFor(currentContestant || { artistId });

  setOptimisticVoteTotal(artistId, currentVotes + amount);
  showVoteFeedback(artistId, amount, { flash: false });
  if (currentUser.value && !currentUser.value.isAnonymous) {
    window.dispatchEvent(new CustomEvent('vmm:missions-refresh'));
  }
  window.setTimeout(() => {
    clearOptimisticVoteTotal(batch.artistId);
  }, 1200);
};

const dateLike = (value) => {
  if (!value || typeof value !== "string") {
    return value || null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
  };
};

const normalizeApiArtist = (artist) => {
  if (!artist) return null;
  const metadata = artist.metadata || {};
  const image =
    artist.image ||
    artist.imageUrl ||
    artist.photo ||
    artist.photoUrl ||
    artist.photoURL ||
    artist.foto ||
    artist.banner ||
    metadata.image ||
    metadata.imageUrl ||
    metadata.photo ||
    metadata.photoUrl ||
    metadata.photoURL ||
    metadata.foto ||
    metadata.banner ||
    "";

  return {
    ...metadata,
    ...artist,
    id: String(artist.id),
    image,
    imageUrl: image,
    photo: image,
    photoURL: image,
    banner:
      metadata.banner ||
      metadata.bannerUrl ||
      metadata.cover ||
      metadata.coverImage ||
      image,
  };
};

const normalizeApiContestant = (contestant) => {
  const metadata = contestant.metadata || {};
  const artist = normalizeApiArtist(contestant.artist);

  return {
    ...metadata,
    ...contestant,
    id: String(contestant.id),
    firebaseId: contestant.firebaseId || metadata.id || null,
    artistId: String(contestant.artistId || artist?.id || metadata.artistId || contestant.id),
    artist,
    votes: Number(contestant.votes || 0),
    manualVotes: Number(contestant.manualVotes || 0),
    totalVotes: Number(
      contestant.totalVotes ??
        Number(contestant.votes || 0) + Number(contestant.manualVotes || 0),
    ),
    matchGroup: Number(contestant.matchGroup || 0),
    matchOrder: Number(contestant.matchOrder || 0),
    order: Number(contestant.order || 0),
    roundId: contestant.roundId ? String(contestant.roundId) : metadata.roundId || null,
  };
};

const normalizeApiRound = (round) => {
  const metadata = round.metadata || round.config || {};

  return {
    ...metadata,
    ...round,
    id: String(round.id),
    firebaseId: round.firebaseId || metadata.id || null,
    startAt: dateLike(round.startsAt || metadata.startsAt || metadata.startAt),
    startsAt: dateLike(round.startsAt || metadata.startsAt || metadata.startAt),
    endAt: dateLike(round.endsAt || metadata.endsAt || metadata.endAt),
    endsAt: dateLike(round.endsAt || metadata.endsAt || metadata.endAt),
    createdAt: dateLike(round.createdAt),
    updatedAt: dateLike(round.updatedAt),
  };
};

const normalizeApiPoll = (apiPoll) => {
  const metadata = apiPoll.metadata || apiPoll.config || {};
  const normalizedRounds = (apiPoll.rounds || []).map(normalizeApiRound);
  const liveRound = normalizedRounds.find((round) => round.status === "live");

  const base = {
    ...metadata,
    ...apiPoll,
    id: String(apiPoll.id),
    firebaseId: apiPoll.firebaseId || metadata.id || null,
    year: Number(metadata.year || apiPoll.year || routeYear),
    activeRoundId: String(apiPoll.activeRoundId || metadata.activeRoundId || liveRound?.id || ""),
    totalVotes: Number(apiPoll.totalVotes || 0),
    leaderArtistId: apiPoll.leaderArtistId ? String(apiPoll.leaderArtistId) : metadata.leaderArtistId || null,
    leaderVotes: Number(apiPoll.leaderVotes || 0),
    startAt: dateLike(apiPoll.startsAt || metadata.startsAt || metadata.startAt),
    startsAt: dateLike(apiPoll.startsAt || metadata.startsAt || metadata.startAt),
    endAt: dateLike(apiPoll.endsAt || metadata.endsAt || metadata.endAt),
    endsAt: dateLike(apiPoll.endsAt || metadata.endsAt || metadata.endAt),
    activeEndAt: dateLike(apiPoll.activeEndAt || metadata.activeEndAt),
    createdAt: dateLike(apiPoll.createdAt),
    updatedAt: dateLike(apiPoll.updatedAt),
    rounds: normalizedRounds,
    contestants: (apiPoll.contestants || []).map(normalizeApiContestant),
  };

  return applyPollLocale(base, i18n.global.locale.value);
};

watch(
  () => i18n.global.locale.value,
  () => {
    if (!poll.value) {
      return;
    }

    poll.value = applyPollLocale(poll.value, i18n.global.locale.value);
    rounds.value = (poll.value?.rounds || []).map(normalizeApiRound);

    // Actualiza el slug de la URL al idioma actual para que al compartir
    // el enlace salga en ES o EN según corresponda.
    try {
      const nextPath = buildPollUrl(poll.value, i18n.global.locale.value);
      const url = new URL(window.location.href);
      if (url.pathname !== nextPath) {
        window.history.replaceState(
          {},
          "",
          `${nextPath}${url.search}${url.hash}`,
        );
      }
    } catch {
      // ignore URL sync errors
    }
  },
);

const isEmbeddedPage = computed(() => {
  const embedParam = new URLSearchParams(window.location.search).get(
    embedQueryParam,
  );

  return embedParam === "1" || embedParam === "true";
});
const routeRoundId = computed(
  () => new URLSearchParams(window.location.search).get(roundQueryParam) || "",
);
const routeMatchGroup = computed(
  () => new URLSearchParams(window.location.search).get(matchQueryParam) || "",
);
const isCounterEmbed = computed(() => {
  const counterParam = new URLSearchParams(window.location.search).get(
    counterQueryParam,
  );

  return isEmbeddedPage.value && (counterParam === "1" || counterParam === "true");
});

const postEmbedHeight = () => {
  if (!isEmbeddedPage.value || window.parent === window) {
    return;
  }

  window.parent.postMessage(
    {
      type: "wmv-embed-height",
      height: Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight || 0,
      ),
      src: window.location.href,
    },
    "*",
  );
};

const startEmbedHeightSync = () => {
  if (!isEmbeddedPage.value || typeof ResizeObserver === "undefined") {
    nextTick(postEmbedHeight);
    return;
  }

  embedResizeObserver = new ResizeObserver(() => {
    postEmbedHeight();
  });
  embedResizeObserver.observe(document.body);
  nextTick(postEmbedHeight);
};

const applyEmbeddedNoScroll = () => {
  if (!isEmbeddedPage.value) {
    return;
  }

  previousEmbedOverflowStyles = {
    htmlOverflow: document.documentElement.style.overflow,
    htmlScrollbarWidth: document.documentElement.style.scrollbarWidth,
    bodyOverflow: document.body.style.overflow,
    bodyScrollbarWidth: document.body.style.scrollbarWidth,
  };
  document.documentElement.style.overflow = "hidden";
  document.documentElement.style.scrollbarWidth = "none";
  document.body.style.overflow = "hidden";
  document.body.style.scrollbarWidth = "none";
};

const restoreEmbeddedNoScroll = () => {
  if (!previousEmbedOverflowStyles) {
    return;
  }

  document.documentElement.style.overflow =
    previousEmbedOverflowStyles.htmlOverflow;
  document.documentElement.style.scrollbarWidth =
    previousEmbedOverflowStyles.htmlScrollbarWidth;
  document.body.style.overflow = previousEmbedOverflowStyles.bodyOverflow;
  document.body.style.scrollbarWidth =
    previousEmbedOverflowStyles.bodyScrollbarWidth;
  previousEmbedOverflowStyles = null;
};

const getArtist = (artistId) =>
  artists.value.find((artist) => artist.id === artistId);

const getPollArtist = (artistId) =>
  poll.value?.contestants
    ?.find((contestant) => contestant.artistId === artistId || contestant.artist?.id === artistId)
    ?.artist ||
  rounds.value
    .flatMap((round) => round.contestants || [])
    .find((contestant) => contestant.artistId === artistId || contestant.artist?.id === artistId)
    ?.artist ||
  null;

const resolveArtist = (artistId, fallbackArtist = null) =>
  fallbackArtist || getArtist(artistId) || getPollArtist(artistId);

const getArtistImage = (artist) =>
  artist?.image ||
  artist?.imageUrl ||
  artist?.photo ||
  artist?.photoUrl ||
  artist?.photoURL ||
  artist?.foto ||
  artist?.banner ||
  "";

const getArtistGroup = (artist) => artist?.group || artist?.fandom || "";

const getOptimisticVoteTotal = (artistId) =>
  Number(optimisticVoteTotals.value[artistId] || 0);

const serverVoteTotalForArtist = (artistId, rows = activeRoundContestantRows.value) => {
  const contestant = rows.find((item) => getContestantArtistId(item) === artistId);
  return normalizeContestantVotes(contestant || {});
};

const reconcileOptimisticVoteTotals = (rows = activeRoundContestantRows.value) => {
  const nextTotals = { ...optimisticVoteTotals.value };
  let changed = false;

  Object.entries(nextTotals).forEach(([artistId, optimisticTotal]) => {
    if (serverVoteTotalForArtist(artistId, rows) >= Number(optimisticTotal || 0)) {
      delete nextTotals[artistId];
      changed = true;
    }
  });

  if (changed) {
    optimisticVoteTotals.value = nextTotals;
  }
};

const getContestantArtistId = (contestant) =>
  String(contestant?.artistId ?? contestant?.id ?? "");

const normalizeArtistKey = (artistId) => String(artistId || "").trim();

const hasOwnVoteFeedback = (artistId) =>
  voteFeedbacks.value[normalizeArtistKey(artistId)]?.source === "own";

const liveVoteFlashStampFor = (artistId) => {
  const key = normalizeArtistKey(artistId);
  if (!key || hasOwnVoteFeedback(key)) {
    return "";
  }

  return liveVoteFlashIds.value[key] || "";
};

const showsLiveVoteFlash = (artistId) => Boolean(liveVoteFlashStampFor(artistId));

const contestantLiveFlashStamp = (contestant) =>
  liveVoteFlashStampFor(getContestantArtistId(contestant));

const contestantShowsLiveFlash = (contestant) =>
  showsLiveVoteFlash(getContestantArtistId(contestant));

const activeRound = computed(() => {
  if (isEmbeddedPage.value && routeRoundId.value) {
    const embeddedRound = rounds.value.find(
      (round) =>
        round.id === routeRoundId.value ||
        String(round.number) === routeRoundId.value,
    );

    if (embeddedRound) {
      return embeddedRound;
    }
  }

  return poll.value?.status === "closed"
    ? rounds.value.filter((round) => round.status === "closed").at(-1) ||
        rounds.value.at(-1) ||
        null
    : rounds.value.find((round) => round.id === poll.value?.activeRoundId) ||
        rounds.value.find((round) => round.status === "live") ||
        rounds.value[0] ||
        null;
});
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
const isActiveRoundOpen = computed(() =>
  Boolean(
    activeRound.value?.status === "live" ||
      (poll.value?.status === "live" &&
        activeRound.value?.id &&
        poll.value?.activeRoundId === activeRound.value.id) ||
      (poll.value?.status === "live" && activeRound.value?.status !== "closed"),
  ),
);
const isSelectingWinners = computed(
  () =>
    poll.value?.status === "selecting_winners" ||
    (poll.value?.status === "live" && hasEnded.value),
);
const isClosed = computed(() => poll.value?.status === "closed");
const activeRoundContestantRows = computed(() => {
  const roundId = activeRound.value?.id ? String(activeRound.value.id) : "";

  if (!roundId) {
    return contestants.value.filter((contestant) => !contestant.roundId);
  }

  return contestants.value.filter(
    (contestant) =>
      String(contestant.roundId || "") === roundId ||
      String(contestant.firebaseId || "") === roundId,
  );
});

const rankedContestants = computed(() =>
  activeRoundContestantRows.value
    .map((contestant) => {
      const artistId = getContestantArtistId(contestant);
      const serverTotalVotes = normalizeContestantVotes(contestant);
      const totalVotes = Math.max(
        serverTotalVotes,
        getOptimisticVoteTotal(artistId),
      );
      return {
        ...contestant,
        artist: resolveArtist(artistId, contestant.artist),
        artistId,
        totalVotes,
      };
    })
    .sort((current, next) => next.totalVotes - current.totalVotes),
);

const activeContestants = computed(() =>
  activeRoundContestantRows.value
    .map((contestant, index) => {
      const artistId = getContestantArtistId(contestant);
      const totalVotes = Math.max(
        normalizeContestantVotes(contestant),
        getOptimisticVoteTotal(artistId),
      );
      return {
        ...contestant,
        order: Number(contestant.order ?? index),
        matchGroup: Number(contestant.matchGroup || 0),
        matchOrder: Number(contestant.matchOrder ?? index),
        artist: resolveArtist(artistId, contestant.artist),
        artistId,
        totalVotes,
      };
    })
    .sort((current, next) => {
      if (activeRound.value?.type === "versus") {
        if (current.matchGroup !== next.matchGroup) {
          return current.matchGroup - next.matchGroup;
        }

        if (current.matchOrder !== next.matchOrder) {
          return current.matchOrder - next.matchOrder;
        }
      }

      return current.order - next.order;
    }),
);

// Al abrir una ronda cerrada seguimos mostrando duelos si esa ronda es versus,
// para que el % sea contra el duelo y no contra toda la fase.
const displayedRound = computed(() =>
  isViewingSelectedClosedRound.value
    ? selectedRoundStep.value
    : activeRound.value,
);

const displayedRoundType = computed(() => displayedRound.value?.type || "");

const versusSourceContestants = computed(() => {
  if (!isViewingSelectedClosedRound.value) {
    return activeContestants.value;
  }

  return selectedRoundContestants.value
    .map((contestant, index) => {
      const artistId = getContestantArtistId(contestant);

      return {
        ...contestant,
        order: Number(contestant.order ?? index),
        matchGroup: Number(contestant.matchGroup || 0),
        matchOrder: Number(contestant.matchOrder ?? index),
        artist: resolveArtist(artistId, contestant.artist),
        artistId,
        totalVotes: normalizeContestantVotes(contestant),
      };
    })
    .sort((current, next) => {
      if (current.matchGroup !== next.matchGroup) {
        return current.matchGroup - next.matchGroup;
      }

      if (current.matchOrder !== next.matchOrder) {
        return current.matchOrder - next.matchOrder;
      }

      return current.order - next.order;
    });
});

const versusMatches = computed(() => {
  const roundId = displayedRound.value?.id || "round";
  const manualGroups = versusSourceContestants.value.reduce((groups, contestant) => {
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
        id: `${roundId}-${groupNumber}`,
        groupNumber,
        title: translate("polls.detail.duelTitle", { number: groupNumber }),
        contestants: contestants.sort(
          (current, next) => current.matchOrder - next.matchOrder,
        ),
      }));
  }

  const matches = [];

  for (
    let index = 0;
    index < versusSourceContestants.value.length;
    index += 2
  ) {
    const groupNumber = Math.floor(index / 2) + 1;

    matches.push({
      id: `${roundId}-${index}`,
      groupNumber,
      title: translate("polls.detail.duelTitle", { number: groupNumber }),
      contestants: versusSourceContestants.value.slice(index, index + 2),
    });
  }

  return matches;
});

const displayedVersusMatches = computed(() => {
  if (!routeMatchGroup.value) {
    return versusMatches.value;
  }

  return versusMatches.value.filter(
    (match) =>
      String(match.groupNumber) === routeMatchGroup.value ||
      match.id === routeMatchGroup.value,
  );
});

const totalVotes = computed(() =>
  rankedContestants.value.reduce(
    (total, contestant) => total + Number(contestant.totalVotes || 0),
    0,
  ),
);

const finalResultTotalVotes = computed(() =>
  finalResultContestants.value.reduce(
    (total, contestant) => total + Number(contestant.totalVotes || 0),
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
const finalOverallTotalVotes = computed(() =>
  finalOverallContestants.value.reduce(
    (total, contestant) => total + Number(contestant.totalVotes || 0),
    0,
  ),
);
const finalResultRound = computed(() =>
  rounds.value
    .filter((round) => round.status === "closed" && round.winnerIds?.length)
    .at(-1) ||
  rounds.value.filter((round) => round.status === "closed").at(-1) ||
  null,
);

const displayedContestants = computed(() =>
  selectedRoundStep.value?.status === "closed"
    ? selectedRoundContestants.value
    : rankedContestants.value,
);

const buildFeedWithShare = (rows, idPrefix, { adEveryN = 0, maxAds = 2 } = {}) => {
  if (!rows.length) {
    return [];
  }

  const insertAt = Math.ceil(rows.length / 2);
  const items = [];
  let adsInserted = 0;
  const allowAds = adEveryN > 0 && !isEmbeddedPage.value;

  rows.forEach((row, index) => {
    if (index === insertAt) {
      items.push({ type: "share", id: `${idPrefix}-share` });
    }

    items.push({
      type: "row",
      id: String(row.id || `${idPrefix}-${index}`),
      row,
      index,
    });

    const isLast = index === rows.length - 1;
    const hitCadence = adEveryN > 0 && (index + 1) % adEveryN === 0;
    if (allowAds && hitCadence && adsInserted < maxAds && !isLast) {
      adsInserted += 1;
      items.push({ type: "ad", id: `${idPrefix}-ad-${index}` });
    }
  });

  if (insertAt >= rows.length) {
    items.push({ type: "share", id: `${idPrefix}-share` });
  }

  if (allowAds && adsInserted === 0) {
    const firstRowIndex = items.findIndex((item) => item.type === "row");
    if (firstRowIndex >= 0) {
      items.splice(firstRowIndex + 1, 0, {
        type: "ad",
        id: `${idPrefix}-ad-first`,
      });
    }
  }

  return items;
};

const contestantFeedItems = computed(() =>
  buildFeedWithShare(displayedContestants.value, "contestant", {
    adEveryN: 4,
    maxAds: 2,
  }),
);

const versusFeedItems = computed(() =>
  buildFeedWithShare(displayedVersusMatches.value, "versus", {
    adEveryN: 2,
    maxAds: 2,
  }),
);

const displayedTotalVotes = computed(() =>
  displayedContestants.value.reduce(
    (total, contestant) => total + Number(contestant.totalVotes || 0),
    0,
  ),
);

const isActiveRoundContestant = (contestant) => {
  const activeRoundId = activeRound.value?.id ? String(activeRound.value.id) : "";
  const contestantRoundId = String(contestant?.roundId || "");

  if (!activeRoundId) {
    return !contestantRoundId;
  }

  return (
    contestantRoundId === activeRoundId ||
    String(contestant?.firebaseId || "") === activeRoundId
  );
};

// Los contadores animados se llenan con la ronda en vivo y van por artista, no
// por contestant. Un artista que compite en varias fases arrastraria los votos
// de la ronda activa a una ronda cerrada y el % saldria absurdo.
const displayVoteCountFor = (contestant) => {
  const serverVotes = Math.max(0, Math.round(Number(contestant?.totalVotes ?? 0)));

  if (!isActiveRoundContestant(contestant)) {
    return serverVotes;
  }

  const animatedCount =
    animatedVoteCounts.value[getContestantArtistId(contestant)];

  return animatedCount === undefined
    ? serverVotes
    : Math.max(0, Math.round(Number(animatedCount)));
};

const isViewingLiveContestants = computed(
  () => !isViewingSelectedClosedRound.value && !isViewingFinalResult.value,
);

const displayTotalVotes = computed(() => {
  const animatedTotal = isViewingLiveContestants.value
    ? animatedDisplayedTotalVotes.value
    : null;

  return Math.max(
    0,
    Math.round(Number(animatedTotal ?? displayedTotalVotes.value)),
  );
});

const isLoadingDisplayedContestants = computed(() =>
  isViewingSelectedClosedRound.value
    ? isLoadingSelectedRound.value
    : isLoadingContestants.value,
);

const shouldShowVoteButtons = computed(
  () =>
    isVotingOpen.value &&
    (isEmbeddedPage.value
      ? isActiveRoundOpen.value
      : selectedRoundStep.value?.status !== "closed"),
);
const hideVoteCounts = computed(() =>
  Boolean(
    displayedRound.value?.hideVoteCounts ??
      poll.value?.hideVoteCounts ??
      false,
  ),
);
const hideCountdown = computed(() =>
  Boolean(
    activeRound.value?.hideCountdown ??
      poll.value?.hideCountdown ??
      false,
  ),
);
const pollDescriptionHtml = computed(() => richTextToHtml(poll.value?.description));
const pollBodyHtml = computed(() => richTextToHtml(poll.value?.body));
const hasPollDescription = computed(() => hasRichTextContent(poll.value?.description));
const hasPollBody = computed(() => hasRichTextContent(poll.value?.body));
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
const getAnonymousVoteScope = (contestant) => {
  if (activeRound.value?.type !== "versus") {
    return anonymousDefaultScope;
  }

  const artistId = getContestantArtistId(contestant);
  const match = versusMatches.value.find((versusMatch) =>
    versusMatch.contestants.some(
      (matchContestant) => getContestantArtistId(matchContestant) === artistId,
    ),
  );

  if (match?.groupNumber) {
    return `match_${match.groupNumber}`;
  }

  const matchGroup = Number(contestant?.matchGroup || 0);
  return matchGroup ? `match_${matchGroup}` : anonymousDefaultScope;
};
const anonymousVoteScopes = computed(() => {
  if (activeRound.value?.type !== "versus") {
    return [anonymousDefaultScope];
  }

  const matchScopes = [
    ...new Set(
      displayedVersusMatches.value.map(
        (match) => `match_${match.groupNumber}`,
      ),
    ),
  ];

  // While versus matches are still loading, keep the default scope so the
  // free-vote cooldown can still hydrate and show the wait timer.
  return matchScopes.length ? matchScopes : [anonymousDefaultScope];
});
const anonymousCooldownStorageKey = (scope = anonymousDefaultScope) => {
  const pollId = String(poll.value?.id || currentPollId.value || "");
  const roundId = String(activeRound.value?.id || "root");
  return `${ANON_COOLDOWN_STORAGE_PREFIX}:${pollId}:${roundId}:${scope}`;
};
const readStoredAnonymousCooldown = (scope = anonymousDefaultScope) => {
  if (typeof window === "undefined" || !poll.value?.id) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(anonymousCooldownStorageKey(scope));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const nextVoteAtMs = new Date(parsed?.nextVoteAt || 0).getTime();
    if (!Number.isFinite(nextVoteAtMs) || nextVoteAtMs <= Date.now()) {
      window.localStorage.removeItem(anonymousCooldownStorageKey(scope));
      return null;
    }

    return {
      enabled: true,
      nextVoteAt: new Date(nextVoteAtMs).toISOString(),
      remainingMs: Math.max(0, nextVoteAtMs - Date.now()),
      cooldownMinutes: Number(
        parsed?.cooldownMinutes || anonymousVotingConfig.value.cooldownMinutes,
      ),
    };
  } catch {
    return null;
  }
};
const persistAnonymousCooldown = (scope, status) => {
  if (typeof window === "undefined" || !poll.value?.id || !status) {
    return;
  }

  const nextVoteAtMs = status.nextVoteAt
    ? new Date(status.nextVoteAt).getTime()
    : Date.now() + Number(status.remainingMs || 0);

  if (!Number.isFinite(nextVoteAtMs) || nextVoteAtMs <= Date.now()) {
    try {
      window.localStorage.removeItem(anonymousCooldownStorageKey(scope));
    } catch {
      // ignore storage errors
    }
    return;
  }

  try {
    window.localStorage.setItem(
      anonymousCooldownStorageKey(scope),
      JSON.stringify({
        nextVoteAt: new Date(nextVoteAtMs).toISOString(),
        cooldownMinutes: Number(
          status.cooldownMinutes || anonymousVotingConfig.value.cooldownMinutes,
        ),
      }),
    );
  } catch {
    // ignore storage errors
  }
};
const anonymousVoteStatusForScope = (scope = anonymousDefaultScope) =>
  anonymousVoteStatuses.value[scope] || null;
const anonymousNextVoteAtMsForScope = (scope = anonymousDefaultScope) => {
  const status = anonymousVoteStatusForScope(scope);
  const nextVoteAt = status?.nextVoteAt;

  if (nextVoteAt) {
    const parsed = new Date(nextVoteAt).getTime();
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const remainingMs = Number(status?.remainingMs || 0);
  if (remainingMs > 0) {
    return Date.now() + remainingMs;
  }

  return 0;
};
const normalizeAnonymousStatus = (status) => {
  if (!status || typeof status !== "object") {
    return null;
  }

  if (status.nextVoteAt) {
    return status;
  }

  const remainingMs = Number(status.remainingMs || 0);
  if (remainingMs > 0) {
    return {
      ...status,
      nextVoteAt: new Date(Date.now() + remainingMs).toISOString(),
    };
  }

  return status;
};
const mergeAnonymousStatus = (serverStatus, scope = anonymousDefaultScope) => {
  const normalizedServer = normalizeAnonymousStatus(serverStatus);
  const stored = readStoredAnonymousCooldown(scope);
  const serverNext = normalizedServer?.nextVoteAt
    ? new Date(normalizedServer.nextVoteAt).getTime()
    : 0;
  const storedNext = stored?.nextVoteAt
    ? new Date(stored.nextVoteAt).getTime()
    : 0;
  const nextVoteAtMs = Math.max(serverNext, storedNext);

  if (!nextVoteAtMs) {
    persistAnonymousCooldown(scope, null);
    return (
      normalizedServer || {
        enabled: true,
        nextVoteAt: null,
        remainingMs: 0,
        cooldownMinutes: anonymousVotingConfig.value.cooldownMinutes,
      }
    );
  }

  const merged = {
    ...(normalizedServer || {}),
    ...(stored || {}),
    enabled: true,
    nextVoteAt: new Date(nextVoteAtMs).toISOString(),
    remainingMs: Math.max(0, nextVoteAtMs - Date.now()),
    cooldownMinutes: Number(
      normalizedServer?.cooldownMinutes ||
        stored?.cooldownMinutes ||
        anonymousVotingConfig.value.cooldownMinutes,
    ),
  };

  persistAnonymousCooldown(scope, merged);
  return merged;
};
const hydrateAnonymousCooldownsFromStorage = () => {
  if (!poll.value?.id) {
    return;
  }

  const hydrated = {};
  anonymousVoteScopes.value.forEach((scope) => {
    const stored = readStoredAnonymousCooldown(scope);
    if (stored) {
      hydrated[scope] = stored;
    }
  });

  if (Object.keys(hydrated).length) {
    anonymousVoteStatuses.value = {
      ...anonymousVoteStatuses.value,
      ...hydrated,
    };
  }
};
const activeAnonymousStatusScope = computed(() => {
  if (voteModalContestant.value) {
    return getAnonymousVoteScope(voteModalContestant.value);
  }

  let scopeWithMostWait = anonymousDefaultScope;
  let longestWait = 0;

  anonymousVoteScopes.value.forEach((scope) => {
    const remainingMs = anonymousRemainingMsForScope(scope);
    if (remainingMs > longestWait) {
      longestWait = remainingMs;
      scopeWithMostWait = scope;
    }
  });

  return scopeWithMostWait;
});
const anonymousRemainingMsForScope = (scope = anonymousDefaultScope) =>
  Math.max(0, anonymousNextVoteAtMsForScope(scope) - now.value);
const selectedAnonymousVoteScope = computed(() =>
  getAnonymousVoteScope(voteModalContestant.value),
);
const anonymousRemainingMs = computed(() =>
  anonymousRemainingMsForScope(selectedAnonymousVoteScope.value),
);
const canUseAnonymousVoteForScope = (scope = anonymousDefaultScope) =>
  anonymousVotingConfig.value.enabled && anonymousRemainingMsForScope(scope) <= 0;
const canUseAnonymousVoteFor = (contestant) =>
  canUseAnonymousVoteForScope(getAnonymousVoteScope(contestant));
const canUseAnonymousVote = computed(() =>
  canUseAnonymousVoteForScope(selectedAnonymousVoteScope.value),
);
const isAnonymousVotingFlow = computed(() =>
  Boolean(
    voteModalContestant.value &&
      (!currentUser.value ||
        currentUser.value.isAnonymous ||
        (anonymousVotingConfig.value.enabled &&
          Number(userPoints.value || 0) < pointsPerVote.value)),
  ),
);
const isGuestAnonymousFlow = computed(
  () =>
    Boolean(voteModalContestant.value) &&
    (!currentUser.value || Boolean(currentUser.value.isAnonymous)),
);
const shouldShowTurnstile = computed(
  () => isGuestAnonymousFlow.value && isTurnstileEnabled(),
);
const isLoggedOutOfPoints = computed(
  () =>
    Boolean(currentUser.value) &&
    !currentUser.value.isAnonymous &&
    Number(userPoints.value || 0) < pointsPerVote.value,
);
const needsFreeVoteCooldown = computed(
  () =>
    anonymousVotingConfig.value.enabled &&
    (!currentUser.value ||
      Boolean(currentUser.value.isAnonymous) ||
      isLoggedOutOfPoints.value),
);
const hasEnoughPointsToVote = computed(() => {
  if (!currentUser.value || currentUser.value.isAnonymous) {
    return canUseAnonymousVote.value;
  }
  if (Number(userPoints.value || 0) >= pointsPerVote.value) {
    return true;
  }
  return (
    anonymousVotingConfig.value.enabled && canUseAnonymousVote.value
  );
});
const hasEnoughPointsToVoteFor = (contestant) => {
  if (!currentUser.value || currentUser.value.isAnonymous) {
    return canUseAnonymousVoteFor(contestant);
  }
  if (Number(userPoints.value || 0) >= pointsPerVote.value) {
    return true;
  }
  return (
    anonymousVotingConfig.value.enabled && canUseAnonymousVoteFor(contestant)
  );
};
const formattedUserPoints = computed(() =>
  Number(displayUserPoints.value || 0).toLocaleString("es"),
);
const maxVoteAmount = computed(() =>
  currentUser.value && !currentUser.value.isAnonymous
    ? Math.max(1, Math.floor(Number(userPoints.value || 0) / pointsPerVote.value))
    : Math.max(0, Math.floor(Number(userPoints.value || 0) / pointsPerVote.value)),
);
const normalizedVoteAmount = computed(() =>
  Math.min(
    maxVoteAmount.value,
    Math.max(1, Math.floor(Number(voteAmount.value || 1))),
  ),
);
const shareBoostMultiplier = computed(() =>
  Math.max(1, Number(shareBoostActive.value?.multiplier || 1)),
);
const shareBoostRemainingMs = computed(() => {
  const endsAt = Number(shareBoostActive.value?.endsAt || 0);
  if (!endsAt) return 0;
  return Math.max(0, endsAt - now.value);
});
const shareBoostRemainingLabel = computed(() => {
  const totalSeconds = Math.ceil(shareBoostRemainingMs.value / 1000);
  if (totalSeconds <= 0) return "00:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
});
const isShareBoostLive = computed(
  () =>
    Boolean(shareBoostConfig.value.enabled) &&
    shareBoostMultiplier.value > 1 &&
    shareBoostRemainingMs.value > 0,
);
const effectiveVoteAmount = computed(() =>
  isShareBoostLive.value
    ? normalizedVoteAmount.value * shareBoostMultiplier.value
    : normalizedVoteAmount.value,
);
const selectedVoteArtist = computed(
  () => voteModalContestant.value?.artist || null,
);
const anonymousCooldownLabelForScope = (scope = anonymousDefaultScope) => {
  const totalSeconds = Math.ceil(anonymousRemainingMsForScope(scope) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};
const anonymousCooldownLabel = computed(() =>
  anonymousCooldownLabelForScope(selectedAnonymousVoteScope.value),
);
const anonymousVoteMessageForScope = (scope = anonymousDefaultScope) => {
  if (!anonymousVotingConfig.value.enabled) {
    return translate("polls.detail.anonymousDisabled");
  }

  if (anonymousRemainingMsForScope(scope) > 0) {
    return translate("polls.detail.anonymousWait", {
      time: anonymousCooldownLabelForScope(scope),
    });
  }

  return translate("polls.detail.anonymousReady", {
    minutes: anonymousVotingConfig.value.cooldownMinutes,
  });
};
const anonymousVoteMessage = computed(() =>
  anonymousVoteMessageForScope(activeAnonymousStatusScope.value),
);
const anonymousLiveCountdownLabel = computed(() =>
  anonymousCooldownLabelForScope(activeAnonymousStatusScope.value),
);
const isAnonymousWaitingToVote = computed(
  () =>
    needsFreeVoteCooldown.value &&
    anonymousVoteScopes.value.some(
      (scope) => anonymousRemainingMsForScope(scope) > 0,
    ),
);
const isAnonymousOnCooldownFor = (contestant) => {
  if (!needsFreeVoteCooldown.value) {
    return false;
  }

  return anonymousRemainingMsForScope(getAnonymousVoteScope(contestant)) > 0;
};
const isVoteButtonDisabled = (contestant) => {
  if (!isVotingOpen.value) {
    return true;
  }

  if (isVoting.value === getContestantArtistId(contestant)) {
    return true;
  }

  if (!currentUser.value || currentUser.value.isAnonymous) {
    return false;
  }

  if (Number(userPoints.value || 0) >= pointsPerVote.value) {
    return false;
  }

  // Logged-in with 0 points: keep button clickable when free vote is on
  // (shows countdown / wait notice), same as guests.
  return !anonymousVotingConfig.value.enabled;
};
const showAnonymousCooldownNotice = (contestant) => {
  // El contador ya vive en el botón (Gratis en mm:ss). No mostrar aviso extra.
  anonymousCooldownNotice.value = "";
  errorMessage.value = "";

  if (
    currentUser.value &&
    !currentUser.value.isAnonymous &&
    isLoggedOutOfPoints.value
  ) {
    openMissionsPrompt(contestant);
    return;
  }

  if (!currentUser.value || currentUser.value.isAnonymous) {
    nextTick(() => {
      document
        .getElementById("anonymous-vote-status-banner")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }
};

const isMissionDone = (mission) => {
  const target = Math.max(1, Number(mission?.target || 1));
  const progress = Math.min(target, Number(mission?.progress || 0));
  return Boolean(
    mission?.completedAt || mission?.rewardedAt || progress >= target,
  );
};

const refreshPendingMissionsCount = async () => {
  if (!currentUser.value || currentUser.value.isAnonymous) {
    pendingMissionsCount.value = null;
    return;
  }

  try {
    const missionRows = await getMissions();
    const list = Array.isArray(missionRows) ? missionRows : [];
    pendingMissionsCount.value = list.filter(
      (mission) => mission?.active !== false && !isMissionDone(mission),
    ).length;
  } catch {
    pendingMissionsCount.value = null;
  }
};

const closeMissionsPrompt = () => {
  missionsPrompt.value = null;
};

const loadAppDownloadPromptConfig = async () => {
  try {
    const payload = await getAppDownloadConfig();
    if (!payload || typeof payload !== "object") {
      return;
    }
    if (payload.enabled === false || payload.visible === false) {
      appDownloadPrompt.value = {
        enabled: false,
        playStoreUrl: DEFAULT_PLAY_STORE_URL,
        firstOpenRewardEnabled: false,
        firstOpenRewardPoints: 0,
      };
      return;
    }
    const url = String(payload.playStoreUrl || "").trim();
    appDownloadPrompt.value = {
      enabled: true,
      playStoreUrl: url || DEFAULT_PLAY_STORE_URL,
      firstOpenRewardEnabled: payload.firstOpenRewardEnabled !== false,
      firstOpenRewardPoints: Math.max(
        0,
        Math.floor(Number(payload.firstOpenRewardPoints ?? 15)),
      ),
    };
  } catch {
    appDownloadPrompt.value = {
      enabled: true,
      playStoreUrl: DEFAULT_PLAY_STORE_URL,
      firstOpenRewardEnabled: true,
      firstOpenRewardPoints: 15,
    };
  }
};

const openMissionsPrompt = async (contestant) => {
  if (!contestant || isEmbeddedPage.value) {
    return;
  }

  window.clearTimeout(missionsPromptTimer);
  const voteScope = getAnonymousVoteScope(contestant);
  const status = anonymousVoteStatusForScope(voteScope);
  await Promise.all([
    refreshPendingMissionsCount(),
    loadAppDownloadPromptConfig(),
  ]);
  missionsPrompt.value = {
    contestant,
    voteScope,
    nextVoteAt: status?.nextVoteAt || null,
  };
  loadShareVoteBoost();
};

const scheduleMissionsPromptAfterFreeVote = (contestant) => {
  if (!contestant || isEmbeddedPage.value) {
    return;
  }

  if (!currentUser.value || currentUser.value.isAnonymous) {
    return;
  }

  window.clearTimeout(missionsPromptTimer);
  missionsPromptTimer = window.setTimeout(() => {
    openMissionsPrompt(contestant);
  }, 2000);
};

const goToMissionsFromPrompt = () => {
  closeMissionsPrompt();
  const nextUrl = "/#misiones";
  if (
    window.location.pathname === "/" &&
    window.location.hash === "#misiones"
  ) {
    document
      .getElementById("misiones")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  window.history.pushState({}, "", nextUrl);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

const showMissionsPromptDownloadCta = computed(
  () =>
    Boolean(appDownloadPrompt.value.enabled) &&
    Number(pendingMissionsCount.value || 0) <= 0,
);

const showFreeVoteDownloadCta = computed(
  () =>
    Boolean(appDownloadPrompt.value.enabled) &&
    Boolean(isAnonymousVotingFlow.value) &&
    Boolean(isLoggedOutOfPoints.value),
);

const openAppDownload = () => {
  const url =
    String(appDownloadPrompt.value.playStoreUrl || "").trim() ||
    DEFAULT_PLAY_STORE_URL;
  openGooglePlay(url);
};

const openAppDownloadFromPrompt = () => {
  closeMissionsPrompt();
  openAppDownload();
};

const openAppDownloadFromVoteModal = () => {
  closeVoteModal();
  openAppDownload();
};

const missionsPromptRemainingMs = computed(() => {
  const nextVoteAt = missionsPrompt.value?.nextVoteAt;
  if (!nextVoteAt) {
    return 0;
  }

  return Math.max(0, new Date(nextVoteAt).getTime() - now.value);
});

const missionsPromptCountdown = computed(() => {
  const totalSeconds = Math.ceil(missionsPromptRemainingMs.value / 1000);
  const safeSeconds = Math.max(0, Math.min(totalSeconds, 24 * 60 * 60));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return {
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
});

const missionsPromptRank = computed(() => {
  const contestant = missionsPrompt.value?.contestant;
  if (!contestant) {
    return null;
  }

  const artistId = getContestantArtistId(contestant);
  const index = displayedContestants.value.findIndex(
    (item) => getContestantArtistId(item) === artistId,
  );

  return index >= 0 ? index + 1 : null;
});

const missionsPromptPercent = computed(() => {
  const contestant = missionsPrompt.value?.contestant;
  if (!contestant) {
    return "0%";
  }

  return percentForDisplayedContestant(contestant);
});

const renderVisibleTurnstile = async () => {
  if (!shouldShowTurnstile.value) {
    return;
  }

  await nextTick();
  if (!turnstileContainer.value) {
    return;
  }

  if (turnstileWidgetId !== null) {
    removeTurnstileWidget(turnstileWidgetId);
    turnstileWidgetId = null;
  }

  turnstileToken.value = "";
  turnstileError.value = "";
  try {
    turnstileWidgetId = await renderTurnstileWidget(turnstileContainer.value, {
      onSuccess: (token) => {
        turnstileToken.value = token;
        turnstileError.value = "";
      },
      onError: () => {
        turnstileToken.value = "";
        turnstileError.value = "No se pudo completar la verificación. Intenta de nuevo.";
      },
      onExpired: () => {
        turnstileToken.value = "";
        turnstileError.value = "La verificación expiró. Márcala de nuevo.";
      },
    });
  } catch {
    turnstileError.value = "No se pudo cargar la verificación anti-bots.";
  }
};

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
    .map((artistId) => resolveArtist(artistId))
    .filter(Boolean);
});

const finalWinnerEntries = computed(() => {
  // El % del ganador debe ser sobre la ronda final, nunca sobre todas las fases.
  const finalRoundContestants = finalResultContestants.value.length
    ? finalResultContestants.value
    : [];
  const finalTotal = finalRoundContestants.reduce(
    (sum, contestant) => sum + Number(contestant.totalVotes || 0),
    0,
  );

  const finalRound = rounds.value
    .filter((round) => round.status === "closed" && round.winnerIds?.length)
    .at(-1);
  const winnerIds = poll.value?.winnerIds?.length
    ? poll.value.winnerIds
    : finalRound?.winnerIds || [];

  const buildEntry = (contestant, artistId) => {
    const artist = resolveArtist(artistId, contestant?.artist);
    const votes = Number(contestant?.totalVotes || 0);
    const percent = finalTotal ? (votes / finalTotal) * 100 : 0;

    return {
      id: artistId,
      artist,
      votes,
      percent,
      percentLabel: `${percent.toFixed(2)}%`,
      percentWidth: `${Math.min(Math.max(percent, 0), 100)}%`,
    };
  };

  if (!finalRoundContestants.length) {
    return [];
  }

  if (!winnerIds.length) {
    const contestant = finalRoundContestants[0];
    return [buildEntry(contestant, getContestantArtistId(contestant))].filter(
      (entry) => entry.artist,
    );
  }

  return winnerIds
    .slice(0, 1)
    .map((artistId) => {
      const contestant = finalRoundContestants.find(
        (item) => String(item.artistId) === String(artistId),
      );
      return buildEntry(contestant, artistId);
    })
    .filter((entry) => entry.artist);
});

const finalRankingEntries = computed(() => {
  const winnerId = String(finalWinnerEntries.value[0]?.id || "");
  // Misma base que el ganador: solo ronda final (no totales de todas las fases).
  const sourceContestants = finalResultContestants.value.length
    ? finalResultContestants.value
    : finalResultSourceContestants.value;
  const totalVotesForRanking = sourceContestants.reduce(
    (sum, contestant) => sum + Number(contestant.totalVotes || 0),
    0,
  );

  return sourceContestants
    .slice()
    .sort((current, next) => {
      if (winnerId) {
        if (String(current.artistId) === winnerId) return -1;
        if (String(next.artistId) === winnerId) return 1;
      }

      return Number(next.totalVotes || 0) - Number(current.totalVotes || 0);
    })
    .map((contestant, index) => {
      const votes = Number(contestant.totalVotes || 0);
      const percent = totalVotesForRanking
        ? (votes / totalVotesForRanking) * 100
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
    .filter((entry) => entry.artist);
});

const podiumEntries = computed(() => finalRankingEntries.value.slice(1, 3));
const secondaryFinalRankingEntries = computed(() =>
  finalRankingEntries.value.slice(1),
);

const shareFinalWinner = async (winner) => {
  shareMessage.value = "";
  errorMessage.value = "";

  const title = translate("polls.detail.shareFinalTitle", {
    name: winner.name,
    poll: poll.value?.title || translate("polls.detail.shareFinalPollFallback"),
  });
  const text = translate("polls.detail.shareFinalText", {
    name: winner.name,
  });
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

const formatCertificateDate = (value) => {
  const raw = value?.toDate?.() || (value ? new Date(value) : new Date());
  const date = Number.isNaN(raw.getTime()) ? new Date() : raw;
  const locale = i18n.global.locale.value === "en" ? "en" : "es";
  const parts = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value || "";
  const year = parts.find((part) => part.type === "year")?.value || "";
  return `${month} ${year}`.trim();
};

const openWinnerCertificate = (winnerEntry) => {
  const artist = winnerEntry?.artist || winnerEntry || {};
  certificateModal.value = {
    open: true,
    name: artist.name || translate("polls.detail.voteFallback"),
    group: getArtistGroup(artist),
    date: formatCertificateDate(poll.value?.endAt || poll.value?.updatedAt),
  };
};

const closeWinnerCertificate = () => {
  certificateModal.value = {
    ...certificateModal.value,
    open: false,
  };
};

watch(
  () => i18n.global.locale.value,
  () => {
    if (!certificateModal.value.open) {
      return;
    }
    certificateModal.value = {
      ...certificateModal.value,
      date: formatCertificateDate(poll.value?.endAt || poll.value?.updatedAt),
    };
  },
);

const buildSharePayload = () => {
  const pollTitle = poll.value?.title || translate("polls.detail.sharePoll");
  const year = Number(poll.value?.year || routeYear) || new Date().getFullYear();
  const title = `${pollTitle} ${year}`;
  const artistName =
    selectedVoteArtist.value?.name ||
    missionsPrompt.value?.contestant?.artist?.name ||
    "";
  const text = artistName
    ? translate("polls.detail.shareVoteTextArtist", {
        artist: artistName,
        title: pollTitle,
        year,
      })
    : translate("polls.detail.shareVoteText", {
        title: pollTitle,
        year,
      });
  const path = poll.value
    ? buildPollUrl(poll.value, i18n.global.locale.value)
    : window.location.pathname;
  // Facebook / redes no pueden leer localhost: siempre URL pública.
  const url = `${getPublicShareOrigin()}${path}${window.location.search || ""}`;
  const imageUrl = resolvePollShareImage(poll.value);
  return { title, text, url, imageUrl };
};

const syncPollShareMeta = () => {
  if (!poll.value) {
    return;
  }

  const { title, text, url, imageUrl } = buildSharePayload();
  applyShareMeta({
    title,
    description: text || poll.value.description || "",
    url,
    image: imageUrl,
  });
};

const sharePoll = async () => {
  shareMessage.value = "";
  errorMessage.value = "";

  const { title, text, url, imageUrl } = buildSharePayload();
  syncPollShareMeta();

  try {
    const mode = await shareWithOptionalImage({ title, text, url, imageUrl });
    if (mode === "unsupported") {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      shareMessage.value = translate("polls.detail.sharePollCopied");
      window.setTimeout(() => {
        shareMessage.value = "";
      }, 3000);
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }

    errorMessage.value = translate("polls.detail.sharePollError");
  }
};

const applyShareBoostPayload = (payload) => {
  if (!payload) return;
  shareBoostConfig.value = {
    enabled: payload.enabled !== false,
    multiplier: Math.max(2, Number(payload.multiplier || 2)),
    durationMinutes: Math.max(1, Number(payload.durationMinutes || 10)),
    oncePerDay: payload.oncePerDay === true,
  };
  shareBoostClaimedToday.value = Boolean(payload.claimedToday);
  shareBoostCanClaim.value =
    payload.canClaim !== undefined
      ? Boolean(payload.canClaim)
      : !(shareBoostConfig.value.oncePerDay && shareBoostClaimedToday.value);
  if (payload.active?.endsAt && Number(payload.active.endsAt) > Date.now()) {
    shareBoostActive.value = {
      multiplier: Math.max(2, Number(payload.active.multiplier || payload.multiplier || 2)),
      endsAt: Number(payload.active.endsAt),
    };
  } else {
    shareBoostActive.value = null;
  }
};

const releaseShareBoostIfExpired = () => {
  const endsAt = Number(shareBoostActive.value?.endsAt || 0);
  if (!endsAt || endsAt > Date.now()) {
    return;
  }
  // Terminó el tiempo del x2: se puede volver a activar (salvo 1 vez al día).
  shareBoostActive.value = null;
  if (!shareBoostConfig.value.oncePerDay) {
    shareBoostCanClaim.value = shareBoostConfig.value.enabled;
    shareBoostClaimedToday.value = false;
  } else {
    shareBoostCanClaim.value = !shareBoostClaimedToday.value;
  }
};

const loadShareVoteBoost = async () => {
  try {
    const anonymous = !currentUser.value || Boolean(currentUser.value?.isAnonymous);
    const payload = await getShareVoteBoost({ anonymous });
    applyShareBoostPayload(payload);
  } catch {
    // Keep defaults if boost status cannot be loaded.
  }
};

const claimShareBoostAfterShare = async (platform) => {
  if (!shareBoostConfig.value.enabled || isClaimingShareBoost.value) {
    return;
  }
  // Ya lo usó hoy (si oncePerDay) o no puede reclamar: no spamear el aviso
  // en cada share. El boost tiene duración; el contador/hint ya lo indica.
  if (!shareBoostCanClaim.value && !isShareBoostLive.value) {
    return;
  }
  // Mientras el x2 está activo (tiene tiempo restante), no reiniciar ni avisar.
  if (isShareBoostLive.value) {
    return;
  }

  isClaimingShareBoost.value = true;
  shareBoostMessage.value = "";
  try {
    const anonymous = !currentUser.value || Boolean(currentUser.value?.isAnonymous);
    const payload = await claimShareVoteBoost(platform, { anonymous });
    applyShareBoostPayload(payload);
    if (payload?.alreadyActive) {
      return;
    }
    shareBoostMessage.value = translate("polls.detail.shareBoostClaimed", {
      multiplier: payload?.multiplier || shareBoostConfig.value.multiplier,
    });
    window.setTimeout(() => {
      shareBoostMessage.value = "";
    }, 3500);
  } catch (error) {
    shareBoostMessage.value =
      error?.message || translate("polls.detail.shareBoostClaimError");
  } finally {
    isClaimingShareBoost.value = false;
  }
};

const sharePollOnNetwork = async (platform) => {
  shareMessage.value = "";
  errorMessage.value = "";
  const { title, text, url } = buildSharePayload();
  syncPollShareMeta();
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(`${text}\n${url}`);

  try {
    if (platform === "facebook") {
      // sharer.php con URL pública + quote para que no abra "Crear publicación" vacío.
      const facebookShareUrl =
        `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` +
        `&quote=${encodeURIComponent(text)}`;
      window.open(facebookShareUrl, "_blank", "noopener,noreferrer");
    } else if (platform === "whatsapp") {
      window.open(`https://wa.me/?text=${encodedText}`, "_blank", "noopener,noreferrer");
    } else if (platform === "telegram") {
      window.open(
        `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(text)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else if (platform === "twitter") {
      window.open(
        `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodedUrl}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else if (platform === "startly") {
      window.open(STARTLY_SHARE_URL, "_blank", "noopener,noreferrer");
    } else if (navigator.share) {
      await navigator.share({ title, text, url });
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      shareMessage.value = translate("polls.detail.sharePollCopied");
      window.setTimeout(() => {
        shareMessage.value = "";
      }, 3000);
    }

    await claimShareBoostAfterShare(platform === "more" ? "more" : platform);
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }
    errorMessage.value = translate("polls.detail.sharePollError");
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
    .map((artistId) => resolveArtist(artistId))
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
      const isCurrent = activeRound.value?.id === round.id;
      const isActive = isCurrent && isVotingOpen.value;
      const activeRoundIndex = rounds.value.findIndex(
        (item) => item.id === activeRound.value?.id,
      );
      const isBeforeActiveRound =
        activeRoundIndex > -1 && index < activeRoundIndex;
      const isFinalResultVisible = isClosed.value && round.status === "closed";

      return {
        ...round,
        number: index + 1,
        isCurrent,
        isActive,
        isVisible:
          isCurrent ||
          isActive ||
          isBeforeActiveRound ||
          isFinalResultVisible,
        winners: (round.winnerIds || [])
          .map((artistId) => resolveArtist(artistId))
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
const isSelectedFinalResultRound = computed(
  () =>
    Boolean(
      isClosed.value &&
        finalResultRound.value?.id &&
        selectedRoundId.value === finalRoundTabId,
    ),
);

const isViewingSelectedClosedRound = computed(
  () => selectedRoundStep.value?.status === "closed" && !isSelectedFinalResultRound.value,
);

const isViewingFinalResult = computed(
  () =>
    isClosed.value &&
    finalWinnerEntries.value.length > 0 &&
    (!selectedRoundId.value ||
      selectedRoundId.value === finalRoundTabId),
);

const selectedRoundWinnerNames = computed(() =>
  (selectedRoundStep.value?.winners || [])
    .map((winner) => winner?.name)
    .filter(Boolean),
);

const scrollToRoundDetail = async () => {
  await nextTick();
  roundDetailSection.value?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
};

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

  const roundParam = new URLSearchParams(window.location.search).get(
    roundQueryParam,
  );

  if (roundParam === "final" && isClosed.value) {
    selectedRoundId.value = finalRoundTabId;
    return;
  }

  const round = findRoundFromUrl();

  if (!round) {
    if (isClosed.value && finalWinnerEntries.value.length) {
      selectedRoundId.value = finalRoundTabId;
    }
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
  scrollToRoundDetail();
};

const selectFinalResultTab = async () => {
  selectedRoundId.value = finalRoundTabId;
  selectedRoundContestants.value = [];
  updateSelectedRoundUrl("final");
  await scrollToRoundDetail();
};

const shouldShowUpcomingRound = computed(() =>
  Boolean(
    !isClosed.value &&
    !isSelectingWinners.value &&
    rounds.value.length &&
    !rounds.value.some((round) => round.status === "live"),
  ),
);

const countdown = computed(() => {
  if (!pollEndDate.value) {
    return [
      { label: translate("polls.detail.time.days"), value: "00" },
      { label: translate("polls.detail.time.hours"), value: "00" },
      { label: translate("polls.detail.time.minutes"), value: "00" },
      { label: translate("polls.detail.time.seconds"), value: "00" },
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
    { label: translate("polls.detail.time.days"), value: formatValue(days) },
    { label: translate("polls.detail.time.hours"), value: formatValue(hours) },
    { label: translate("polls.detail.time.minutes"), value: formatValue(minutes) },
    { label: translate("polls.detail.time.seconds"), value: formatValue(seconds) },
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

  const optimisticTotal = getOptimisticVoteTotal(artistId);
  if (optimisticTotal && serverVoteTotalForArtist(artistId) < optimisticTotal) {
    return;
  }

  const nextTotals = { ...optimisticVoteTotals.value };
  delete nextTotals[artistId];
  optimisticVoteTotals.value = nextTotals;
};

const showVoteFeedback = (artistId, amount, { pending = false, duration = 2800, source = "own", flash = true } = {}) => {
  if (!artistId || amount <= 0) {
    return;
  }

  // Para bots / ráfagas grandes: no mostrar "+15.387", solo la sensación de voto.
  const displayAmount = amount > 5 ? 0 : amount;
  const existing = voteFeedbacks.value[artistId];
  const keepExistingToken =
    existing?.pending &&
    !pending &&
    existing?.source === source;

  window.clearTimeout(voteFeedbackTimers.get(artistId));
  voteFeedbacks.value = {
    ...voteFeedbacks.value,
    [artistId]: {
      amount: displayAmount,
      pending,
      source,
      token: keepExistingToken ? existing.token : Date.now(),
    },
  };
  voteFeedbackTimers.set(
    artistId,
    window.setTimeout(() => {
      const nextFeedbacks = { ...voteFeedbacks.value };
      delete nextFeedbacks[artistId];
      voteFeedbacks.value = nextFeedbacks;
      voteFeedbackTimers.delete(artistId);
    }, duration),
  );

  if (flash && source !== "own") {
    flashLiveVoteArtist(artistId);
  }

  if (source === "own") {
    markRecentOwnVote(artistId);
  }
};

const collectLiveVoteFlashTargets = (artistId) => {
  const normalized = String(artistId || "").trim();
  if (!normalized) {
    return new Set();
  }

  return new Set([normalized]);
};

const applyLiveVoteFlash = (targetIds, stamp = Date.now()) => {
  const nextFlashIds = { ...liveVoteFlashIds.value };

  targetIds.forEach((targetId) => {
    window.clearTimeout(liveVoteFlashTimers.get(targetId));
    nextFlashIds[targetId] = stamp;
    liveVoteFlashTimers.set(
      targetId,
      window.setTimeout(() => {
        const next = { ...liveVoteFlashIds.value };
        delete next[targetId];
        liveVoteFlashIds.value = next;
        liveVoteFlashTimers.delete(targetId);
      }, 2000),
    );
  });

  liveVoteFlashIds.value = nextFlashIds;
};

const flashLiveVoteArtist = (artistId, { force = false } = {}) => {
  const targets = collectLiveVoteFlashTargets(artistId);
  if (!targets.size) {
    return;
  }

  const nowMs = Date.now();
  const eligibleTargets = new Set();

  targets.forEach((targetId) => {
    const lastAt = lastLiveVoteFlashAt.get(targetId) || 0;
    if (force || nowMs - lastAt >= LIVE_VOTE_FLASH_COOLDOWN_MS) {
      eligibleTargets.add(targetId);
      lastLiveVoteFlashAt.set(targetId, nowMs);
    }
  });

  if (!eligibleTargets.size) {
    return;
  }

  applyLiveVoteFlash(eligibleTargets, nowMs);
};

const markRecentOwnVote = (artistId) => {
  const key = normalizeArtistKey(artistId);
  if (!key) {
    return;
  }

  recentOwnVoteArtists.add(key);
  window.setTimeout(() => {
    recentOwnVoteArtists.delete(key);
  }, RECENT_OWN_VOTE_WINDOW_MS);
};

const shouldSkipLiveVoteDeltaFlash = (payload = {}) => {
  const artistId = normalizeArtistKey(payload.artistId || payload.contestantId || "");
  if (!artistId) {
    return true;
  }

  if (recentOwnVoteArtists.has(artistId) || hasOwnVoteFeedback(artistId)) {
    return true;
  }

  const ownUserId =
    currentUser.value?.id !== undefined && currentUser.value?.id !== null
      ? String(currentUser.value.id)
      : "";
  if (
    ownUserId &&
    payload.userId !== undefined &&
    payload.userId !== null &&
    String(payload.userId) === ownUserId
  ) {
    return true;
  }

  const isAnonymousVote =
    payload.isAnonymous === true ||
    payload.isAnonymous === "1" ||
    payload.isAnonymous === 1;
  if (isAnonymousVote) {
    const pending = pendingAnonymousVoteFeedback.value;
    if (pending?.artistId && String(pending.artistId) === artistId) {
      return true;
    }
  }

  const lastAt = lastLiveVoteFlashAt.get(artistId) || 0;
  return Date.now() - lastAt < LIVE_VOTE_FLASH_COOLDOWN_MS;
};

const pushLiveVoteToast = (payload = {}) => {
  const artistId = String(payload.artistId || payload.contestantId || "");
  if (!artistId || shouldSkipLiveVoteDeltaFlash(payload)) {
    return;
  }

  lastLiveVoteToastAt = Date.now();
  flashLiveVoteArtist(artistId);
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

const animationDurationForVoteDelta = (from, to) =>
  Math.max(900, Math.min(2200, 700 + Math.abs(Number(to || 0) - Number(from || 0)) * 0.18));

const animateVoteCount = (artistId, from, to, duration = 720) => {
  animateNumber({
    from,
    to,
    duration,
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

const animateDisplayedTotalVotes = (from, to, duration = 720) => {
  animateNumber({
    from,
    to,
    duration,
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

const animateIncomingVoteTotals = (nextContestants) => {
  const currentRows = activeRoundContestantRows.value;

  if (!currentRows.length || !nextContestants.length) {
    return;
  }

  const previousByArtist = new Map(
    currentRows.map((contestant) => [
      getContestantArtistId(contestant),
      contestant,
    ]),
  );
  const previousVisibleTotal = displayTotalVotes.value;
  const nextTotal = nextContestants.reduce(
    (total, contestant) => total + Number(contestant.totalVotes || 0),
    0,
  );
  let changed = false;
  let longestDuration = 900;
  const flashTargets = new Set();

  nextContestants.forEach((contestant) => {
    const artistId = getContestantArtistId(contestant);
    const previous = previousByArtist.get(artistId);

    if (!artistId || !previous) {
      return;
    }

    const from = displayVoteCountFor(previous);
    const serverTo = Number(contestant.totalVotes || 0);
    const to = Math.max(serverTo, getOptimisticVoteTotal(artistId));

    // Results can arrive before Redis/DB reconciliation catches up with the optimistic
    // vote. Never animate downward in the live voting UI because it looks like votes
    // were removed; keep the current visible value until the server total catches up.
    if (from >= to) {
      return;
    }

    const duration = animationDurationForVoteDelta(from, to);
    longestDuration = Math.max(longestDuration, duration);
    changed = true;
    animateVoteCount(artistId, from, to, duration);
    flashTargets.add(artistId);
  });

  if (flashTargets.size) {
    const nowMs = Date.now();
    const eligibleTargets = new Set();

    flashTargets.forEach((targetId) => {
      const lastAt = lastLiveVoteFlashAt.get(targetId) || 0;
      if (nowMs - lastAt >= LIVE_VOTE_FLASH_COOLDOWN_MS) {
        eligibleTargets.add(targetId);
        lastLiveVoteFlashAt.set(targetId, nowMs);
      }
    });

    if (eligibleTargets.size) {
      applyLiveVoteFlash(eligibleTargets, nowMs);
    }
  }

  if (changed && previousVisibleTotal !== nextTotal) {
    animateDisplayedTotalVotes(previousVisibleTotal, nextTotal, longestDuration);
  }
};

const getRoundContestants = async (round) => {
  const selectedPollId = poll.value?.id || currentPollId.value;

  if (!selectedPollId || !round?.id) {
    return [];
  }

  const baseContestants = await loadContestantMetadata(
    db,
    selectedPollId,
    round.id,
  );
  let rows = baseContestants;

  // Los totales del poll no incluyen los votos que siguen en Redis; el endpoint
  // de resultados si, y es el mismo que consume la app.
  try {
    rows = mergeContestantsWithPublicResults(
      baseContestants,
      await getPollResults({ pollId: selectedPollId, roundId: round.id }),
    );
  } catch {
    // Sin resultados en vivo nos quedamos con los totales del poll.
  }

  return rows
    .map((contestant) => ({
      ...contestant,
      artist: contestant.artist || getArtist(getContestantArtistId(contestant)),
    }))
    .filter((contestant) => contestant.artist)
    .sort((current, next) => next.totalVotes - current.totalVotes);
};

const subscribeRealtime = (pollId) => {
  unsubscribeRealtime?.();
  unsubscribeRealtime = null;

  if (!pollId) {
    return;
  }

  unsubscribeRealtime = subscribePollRealtime(pollId, {
    onVoteDelta: (payload = {}) => {
      if (!payload || payload.staffVote === true || payload.staffVote === "1") {
        return;
      }
      if (payload.botCampaignId) {
        return;
      }

      const dirtyRoundId = payload.roundId ? String(payload.roundId) : "";
      const currentRoundId = activeRound.value?.id
        ? String(activeRound.value.id)
        : "";
      if (dirtyRoundId && currentRoundId && dirtyRoundId !== currentRoundId) {
        return;
      }

      pushLiveVoteToast(payload);
    },
    onResultsDirty: (event = {}) => {
      const dirtyRoundId = event.roundId ? String(event.roundId) : "";
      const currentRoundId = activeRound.value?.id ? String(activeRound.value.id) : "";
      if (dirtyRoundId && currentRoundId && dirtyRoundId !== currentRoundId) {
        return;
      }

      const nowMs = Date.now();
      if (nowMs - realtimeResultsThrottle < 800) {
        return;
      }
      realtimeResultsThrottle = nowMs;
      reloadPublicResults?.();
    },
    onPollStateChanged: (event = {}) => {
      if (
        event.reason === "versus_generated" &&
        (!event.roundId || String(event.roundId) === String(activeRound.value?.id || ""))
      ) {
        listeningContestantsKey = "";
        listenContestants(pollId, { clear: false });
        return;
      }

      const nowMs = Date.now();
      if (nowMs - realtimeStateThrottle < 2500) {
        return;
      }
      realtimeStateThrottle = nowMs;
      if (["round_launched", "round_finished", "round_status", "versus_generated"].includes(event.reason)) {
        listeningContestantsKey = "";
      }
      loadPoll({ silent: true });
    },
  });
};

const listenContestants = async (pollId, { clear = true } = {}) => {
  const roundId = activeRound.value?.id || null;
  const contestantsKey = `${pollId}:${roundId || "root"}`;

  if (listeningContestantsKey === contestantsKey && contestants.value.length) {
    isLoadingContestants.value = false;
    return;
  }

  unsubscribeContestants?.();
  unsubscribePublicResults?.();
  reloadPublicResults = null;
  listeningContestantsKey = contestantsKey;
  isLoadingContestants.value = true;
  if (clear) {
    contestants.value = [];
  }

  try {
    const baseContestants = await loadContestantMetadata(db, pollId, roundId);
    let latestPublicResults = null;

    if (listeningContestantsKey !== contestantsKey) {
      return;
    }

    const applyLatestResults = () => {
      if (listeningContestantsKey !== contestantsKey) {
        return;
      }

      const nextContestants = latestPublicResults
        ? mergeContestantsWithPublicResults(
            baseContestants,
            latestPublicResults,
          )
        : baseContestants;

      contestants.value = nextContestants;
      reconcileOptimisticVoteTotals(nextContestants);
      isLoadingContestants.value = false;
    };

    reloadPublicResults = async () => {
      try {
        const results = await getPollResults({ pollId, roundId });
        if (listeningContestantsKey !== contestantsKey) {
          return;
        }
        latestPublicResults = results;
        applyLatestResults();
      } catch {
        // El polling de respaldo recupera los resultados en el siguiente ciclo.
      }
    };

    if (activeRound.value?.type !== "versus") {
      contestants.value = baseContestants;
      reconcileOptimisticVoteTotals(baseContestants);
    }
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
        if (listeningContestantsKey === contestantsKey) {
          isLoadingContestants.value = false;
        }
      },
    });
  } catch {
    errorMessage.value = translate("polls.detail.contestantsError");
    if (listeningContestantsKey === contestantsKey) {
      isLoadingContestants.value = false;
    }
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
  finalOverallContestants.value = [];

  if (!currentPollId.value || !finalResultRound.value?.id) {
    return;
  }

  try {
    const winnerIds = (finalResultRound.value.winnerIds || []).map(String);
    const payload = await getPollResults({
      pollId: currentPollId.value,
      roundId: finalResultRound.value.id,
    });
    const ranked = Array.isArray(payload?.results) ? payload.results : [];

    finalResultContestants.value = ranked
      .map((row) => ({
        id: row.contestantId || row.id,
        artistId: row.artistId,
        artist:
          normalizeApiArtist(row.artist) ||
          getArtist(row.artistId) ||
          getPollArtist(row.artistId),
        votes: Number(row.votes || 0),
        manualVotes: Number(row.manualVotes || 0),
        totalVotes: Number(row.totalVotes || 0),
      }))
      .filter((contestant) => contestant.artist)
      .sort((current, next) => {
        const currentWinnerIndex = winnerIds.indexOf(String(current.artistId));
        const nextWinnerIndex = winnerIds.indexOf(String(next.artistId));
        const currentRank =
          currentWinnerIndex >= 0 ? currentWinnerIndex : Number.POSITIVE_INFINITY;
        const nextRank =
          nextWinnerIndex >= 0 ? nextWinnerIndex : Number.POSITIVE_INFINITY;

        if (currentRank !== nextRank) {
          return currentRank - nextRank;
        }

        return next.totalVotes - current.totalVotes;
      });
  } catch {
    finalResultContestants.value = [];
  }

  const totalsByArtist = new Map();
  const closedRounds = rounds.value.filter((round) => round.status === "closed");

  for (const round of closedRounds) {
    try {
      const roundContestants = await getRoundContestants(round);

      roundContestants.forEach((contestant) => {
        const artistId = getContestantArtistId(contestant);
        const currentTotal = totalsByArtist.get(artistId);
        const totalVotes =
          Number(currentTotal?.totalVotes || 0) + Number(contestant.totalVotes || 0);

        totalsByArtist.set(artistId, {
          ...contestant,
          artistId,
          totalVotes,
        });
      });
    } catch {
      // Si una fase no carga, seguimos mostrando las demas.
    }
  }

  finalOverallContestants.value = [...totalsByArtist.values()]
    .filter((contestant) => contestant.artist)
    .sort((current, next) => Number(next.totalVotes || 0) - Number(current.totalVotes || 0));
};

const listenRounds = (pollId) => {
  unsubscribeRounds?.();
  unsubscribeRounds = null;
  rounds.value = (poll.value?.rounds || []).map(normalizeApiRound);
  listenContestants(pollId);
  if (isClosed.value && !new URLSearchParams(window.location.search).get(roundQueryParam)) {
    selectedRoundId.value = finalRoundTabId;
  }
  syncSelectedRoundFromUrl();
  if (poll.value?.status === "closed") {
    loadFinalResultContestants();
  }
};

const loadArtists = async () => {
  artists.value = await getArtistsCached(db);
};

const loadPoll = async ({ silent = false } = {}) => {
  if (!silent || !poll.value) {
    isLoading.value = true;
  }
  errorMessage.value = "";

  try {
    const apiPoll = routeSlug
      ? await getPoll(routeSlug)
      : await getPolls(100).then((pollRows) =>
          pollRows.find((row) => row.type === "list" && (!row.year || Number(row.year) === routeYear)) ||
          pollRows.find((row) => row.type === "list") ||
          pollRows[0],
        );

    if (!apiPoll) {
      errorMessage.value = translate("polls.detail.notFound");
      poll.value = null;
      currentPollId.value = "";
      return;
    }

    const pollDetail = apiPoll.rounds ? apiPoll : await getPoll(apiPoll.slug || apiPoll.id);
    poll.value = normalizeApiPoll(pollDetail);
    currentPollId.value = poll.value.id;
    syncPollShareMeta();
    if (currentUser.value && !currentUser.value.isAnonymous) {
      reportMissionPollView().catch(() => {});
    }
    unsubscribePoll = null;
    listenRounds(poll.value.id);
    subscribeRealtime(poll.value.id);
    loadArtists().catch(() => {});
  } catch {
    errorMessage.value = translate("polls.detail.loadError");
  } finally {
    if (!silent || !poll.value) {
      isLoading.value = false;
    }
  }
};

const listenUserPoints = (user) => {
  unsubscribeUserPoints?.();
  unsubscribeUserPoints = null;
  userPoints.value = user && !user.isAnonymous ? Number(user.points || 0) : 0;
};

const animateUserPoints = (to) => {
  const target = Number(to || 0);
  const from = Number(displayUserPoints.value || 0);

  if (userPointsAnimationFrame) {
    window.cancelAnimationFrame(userPointsAnimationFrame);
    userPointsAnimationFrame = null;
  }

  if (from === target) {
    displayUserPoints.value = target;
    return;
  }

  const duration = Math.min(1200, Math.max(520, Math.abs(target - from) * 10));
  const startedAt = performance.now();

  const step = (nowTs) => {
    const progress = Math.min(1, (nowTs - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    displayUserPoints.value = Math.round(from + (target - from) * eased);

    if (progress < 1) {
      userPointsAnimationFrame = window.requestAnimationFrame(step);
      return;
    }

    displayUserPoints.value = target;
    userPointsAnimationFrame = null;
  };

  userPointsAnimationFrame = window.requestAnimationFrame(step);
};

watch(userPoints, (next) => {
  animateUserPoints(next);
});

const refreshUserPoints = async () => {
  if (!currentUser.value || currentUser.value.isAnonymous) {
    return;
  }

  try {
    const me = await getMe();
    if (me) {
      currentUser.value = { ...currentUser.value, ...me };
      userPoints.value = Number(me.points || 0);
    }
  } catch {
    // Si falla, se mantiene el saldo local hasta el siguiente intento.
  }
};

const syncStoredPoints = (points, spentPoints) => {
  const nextPoints = Number(points || 0);
  userPoints.value = nextPoints;

  if (currentUser.value && !currentUser.value.isAnonymous) {
    currentUser.value = {
      ...currentUser.value,
      points: nextPoints,
      ...(spentPoints === undefined || spentPoints === null
        ? {}
        : { spentPoints: Number(spentPoints) }),
    };
  }

  const stored = getStoredAuth();
  if (stored?.user && !stored.user.isAnonymous) {
    setStoredAuth({
      ...stored,
      user: {
        ...stored.user,
        points: nextPoints,
        ...(spentPoints === undefined || spentPoints === null
          ? {}
          : { spentPoints: Number(spentPoints) }),
      },
    });
  }
};

const refreshAnonymousVoteStatuses = async () => {
  if (!poll.value?.id || !needsFreeVoteCooldown.value) {
    anonymousVoteStatuses.value = {};
    return;
  }

  // Show stored wait time immediately when the user comes back to the page.
  hydrateAnonymousCooldownsFromStorage();
  isLoadingAnonymousStatus.value = true;

  const useAnonymousToken =
    !currentUser.value || Boolean(currentUser.value.isAnonymous);

  try {
    const statuses = await Promise.all(
      anonymousVoteScopes.value.map(async (scope) => {
        const result = await getAnonymousVoteStatus(
          {
            pollId: poll.value.id,
            roundId: activeRound.value?.id || null,
            voteScope: scope === anonymousDefaultScope ? null : scope,
          },
          { anonymous: useAnonymousToken },
        );

        return [
          scope,
          mergeAnonymousStatus(result?.status || result || null, scope),
        ];
      }),
    );

    anonymousVoteStatuses.value = Object.fromEntries(statuses);
  } catch {
    hydrateAnonymousCooldownsFromStorage();
  } finally {
    isLoadingAnonymousStatus.value = false;
  }
};

const ensureAnonymousUser = async () => {
  if (currentUser.value) {
    return currentUser.value;
  }

  return { isAnonymous: true, id: "anonymous" };
};

const callAnonymousVoteEndpoint = async (payload) => {
  try {
    return await castApiVote(payload, { anonymous: true });
  } catch (error) {
    error.code = error.status === 429
      ? "resource-exhausted"
      : error.status === 401
        ? "unauthenticated"
        : error.status === 400
          ? "invalid-argument"
          : "internal";
    error.details = error.payload || null;
    throw error;
  }
};

const voteButtonLabel = (contestant) => {
  if (isVoting.value === getContestantArtistId(contestant)) {
    return translate("polls.detail.voting");
  }

  const useFreeVoteLabel =
    !currentUser.value ||
    currentUser.value.isAnonymous ||
    (isLoggedOutOfPoints.value && anonymousVotingConfig.value.enabled);

  if (useFreeVoteLabel) {
    if (
      isLoggedOutOfPoints.value &&
      !anonymousVotingConfig.value.enabled
    ) {
      return translate("polls.detail.noPoints");
    }

    const scope = getAnonymousVoteScope(contestant);

    return anonymousRemainingMsForScope(scope) > 0
      ? translate("polls.detail.voteCountdown", {
          time: anonymousCooldownLabelForScope(scope),
        })
      : translate("polls.detail.freeVote");
  }

  return translate("polls.detail.vote");
};

const closeVoteModal = () => {
  if (turnstileWidgetId !== null) {
    removeTurnstileWidget(turnstileWidgetId);
    turnstileWidgetId = null;
  }
  turnstileToken.value = "";
  turnstileError.value = "";
  voteModalContestant.value = null;
  voteAmount.value = 1;
  shareBoostMessage.value = "";
};

const resetVisibleTurnstile = () => {
  turnstileToken.value = "";
  turnstileError.value = "";
  if (turnstileWidgetId !== null) {
    resetTurnstileWidget(turnstileWidgetId);
  }
};

const revealAnonymousVoteSuccess = () => {
  const pending = pendingAnonymousVoteFeedback.value;
  if (!pending?.artistId) {
    return;
  }

  pendingAnonymousVoteFeedback.value = null;
  showVoteFeedback(pending.artistId, 1, { duration: 6500 });
  anonymousVoteSuccessToast.value = {
    artistName: pending.artistName,
    token: Date.now(),
  };

  nextTick(() => {
    document
      .querySelector(`[data-artist-id="${pending.artistId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    postEmbedHeight();
  });

  window.clearTimeout(anonymousVoteToastTimer);
  anonymousVoteToastTimer = window.setTimeout(() => {
    anonymousVoteSuccessToast.value = null;
  }, 5500);
};

const closeSignupPrompt = () => {
  isSignupPromptOpen.value = false;
  revealAnonymousVoteSuccess();
  nextTick(postEmbedHeight);
};

const registerUrl = computed(() => `${window.location.origin}/registro`);
const isLoggedFan = computed(
  () => Boolean(currentUser.value) && !currentUser.value?.isAnonymous,
);
const embedUserName = computed(
  () =>
    currentUser.value?.displayName ||
    currentUser.value?.email ||
    translate("polls.detail.embedLoggedFallback"),
);
const embedUserInitial = computed(
  () => embedUserName.value.trim().charAt(0).toUpperCase() || "F",
);

const openVoteModal = (contestant) => {
  errorMessage.value = "";
  anonymousCooldownNotice.value = "";

  if (!currentUser.value && !anonymousVotingConfig.value.enabled) {
    errorMessage.value = translate("polls.detail.loginToVote");
    return;
  }

  if (!poll.value?.id || !isVotingOpen.value) {
    errorMessage.value = translate("polls.detail.closedVoting");
    return;
  }

  if (!isActiveRoundOpen.value) {
    errorMessage.value = "La ronda no está abierta.";
    return;
  }

  if (!currentUser.value || currentUser.value.isAnonymous) {
    const scope = getAnonymousVoteScope(contestant);

    if (!canUseAnonymousVoteForScope(scope)) {
      showAnonymousCooldownNotice(contestant);
      return;
    }

    voteModalContestant.value = contestant;
    voteAmount.value = 1;
    loadShareVoteBoost();
    loadAppDownloadPromptConfig();
    return;
  }

  if (Number(userPoints.value || 0) >= pointsPerVote.value) {
    voteModalContestant.value = contestant;
    voteAmount.value = Math.min(1, maxVoteAmount.value);
    loadShareVoteBoost();
    return;
  }

  if (!anonymousVotingConfig.value.enabled) {
    errorMessage.value = translate("polls.detail.notEnoughPoints");
    return;
  }

  const scope = getAnonymousVoteScope(contestant);
  if (!canUseAnonymousVoteForScope(scope)) {
    showAnonymousCooldownNotice(contestant);
    return;
  }

  voteModalContestant.value = contestant;
  voteAmount.value = 1;
  loadShareVoteBoost();
  loadAppDownloadPromptConfig();
};

const setVoteAmountToMax = () => {
  setVoteAmount(maxVoteAmount.value);
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

  const voteScope = getAnonymousVoteScope(contestant);

  if (anonymousRemainingMsForScope(voteScope) > 0) {
    showAnonymousCooldownNotice(contestant);
    return;
  }

  const artistId = getContestantArtistId(contestant);
  const currentContestant = displayedContestants.value.find(
    (item) => getContestantArtistId(item) === artistId,
  );
  const currentVotes = displayVoteCountFor(currentContestant || contestant);

  try {
    const anonymousUser = await ensureAnonymousUser();

    if (!anonymousUser.isAnonymous) {
      currentUser.value = anonymousUser;
      await voteFor(contestant, 1);
      return;
    }

    isVoting.value = artistId;

    const result = await callAnonymousVoteEndpoint({
      pollId: poll.value.id,
      roundId: activeRound.value?.id || null,
      artistId,
      voteScope: voteScope === anonymousDefaultScope ? null : voteScope,
      turnstileToken: turnstileToken.value || undefined,
    });

    const nextStatus = mergeAnonymousStatus(
      result?.status || {
        enabled: true,
        cooldownMinutes: anonymousVotingConfig.value.cooldownMinutes,
        remainingMs: anonymousVotingConfig.value.cooldownMinutes * 60 * 1000,
        nextVoteAt: new Date(
          Date.now() + anonymousVotingConfig.value.cooldownMinutes * 60 * 1000,
        ).toISOString(),
      },
      voteScope,
    );
    anonymousVoteStatuses.value = {
      ...anonymousVoteStatuses.value,
      [voteScope]: nextStatus,
    };
    // Anonymous votes are sent immediately, so this visual update only happens after
    // the backend confirms the vote. That keeps the UI from bouncing on rejected votes.
    setOptimisticVoteTotal(artistId, currentVotes + 1);
    pendingAnonymousVoteFeedback.value = {
      artistId,
      artistName:
        contestant.artist?.name || translate("polls.detail.voteFallback"),
    };
    resetVisibleTurnstile();
    closeVoteModal();
    isSignupPromptOpen.value = true;
    nextTick(postEmbedHeight);
  } catch (error) {
    if (
      error.status === 429 ||
      error.code === "functions/resource-exhausted" ||
      error.code === "resource-exhausted"
    ) {
      const details = error.payload || error.details || {};
      anonymousVoteStatuses.value = {
        ...anonymousVoteStatuses.value,
        [voteScope]: mergeAnonymousStatus(
          {
            ...(anonymousVoteStatuses.value[voteScope] || {}),
            enabled: true,
            cooldownMinutes: anonymousVotingConfig.value.cooldownMinutes,
            nextVoteAt: details.nextVoteAt || null,
            remainingMs: Number(details.remainingMs || 0),
          },
          voteScope,
        ),
      };
      showAnonymousCooldownNotice(contestant);
      return;
    }

    if (
      error.code === "functions/failed-precondition" ||
      error.code === "failed-precondition" ||
      error.code === "functions/unauthenticated" ||
      error.code === "unauthenticated" ||
      error.code === "functions/invalid-argument" ||
      error.code === "invalid-argument"
    ) {
      errorMessage.value =
        error.message ||
        `${translate("polls.detail.anonymousVoteError")} (${error.code})`;
      return;
    }

    errorMessage.value = translate("polls.detail.anonymousVoteError");
  } finally {
    isVoting.value = "";
  }
};

const voteFor = async (contestant, amount = 1) => {
  errorMessage.value = "";
  const votingUser = currentUser.value;

  if (!votingUser || votingUser.isAnonymous) {
    await voteAnonymouslyFor(contestant);
    return;
  }

  currentUser.value = votingUser;

  if (!poll.value?.id || !isVotingOpen.value) {
    errorMessage.value = translate("polls.detail.closedVoting");
    return;
  }

  const votesToAdd = Math.floor(Number(amount || 1));
  const pointsToSpend = votesToAdd * pointsPerVote.value;

  if (!Number.isInteger(votesToAdd) || votesToAdd < 1) {
    errorMessage.value = translate("polls.detail.voteAmountRequired");
    return;
  }

  if (Number(userPoints.value || 0) < pointsToSpend) {
    if (
      votesToAdd === 1 &&
      anonymousVotingConfig.value.enabled &&
      isLoggedOutOfPoints.value
    ) {
      await voteLoggedFreeFor(contestant);
      return;
    }
    errorMessage.value = translate("polls.detail.notEnoughPoints");
    return;
  }

  try {
    const artistId = getContestantArtistId(contestant);

    isVoting.value = artistId;
    voteQueue.enqueue({
      pollId: poll.value.id,
      roundId: activeRound.value?.id || null,
      artistId,
      contestantId: contestant.id,
      userId: votingUser.id,
      userDisplayName:
        votingUser.displayName || votingUser.email || "",
      userPhotoURL: votingUser.photoUrl || votingUser.photoURL || "",
      amount: votesToAdd,
      pointsPerVote: pointsPerVote.value,
      anonymous: false,
      shardCount: shardCountForConcurrency(100000),
    });
    // Registered votes are queued/batched. We wait for onBatchCommitted before moving
    // the visible counters, so numbers never jump up and then down during reconciliation.
    showVoteFeedback(artistId, votesToAdd, {
      pending: true,
      flash: false,
      duration: Math.min(15000, 2600 + Math.ceil(votesToAdd / 1000) * 1200),
    });
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

const voteLoggedFreeFor = async (contestant) => {
  if (!anonymousVotingConfig.value.enabled) {
    errorMessage.value = translate("polls.detail.notEnoughPoints");
    return;
  }

  const voteScope = getAnonymousVoteScope(contestant);

  if (anonymousRemainingMsForScope(voteScope) > 0) {
    showAnonymousCooldownNotice(contestant);
    return;
  }

  const artistId = getContestantArtistId(contestant);
  const currentContestant = displayedContestants.value.find(
    (item) => getContestantArtistId(item) === artistId,
  );
  const currentVotes = displayVoteCountFor(currentContestant || contestant);

  try {
    isVoting.value = artistId;

    const result = await castApiVote(
      {
        pollId: poll.value.id,
        roundId: activeRound.value?.id || null,
        artistId,
        contestantId: contestant.id,
        amount: 1,
        voteScope: voteScope === anonymousDefaultScope ? null : voteScope,
      },
      { anonymous: false },
    );

    const nextStatus = mergeAnonymousStatus(
      result?.status || {
        enabled: true,
        cooldownMinutes: anonymousVotingConfig.value.cooldownMinutes,
        remainingMs: anonymousVotingConfig.value.cooldownMinutes * 60 * 1000,
        nextVoteAt: new Date(
          Date.now() + anonymousVotingConfig.value.cooldownMinutes * 60 * 1000,
        ).toISOString(),
      },
      voteScope,
    );
    anonymousVoteStatuses.value = {
      ...anonymousVoteStatuses.value,
      [voteScope]: nextStatus,
    };

    if (result?.user?.points !== undefined && result?.user?.points !== null) {
      syncStoredPoints(result.user.points, result.user.spentPoints);
    }

    setOptimisticVoteTotal(artistId, currentVotes + 1);
    showVoteFeedback(artistId, 1);
    closeVoteModal();
    scheduleMissionsPromptAfterFreeVote(contestant);
  } catch (error) {
    const details = error?.payload || error?.details || {};
    const nested =
      details?.message && typeof details.message === "object"
        ? details.message
        : details;
    const remainingMs = Number(nested?.remainingMs || 0);
    const nextVoteAt = nested?.nextVoteAt || null;

    if (error?.status === 429 || remainingMs > 0 || nextVoteAt) {
      anonymousVoteStatuses.value = {
        ...anonymousVoteStatuses.value,
        [voteScope]: mergeAnonymousStatus(
          {
            ...(anonymousVoteStatuses.value[voteScope] || {}),
            enabled: true,
            cooldownMinutes: anonymousVotingConfig.value.cooldownMinutes,
            nextVoteAt,
            remainingMs,
          },
          voteScope,
        ),
      };
      showAnonymousCooldownNotice(contestant);
      closeVoteModal();
      return;
    }

    errorMessage.value =
      error?.message || translate("polls.detail.anonymousVoteError");
    if (/esperar|wait to vote|resource-exhausted/i.test(String(errorMessage.value))) {
      errorMessage.value = "";
      showAnonymousCooldownNotice(contestant);
    }
  } finally {
    isVoting.value = "";
  }
};

const confirmVoteAmount = () => {
  if (!voteModalContestant.value) {
    return;
  }

  if (isAnonymousVotingFlow.value) {
    if (shouldShowTurnstile.value && !turnstileToken.value) {
      turnstileError.value = "Marca la verificación anti-bots antes de votar.";
      return;
    }
    voteFor(voteModalContestant.value, 1);
    return;
  }

  setVoteAmount(voteAmount.value);
  voteFor(voteModalContestant.value, normalizedVoteAmount.value);
};

watch(
  () => [
    currentUser.value?.id,
    poll.value?.id,
    activeRound.value?.id,
    anonymousVoteScopes.value.join("|"),
    isLoggedOutOfPoints.value,
  ],
  () => {
    refreshAnonymousVoteStatuses();
    nextTick(postEmbedHeight);
  },
);

watch(
  () => anonymousRemainingMs.value,
  (remainingMs) => {
    if (remainingMs <= 0) {
      anonymousCooldownNotice.value = "";
    }
  },
);

watch(
  () => shouldShowTurnstile.value,
  (enabled) => {
    if (enabled) {
      renderVisibleTurnstile();
      return;
    }

    if (turnstileWidgetId !== null) {
      removeTurnstileWidget(turnstileWidgetId);
      turnstileWidgetId = null;
    }
    turnstileToken.value = "";
    turnstileError.value = "";
  },
  { flush: "post" },
);

watch(
  () => voteModalContestant.value,
  (contestant) => {
    if (contestant && shouldShowTurnstile.value) {
      renderVisibleTurnstile();
    }
  },
  { flush: "post" },
);

watch(
  () => activeRound.value?.id,
  (nextRoundId, prevRoundId) => {
    if (!currentPollId.value || nextRoundId === prevRoundId) {
      return;
    }

    // La ronda activa cambio (admin lanzo otra ronda o avanzo de fase):
    // recargamos participantes y resultados de la nueva ronda sin recargar la pagina.
    listeningContestantsKey = "";
    listenContestants(currentPollId.value);

    if (poll.value?.status === "closed") {
      loadFinalResultContestants();
    }

    nextTick(postEmbedHeight);
  },
);

onMounted(() => {
  voteQueue = createVoteQueue({
    db,
    onBatchCommitted: (batch, result) => {
      applyCommittedVotes(batch, result);
    },
    onError: (error, batches = [], progress = {}) => {
      if (progress.partialApplied > 0) {
        batches.forEach((batch) => {
          applyCommittedVotes(batch, { amount: progress.partialApplied });
        });
      }

      batches.forEach((batch) => {
        if (progress.partialApplied > 0) {
          return;
        }

        clearOptimisticVoteTotal(batch.artistId);
        clearAnimatedVoteCount(batch.artistId);
        window.clearTimeout(voteFeedbackTimers.get(batch.artistId));
        voteFeedbackTimers.delete(batch.artistId);
        const nextFeedbacks = { ...voteFeedbacks.value };
        delete nextFeedbacks[batch.artistId];
        voteFeedbacks.value = nextFeedbacks;
      });
      clearAnimatedDisplayedTotalVotes();
      errorMessage.value =
        error.message === "not-enough-points"
          ? translate("polls.detail.notEnoughPoints")
          : progress.partialApplied > 0
            ? translate("polls.detail.batchVotePartial", {
                applied: progress.partialApplied.toLocaleString("es"),
              })
            : translate("polls.detail.batchVoteError");
    },
  });
  const syncAuth = (authState = getCurrentApiAuth()) => {
    currentUser.value = authState?.user || null;
    listenUserPoints(currentUser.value);
    refreshUserPoints();
  };
  syncAuth();
  unsubscribeAuth = onStoredAuthChange(syncAuth);
  clockTimer = window.setInterval(() => {
    now.value = Date.now();
    releaseShareBoostIfExpired();
  }, 1000);
  document.addEventListener("visibilitychange", handleAnonymousVisibilityRefresh);
  window.addEventListener("focus", handleAnonymousVisibilityRefresh);
  applyEmbeddedNoScroll();
  loadPoll();
  loadShareVoteBoost();
  secondarySectionsTimer = window.setTimeout(() => {
    showSecondarySections.value = true;
  }, 700);
  startEmbedHeightSync();
});

onUnmounted(() => {
  unsubscribeAuth?.();
  unsubscribePoll?.();
  unsubscribeContestants?.();
  unsubscribePublicResults?.();
  unsubscribeRealtime?.();
  unsubscribeRounds?.();
  unsubscribeUserPoints?.();
  embedResizeObserver?.disconnect();
  voteFeedbackTimers.forEach((timer) => window.clearTimeout(timer));
  voteFeedbackTimers.clear();
  liveVoteFlashTimers.forEach((timer) => window.clearTimeout(timer));
  liveVoteFlashTimers.clear();
  lastLiveVoteFlashAt.clear();
  recentOwnVoteArtists.clear();
  liveVoteFlashIds.value = {};
  window.clearTimeout(anonymousVoteToastTimer);
  window.clearTimeout(missionsPromptTimer);
  voteCountAnimationTimers.forEach((timer) => window.clearInterval(timer));
  voteCountAnimationTimers.clear();
  clearAnimatedDisplayedTotalVotes();
  if (userPointsAnimationFrame) {
    window.cancelAnimationFrame(userPointsAnimationFrame);
  }
  voteQueue?.flush().catch(() => {});
  voteQueue?.dispose();
  if (turnstileWidgetId !== null) {
    removeTurnstileWidget(turnstileWidgetId);
    turnstileWidgetId = null;
  }
  restoreEmbeddedNoScroll();
  document.removeEventListener("visibilitychange", handleAnonymousVisibilityRefresh);
  window.removeEventListener("focus", handleAnonymousVisibilityRefresh);
  window.clearInterval(clockTimer);
  window.clearTimeout(secondarySectionsTimer);
});
</script>

<template>
  <section
    class="mx-auto"
    :class="
      isEmbeddedPage
        ? 'embed-surface dark-surface max-w-5xl px-2 py-2 text-white sm:px-4 sm:py-3'
        : 'max-w-352 px-4 pb-16 sm:px-6'
    "
  >
    <div
      v-if="isLoading && !isEmbeddedPage"
      class="space-y-6"
    >
      <section class="relative overflow-hidden rounded-4xl border border-fuchsia-300/15 bg-[#080a18]/90 p-5 shadow-2xl shadow-fuchsia-950/20 sm:p-7">
        <div class="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-fuchsia-500/15 blur-3xl"></div>
        <div class="pointer-events-none absolute -bottom-24 right-0 size-80 rounded-full bg-cyan-400/10 blur-3xl"></div>
        <div class="relative grid gap-5">
          <div>
            <span class="block h-4 w-36 animate-pulse rounded-full bg-fuchsia-300/20"></span>
            <span class="mt-4 block h-9 max-w-xl animate-pulse rounded-2xl bg-white/12"></span>
          </div>
          <div class="grid grid-cols-4 gap-2 sm:max-w-2xl">
            <span
              v-for="item in 4"
              :key="`poll-loader-time-${item}`"
              class="grid h-16 animate-pulse place-items-center rounded-2xl border border-white/10 bg-white/6 sm:h-20"
            ></span>
          </div>
        </div>
      </section>

      <section class="rounded-4xl border border-white/10 bg-white/5 p-4 sm:p-5">
        <div class="flex items-center justify-between gap-4">
          <span class="block h-4 w-40 animate-pulse rounded-full bg-cyan-300/20"></span>
          <span class="block h-3 w-28 animate-pulse rounded-full bg-white/10"></span>
        </div>
        <div class="mt-5 flex gap-4 overflow-hidden">
          <div
            v-for="step in 3"
            :key="`poll-loader-round-${step}`"
            class="flex w-40 shrink-0 flex-col items-center rounded-3xl border border-white/10 bg-slate-950/35 px-3 py-4"
          >
            <span class="grid size-14 animate-pulse place-items-center rounded-full bg-amber-300/15"></span>
            <span class="mt-3 h-4 w-20 animate-pulse rounded-full bg-white/12"></span>
            <span class="mt-2 h-3 w-16 animate-pulse rounded-full bg-amber-300/15"></span>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <article
          v-for="item in 4"
          :key="`poll-loader-contestant-${item}`"
          class="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5"
        >
          <div class="flex items-center gap-4">
            <span class="size-20 shrink-0 animate-pulse rounded-3xl bg-linear-to-br from-violet-500/25 to-fuchsia-500/25 sm:size-24"></span>
            <span class="min-w-0 flex-1">
              <span class="block h-6 max-w-xs animate-pulse rounded-xl bg-white/12"></span>
              <span class="mt-3 block h-3 max-w-sm animate-pulse rounded-full bg-white/8"></span>
              <span class="mt-4 block h-3 animate-pulse rounded-full bg-white/10"></span>
            </span>
            <span class="hidden h-12 w-28 animate-pulse rounded-2xl bg-fuchsia-400/15 sm:block"></span>
          </div>
        </article>
      </section>
    </div>

    <div
      v-else-if="isLoading && isEmbeddedPage"
      class="embed-loader-card relative grid min-h-90 place-items-center overflow-hidden rounded-4xl border border-violet-300/20 bg-[#080a18] p-6 text-center text-white shadow-2xl shadow-fuchsia-950/25"
    >
      <div
        class="pointer-events-none absolute -left-16 -top-16 size-52 rounded-full bg-fuchsia-500/18 blur-3xl"
      ></div>
      <div
        class="pointer-events-none absolute -bottom-20 right-8 size-60 rounded-full bg-cyan-400/12 blur-3xl"
      ></div>
      <div class="relative z-10 w-full max-w-sm">
        <div
          class="embed-loader-icon mx-auto flex size-20 items-end justify-center gap-1.5 rounded-3xl border border-white/10 bg-white/8 px-4 py-4 shadow-2xl shadow-fuchsia-950/40"
          aria-hidden="true"
        >
          <span class="embed-loader-bar h-6 w-2 rounded-full bg-cyan-300"></span>
          <span class="embed-loader-bar h-10 w-2 rounded-full bg-fuchsia-300"></span>
          <span class="embed-loader-bar h-8 w-2 rounded-full bg-violet-300"></span>
          <span class="embed-loader-bar h-12 w-2 rounded-full bg-pink-300"></span>
        </div>
        <p
          class="mt-5 text-xs font-black uppercase tracking-[0.28em] text-fuchsia-200"
        >
          {{ $t("polls.detail.loading") }}
        </p>
        <div class="mt-5 space-y-3">
          <span class="block h-4 rounded-full bg-white/10"></span>
          <span class="mx-auto block h-4 w-3/4 rounded-full bg-white/8"></span>
          <span class="mx-auto block h-11 w-1/2 rounded-2xl bg-white/10"></span>
        </div>
      </div>
    </div>

    <div
      v-else-if="errorMessage && !poll"
      class="rounded-3xl border border-red-300/20 bg-red-500/10 p-8 text-center text-sm font-bold text-red-200"
    >
      {{ errorMessage }}
    </div>

    <section
      v-else-if="isCounterEmbed"
      class="relative overflow-hidden rounded-4xl border border-violet-300/20 bg-[#080a18] p-5 text-white shadow-2xl shadow-fuchsia-950/25 sm:p-6"
    >
      <div
        class="pointer-events-none absolute -left-16 -top-20 size-56 rounded-full bg-fuchsia-500/16 blur-3xl"
      ></div>
      <div
        class="pointer-events-none absolute -bottom-20 right-0 size-64 rounded-full bg-cyan-400/12 blur-3xl"
      ></div>
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(217,70,239,0.14),transparent_35%)]"
      ></div>

      <div class="relative z-10">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <p
              class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-200"
            >
              {{ $t("polls.detail.liveCountdown") }}
            </p>
            <h2 class="mt-2 truncate text-2xl font-black sm:text-3xl">
              {{ activeRound?.title || poll?.title || "Votación" }}
            </h2>
          </div>
          <span
            class="self-start rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-cyan-100 sm:self-auto"
          >
            {{ hasEnded ? $t("polls.detail.finished") : $t("polls.detail.countdownTitle") }}
          </span>
        </div>

        <div class="mt-5 grid grid-cols-4 gap-2 sm:gap-3">
          <div
            v-for="item in countdown"
            :key="`counter-${item.label}`"
            class="rounded-2xl border border-white/10 bg-slate-950/65 p-3 text-center shadow-lg shadow-black/20"
          >
            <p class="text-2xl font-black text-white sm:text-4xl">
              {{ item.value }}
            </p>
            <p
              class="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400"
            >
              {{ item.label }}
            </p>
          </div>
        </div>

        <div class="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
          <span
            class="counter-embed-bar block h-full rounded-full bg-linear-to-r from-cyan-300 via-fuchsia-300 to-violet-400"
          ></span>
        </div>
      </div>
    </section>

    <template v-else>
      <article
        v-if="!isEmbeddedPage"
        class="overflow-hidden rounded-4xl border border-violet-300/20 bg-[#080a18] shadow-2xl shadow-fuchsia-950/25"
      >
        <div class="relative bg-linear-to-br from-violet-950 to-fuchsia-950">
          <img
            v-if="poll?.banner"
            :src="poll.banner"
            :alt="poll.title"
            class="block max-h-[60vh] w-full object-cover sm:max-h-none sm:h-auto"
          />
          <div
            v-else
            class="min-h-64 sm:min-h-80"
            aria-hidden="true"
          ></div>
          <div
            class="absolute inset-0 bg-linear-to-t from-[#080a18] via-[#080a18]/80 to-[#080a18]/35 sm:via-[#080a18]/50 sm:to-black/20"
          ></div>
          <div class="absolute inset-x-0 bottom-0 p-4 sm:p-8">
            <p
              class="text-[10px] font-black uppercase tracking-[0.28em] text-fuchsia-300 sm:text-xs sm:tracking-[0.3em]"
            >
              {{ $t("polls.detail.liveEyebrow") }}
            </p>
            <h1
              class="mt-2 text-2xl font-black leading-tight text-white sm:mt-3 sm:text-6xl sm:leading-none"
            >
              {{ poll?.title }}
            </h1>
            <div
              v-if="hasPollDescription"
              class="poll-rich-text mt-3 max-w-3xl text-xs font-medium leading-6 text-slate-200/95 sm:mt-4 sm:text-base sm:leading-7"
              v-html="pollDescriptionHtml"
            ></div>
          </div>
        </div>
      </article>

      <div
        v-if="!isEmbeddedPage && hasPollBody"
        class="mt-6 rounded-4xl border border-white/10 bg-white/5 p-5 sm:p-6"
      >
        <div
          class="poll-rich-text text-sm leading-7 text-slate-300 sm:text-base"
          v-html="pollBodyHtml"
        ></div>
      </div>

      <div v-if="!isEmbeddedPage && !hideCountdown" class="mt-6 flex justify-center">
        <div
          class="grid w-full max-w-2xl grid-cols-4 gap-2 rounded-3xl border border-white/10 bg-white/5 p-4"
        >
          <div class="col-span-4 mb-1 text-center">
            <p class="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              {{ hasEnded ? $t("polls.detail.finished") : $t("polls.detail.countdownTitle") }}
            </p>
          </div>
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
        v-if="!isEmbeddedPage && roundSteps.length"
        class="mt-6 rounded-4xl border border-white/10 bg-white/5 p-4 sm:p-5"
      >
        <div class="flex items-center justify-between gap-4">
          <p
            class="text-xs font-black uppercase tracking-[0.28em] text-cyan-300"
          >
            {{ $t("polls.detail.roundsProcess") }}
          </p>
          <p class="text-xs font-bold text-slate-500">
            {{ $t("polls.detail.roundsProcessSubtitle") }}
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
                {{ $t("polls.detail.tapToSeeDetail") }}
              </p>
              <p
                v-if="round.winners.length"
                class="mt-2 line-clamp-2 max-w-36 text-xs font-black leading-4 text-amber-100"
              >
                {{
                  round.winners.length === 1
                    ? $t("polls.detail.wonBy", {
                        name: round.winners[0]?.name || $t("polls.detail.voteFallback"),
                      })
                    : $t("polls.detail.winnersPrefix", {
                        names: round.winners
                          .slice(0, 2)
                          .map((winner) => winner?.name)
                          .filter(Boolean)
                          .join(", "),
                      })
                }}
              </p>
            </button>

            <button
              v-if="isClosed && finalWinnerEntries.length"
              type="button"
              class="relative flex w-42 mr-2 cursor-pointer flex-col items-center rounded-3xl border px-2 pb-3 pt-3 text-center transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              :class="
                isViewingFinalResult
                  ? 'border-amber-300/45 bg-amber-400/10 ring-2 ring-amber-300/20'
                  : 'border-transparent'
              "
              :aria-pressed="isViewingFinalResult"
              @click="selectFinalResultTab"
            >
              <div
                class="relative z-10 grid size-14 place-items-center rounded-full border border-amber-300/50 bg-amber-400/20 text-sm font-black text-amber-100 shadow-lg shadow-amber-950/30"
              >
                <i class="fa-solid fa-trophy" aria-hidden="true"></i>
              </div>
              <p class="mt-2 max-w-36 truncate text-sm font-black text-white">
                {{ $t("polls.detail.finalTab") }}
              </p>
              <p
                class="mt-1 rounded-full bg-amber-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200"
              >
                {{ $t("polls.detail.winnerTab") }}
              </p>
              <p class="mt-3 text-xs font-bold text-slate-500">
                {{ $t("polls.detail.viewFinalResult") }}
              </p>
              <p class="mt-2 line-clamp-2 max-w-36 text-xs font-black leading-4 text-amber-100">
                {{
                  $t("polls.detail.wonBy", {
                    name: finalWinnerEntries[0]?.artist?.name || $t("polls.detail.voteFallback"),
                  })
                }}
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
                {{ $t("polls.detail.nextRound") }}
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
        v-if="!isEmbeddedPage && isViewingFinalResult"
        ref="roundDetailSection"
        class="poll-state-panel winner-modal relative mt-8 overflow-hidden rounded-4xl border border-amber-300/30 bg-[#080a18] p-6 text-center shadow-2xl shadow-amber-950/25 sm:p-10"
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
            {{ $t("polls.detail.finalResultEyebrow") }}
          </p>
          <h2 class="mt-3 text-4xl font-black text-white sm:text-6xl">
            {{ $t("polls.detail.finalResultTitle") }}
          </h2>
          <p
            class="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base"
          >
            {{ $t("polls.detail.finalResultDescription") }}
          </p>
        </div>

        <div class="relative mx-auto mt-10 max-w-2xl">
          <article
            v-for="(winnerEntry, index) in finalWinnerEntries"
            :key="winnerEntry.id"
            class="winner-card overflow-hidden rounded-4xl border border-amber-300/25 bg-slate-950/60 text-left shadow-2xl shadow-amber-950/25"
          >
            <span
              class="relative grid aspect-[4/5] max-h-[28rem] w-full place-items-center overflow-hidden bg-linear-to-br from-amber-300/30 via-fuchsia-500/20 to-slate-950 text-5xl font-black text-white sm:aspect-[5/4] sm:max-h-[22rem]"
            >
              <img
                v-if="getArtistImage(winnerEntry.artist)"
                :src="getArtistImage(winnerEntry.artist)"
                :alt="winnerEntry.artist.name"
                class="absolute inset-0 size-full object-cover object-center"
              />
              <span
                class="absolute inset-0 bg-linear-to-t from-[#080a18] via-[#080a18]/35 to-transparent"
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
              <span
                class="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 p-6 sm:p-8"
              >
                <span
                  class="text-xs font-black uppercase tracking-[0.28em] text-amber-200"
                >
                  {{ $t("polls.detail.winningArtist") }}
                </span>
                <span
                  class="block text-4xl font-black leading-none text-white sm:text-5xl"
                  >{{ winnerEntry.artist.name }}</span
                >
                <span class="text-sm font-bold uppercase text-amber-100/90">{{
                  getArtistGroup(winnerEntry.artist) ||
                  $t("polls.detail.finalWinnerFallback")
                }}</span>
              </span>
            </span>

            <span class="flex flex-col p-6 pt-5 sm:p-8 sm:pt-6">
              <span
                class="winner-stats overflow-hidden rounded-3xl border border-amber-300/25 bg-amber-400/10 p-4"
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
                      v-if="!hideVoteCounts"
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
                      {{ $t("polls.detail.percentage") }}
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
              class="relative flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap"
            >
              <a
                :href="hallOfFameHref"
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
                class="group inline-flex min-h-16 flex-1 items-center justify-center gap-3 rounded-3xl border border-fuchsia-300/30 bg-fuchsia-500/15 px-5 py-3 text-center text-sm font-black uppercase leading-tight tracking-wide text-fuchsia-100 shadow-lg shadow-fuchsia-950/25 transition hover:-translate-y-0.5 hover:bg-fuchsia-500/25"
                @click="openWinnerCertificate(winnerEntry)"
              >
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-2xl bg-white/10 text-base"
                >
                  <i class="fa-solid fa-certificate" aria-hidden="true"></i>
                </span>
                <span>{{ $t("polls.detail.viewCertificate") }}</span>
              </button>
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
          !isEmbeddedPage &&
          isViewingFinalResult &&
          secondaryFinalRankingEntries.length
        "
        class="relative mt-6 rounded-4xl border border-white/10 bg-white/4 p-4 shadow-xl shadow-fuchsia-950/15 sm:p-6"
      >
        <p
          class="text-xs font-black uppercase tracking-[0.28em] text-fuchsia-200"
        >
          {{ $t("polls.detail.finalPlaces") }}
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
                  <template v-if="!hideVoteCounts">
                    {{
                      $t("polls.detail.votesCount", {
                        count: entry.votes.toLocaleString("es"),
                      })
                    }}
                  </template>
                  <template v-else>
                    {{ $t("polls.detail.votesLabel") }}
                  </template>
                </p>
                <p
                  class="text-2xl font-black text-fuchsia-100"
                  :class="!hideVoteCounts && 'mt-1'"
                >
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
        v-if="!isEmbeddedPage && isRoundIntroVisible"
        class="poll-state-panel winner-modal relative mt-8 overflow-hidden rounded-4xl border border-amber-300/30 bg-[#080a18] p-6 text-center shadow-2xl shadow-amber-950/25 sm:p-10"
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
                getArtistGroup(winner) || $t("polls.detail.roundWinnerFallback")
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
        v-else-if="
          !isEmbeddedPage &&
          isSelectingWinners &&
          !isViewingSelectedClosedRound &&
          !isViewingFinalResult
        "
        class="poll-state-panel waiting-card relative mt-8 grid min-h-[460px] place-items-center overflow-hidden rounded-4xl border border-fuchsia-300/25 bg-[#080a18] p-8 text-center shadow-2xl shadow-fuchsia-950/25 sm:min-h-[560px] sm:p-12"
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
            {{ $t("polls.detail.countingInProgress") }}
          </p>
          <h2
            class="relative mx-auto mt-4 max-w-2xl text-4xl font-black text-white sm:text-6xl"
          >
            {{ $t("polls.detail.countingVotesTitle") }}
          </h2>
          <p
            class="relative mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg"
          >
            {{ $t("polls.detail.countingVotesDescription") }}
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
        v-else-if="
          !isEmbeddedPage &&
          isClosed &&
          !isViewingSelectedClosedRound &&
          !isViewingFinalResult
        "
        class="poll-state-panel mt-8 rounded-4xl border border-white/10 bg-white/5 p-8 text-center"
      >
        <p
          class="text-xs font-black uppercase tracking-[0.28em] text-slate-400"
        >
          {{ $t("polls.detail.pollFinished") }}
        </p>
        <h2 class="mt-3 text-3xl font-black text-white">
          {{ $t("polls.detail.winnersPending") }}
        </h2>
        <p class="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
          {{ $t("polls.detail.winnersPendingDescription") }}
        </p>
      </section>

      <section
        v-else-if="displayedRoundType === 'versus' && !isViewingFinalResult"
        class="poll-state-panel space-y-6"
        :class="!isEmbeddedPage && 'mt-8'"
      >
        <template v-if="!isLoadingDisplayedContestants">
          <template
            v-for="(feedItem, feedIndex) in versusFeedItems"
            :key="feedItem.id"
          >
            <PollShareNetworksBar
              v-if="feedItem.type === 'share'"
              :is-boost-live="isShareBoostLive"
              :multiplier="shareBoostMultiplier"
              :remaining-label="shareBoostRemainingLabel"
              :title="$t('polls.detail.sharePoll')"
              :hint="$t('polls.detail.sharePollHint')"
              :claiming="isClaimingShareBoost"
              @share="sharePollOnNetwork"
            />
            <InFeedAd v-else-if="feedItem.type === 'ad'" />
            <article
              v-else
              class="rounded-4xl border border-white/10 bg-white/5"
              :class="
                feedItem.row.contestants.length === 2
                  ? isEmbeddedPage
                    ? 'p-2 sm:p-4'
                    : 'mx-auto max-w-5xl p-3 sm:p-4'
                  : 'p-4 sm:p-5'
              "
              :style="{
                animationDelay: `${Math.min(feedItem.index, 6) * 80}ms`,
              }"
            >
          <div class="mb-4 text-center">
            <p
              class="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300"
            >
              {{ feedItem.row.title }}
            </p>
          </div>

          <div
            class="relative"
            :class="
              feedItem.row.contestants.length === 2
                ? isEmbeddedPage
                  ? 'embed-duel-grid grid grid-cols-2 gap-2 sm:gap-4'
                  : 'grid grid-cols-2 gap-2 sm:gap-4'
                : 'space-y-3'
            "
          >
            <div
              v-if="feedItem.row.contestants.length === 2"
              class="versus-vs-overlay pointer-events-none absolute inset-x-0 top-0 z-50 flex items-center justify-center"
              :class="isEmbeddedPage && 'embed-duel-vs-layer'"
            >
              <span
                class="embed-vs-badge grid place-items-center rounded-full border-4 border-white/25 bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500 font-black text-white shadow-2xl shadow-fuchsia-500/60 ring-4 ring-fuchsia-500/20"
                :class="
                  isEmbeddedPage
                    ? 'size-12 text-sm sm:size-20 sm:text-2xl'
                    : 'size-12 text-sm sm:size-20 sm:text-2xl'
                "
              >
                VS
              </span>
            </div>
            <div
              v-for="(contestant, index) in feedItem.row.contestants"
              :key="contestant.id"
              :data-artist-id="getContestantArtistId(contestant)"
              class="relative overflow-hidden rounded-3xl border border-violet-300/10 bg-slate-950/55"
              :class="[
                voteFeedbacks[getContestantArtistId(contestant)]?.source === 'own' &&
                  'vote-feedback-card',
                contestantShowsLiveFlash(contestant) &&
                  'live-vote-flash-card',
              ]"
              :style="{ animationDelay: `${Math.min(index, 2) * 90 + 80}ms` }"
            >
              <span
                v-if="voteFeedbacks[getContestantArtistId(contestant)]?.source === 'own'"
                :key="`notice-${voteFeedbacks[getContestantArtistId(contestant)].token}`"
                class="vote-feedback-notice"
              >
                {{
                  voteFeedbacks[getContestantArtistId(contestant)].pending
                    ? $t("polls.detail.voteProcessing")
                    : $t("polls.detail.voteCounted")
                }}
              </span>
              <div
                class="grid gap-0"
                :class="
                  feedItem.row.contestants.length === 2
                    ? 'h-full grid-rows-[auto_1fr_auto]'
                    : 'md:grid-cols-[14rem_1fr_auto] md:items-center'
                "
              >
                <div
                  class="relative overflow-hidden bg-linear-to-br from-violet-950 via-fuchsia-950 to-slate-950"
                  :class="
                    feedItem.row.contestants.length === 2
                      ? isEmbeddedPage
                        ? 'aspect-[5/4] min-h-0 sm:aspect-square sm:min-h-72 md:min-h-80'
                        : 'aspect-[5/4] min-h-0 sm:aspect-auto sm:min-h-52 md:min-h-78'
                      : 'min-h-52 md:min-h-56'
                  "
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
                </div>

                <div
                  class="p-3"
                  :class="
                    feedItem.row.contestants.length === 2
                      ? isEmbeddedPage
                        ? 'p-2 sm:p-5'
                        : 'p-2 sm:p-3'
                      : 'sm:p-5'
                  "
                >
                  <div
                    class="flex items-start justify-between"
                    :class="
                      feedItem.row.contestants.length === 2 ? 'gap-2 sm:gap-4' : 'gap-4'
                    "
                  >
                    <div class="min-w-0">
                      <h3
                        class="font-black text-white"
                        :class="
                          feedItem.row.contestants.length === 2
                            ? isEmbeddedPage
                              ? 'text-base leading-tight sm:text-2xl md:text-3xl'
                              : 'truncate text-sm leading-tight sm:text-2xl'
                            : 'truncate text-3xl'
                        "
                      >
                        {{
                          contestant.artist?.name ||
                          $t("polls.detail.voteFallback")
                        }}
                      </h3>
                      <p
                        class="mt-1 text-[10px] font-black uppercase text-fuchsia-200 sm:text-sm"
                      >
                        {{
                          getArtistGroup(contestant.artist) ||
                          $t("polls.detail.soloist")
                        }}
                      </p>
                      <span
                        v-if="hasRoundWinners"
                        class="mt-2 inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest sm:px-3 sm:py-1.5 sm:text-[11px]"
                        :class="
                          isContestantWinner(contestant)
                            ? winnerToneClasses(contestant, 'badge')
                            : 'border border-white/10 bg-white/5 text-slate-500'
                        "
                      >
                        {{
                          isContestantWinner(contestant)
                            ? $t("polls.detail.duelWinner")
                            : $t("polls.detail.didNotWin")
                        }}
                      </span>
                    </div>
                    <div
                      class="contestant-stats-stack shrink-0 text-right"
                      :class="[
                        feedItem.row.contestants.length === 2
                          ? isEmbeddedPage
                            ? 'min-w-[4.5rem] sm:min-w-[5.5rem]'
                            : 'min-w-[4.25rem] sm:min-w-[5.5rem]'
                          : 'min-w-[5.5rem]',
                        contestantShowsLiveFlash(contestant) &&
                          'live-stat-boost',
                      ]"
                    >
                      <p
                        class="contestant-stat-votes text-[10px] font-black uppercase tracking-widest text-slate-300 sm:text-xs"
                        :class="
                          voteFeedbacks[getContestantArtistId(contestant)]?.source === 'own' &&
                            !voteFeedbacks[getContestantArtistId(contestant)]?.pending &&
                            'text-emerald-200'
                        "
                      >
                        <template v-if="!hideVoteCounts">
                          <span
                            :key="`votes-${getContestantArtistId(contestant)}-${contestantLiveFlashStamp(contestant) || 0}`"
                            class="live-stats-pulse-target"
                            :data-flash="contestantLiveFlashStamp(contestant)"
                          >
                            {{
                              $t("polls.detail.votesCount", {
                                count:
                                  displayVoteCountFor(contestant).toLocaleString(
                                    "es",
                                  ),
                              })
                            }}
                          </span>
                        </template>
                        <template v-else>
                          {{ $t("polls.detail.votesLabel") }}
                        </template>
                      </p>
                      <p
                        class="contestant-stat-percent embed-percent font-black leading-none text-cyan-100"
                        :class="
                          feedItem.row.contestants.length === 2
                            ? isEmbeddedPage
                              ? 'text-base sm:text-2xl'
                              : 'text-sm sm:text-xl'
                            : 'text-2xl'
                        "
                      >
                        <span
                          :key="`percent-${getContestantArtistId(contestant)}-${contestantLiveFlashStamp(contestant) || 0}`"
                          class="live-percent-pulse"
                          :data-flash="contestantLiveFlashStamp(contestant)"
                        >
                          {{ percentForMatch(contestant, feedItem.row) }}
                        </span>
                      </p>
                    </div>
                  </div>

                    <div
                      class="overflow-hidden rounded-full bg-white/10"
                      :class="[
                        feedItem.row.contestants.length === 2
                          ? isEmbeddedPage
                            ? 'mt-3 h-2 sm:mt-4 sm:h-3'
                            : 'mt-3 h-2.5'
                          : 'mt-4 h-3',
                        contestantShowsLiveFlash(contestant) &&
                          'live-vote-bar-shell',
                      ]"
                    >
                      <div
                        class="poll-vote-bar-fill h-full rounded-full transition-[width] duration-700 ease-out"
                        :class="
                          contestantShowsLiveFlash(contestant) &&
                            'live-vote-flash-bar'
                        "
                        :data-flash="contestantLiveFlashStamp(contestant)"
                        :style="{ width: percentForMatch(contestant, feedItem.row) }"
                      ></div>
                    </div>
                </div>

                <button
                  v-if="!isViewingSelectedClosedRound"
                  type="button"
                  class="flex items-center justify-center rounded-2xl font-black uppercase tracking-wide transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                  :class="[
                    feedItem.row.contestants.length === 2
                      ? isEmbeddedPage
                        ? 'm-2 min-h-11 px-3 text-xs sm:m-4 sm:min-h-12 sm:px-6 sm:text-sm'
                        : 'm-2 min-h-10 px-2 text-[11px] sm:m-3 sm:min-h-10 sm:px-6 sm:text-sm'
                      : 'm-4 min-h-12 px-6 text-sm',
                    feedItem.row.contestants.length !== 2 && 'md:min-w-32',
                    isAnonymousOnCooldownFor(contestant)
                      ? 'border border-amber-300/35 bg-amber-400/15 text-amber-100 shadow-lg shadow-amber-950/20 hover:bg-amber-400/20'
                      : 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-950/30',
                  ]"
                  :disabled="isVoteButtonDisabled(contestant)"
                  @click="openVoteModal(contestant)"
                >
                  {{ voteButtonLabel(contestant) }}
                </button>
              </div>
            </div>
          </div>
          </article>
          </template>
        </template>

        <template v-if="isLoadingDisplayedContestants">
          <article
            v-for="index in 2"
            :key="`versus-skeleton-${index}`"
            class="mx-auto max-w-5xl rounded-4xl border border-white/10 bg-white/5 p-3 sm:p-4"
          >
            <div class="mb-4 h-4 w-24 animate-pulse rounded-full bg-fuchsia-300/20"></div>
            <div class="grid grid-cols-2 gap-2 sm:gap-4">
              <div
                v-for="side in 2"
                :key="`versus-skeleton-${index}-${side}`"
                class="overflow-hidden rounded-3xl border border-violet-300/10 bg-slate-950/55"
              >
                <div class="min-h-52 animate-pulse bg-linear-to-br from-violet-500/20 via-fuchsia-500/10 to-cyan-500/10 md:min-h-78"></div>
                <div class="p-3 sm:p-4">
                  <div class="h-6 w-40 animate-pulse rounded-full bg-white/12"></div>
                  <div class="mt-3 h-3 w-full animate-pulse rounded-full bg-white/10"></div>
                  <div class="mt-3 h-4 w-24 animate-pulse rounded-full bg-white/10"></div>
                  <div class="mt-4 h-10 w-full animate-pulse rounded-2xl bg-fuchsia-400/15"></div>
                </div>
              </div>
            </div>
          </article>
        </template>

        <p
          v-if="!isLoadingContestants && !displayedVersusMatches.length"
          class="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm font-bold text-slate-400"
        >
          Esta ronda versus todavía no tiene participantes.
        </p>
      </section>

      <section
        v-else-if="
          isViewingSelectedClosedRound ||
          (!isViewingFinalResult && !isClosed && !isSelectingWinners)
        "
        ref="roundDetailSection"
        class="poll-state-panel space-y-4"
        :class="!isEmbeddedPage && 'mt-8'"
      >
        <article
          v-if="isViewingSelectedClosedRound"
          class="rounded-4xl border border-amber-300/25 bg-amber-400/10 p-5 shadow-xl shadow-amber-950/20 sm:p-6"
        >
          <p class="text-xs font-black uppercase tracking-[0.28em] text-amber-200">
            Detalle de fase finalizada
          </p>
          <h2 class="mt-2 text-3xl font-black text-white">
            {{ selectedRoundStep?.title || "Ronda seleccionada" }}
          </h2>
          <p class="mt-3 text-sm font-bold leading-6 text-slate-300">
            Aquí puedes revisar qué pasó en esta fase, el orden final de votos y quién avanzó.
          </p>
          <p
            v-if="selectedRoundWinnerNames.length"
            class="mt-4 rounded-2xl border border-amber-300/20 bg-slate-950/35 px-4 py-3 text-sm font-black text-amber-100"
          >
            {{ $t("polls.detail.winnersPrefix", { names: selectedRoundWinnerNames.join(", ") }) }}
          </p>
        </article>

        <div
          v-if="
            shouldShowVoteButtons && currentUser && !currentUser.isAnonymous
          "
          class="flex flex-col gap-2 rounded-3xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            {{ $t("polls.detail.yourPoints") }}
            <strong class="text-lg text-amber-200"
              >{{ formattedUserPoints }} pts</strong
            >
          </span>
          <span class="text-xs uppercase tracking-widest text-amber-200/75">
            {{ $t("polls.detail.costPerVote", { count: pointsPerVote, unit: pointsPerVote === 1 ? $t("polls.detail.pointSingular") : $t("polls.detail.pointPlural") }) }}
          </span>
        </div>

        <div
          v-if="
            shouldShowVoteButtons && (!currentUser || currentUser.isAnonymous)
          "
          id="anonymous-vote-status-banner"
          class="flex flex-col gap-2 rounded-3xl border px-4 py-3 text-sm font-bold sm:flex-row sm:items-center sm:justify-between"
          :class="
            isAnonymousWaitingToVote
              ? 'border-amber-300/25 bg-amber-300/10 text-amber-100'
              : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
          "
        >
          <span>
            <template v-if="isAnonymousWaitingToVote">
              <span class="block text-[10px] font-black uppercase tracking-[0.24em] text-amber-200/90">
                {{ $t("polls.detail.anonymousWaitTitle") }}
              </span>
              <span class="mt-1 block text-3xl font-black tabular-nums tracking-tight text-amber-100">
                {{ anonymousLiveCountdownLabel }}
              </span>
              <span class="mt-1 block text-sm font-bold text-amber-100/90">
                {{ anonymousVoteMessage }}
              </span>
            </template>
            <template v-else>
              {{ anonymousVoteMessage }}
            </template>
          </span>
          <span
            class="text-xs uppercase tracking-widest"
            :class="
              isAnonymousWaitingToVote ? 'text-amber-200/80' : 'text-cyan-200/75'
            "
          >
            {{
              isLoadingAnonymousStatus
                ? $t("polls.detail.checkingAnonymousVote")
                : isAnonymousWaitingToVote
                  ? $t("polls.detail.anonymousCooldownHint")
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

        <div
          v-else
          class="space-y-4"
        >
          <template
            v-for="(feedItem, feedIndex) in contestantFeedItems"
            :key="feedItem.id"
          >
            <PollShareNetworksBar
              v-if="feedItem.type === 'share'"
              :is-boost-live="isShareBoostLive"
              :multiplier="shareBoostMultiplier"
              :remaining-label="shareBoostRemainingLabel"
              :title="$t('polls.detail.sharePoll')"
              :hint="$t('polls.detail.sharePollHint')"
              :claiming="isClaimingShareBoost"
              @share="sharePollOnNetwork"
            />
            <InFeedAd v-else-if="feedItem.type === 'ad'" />
            <article
              v-else
              :data-artist-id="getContestantArtistId(feedItem.row)"
              class="poll-contestant-enter relative rounded-3xl border p-4 transition sm:p-5"
              :class="[
                isContestantWinner(feedItem.row)
                  ? winnerToneClasses(feedItem.row, 'card')
                  : hasRoundWinners
                    ? 'border-white/10 bg-white/3 opacity-55 grayscale hover:opacity-75'
                    : 'border-white/10 bg-white/5 hover:bg-white/8',
                voteFeedbacks[getContestantArtistId(feedItem.row)]?.source === 'own' &&
                  'vote-feedback-card',
                showsLiveVoteFlash(getContestantArtistId(feedItem.row)) &&
                  'live-vote-flash-card',
              ]"
              :style="{ animationDelay: `${Math.min(feedItem.index, 8) * 70}ms` }"
            >
            <span
              v-if="voteFeedbacks[getContestantArtistId(feedItem.row)]?.source === 'own'"
              :key="`notice-${voteFeedbacks[getContestantArtistId(feedItem.row)].token}`"
              class="vote-feedback-notice"
            >
              {{
                voteFeedbacks[getContestantArtistId(feedItem.row)].pending
                  ? $t("polls.detail.voteProcessing")
                  : $t("polls.detail.voteCounted")
              }}
            </span>
            <div
              class="relative grid grid-cols-[auto_1fr] gap-3 md:flex md:flex-row md:items-center md:gap-4"
            >
              <span
                class="absolute -left-1 -top-1 z-10 rounded-2xl bg-[#080a18]/80 px-2 py-1 text-xl font-black backdrop-blur sm:text-4xl md:static md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-0"
                :class="
                  isContestantWinner(feedItem.row)
                    ? winnerToneClasses(feedItem.row, 'rank')
                    : 'text-fuchsia-200'
                "
              >
                #{{ feedItem.index + 1 }}
              </span>
              <span
                class="grid size-24 shrink-0 place-items-center overflow-hidden rounded-3xl border-2 border-fuchsia-300/35 bg-linear-to-br from-violet-500 to-fuchsia-500 text-3xl font-black text-white shadow-xl shadow-fuchsia-950/20 sm:size-32"
              >
                <img
                  v-if="getArtistImage(feedItem.row.artist)"
                  :src="getArtistImage(feedItem.row.artist)"
                  :alt="feedItem.row.artist?.name"
                  class="size-full object-cover"
                />
                <span v-else>{{
                  feedItem.row.artist?.name?.charAt(0) || "A"
                }}</span>
              </span>
              <div class="min-w-0 flex-1 pr-1">
                <div class="flex items-start justify-between gap-3">
                  <span class="min-w-0">
                    <span class="flex flex-wrap items-center gap-2 sm:gap-3">
                      <h3
                        class="truncate text-xl font-black leading-none text-white sm:text-3xl"
                      >
                        {{
                          feedItem.row.artist?.name ||
                          $t("polls.detail.voteFallback")
                        }}
                      </h3>
                      <span
                        v-if="hasRoundWinners"
                        class="inline-flex rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-widest sm:px-5 sm:py-2 sm:text-sm"
                        :class="
                          isContestantWinner(feedItem.row)
                            ? winnerToneClasses(feedItem.row, 'badge')
                            : 'border border-white/10 bg-white/5 text-slate-500'
                        "
                      >
                        {{
                          isContestantWinner(feedItem.row)
                            ? $t("polls.detail.winnerBadge", {
                                rank: contestantWinnerRank(feedItem.row),
                              })
                            : $t("polls.detail.didNotWin")
                        }}
                      </span>
                    </span>
                    <p
                      class="mt-1 text-xs font-bold uppercase text-fuchsia-200 sm:text-sm"
                    >
                      {{
                        getArtistGroup(feedItem.row.artist) ||
                        $t("polls.detail.soloist")
                      }}
                    </p>
                  </span>
                  <span
                    class="contestant-stats-stack min-w-[5rem] shrink-0 text-right sm:min-w-[6.5rem]"
                    :class="
                      showsLiveVoteFlash(getContestantArtistId(feedItem.row)) &&
                        'live-stat-boost'
                    "
                  >
                    <span
                      class="contestant-stat-votes block text-[10px] font-black uppercase tracking-widest text-slate-300 sm:text-sm"
                      :class="
                        voteFeedbacks[getContestantArtistId(feedItem.row)]?.source === 'own' &&
                          !voteFeedbacks[getContestantArtistId(feedItem.row)]?.pending &&
                          'text-emerald-200'
                      "
                    >
                      <template v-if="!hideVoteCounts">
                        <span
                          class="live-stats-pulse-target"
                          :data-flash="liveVoteFlashStampFor(getContestantArtistId(feedItem.row))"
                        >
                          {{
                            $t("polls.detail.votesCount", {
                              count:
                                displayVoteCountFor(feedItem.row).toLocaleString(
                                  "es",
                                ),
                            })
                          }}
                        </span>
                      </template>
                      <template v-else>
                        {{ $t("polls.detail.votesLabel") }}
                      </template>
                    </span>
                    <span
                      class="contestant-stat-percent block text-2xl font-black leading-none text-fuchsia-100 sm:text-4xl"
                    >
                      <span
                        class="live-percent-pulse"
                        :data-flash="liveVoteFlashStampFor(getContestantArtistId(feedItem.row))"
                      >
                        {{ percentForDisplayedContestant(feedItem.row) }}
                      </span>
                    </span>
                  </span>
                </div>
                <div
                  class="mt-5 h-3 overflow-hidden rounded-full bg-white/10"
                  :class="
                    showsLiveVoteFlash(getContestantArtistId(feedItem.row)) &&
                      'live-vote-bar-shell'
                  "
                >
                  <div
                    class="poll-vote-bar-fill h-full rounded-full transition-[width] duration-700 ease-out"
                    :class="
                      showsLiveVoteFlash(getContestantArtistId(feedItem.row)) &&
                        'live-vote-flash-bar'
                    "
                    :style="{
                      width: percentForDisplayedContestant(feedItem.row),
                    }"
                  ></div>
                </div>
              </div>
              <button
                v-if="shouldShowVoteButtons"
                type="button"
                class="col-span-3 min-h-12 rounded-2xl px-6 text-sm font-black uppercase tracking-wide transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 md:col-span-1"
                :class="
                  isAnonymousOnCooldownFor(feedItem.row)
                    ? 'border border-amber-300/35 bg-amber-400/15 text-amber-100 shadow-lg shadow-amber-950/20 hover:bg-amber-400/20'
                    : 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-950/30'
                "
                :disabled="isVoteButtonDisabled(feedItem.row)"
                @click="openVoteModal(feedItem.row)"
              >
                {{ voteButtonLabel(feedItem.row) }}
              </button>
            </div>
          </article>
          </template>
        </div>

        <p
          v-if="!isLoadingSelectedRound && !displayedContestants.length"
          class="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm font-bold text-slate-400"
        >
          Esta votacion todavia no tiene participantes.
        </p>
      </section>
    </template>

    <PollComments
      v-if="!isEmbeddedPage && showSecondarySections && currentPollId"
      :poll-id="currentPollId"
    />

    <WinnerCertificateModal
      :open="certificateModal.open"
      :name="certificateModal.name"
      :group="certificateModal.group"
      :date="certificateModal.date"
      @close="closeWinnerCertificate"
    />

    <div v-if="!isEmbeddedPage && showSecondarySections" class="mt-12 border-t border-white/10 pt-4">
      <ActivePolls :exclude-poll-id="currentPollId" />
    </div>

    <section
      v-if="isEmbeddedPage"
      class="mt-3 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-3 text-white shadow-2xl shadow-fuchsia-950/20 sm:mt-4 sm:p-4"
    >
      <div
        v-if="isLoggedFan"
        class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-cyan-200/25 bg-linear-to-br from-cyan-400/20 to-fuchsia-500/20 text-sm font-black text-cyan-100"
          >
            <img
              v-if="currentUser.photoURL"
              :src="currentUser.photoURL"
              :alt="embedUserName"
              class="size-full object-cover"
            />
            <span v-else>{{ embedUserInitial }}</span>
          </span>
          <span class="min-w-0">
            <span
              class="block text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200"
            >
              {{ $t("polls.detail.embedLoggedLabel") }}
            </span>
            <strong class="block truncate text-sm font-black sm:text-base">
              {{ embedUserName }}
            </strong>
          </span>
        </div>
        <span
          class="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-amber-100"
        >
          {{
            $t("polls.detail.embedPoints", {
              points: formattedUserPoints,
            })
          }}
        </span>
      </div>

      <div
        v-else
        class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p
            class="text-[10px] font-black uppercase tracking-[0.24em] text-fuchsia-200"
          >
            {{ $t("polls.detail.embedGuestLabel") }}
          </p>
          <p class="mt-1 text-sm font-bold leading-6 text-slate-200">
            {{ $t("polls.detail.embedGuestDescription") }}
          </p>
        </div>
        <a
          class="flex min-h-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/35 bg-cyan-300/12 px-5 text-xs font-black uppercase tracking-wide text-cyan-50 shadow-lg shadow-cyan-950/25 backdrop-blur transition hover:scale-[1.01] hover:border-cyan-100/60 hover:bg-cyan-300/20"
          :href="registerUrl"
          target="_blank"
          rel="noopener"
        >
          {{ $t("polls.detail.embedGuestAction") }}
        </a>
      </div>
    </section>

    <EmbedAd v-if="isEmbeddedPage" />

    <Teleport to="body">
      <div
        v-if="voteModalContestant"
        class="fixed inset-0 z-90 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
        @click.self="closeVoteModal"
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
              class="absolute right-3 top-3 z-50 grid size-11 place-items-center rounded-full border border-white/15 bg-[#090b19]/95 text-2xl font-black leading-none text-slate-200 shadow-lg transition hover:bg-white/15 hover:text-white"
              :aria-label="$t('polls.detail.close')"
              @click.stop.prevent="closeVoteModal"
            >
              ×
            </button>

            <div class="relative z-10">
              <div
                class="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 pr-14"
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
                    {{
                      selectedVoteArtist?.name ||
                      $t("polls.detail.voteFallback")
                    }}
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
                    {{
                      isGuestAnonymousFlow
                        ? $t("polls.detail.anonymousConfirmDescription")
                        : $t("polls.detail.loggedFreeVoteDescription")
                    }}
                  </p>
                  <p
                    class="mt-3 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm font-bold text-cyan-100"
                  >
                    {{ anonymousVoteMessage }}
                  </p>
                </div>

                <PollShareNetworksBar
                  v-if="shareBoostConfig.enabled"
                  :is-boost-live="isShareBoostLive"
                  :multiplier="shareBoostMultiplier"
                  :remaining-label="shareBoostRemainingLabel"
                  :title="$t('polls.detail.shareForDoubleTitle', { multiplier: shareBoostConfig.multiplier })"
                  :hint="shareBoostConfig.oncePerDay && shareBoostClaimedToday
                    ? $t('polls.detail.shareBoostAlreadyUsed', { multiplier: shareBoostConfig.multiplier })
                    : $t('polls.detail.shareForDoubleHint', { minutes: shareBoostConfig.durationMinutes, multiplier: shareBoostConfig.multiplier })"
                  :claiming="isClaimingShareBoost"
                  :message="shareBoostMessage || shareMessage"
                  @share="sharePollOnNetwork"
                />

                <button
                  v-if="showFreeVoteDownloadCta"
                  type="button"
                  class="group relative mt-1 flex w-full items-center gap-3 overflow-hidden rounded-[1.35rem] border border-fuchsia-300/45 bg-linear-to-r from-[#3b0a58] via-[#1d0b33] to-[#0d0820] px-3 py-3 text-left shadow-[0_0_28px_rgba(217,70,239,0.28)] transition hover:border-fuchsia-200/60 hover:shadow-[0_0_36px_rgba(217,70,239,0.4)]"
                  @click="openAppDownloadFromVoteModal"
                >
                  <span
                    class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_40%,rgba(236,72,153,0.35),transparent_45%),radial-gradient(circle_at_90%_70%,rgba(34,211,238,0.16),transparent_40%)]"
                    aria-hidden="true"
                  ></span>
                  <span class="relative shrink-0">
                    <span
                      class="absolute -inset-1 rounded-[1.1rem] bg-fuchsia-400/25 blur-md"
                      aria-hidden="true"
                    ></span>
                    <img
                      src="/app-download-phone.png"
                      alt=""
                      class="relative h-[4.5rem] w-auto drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
                      width="72"
                      height="72"
                      aria-hidden="true"
                    />
                  </span>
                  <span class="relative min-w-0 flex-1">
                    <span
                      v-if="appDownloadPrompt.firstOpenRewardEnabled && appDownloadPrompt.firstOpenRewardPoints > 0"
                      class="mb-1 inline-flex rounded-full border border-amber-300/35 bg-amber-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-100"
                    >
                      +{{ appDownloadPrompt.firstOpenRewardPoints }} pts
                    </span>
                    <span class="block text-[13px] font-black uppercase tracking-wide text-white">{{
                      $t("polls.detail.freeVoteMissionsDownloadGo")
                    }}</span>
                    <span class="mt-0.5 block text-[11px] font-semibold leading-4 text-fuchsia-100/80">{{
                      appDownloadPrompt.firstOpenRewardEnabled &&
                      appDownloadPrompt.firstOpenRewardPoints > 0
                        ? $t("polls.detail.freeVoteMissionsDownloadHintPoints", {
                            points: appDownloadPrompt.firstOpenRewardPoints,
                          })
                        : $t("polls.detail.freeVoteMissionsDownloadHint")
                    }}</span>
                  </span>
                  <span
                    class="relative grid size-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-base text-white/80 transition group-hover:bg-white/18 group-hover:text-white"
                    aria-hidden="true"
                  >
                    ›
                  </span>
                </button>

                <label
                  v-if="!isAnonymousVotingFlow"
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
                  v-if="shouldShowTurnstile"
                  class="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-4"
                >
                  <div class="space-y-3">
                    <div class="flex items-center gap-3">
                      <span
                        class="grid size-11 shrink-0 place-items-center rounded-2xl border border-emerald-200/30 bg-emerald-300/15 text-emerald-100"
                      >
                        <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
                      </span>
                      <span class="min-w-0">
                        <span
                          class="block text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200"
                        >
                          Verificación anti-bots
                        </span>
                        <span class="mt-1 block text-sm font-bold leading-5 text-slate-200">
                          {{
                            isTurnstileMocked()
                              ? "Marca el check de prueba (solo local)."
                              : "Marca el check de Cloudflare antes de votar."
                          }}
                        </span>
                      </span>
                    </div>
                    <div class="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55 p-3">
                      <div ref="turnstileContainer" class="min-h-[65px]"></div>
                    </div>
                    <p
                      v-if="turnstileError"
                      class="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
                    >
                      {{ turnstileError }}
                    </p>
                  </div>
                </div>

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
                  <button
                    type="button"
                    class="col-span-4 min-h-11 rounded-2xl border border-fuchsia-300/25 bg-fuchsia-400/10 text-sm font-black uppercase tracking-wide text-fuchsia-100 transition hover:bg-fuchsia-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                    :disabled="maxVoteAmount <= 1"
                    @click="setVoteAmountToMax"
                  >
                    {{ $t("polls.detail.voteAllPoints", { count: maxVoteAmount.toLocaleString("es") }) }}
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
                        ? !canUseAnonymousVote ||
                          (shouldShowTurnstile && !turnstileToken)
                        : normalizedVoteAmount < 1 ||
                          normalizedVoteAmount > maxVoteAmount)
                    "
                  >
                    {{
                      isVoting === getContestantArtistId(voteModalContestant)
                        ? $t("polls.detail.voting")
                        : isAnonymousVotingFlow
                          ? isShareBoostLive
                            ? $t("polls.detail.castVotesBoosted", {
                                count: "1",
                                effective: String(shareBoostMultiplier),
                              })
                            : $t("polls.detail.useFreeVote")
                          : isShareBoostLive
                            ? $t("polls.detail.castVotesBoosted", {
                                count: normalizedVoteAmount.toLocaleString("es"),
                                effective: effectiveVoteAmount.toLocaleString("es"),
                              })
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

    <Teleport to="body">
      <div
        v-if="isSignupPromptOpen"
        class="fixed inset-0 z-95 flex items-center justify-center bg-[#03030a]/85 px-4 py-6 backdrop-blur-md"
        @click.self="closeSignupPrompt"
      >
        <div
          class="signup-prompt-modal relative w-full max-w-md overflow-hidden rounded-4xl border border-cyan-300/25 bg-[#080a18] p-1 text-white shadow-2xl shadow-cyan-950/50"
          @click.stop
        >
          <div
            class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.26),transparent_32%),radial-gradient(circle_at_90%_18%,rgba(236,72,153,0.26),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,8,32,0.98))]"
          ></div>
          <div
            class="signup-prompt-orbit pointer-events-none absolute -right-14 -top-14 size-40 rounded-full border border-cyan-200/20"
          ></div>
          <div
            class="pointer-events-none absolute -bottom-16 left-8 size-48 rounded-full bg-fuchsia-400/15 blur-3xl"
          ></div>

          <button
            type="button"
            class="absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full border border-white/10 bg-white/8 text-xl font-black text-slate-300 transition hover:bg-white/15 hover:text-white"
            :aria-label="$t('common.actions.close')"
            @click="closeSignupPrompt"
          >
            ×
          </button>

          <div class="relative z-10 p-6 text-center sm:p-8">
            <div
              class="signup-prompt-badge mx-auto grid size-20 place-items-center rounded-3xl border border-cyan-200/30 bg-cyan-300/10 text-4xl shadow-2xl shadow-cyan-950/40"
              aria-hidden="true"
            >
              <i class="fa-solid fa-check"></i>
            </div>
            <p
              class="mt-5 text-xs font-black uppercase tracking-[0.28em] text-cyan-200"
            >
              {{ $t("polls.detail.anonymousVoteSuccessTitle") }}
            </p>
            <h2 class="mt-2 text-3xl font-black leading-tight">
              {{ $t("polls.detail.signupPromptTitle") }}
            </h2>
            <p class="mt-3 text-sm leading-6 text-slate-300">
              {{ $t("polls.detail.signupPromptDescription") }}
            </p>

            <div class="mt-6 grid gap-3">
              <a
                class="flex min-h-12 items-center justify-center rounded-2xl border border-cyan-200/35 bg-cyan-300/12 px-5 text-sm font-black uppercase tracking-wide text-cyan-50 shadow-lg shadow-cyan-950/30 backdrop-blur transition hover:scale-[1.01] hover:border-cyan-100/60 hover:bg-cyan-300/20"
                :href="registerUrl"
                :target="isEmbeddedPage ? '_blank' : '_self'"
                rel="noopener"
              >
                {{ $t("polls.detail.signupPromptAction") }}
              </a>
              <button
                type="button"
                class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 transition hover:bg-white/10"
                @click="closeSignupPrompt"
              >
                {{ $t("polls.detail.signupPromptLater") }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="missionsPrompt"
        class="fixed inset-0 z-95 flex items-center justify-center bg-black/78 px-4 py-6 backdrop-blur-md"
        @click.self="closeMissionsPrompt"
      >
        <div
          class="relative w-full max-w-md overflow-hidden rounded-[28px] border border-fuchsia-400/45 bg-linear-to-br from-[#2A0B3F] to-[#120826] p-5 text-white shadow-2xl shadow-fuchsia-500/30 sm:p-6"
          @click.stop
        >
          <button
            type="button"
            class="absolute right-3 top-3 z-20 grid size-10 place-items-center rounded-full border border-white/10 bg-white/8 text-xl font-black text-slate-300 transition hover:bg-white/15 hover:text-white"
            :aria-label="$t('common.actions.close')"
            @click="closeMissionsPrompt"
          >
            ×
          </button>

          <div
            v-if="missionsPrompt.contestant"
            class="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-3 pr-12"
          >
            <span
              class="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-fuchsia-300/40 bg-linear-to-br from-violet-500 to-fuchsia-500 text-xl font-black"
            >
              <img
                v-if="getArtistImage(missionsPrompt.contestant.artist)"
                :src="getArtistImage(missionsPrompt.contestant.artist)"
                :alt="missionsPrompt.contestant.artist?.name"
                class="size-full object-cover"
              />
              <span v-else>
                {{ missionsPrompt.contestant.artist?.name?.charAt(0) || "A" }}
              </span>
              <span
                v-if="missionsPromptRank"
                class="absolute -left-1 -top-1 rounded-lg bg-[#080a18]/90 px-1.5 py-0.5 text-[10px] font-black text-fuchsia-200"
              >
                #{{ missionsPromptRank }}
              </span>
            </span>
            <span class="min-w-0 flex-1">
              <strong class="block truncate text-base font-black">
                {{
                  missionsPrompt.contestant.artist?.name ||
                  $t("polls.detail.voteFallback")
                }}
              </strong>
              <span class="mt-0.5 block truncate text-xs font-bold text-fuchsia-200/80">
                {{
                  getArtistGroup(missionsPrompt.contestant.artist) ||
                  $t("polls.detail.soloist")
                }}
              </span>
            </span>
            <span class="shrink-0 text-lg font-black text-cyan-100">
              {{ missionsPromptPercent }}
            </span>
          </div>

          <h2
            class="mt-4 text-center text-xl font-black uppercase tracking-wide text-white"
          >
            {{ $t("polls.detail.freeVoteMissionsTitle") }}
          </h2>
          <p class="mt-2 text-center text-sm font-semibold leading-6 text-white/75">
            {{
              showMissionsPromptDownloadCta
                ? $t("polls.detail.freeVoteMissionsDownloadBody")
                : $t("polls.detail.freeVoteMissionsBody")
            }}
          </p>

          <div
            v-if="missionsPromptRemainingMs > 0"
            class="mt-4 rounded-[18px] border border-amber-200/35 bg-[#0B031B]/85 px-3 py-3 text-center"
          >
            <p
              class="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200"
            >
              {{ $t("polls.detail.freeVoteWaitLabel") }}
            </p>
            <div class="mt-2.5 flex items-center justify-center gap-1.5">
              <span
                class="min-w-14 rounded-xl border border-amber-200/20 bg-[#1a0f08] px-3 py-2 text-2xl font-black tabular-nums text-amber-100"
              >
                {{ missionsPromptCountdown.minutes }}
              </span>
              <span class="text-2xl font-black text-amber-200">:</span>
              <span
                class="min-w-14 rounded-xl border border-amber-200/20 bg-[#1a0f08] px-3 py-2 text-2xl font-black tabular-nums text-amber-100"
              >
                {{ missionsPromptCountdown.seconds }}
              </span>
            </div>
          </div>

          <p
            v-if="pendingMissionsCount > 0"
            class="mt-3 text-center text-sm font-extrabold text-fuchsia-200"
          >
            {{
              $t("polls.detail.freeVoteMissionsPending", {
                count: pendingMissionsCount,
              })
            }}
          </p>
          <p
            v-else-if="showMissionsPromptDownloadCta"
            class="mt-3 text-center text-sm font-extrabold text-fuchsia-200"
          >
            {{ $t("polls.detail.freeVoteMissionsDownloadHint") }}
          </p>

          <PollShareNetworksBar
            v-if="shareBoostConfig.enabled"
            class="mt-3"
            :is-boost-live="isShareBoostLive"
            :multiplier="shareBoostMultiplier"
            :remaining-label="shareBoostRemainingLabel"
            :title="$t('polls.detail.shareForDoubleTitle', { multiplier: shareBoostConfig.multiplier })"
            :hint="$t('polls.detail.freeVoteMissionsShare')"
            :claiming="isClaimingShareBoost"
            :message="shareBoostMessage"
            @share="sharePollOnNetwork"
          />
          <button
            v-else
            type="button"
            class="mt-3 flex w-full items-center gap-3 rounded-[18px] border border-cyan-300/30 bg-[#151725] px-3.5 py-3 text-left transition hover:border-cyan-200/45 hover:bg-[#1a1d2e]"
            @click="sharePoll"
          >
            <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-300/12 text-cyan-300">
              <i class="fa-solid fa-share-nodes" aria-hidden="true"></i>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-black text-white">{{ $t('polls.detail.sharePoll') }}</span>
              <span class="mt-0.5 block truncate text-[11px] font-semibold text-white/60">{{ $t('polls.detail.freeVoteMissionsShare') }}</span>
            </span>
            <span class="text-lg text-white/45" aria-hidden="true">›</span>
          </button>

          <button
            v-if="showMissionsPromptDownloadCta"
            type="button"
            class="group relative mt-3 flex w-full items-center gap-3 overflow-hidden rounded-[1.35rem] border border-fuchsia-300/45 bg-linear-to-r from-[#3b0a58] via-[#1d0b33] to-[#0d0820] px-3 py-3 text-left shadow-[0_0_28px_rgba(217,70,239,0.28)] transition hover:border-fuchsia-200/60 hover:shadow-[0_0_36px_rgba(217,70,239,0.4)]"
            @click="openAppDownloadFromPrompt"
          >
            <span
              class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_40%,rgba(236,72,153,0.35),transparent_45%),radial-gradient(circle_at_90%_70%,rgba(34,211,238,0.16),transparent_40%)]"
              aria-hidden="true"
            ></span>
            <span class="relative shrink-0">
              <span
                class="absolute -inset-1 rounded-[1.1rem] bg-fuchsia-400/25 blur-md"
                aria-hidden="true"
              ></span>
              <img
                src="/app-download-phone.png"
                alt=""
                class="relative h-[4.5rem] w-auto drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
                width="72"
                height="72"
                aria-hidden="true"
              />
            </span>
            <span class="relative min-w-0 flex-1">
              <span
                v-if="appDownloadPrompt.firstOpenRewardEnabled && appDownloadPrompt.firstOpenRewardPoints > 0"
                class="mb-1 inline-flex rounded-full border border-amber-300/35 bg-amber-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-100"
              >
                +{{ appDownloadPrompt.firstOpenRewardPoints }} pts
              </span>
              <span class="block text-[13px] font-black uppercase tracking-wide text-white">{{
                $t("polls.detail.freeVoteMissionsDownloadGo")
              }}</span>
              <span class="mt-0.5 block text-[11px] font-semibold leading-4 text-fuchsia-100/80">{{
                appDownloadPrompt.firstOpenRewardEnabled &&
                appDownloadPrompt.firstOpenRewardPoints > 0
                  ? $t("polls.detail.freeVoteMissionsDownloadHintPoints", {
                      points: appDownloadPrompt.firstOpenRewardPoints,
                    })
                  : $t("polls.detail.freeVoteMissionsDownloadHint")
              }}</span>
            </span>
            <span
              class="relative grid size-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-base text-white/80 transition group-hover:bg-white/18 group-hover:text-white"
              aria-hidden="true"
            >
              ›
            </span>
          </button>
          <button
            v-else
            type="button"
            class="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-fuchsia-950/40 transition hover:scale-[1.01]"
            @click="goToMissionsFromPrompt"
          >
            {{ $t("polls.detail.freeVoteMissionsGo") }}
          </button>
          <button
            type="button"
            class="mt-2 min-h-10 w-full text-sm font-bold text-white/65 transition hover:text-white"
            @click="closeMissionsPrompt"
          >
            {{ $t("polls.detail.freeVoteMissionsLater") }}
          </button>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <Transition name="live-vote-banner">
        <div
          v-if="anonymousVoteSuccessToast"
          :key="anonymousVoteSuccessToast.token"
          class="live-vote-banner pointer-events-none fixed inset-x-0 top-0 z-[1000]"
          role="status"
          aria-live="polite"
        >
          <p
            class="live-vote-banner-bar mx-auto flex w-full max-w-5xl items-center justify-center gap-2.5 border-b border-emerald-300/30 bg-slate-950/94 px-4 pb-3 pt-[max(0.65rem,env(safe-area-inset-top))] text-center text-sm font-black leading-6 text-white shadow-lg shadow-emerald-950/35 backdrop-blur-md sm:gap-3 sm:px-6 sm:pb-3.5 sm:pt-[max(0.75rem,env(safe-area-inset-top))] sm:text-base"
          >
            <span
              class="grid size-8 shrink-0 place-items-center rounded-full border border-emerald-200/30 bg-emerald-400/15 text-sm text-emerald-100 sm:size-9 sm:text-base"
              aria-hidden="true"
            >
              <i class="fa-solid fa-check"></i>
            </span>
            <span class="min-w-0 text-pretty">
              {{
                $t("polls.detail.anonymousVoteSuccessNotice", {
                  artist: anonymousVoteSuccessToast.artistName,
                })
              }}
            </span>
          </p>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.signup-prompt-modal {
  animation: signup-prompt-in 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.signup-prompt-badge {
  animation: signup-prompt-badge 1.9s ease-in-out infinite;
}

.signup-prompt-orbit {
  animation: signup-prompt-orbit 8s linear infinite;
  box-shadow: 0 0 80px rgba(34, 211, 238, 0.16);
}

.embed-loader-card {
  isolation: isolate;
}

.embed-loader-icon {
  animation: embed-loader-pulse 2s ease-in-out infinite;
}

.embed-loader-bar {
  animation: embed-loader-bar 0.9s ease-in-out infinite;
  box-shadow: 0 0 18px rgba(217, 70, 239, 0.22);
}

.embed-loader-bar:nth-child(2) {
  animation-delay: 120ms;
}

.embed-loader-bar:nth-child(3) {
  animation-delay: 240ms;
}

.embed-loader-bar:nth-child(4) {
  animation-delay: 360ms;
}

.counter-embed-bar {
  animation: counter-embed-bar 2.4s ease-in-out infinite;
  transform-origin: left center;
}

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

.poll-contestant-enter {
  animation: none;
}

.poll-state-panel {
  animation: poll-state-panel-in 0.46s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.ranking-shift-move,
.ranking-shift-enter-active,
.ranking-shift-leave-active {
  transition:
    transform 0.58s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.32s ease,
    filter 0.32s ease,
    box-shadow 0.42s ease;
}

.ranking-shift-move {
  box-shadow: 0 0 34px rgba(217, 70, 239, 0.18);
  z-index: 2;
}

.ranking-shift-enter-from,
.ranking-shift-leave-to {
  opacity: 0;
  filter: blur(5px);
  transform: translateY(16px) scale(0.985);
}

.ranking-shift-leave-active {
  position: absolute;
  width: 100%;
}

.vote-feedback-card {
  animation: vote-feedback-card 1.1s ease-out;
}

.contestant-stats-stack {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-start;
  gap: 0.12rem;
  min-height: 2.65rem;
}

.contestant-stat-votes,
.contestant-stat-percent {
  line-height: 1.1;
}

.vote-feedback-overlay,
.vote-feedback-slot,
.vote-feedback-badge-inline,
.vote-feedback-badge {
  display: none;
}

.vote-feedback-notice {
  position: absolute;
  right: 0.85rem;
  top: 0.85rem;
  z-index: 40;
  max-width: calc(100% - 1.7rem);
  border-radius: 9999px;
  border: 1px solid rgba(110, 231, 183, 0.46);
  background: linear-gradient(
    90deg,
    rgba(6, 78, 59, 0.96),
    rgba(8, 47, 73, 0.96)
  );
  padding: 0.4rem 0.75rem;
  color: #d1fae5;
  font-size: 0.62rem;
  font-weight: 1000;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 0 24px rgba(16, 185, 129, 0.32);
  animation: vote-feedback-notice 0.35s ease-out both;
  pointer-events: none;
}

@media (min-width: 640px) {
  .vote-feedback-notice {
    font-size: 0.68rem;
    padding: 0.45rem 0.85rem;
    letter-spacing: 0.16em;
  }
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

@keyframes signup-prompt-in {
  from {
    opacity: 0;
    transform: translateY(1rem) scale(0.94);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes signup-prompt-badge {
  0%,
  100% {
    transform: translateY(0) scale(1);
    filter: drop-shadow(0 0 18px rgba(34, 211, 238, 0.28));
  }

  50% {
    transform: translateY(-0.25rem) scale(1.05);
    filter: drop-shadow(0 0 30px rgba(236, 72, 153, 0.34));
  }
}

@keyframes signup-prompt-orbit {
  from {
    transform: rotate(0deg) scale(1);
  }

  to {
    transform: rotate(360deg) scale(1.04);
  }
}

@keyframes embed-loader-pulse {
  0%,
  100% {
    transform: scale(1);
    filter: drop-shadow(0 0 18px rgba(217, 70, 239, 0.22));
  }

  50% {
    transform: scale(1.04);
    filter: drop-shadow(0 0 32px rgba(34, 211, 238, 0.28));
  }
}

@keyframes embed-loader-bar {
  0%,
  100% {
    transform: scaleY(0.55);
    opacity: 0.65;
  }

  50% {
    transform: scaleY(1);
    opacity: 1;
  }
}

@keyframes counter-embed-bar {
  0%,
  100% {
    transform: scaleX(0.82);
    filter: brightness(0.9);
  }

  50% {
    transform: scaleX(1);
    filter: brightness(1.2);
  }
}

@keyframes poll-contestant-in {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.985);
    filter: blur(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

@keyframes poll-state-panel-in {
  from {
    opacity: 0;
    transform: translateY(14px);
    filter: blur(5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

@keyframes vote-feedback-card {
  0% {
    border-color: rgba(110, 231, 183, 0.72);
    box-shadow:
      0 0 0 0 rgba(45, 212, 191, 0.56),
      0 0 44px rgba(34, 211, 238, 0.28);
  }

  35% {
    border-color: rgba(244, 114, 182, 0.72);
    box-shadow:
      0 0 0 8px rgba(45, 212, 191, 0),
      0 0 52px rgba(217, 70, 239, 0.32);
  }

  100% {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: none;
  }
}

@keyframes vote-feedback-badge {
  0% {
    opacity: 0;
    transform: translateY(0.35rem);
  }

  20% {
    opacity: 1;
    transform: translateY(0);
  }

  80% {
    opacity: 1;
    transform: translateY(0);
  }

  100% {
    opacity: 0;
    transform: translateY(-0.2rem);
  }
}

@keyframes vote-feedback-notice {
  0% {
    opacity: 0;
  }

  100% {
    opacity: 1;
  }
}

.embed-duel-grid {
  position: relative;
}

.versus-vs-overlay,
.embed-duel-vs-layer {
  /* Match the image row height (2 side-by-side 5/4 images) so VS sits in the photo center. */
  aspect-ratio: 5 / 2;
}

@media (min-width: 640px) {
  .versus-vs-overlay:not(.embed-duel-vs-layer) {
    aspect-ratio: auto;
    height: 13rem;
  }
}

@media (min-width: 768px) {
  .versus-vs-overlay:not(.embed-duel-vs-layer) {
    height: 19.5rem;
  }
}

@media (min-width: 640px) {
  .embed-duel-vs-layer {
    aspect-ratio: auto;
    height: 18rem;
  }
}

@media (min-width: 768px) {
  .embed-duel-vs-layer {
    height: 20rem;
  }
}

.embed-vs-badge {
  position: relative;
  animation: embed-vs-pulse 2.2s ease-in-out infinite;
}

.embed-vs-badge::before {
  position: absolute;
  inset: -0.65rem;
  z-index: -1;
  border-radius: 9999px;
  background: conic-gradient(
    from 0deg,
    rgba(34, 211, 238, 0.45),
    rgba(217, 70, 239, 0.85),
    rgba(251, 191, 36, 0.55),
    rgba(34, 211, 238, 0.45)
  );
  content: "";
  filter: blur(10px);
  opacity: 0.85;
  animation: embed-vs-orbit 2.8s linear infinite;
}

@keyframes embed-vs-pulse {
  0%,
  100% {
    transform: scale(1) rotate(-3deg);
    box-shadow:
      0 0 28px rgba(217, 70, 239, 0.45),
      0 0 0 0 rgba(34, 211, 238, 0.32);
  }

  50% {
    transform: scale(1.1) rotate(3deg);
    box-shadow:
      0 0 44px rgba(34, 211, 238, 0.55),
      0 0 0 12px rgba(217, 70, 239, 0);
  }
}

@keyframes embed-vs-orbit {
  to {
    transform: rotate(360deg);
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

:global(.live-vote-banner-enter-active),
:global(.live-vote-banner-leave-active) {
  transition:
    opacity 0.28s ease,
    transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

:global(.live-vote-banner-enter-from),
:global(.live-vote-banner-leave-to) {
  opacity: 0;
  transform: translateY(-12px);
}

.live-vote-flash-card {
  animation: live-vote-flash-card 1.35s ease-out;
}

.live-stat-boost .contestant-stat-votes {
  animation: live-stat-boost 1.1s ease-out;
}

.live-stat-boost .contestant-stat-percent,
.live-stat-boost .live-percent-pulse {
  animation: live-percent-pulse 1.15s ease-out;
}

.live-vote-bar-shell {
  box-shadow: 0 0 0 1px rgba(244, 114, 182, 0.28);
  background: rgba(255, 255, 255, 0.12);
}

.poll-vote-bar-fill {
  background: linear-gradient(90deg, #67e8f9, #f0abfc);
}

.live-vote-flash-bar {
  animation: live-vote-flash-bar 1.2s ease-out;
}

.poll-vote-bar-fill[data-flash]:not([data-flash=""]) {
  animation: live-vote-flash-bar 1.2s ease-out;
}

@keyframes live-stat-boost {
  0%,
  100% {
    color: inherit;
    text-shadow: none;
  }

  35% {
    color: #fef9c3;
    text-shadow:
      0 0 10px rgba(250, 204, 21, 0.85),
      0 0 22px rgba(217, 70, 239, 0.45);
  }

  65% {
    color: #f5d0fe;
    text-shadow: 0 0 8px rgba(232, 121, 249, 0.55);
  }
}

@keyframes live-vote-flash-bar {
  0%,
  100% {
    background: linear-gradient(90deg, #67e8f9, #f0abfc);
    box-shadow: none;
  }

  30% {
    background: linear-gradient(90deg, #fde047, #34d399);
    box-shadow: 0 0 16px rgba(52, 211, 153, 0.75);
  }

  60% {
    background: linear-gradient(90deg, #fbbf24, #22d3ee);
    box-shadow: 0 0 12px rgba(250, 204, 21, 0.55);
  }
}

@keyframes live-vote-flash-card {
  0% {
    box-shadow:
      0 0 0 0 rgba(244, 114, 182, 0.65),
      0 0 28px rgba(217, 70, 239, 0.28);
    border-color: rgba(244, 114, 182, 0.72);
  }

  45% {
    box-shadow:
      0 0 0 14px rgba(244, 114, 182, 0),
      0 0 36px rgba(217, 70, 239, 0.38);
    border-color: rgba(217, 70, 239, 0.55);
  }

  100% {
    box-shadow: none;
    border-color: rgba(255, 255, 255, 0.1);
  }
}
</style>
