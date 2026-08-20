import type { AppState } from '../types';
import { isDraftOver, pickLabel, teamAtPick, teamName } from '../domain/draft';
import { rankOf } from '../domain/rankings';
import { survivalOdds } from '../domain/analytics';
import { selectHorizon, selectPool, selectSourceIds, selectSources } from '../state/selectors';
import { closeSheet, draftPlayer, undraftPlayer } from '../state/app';
import styles from './PlayerSheet.module.css';

export function PlayerSheet({ state }: { state: AppState }) {
  const id = state.ui.sheetPlayerId;
  if (id === null) return null;

  const pool = selectPool(state);
  const player = pool.byId.get(id);
  if (!player) return null;

  const { draft } = state;
  const sources = selectSources(state);
  const sourceIds = selectSourceIds(state);
  const takenAt = draft.picks.indexOf(id);
  const taken = takenAt >= 0;
  const over = isDraftOver(draft);
  const onClock = draft.picks.length;

  const odds =
    !taken && draft.ready && !over
      ? survivalOdds(player, draft, pool, sourceIds, selectHorizon(state))
      : null;

  return (
    <div
      class={styles.scrim}
      onClick={e => {
        if (e.target === e.currentTarget) closeSheet();
      }}
    >
      <div class={styles.card}>
        <div class={styles.name}>{player.name}</div>
        <div class={styles.meta}>
          <span style={{ color: `var(--${player.pos})`, fontWeight: 800 }}>{player.pos}</span>
          {' · '}
          {player.team}
        </div>

        <div class={styles.ranks}>
          {sources.map(source => {
            const value = rankOf(player, source.id);
            return (
              <div key={source.id}>
                <span class="eyebrow">{source.short}</span>
                <b>{value ?? '–'}</b>
              </div>
            );
          })}
        </div>

        {odds !== null && (
          <div class={styles.odds}>
            <div class={styles.oddsText}>
              Roughly <b>{Math.round(odds * 100)}%</b> to still be there at your next pick
            </div>
            <div class={styles.oddsBar}>
              <div class={styles.oddsFill} style={{ width: `${Math.round(odds * 100)}%` }} />
            </div>
          </div>
        )}

        <div class={styles.to}>
          {taken ? (
            <>
              Taken at <b>{pickLabel(takenAt, draft.league.teams)}</b> by{' '}
              <b>{teamName(draft.league, teamAtPick(takenAt, draft.league.teams))}</b>
            </>
          ) : !draft.ready ? (
            <span class="warn">Set up your league before drafting.</span>
          ) : over ? (
            <span class="warn">All picks are in.</span>
          ) : (
            <>
              Pick <b>{pickLabel(onClock, draft.league.teams)}</b> to{' '}
              <b>{teamName(draft.league, teamAtPick(onClock, draft.league.teams))}</b>
            </>
          )}
        </div>

        <div class={styles.buttons}>
          <button class={styles.cancel} onClick={closeSheet}>
            Cancel
          </button>
          {taken ? (
            <button
              class={styles.undraft}
              onClick={() => {
                undraftPlayer(id);
                closeSheet();
              }}
            >
              Put back
            </button>
          ) : (
            draft.ready &&
            !over && (
              <button
                class={styles.confirm}
                onClick={() => {
                  draftPlayer(id);
                  closeSheet();
                }}
              >
                Draft
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
