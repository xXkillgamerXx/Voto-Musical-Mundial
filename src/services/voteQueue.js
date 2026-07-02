import { castVote } from "./api/votesApi";

const DEFAULT_FLUSH_MS = 500;
const DEFAULT_SHARD_COUNT = 512;
/** Must match backend CastVoteDto @Max(amount) and VotesService MAX_BATCH_VOTES. */
export const SERVER_MAX_BATCH_VOTES = 1000;
const CHUNK_DELAY_MS = 80;
const MAX_RETRY_ATTEMPTS = 4;

const cleanId = (value) => String(value || "").replaceAll("/", "_");
const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

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
  amount: Math.max(1, Math.floor(Number(vote.amount || 1))),
});

const isRateLimitError = (error) =>
  error?.status === 429 ||
  String(error?.message || "").toLowerCase().includes("demasiados votos");

const commitChunkWithRetry = async (batch, amount) => {
  let attempt = 0;

  while (attempt < MAX_RETRY_ATTEMPTS) {
    try {
      return await castVote(
        {
          pollId: batch.pollId,
          roundId: batch.roundId || null,
          artistId: batch.artistId,
          contestantId: batch.contestantId || null,
          amount,
          pointsPerVote: batch.pointsPerVote,
          voteScope: batch.voteScope || null,
        },
        { anonymous: batch.anonymous !== false },
      );
    } catch (error) {
      attempt += 1;

      if (!isRateLimitError(error) || attempt >= MAX_RETRY_ATTEMPTS) {
        throw error;
      }

      await wait(400 * attempt);
    }
  }

  return null;
};

const commitBatch = async (batch) => {
  let remaining = Math.max(1, Math.floor(Number(batch.amount || 1)));
  let lastResult = null;
  let totalApplied = 0;

  while (remaining > 0) {
    const chunk = Math.min(SERVER_MAX_BATCH_VOTES, remaining);
    lastResult = await commitChunkWithRetry(batch, chunk);
    const applied = Math.max(
      0,
      Math.floor(Number(lastResult?.amount || chunk)),
    );
    totalApplied += applied;
    remaining -= chunk;

    if (remaining > 0) {
      await wait(CHUNK_DELAY_MS);
    }
  }

  return {
    ...lastResult,
    amount: totalApplied,
  };
};

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
        const key = buildBatchKey(batch);
        const current = pendingVotes.get(key);
        pendingVotes.set(key, {
          ...batch,
          amount: Number(current?.amount || 0) + Number(batch.amount || 0),
        });
      });
      onError(error, batches);
      throw error;
    } finally {
      isFlushing = false;
      onFlushEnd(batches);

      if (pendingVotes.size) {
        scheduleFlush();
      }
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
      amount: Number(current?.amount || 0) + normalizedVote.amount,
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
    isFlushing: () => isFlushing,
  };
};
