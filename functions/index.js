import crypto from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";

initializeApp();

const db = getFirestore();
const DEFAULT_COOLDOWN_MINUTES = 60;
const DEFAULT_SHARD_COUNT = 512;
const MAX_COOLDOWN_MINUTES = 24 * 60;
const callableOptions = {
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

  if (roundData && roundData.status !== "live") {
    throw new HttpsError("failed-precondition", "La ronda no esta abierta.");
  }

  if (endAtMillis && endAtMillis <= Date.now()) {
    throw new HttpsError("failed-precondition", "La votacion ya termino.");
  }
};

const lockDocRefs = ({ pollId, roundId, uid, ipHash, blockByIp }) => {
  const scope = cleanId(roundId || "_root");
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

export const getAnonymousVoteStatus = onCall(callableOptions, async (request) => {
  const uid = assertAnonymousAuth(request);
  const pollId = cleanId(request.data?.pollId);
  const roundId = request.data?.roundId ? cleanId(request.data.roundId) : null;

  if (!pollId) {
    throw new HttpsError("invalid-argument", "Falta la votacion.");
  }

  const ipHash = hashIp(getClientIp(request));
  const context = await loadPollContext(pollId, roundId);
  const config = normalizeAnonymousConfig(context.pollData, context.roundData);
  const { uidLockRef, ipLockRef } = lockDocRefs({
    pollId,
    roundId,
    uid,
    ipHash,
    blockByIp: config.blockByIp,
  });
  const [uidLock, ipLock] = await Promise.all([
    uidLockRef.get(),
    ipLockRef ? ipLockRef.get() : Promise.resolve(null),
  ]);

  return statusPayload({
    nextVoteAt: nextVoteAtFromLocks(uidLock, ipLock),
    config,
  });
});

const castAnonymousVoteForUser = async ({ uid, data, rawRequest }) => {
  const pollId = cleanId(data?.pollId);
  const roundId = data?.roundId ? cleanId(data.roundId) : null;
  const artistId = cleanId(data?.artistId);
  const shardCount = Math.max(1, Math.floor(Number(data?.shardCount || DEFAULT_SHARD_COUNT)));

  if (!pollId || !artistId) {
    throw new HttpsError("invalid-argument", "Faltan datos del voto.");
  }

  const ipHash = hashIp(getClientIp({ rawRequest }));
  const context = await loadPollContext(pollId, roundId);
  const config = normalizeAnonymousConfig(context.pollData, context.roundData);

  if (!config.enabled) {
    throw new HttpsError("failed-precondition", "El voto anonimo no esta activo.");
  }

  assertVotingOpen(context);

  const shardIndex = Math.floor(Math.random() * shardCount);
  const now = Date.now();
  const nextVoteAt = now + config.cooldownMs;
  const { uidLockRef, ipLockRef } = lockDocRefs({
    pollId,
    roundId,
    uid,
    ipHash,
    blockByIp: config.blockByIp,
  });
  const shardRef = roundCollectionRef(pollId, roundId, "voteShards").doc(`${artistId}_${shardIndex}`);
  const ledgerRef = roundCollectionRef(pollId, roundId, "userVoteBatches").doc(
    `${cleanId(uid)}_${now}_${shardIndex}`,
  );
  const userRef = db.doc(`users/${uid}`);

  await db.runTransaction(async (transaction) => {
    const [uidLock, ipLock, userSnap] = await Promise.all([
      transaction.get(uidLockRef),
      ipLockRef ? transaction.get(ipLockRef) : Promise.resolve(null),
      transaction.get(userRef),
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
      lastVoteAt: FieldValue.serverTimestamp(),
      nextVoteAt: timestampFromMillis(nextVoteAt),
      cooldownMinutes: config.cooldownMinutes,
      updatedAt: FieldValue.serverTimestamp(),
    };

    transaction.set(uidLockRef, { ...lockData, lockType: "uid" }, { merge: true });

    if (ipLockRef) {
      transaction.set(ipLockRef, { ...lockData, lockType: "ip" }, { merge: true });
    }

    transaction.set(
      userRef,
      {
        isAnonymous: true,
        role: "user",
        updatedAt: FieldValue.serverTimestamp(),
        ...(!userSnap.exists
          ? {
              points: 0,
              spentPoints: 0,
              createdAt: FieldValue.serverTimestamp(),
            }
          : {}),
      },
      { merge: true },
    );
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
      amount: 1,
      pointsSpent: 0,
      anonymous: true,
      shardIndex,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return statusPayload({
    nextVoteAt,
    config,
  });
};

export const castAnonymousVote = onCall(callableOptions, async (request) => {
  const uid = assertAnonymousAuth(request);

  return castAnonymousVoteForUser({
    uid,
    data: request.data,
    rawRequest: request.rawRequest,
  });
});

export const castAnonymousVoteHttp = onRequest(async (request, response) => {
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
