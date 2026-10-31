import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { hasFirebaseAdminConfig } from './env';

export function getFirebaseAdmin() {
  if (!hasFirebaseAdminConfig()) return null;
  const app = getApps().length ? getApps()[0] : initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
  return { app, auth: getAuth(app), db: getFirestore(app), storage: getStorage(app) };
}
