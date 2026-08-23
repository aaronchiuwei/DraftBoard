import type { Player, Pos } from '../types';
import { ACTUAL_SEASON, PROJECTED_SEASON, type CompareStats, type InsightStats } from '../data/stats';
import {
  formatLuckPts,
  formatRankLabel,
  formatTrend,
  luckFor,
  olFor,
  playcallerFor,
  rbVolumeFor
} from '../data/research';
import { formatPassRate, formatPlaysPerGame, formatTeamRank, TEAM_STATS_SEASON, type TeamContext } from '../data/teams';

export interface InsightRow {
  key: string;
  label: string;
  value: string;
  hint?: string;
}

export interface InsightSection {
  key: string;
  label: string;
  rows: InsightRow[];
}

function row(key: string, label: string, value: string | null, hint?: string): InsightRow | null {
  if (value === null || value === '–') return null;
  return { key, label, value, hint };
}

function rows(...items: (InsightRow | null)[]): InsightRow[] {
  return items.filter((r): r is InsightRow => r !== null);
}

function formatVol(v: number | null): string {
  if (v === null) return '–';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function formatRankNum(rank: number | null): string {
  if (rank === null) return '–';
  return `#${rank}`;
}

function formatMaybeRank(v: number | string | null): string {
  if (v === null || v === undefined) return '–';
  if (typeof v === 'number') return `#${v}`;
  return String(v);
}

function researchSections(player: Player): InsightSection[] {
  const sections: InsightSection[] = [];
  const ol = olFor(player);
  const pc = playcallerFor(player);
  const rbVol = rbVolumeFor(player);
  const luck = luckFor(player);

  if (ol && player.team !== 'FA') {
    sections.push({
      key: 'ol',
      label: 'Fantasy OL Ranking',
      rows: rows(
        row('ol2025', '2025 OL rank', formatRankNum(ol.olRank2025), 'Avg rank of run-block grade + win rate'),
        row('olTrend', 'OL trend', formatTrend(ol.trend), 'Better or worse after draft, free agency, and returns'),
        row('olCohesion', 'Cohesion', String(ol.cohesion), 'Starting OL returning'),
        row('ol2026', "'26 OL rank", `${ol.olRank2026}/5`, 'Projected run-blocking grade'),
        row('olQbRuns', 'QB runs', ol.qbRuns ? 'Yes' : 'No', 'Designed QB runs that open the run game')
      )
    });
  }

  if (pc && player.team !== 'FA') {
    const pcRows = rows(
      row('pcName', 'Playcaller', pc.name),
      row(
        'pcFantasy',
        'Fantasy PPG',
        pc.fantasyPPG === null ? null : `${pc.fantasyPPG} (${formatRankNum(pc.fantasyRank)})`,
        'Avg team fantasy PPG over playcaller last 1–5 seasons'
      ),
      row(
        'pc2025',
        'Team 2025 PPG',
        pc.team2025PPG === null ? null : `${pc.team2025PPG} (${formatRankNum(pc.team2025Rank)})`,
        'How this team scored in 2025'
      )
    );

    if (player.pos === 'RB') {
      pcRows.push(
        ...rows(
          row(
            'pcRb',
            'RB PPG',
            pc.rbPPG === null ? null : `${pc.rbPPG} (${formatRankNum(pc.rbRank)})`,
            'RB fantasy points per game under this playcaller'
          ),
          row(
            'pcRb1',
            '%RB1',
            pc.rb1Pct === null ? null : `${pc.rb1Pct}% (${formatRankNum(pc.rb1Rank)})`,
            'Share of RB fantasy points to the starter — higher leans bellcow'
          )
        )
      );
    }

    if (player.pos === 'WR' || player.pos === 'TE') {
      pcRows.push(
        ...rows(
          row(
            'pcWr',
            'WR PPG',
            pc.wrPPG === null ? null : `${pc.wrPPG} (${formatRankNum(pc.wrRank)})`,
            'WR fantasy points per game under this playcaller'
          )
        )
      );
    }

    pcRows.push(
      ...rows(
        row('pcPersonnel', 'Personnel', pc.personnel),
        row('pcPace', '2025 pace', formatMaybeRank(pc.paceRank), 'Pace-of-play rank'),
        row('pcScheme', 'Run scheme', pc.runScheme),
        row('pcMotion', 'Motion rank', formatMaybeRank(pc.motionRank)),
        row('pcFormation', 'Formation', pc.formation),
        row('pcScreen', 'RB screen rank', formatMaybeRank(pc.rbScreenRank), 'How often this offense uses RB screens')
      )
    );

    if (pcRows.length > 0) {
      sections.push({ key: 'playcaller', label: 'Playcaller', rows: pcRows });
    }
  }

  if (rbVol && player.pos === 'RB') {
    sections.push({
      key: 'rbVolumeTable',
      label: 'RB Volume (Table)',
      rows: rows(
        row(
          'rbProjVolRank',
          'Proj. volume rank',
          formatRankLabel(rbVol.projVolumeRank),
          'Fully weighted with targets and goal-line attempts'
        ),
        row(
          'rbAdjVolRank',
          `${ACTUAL_SEASON} adj. volume`,
          rbVol.adjVolumeRank === null ? null : formatRankLabel(rbVol.adjVolumeRank),
          'Volume version of adjusted fantasy PPG'
        ),
        row(
          'rbConfidence',
          'Confidence',
          rbVol.confidence === 'high' ? 'High' : rbVol.confidence === 'mid' ? 'Medium' : 'Low',
          'Projection confidence from the research model'
        )
      )
    });
  }

  if (luck) {
    const label = luck.ptsLost > 0 ? 'Unlucky' : 'Lucky';
    sections.push({
      key: 'luck',
      label: 'Luck Metric',
      rows: rows(
        row(
          'luckPts',
          'Points lost',
          formatLuckPts(luck.ptsLost),
          'Positive = unlucky (left points on the field). Negative = lucky.'
        ),
        row('luckPct', '% pts lost', `${luck.pctLost > 0 ? '+' : ''}${luck.pctLost}%`, `${label} vs expected scoring in 2025`),
        row('luckTag', '2025 label', label, 'Based on 25 luck/unluck situations (OT pts, DPI, busted coverage, etc.)')
      )
    });
  }

  return sections;
}

/** Shared insight sections for the player sheet and compare panel. */
export function buildInsightSections(
  player: Player,
  stats: CompareStats,
  insight: InsightStats,
  team: TeamContext | null
): InsightSection[] {
  const pos = player.pos;
  const sections: InsightSection[] = [];

  sections.push({
    key: 'fantasy',
    label: 'Fantasy Points',
    rows: [
      row('seasonTotal', 'Season total', formatVol(stats.seasonTotal)),
      row('seasonAvg', 'Season avg.', formatVol(stats.seasonAvg)),
      row('projAvg', 'Proj. avg.', formatVol(stats.projAvg)),
      row('projTotal', 'Proj. total', formatVol(stats.projTotal))
    ].filter((r): r is InsightRow => r !== null)
  });

  sections.push({
    key: 'performance',
    label: 'Past Performance vs. Projection',
    rows: [
      row(
        'vsProj',
        'Avg. vs proj.',
        stats.vsProjAvg === null ? null : `${stats.vsProjAvg > 0 ? '+' : ''}${stats.vsProjAvg} pts`,
        `Weekly over/under vs ${ACTUAL_SEASON} projection`
      ),
      row(
        'beatProj',
        '% games beat proj.',
        stats.beatProjPct === null ? null : `${stats.beatProjPct}%`,
        `% of ${ACTUAL_SEASON} weeks scoring above projection`
      )
    ].filter((r): r is InsightRow => r !== null)
  });

  if (pos === 'RB' || pos === 'WR' || pos === 'TE') {
    const volumeRows = [
      row(
        'projVolume',
        'Proj. volume',
        formatVol(insight.projVolume),
        `Weighted carries + targets + 4.4× red-zone/goal-line opps (${PROJECTED_SEASON})`
      ),
      row(
        'adjVolume',
        `${ACTUAL_SEASON} adj. volume`,
        formatVol(insight.adjVolume),
        'Same weighting applied to last season volume'
      ),
      row(
        'recFloor',
        'Rec. floor (proj tgt)',
        insight.recFloor === null ? null : String(Math.round(insight.recFloor)),
        `Projected ${PROJECTED_SEASON} targets — receiving floor`
      ),
      row(
        'tdOpps',
        'TD opps (proj)',
        insight.tdOpps === null ? null : String(Math.round(insight.tdOpps * 10) / 10),
        'Projected red-zone targets + goal-line carries (scaled from 2025 rates when needed)'
      )
    ].filter((r): r is InsightRow => r !== null);

    if (pos === 'RB' && insight.goldTier) {
      volumeRows.push(
        row(
          'goldTier',
          'Volume tier',
          insight.goldTier,
          'Gold Standard = high TD opps + high receiving floor. Gold Diggers = TD opps without targets. Silver Lining = targets without TD opps. Fool\'s Gold = volume without valuable touches.'
        )!
      );
    }

    if (volumeRows.length > 0) {
      sections.push({ key: 'volume', label: 'Volume & Opportunity', rows: volumeRows });
    }
  }

  if (pos === 'QB') {
    sections.push({
      key: 'qbVol',
      label: 'QB Volume & Rushing',
      rows: [
        row(
          'qbVolume',
          'Proj. QB volume',
          formatVol(insight.qbVolume),
          `Projected pass attempts + rush attempts (${PROJECTED_SEASON})`
        ),
        row(
          'qbRush',
          'Proj. rush att',
          insight.qbRushAtt === null ? null : String(Math.round(insight.qbRushAtt)),
          'Rushing attempts are the stickiest QB stat year-to-year'
        ),
        row(
          'qbRzRush',
          'Rush RZ att (2025)',
          insight.qbRzRush === null ? null : String(Math.round(insight.qbRzRush)),
          `${ACTUAL_SEASON} designed/red-zone rushes — highest value near the goal line`
        )
      ].filter((r): r is InsightRow => r !== null)
    });
  }

  const effRows = efficiencyRows(pos, insight);
  if (effRows.length > 0) {
    sections.push({ key: 'efficiency', label: 'Efficiency', rows: effRows });
  }

  sections.push({
    key: 'redzone',
    label: 'Red Zone',
    rows: [
      row(
        'rzOpp',
        'Opportunity',
        stats.rzOpportunity === null ? null : String(Math.round(stats.rzOpportunity)),
        `${ACTUAL_SEASON} red-zone touches or attempts`
      ),
      row(
        'rzEff',
        'Efficiency',
        stats.rzEfficiency === null ? null : `${stats.rzEfficiency}%`,
        'TDs per red-zone opportunity'
      )
    ].filter((r): r is InsightRow => r !== null)
  });

  const teamRows = [
    row(
      'offRank',
      'Offense rank',
      formatTeamRank(team?.offRank ?? null),
      `Yards per play, ${TEAM_STATS_SEASON}`
    ),
    row(
      'defRank',
      'Defense rank',
      formatTeamRank(team?.defRank ?? null),
      `Yards allowed per game, ${TEAM_STATS_SEASON}`
    ),
    row(
      'shootout',
      'Shootout rank',
      formatTeamRank(team?.shootoutRank ?? null),
      'High-scoring offense + leaky defense = more fantasy-friendly game environments'
    ),
    row('passRate', 'Pass rate', formatPassRate(team?.passRate ?? null), 'Pass attempts as share of offensive plays'),
    row(
      'pace',
      'Plays / game',
      formatPlaysPerGame(team?.playsPerGame ?? null),
      'Offensive plays per game — pace of play'
    )
  ].filter((r): r is InsightRow => r !== null);

  if (pos === 'RB' && team?.rb1Share !== null && team?.rb1Share !== undefined) {
    teamRows.push(
      row(
        'rb1Share',
        'Team %RB1',
        `${team.rb1Share}%`,
        'Share of projected RB fantasy points going to the lead back on this team — higher leans bellcow'
      )!
    );
  }

  if (teamRows.length > 0) {
    sections.push({ key: 'team', label: 'Team Context', rows: teamRows });
  }

  sections.push(...researchSections(player));

  return sections.filter(s => s.rows.length > 0);
}

function efficiencyRows(pos: Pos, insight: InsightStats): InsightRow[] {
  if (pos === 'WR' || pos === 'TE') {
    return [
      row(
        'ypt',
        'Yds / target',
        formatVol(insight.ydsPerTarget),
        `${ACTUAL_SEASON} receiving yards per target`
      ),
      row(
        'fdPerTgt',
        '1st downs / tgt',
        formatVol(insight.firstDownsPerTarget),
        'Chain-moving rate per target — strong predictor of future success'
      )
    ].filter((r): r is InsightRow => r !== null);
  }

  if (pos === 'RB') {
    return [
      row('rushYpa', 'Rush yds / att', formatVol(insight.rushYpa), `${ACTUAL_SEASON} rushing efficiency`),
      row(
        'ypt',
        'Yds / target',
        formatVol(insight.ydsPerTarget),
        `${ACTUAL_SEASON} receiving yards per target`
      ),
      row(
        'fdPerTgt',
        '1st downs / tgt',
        formatVol(insight.firstDownsPerTarget),
        'Receiving chain-moving rate per target'
      )
    ].filter((r): r is InsightRow => r !== null);
  }

  if (pos === 'QB') {
    return [
      row('passYpa', 'Pass yds / att', formatVol(insight.passYpa), `${ACTUAL_SEASON} passing efficiency`),
      row('rushYpa', 'Rush yds / att', formatVol(insight.rushYpa), `${ACTUAL_SEASON} rushing efficiency`)
    ].filter((r): r is InsightRow => r !== null);
  }

  return [];
}

/** Numeric values for compare highlighting — higher is better unless noted. */
export function insightCompareValues(
  player: Player,
  stats: CompareStats,
  insight: InsightStats,
  team: TeamContext | null
): Record<string, number | null> {
  return {
    seasonTotal: stats.seasonTotal,
    seasonAvg: stats.seasonAvg,
    projAvg: stats.projAvg,
    projTotal: stats.projTotal,
    vsProj: stats.vsProjAvg,
    beatProj: stats.beatProjPct,
    projVolume: insight.projVolume,
    adjVolume: insight.adjVolume,
    recFloor: insight.recFloor,
    tdOpps: insight.tdOpps,
    qbVolume: insight.qbVolume,
    qbRush: insight.qbRushAtt,
    qbRzRush: insight.qbRzRush,
    ypt: insight.ydsPerTarget,
    fdPerTgt: insight.firstDownsPerTarget,
    rushYpa: insight.rushYpa,
    passYpa: insight.passYpa,
    rzOpp: stats.rzOpportunity,
    rzEff: stats.rzEfficiency,
    offRank: team?.offRank ?? null,
    defRank: team?.defRank ?? null,
    shootout: team?.shootoutRank ?? null,
    passRate: team?.passRate ?? null,
    pace: team?.playsPerGame ?? null,
    rb1Share: player.pos === 'RB' ? team?.rb1Share ?? null : null
  };
}

/** Lower rank number is better for rank fields. */
export function isLowerBetterKey(key: string): boolean {
  return key === 'offRank' || key === 'defRank' || key === 'shootout';
}

export interface CompareInsightCandidate {
  player: Player;
  stats: CompareStats;
  insight: InsightStats;
  team: TeamContext | null;
}

export interface CompareInsightSection {
  key: string;
  label: string;
  rows: Array<InsightRow & { display: string[]; best: number | null }>;
}

function bestIndex(key: string, values: (number | null)[], samePos: boolean): number | null {
  if (!samePos) return null;
  const lowerBetter = isLowerBetterKey(key);
  let best: number | null = null;
  let bestVal = lowerBetter ? Infinity : -Infinity;
  let tied = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || v === undefined) continue;
    const wins = lowerBetter ? v < bestVal : v > bestVal;
    const ties = v === bestVal;
    if (wins) {
      bestVal = v;
      best = i;
      tied = false;
    } else if (ties) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/** Merge per-player insight sections into a compare grid. */
export function buildCompareInsightSections(
  candidates: CompareInsightCandidate[]
): CompareInsightSection[] {
  if (candidates.length === 0) return [];

  const samePos = candidates.every(c => c.player.pos === candidates[0]?.player.pos);
  const sectionOrder: string[] = [];
  const sectionLabels = new Map<string, string>();
  const rowMeta = new Map<string, Map<string, InsightRow>>();

  for (const c of candidates) {
    for (const section of buildInsightSections(c.player, c.stats, c.insight, c.team)) {
      if (!sectionLabels.has(section.key)) {
        sectionLabels.set(section.key, section.label);
        sectionOrder.push(section.key);
        rowMeta.set(section.key, new Map());
      }
      const rows = rowMeta.get(section.key)!;
      for (const row of section.rows) {
        if (!row) continue;
        if (!rows.has(row.key)) rows.set(row.key, row);
      }
    }
  }

  return sectionOrder.map(key => {
    const rows = rowMeta.get(key)!;
    return {
      key,
      label: sectionLabels.get(key) ?? key,
      rows: [...rows.values()].map(row => {
        const display = candidates.map(c => {
          const match = buildInsightSections(c.player, c.stats, c.insight, c.team)
            .find(s => s.key === key)
            ?.rows.find(r => r.key === row.key);
          return match?.value ?? '–';
        });
        const nums = candidates.map(c =>
          insightCompareValues(c.player, c.stats, c.insight, c.team)[row.key] ?? null
        );
        const best =
          row.key === 'goldTier' || display.every(v => v === '–')
            ? null
            : bestIndex(row.key, nums, samePos);
        return { ...row, display, best };
      })
    };
  });
}
