import {
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

const DEFAULT_FLUSH_MS = 1500;
const DEFAULT_SHARD_COUNT = 512;
const MAX_BATCH_VOTES = 1000;

const cleanId = (value) => String(value || "").replaceAll("/", "_");

export const shardCountForConcurrency = (concurrentUsers = 100000) => {
  if (concurrentUsers >= 200000) return 2048;
  if (concurrentUsers >= 100000) return 1024;
  if (concurrentUsers >= 50000) return 512;
  return 128;
};

const randomShard = (shardCount) => Math.floor(Math.random() * shardCount);

const roundCollection = (db, pollId, roundId, collectionName) =>
  roundId
    ? collection(db, "polls", pollId, "rounds", roundId, collectionName)
    : collection(db, "polls", pollId, collectionName);

const buildBatchKey = ({ pollId, roundId, artistId, userId }) =>
  [pollId, roundId || "_root", artistId, userId].map(cleanId).join(":");

const normalizeVote = (vote) => ({
  ...vote,
  amount: Math.min(MAX_BATCH_VOTES, Math.max(1, Math.floor(Number(vote.amount || 1)))),
});

export const createVoteQueue = ({
  db,
  flushMs = DEFAULT_FLUSH_MS,
  shardCount = DEFAULT_SHARD_COUNT,
  onFlushStart = () => {},
  onFlushEnd = () => {},
  onBatchCommitted = () => {},
  onError = () => {},
}) => {
  const pendingVotes = new Map();
  let flushTimer = null;
  let isFlushing = false;

  const clearFlushTimer = () => {
    if (flushTimer) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
  };

  const scheduleFlush = () => {
    clearFlushTimer();
    flushTimer = window.setTimeout(() => {
      flush().catch(() => {});
    }, flushMs);
  };

  const commitBatch = async (batch) => {
    const userRef = doc(db, "users", batch.userId);
    const shardIndex = randomShard(batch.shardCount);
    const shardRef = doc(
      roundCollection(db, batch.pollId, batch.roundId, "voteShards"),
      `${cleanId(batch.artistId)}_${shardIndex}`,
    );
    const ledgerRef = doc(
      roundCollection(db, batch.pollId, batch.roundId, "userVoteBatches"),
      `${cleanId(batch.userId)}_${Date.now()}_${shardIndex}`,
    );

    await runTransaction(db, async (transaction) => {
      const [userSnap, shardSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(shardRef),
      ]);
      const availablePoints = Number(userSnap.data()?.points || 0);
      const pointsToSpend = batch.amount * batch.pointsPerVote;

      if (availablePoints < pointsToSpend) {
        throw new Error("not-enough-points");
      }

      transaction.update(userRef, {
        points: increment(-pointsToSpend),
        spentPoints: increment(pointsToSpend),
      });

      if (shardSnap.exists()) {
        transaction.update(shardRef, {
          votes: increment(batch.amount),
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(shardRef, {
          pollId: batch.pollId,
          roundId: batch.roundId || null,
          artistId: batch.artistId,
          shardIndex,
          votes: increment(batch.amount),
          updatedAt: serverTimestamp(),
        });
      }

      transaction.set(ledgerRef, {
        userId: batch.userId,
        userDisplayName: batch.userDisplayName || "",
        userPhotoURL: batch.userPhotoURL || "",
        artistId: batch.artistId,
        roundId: batch.roundId || null,
        amount: batch.amount,
        pointsSpent: pointsToSpend,
        shardIndex,
        createdAt: serverTimestamp(),
      });
    });
  };

  const flush = async () => {
    clearFlushTimer();

    if (isFlushing || !pendingVotes.size) {
      return;
    }

    const batches = [...pendingVotes.values()];
    pendingVotes.clear();
    isFlushing = true;
    onFlushStart(batches);

    try {
      for (const batch of batches) {
        await commitBatch(batch);
        onBatchCommitted(batch);
      }
    } catch (error) {
      batches.forEach((batch) => {
        pendingVotes.set(buildBatchKey(batch), batch);
      });
      onError(error, batches);
      throw error;
    } finally {
      isFlushing = false;
      onFlushEnd(batches);
    }
  };

  const enqueue = (vote) => {
    const normalizedVote = normalizeVote({
      ...vote,
      shardCount: vote.shardCount || shardCount,
    });
    const key = buildBatchKey(normalizedVote);
    const current = pendingVotes.get(key);

    pendingVotes.set(key, {
      ...normalizedVote,
      amount: Math.min(
        MAX_BATCH_VOTES,
        Number(current?.amount || 0) + normalizedVote.amount,
      ),
    });

    scheduleFlush();
  };

  const dispose = () => {
    clearFlushTimer();
  };

  return {
    enqueue,
    flush,
    dispose,
    pendingCount: () => pendingVotes.size,
  };
};
