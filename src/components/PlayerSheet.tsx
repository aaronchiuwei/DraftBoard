import type { AppState } from '../types';
import { isDraftOver, pickLabel, teamAtPick, teamName } from '../domain/draft';
import { rankOf } from '../domain/rankings';
import { selectPool, selectSources } from '../state/selectors';
import { closeSheet, draftPlayer, toggleFlagged, toggleQueued, undraftPlayer, pinForCompare } from '../state/app';
import { injuryFor, injuryTooltip } from '../data/injuries';
import { depthRoleFor } from '../data/depth';
import { statsFor, isRookie } from '../data/stats';
import { DepthRoleTag } from './DepthRoleTag';
import { Headshot } from './Headshot';
import { RookieTag } from './RookieTag';
import { PlayerInsightStats } from './PlayerInsightStats';
import { StatTable } from './StatTable';
import styles from './PlayerSheet.module.css';

export function PlayerSheet({ state }: { state: AppState }) {
  const id = state.ui.sheetPlayerId;
  if (id === null) return null;

  const pool = selectPool(state);
  const player = pool.byId.get(id);
  if (!player) return null;

  const { draft } = state;
  const sources = selectSources(state);
  const takenAt = draft.picks.indexOf(id);
  const taken = takenAt >= 0;
  const over = isDraftOver(draft);
  const onClock = draft.picks.length;
  const queuePlace = state.queue.indexOf(id);
  const flagged = state.flagged.includes(id);

  const stats = statsFor(player);
  const injury = injuryFor(player);
  const depthRole = depthRoleFor(player);

  return (
    <div
      class={styles.scrim}
      onClick={e => {
        if (e.target === e.currentTarget) closeSheet();
      }}
    >
      <div class={styles.card}>
        <div class={styles.header}>
          {/* keyed on the player so a failed portrait does not carry over to the
              next sheet opened from the same list */}
          <Headshot key={player.id} src={stats?.headshot ?? null} name={player.name} pos={player.pos} />
          <div class={styles.headerText}>
            <div class={styles.nameLine}>
              <div class={styles.name}>{player.name}</div>
              {depthRole && <DepthRoleTag role={depthRole} />}
              {isRookie(player) && <RookieTag />}
            </div>
            <div class={styles.meta}>
              <span style={{ color: `var(--${player.pos})`, fontWeight: 800 }}>{player.pos}</span>
              {' · '}
              {player.team}
            </div>
            {injury && <div class={styles.injury}>{injuryTooltip(injury).replace(/\n/g, ' · ')}</div>}
          </div>
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

        {stats && <StatTable stats={stats} />}
        <PlayerInsightStats player={player} />

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

        {/* Marking a player is a decision about later, so it stays out of the
            row of buttons that act on this pick and does not close the sheet. */}
        <div class={styles.marks}>
          <button
            class={queuePlace >= 0 ? styles.markOn : undefined}
            onClick={() => toggleQueued(id)}
          >
            {queuePlace >= 0 ? `Queued #${queuePlace + 1}` : 'Add to queue'}
          </button>
          <button class={flagged ? styles.markOn : undefined} onClick={() => toggleFlagged(id)}>
            {flagged ? '★ Flagged' : '☆ Flag'}
          </button>
          <button
            class={state.comparePins.includes(id) ? styles.markOn : undefined}
            onClick={() => pinForCompare(id)}
          >
            {state.comparePins.includes(id) ? '● Comparing' : 'Compare'}
          </button>
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
