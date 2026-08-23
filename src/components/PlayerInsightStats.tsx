import type { Player } from '../types';
import { compareStatsFor, insightStatsFor } from '../data/stats';
import { teamContextFor } from '../data/teams';
import { buildInsightSections } from '../domain/insights';
import { TapTooltip } from './TapTooltip';
import styles from './PlayerInsightStats.module.css';

export function PlayerInsightStats({ player }: { player: Player }) {
  const stats = compareStatsFor(player);
  const insight = insightStatsFor(player);
  const team = teamContextFor(player);
  const sections = buildInsightSections(player, stats, insight, team);
  if (sections.length === 0) return null;

  return (
    <div class={styles.wrap}>
      {sections.map(block => (
        <div key={block.key} class={styles.block}>
          <div class={styles.sectionHead}>{block.label}</div>
          {block.rows.map(row => (
            <div key={row.key} class={styles.row}>
              <span class={styles.label}>
                {row.label}
                {row.hint && (
                  <TapTooltip content={row.hint} wrap class={styles.hintWrap}>
                    <span class={styles.hintMark} aria-label="What does this mean?">
                      ?
                    </span>
                  </TapTooltip>
                )}
              </span>
              <span class={`${styles.value} mono`}>{row.value}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
