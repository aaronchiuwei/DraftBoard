import type { DraftState, Player, SourceKey } from '../types';
import type { Pool } from '../data/pool';
import { depthRoleFor } from '../data/depth';
import { injuryFor } from '../data/injuries';
import { projectedPointsFor } from '../data/stats';
import { survivalOdds } from './analytics';
import { draftedIds } from './draft';
import { lineupFor, neededPositions } from './roster';
import { consensusOf, spreadOf, valueFor } from './rankings';

export const MAX_COMPARE_PINS = 4;

export interface CompareCandidate {
  player: Player;
  consensus: number | null;
  sourceRank: number | null;
  projected: number | null;
  survival: number | null;
  spread: number | null;
  depthRole: string | null;
  fillsNeed: boolean;
  injured: boolean;
}

export interface CompareMetricRow {
  key: string;
  label: string;
  display: string[];
  /** Index of the best value in the row, when one player clearly leads. */
  best: number | null;
}

export interface CompareDecision {
  players: Player[];
  candidates: CompareCandidate[];
  metrics: CompareMetricRow[];
  pickIndex: number;
  headline: string;
  detail: string;
}

function formatRank(v: number | null): string {
  if (v === null) return '–';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function formatPct(v: number | null): string {
  if (v === null) return '–';
  return `${Math.round(v * 100)}%`;
}

/** Lower numeric rank is better; returns sole winner index or null on a tie. */
function bestLower(values: (number | null)[]): number | null {
  let best: number | null = null;
  let bestVal = Infinity;
  let tied = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || v === undefined) continue;
    if (v < bestVal) {
      bestVal = v;
      best = i;
      tied = false;
    } else if (v === bestVal) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/** Higher numeric value is better; returns sole winner index or null on a tie. */
function bestHigher(values: (number | null)[]): number | null {
  let best: number | null = null;
  let bestVal = -Infinity;
  let tied = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || v === undefined) continue;
    if (v > bestVal) {
      bestVal = v;
      best = i;
      tied = false;
    } else if (v === bestVal) {
      tied = true;
    }
  }
  return tied ? null : best;
}

function bestNeed(values: boolean[]): number | null {
  const winners = values.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
  if (winners.length === 1) return winners[0] ?? null;
  return null;
}

export function buildCompareCandidates(
  playerIds: readonly number[],
  draft: DraftState,
  pool: Pool,
  sourceIds: readonly string[],
  sourceKey: SourceKey,
  horizon: number
): CompareCandidate[] {
  const taken = draftedIds(draft);
  const needed = neededPositions(lineupFor(draft, pool, draft.league.mySlot));

  return playerIds
    .map(id => pool.byId.get(id))
    .filter((p): p is Player => p !== undefined && !taken.has(p.id))
    .map(player => {
      const spread = spreadOf(player, sourceIds, horizon);
      return {
        player,
        consensus: consensusOf(player, sourceIds),
        sourceRank: valueFor(player, sourceKey, sourceIds),
        projected: projectedPointsFor(player),
        survival: survivalOdds(player, draft, pool, sourceIds, horizon),
        spread: spread?.spread ?? null,
        depthRole: depthRoleFor(player),
        fillsNeed: needed.has(player.pos),
        injured: injuryFor(player) !== null
      };
    });
}

function scoreCandidate(c: CompareCandidate): number {
  let score = 0;
  if (c.consensus !== null) score += (400 - c.consensus) * 3;
  if (c.sourceRank !== null) score += (400 - c.sourceRank) * 2;
  if (c.fillsNeed) score += 25;
  if (c.projected !== null) score += c.projected * 0.15;
  if (c.survival !== null) score += c.survival * 10;
  if (c.injured) score -= 15;
  return score;
}

function buildReasons(winner: CompareCandidate, others: CompareCandidate[]): string[] {
  const reasons: string[] = [];

  if (winner.consensus !== null) {
    const otherCons = others.map(o => o.consensus).filter((v): v is number => v !== null);
    if (otherCons.length > 0) {
      const bestOther = Math.min(...otherCons);
      if (bestOther - winner.consensus >= 3) {
        reasons.push(
          `Best consensus (${formatRank(winner.consensus)} vs ${formatRank(bestOther)})`
        );
      }
    }
  }

  if (winner.fillsNeed && others.some(o => !o.fillsNeed)) {
    reasons.push(`Fills your open ${winner.player.pos} slot`);
  }

  if (winner.survival !== null) {
    for (const other of others) {
      if (
        other.survival !== null &&
        winner.survival >= 0.55 &&
        other.survival <= 0.35 &&
        winner.survival - other.survival >= 0.15
      ) {
        reasons.push(
          `More likely still there next pick (${formatPct(winner.survival)} vs ${formatPct(other.survival)})`
        );
        break;
      }
    }
  }

  const samePos = others.every(o => o.player.pos === winner.player.pos);
  if (samePos && winner.projected !== null) {
    const otherProj = others.map(o => o.projected).filter((v): v is number => v !== null);
    if (otherProj.length > 0) {
      const bestOther = Math.max(...otherProj);
      if (winner.projected - bestOther >= 8) {
        reasons.push(`Higher projection (${Math.round(winner.projected)} PPR pts)`);
      }
    }
  }

  if (reasons.length === 0) {
    reasons.push('Best overall value across your rankings');
  }

  return reasons.slice(0, 3);
}

export function buildCompareDecision(
  playerIds: readonly number[],
  draft: DraftState,
  pool: Pool,
  sourceIds: readonly string[],
  sourceKey: SourceKey,
  sourceLabel: string,
  horizon: number
): CompareDecision | null {
  const candidates = buildCompareCandidates(
    playerIds,
    draft,
    pool,
    sourceIds,
    sourceKey,
    horizon
  );
  if (candidates.length < 2) return null;

  const players = candidates.map(c => c.player);
  const samePos = players.every(p => p.pos === players[0]?.pos);

  const metrics: CompareMetricRow[] = [
    {
      key: 'consensus',
      label: 'Consensus',
      display: candidates.map(c => formatRank(c.consensus)),
      best: bestLower(candidates.map(c => c.consensus))
    },
    {
      key: 'source',
      label: sourceLabel,
      display: candidates.map(c => formatRank(c.sourceRank)),
      best: bestLower(candidates.map(c => c.sourceRank))
    },
    {
      key: 'projected',
      label: 'Proj PPR',
      display: candidates.map(c => (c.projected === null ? '–' : String(Math.round(c.projected)))),
      best: samePos ? bestHigher(candidates.map(c => c.projected)) : null
    },
    {
      key: 'survival',
      label: 'Still there',
      display: candidates.map(c => formatPct(c.survival)),
      best: bestHigher(candidates.map(c => c.survival))
    },
    {
      key: 'depth',
      label: 'Depth',
      display: candidates.map(c => c.depthRole ?? '–'),
      best: null
    },
    {
      key: 'need',
      label: 'Fills need',
      display: candidates.map(c => (c.fillsNeed ? 'Yes' : '–')),
      best: bestNeed(candidates.map(c => c.fillsNeed))
    }
  ];

  let pickIndex = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!candidate) continue;
    const s = scoreCandidate(candidate);
    if (s > bestScore) {
      bestScore = s;
      pickIndex = i;
    }
  }

  const winner = candidates[pickIndex];
  if (!winner) return null;
  const others = candidates.filter((_, i) => i !== pickIndex);
  const reasons = buildReasons(winner, others);

  return {
    players,
    candidates,
    metrics,
    pickIndex,
    headline: `Draft ${winner.player.name}`,
    detail: reasons.join(' · ')
  };
}
