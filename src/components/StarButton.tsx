import { toggleFlagged } from '../state/app';
import styles from './StarButton.module.css';

interface Props {
  playerId: number;
  /** Used for the accessible name, since the control is a bare glyph. */
  name: string;
  flagged: boolean;
}

/**
 * One tap to make a player stand out wherever he appears. It sits beside the
 * row rather than inside it so flagging never costs you an accidental draft.
 */
export function StarButton({ playerId, name, flagged }: Props) {
  return (
    <button
      class={`${styles.star} ${flagged ? styles.on : ''}`}
      aria-label={`${flagged ? 'Unflag' : 'Flag'} ${name}`}
      aria-pressed={flagged}
      onClick={() => toggleFlagged(playerId)}
    >
      {flagged ? '★' : '☆'}
    </button>
  );
}
