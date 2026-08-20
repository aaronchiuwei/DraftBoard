import type { AppState } from '../types';
import { isDraftOver, picksUntilTurn, pickLabel, teamName, totalPicks } from '../domain/draft';
import { formatGaps, gapsOf, lineupFor } from '../domain/roster';
import { positionalRuns } from '../domain/analytics';
import { selectNextInQueue, selectPool, selectTeamOnClock } from '../state/selectors';
import { openSheet, undoLastPick } from '../state/app';
import styles from './Clock.module.css';

export function Clock({ state }: { state: AppState }) {
  const { draft } = state;
  const pool = selectPool(state);
  const onClock = selectTeamOnClock(state);
  const pickIndex = draft.picks.length;

  let pickText = '—';
  let title = 'Draft Room';
  let subtitle = 'Set up your league to start';
  let isMe = false;

  if (draft.ready && isDraftOver(draft)) {
    pickText = 'DONE';
    title = 'Draft complete';
    subtitle = `${totalPicks(draft.league)} picks made`;
  } else if (draft.ready && onClock !== null) {
    pickText = pickLabel(pickIndex, draft.league.teams);
    title = teamName(draft.league, onClock);
    isMe = onClock === draft.league.mySlot;
    const gaps = formatGaps(gapsOf(lineupFor(draft, pool, onClock)));
    subtitle = gaps.length ? `Still needs ${gaps.join(', ')}` : 'Starters full — bench';
  }

  const untilMyTurn = draft.ready ? picksUntilTurn(draft.league.mySlot, pickIndex, draft.league) : null;
  const runs = draft.ready ? positionalRuns(draft, pool).filter(r => r.hot).slice(0, 3) : [];
  // the top of the queue is the one thing you want without changing tabs
  const nextUp = draft.ready && !isDraftOver(draft) ? selectNextInQueue(state) : null;
  const showSignals =
    draft.ready &&
    !isDraftOver(draft) &&
    ((untilMyTurn !== null && untilMyTurn > 0) || runs.length > 0 || nextUp);

  return (
    <div class={`${styles.clock} ${isMe ? styles.alert : ''}`}>
      <div class={styles.row}>
        <div class={`${styles.pickNo} ${isMe ? styles.pickNoAlert : ''} mono`}>{pickText}</div>
        <div class={styles.who}>
          <div class={`${styles.name} ${isMe ? styles.me : ''}`}>{title}</div>
          <div class={styles.needs}>{subtitle}</div>
        </div>
        <button
          class={styles.undo}
          disabled={draft.picks.length === 0}
          onClick={undoLastPick}
        >
          Undo
        </button>
      </div>

      {isMe ? (
        <div class={styles.youreUp} aria-live="assertive">
          YOU'RE UP
        </div>
      ) : null}

      {showSignals && (
        <div class={styles.signals}>
          {untilMyTurn !== null && untilMyTurn > 0 ? (
            <span class={styles.chip}>You pick in {untilMyTurn}</span>
          ) : null}
          {nextUp && (
            <button
              class={`${styles.chip} ${styles.queued}`}
              onClick={() => openSheet(nextUp.id)}
            >
              Queue · {nextUp.name}
            </button>
          )}
          {runs.map(run => (
            <span key={run.pos} class={`${styles.chip} ${styles.run}`}>
              {run.pos} run · {run.recent} of last 12
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
