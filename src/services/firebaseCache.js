import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";

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

export const getArtistsCached = async (db, maxAgeMs = ARTISTS_CACHE_MS) => {
  const now = Date.now();

  if (artistsCache.rows.length && now - artistsCache.loadedAt < maxAgeMs) {
    return artistsCache.rows;
  }

  if (!artistsCache.promise) {
    artistsCache.promise = getDocs(query(collection(db, "artists"), limit(PUBLIC_ARTISTS_LIMIT)))
      .then((artistsSnap) => {
        artistsCache.rows = artistsSnap.docs.map((artistDoc) => ({
          id: artistDoc.id,
          ...artistDoc.data(),
        }));
        artistsCache.loadedAt = Date.now();
        return artistsCache.rows;
      })
      .finally(() => {
        artistsCache.promise = null;
      });
  }

  return artistsCache.promise;
};

export const getArtistFollowersCountCached = async (db, artistId, fallbackCount = 0) => {
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

export const getPollsCached = async (db, maxAgeMs = POLLS_CACHE_MS) => {
  const now = Date.now();

  if (pollsCache.rows.length && now - pollsCache.loadedAt < maxAgeMs) {
    return pollsCache.rows;
  }

  if (!pollsCache.promise) {
    pollsCache.promise = getDocs(
      query(collection(db, "polls"), orderBy("createdAt", "desc"), limit(PUBLIC_POLLS_LIMIT)),
    )
      .then((pollsSnap) => {
        pollsCache.rows = pollsSnap.docs.map((pollDoc) => ({
          id: pollDoc.id,
          ...pollDoc.data(),
        }));
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

export const subscribeLivePollsCached = (db, callback, onError = () => {}) => {
  livePollsCache.subscribers.add(callback);

  if (livePollsCache.rows.length) {
    callback(livePollsCache.rows);
  }

  getDocs(
      query(
        collection(db, "polls"),
        where("status", "in", ["live", "selecting_winners"]),
        limit(LIVE_POLLS_LIMIT),
      ),
    )
    .then((pollsSnap) => {
        livePollsCache.rows = pollsSnap.docs.map((pollDoc) => ({
          id: pollDoc.id,
          ...pollDoc.data(),
        }));
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

export const getRankingPopularityCached = async (db, maxAgeMs = RANKING_CACHE_MS) => {
  const now = Date.now();

  if (rankingPopularityCache.rows.length && now - rankingPopularityCache.loadedAt < maxAgeMs) {
    return rankingPopularityCache.rows;
  }

  if (!rankingPopularityCache.promise) {
    rankingPopularityCache.promise = getDocs(
      query(
        collection(db, "artists"),
        orderBy("popularityScore", "desc"),
        limit(RANKING_ARTISTS_LIMIT),
      ),
    )
      .then((artistsSnap) => {
        const artistRows = artistsSnap.docs.map((artistDoc) => ({
          id: artistDoc.id,
          ...artistDoc.data(),
        }));
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
