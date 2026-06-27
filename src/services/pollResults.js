import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const DEFAULT_AGGREGATION_MS = 30 * 1000;
const PUBLIC_RESULTS_REFRESH_MS = 30 * 1000;
const RECENT_ACTIVITY_LIMIT = 12;

const roundCollection = (db, pollId, roundId, collectionName) =>
  roundId
    ? collection(db, "polls", pollId, "rounds", roundId, collectionName)
    : collection(db, "polls", pollId, collectionName);

const roundDoc = (db, pollId, roundId, collectionName, docId) =>
  roundId
    ? doc(db, "polls", pollId, "rounds", roundId, collectionName, docId)
    : doc(db, "polls", pollId, collectionName, docId);

export const normalizeContestantVotes = (contestant) =>
  Number(contestant.totalVotes ?? (contestant.votes || 0) + (contestant.manualVotes || 0));

export const loadContestantMetadata = async (db, pollId, roundId) => {
  const contestantsSnap = await getDocs(
    roundCollection(db, pollId, roundId, "contestants"),
  );

  return contestantsSnap.docs.map((contestantDoc) => {
    const contestant = contestantDoc.data();

    return {
      id: contestantDoc.id,
      ...contestant,
      artistId: contestant.artistId || contestantDoc.id,
      totalVotes: normalizeContestantVotes(contestant),
    };
  });
};

export const mergeContestantsWithPublicResults = (contestants, publicResults) => {
  const resultsByArtist = new Map(
    (publicResults?.results || []).map((result) => [result.artistId, result]),
  );

  return contestants.map((contestant) => {
    const result = resultsByArtist.get(contestant.artistId || contestant.id);

    return {
      ...contestant,
      totalVotes: Number(result?.totalVotes ?? contestant.totalVotes ?? 0),
      votes: Number(result?.votes ?? contestant.votes ?? 0),
      manualVotes: Number(result?.manualVotes ?? contestant.manualVotes ?? 0),
      percent: Number(result?.percent || 0),
      rank: result?.rank || null,
    };
  });
};

export const subscribePublicResults = (
  db,
  { pollId, roundId, onData, onError = () => {} },
) => {
  let stopped = false;
  let timer = null;

  const load = async () => {
    if (stopped || !pollId) {
      return;
    }

    try {
      const resultsSnap = await getDoc(roundDoc(db, pollId, roundId, "publicResults", "current"));
      if (stopped) {
        return;
      }
      onData(resultsSnap.exists() ? { id: resultsSnap.id, ...resultsSnap.data() } : null);
    } catch (error) {
      onError(error);
    }
  };

  load();
  timer = window.setInterval(load, PUBLIC_RESULTS_REFRESH_MS);

  return () => {
    stopped = true;
    if (timer) {
      window.clearInterval(timer);
    }
  };
};

const loadRecentActivity = async (db, pollId, roundId) => {
  const activitySnap = await getDocs(
    query(
      roundCollection(db, pollId, roundId, "userVoteBatches"),
      orderBy("createdAt", "desc"),
      limit(RECENT_ACTIVITY_LIMIT),
    ),
  );

  return activitySnap.docs.map((activityDoc) => ({
    id: activityDoc.id,
    ...activityDoc.data(),
  }));
};

export const aggregatePublicResults = async (db, { pollId, round }) => {
  const roundId = round?.id || null;
  const [contestants, shardsSnap] = await Promise.all([
    loadContestantMetadata(db, pollId, roundId),
    getDocs(roundCollection(db, pollId, roundId, "voteShards")),
  ]);
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

  const results = contestants
    .map((contestant) => {
      const artistId = contestant.artistId || contestant.id;
      const legacyVotes = Number(contestant.votes || 0);
      const shardVotes = shardVotesByArtist.get(artistId) || 0;
      const manualVotes = Number(contestant.manualVotes || 0);
      const totalVotes = legacyVotes + shardVotes + manualVotes;

      return {
        id: contestant.id,
        artistId,
        votes: legacyVotes + shardVotes,
        manualVotes,
        totalVotes,
        order: Number(contestant.order || 0),
        matchGroup: Number(contestant.matchGroup || 0),
        matchOrder: Number(contestant.matchOrder || 0),
      };
    })
    .sort((current, next) => next.totalVotes - current.totalVotes);

  const totalVotes = results.reduce((total, result) => total + result.totalVotes, 0);
  const rankedResults = results.map((result, index) => ({
    ...result,
    rank: index + 1,
    percent: totalVotes ? (result.totalVotes / totalVotes) * 100 : 0,
  }));
  const leader = rankedResults[0] || null;
  const recentActivity = await loadRecentActivity(db, pollId, roundId).catch(() => []);
  const payload = {
    pollId,
    roundId,
    totalVotes,
    leaderArtistId: leader?.artistId || null,
    leaderVotes: Number(leader?.totalVotes || 0),
    results: rankedResults,
    recentActivity,
    aggregationIntervalMs: DEFAULT_AGGREGATION_MS,
    updatedAt: serverTimestamp(),
  };

  await setDoc(roundDoc(db, pollId, roundId, "publicResults", "current"), payload, {
    merge: true,
  });
  await setDoc(
    doc(db, "polls", pollId),
    {
      totalVotes,
      leaderArtistId: payload.leaderArtistId,
      leaderVotes: payload.leaderVotes,
      activeEndAt: round?.endAt || null,
      publicActivity: recentActivity.slice(0, 8),
      publicResultsUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return payload;
};

export const startPublicResultsAggregator = ({
  db,
  pollId,
  getRound,
  intervalMs = DEFAULT_AGGREGATION_MS,
  onError = () => {},
}) => {
  let timer = null;
  let stopped = false;
  let isAggregating = false;

  const tick = async () => {
    if (stopped || isAggregating) {
      return;
    }

    const round = getRound?.();

    if (!pollId || !round?.id) {
      return;
    }

    isAggregating = true;
    try {
      await aggregatePublicResults(db, { pollId, round });
    } catch (error) {
      onError(error);
    } finally {
      isAggregating = false;
    }
  };

  tick();
  timer = window.setInterval(tick, intervalMs);

  return () => {
    stopped = true;
    if (timer) {
      window.clearInterval(timer);
    }
  };
};
