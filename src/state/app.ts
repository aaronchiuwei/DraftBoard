import type {
  AppState,
  CompareSort,
  ImportedSource,
  PosFilter,
  SourceKey,
  UiState,
  ViewId
} from '../types';
import { createStore, useStoreState } from './store';
import { loadState, saveState } from './persistence';
import { normalizeLeague } from '../domain/roster';
import { defaultTeamNames, isDraftOver, totalPicks } from '../domain/draft';

export const store = createStore<AppState>(loadState());

export function useApp(): AppState {
  return useStoreState(store);
}

/* Writing the whole state on every keystroke is wasteful; a short debounce
   keeps saves off the interaction path without risking a lost pick. */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
store.subscribe(() => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveState(store.get()), 150);
});

/** Flush immediately when the app is being backgrounded or closed. */
export function flushSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  saveState(store.get());
}

function patchUi(patch: Partial<UiState>): void {
  store.set(s => ({ ...s, ui: { ...s.ui, ...patch } }));
}

/* ---------------------------------------------------------------- ui */

export const setView = (view: ViewId) => patchUi({ view });
export const setSource = (source: SourceKey) => patchUi({ source });
export const setPos = (pos: PosFilter) => patchUi({ pos });
export const setQuery = (query: string) => patchUi({ query });
export const setTeamTab = (team: number) => patchUi({ team });
export const setCompareSort = (compareSort: CompareSort) => patchUi({ compareSort });
export const openSheet = (sheetPlayerId: number) => patchUi({ sheetPlayerId });
export const closeSheet = () => patchUi({ sheetPlayerId: null });

export function toggleHideDrafted(): void {
  store.set(s => ({ ...s, ui: { ...s.ui, hideDrafted: !s.ui.hideDrafted } }));
}

/* ------------------------------------------------------------- drafting */

export function draftPlayer(playerId: number): void {
  store.set(s => {
    if (!s.draft.ready) return s;
    if (isDraftOver(s.draft)) return s;
    if (s.draft.picks.includes(playerId)) return s;
    return { ...s, draft: { ...s.draft, picks: [...s.draft.picks, playerId] } };
  });
}

/** Removes a player from the middle of the draft without undoing what followed. */
export function undraftPlayer(playerId: number): void {
  store.set(s => {
    const i = s.draft.picks.indexOf(playerId);
    if (i < 0) return s;
    const picks = [...s.draft.picks];
    picks.splice(i, 1);
    return { ...s, draft: { ...s.draft, picks } };
  });
}

export function undoLastPick(): void {
  store.set(s =>
    s.draft.picks.length === 0
      ? s
      : { ...s, draft: { ...s.draft, picks: s.draft.picks.slice(0, -1) } }
  );
}

export function resetPicks(): void {
  store.set(s => ({ ...s, draft: { ...s.draft, picks: [] } }));
}

/* --------------------------------------------------------------- league */

export function setTeams(teams: number): void {
  store.set(s => {
    const mySlot = Math.min(s.draft.league.mySlot, teams - 1);
    const names = defaultTeamNames(teams, mySlot);
    for (let i = 0; i < Math.min(s.draft.league.names.length, teams); i++) {
      names[i] = s.draft.league.names[i] ?? names[i] ?? `Team ${i + 1}`;
    }
    return {
      ...s,
      draft: { ...s.draft, league: normalizeLeague({ ...s.draft.league, teams, mySlot, names }) },
      ui: { ...s.ui, team: Math.min(s.ui.team, teams - 1) }
    };
  });
}

export function setRounds(rounds: number): void {
  store.set(s => {
    const league = { ...s.draft.league, rounds };
    // shrinking the draft cannot leave more picks than the board now holds
    const picks = s.draft.picks.slice(0, totalPicks(league));
    return { ...s, draft: { ...s.draft, league, picks } };
  });
}

export function setMySlot(mySlot: number): void {
  store.set(s => ({
    ...s,
    draft: { ...s.draft, league: normalizeLeague({ ...s.draft.league, mySlot }) }
  }));
}

export function setTeamName(index: number, name: string): void {
  store.set(s => {
    const names = [...s.draft.league.names];
    names[index] = name.trim() || `Team ${index + 1}`;
    return { ...s, draft: { ...s.draft, league: { ...s.draft.league, names } } };
  });
}

export function markReady(): void {
  store.set(s => ({ ...s, draft: { ...s.draft, ready: true }, ui: { ...s.ui, view: 'players' } }));
}

/* -------------------------------------------------------------- sources */

export function addImportedSource(source: ImportedSource): void {
  store.set(s => ({
    ...s,
    imported: [...s.imported.filter(x => x.meta.id !== source.meta.id), source]
  }));
}

export function removeImportedSource(id: string): void {
  store.set(s => ({
    ...s,
    imported: s.imported.filter(x => x.meta.id !== id),
    disabledSources: s.disabledSources.filter(x => x !== id),
    ui: { ...s.ui, source: s.ui.source === id ? 'nffc' : s.ui.source }
  }));
}

export function toggleSourceEnabled(id: string): void {
  store.set(s => {
    const off = s.disabledSources.includes(id);
    const disabledSources = off
      ? s.disabledSources.filter(x => x !== id)
      : [...s.disabledSources, id];
    // never leave the list sorted by a source that is now switched off
    const source = !off && s.ui.source === id ? 'cons' : s.ui.source;
    return { ...s, disabledSources, ui: { ...s.ui, source } };
  });
}
