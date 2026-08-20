import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Accounts are opt-in at build time. With no project configured the app is
 * exactly what it was before: local, offline, and account-free. That keeps the
 * repo runnable by anyone who clones it and keeps the tests off the network.
 */
export const AUTH_CONFIGURED = Boolean(url && anonKey);

let client: Promise<SupabaseClient> | null = null;

/**
 * Loaded on demand rather than imported outright. The SDK is comparable in
 * size to the whole rest of the app, and none of it is on the path between
 * opening the draft room and tapping a name.
 */
export function getSupabase(): Promise<SupabaseClient> | null {
  if (!url || !anonKey) return null;
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // no OAuth redirect to read back, and parsing one would fight the PWA
        detectSessionInUrl: false
      }
    })
  );
  return client;
}

/** Supabase phrases some failures for developers; these are the common ones. */
export function readableAuthError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) return 'That email and password do not match.';
  if (text.includes('email not confirmed')) return 'Check your inbox to confirm the address first.';
  if (text.includes('user already registered')) return 'That email already has an account. Sign in instead.';
  if (text.includes('password should be at least')) return 'Use a password of at least six characters.';
  if (text.includes('failed to fetch') || text.includes('network')) {
    return 'No connection. You can keep drafting offline.';
  }
  return message;
}
