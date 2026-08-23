import { ACTUAL_SEASON } from '../data/stats';
import styles from './RookieTag.module.css';

/** Marks a player with no last-season stat line. */
export function RookieTag() {
  const tip = `Rookie — no ${ACTUAL_SEASON} stats`;

  return (
    <span class={styles.tag} title={tip} aria-label={tip}>
      R
    </span>
  );
}
