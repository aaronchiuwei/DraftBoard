import type { PosFilter, RankSource, SourceKey, UiState } from '../types';
import { CONSENSUS, POSITIONS } from '../types';
import { setPos, setQuery, setSource, toggleHideDrafted } from '../state/app';
import styles from './Controls.module.css';

const POS_FILTERS: PosFilter[] = ['ALL', ...POSITIONS.filter(p => p !== 'K' && p !== 'DEF'), 'FLEX', 'K', 'DEF'];

interface Props {
  ui: UiState;
  sources: readonly RankSource[];
  /** Compare shows every source at once, so the source picker is hidden there. */
  showSources: boolean;
}

function posColor(pos: PosFilter): string | undefined {
  if (pos === 'ALL' || pos === 'FLEX') return undefined;
  return `var(--${pos})`;
}

export function Controls({ ui, sources, showSources }: Props) {
  const keys: { key: SourceKey; label: string }[] = [
    ...sources.map(s => ({ key: s.id, label: s.short })),
    { key: CONSENSUS, label: 'AVG' }
  ];

  return (
    <div class={styles.controls}>
      {showSources && (
        <div class={styles.sourceRow}>
          {keys.map(k => (
            <button
              key={k.key}
              class={ui.source === k.key ? styles.on : undefined}
              onClick={() => setSource(k.key)}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}

      <div class={styles.posRow}>
        {POS_FILTERS.map(p => {
          const on = ui.pos === p;
          const color = posColor(p);
          return (
            <button
              key={p}
              class={on ? styles.on : undefined}
              style={on && color ? { background: color, borderColor: color } : undefined}
              onClick={() => setPos(p)}
            >
              {p}
            </button>
          );
        })}
      </div>

      <div class={styles.findRow}>
        <input
          type="text"
          placeholder="Find a player"
          value={ui.query}
          autocomplete="off"
          autocorrect="off"
          spellcheck={false}
          onInput={e => setQuery((e.target as HTMLInputElement).value)}
        />
        <button
          class={`${styles.toggle} ${ui.hideDrafted ? styles.on : ''}`}
          onClick={toggleHideDrafted}
        >
          {ui.hideDrafted ? 'Hiding taken' : 'Showing taken'}
        </button>
      </div>
    </div>
  );
}
