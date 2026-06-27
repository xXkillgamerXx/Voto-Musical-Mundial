import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

export const firestore = () => {
  if (!getApps().length) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath) {
      initializeApp({
        credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8'))),
      });
    } else {
      initializeApp();
    }
  }

  return getFirestore();
};
