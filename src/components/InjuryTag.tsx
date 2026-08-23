import { useRef, useState } from 'preact/hooks';
import type { InjuryReport } from '../data/injuries';
import { injuryTooltip } from '../data/injuries';
import styles from './InjuryTag.module.css';

interface Props {
  report: InjuryReport;
}

interface TipPos {
  top: number;
  left: number;
}

const VIEWPORT_PAD = 8;
const TIP_GAP = 6;

/** Short injury tag with a hover tooltip for return date and time out. */
export function InjuryTag({ report }: Props) {
  const tagRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [tipPos, setTipPos] = useState<TipPos | null>(null);
  const tip = injuryTooltip(report);
  const classes = [styles.tag, report.agree === false ? styles.split : '']
    .filter(Boolean)
    .join(' ');

  function placeTip() {
    const tag = tagRef.current;
    const tipEl = tipRef.current;
    if (!tag || !tipEl) return;

    // Measure off-screen; display:none gives no box to measure.
    tipEl.style.visibility = 'hidden';
    tipEl.style.display = 'block';
    const tipRect = tipEl.getBoundingClientRect();
    tipEl.style.visibility = '';
    tipEl.style.display = '';

    const tagRect = tag.getBoundingClientRect();
    let top = tagRect.top - tipRect.height - TIP_GAP;
    if (top < VIEWPORT_PAD) {
      top = tagRect.bottom + TIP_GAP;
    }

    let left = tagRect.left + tagRect.width / 2 - tipRect.width / 2;
    left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - VIEWPORT_PAD - tipRect.width));

    setTipPos({ top, left });
  }

  function hideTip() {
    setTipPos(null);
  }

  return (
    <span
      ref={tagRef}
      class={classes}
      tabIndex={0}
      aria-label={tip.replace(/\n/g, '. ')}
      onMouseEnter={placeTip}
      onMouseLeave={hideTip}
      onFocus={placeTip}
      onBlur={hideTip}
    >
      {report.tag}
      <span
        ref={tipRef}
        class={tipPos ? `${styles.tip} ${styles.tipOn}` : styles.tip}
        role="tooltip"
        style={tipPos ? { top: `${tipPos.top}px`, left: `${tipPos.left}px` } : undefined}
      >
        {tip.split('\n').map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </span>
    </span>
  );
}
