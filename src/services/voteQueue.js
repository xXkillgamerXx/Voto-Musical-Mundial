import { castVote } from "./api/votesApi";

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

const buildBatchKey = ({ pollId, roundId, artistId, userId }) =>
  [pollId, roundId || "_root", artistId, userId].map(cleanId).join(":");

const normalizeVote = (vote) => ({
  ...vote,
  amount: Math.min(MAX_BATCH_VOTES, Math.max(1, Math.floor(Number(vote.amount || 1)))),
});

export const createVoteQueue = ({
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

  const commitBatch = async (batch) =>
    castVote({
      pollId: batch.pollId,
      roundId: batch.roundId || null,
      artistId: batch.artistId,
      contestantId: batch.contestantId || null,
      amount: batch.amount,
      pointsPerVote: batch.pointsPerVote,
      voteScope: batch.voteScope || null,
    }, {
      anonymous: batch.anonymous !== false,
    });

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
        const result = await commitBatch(batch);
        onBatchCommitted(batch, result);
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
