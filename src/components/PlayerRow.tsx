import type { Player, RankSource, SourceKey } from '../types';
import { rankOf, valueFor } from '../domain/rankings';
import { Rail } from './Rail';
import styles from './PlayerRow.module.css';

interface Props {
  player: Player;
  sources: readonly RankSource[];
  sourceIds: readonly string[];
  selected: SourceKey;
  gone: boolean;
  onSelect: (id: number) => void;
}

function formatRank(value: number | null): string {
  if (value === null) return '–';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function PlayerRow({ player, sources, sourceIds, selected, gone, onSelect }: Props) {
  const primary = valueFor(player, selected, sourceIds);
  const others = sources
    .filter(s => s.id !== selected)
    .map(s => ({ short: s.short, value: rankOf(player, s.id) }))
    .filter(x => x.value !== null);

  return (
    <button
      class={`${styles.row} ${gone ? styles.gone : ''}`}
      onClick={() => onSelect(player.id)}
    >
      <span class={styles.rank}>{formatRank(primary)}</span>
      <span class={styles.pos} style={{ background: `var(--${player.pos})` }}>
        {player.pos}
      </span>
      <span class={styles.mid}>
        <span class={styles.name}>{player.name}</span>
        <span class={styles.sub}>
          {player.team}
          {others.length > 0 && '  ·  '}
          {others.map(o => (
            <span key={o.short}>
              {o.short} <b>{o.value}</b>{'  '}
            </span>
          ))}
        </span>
      </span>
      <Rail player={player} sources={sources} />
    </button>
  );
}

export function TierDivider({ index }: { index: number }) {
  return (
    <div class={styles.tierTag}>
      <span class="eyebrow">Tier {index}</span>
      <span class={styles.tierRule} />
    </div>
  );
}
