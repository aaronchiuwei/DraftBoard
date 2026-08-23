import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import styles from './TapTooltip.module.css';

interface Props {
  content: string;
  children: ComponentChildren;
  /** Extra class on the trigger wrapper. */
  class?: string;
  /** Allow multi-line wrapping for longer stat hints. */
  wrap?: boolean;
}

interface TipPos {
  top: number;
  left: number;
}

const VIEWPORT_PAD = 8;
const TIP_GAP = 6;

/**
 * Tooltip that opens on hover, focus, or click/tap. Click/tap keeps it open
 * until the user taps away or toggles the trigger again — the hover-only
 * title attribute does not work on a phone in a draft room.
 */
export function TapTooltip({ content, children, class: className, wrap = false }: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [tipPos, setTipPos] = useState<TipPos | null>(null);

  function placeTip() {
    const trigger = wrapRef.current;
    const tipEl = tipRef.current;
    if (!trigger || !tipEl) return;

    tipEl.style.visibility = 'hidden';
    tipEl.style.display = 'block';
    const tipRect = tipEl.getBoundingClientRect();
    tipEl.style.visibility = '';
    tipEl.style.display = '';

    const tagRect = trigger.getBoundingClientRect();
    let top = tagRect.top - tipRect.height - TIP_GAP;
    if (top < VIEWPORT_PAD) {
      top = tagRect.bottom + TIP_GAP;
    }

    let left = tagRect.left + tagRect.width / 2 - tipRect.width / 2;
    left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - VIEWPORT_PAD - tipRect.width));

    setTipPos({ top, left });
  }

  function show() {
    setOpen(true);
    requestAnimationFrame(placeTip);
  }

  function hide() {
    if (!pinned) {
      setOpen(false);
      setTipPos(null);
    }
  }

  function togglePin(e: Event) {
    e.stopPropagation();
    e.preventDefault();
    if (pinned) {
      setPinned(false);
      setOpen(false);
      setTipPos(null);
      return;
    }
    setPinned(true);
    show();
  }

  useEffect(() => {
    if (!pinned) return;
    function onOutside(e: Event) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setPinned(false);
      setOpen(false);
      setTipPos(null);
    }
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [pinned]);

  const lines = content.split('\n');
  const tipClasses = [
    styles.tip,
    open && tipPos ? styles.tipOn : '',
    wrap ? styles.tipWrap : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      ref={wrapRef}
      class={`${styles.wrap} ${className ?? ''}`}
      tabIndex={0}
      aria-label={content.replace(/\n/g, '. ')}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={togglePin}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          togglePin(e);
        }
      }}
    >
      {children}
      <span
        ref={tipRef}
        class={tipClasses}
        role="tooltip"
        style={tipPos ? { top: `${tipPos.top}px`, left: `${tipPos.left}px` } : undefined}
      >
        {lines.map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </span>
    </span>
  );
}
