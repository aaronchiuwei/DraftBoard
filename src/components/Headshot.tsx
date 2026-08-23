import { useState } from 'preact/hooks';
import type { Pos } from '../types';
import styles from './Headshot.module.css';

interface Props {
  /** Remote portrait, or null when there is none to load. */
  src: string | null;
  name: string;
  pos: Pos;
  /** Large for the player sheet; small for list rows. */
  size?: 'sm' | 'lg';
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '?';
  const last = words.length > 1 ? words[words.length - 1]?.[0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
}

/**
 * Headshots are the one thing in the app that needs the network, so a failed
 * load is a normal state rather than an error: it falls back to initials in the
 * position colour, which is the same information the row already carries.
 */
export function Headshot({ src, name, pos, size = 'lg' }: Props) {
  const [failed, setFailed] = useState(false);
  const wrapClass = size === 'sm' ? `${styles.wrap} ${styles.sm}` : styles.wrap;

  return (
    <div class={wrapClass} style={{ borderColor: `var(--${pos})` }}>
      {src && !failed ? (
        <img
          class={styles.img}
          src={src}
          alt=""
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span class={styles.initials} style={{ color: `var(--${pos})` }}>
          {initials(name)}
        </span>
      )}
    </div>
  );
}
