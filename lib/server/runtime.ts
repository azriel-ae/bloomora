import { Timestamp } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../firebase-admin';
import { firestoreStore } from './firestore-store';
import type { Env } from './store';

/** Builds the production Env (Admin SDK, server clock, Firestore Timestamps). Returns null if Firebase is not configured. */
export function getServerEnv(): Env | null {
  const admin = getFirebaseAdmin();
  if (!admin) return null;
  return {
    store: firestoreStore(admin.db),
    nowMs: () => Date.now(),
    ts: (ms) => Timestamp.fromMillis(ms),
    newId: () => admin.db.collection('_ids').doc().id,
  };
}
