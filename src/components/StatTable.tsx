import {
  ACTUAL_SEASON,
  PROJECTED_SEASON,
  STATS_SOURCE,
  formatStat,
  type PlayerStats
} from '../data/stats';
import styles from './StatTable.module.css';

/**
 * Last season beside this season's projection. They are shown side by side
 * because neither is worth much alone: the gap between them is the argument
 * for or against the player.
 */
export function StatTable({ stats }: { stats: PlayerStats }) {
  return (
    <div class={styles.stats}>
      <div class={`${styles.row} ${styles.head}`}>
        <span class="eyebrow">Stats</span>
        <span class="eyebrow">{ACTUAL_SEASON}</span>
        <span class={`eyebrow ${styles.projHead}`}>{PROJECTED_SEASON} proj</span>
      </div>

      {stats.rows.map(row => (
        <div key={row.key} class={`${styles.row} ${row.key === 'pts' ? styles.points : ''}`}>
          <span class={styles.label}>{row.label}</span>
          <span class={`${styles.value} mono`}>{formatStat(row.actual)}</span>
          <span class={`${styles.value} ${styles.proj} mono`}>{formatStat(row.projected)}</span>
        </div>
      ))}

      <div class={styles.note}>
        {stats.hasActual
          ? `${STATS_SOURCE} · PPR scoring`
          : `No ${ACTUAL_SEASON} snaps — ${STATS_SOURCE} projection only`}
      </div>
    </div>
  );
}
