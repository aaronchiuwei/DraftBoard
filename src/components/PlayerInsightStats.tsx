import type { Player } from '../types';
import {
  ACTUAL_SEASON,
  compareStatsFor,
  formatPctValue,
  formatSignedStat,
  formatStat
} from '../data/stats';
import {
  formatPassRate,
  formatPlaysPerGame,
  formatTeamRank,
  TEAM_STATS_SEASON,
  teamContextFor
} from '../data/teams';
import styles from './PlayerInsightStats.module.css';

interface InsightRow {
  label: string;
  value: string;
  hint?: string;
}

interface InsightSection {
  label: string;
  rows: InsightRow[];
}

function section(label: string, rows: InsightRow[]): InsightSection | null {
  const visible = rows.filter(r => r.value !== '–');
  if (visible.length === 0) return null;
  return { label, rows: visible };
}

function buildSections(player: Player): InsightSection[] {
  const stats = compareStatsFor(player);
  const team = teamContextFor(player);

  return [
    section('Fantasy Points', [
      { label: 'Season total', value: formatStat(stats.seasonTotal) },
      { label: 'Season avg.', value: formatStat(stats.seasonAvg) },
      { label: 'Proj. avg.', value: formatStat(stats.projAvg) },
      { label: 'Proj. total', value: formatStat(stats.projTotal) }
    ]),
    section('Past Performance vs. Projection', [
      {
        label: 'Avg. vs proj.',
        value: formatSignedStat(stats.vsProjAvg, ' pts'),
        hint: `Weekly over/under vs ${ACTUAL_SEASON} projection`
      },
      {
        label: '% games beat proj.',
        value: formatPctValue(stats.beatProjPct),
        hint: `% of ${ACTUAL_SEASON} weeks scoring above projection`
      }
    ]),
    section('Red Zone', [
      {
        label: 'Opportunity',
        value: stats.rzOpportunity === null ? '–' : String(Math.round(stats.rzOpportunity)),
        hint: `${ACTUAL_SEASON} red-zone touches or attempts`
      },
      {
        label: 'Efficiency',
        value: formatPctValue(stats.rzEfficiency),
        hint: 'TDs per red-zone opportunity'
      }
    ]),
    section('Team Context', [
      {
        label: 'Offense rank',
        value: formatTeamRank(team?.offRank ?? null),
        hint: `Yards per play, ${TEAM_STATS_SEASON}`
      },
      {
        label: 'Defense rank',
        value: formatTeamRank(team?.defRank ?? null),
        hint: `Yards allowed per game, ${TEAM_STATS_SEASON}`
      },
      {
        label: 'Pass rate',
        value: formatPassRate(team?.passRate ?? null),
        hint: 'Pass attempts as share of offensive plays'
      },
      {
        label: 'Plays / game',
        value: formatPlaysPerGame(team?.playsPerGame ?? null),
        hint: 'Offensive plays per game'
      }
    ])
  ].filter((s): s is InsightSection => s !== null);
}

export function PlayerInsightStats({ player }: { player: Player }) {
  const sections = buildSections(player);
  if (sections.length === 0) return null;

  return (
    <div class={styles.wrap}>
      {sections.map(block => (
        <div key={block.label} class={styles.block}>
          <div class={styles.sectionHead}>{block.label}</div>
          {block.rows.map(row => (
            <div key={row.label} class={styles.row}>
              <span class={styles.label} title={row.hint}>
                {row.label}
                {row.hint && <span class={styles.hintMark}> ?</span>}
              </span>
              <span class={`${styles.value} mono`}>{row.value}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
