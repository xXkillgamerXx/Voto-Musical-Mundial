import crypto from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";

initializeApp();

const db = getFirestore();
const DEFAULT_COOLDOWN_MINUTES = 60;
const DEFAULT_SHARD_COUNT = 512;
const MIN_SHARD_COUNT = 128;
const MAX_SHARD_COUNT = 2048;
const MAX_STATUS_SCOPES = 64;
const LOCK_TTL_BUFFER_MS = 24 * 60 * 60 * 1000;
const LEDGER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFERRAL_SIGNUP_POINTS = 50;
const REFERRAL_MILESTONE_BONUSES = {
  5: 300,
  10: 700,
};
const MAX_COOLDOWN_MINUTES = 24 * 60;
const functionOptions = {
  region: "us-central1",
  minInstances: 0,
  maxInstances: 10,
  timeoutSeconds: 10,
  memory: "256MiB",
  concurrency: 40,
};
const callableOptions = {
  ...functionOptions,
  cors: true,
};
const httpErrorStatus = {
  unauthenticated: 401,
  "invalid-argument": 400,
  "failed-precondition": 412,
  "resource-exhausted": 429,
  "not-found": 404,
};

const cleanId = (value) => String(value || "").replaceAll("/", "_");

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  return 0;
};

const timestampFromMillis = (millis) => Timestamp.fromMillis(Math.max(0, Number(millis || 0)));

const getClientIp = (request) => {
  const forwardedFor = request.rawRequest?.headers?.["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const firstForwardedIp = String(forwardedIp || "").split(",")[0].trim();

  return (
    firstForwardedIp ||
    request.rawRequest?.ip ||
    request.rawRequest?.socket?.remoteAddress ||
    "unknown"
  );
};

const hashIp = (ip) =>
  crypto
    .createHash("sha256")
    .update(`${process.env.IP_HASH_SALT || process.env.GCLOUD_PROJECT || "votomusicamundial"}:${ip}`)
    .digest("hex");

const getRoundRef = (pollId, roundId) =>
  roundId ? db.doc(`polls/${pollId}/rounds/${roundId}`) : null;

const roundCollectionRef = (pollId, roundId, collectionName) =>
  roundId
    ? db.collection(`polls/${pollId}/rounds/${roundId}/${collectionName}`)
    : db.collection(`polls/${pollId}/${collectionName}`);

const normalizeAnonymousConfig = (pollData, roundData = {}) => {
  const config = {
    ...(pollData?.anonymousVoting || {}),
    ...(roundData?.anonymousVoting || {}),
  };
  const cooldownMinutes = Math.min(
    MAX_COOLDOWN_MINUTES,
    Math.max(1, Math.floor(Number(config.cooldownMinutes || DEFAULT_COOLDOWN_MINUTES))),
  );

  return {
    enabled: config.enabled !== false,
    blockByIp: config.blockByIp !== false,
    cooldownMinutes,
    cooldownMs: cooldownMinutes * 60 * 1000,
  };
};

const assertAnonymousAuth = (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar una sesion anonima para votar.");
  }

  const provider = request.auth.token?.firebase?.sign_in_provider;

  if (provider !== "anonymous") {
    throw new HttpsError("failed-precondition", "Esta funcion es solo para votos anonimos.");
  }

  return request.auth.uid;
};

const assertAnonymousToken = async (request) => {
  const authorization = request.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";

  if (!token) {
    throw new HttpsError("unauthenticated", "Debes iniciar una sesion anonima para votar.");
  }

  const decodedToken = await getAuth().verifyIdToken(token);
  const provider = decodedToken.firebase?.sign_in_provider;

  if (provider !== "anonymous") {
    throw new HttpsError("failed-precondition", "Esta funcion es solo para votos anonimos.");
  }

  return decodedToken.uid;
};

const setCorsHeaders = (request, response) => {
  const origin = request.headers.origin || "*";

  response.set("Access-Control-Allow-Origin", origin);
  response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.set("Access-Control-Max-Age", "3600");
  response.set("Vary", "Origin");
};

const sendHttpError = (response, error) => {
  const status = httpErrorStatus[error.code] || 500;

  response.status(status).json({
    error: {
      code: error.code || "internal",
      message: error.message || "No se pudo registrar el voto.",
      details: error.details || null,
    },
  });
};

const loadPollContext = async (pollId, roundId) => {
  const pollRef = db.doc(`polls/${pollId}`);
  const roundRef = getRoundRef(pollId, roundId);
  const [pollSnap, roundSnap] = await Promise.all([
    pollRef.get(),
    roundRef ? roundRef.get() : Promise.resolve(null),
  ]);

  if (!pollSnap.exists) {
    throw new HttpsError("not-found", "La votacion no existe.");
  }

  if (roundRef && !roundSnap.exists) {
    throw new HttpsError("not-found", "La ronda no existe.");
  }

  return {
    pollRef,
    roundRef,
    pollData: pollSnap.data(),
    roundData: roundSnap?.data() || null,
  };
};

const assertVotingOpen = ({ pollData, roundData }) => {
  const endAtMillis = toMillis(roundData?.endAt || pollData?.endAt || pollData?.activeEndAt);

  if (pollData?.status !== "live") {
    throw new HttpsError("failed-precondition", "La votacion no esta abierta.");
  }

  if (endAtMillis && endAtMillis <= Date.now()) {
    throw new HttpsError("failed-precondition", "La votacion ya termino.");
  }
};

const lockDocRefs = ({ pollId, roundId, voteScope, uid, ipHash, blockByIp }) => {
  const roundScope = cleanId(roundId || "_root");
  const scope = voteScope ? `${roundScope}_${cleanId(voteScope)}` : roundScope;
  const locks = db.collection(`polls/${pollId}/anonymousVoteLocks`);

  return {
    uidLockRef: locks.doc(`${scope}_uid_${cleanId(uid)}`),
    ipLockRef: blockByIp ? locks.doc(`${scope}_ip_${ipHash}`) : null,
  };
};

const nextVoteAtFromLocks = (uidLock, ipLock) =>
  Math.max(
    toMillis(uidLock?.data()?.nextVoteAt),
    toMillis(ipLock?.data()?.nextVoteAt),
  );

const statusPayload = ({ nextVoteAt = 0, config }) => ({
  enabled: config.enabled,
  blockByIp: config.blockByIp,
  cooldownMinutes: config.cooldownMinutes,
  nextVoteAt: nextVoteAt ? timestampFromMillis(nextVoteAt).toDate().toISOString() : null,
  remainingMs: Math.max(0, nextVoteAt - Date.now()),
});

const contestantVoteScope = (contestant, fallbackIndex = 0) => {
  const matchGroup = Number(contestant?.matchGroup || 0);

  return `match_${matchGroup || Math.floor(fallbackIndex / 2) + 1}`;
};

const resolveAnonymousVoteScope = async ({ pollId, roundId, roundData, artistId }) => {
  if (!roundId || roundData?.type !== "versus") {
    return null;
  }

  const contestantsRef = roundCollectionRef(pollId, roundId, "contestants");
  const contestantById = await contestantsRef.doc(artistId).get();

  if (contestantById.exists) {
    return contestantVoteScope(contestantById.data());
  }

  const contestantByArtist = await contestantsRef
    .where("artistId", "==", artistId)
    .limit(1)
    .get();

  if (!contestantByArtist.empty) {
    return contestantVoteScope(contestantByArtist.docs[0].data());
  }

  throw new HttpsError("invalid-argument", "El participante no pertenece a esta ronda.");
};

const DEFAULT_SCOPE_KEY = "_round";

const normalizeStatusScopes = (data) => {
  const rawScopes = Array.isArray(data?.voteScopes)
    ? data.voteScopes
    : [data?.voteScope || DEFAULT_SCOPE_KEY];
  const scopes = [
    ...new Set(
      rawScopes.map((scope) => {
        const key = cleanId(scope || DEFAULT_SCOPE_KEY);
        return key || DEFAULT_SCOPE_KEY;
      }),
    ),
  ];

  if (scopes.length > MAX_STATUS_SCOPES) {
    throw new HttpsError("invalid-argument", "Demasiados duelos para consultar.");
  }

  return scopes;
};

const resolveShardCount = (pollData, roundData) => {
  const configured = Number(roundData?.shardCount || pollData?.shardCount || DEFAULT_SHARD_COUNT);

  return Math.min(
    MAX_SHARD_COUNT,
    Math.max(MIN_SHARD_COUNT, Math.floor(Number.isFinite(configured) ? configured : DEFAULT_SHARD_COUNT)),
  );
};

export const getAnonymousVoteStatus = onCall(callableOptions, async (request) => {
  const uid = assertAnonymousAuth(request);
  const pollId = cleanId(request.data?.pollId);
  const roundId = request.data?.roundId ? cleanId(request.data.roundId) : null;

  if (!pollId) {
    throw new HttpsError("invalid-argument", "Falta la votacion.");
  }

  const isBatch = Array.isArray(request.data?.voteScopes);
  const requestedKeys = normalizeStatusScopes(request.data);

  const ipHash = hashIp(getClientIp(request));
  const context = await loadPollContext(pollId, roundId);
  const config = normalizeAnonymousConfig(context.pollData, context.roundData);

  const scopeRefs = requestedKeys.map((key) => {
    const internalScope = key === DEFAULT_SCOPE_KEY ? null : cleanId(key);
    const { uidLockRef, ipLockRef } = lockDocRefs({
      pollId,
      roundId,
      voteScope: internalScope,
      uid,
      ipHash,
      blockByIp: config.blockByIp,
    });
    return { key, uidLockRef, ipLockRef };
  });

  const allRefs = [];
  scopeRefs.forEach(({ uidLockRef, ipLockRef }) => {
    allRefs.push(uidLockRef);
    if (ipLockRef) {
      allRefs.push(ipLockRef);
    }
  });

  const snaps = allRefs.length ? await db.getAll(...allRefs) : [];
  const snapByPath = new Map(snaps.map((snap) => [snap.ref.path, snap]));

  const statuses = {};
  scopeRefs.forEach(({ key, uidLockRef, ipLockRef }) => {
    const uidLock = snapByPath.get(uidLockRef.path) || null;
    const ipLock = ipLockRef ? snapByPath.get(ipLockRef.path) || null : null;
    statuses[key] = statusPayload({
      nextVoteAt: nextVoteAtFromLocks(uidLock, ipLock),
      config,
    });
  });

  if (!isBatch) {
    return statuses[requestedKeys[0]];
  }

  return { statuses };
});

const castAnonymousVoteForUser = async ({ uid, data, rawRequest }) => {
  const pollId = cleanId(data?.pollId);
  const roundId = data?.roundId ? cleanId(data.roundId) : null;
  const artistId = cleanId(data?.artistId);

  if (!pollId || !artistId) {
    throw new HttpsError("invalid-argument", "Faltan datos del voto.");
  }

  const ipHash = hashIp(getClientIp({ rawRequest }));
  const context = await loadPollContext(pollId, roundId);
  const config = normalizeAnonymousConfig(context.pollData, context.roundData);
  const shardCount = resolveShardCount(context.pollData, context.roundData);

  if (!config.enabled) {
    throw new HttpsError("failed-precondition", "El voto anonimo no esta activo.");
  }

  assertVotingOpen(context);

  const voteScope = await resolveAnonymousVoteScope({
    pollId,
    roundId,
    roundData: context.roundData,
    artistId,
  });
  const shardIndex = Math.floor(Math.random() * shardCount);
  const now = Date.now();
  const nextVoteAt = now + config.cooldownMs;
  const { uidLockRef, ipLockRef } = lockDocRefs({
    pollId,
    roundId,
    voteScope,
    uid,
    ipHash,
    blockByIp: config.blockByIp,
  });
  const shardRef = roundCollectionRef(pollId, roundId, "voteShards").doc(`${artistId}_${shardIndex}`);
  const ledgerRef = roundCollectionRef(pollId, roundId, "userVoteBatches").doc(
    `${cleanId(uid)}_${now}_${shardIndex}`,
  );

  await db.runTransaction(async (transaction) => {
    const [uidLock, ipLock] = await Promise.all([
      transaction.get(uidLockRef),
      ipLockRef ? transaction.get(ipLockRef) : Promise.resolve(null),
    ]);
    const activeNextVoteAt = nextVoteAtFromLocks(uidLock, ipLock);

    if (activeNextVoteAt > now) {
      throw new HttpsError("resource-exhausted", "Debes esperar para votar otra vez.", {
        nextVoteAt: timestampFromMillis(activeNextVoteAt).toDate().toISOString(),
        remainingMs: activeNextVoteAt - now,
      });
    }

    const lockData = {
      uid,
      ipHash,
      pollId,
      roundId,
      voteScope,
      lastVoteAt: FieldValue.serverTimestamp(),
      nextVoteAt: timestampFromMillis(nextVoteAt),
      cooldownMinutes: config.cooldownMinutes,
      updatedAt: FieldValue.serverTimestamp(),
      expireAt: timestampFromMillis(nextVoteAt + LOCK_TTL_BUFFER_MS),
    };

    transaction.set(uidLockRef, { ...lockData, lockType: "uid" }, { merge: true });

    if (ipLockRef) {
      transaction.set(ipLockRef, { ...lockData, lockType: "ip" }, { merge: true });
    }

    transaction.set(
      shardRef,
      {
        pollId,
        roundId,
        artistId,
        shardIndex,
        votes: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    transaction.set(ledgerRef, {
      userId: uid,
      userDisplayName: "Fan anonimo",
      userPhotoURL: "",
      artistId,
      roundId,
      voteScope,
      amount: 1,
      pointsSpent: 0,
      anonymous: true,
      shardIndex,
      createdAt: FieldValue.serverTimestamp(),
      expireAt: timestampFromMillis(now + LEDGER_TTL_MS),
    });
  });

  return statusPayload({
    nextVoteAt,
    config,
  });
};

export const castAnonymousVoteHttp = onRequest(functionOptions, async (request, response) => {
  setCorsHeaders(request, response);

  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ error: { code: "method-not-allowed" } });
    return;
  }

  try {
    const uid = await assertAnonymousToken(request);
    const payload = await castAnonymousVoteForUser({
      uid,
      data: request.body || {},
      rawRequest: request,
    });

    response.status(200).json(payload);
  } catch (error) {
    sendHttpError(response, error);
  }
});

export const processReferralSignup = onDocumentCreated(
  {
    ...functionOptions,
    document: "users/{userId}",
  },
  async (event) => {
  const userId = event.params.userId;
  const userData = event.data?.data() || {};
  const referredBy = userData.referredBy || null;
  const referrerId = cleanId(referredBy?.uid);

  if (!referrerId || referrerId === userId) {
    return;
  }

  const referredUserRef = db.doc(`users/${userId}`);
  const referrerRef = db.doc(`users/${referrerId}`);
  const referralSignupRef = db.doc(`referralSignups/${userId}`);

  await db.runTransaction(async (transaction) => {
    const [existingSignupSnap, referrerSnap] = await Promise.all([
      transaction.get(referralSignupRef),
      transaction.get(referrerRef),
    ]);

    if (existingSignupSnap.exists || !referrerSnap.exists) {
      return;
    }

    const previousSignupCount = Number(referrerSnap.data()?.referralSignups || 0);
    const nextSignupCount = previousSignupCount + 1;
    const milestoneBonus = REFERRAL_MILESTONE_BONUSES[nextSignupCount] || 0;
    const pointsAwarded = REFERRAL_SIGNUP_POINTS + milestoneBonus;

    transaction.set(referralSignupRef, {
      userId,
      referrerId,
      referralCode: referredBy.code || "",
      referredUsername: userData.username || "",
      referrerUsername: referredBy.username || "",
      pointsAwarded,
      signupPoints: REFERRAL_SIGNUP_POINTS,
      milestoneBonus,
      milestone: milestoneBonus ? nextSignupCount : null,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.update(referrerRef, {
      points: FieldValue.increment(pointsAwarded),
      referralSignups: FieldValue.increment(1),
      referralPoints: FieldValue.increment(pointsAwarded),
      referralUpdatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(referredUserRef, {
      referralSignupProcessed: true,
      referralSignupProcessedAt: FieldValue.serverTimestamp(),
    });
  });
});
