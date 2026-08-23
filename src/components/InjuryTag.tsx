import type { InjuryReport } from '../data/injuries';
import { injuryTooltip } from '../data/injuries';
import styles from './InjuryTag.module.css';

interface Props {
  report: InjuryReport;
}

/** Short injury tag with a hover tooltip for return date and time out. */
export function InjuryTag({ report }: Props) {
  const tip = injuryTooltip(report);

  return (
    <span class={styles.tag} title={tip} aria-label={tip.replace(/\n/g, '. ')}>
      {report.tag}
      <span class={styles.tip} role="tooltip">
        {tip.split('\n').map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </span>
    </span>
  );
}
