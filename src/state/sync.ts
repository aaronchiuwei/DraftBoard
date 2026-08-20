import { parsePersisted, type Persisted } from './persistence';
import { getSupabase } from './supabase';

/**
 * One row per account holding the same payload that goes to localStorage.
 * The draft is a single small document that is only ever read and written
 * whole, so there is nothing to gain from spreading it over real columns.
 */
const TABLE = 'draft_states';

/** The account's saved draft, or null when it has never synced or is unreadable. */
export async function pullRemote(userId: string): Promise<Persisted | null> {
  const pending = getSupabase();
  if (!pending) return null;

  const client = await pending;
  const { data, error } = await client
    .from(TABLE)
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return parsePersisted(data?.payload ?? null);
}

export async function pushRemote(userId: string, payload: Persisted): Promise<void> {
  const pending = getSupabase();
  if (!pending) return;

  const client = await pending;
  const { error } = await client.from(TABLE).upsert(
    { user_id: userId, payload, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );

  if (error) throw new Error(error.message);
}
