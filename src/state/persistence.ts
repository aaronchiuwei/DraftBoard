import type { AppState, DraftState, ImportedSource, UiState } from '../types';
import { DEFAULT_ROSTER, normalizeLeague } from '../domain/roster';
import { defaultTeamNames } from '../domain/draft';
import { DEFAULT_DEPTH_TEAM } from '../data/depth';

const KEY = 'draftroom.v2';
const LEGACY_KEY = 'draftroom.v1';
const SCHEMA = 5;
/** Later schemas only add fields, so an older entry still loads with defaults. */
const READABLE_SCHEMAS = [2, 3, 4, 5];

/** UI choices worth remembering between sessions. Search text and the open sheet are not. */
type PersistedUi = Pick<
  UiState,
  'view' | 'source' | 'pos' | 'hideDrafted' | 'compareSort' | 'team' | 'depthTeam'
>;

export interface Persisted {
  schema: number;
  draft: DraftState;
  imported: ImportedSource[];
  disabledSources: string[];
  ui: PersistedUi;
  /** Added in v3. */
  queue?: number[];
  flagged?: number[];
  /** Added in v5. */
  comparePins?: number[];
  /**
   * Added in v4. Epoch milliseconds at the moment of writing, which is what
   * decides a device against the copy in the cloud when both have moved.
   */
  savedAt?: number;
}

/**
 * One entry per account, so two people sharing a phone do not share a draft,
 * and signing out leaves the local-only draft exactly where it was.
 */
export function storageKey(userId: string | null): string {
  return userId ? `${KEY}.u.${userId}` : KEY;
}

function numberList(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((n): n is number => typeof n === 'number') : [];
}

/** Shape written by the original single-file version. */
interface LegacyV1 {
  ready?: boolean;
  teams?: number;
  rounds?: number;
  me?: number;
  names?: string[];
  picks?: number[];
}

const memory = new Map<string, string>();

function readRaw(key: string): string | null {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) return stored;
  } catch {
    /* private mode or storage disabled; fall through to the in-memory copy */
  }
  return memory.get(key) ?? null;
}

function writeRaw(key: string, value: string): void {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or storage disabled; the in-memory copy is the fallback */
  }
}

function removeRaw(key: string): void {
  memory.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to do; the in-memory copy is already gone */
  }
}

const LAST_USER_KEY = 'draftroom.lastUser';
const LOCAL_ONLY_KEY = 'draftroom.localOnly';
const LOCAL_USERS_KEY = 'draftroom.localUsers';

/** Email accounts that live on this device when no cloud project is configured. */
export interface LocalAccount {
  id: string;
  email: string;
  salt: string;
  hash: string;
}

function isLocalAccount(value: unknown): value is LocalAccount {
  if (!value || typeof value !== 'object') return false;
  const account = value as LocalAccount;
  return (
    typeof account.id === 'string' &&
    typeof account.email === 'string' &&
    typeof account.salt === 'string' &&
    typeof account.hash === 'string'
  );
}

export function readLocalAccounts(): LocalAccount[] {
  const parsed = safeJson(readRaw(LOCAL_USERS_KEY) ?? '');
  return Array.isArray(parsed) ? parsed.filter(isLocalAccount) : [];
}

export function writeLocalAccounts(accounts: LocalAccount[]): void {
  writeRaw(LOCAL_USERS_KEY, JSON.stringify(accounts));
}

/**
 * Who was signed in last time. Confirming a session with Supabase is a network
 * round trip, and the draft has to be on screen before that finishes, so this
 * is what decides which account's draft to open with.
 */
export function readLastUser(): string | null {
  return readRaw(LAST_USER_KEY);
}

export function writeLastUser(userId: string | null): void {
  if (userId) writeRaw(LAST_USER_KEY, userId);
  else removeRaw(LAST_USER_KEY);
}

/** Whether this device has been told to stop asking about accounts. */
export function readLocalOnly(): boolean {
  return readRaw(LOCAL_ONLY_KEY) === '1';
}

export function writeLocalOnly(value: boolean): void {
  if (value) writeRaw(LOCAL_ONLY_KEY, '1');
  else removeRaw(LOCAL_ONLY_KEY);
}

export function defaultDraft(): DraftState {
  return {
    ready: false,
    league: {
      teams: 12,
      rounds: 16,
      mySlot: 0,
      names: defaultTeamNames(12, 0),
      roster: DEFAULT_ROSTER.map(s => ({ ...s, accepts: [...s.accepts] }))
    },
    picks: []
  };
}

export function defaultUi(): UiState {
  return {
    view: 'setup',
    source: 'nffc',
    pos: 'ALL',
    hideDrafted: true,
    query: '',
    team: 0,
    depthTeam: DEFAULT_DEPTH_TEAM,
    compareSort: 'spread',
    sheetPlayerId: null
  };
}

function migrateLegacy(legacy: LegacyV1): DraftState | null {
  if (!legacy || typeof legacy !== 'object') return null;
  const teams = typeof legacy.teams === 'number' ? legacy.teams : 12;
  const mySlot = typeof legacy.me === 'number' ? legacy.me : 0;
  return {
    ready: legacy.ready === true,
    league: normalizeLeague({
      teams,
      rounds: typeof legacy.rounds === 'number' ? legacy.rounds : 16,
      mySlot,
      names: Array.isArray(legacy.names) ? legacy.names : defaultTeamNames(teams, mySlot),
      roster: DEFAULT_ROSTER.map(s => ({ ...s, accepts: [...s.accepts] }))
    }),
    picks: Array.isArray(legacy.picks) ? legacy.picks.filter(n => typeof n === 'number') : []
  };
}

export function defaultState(): AppState {
  return {
    draft: defaultDraft(),
    ui: defaultUi(),
    imported: [],
    disabledSources: [],
    queue: [],
    flagged: [],
    comparePins: []
  };
}

/**
 * The payload written to storage and, when signed in, sent to the cloud. Both
 * ends speak this one shape, so a draft can move between them untranslated.
 */
export function toPersisted(state: AppState): Persisted {
  return {
    schema: SCHEMA,
    savedAt: Date.now(),
    draft: state.draft,
    imported: state.imported,
    disabledSources: state.disabledSources,
    queue: state.queue,
    flagged: state.flagged,
    comparePins: state.comparePins,
    ui: {
      view: state.ui.view,
      source: state.ui.source,
      pos: state.ui.pos,
      hideDrafted: state.ui.hideDrafted,
      compareSort: state.ui.compareSort,
      team: state.ui.team,
      depthTeam: state.ui.depthTeam
    }
  };
}

export function fromPersisted(parsed: Persisted | null): AppState | null {
  if (!parsed) return null;
  const base = defaultState();
  return {
    draft: { ...parsed.draft, league: normalizeLeague(parsed.draft.league) },
    ui: { ...base.ui, ...parsed.ui, query: '', sheetPlayerId: null },
    imported: Array.isArray(parsed.imported) ? parsed.imported : [],
    disabledSources: Array.isArray(parsed.disabledSources) ? parsed.disabledSources : [],
    queue: numberList(parsed.queue),
    flagged: numberList(parsed.flagged),
    comparePins: numberList(parsed.comparePins)
  };
}

/** Anything unreadable is treated as absent rather than thrown. */
export function parsePersisted(raw: unknown): Persisted | null {
  const value: unknown = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Persisted;
  if (!READABLE_SCHEMAS.includes(parsed.schema) || !parsed.draft) return null;
  return parsed;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function readPersisted(userId: string | null = null): Persisted | null {
  return parsePersisted(readRaw(storageKey(userId)));
}

/** Epoch millis of a payload's last write; 0 for one saved before v4. */
export function savedAtOf(parsed: Persisted | null): number {
  return typeof parsed?.savedAt === 'number' ? parsed.savedAt : 0;
}

export function loadState(userId: string | null = null): AppState {
  const stored = fromPersisted(readPersisted(userId));
  if (stored) return stored;

  const base = defaultState();

  // a draft may already be in progress under the pre-refactor key, which was
  // written before accounts existed and so belongs to the device, not a user
  if (userId === null) {
    const legacyRaw = readRaw(LEGACY_KEY);
    if (legacyRaw) {
      try {
        const draft = migrateLegacy(JSON.parse(legacyRaw) as LegacyV1);
        if (draft) {
          return { ...base, draft, ui: { ...base.ui, view: draft.ready ? 'players' : 'setup' } };
        }
      } catch {
        /* ignore and start fresh */
      }
    }
  }

  return base;
}

export function saveState(state: AppState, userId: string | null = null): void {
  writeRaw(storageKey(userId), JSON.stringify(toPersisted(state)));
}

/**
 * Browsers evict an ordinary site's localStorage under pressure, and Safari
 * clears it after seven days away. A granted persist exempts this origin.
 */
export async function requestPersistentStorage(): Promise<void> {
  if (!navigator.storage?.persist) return;
  try {
    if (!(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not fatal; the draft still saves, it is just evictable */
  }
}
