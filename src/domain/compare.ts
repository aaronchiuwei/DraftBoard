import type { DraftState, Player, SourceKey } from '../types';
import type { Pool } from '../data/pool';
import { depthRoleFor } from '../data/depth';
import { injuryFor } from '../data/injuries';
import { compareStatsFor, formatPctValue, insightStatsFor, projectedPointsFor } from '../data/stats';
import { teamContextFor } from '../data/teams';
import { draftedIds } from './draft';
import {
  buildCompareInsightSections,
  type CompareInsightSection
} from './insights';
import { consensusOf, spreadOf, valueFor } from './rankings';

export const MAX_COMPARE_PINS = 4;

export interface CompareCandidate {
  player: Player;
  consensus: number | null;
  sourceRank: number | null;
  projected: number | null;
  spread: number | null;
  depthRole: string | null;
  injured: boolean;
  stats: ReturnType<typeof compareStatsFor>;
  insight: ReturnType<typeof insightStatsFor>;
  team: ReturnType<typeof teamContextFor>;
}

export interface CompareMetricRow {
  key: string;
  label: string;
  display: string[];
  best: number | null;
  hint?: string;
}

export interface CompareSection {
  key: string;
  label: string;
  rows: CompareMetricRow[];
}

export interface CompareDecision {
  players: Player[];
  candidates: CompareCandidate[];
  sections: CompareSection[];
  pickIndex: number;
  headline: string;
  detail: string;
}

function formatRank(v: number | null): string {
  if (v === null) return '–';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
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
        spread: spread?.spread ?? null,
        depthRole: depthRoleFor(player),
        injured: injuryFor(player) !== null,
        stats: compareStatsFor(player),
        insight: insightStatsFor(player),
        team: teamContextFor(player)
      };
    });
}

function scoreCandidate(c: CompareCandidate): number {
  let score = 0;
  if (c.consensus !== null) score += (400 - c.consensus) * 3;
  if (c.sourceRank !== null) score += (400 - c.sourceRank) * 2;
  if (c.projected !== null) score += c.projected * 0.15;
  if (c.stats.projAvg !== null) score += c.stats.projAvg * 0.5;
  if (c.stats.beatProjPct !== null) score += c.stats.beatProjPct * 0.08;
  if (c.insight.projVolume !== null) score += c.insight.projVolume * 0.03;
  if (c.insight.tdOpps !== null) score += c.insight.tdOpps * 0.25;
  if (c.team?.offRank != null) score += (33 - c.team.offRank) * 0.4;
  if (c.team?.shootoutRank != null) score += (33 - c.team.shootoutRank) * 0.2;
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

  if (winner.insight.goldTier === 'Gold Standard' && others.some(o => o.insight.goldTier !== 'Gold Standard')) {
    reasons.push('Gold Standard volume profile');
  }

  if (winner.insight.projVolume !== null) {
    for (const other of others) {
      if (
        other.insight.projVolume !== null &&
        winner.insight.projVolume - other.insight.projVolume >= 25
      ) {
        reasons.push(
          `Higher valuable volume (${Math.round(winner.insight.projVolume)} vs ${Math.round(other.insight.projVolume)})`
        );
        break;
      }
    }
  }

  if (winner.stats.beatProjPct !== null) {
    for (const other of others) {
      if (
        other.stats.beatProjPct !== null &&
        winner.stats.beatProjPct - other.stats.beatProjPct >= 12
      ) {
        reasons.push(
          `Beat weekly projection more often (${formatPctValue(winner.stats.beatProjPct)} vs ${formatPctValue(other.stats.beatProjPct)})`
        );
        break;
      }
    }
  }

  if (winner.team?.offRank != null) {
    for (const other of others) {
      const otherOff = other.team?.offRank;
      const winnerOff = winner.team?.offRank;
      if (otherOff != null && winnerOff != null && otherOff - winnerOff >= 6) {
        reasons.push(`Better offense (#${winnerOff} vs #${otherOff})`);
        break;
      }
    }
  }

  if (reasons.length === 0) {
    reasons.push('Best overall value across your rankings');
  }

  return reasons.slice(0, 3);
}

function draftValueSection(
  candidates: CompareCandidate[],
  sourceLabel: string
): CompareSection {
  const bestLower = (values: (number | null)[]) => {
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
  };

  return {
    key: 'draft',
    label: 'Draft Value',
    rows: [
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
        key: 'depth',
        label: 'Depth chart',
        display: candidates.map(c => c.depthRole ?? '–'),
        best: null
      }
    ]
  };
}

function toCompareSections(insightSections: CompareInsightSection[]): CompareSection[] {
  return insightSections.map(s => ({
    key: s.key,
    label: s.label,
    rows: s.rows.map(r => ({
      key: r.key,
      label: r.label,
      display: r.display,
      best: r.best,
      hint: r.hint
    }))
  }));
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
  const insightSections = buildCompareInsightSections(candidates);
  const sections = [draftValueSection(candidates, sourceLabel), ...toCompareSections(insightSections)];

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
    sections,
    pickIndex,
    headline: `Draft ${winner.player.name}`,
    detail: reasons.join(' · ')
  };
}
