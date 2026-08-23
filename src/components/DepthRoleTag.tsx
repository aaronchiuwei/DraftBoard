import { DEPTH_LABEL, DEPTH_SOURCE } from '../data/depth';
import styles from './DepthRoleTag.module.css';

interface Props {
  /** Depth-chart slot label, e.g. "WR1" or "RB2". */
  role: string;
}

/** Marks where a player sits on his team's depth chart. */
export function DepthRoleTag({ role }: Props) {
  const tip = `${DEPTH_SOURCE} depth chart · ${role} · ${DEPTH_LABEL}`;

  return (
    <span class={styles.tag} title={tip} aria-label={tip}>
      {role}
    </span>
  );
}
