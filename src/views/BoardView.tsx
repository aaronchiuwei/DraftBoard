import { useEffect, useRef } from 'preact/hooks';
import type { AppState } from '../types';
import { pickLabel, teamName } from '../domain/draft';
import { consensusOf } from '../domain/rankings';
import { openSheet } from '../state/app';
import { selectPool, selectSourceIds } from '../state/selectors';
import styles from './BoardView.module.css';

/** Ranks past this far from the pick number are worth flagging on the board. */
const NOTABLE_DELTA = 12;

export function BoardView({ state }: { state: AppState }) {
  const { draft } = state;
  const pool = selectPool(state);
  const sourceIds = selectSourceIds(state);
  const current = draft.picks.length;
  const nextCell = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (current > 0) nextCell.current?.scrollIntoView({ block: 'center', inline: 'center' });
    // only re-centre when the clock moves, not on every unrelated state change
  }, [current]);

  if (!draft.ready) return <div class="empty">Set up your league first.</div>;

  const { teams, rounds } = draft.league;

  return (
    <div class={styles.wrap}>
      <table class={styles.board}>
        <thead>
          <tr>
            <th class={styles.roundHead}>RD</th>
            {Array.from({ length: teams }, (_, t) => (
              <th key={t} class={t === draft.league.mySlot ? styles.me : undefined}>
                {teamName(draft.league, t)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rounds }, (_, r) => (
            <tr key={r}>
              <td class={styles.round}>{r + 1}</td>
              {Array.from({ length: teams }, (_, col) => {
                // even rounds run left to right, odd rounds run back
                const index = r % 2 === 0 ? r * teams + col : r * teams + (teams - 1 - col);
                const id = draft.picks[index];
                const isNext = index === current;
                const player = id === undefined ? undefined : pool.byId.get(id);

                let delta: number | null = null;
                if (player) {
                  const cons = consensusOf(player, sourceIds);
                  if (cons !== null) delta = cons - (index + 1);
                }
                const tone =
                  delta === null
                    ? ''
                    : delta >= NOTABLE_DELTA
                      ? styles.steal
                      : delta <= -NOTABLE_DELTA
                        ? styles.reach
                        : '';

                return (
                  <td
                    key={col}
                    ref={isNext ? nextCell : undefined}
                    class={`${styles.cell} ${isNext ? styles.next : ''}`}
                    onClick={player ? () => openSheet(player.id) : undefined}
                  >
                    {player ? (
                      <>
                        <div class={styles.name}>{player.name}</div>
                        <div class={styles.sub} style={{ color: `var(--${player.pos})` }}>
                          {player.pos} · {player.team}
                          {tone && (
                            <span class={tone}>
                              {' '}
                              {delta && delta > 0 ? '+' : ''}
                              {delta === null ? '' : Math.round(delta)}
                            </span>
                          )}
                        </div>
                      </>
                    ) : isNext ? (
                      <>
                        <div class={styles.name} style={{ color: 'var(--amber)' }}>
                          On the clock
                        </div>
                        <div class={styles.sub} style={{ color: 'var(--amber-dim)' }}>
                          {pickLabel(index, teams)}
                        </div>
                      </>
                    ) : (
                      <div class={styles.sub} style={{ color: 'var(--dim)' }}>
                        {pickLabel(index, teams)}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
