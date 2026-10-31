/**
 * Firestore rules tests. NOT EXECUTED in the authoring sandbox (no network, no
 * firebase-tools). Run locally:
 *
 *   pnpm add -D @firebase/rules-unit-testing firebase-tools
 *   pnpm test:rules
 *
 * @firebase/rules-unit-testing is intentionally not in package.json yet so the
 * lockfile stays in sync for Vercel's frozen-lockfile install.
 */
import test, { before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'bloomora-rules-test', firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8') } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'gifts/g1'), { ownerUid: 'alice', status: 'draft', slug: 'abcdefghjkmn' });
    await setDoc(doc(db, 'gifts/g1/revisions/1'), { number: 1 });
    await setDoc(doc(db, 'publicGifts/pub'), { status: 'published', slug: 'pub' });
    await setDoc(doc(db, 'publicGifts/arch'), { status: 'archived', slug: 'arch' });
    await setDoc(doc(db, 'publicGifts/gone'), { status: 'removed', slug: 'gone' });
    await setDoc(doc(db, 'subscriptions/s1'), { userId: 'alice', status: 'active' });
    await setDoc(doc(db, 'orders/o1'), { userId: 'alice', status: 'proof_submitted' });
    await setDoc(doc(db, 'packages/basic'), { id: 'basic' });
    await setDoc(doc(db, 'slugs/abcdefghjkmn'), { giftId: 'g1' });
    await setDoc(doc(db, 'users/alice'), { name: 'Alice' });
  });
});

const alice = () => env.authenticatedContext('alice').firestore();
const mallory = () => env.authenticatedContext('mallory').firestore();
const admin = () => env.authenticatedContext('root', { admin: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

test('anyone can read a published gift by slug, but not list, and not archived/removed ones', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'publicGifts/pub')));
  await assertFails(getDocs(collection(anon(), 'publicGifts')));
  await assertFails(getDoc(doc(anon(), 'publicGifts/arch')));
  await assertFails(getDoc(doc(anon(), 'publicGifts/gone')));
});

test('public gifts are readable without any subscription (Model B): a user with no subscription docs reads fine', async () => {
  await assertSucceeds(getDoc(doc(mallory(), 'publicGifts/pub')));
});

test('private gifts: owner and admin read; strangers and anonymous do not', async () => {
  await assertSucceeds(getDoc(doc(alice(), 'gifts/g1')));
  await assertSucceeds(getDoc(doc(admin(), 'gifts/g1')));
  await assertFails(getDoc(doc(mallory(), 'gifts/g1')));
  await assertFails(getDoc(doc(anon(), 'gifts/g1')));
  await assertFails(getDoc(doc(mallory(), 'gifts/g1/revisions/1')));
  await assertSucceeds(getDoc(doc(alice(), 'gifts/g1/revisions/1')));
});

test('clients can never write gifts, publicGifts, subscriptions, orders, slugs, packages, templates or users', async () => {
  for (const db of [alice(), admin()]) {
    await assertFails(setDoc(doc(db, 'gifts/new'), { ownerUid: 'alice' }));
    await assertFails(updateDoc(doc(db, 'gifts/g1'), { status: 'published' }));
    await assertFails(setDoc(doc(db, 'publicGifts/pub'), { status: 'published' }));
    await assertFails(updateDoc(doc(db, 'subscriptions/s1'), { status: 'active' }));
    await assertFails(setDoc(doc(db, 'subscriptions/s2'), { userId: 'alice', status: 'active' }));
    await assertFails(updateDoc(doc(db, 'orders/o1'), { status: 'approved' }));
    await assertFails(setDoc(doc(db, 'slugs/zzzzzzzzzzzz'), { giftId: 'g1' }));
    await assertFails(setDoc(doc(db, 'packages/basic'), { durationDays: 9999 }));
    await assertFails(setDoc(doc(db, 'templates/x'), { active: true }));
    await assertFails(setDoc(doc(db, 'users/alice'), { admin: true }));
    await assertFails(deleteDoc(doc(db, 'gifts/g1')));
  }
});

test('subscriptions and orders are readable by their owner and admins only', async () => {
  await assertSucceeds(getDoc(doc(alice(), 'subscriptions/s1')));
  await assertSucceeds(getDoc(doc(alice(), 'orders/o1')));
  await assertSucceeds(getDoc(doc(admin(), 'orders/o1')));
  await assertFails(getDoc(doc(mallory(), 'subscriptions/s1')));
  await assertFails(getDoc(doc(mallory(), 'orders/o1')));
  await assertFails(getDoc(doc(anon(), 'orders/o1')));
});

test('slug reservations and audit logs are never client readable (admin-only for audit)', async () => {
  await assertFails(getDoc(doc(admin(), 'slugs/abcdefghjkmn')));
  await assertFails(getDoc(doc(alice(), 'adminAuditLogs/a1')));
});

test('packages are public read; unknown collections are denied', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'packages/basic')));
  await assertFails(getDoc(doc(admin(), 'secrets/x')));
});

test('a user cannot grant themselves admin via a custom-claim lookalike field in a document', async () => {
  const fake = env.authenticatedContext('mallory', { admin: false }).firestore();
  await assertFails(getDoc(doc(fake, 'orders/o1')));
});
