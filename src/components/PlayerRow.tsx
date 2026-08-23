import type { Player, RankSource, SourceKey } from '../types';
import { injuryFor } from '../data/injuries';
import { headshotFor } from '../data/stats';
import { rankOf, valueFor } from '../domain/rankings';
import { Headshot } from './Headshot';
import { InjuryTag } from './InjuryTag';
import { Rail } from './Rail';
import { StarButton } from './StarButton';
import styles from './PlayerRow.module.css';

interface Props {
  player: Player;
  sources: readonly RankSource[];
  sourceIds: readonly string[];
  selected: SourceKey;
  gone: boolean;
  flagged: boolean;
  /** One-indexed queue place, or undefined when he isn't queued. */
  queuePlace?: number;
  onSelect: (id: number) => void;
}

function formatRank(value: number | null): string {
  if (value === null) return '–';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function PlayerRow({
  player,
  sources,
  sourceIds,
  selected,
  gone,
  flagged,
  queuePlace,
  onSelect
}: Props) {
  const primary = valueFor(player, selected, sourceIds);
  const injury = injuryFor(player);
  const others = sources
    .filter(s => s.id !== selected)
    .map(s => ({ short: s.short, value: rankOf(player, s.id) }))
    .filter(x => x.value !== null);

  const classes = [styles.row, gone ? styles.gone : '', flagged ? styles.flagged : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div class={classes}>
      <button class={styles.open} onClick={() => onSelect(player.id)}>
        <span class={styles.rank}>{formatRank(primary)}</span>
        <span class={styles.pos} style={{ background: `var(--${player.pos})` }}>
          {player.pos}
        </span>
        <Headshot
          size="sm"
          src={headshotFor(player)}
          name={player.name}
          pos={player.pos}
        />
        <span class={styles.mid}>
          <span class={styles.nameLine}>
            <span class={styles.name}>{player.name}</span>
            {injury && <InjuryTag report={injury} />}
            {queuePlace !== undefined && <span class={styles.queueChip}>Q{queuePlace}</span>}
          </span>
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
      <StarButton playerId={player.id} name={player.name} flagged={flagged} />
    </div>
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

interface PickDividerProps {
  round: number;
  pick: number;
  /** The soonest of your picks, drawn brighter than the ones after it. */
  isNext: boolean;
  /** True when this pick is the one on the clock right now. */
  onClock: boolean;
}

/**
 * Marks where one of your picks falls in the list. Everything above the line
 * is expected to be gone by then, so the line is the reach-or-wait boundary.
 */
export function PickDivider({ round, pick, isNext, onClock }: PickDividerProps) {
  return (
    <div class={`${styles.pickTag} ${isNext ? styles.pickNext : ''}`}>
      <span class={styles.pickLabel}>
        {onClock
          ? 'On the clock now'
          : isNext
            ? `Your pick · Round ${round} · Pick ${pick}`
            : `Round ${round} · Pick ${pick}`}
      </span>
      <span class={styles.pickRule} />
    </div>
  );
}
