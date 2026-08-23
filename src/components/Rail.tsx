import type { Player, RankSource } from '../types';
import { railDots } from '../domain/rankings';
import styles from './Rail.module.css';

/** Vertical offset per source, so overlapping dots stay individually readable. */
const ROW_HEIGHT = 7;
const TOP_PAD = 2;

interface Props {
  player: Player;
  sources: readonly RankSource[];
}

/**
 * One dot per active source on a short axis: left of centre means that source
 * is higher on him than the consensus is. A tight cluster is agreement, a
 * spread is a fight. It exists so a contested player is visible while scrolling.
 */
export function Rail({ player, sources }: Props) {
  const dots = railDots(player, sources);
  if (dots.length === 0) return <span class={styles.rail} />;

  const index = new Map(sources.map((s, i) => [s.id, i]));

  return (
    <span class={styles.rail}>
      <span class={styles.axis} />
      <span class={styles.center} />
      {dots.map(dot => (
        <i
          key={dot.sourceId}
          class={styles.dot}
          style={{
            left: `${50 + dot.offset * 46}%`,
            top: `${TOP_PAD + (index.get(dot.sourceId) ?? 0) * ROW_HEIGHT}px`,
            background: dot.color
          }}
        />
      ))}
    </span>
  );
}
