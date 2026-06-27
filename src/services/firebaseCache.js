import { getArtists, getPopularityRanking } from "./api/artistsApi";
import { getLivePolls, getPolls } from "./api/pollsApi";

const ARTISTS_CACHE_MS = 5 * 60 * 1000;
const POLLS_CACHE_MS = 90 * 1000;
const RANKING_CACHE_MS = 2 * 60 * 1000;
const PUBLIC_ARTISTS_LIMIT = 250;
const PUBLIC_POLLS_LIMIT = 100;
const LIVE_POLLS_LIMIT = 12;
const RANKING_ARTISTS_LIMIT = 100;

let artistsCache = {
  loadedAt: 0,
  rows: [],
  promise: null,
  subscribers: new Set(),
};

let livePollsCache = {
  rows: [],
  subscribers: new Set(),
};

let pollsCache = {
  loadedAt: 0,
  rows: [],
  promise: null,
  subscribers: new Set(),
};

let followersCountCache = new Map();

let rankingPopularityCache = {
  loadedAt: 0,
  rows: [],
  promise: null,
};

const notify = (subscribers, rows) => {
  subscribers.forEach((callback) => callback(rows));
};

const dateLike = (value) => {
  if (!value || typeof value !== "string") {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
  };
};

const normalizeArtist = (artist) => {
  const metadata = artist?.metadata || {};
  const image = artist?.image || artist?.imageUrl || artist?.photo || artist?.photoURL || artist?.foto || artist?.banner || artist?.photoUrl || metadata.image || metadata.imageUrl || metadata.photo || metadata.photoURL || metadata.foto || metadata.banner || "";

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

const normalizeRound = (round) => {
  const metadata = round?.metadata || round?.config || {};

  return {
    ...metadata,
    ...round,
    id: String(round.id),
    firebaseId: round.firebaseId || metadata.id || null,
    createdAt: dateLike(round.createdAt),
    updatedAt: dateLike(round.updatedAt),
    startsAt: dateLike(round.startsAt || metadata.startsAt || metadata.startAt),
    startAt: dateLike(round.startsAt || metadata.startsAt || metadata.startAt),
    endsAt: dateLike(round.endsAt || metadata.endsAt || metadata.endAt),
    endAt: dateLike(round.endsAt || metadata.endsAt || metadata.endAt),
  };
};

const normalizePoll = (poll) => {
  const metadata = poll?.metadata || poll?.config || {};
  const category = poll?.category || null;
  const rounds = (poll.rounds || []).map(normalizeRound);
  const liveRound = rounds.find((round) => round.status === "live") || rounds[0] || null;

  return {
    ...metadata,
    ...poll,
    id: String(poll.id),
    firebaseId: poll.firebaseId || metadata.id || null,
    categoryId: poll.categoryId ? String(poll.categoryId) : metadata.categoryId || category?.id || "",
    categoryName: category?.name || metadata.categoryName || metadata.category || "",
    category: category?.name || metadata.category || "",
    year: Number(metadata.year || poll.year || new Date().getFullYear()),
    activeRoundId: poll.activeRoundId || metadata.activeRoundId || liveRound?.id || "",
    totalVotes: Number(poll.totalVotes || 0),
    leaderArtistId: poll.leaderArtistId ? String(poll.leaderArtistId) : metadata.leaderArtistId || null,
    leaderVotes: Number(poll.leaderVotes || 0),
    publicActivity: metadata.publicActivity || [],
    createdAt: dateLike(poll.createdAt),
    updatedAt: dateLike(poll.updatedAt),
    startsAt: dateLike(poll.startsAt || metadata.startsAt || metadata.startAt),
    startAt: dateLike(poll.startsAt || metadata.startsAt || metadata.startAt),
    endsAt: dateLike(poll.endsAt || metadata.endsAt || metadata.endAt),
    endAt: dateLike(poll.endsAt || metadata.endsAt || metadata.endAt),
    activeEndAt: dateLike(poll.activeEndAt || metadata.activeEndAt),
    rounds,
  };
};

export const getArtistsCached = async (_db, maxAgeMs = ARTISTS_CACHE_MS) => {
  const now = Date.now();

  if (artistsCache.rows.length && now - artistsCache.loadedAt < maxAgeMs) {
    return artistsCache.rows;
  }

  if (!artistsCache.promise) {
    artistsCache.promise = getArtists(PUBLIC_ARTISTS_LIMIT)
      .then((artistRows) => {
        artistsCache.rows = artistRows.map(normalizeArtist);
        artistsCache.loadedAt = Date.now();
        return artistsCache.rows;
      })
      .finally(() => {
        artistsCache.promise = null;
      });
  }

  return artistsCache.promise;
};

export const getArtistFollowersCountCached = async (_db, artistId, fallbackCount = 0) => {
  if (!artistId) {
    return Number(fallbackCount || 0);
  }

  if (followersCountCache.has(artistId)) {
    return followersCountCache.get(artistId);
  }

  const count = Number(fallbackCount || 0);
  followersCountCache.set(artistId, count);
  return count;
};

export const subscribeArtistsCached = (db, callback) => {
  artistsCache.subscribers.add(callback);

  if (artistsCache.rows.length) {
    callback(artistsCache.rows);
  }

  getArtistsCached(db)
    .then((rows) => notify(artistsCache.subscribers, rows))
    .catch(() => {});

  return () => {
    artistsCache.subscribers.delete(callback);
  };
};

export const getPollsCached = async (_db, maxAgeMs = POLLS_CACHE_MS) => {
  const now = Date.now();

  if (pollsCache.rows.length && now - pollsCache.loadedAt < maxAgeMs) {
    return pollsCache.rows;
  }

  if (!pollsCache.promise) {
    pollsCache.promise = getPolls(PUBLIC_POLLS_LIMIT)
      .then((pollRows) => {
        pollsCache.rows = pollRows.map(normalizePoll);
        pollsCache.loadedAt = Date.now();
        return pollsCache.rows;
      })
      .finally(() => {
        pollsCache.promise = null;
      });
  }

  return pollsCache.promise;
};

export const subscribePollsCached = (db, callback, onError = () => {}) => {
  pollsCache.subscribers.add(callback);

  if (pollsCache.rows.length) {
    callback(pollsCache.rows);
  }

  getPollsCached(db)
    .then((rows) => notify(pollsCache.subscribers, rows))
    .catch(onError);

  return () => {
    pollsCache.subscribers.delete(callback);
  };
};

export const subscribeLivePollsCached = (_db, callback, onError = () => {}) => {
  livePollsCache.subscribers.add(callback);

  if (livePollsCache.rows.length) {
    callback(livePollsCache.rows);
  }

  getLivePolls(LIVE_POLLS_LIMIT)
    .then((pollRows) => {
      livePollsCache.rows = pollRows.map(normalizePoll);
      notify(livePollsCache.subscribers, livePollsCache.rows);
    })
    .catch(onError);

  return () => {
    livePollsCache.subscribers.delete(callback);
  };
};

const buildRankingArtistRows = (artistRows) =>
  artistRows.map((artist) => {
    const followersCount = Number(artist.followersCount || 0);
    const totalVotes = Number(artist.totalVotes || 0);

    return {
      ...artist,
      followersCount,
      totalVotes,
      popularityScore: Number(artist.popularityScore ?? Math.round(followersCount * 10 + totalVotes)),
    };
  });

export const getRankingPopularityCached = async (_db, maxAgeMs = RANKING_CACHE_MS) => {
  const now = Date.now();

  if (rankingPopularityCache.rows.length && now - rankingPopularityCache.loadedAt < maxAgeMs) {
    return rankingPopularityCache.rows;
  }

  if (!rankingPopularityCache.promise) {
    rankingPopularityCache.promise = getPopularityRanking(RANKING_ARTISTS_LIMIT)
      .then((rows) => {
        const artistRows = rows.map(normalizeArtist);
        rankingPopularityCache.rows = buildRankingArtistRows(artistRows)
          .sort((current, next) => Number(next.popularityScore || 0) - Number(current.popularityScore || 0))
          .slice(0, RANKING_ARTISTS_LIMIT);
        rankingPopularityCache.loadedAt = Date.now();
        return rankingPopularityCache.rows;
      })
      .finally(() => {
        rankingPopularityCache.promise = null;
      });
  }

  return rankingPopularityCache.promise;
};

export const getArtistsWithFollowersCached = async (db) => {
  const artistRows = await getArtistsCached(db);

  return artistRows.map((artist) => {
    const followersCount = Number(artist.followersCount || 0);

    return {
      ...artist,
      followersCount,
      popularityScore: Number(artist.popularityScore || followersCount * 10 || 0),
    };
  });
};

const withTimeout = (promise, timeoutMs = 4500) =>
  Promise.race([
    promise,
    new Promise((resolve) => {
      window.setTimeout(resolve, timeoutMs);
    }),
  ]);

export const preloadRouteData = (db, path) => {
  if (path === "/votaciones") {
    return withTimeout(getPollsCached(db));
  }

  if (path === "/") {
    return withTimeout(getPollsCached(db));
  }

  return Promise.resolve();
};
