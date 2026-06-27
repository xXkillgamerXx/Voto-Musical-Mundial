import { PrismaClient, PollStatus, RoundType, UserRole } from '@prisma/client';
import { firestore } from './firebase-admin';

const prisma = new PrismaClient();
const db = firestore();

const toDate = (value: any) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.toMillis === 'function') return new Date(value.toMillis());
  return new Date(value);
};

const roleFor = (role?: string): UserRole => {
  const normalized = String(role || 'user').toLowerCase();
  if (normalized === 'owner') return UserRole.owner;
  if (normalized === 'superadmin' || normalized === 'superadmin') return UserRole.superadmin;
  if (normalized === 'admin') return UserRole.admin;
  return UserRole.user;
};

const statusFor = (status?: string): PollStatus => {
  if (status === 'live') return PollStatus.live;
  if (status === 'selecting_winners') return PollStatus.selecting_winners;
  if (status === 'closed') return PollStatus.closed;
  return PollStatus.draft;
};

const roundTypeFor = (type?: string): RoundType => (type === 'versus' ? RoundType.versus : RoundType.standard);

async function importUsers() {
  const snapshot = await db.collection('users').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    await prisma.user.upsert({
      where: { firebaseUid: doc.id },
      update: {
        username: data.username || null,
        email: data.email || null,
        displayName: data.displayName || data.username || null,
        photoUrl: data.photoURL || data.photoUrl || null,
        role: roleFor(data.role),
        points: BigInt(Number(data.points || 0)),
        spentPoints: BigInt(Number(data.spentPoints || 0)),
        referralCode: data.referralCode || null,
        referralSignups: Number(data.referralSignups || 0),
        referralPoints: BigInt(Number(data.referralPoints || 0)),
        dailyRewardStreak: Number(data.dailyRewardStreak || 0),
        dailyRewardStreakDay: Number(data.dailyRewardStreakDay || 0),
        lastDailyRewardClaimDate: data.lastDailyRewardClaimDate || null,
        metadata: data,
      },
      create: {
        firebaseUid: doc.id,
        username: data.username || null,
        email: data.email || null,
        displayName: data.displayName || data.username || null,
        photoUrl: data.photoURL || data.photoUrl || null,
        role: roleFor(data.role),
        points: BigInt(Number(data.points || 0)),
        spentPoints: BigInt(Number(data.spentPoints || 0)),
        referralCode: data.referralCode || null,
        referralSignups: Number(data.referralSignups || 0),
        referralPoints: BigInt(Number(data.referralPoints || 0)),
        dailyRewardStreak: Number(data.dailyRewardStreak || 0),
        dailyRewardStreakDay: Number(data.dailyRewardStreakDay || 0),
        lastDailyRewardClaimDate: data.lastDailyRewardClaimDate || null,
        metadata: data,
      },
    });
  }
}

async function importArtists() {
  const snapshot = await db.collection('artists').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    await prisma.artist.upsert({
      where: { firebaseId: doc.id },
      update: {
        slug: data.slug || null,
        name: data.name || data.title || doc.id,
        photoUrl: data.photoURL || data.photoUrl || data.imageUrl || null,
        country: data.country || null,
        genre: data.genre || null,
        followersCount: BigInt(Number(data.followersCount || 0)),
        totalVotes: BigInt(Number(data.totalVotes || 0)),
        popularityScore: BigInt(Number(data.popularityScore || 0)),
        metadata: data,
      },
      create: {
        firebaseId: doc.id,
        slug: data.slug || null,
        name: data.name || data.title || doc.id,
        photoUrl: data.photoURL || data.photoUrl || data.imageUrl || null,
        country: data.country || null,
        genre: data.genre || null,
        followersCount: BigInt(Number(data.followersCount || 0)),
        totalVotes: BigInt(Number(data.totalVotes || 0)),
        popularityScore: BigInt(Number(data.popularityScore || 0)),
        metadata: data,
      },
    });
  }
}

async function importCategories() {
  const snapshot = await db.collection('pollCategories').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    await prisma.pollCategory.upsert({
      where: { firebaseId: doc.id },
      update: {
        slug: data.slug || null,
        name: data.name || data.title || doc.id,
        description: data.description || null,
        active: data.active !== false,
        order: Number(data.order || 0),
        metadata: data,
      },
      create: {
        firebaseId: doc.id,
        slug: data.slug || null,
        name: data.name || data.title || doc.id,
        description: data.description || null,
        active: data.active !== false,
        order: Number(data.order || 0),
        metadata: data,
      },
    });
  }
}

async function importPolls() {
  const snapshot = await db.collection('polls').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const category = data.categoryId
      ? await prisma.pollCategory.findFirst({ where: { firebaseId: data.categoryId } })
      : null;
    const poll = await prisma.poll.upsert({
      where: { firebaseId: doc.id },
      update: {
        categoryId: category?.id || null,
        slug: data.slug || null,
        title: data.title || data.name || doc.id,
        description: data.description || null,
        status: statusFor(data.status),
        type: roundTypeFor(data.type),
        config: data,
        totalVotes: BigInt(Number(data.totalVotes || 0)),
        leaderVotes: BigInt(Number(data.leaderVotes || 0)),
        startsAt: toDate(data.startsAt || data.startAt),
        endsAt: toDate(data.endsAt || data.endAt),
        activeEndAt: toDate(data.activeEndAt),
      },
      create: {
        firebaseId: doc.id,
        categoryId: category?.id || null,
        slug: data.slug || null,
        title: data.title || data.name || doc.id,
        description: data.description || null,
        status: statusFor(data.status),
        type: roundTypeFor(data.type),
        config: data,
        totalVotes: BigInt(Number(data.totalVotes || 0)),
        leaderVotes: BigInt(Number(data.leaderVotes || 0)),
        startsAt: toDate(data.startsAt || data.startAt),
        endsAt: toDate(data.endsAt || data.endAt),
        activeEndAt: toDate(data.activeEndAt),
      },
    });

    await importContestants(doc.id, poll.id, null);
    await importRounds(doc.id, poll.id);
    await consolidateVoteShards(doc.id, poll.id, null);
  }
}

async function importRounds(firebasePollId: string, pollId: bigint) {
  const snapshot = await db.collection(`polls/${firebasePollId}/rounds`).get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const round = await prisma.round.upsert({
      where: { pollId_firebaseId: { pollId, firebaseId: doc.id } },
      update: {
        title: data.title || data.name || null,
        type: roundTypeFor(data.type),
        status: statusFor(data.status),
        config: data,
        startsAt: toDate(data.startsAt || data.startAt),
        endsAt: toDate(data.endsAt || data.endAt),
      },
      create: {
        firebaseId: doc.id,
        pollId,
        title: data.title || data.name || null,
        type: roundTypeFor(data.type),
        status: statusFor(data.status),
        config: data,
        startsAt: toDate(data.startsAt || data.startAt),
        endsAt: toDate(data.endsAt || data.endAt),
      },
    });
    await importContestants(firebasePollId, pollId, round.id, doc.id);
    await consolidateVoteShards(firebasePollId, pollId, round.id, doc.id);
  }
}

async function importContestants(firebasePollId: string, pollId: bigint, roundId: bigint | null, firebaseRoundId?: string) {
  const path = firebaseRoundId
    ? `polls/${firebasePollId}/rounds/${firebaseRoundId}/contestants`
    : `polls/${firebasePollId}/contestants`;
  const snapshot = await db.collection(path).get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const artist = await prisma.artist.findFirst({
      where: {
        OR: [{ firebaseId: data.artistId || doc.id }, { slug: data.artistSlug || '' }],
      },
    });
    if (!artist) continue;

    const existing = await prisma.contestant.findFirst({
      where: { pollId, roundId, artistId: artist.id },
    });

    if (existing) {
      await prisma.contestant.update({
        where: { id: existing.id },
        data: {
          firebaseId: doc.id,
          votes: BigInt(Number(data.votes || 0)),
          manualVotes: BigInt(Number(data.manualVotes || 0)),
          matchGroup: Number(data.matchGroup || 0),
          matchOrder: Number(data.matchOrder || 0),
          order: Number(data.order || 0),
          metadata: data,
        },
      });
    } else {
      await prisma.contestant.create({
        data: {
        firebaseId: doc.id,
        pollId,
        roundId,
        artistId: artist.id,
        votes: BigInt(Number(data.votes || 0)),
        manualVotes: BigInt(Number(data.manualVotes || 0)),
        matchGroup: Number(data.matchGroup || 0),
        matchOrder: Number(data.matchOrder || 0),
        order: Number(data.order || 0),
        metadata: data,
        },
      });
    }
  }
}

async function consolidateVoteShards(firebasePollId: string, pollId: bigint, roundId: bigint | null, firebaseRoundId?: string) {
  const path = firebaseRoundId
    ? `polls/${firebasePollId}/rounds/${firebaseRoundId}/voteShards`
    : `polls/${firebasePollId}/voteShards`;
  const snapshot = await db.collection(path).get();
  const byArtist = new Map<string, number>();

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (!data.artistId) return;
    byArtist.set(data.artistId, (byArtist.get(data.artistId) || 0) + Number(data.votes || 0));
  });

  for (const [firebaseArtistId, votes] of byArtist) {
    const artist = await prisma.artist.findFirst({ where: { firebaseId: firebaseArtistId } });
    if (!artist) continue;
    await prisma.contestant.updateMany({
      where: { pollId, roundId, artistId: artist.id },
      data: { votes: { increment: votes } },
    });
  }
}

async function importMissions() {
  const snapshot = await db.collection('missions').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    await prisma.mission.upsert({
      where: { firebaseId: doc.id },
      update: {
        title: data.title || doc.id,
        description: data.description || null,
        type: data.type || 'manual',
        icon: data.icon || null,
        actionUrl: data.actionUrl || data.url || null,
        rewardPoints: Number(data.rewardPoints || 0),
        target: Number(data.target || 1),
        active: data.active !== false,
        featured: Boolean(data.featured),
        order: Number(data.order || 0),
        metadata: data,
      },
      create: {
        firebaseId: doc.id,
        title: data.title || doc.id,
        description: data.description || null,
        type: data.type || 'manual',
        icon: data.icon || null,
        actionUrl: data.actionUrl || data.url || null,
        rewardPoints: Number(data.rewardPoints || 0),
        target: Number(data.target || 1),
        active: data.active !== false,
        featured: Boolean(data.featured),
        order: Number(data.order || 0),
        metadata: data,
      },
    });
  }
}

async function main() {
  await importUsers();
  await importArtists();
  await importCategories();
  await importPolls();
  await importMissions();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
