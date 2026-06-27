# Migration Runbook

## Local Bootstrap

1. Copy `backend/.env.example` to `backend/.env`.
2. Start dependencies:

```bash
cd backend
docker compose up postgres redis -d
```

3. Install dependencies and create the schema:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
```

4. Start API and worker:

```bash
npm run start:dev
npm run start:worker:dev
```

## Firebase Import

Use a Firebase service account in `FIREBASE_SERVICE_ACCOUNT_PATH`, or run with Google application credentials.

```bash
cd backend
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json npm run migrate:firebase
npm run reconcile:firebase
```

The importer preserves Firestore IDs in `firebaseId`/`firebaseUid`, which allows the frontend to resolve old IDs during the transition.

## Gradual Cutover Order

Enable these flags one at a time in the frontend `.env`:

```bash
VITE_USE_API_PUBLIC_READS=true
VITE_USE_API_RESULTS=true
VITE_USE_API_VOTES=true
VITE_USE_API_MISSIONS=true
VITE_USE_API_AUTH=true
```

After each flag:

1. Compare visible UI with the Firebase version.
2. Run reconciliation for votes.
3. Check API logs and Redis/worker lag.
4. Keep Firebase enabled until the module has run cleanly in production traffic.

## Vote Reconciliation

Before enabling API votes:

1. Import all polls, rounds, contestants and `voteShards`.
2. Run `npm run reconcile:firebase`.
3. Confirm all diffs are `0` or expected due to manual adjustments.

After enabling API votes:

1. Monitor `votes:stream` length.
2. Confirm the worker is acknowledging messages.
3. Compare PostgreSQL `contestants.votes` plus Redis pending counters against public results.

## Rollback

If a module misbehaves, turn its corresponding `VITE_USE_API_*` flag back to `false` and redeploy the frontend. Firebase remains available until final cutover.
