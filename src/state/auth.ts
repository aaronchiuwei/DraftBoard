import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createStore, useStoreState } from './store';
import { AUTH_CONFIGURED, getSupabase, readableAuthError } from './supabase';
import { pullRemote, pushRemote } from './sync';
import { activeUserId, adoptUser, store as appStore } from './app';
import {
  defaultState,
  fromPersisted,
  loadState,
  readLastUser,
  readLocalAccounts,
  readPersisted,
  savedAtOf,
  toPersisted,
  claimOrphanedDeviceState,
  writeLocalAccounts,
  writeLocalOnly,
  type Persisted
} from './persistence';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface AuthState {
  /** False when no Supabase project is configured; accounts stay on this device. */
  configured: boolean;
  status: 'loading' | 'signedOut' | 'signedIn';
  userId: string | null;
  email: string | null;
  sync: SyncStatus;
  error: string | null;
  notice: string | null;
  /** A sign-in or sign-up request is in flight. */
  busy: boolean;
}

/* An account remembered on this device is trusted until the cloud contradicts
   it, so a draft opens offline without a sign-in screen in the way. Local
   accounts are the same: lastUser is enough, because there is no network to wait on. */
const bootUser = readLastUser();
const bootLocal = bootUser ? (readLocalAccounts().find(a => a.id === bootUser) ?? null) : null;

// prior "continue without an account" opt-outs no longer apply
writeLocalOnly(false);

export const authStore = createStore<AuthState>({
  configured: AUTH_CONFIGURED,
  status: bootUser ? 'signedIn' : AUTH_CONFIGURED ? 'loading' : 'signedOut',
  userId: bootUser,
  email: bootLocal?.email ?? null,
  sync: 'idle',
  error: null,
  notice: null,
  busy: false
});

export function useAuth(): AuthState {
  return useStoreState(authStore);
}

function patch(next: Partial<AuthState>): void {
  authStore.set(state => ({ ...state, ...next }));
}

/**
 * The account whose draft has been reconciled with the cloud. Until a merge
 * has happened there is nothing safe to push: the local copy might be a stale
 * device that would otherwise overwrite a newer draft from another one.
 */
let mergedUser: string | null = null;

/* ------------------------------------------------------------------- merge */

function pickWinner(own: Persisted | null, remote: Persisted | null): Persisted | null {
  if (own && remote) return savedAtOf(remote) > savedAtOf(own) ? remote : own;
  return own ?? remote;
}

async function mergeWithCloud(userId: string, own: Persisted | null): Promise<void> {
  patch({ sync: 'syncing', error: null });
  try {
    const remote = await pullRemote(userId);
    const winner = pickWinner(own, remote);

    if (winner && winner === remote) {
      const next = fromPersisted(remote);
      if (next) adoptUser(userId, next);
    } else if (winner) {
      await pushRemote(userId, winner);
    }

    mergedUser = userId;
    patch({ sync: 'synced' });
  } catch (err) {
    // the draft is safe locally either way, so a failure here only stops
    // pushing; it never discards or half-applies anything
    mergedUser = null;
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    patch({
      sync: offline ? 'offline' : 'error',
      error: offline ? null : readableAuthError(err instanceof Error ? err.message : String(err))
    });
  }
}

/* -------------------------------------------------------------- push loop */

/** Long enough that a run of picks is one request, short enough to not lose a round. */
const PUSH_DELAY = 2500;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

async function pushNow(): Promise<void> {
  const userId = activeUserId();
  if (!userId || userId !== mergedUser) return;
  try {
    await pushRemote(userId, toPersisted(appStore.get()));
    patch({ sync: 'synced' });
  } catch {
    patch({ sync: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error' });
  }
}

function startCloudPush(): void {
  appStore.subscribe(() => {
    if (!activeUserId() || activeUserId() !== mergedUser) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void pushNow(), PUSH_DELAY);
  });
}

/** Best effort on the way out; localStorage is what actually guarantees the draft. */
export function flushCloud(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  void pushNow();
}

/* ---------------------------------------------------------------- sessions */

async function applySession(session: Session | null): Promise<void> {
  const user = session?.user ?? null;

  if (!user) {
    mergedUser = null;
    if (activeUserId() !== null) adoptUser(null, defaultState());
    patch({ status: 'signedOut', userId: null, email: null, sync: 'idle' });
    return;
  }

  const userId = user.id;
  patch({ status: 'signedIn', userId, email: user.email ?? null, error: null });

  /* Read before adopting. Adopting writes the state back out with a fresh
     timestamp, and comparing that against the cloud would always look newer. */
  const own = readPersisted(userId);

  if (activeUserId() !== userId) {
    const next =
      fromPersisted(own) ?? claimOrphanedDeviceState() ?? defaultState();
    adoptUser(userId, next);
  }

  await mergeWithCloud(userId, own ?? toPersisted(appStore.get()));
}

export async function initAuth(): Promise<void> {
  const pending = getSupabase();
  if (!pending) {
    const userId = readLastUser();
    const account = userId ? (readLocalAccounts().find(a => a.id === userId) ?? null) : null;
    patch({
      status: userId ? 'signedIn' : 'signedOut',
      userId,
      email: account?.email ?? null
    });
    return;
  }

  startCloudPush();

  try {
    const client = await pending;
    const { data } = await client.auth.getSession();
    await applySession(data.session);
    client.auth.onAuthStateChange((_event, session) => void applySession(session));
  } catch {
    // no connection to confirm anything; carry on with what the device knows
    patch({ status: readLastUser() ? 'signedIn' : 'signedOut', sync: 'offline' });
  }

  addEventListener('online', () => {
    const userId = activeUserId();
    if (userId && mergedUser === null) void mergeWithCloud(userId, readPersisted(userId));
  });
}

/* ----------------------------------------------------------------- actions */

async function withClient<T>(run: (client: SupabaseClient) => Promise<T>): Promise<T | null> {
  const pending = getSupabase();
  if (!pending) {
    patch({ error: 'Accounts are not configured for this build.' });
    return null;
  }

  patch({ busy: true, error: null, notice: null });
  try {
    return await run(await pending);
  } catch (err) {
    patch({ error: readableAuthError(err instanceof Error ? err.message : String(err)) });
    return null;
  } finally {
    patch({ busy: false });
  }
}

export async function signIn(email: string, password: string): Promise<boolean> {
  if (!AUTH_CONFIGURED) return localAuth('in', email, password);

  const ok = await withClient(async client => {
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) {
      patch({ error: readableAuthError(error.message) });
      return false;
    }
    return true;
  });
  return ok === true;
}

export async function signUp(email: string, password: string): Promise<boolean> {
  if (!AUTH_CONFIGURED) return localAuth('up', email, password);

  const ok = await withClient(async client => {
    const { data, error } = await client.auth.signUp({ email: email.trim(), password });
    if (error) {
      patch({ error: readableAuthError(error.message) });
      return false;
    }
    // with email confirmation on, there is no session until the link is opened
    if (!data.session) {
      patch({ notice: 'Account created. Confirm the email, then sign in.' });
      return false;
    }
    return true;
  });
  return ok === true;
}

export async function signOut(): Promise<void> {
  if (AUTH_CONFIGURED) {
    await withClient(async client => {
      await client.auth.signOut();
      return true;
    });
  }
  // a failed network call still means this device should stop being signed in
  await applySession(null);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Email and password against the device's own account list. Same storage slots
 * the cloud path uses, so adding a project later does not have to invent a
 * second way of keeping two people on one phone apart.
 */
async function localAuth(mode: 'in' | 'up', email: string, password: string): Promise<boolean> {
  patch({ busy: true, error: null, notice: null });
  try {
    const normalized = normalizeEmail(email);
    const accounts = readLocalAccounts();

    if (mode === 'up') {
      if (accounts.some(a => a.email === normalized)) {
        patch({ error: 'That email already has an account. Sign in instead.' });
        return false;
      }
      const salt = randomHex(16);
      const id = crypto.randomUUID();
      writeLocalAccounts([
        ...accounts,
        { id, email: normalized, salt, hash: await hashPassword(password, salt) }
      ]);
      // a brand-new account starts clean unless this device still has a draft
      // from before accounts existed — that is claimed once, then cleared
      adoptUser(id, claimOrphanedDeviceState() ?? defaultState());
      patch({ status: 'signedIn', userId: id, email: normalized, error: null });
      return true;
    }

    const user = accounts.find(a => a.email === normalized);
    if (!user || (await hashPassword(password, user.salt)) !== user.hash) {
      patch({ error: 'That email and password do not match.' });
      return false;
    }
    adoptUser(user.id, loadState(user.id));
    patch({ status: 'signedIn', userId: user.id, email: user.email, error: null });
    return true;
  } finally {
    patch({ busy: false });
  }
}
