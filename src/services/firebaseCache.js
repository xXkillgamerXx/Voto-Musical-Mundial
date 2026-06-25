import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";

const ARTISTS_CACHE_MS = 5 * 60 * 1000;

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
