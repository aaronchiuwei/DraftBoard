import type { AppState, DraftState, ImportedSource, UiState } from '../types';
import { DEFAULT_ROSTER, normalizeLeague } from '../domain/roster';
import { defaultTeamNames } from '../domain/draft';
import { DEFAULT_DEPTH_TEAM } from '../data/depth';

const KEY = 'draftroom.v2';
const LEGACY_KEY = 'draftroom.v1';
const SCHEMA = 3;
/** v3 only adds fields, so a v2 entry still loads; the extras default to empty. */
const READABLE_SCHEMAS = [2, 3];

/** UI choices worth remembering between sessions. Search text and the open sheet are not. */
type PersistedUi = Pick<
  UiState,
  'view' | 'source' | 'pos' | 'hideDrafted' | 'compareSort' | 'team' | 'depthTeam'
>;

interface Persisted {
  schema: number;
  draft: DraftState;
  imported: ImportedSource[];
  disabledSources: string[];
  ui: PersistedUi;
  /** Added in v3. */
  queue?: number[];
  flagged?: number[];
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

const memory = { value: null as string | null };

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return key === KEY ? memory.value : null;
  }
}

function writeRaw(key: string, value: string): void {
  memory.value = value;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or storage disabled; the in-memory copy is the fallback */
  }
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

export function loadState(): AppState {
  const base: AppState = {
    draft: defaultDraft(),
    ui: defaultUi(),
    imported: [],
    disabledSources: [],
    queue: [],
    flagged: []
  };

  const raw = readRaw(KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Persisted;
      if (READABLE_SCHEMAS.includes(parsed.schema) && parsed.draft) {
        return {
          draft: { ...parsed.draft, league: normalizeLeague(parsed.draft.league) },
          ui: { ...base.ui, ...parsed.ui, query: '', sheetPlayerId: null },
          imported: Array.isArray(parsed.imported) ? parsed.imported : [],
          disabledSources: Array.isArray(parsed.disabledSources) ? parsed.disabledSources : [],
          queue: numberList(parsed.queue),
          flagged: numberList(parsed.flagged)
        };
      }
    } catch {
      /* corrupt entry falls through to the legacy check, then to defaults */
    }
  }

  // a draft may already be in progress under the pre-refactor key
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

  return base;
}

export function saveState(state: AppState): void {
  const payload: Persisted = {
    schema: SCHEMA,
    draft: state.draft,
    imported: state.imported,
    disabledSources: state.disabledSources,
    queue: state.queue,
    flagged: state.flagged,
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
  writeRaw(KEY, JSON.stringify(payload));
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
