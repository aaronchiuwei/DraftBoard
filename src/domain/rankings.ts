import type { Player, RankSource, SourceKey } from '../types';
import { CONSENSUS } from '../types';

/** Sources counted toward consensus and shown in the rail and compare table. */
export function activeSources(
  sources: readonly RankSource[],
  disabled: readonly string[]
): RankSource[] {
  const off = new Set(disabled);
  return sources.filter(s => !off.has(s.id));
}

export function rankOf(player: Player, sourceId: string): number | null {
  const v = player.ranks[sourceId];
  return v === undefined || v === null ? null : v;
}

/** Mean of whichever ranks the player actually has. Null if he has none. */
export function consensusOf(player: Player, sourceIds: readonly string[]): number | null {
  let sum = 0;
  let n = 0;
  for (const id of sourceIds) {
    const v = rankOf(player, id);
    if (v !== null) {
      sum += v;
      n++;
    }
  }
  return n === 0 ? null : sum / n;
}

/** Resolves either a real source or the computed consensus pseudo-source. */
export function valueFor(
  player: Player,
  key: SourceKey,
  sourceIds: readonly string[]
): number | null {
  return key === CONSENSUS ? consensusOf(player, sourceIds) : rankOf(player, key);
}

/** Missing ranks sort last rather than first. */
export function sortValue(
  player: Player,
  key: SourceKey,
  sourceIds: readonly string[]
): number {
  return valueFor(player, key, sourceIds) ?? Number.MAX_SAFE_INTEGER;
}

export interface Spread {
  min: number;
  max: number;
  spread: number;
  counted: number;
}

/**
 * A player one source ranks 465th is not "ranked 465", he is off the board.
 * Ranks are capped at the draft's horizon first, so the result measures real
 * disagreement rather than how long each list happens to be.
 */
export function spreadOf(
  player: Player,
  sourceIds: readonly string[],
  cap: number
): Spread | null {
  const vs: number[] = [];
  for (const id of sourceIds) {
    const v = rankOf(player, id);
    if (v !== null) vs.push(Math.min(v, cap));
  }
  if (vs.length < 2) return null;
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  return { min, max, spread: max - min, counted: vs.length };
}

export interface RailDot {
  sourceId: string;
  color: string;
  /** -1 (this source is highest on him) to 1 (lowest), relative to consensus. */
  offset: number;
}

/** Spread beyond this many ranks from consensus pins the dot to the edge. */
const RAIL_SCALE = 26;

export function railDots(player: Player, sources: readonly RankSource[]): RailDot[] {
  const ids = sources.map(s => s.id);
  const cons = consensusOf(player, ids);
  if (cons === null) return [];
  const dots: RailDot[] = [];
  for (const source of sources) {
    const v = rankOf(player, source.id);
    if (v === null) continue;
    const offset = Math.max(-1, Math.min(1, (v - cons) / RAIL_SCALE));
    dots.push({ sourceId: source.id, color: source.color, offset });
  }
  return dots;
}

/** Horizon used for rank capping: everything reachable in this draft, plus slack. */
export function draftHorizon(totalPicks: number): number {
  return Math.max(200, totalPicks + 30);
}
