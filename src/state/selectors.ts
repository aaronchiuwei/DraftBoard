import type { AppState, Player, RankSource } from '../types';
import { getPool, type Pool } from '../data/pool';
import { activeSources, draftHorizon, sortValue } from '../domain/rankings';
import { lineupFor } from '../domain/roster';
import { draftedIds, teamAtPick, totalPicks } from '../domain/draft';

export function selectPool(state: AppState): Pool {
  return getPool(state.imported);
}

export function selectSources(state: AppState): RankSource[] {
  return activeSources(selectPool(state).sources, state.disabledSources);
}

export function selectSourceIds(state: AppState): string[] {
  return selectSources(state).map(s => s.id);
}

export function selectHorizon(state: AppState): number {
  return draftHorizon(totalPicks(state.draft.league));
}

/** Team currently on the clock, or null once every pick is in. */
export function selectTeamOnClock(state: AppState): number | null {
  const i = state.draft.picks.length;
  if (i >= totalPicks(state.draft.league)) return null;
  return teamAtPick(i, state.draft.league.teams);
}

const FLEX_POSITIONS = ['RB', 'WR', 'TE'];

function matchesFilters(player: Player, state: AppState, taken: Set<number>): boolean {
  const { ui } = state;
  if (ui.hideDrafted && taken.has(player.id)) return false;

  if (ui.pos === 'FLEX') {
    if (!FLEX_POSITIONS.includes(player.pos)) return false;
  } else if (ui.pos !== 'ALL' && player.pos !== ui.pos) {
    return false;
  }

  if (ui.query) {
    const q = ui.query.toLowerCase();
    if (!player.name.toLowerCase().includes(q) && !player.team.toLowerCase().includes(q)) {
      return false;
    }
  }
  return true;
}

/**
 * The player list for the current filters, sorted by the selected source.
 * Players the selected source does not rank are dropped, since showing them
 * at the bottom under a dash implies a ranking that does not exist.
 */
export function selectVisiblePlayers(state: AppState): Player[] {
  const pool = selectPool(state);
  const sourceIds = selectSourceIds(state);
  const taken = draftedIds(state.draft);
  const key = state.ui.source;

  return pool.players
    .filter(p => {
      if (!matchesFilters(p, state, taken)) return false;
      return sortValue(p, key, sourceIds) !== Number.MAX_SAFE_INTEGER;
    })
    .sort((a, b) => sortValue(a, key, sourceIds) - sortValue(b, key, sourceIds));
}

/** Compare needs at least two opinions to show a gap, and ignores the source filter. */
export function selectComparablePlayers(state: AppState): Player[] {
  const pool = selectPool(state);
  const sourceIds = selectSourceIds(state);
  const taken = draftedIds(state.draft);

  return pool.players.filter(p => {
    if (!matchesFilters(p, state, taken)) return false;
    return sourceIds.filter(id => p.ranks[id] !== undefined).length >= 2;
  });
}

export function selectMyLineup(state: AppState) {
  return lineupFor(state.draft, selectPool(state), state.draft.league.mySlot);
}

/* --------------------------------------------------------- queue and flags */

export function selectFlagged(state: AppState): Set<number> {
  return new Set(state.flagged);
}

/** Queue position by player id, one-indexed, for the badge on a row. */
export function selectQueuePositions(state: AppState): Map<number, number> {
  return new Map(state.queue.map((id, i) => [id, i + 1]));
}

export interface QueueEntry {
  player: Player;
  /** One-indexed place in the queue. */
  place: number;
  taken: boolean;
}

/**
 * The queue in order, with ids the pool no longer carries dropped so a stale
 * entry cannot render a blank row.
 */
export function selectQueue(state: AppState): QueueEntry[] {
  const pool = selectPool(state);
  const taken = draftedIds(state.draft);
  const out: QueueEntry[] = [];

  state.queue.forEach((id, i) => {
    const player = pool.byId.get(id);
    if (player) out.push({ player, place: i + 1, taken: taken.has(id) });
  });
  return out;
}

/** Highest-queued player still on the board, for the nudge in the clock strip. */
export function selectNextInQueue(state: AppState): Player | null {
  return selectQueue(state).find(e => !e.taken)?.player ?? null;
}
