import type { DraftState, Player, SourceKey } from '../types';
import type { Pool } from '../data/pool';
import { depthRoleFor } from '../data/depth';
import { injuryFor } from '../data/injuries';
import { ACTUAL_SEASON, compareStatsFor, formatPctValue, formatSignedStat, projectedPointsFor } from '../data/stats';
import {
  formatPassRate,
  formatPlaysPerGame,
  formatTeamRank,
  teamContextFor
} from '../data/teams';
import { draftedIds } from './draft';
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
  team: ReturnType<typeof teamContextFor>;
}

export interface CompareMetricRow {
  key: string;
  label: string;
  display: string[];
  /** Index of the best value in the row, when one player clearly leads. */
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

function formatPts(v: number | null): string {
  if (v === null) return '–';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
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

/** Lower team rank (#1) is better on offense/defense boards. */
function bestTeamRank(values: (number | null)[]): number | null {
  return bestLower(values);
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
  if (c.team?.offRank !== null && c.team?.offRank !== undefined) score += (33 - c.team.offRank) * 0.4;
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

function metric(
  key: string,
  label: string,
  display: string[],
  best: number | null,
  hint?: string
): CompareMetricRow {
  return { key, label, display, best, hint };
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

  const sections: CompareSection[] = [
    {
      key: 'draft',
      label: 'Draft Value',
      rows: [
        metric(
          'consensus',
          'Consensus',
          candidates.map(c => formatRank(c.consensus)),
          bestLower(candidates.map(c => c.consensus))
        ),
        metric(
          'source',
          sourceLabel,
          candidates.map(c => formatRank(c.sourceRank)),
          bestLower(candidates.map(c => c.sourceRank))
        ),
        metric(
          'depth',
          'Depth chart',
          candidates.map(c => c.depthRole ?? '–'),
          null
        )
      ]
    },
    {
      key: 'fantasy',
      label: 'Fantasy Points',
      rows: [
        metric(
          'seasonTotal',
          'Season total',
          candidates.map(c => formatPts(c.stats.seasonTotal)),
          samePos ? bestHigher(candidates.map(c => c.stats.seasonTotal)) : null
        ),
        metric(
          'seasonAvg',
          'Season avg.',
          candidates.map(c => formatPts(c.stats.seasonAvg)),
          samePos ? bestHigher(candidates.map(c => c.stats.seasonAvg)) : null
        ),
        metric(
          'projAvg',
          'Proj. avg.',
          candidates.map(c => formatPts(c.stats.projAvg)),
          samePos ? bestHigher(candidates.map(c => c.stats.projAvg)) : null
        ),
        metric(
          'projTotal',
          'Proj. total',
          candidates.map(c => formatPts(c.stats.projTotal)),
          samePos ? bestHigher(candidates.map(c => c.stats.projTotal)) : null
        )
      ]
    },
    {
      key: 'performance',
      label: 'Past Performance vs. Projection',
      rows: [
        metric(
          'vsProj',
          'Avg. vs proj.',
          candidates.map(c => formatSignedStat(c.stats.vsProjAvg, ' pts')),
          samePos ? bestHigher(candidates.map(c => c.stats.vsProjAvg)) : null,
          `Weekly over/under vs ${ACTUAL_SEASON} projection`
        ),
        metric(
          'beatProj',
          '% games beat proj.',
          candidates.map(c => formatPctValue(c.stats.beatProjPct)),
          samePos ? bestHigher(candidates.map(c => c.stats.beatProjPct)) : null,
          `% of ${ACTUAL_SEASON} weeks scoring above projection`
        )
      ]
    },
    {
      key: 'redzone',
      label: 'Red Zone',
      rows: [
        metric(
          'rzOpp',
          'Opportunity',
          candidates.map(c => (c.stats.rzOpportunity === null ? '–' : String(Math.round(c.stats.rzOpportunity)))),
          samePos ? bestHigher(candidates.map(c => c.stats.rzOpportunity)) : null,
          `${ACTUAL_SEASON} red-zone touches or attempts`
        ),
        metric(
          'rzEff',
          'Efficiency',
          candidates.map(c => (c.stats.rzEfficiency === null ? '–' : formatPctValue(c.stats.rzEfficiency))),
          samePos ? bestHigher(candidates.map(c => c.stats.rzEfficiency)) : null,
          'TDs per red-zone opportunity'
        )
      ]
    },
    {
      key: 'team',
      label: 'Team Context',
      rows: [
        metric(
          'offRank',
          'Offense rank',
          candidates.map(c => formatTeamRank(c.team?.offRank ?? null)),
          bestTeamRank(candidates.map(c => c.team?.offRank ?? null)),
          `Yards per play, ${ACTUAL_SEASON}`
        ),
        metric(
          'defRank',
          'Defense rank',
          candidates.map(c => formatTeamRank(c.team?.defRank ?? null)),
          bestTeamRank(candidates.map(c => c.team?.defRank ?? null)),
          `Yards allowed per play, ${ACTUAL_SEASON}`
        ),
        metric(
          'passRate',
          'Pass rate',
          candidates.map(c => formatPassRate(c.team?.passRate ?? null)),
          null,
          'Pass attempts as share of offensive plays'
        ),
        metric(
          'pace',
          'Plays / game',
          candidates.map(c => formatPlaysPerGame(c.team?.playsPerGame ?? null)),
          bestHigher(candidates.map(c => c.team?.playsPerGame ?? null)),
          'Offensive plays per game — more snaps, more opportunity'
        )
      ]
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
    sections,
    pickIndex,
    headline: `Draft ${winner.player.name}`,
    detail: reasons.join(' · ')
  };
}
