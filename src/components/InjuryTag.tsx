import type { InjuryReport } from '../data/injuries';
import { injuryTooltip } from '../data/injuries';
import { TapTooltip } from './TapTooltip';
import styles from './InjuryTag.module.css';

interface Props {
  report: InjuryReport;
}

/** Short injury tag with a hover or tap tooltip for return date and time out. */
export function InjuryTag({ report }: Props) {
  const tip = injuryTooltip(report);
  const classes = [styles.tag, report.agree === false ? styles.split : '']
    .filter(Boolean)
    .join(' ');

  return (
    <TapTooltip content={tip} class={classes}>
      {report.tag}
    </TapTooltip>
  );
}
