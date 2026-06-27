import { PrismaClient } from '@prisma/client';
import { firestore } from './firebase-admin';

const prisma = new PrismaClient();
const db = firestore();

async function firebaseShardTotal(pollId: string, roundId?: string) {
  const path = roundId ? `polls/${pollId}/rounds/${roundId}/voteShards` : `polls/${pollId}/voteShards`;
  const snapshot = await db.collection(path).get();
  return snapshot.docs.reduce((sum, doc) => sum + Number(doc.data().votes || 0), 0);
}

async function main() {
  const polls = await prisma.poll.findMany({
    where: { firebaseId: { not: null } },
    include: { rounds: true, contestants: true },
  });
  const rows: Array<{
    pollFirebaseId: string | null;
    roundFirebaseId: string | null;
    firebaseVotes: number;
    postgresVotes: number;
    diff: number;
  }> = [];

  for (const poll of polls) {
    const rootFirebaseTotal = await firebaseShardTotal(poll.firebaseId!);
    const rootPostgresTotal = poll.contestants
      .filter((contestant) => contestant.roundId === null)
      .reduce((sum, contestant) => sum + Number(contestant.votes), 0);

    rows.push({
      pollFirebaseId: poll.firebaseId,
      roundFirebaseId: null,
      firebaseVotes: rootFirebaseTotal,
      postgresVotes: rootPostgresTotal,
      diff: rootPostgresTotal - rootFirebaseTotal,
    });

    for (const round of poll.rounds) {
      if (!round.firebaseId) continue;
      const firebaseVotes = await firebaseShardTotal(poll.firebaseId!, round.firebaseId);
      const postgresVotes = poll.contestants
        .filter((contestant) => contestant.roundId === round.id)
        .reduce((sum, contestant) => sum + Number(contestant.votes), 0);

      rows.push({
        pollFirebaseId: poll.firebaseId,
        roundFirebaseId: round.firebaseId,
        firebaseVotes,
        postgresVotes,
        diff: postgresVotes - firebaseVotes,
      });
    }
  }

  console.table(rows);
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
