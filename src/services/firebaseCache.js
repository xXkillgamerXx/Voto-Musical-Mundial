import { collection, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";

const ARTISTS_CACHE_MS = 5 * 60 * 1000;
const POLLS_CACHE_MS = 90 * 1000;
const RANKING_CACHE_MS = 2 * 60 * 1000;

let artistsCache = {
  loadedAt: 0,
  rows: [],
  promise: null,
  unsubscribe: null,
  subscribers: new Set(),
};

let livePollsCache = {
  rows: [],
  unsubscribe: null,
  subscribers: new Set(),
};

let pollsCache = {
  loadedAt: 0,
  rows: [],
  promise: null,
  unsubscribe: null,
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
    artistsCache.promise = getDocs(collection(db, "artists"))
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

  try {
    const followersSnap = await getDocs(collection(db, "artists", artistId, "followers"));
    followersCountCache.set(artistId, followersSnap.size);
    return followersSnap.size;
  } catch {
    const count = Number(fallbackCount || 0);
    followersCountCache.set(artistId, count);
    return count;
  }
};

export const subscribeArtistsCached = (db, callback) => {
  artistsCache.subscribers.add(callback);

  if (artistsCache.rows.length) {
    callback(artistsCache.rows);
  }

  if (!artistsCache.unsubscribe) {
    artistsCache.unsubscribe = onSnapshot(collection(db, "artists"), (artistsSnap) => {
      artistsCache.rows = artistsSnap.docs.map((artistDoc) => ({
        id: artistDoc.id,
        ...artistDoc.data(),
      }));
      artistsCache.loadedAt = Date.now();
      notify(artistsCache.subscribers, artistsCache.rows);
    });
  }

  return () => {
    artistsCache.subscribers.delete(callback);
    if (!artistsCache.subscribers.size && artistsCache.unsubscribe) {
      artistsCache.unsubscribe();
      artistsCache.unsubscribe = null;
    }
  };
};

export const getPollsCached = async (db, maxAgeMs = POLLS_CACHE_MS) => {
  const now = Date.now();

  if (pollsCache.rows.length && now - pollsCache.loadedAt < maxAgeMs) {
    return pollsCache.rows;
  }

  if (!pollsCache.promise) {
    pollsCache.promise = getDocs(query(collection(db, "polls"), orderBy("createdAt", "desc")))
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

  if (!pollsCache.unsubscribe) {
    pollsCache.unsubscribe = onSnapshot(
      query(collection(db, "polls"), orderBy("createdAt", "desc")),
      (pollsSnap) => {
        pollsCache.rows = pollsSnap.docs.map((pollDoc) => ({
          id: pollDoc.id,
          ...pollDoc.data(),
        }));
        pollsCache.loadedAt = Date.now();
        notify(pollsCache.subscribers, pollsCache.rows);
      },
      onError,
    );
  }

  return () => {
    pollsCache.subscribers.delete(callback);
    if (!pollsCache.subscribers.size && pollsCache.unsubscribe) {
      pollsCache.unsubscribe();
      pollsCache.unsubscribe = null;
    }
  };
};

export const subscribeLivePollsCached = (db, callback, onError = () => {}) => {
  livePollsCache.subscribers.add(callback);

  if (livePollsCache.rows.length) {
    callback(livePollsCache.rows);
  }

  if (!livePollsCache.unsubscribe) {
    livePollsCache.unsubscribe = onSnapshot(
      query(collection(db, "polls"), where("status", "in", ["live", "selecting_winners"])),
      (pollsSnap) => {
        livePollsCache.rows = pollsSnap.docs.map((pollDoc) => ({
          id: pollDoc.id,
          ...pollDoc.data(),
        }));
        notify(livePollsCache.subscribers, livePollsCache.rows);
      },
      onError,
    );
  }

  return () => {
    livePollsCache.subscribers.delete(callback);
    if (!livePollsCache.subscribers.size && livePollsCache.unsubscribe) {
      livePollsCache.unsubscribe();
      livePollsCache.unsubscribe = null;
    }
  };
};

const getArtistFieldId = (row) => row?.artistId || row?.id || "";

const addVotesToArtist = (totalsByArtist, artistId, amount) => {
  if (!artistId || !amount) {
    return;
  }

  totalsByArtist.set(
    artistId,
    Number(totalsByArtist.get(artistId) || 0) + Number(amount || 0),
  );
};

const loadContestantVotes = async (contestantsRef, voteShardsRef, totalsByArtist) => {
  const [contestantsSnap, shardsSnap] = await Promise.all([
    getDocs(contestantsRef),
    getDocs(voteShardsRef),
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
      Number(shardVotesByArtist.get(artistId) || 0) + Number(shard.votes || 0),
    );
  });

  contestantsSnap.docs.forEach((contestantDoc) => {
    const contestant = contestantDoc.data();
    const artistId = getArtistFieldId({ id: contestantDoc.id, ...contestant });
    const legacyVotes = Number(contestant.votes || 0);
    const manualVotes = Number(contestant.manualVotes || 0);
    const shardVotes = Number(shardVotesByArtist.get(artistId) || 0);

    addVotesToArtist(totalsByArtist, artistId, legacyVotes + manualVotes + shardVotes);
    shardVotesByArtist.delete(artistId);
  });

  shardVotesByArtist.forEach((votes, artistId) => {
    addVotesToArtist(totalsByArtist, artistId, votes);
  });
};

const loadVoteTotalsByArtist = async (db) => {
  const totalsByArtist = new Map();
  const pollsSnap = await getDocs(collection(db, "polls"));

  await Promise.all(
    pollsSnap.docs.map(async (pollDoc) => {
      const pollId = pollDoc.id;

      await loadContestantVotes(
        collection(db, "polls", pollId, "contestants"),
        collection(db, "polls", pollId, "voteShards"),
        totalsByArtist,
      ).catch(() => {});

      const roundsSnap = await getDocs(collection(db, "polls", pollId, "rounds")).catch(
        () => null,
      );

      if (!roundsSnap) {
        return;
      }

      await Promise.all(
        roundsSnap.docs.map((roundDoc) =>
          loadContestantVotes(
            collection(db, "polls", pollId, "rounds", roundDoc.id, "contestants"),
            collection(db, "polls", pollId, "rounds", roundDoc.id, "voteShards"),
            totalsByArtist,
          ).catch(() => {}),
        ),
      );
    }),
  );

  return totalsByArtist;
};

const buildRankingArtistRows = (artistRows, voteTotalsByArtist = new Map()) =>
  artistRows.map((artist) => {
    const followersCount = Number(artist.followersCount || 0);
    const totalVotes = Number(voteTotalsByArtist.get(artist.id) ?? artist.totalVotes ?? 0);

    return {
      ...artist,
      followersCount,
      totalVotes,
      popularityScore: Math.round(followersCount * 10 + totalVotes),
    };
  });

export const getRankingPopularityCached = async (db, maxAgeMs = RANKING_CACHE_MS) => {
  const now = Date.now();

  if (rankingPopularityCache.rows.length && now - rankingPopularityCache.loadedAt < maxAgeMs) {
    return rankingPopularityCache.rows;
  }

  if (!rankingPopularityCache.promise) {
    rankingPopularityCache.promise = Promise.all([
      getArtistsCached(db),
      loadVoteTotalsByArtist(db),
    ])
      .then(([artistRows, voteTotalsByArtist]) => {
        rankingPopularityCache.rows = buildRankingArtistRows(artistRows, voteTotalsByArtist);
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

  return Promise.all(
    artistRows.map(async (artist) => {
      const followersCount = await getArtistFollowersCountCached(db, artist.id, artist.followersCount);

      return {
        ...artist,
        followersCount,
        popularityScore: Number(artist.popularityScore || followersCount * 10 || 0),
      };
    }),
  );
};

const withTimeout = (promise, timeoutMs = 4500) =>
  Promise.race([
    promise,
    new Promise((resolve) => {
      window.setTimeout(resolve, timeoutMs);
    }),
  ]);

export const preloadRouteData = (db, path) => {
  if (path === "/ranking-popularity") {
    return withTimeout(getRankingPopularityCached(db));
  }

  if (path === "/artistas") {
    return withTimeout(getArtistsWithFollowersCached(db));
  }

  if (path === "/votaciones") {
    return withTimeout(getPollsCached(db));
  }

  if (path === "/") {
    return withTimeout(Promise.all([
      getArtistsCached(db),
      getPollsCached(db),
    ]));
  }

  return Promise.resolve();
};
