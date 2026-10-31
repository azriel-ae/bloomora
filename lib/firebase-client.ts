'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { firebaseClientConfig, hasFirebaseClientConfig } from './env';

export function getFirebaseClient() {
  if (!hasFirebaseClientConfig()) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseClientConfig());
  return { app, auth: getAuth(app), storage: getStorage(app) };
}
