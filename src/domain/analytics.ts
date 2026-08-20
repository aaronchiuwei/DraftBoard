import type { DraftState, Player, Pos, SourceKey } from '../types';
import type { Pool } from '../data/pool';
import { consensusOf, sortValue, spreadOf, valueFor } from './rankings';
import { draftedIds, picksUntilTurn } from './draft';

/* ------------------------------------------------------------------ value */

export interface PickValue {
  pickIndex: number;
  player: Player;
  consensus: number | null;
  /** Positive means he lasted past his rank; negative means a reach. */
  delta: number | null;
}

export function pickValue(
  draft: DraftState,
  pool: Pool,
  sourceIds: readonly string[],
  pickIndex: number
): PickValue | null {
  const id = draft.picks[pickIndex];
  if (id === undefined) return null;
  const player = pool.byId.get(id);
  if (!player) return null;
  const consensus = consensusOf(player, sourceIds);
  return {
    pickIndex,
    player,
    consensus,
    delta: consensus === null ? null : consensus - (pickIndex + 1)
  };
}

/** Biggest reaches and biggest falls so far, for the draft recap strip. */
export function notablePicks(
  draft: DraftState,
  pool: Pool,
  sourceIds: readonly string[],
  limit = 5
): { steals: PickValue[]; reaches: PickValue[] } {
  const all: PickValue[] = [];
  for (let i = 0; i < draft.picks.length; i++) {
    const v = pickValue(draft, pool, sourceIds, i);
    if (v && v.delta !== null) all.push(v);
  }
  const sorted = [...all].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  return {
    steals: sorted.slice(0, limit),
    reaches: sorted.slice(-limit).reverse()
  };
}

/* ------------------------------------------------------------------- runs */

export interface PositionRun {
  pos: Pos;
  recent: number;
  expected: number;
  ratio: number;
  hot: boolean;
}

const RUN_WINDOW = 12;
const RUN_MIN_COUNT = 3;
const RUN_RATIO = 1.75;

/**
 * Compares each position's share of the last `window` picks against its share
 * of the draft as a whole. A run is what makes you take the third-best tight
 * end early, so it is worth surfacing before it has finished.
 */
export function positionalRuns(
  draft: DraftState,
  pool: Pool,
  window = RUN_WINDOW
): PositionRun[] {
  const total = draft.picks.length;
  if (total < window) return [];

  const recentIds = draft.picks.slice(-window);
  const recentCount = new Map<Pos, number>();
  const overallCount = new Map<Pos, number>();

  for (const id of draft.picks) {
    const p = pool.byId.get(id);
    if (p) overallCount.set(p.pos, (overallCount.get(p.pos) ?? 0) + 1);
  }
  for (const id of recentIds) {
    const p = pool.byId.get(id);
    if (p) recentCount.set(p.pos, (recentCount.get(p.pos) ?? 0) + 1);
  }

  const runs: PositionRun[] = [];
  for (const [pos, recent] of recentCount) {
    const expected = ((overallCount.get(pos) ?? 0) / total) * window;
    const ratio = expected === 0 ? Infinity : recent / expected;
    runs.push({
      pos,
      recent,
      expected,
      ratio,
      hot: recent >= RUN_MIN_COUNT && ratio >= RUN_RATIO
    });
  }
  return runs.sort((a, b) => b.ratio - a.ratio);
}

/* ------------------------------------------------------------------ tiers */

export interface Tier {
  index: number;
  players: Player[];
}

const MIN_TIER_GAP = 6;
const TIER_GAP_FACTOR = 1.8;

/**
 * Tier breaks are found from the gaps between consecutive ranks rather than
 * fixed bucket sizes, so a cluster of five interchangeable backs stays one
 * tier and a real cliff starts a new one.
 */
export function tiersFor(
  players: readonly Player[],
  key: SourceKey,
  sourceIds: readonly string[]
): Tier[] {
  const ranked = players
    .map(p => ({ p, v: valueFor(p, key, sourceIds) }))
    .filter((x): x is { p: Player; v: number } => x.v !== null)
    .sort((a, b) => a.v - b.v);

  if (ranked.length === 0) return [];

  const gaps: number[] = [];
  for (let i = 1; i < ranked.length; i++) {
    gaps.push((ranked[i]?.v ?? 0) - (ranked[i - 1]?.v ?? 0));
  }
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const median = sortedGaps.length
    ? sortedGaps[Math.floor(sortedGaps.length / 2)] ?? 1
    : 1;
  const threshold = Math.max(MIN_TIER_GAP, median * TIER_GAP_FACTOR);

  const tiers: Tier[] = [];
  let current: Player[] = [];
  for (let i = 0; i < ranked.length; i++) {
    const entry = ranked[i];
    if (!entry) continue;
    if (i > 0 && (gaps[i - 1] ?? 0) >= threshold) {
      tiers.push({ index: tiers.length + 1, players: current });
      current = [];
    }
    current.push(entry.p);
  }
  if (current.length) tiers.push({ index: tiers.length + 1, players: current });
  return tiers;
}

/** Player id -> tier number, for marking cliff rows in the player list. */
export function tierMap(
  players: readonly Player[],
  key: SourceKey,
  sourceIds: readonly string[]
): Map<number, number> {
  const out = new Map<number, number>();
  for (const tier of tiersFor(players, key, sourceIds)) {
    for (const p of tier.players) out.set(p.id, tier.index);
  }
  return out;
}

/* --------------------------------------------------------------- survival */

const SURVIVAL_SIGMA_MIN = 6;
const SURVIVAL_SIGMA_MAX = 40;

/**
 * Rough odds a player is still there at your next turn. Counts how many
 * undrafted players the field ranks ahead of him and compares that to the
 * number of picks in between, widened by how much the sources disagree about
 * him — a contested player is less predictable, in both directions.
 */
export function survivalOdds(
  player: Player,
  draft: DraftState,
  pool: Pool,
  sourceIds: readonly string[],
  horizon: number
): number | null {
  const mySlot = draft.league.mySlot;
  const gap = picksUntilTurn(mySlot, draft.picks.length, draft.league);
  if (gap === null || gap <= 0) return null;

  const cons = consensusOf(player, sourceIds);
  if (cons === null) return null;

  const taken = draftedIds(draft);
  let ahead = 0;
  for (const other of pool.players) {
    if (other.id === player.id || taken.has(other.id)) continue;
    const c = consensusOf(other, sourceIds);
    if (c !== null && c < cons) ahead++;
  }

  const spread = spreadOf(player, sourceIds, horizon);
  const sigma = Math.min(
    SURVIVAL_SIGMA_MAX,
    Math.max(SURVIVAL_SIGMA_MIN, (spread?.spread ?? 12) * 0.8)
  );

  return 1 / (1 + Math.exp(-(ahead - gap) / sigma));
}

/* ---------------------------------------------------------- best by need  */

export function bestAvailableByNeed(
  draft: DraftState,
  pool: Pool,
  needed: ReadonlySet<Pos>,
  key: SourceKey,
  sourceIds: readonly string[],
  limit = 5
): Player[] {
  const taken = draftedIds(draft);
  return pool.players
    .filter(p => !taken.has(p.id) && needed.has(p.pos))
    .sort((a, b) => sortValue(a, key, sourceIds) - sortValue(b, key, sourceIds))
    .slice(0, limit);
}
