import type { AppState } from '../types';
import { rankOf } from '../domain/rankings';
import { pickLabel } from '../domain/draft';
import { injuryFor } from '../data/injuries';
import { headshotFor } from '../data/stats';
import {
  clearQueue,
  moveInQueue,
  openSheet,
  removeTakenFromQueue,
  unqueuePlayer
} from '../state/app';
import { selectFlagged, selectQueue, selectSources, type QueueEntry } from '../state/selectors';
import { InjuryTag } from '../components/InjuryTag';
import { Headshot } from '../components/Headshot';
import styles from './QueueView.module.css';

interface RowProps {
  entry: QueueEntry;
  flagged: boolean;
  first: boolean;
  last: boolean;
  /** Rank under the source the player list is currently sorted by. */
  rank: number | null;
  takenAt: number | null;
  teams: number;
}

function QueueRow({ entry, flagged, first, last, rank, takenAt, teams }: RowProps) {
  const { player, place, taken } = entry;
  const injury = injuryFor(player);
  const classes = [styles.row, taken ? styles.taken : '', flagged ? styles.flagged : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div class={classes}>
      <button class={styles.open} onClick={() => openSheet(player.id)}>
        <span class={`${styles.place} mono`}>{place}</span>
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
            {flagged && <span class={styles.star}>★</span>}
            <span class={styles.name}>{player.name}</span>
            {injury && <InjuryTag report={injury} />}
          </span>
          <span class={styles.sub}>
            {player.team}
            {rank !== null && ` · ${rank}`}
            {taken && takenAt !== null && ` · gone ${pickLabel(takenAt, teams)}`}
          </span>
        </span>
      </button>

      <div class={styles.controls}>
        <button
          class={styles.move}
          disabled={first}
          aria-label={`Move ${player.name} up`}
          onClick={() => moveInQueue(player.id, -1)}
        >
          ↑
        </button>
        <button
          class={styles.move}
          disabled={last}
          aria-label={`Move ${player.name} down`}
          onClick={() => moveInQueue(player.id, 1)}
        >
          ↓
        </button>
        <button
          class={styles.remove}
          aria-label={`Remove ${player.name} from queue`}
          onClick={() => unqueuePlayer(player.id)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function QueueView({ state }: { state: AppState }) {
  const queue = selectQueue(state);
  const flagged = selectFlagged(state);
  const sources = selectSources(state);
  // the queue is a plan, not a sort, so it shows the rank you have been reading
  const rankSource = sources.find(s => s.id === state.ui.source) ?? sources[0];
  const takenCount = queue.filter(e => e.taken).length;
  const left = queue.length - takenCount;

  if (queue.length === 0) {
    return (
      <div class="empty">
        Nothing queued yet.
        <br />
        <br />
        Tap any player, then <b>Add to queue</b>. They stack up here in the order you add them, and
        you can reorder them with the arrows.
      </div>
    );
  }

  return (
    <>
      <div class={styles.head}>
        <span class="eyebrow">
          {left} available{takenCount > 0 && ` · ${takenCount} gone`}
        </span>
        <div class={styles.headButtons}>
          {takenCount > 0 && (
            <button onClick={removeTakenFromQueue}>Clear {takenCount} gone</button>
          )}
          <button onClick={clearQueue}>Clear all</button>
        </div>
      </div>

      {queue.map((entry, i) => (
        <QueueRow
          key={entry.player.id}
          entry={entry}
          flagged={flagged.has(entry.player.id)}
          first={i === 0}
          last={i === queue.length - 1}
          rank={rankSource ? rankOf(entry.player, rankSource.id) : null}
          takenAt={entry.taken ? state.draft.picks.indexOf(entry.player.id) : null}
          teams={state.draft.league.teams}
        />
      ))}
      <div style={{ height: 24 }} />
    </>
  );
}
