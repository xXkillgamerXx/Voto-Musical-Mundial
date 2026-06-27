import { getPoll, getPollResults } from "./api/pollsApi";

const DEFAULT_AGGREGATION_MS = 30 * 1000;
const PUBLIC_RESULTS_REFRESH_MS = 30 * 1000;

const normalizeArtist = (artist) => {
  if (!artist) return null;
  const metadata = artist.metadata || {};
  const image = artist.image || artist.imageUrl || artist.photo || artist.photoURL || artist.foto || artist.banner || artist.photoUrl || metadata.image || metadata.imageUrl || metadata.photo || metadata.photoURL || metadata.foto || metadata.banner || "";

  return {
    ...metadata,
    ...artist,
    id: String(artist.id),
    image,
    imageUrl: image,
    photo: image,
    photoURL: image,
    banner: metadata.banner || metadata.bannerUrl || metadata.cover || metadata.coverImage || image,
    followersCount: Number(artist.followersCount || metadata.followersCount || 0),
    totalVotes: Number(artist.totalVotes || metadata.totalVotes || 0),
    popularityScore: Number(artist.popularityScore || metadata.popularityScore || 0),
  };
};

const normalizeContestant = (contestant) => {
  const metadata = contestant.metadata || {};
  const artist = normalizeArtist(contestant.artist);
  const artistId = String(contestant.artistId || artist?.id || metadata.artistId || contestant.id);

  return {
    ...metadata,
    ...contestant,
    id: String(contestant.id),
    firebaseId: contestant.firebaseId || metadata.id || null,
    artistId,
    artist,
    votes: Number(contestant.votes || 0),
    manualVotes: Number(contestant.manualVotes || 0),
    totalVotes: normalizeContestantVotes(contestant),
    matchGroup: Number(contestant.matchGroup || 0),
    matchOrder: Number(contestant.matchOrder || 0),
    order: Number(contestant.order || 0),
    roundId: contestant.roundId ? String(contestant.roundId) : metadata.roundId || null,
  };
};

export const normalizeContestantVotes = (contestant) =>
  Number(contestant.totalVotes ?? (contestant.votes || 0) + (contestant.manualVotes || 0));

export const loadContestantMetadata = async (_db, pollId, roundId) => {
  const poll = await getPoll(pollId);
  const requestedRoundId = roundId ? String(roundId) : null;

  return (poll.contestants || [])
    .map(normalizeContestant)
    .filter((contestant) => {
      if (!requestedRoundId) {
        return !contestant.roundId;
      }

      return contestant.roundId === requestedRoundId || contestant.firebaseId === requestedRoundId;
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
  _db,
  { pollId, roundId, onData, onError = () => {} },
) => {
  let stopped = false;
  let timer = null;

  const load = async () => {
    if (stopped || !pollId) {
      return;
    }

    try {
      const results = await getPollResults({ pollId, roundId });
      if (stopped) {
        return;
      }
      onData(results);
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

export const aggregatePublicResults = async (_db, { pollId, round }) => {
  return getPollResults({ pollId, roundId: round?.id || null });
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
