import type { Firestore } from 'firebase-admin/firestore';
import type { Store } from './store.ts';

/** Production adapter over the Firebase Admin SDK. Server-only; never import from client code. */
export function firestoreStore(db: Firestore): Store {
  return {
    runTransaction: (fn) =>
      db.runTransaction((t) =>
        fn({
          get: async (path) => { const s = await t.get(db.doc(path)); return s.exists ? (s.data() as Record<string, any>) : null; },
          query: async (collection, field, value) => {
            const q = await t.get(db.collection(collection).where(field, '==', value));
            return q.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, any> }));
          },
          create: (path, data) => { t.create(db.doc(path), data); },
          set: (path, data) => { t.set(db.doc(path), data); },
          update: (path, data) => { t.update(db.doc(path), data); },
        }),
      ),
  };
}
