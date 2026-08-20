import type { AppState } from '../types';
import { CONSENSUS } from '../types';
import {
  DEPTH_FETCHED_AT,
  DEPTH_LABEL,
  DEPTH_SOURCE,
  DEPTH_TEAMS,
  resolvedTeam,
  type ResolvedEntry
} from '../data/depth';
import { valueFor } from '../domain/rankings';
import { draftedIds } from '../domain/draft';
import { openSheet, setDepthTeam } from '../state/app';
import { selectFlagged, selectPool, selectSourceIds, selectSources } from '../state/selectors';
import { StarButton } from '../components/StarButton';
import styles from './DepthView.module.css';

interface RowProps {
  entry: ResolvedEntry;
  /** Depth order within the position, one-indexed. */
  slot: number;
  rank: number | null;
  rankLabel: string;
  gone: boolean;
  flagged: boolean;
  queuePlace: number | undefined;
}

function DepthRow({ entry, slot, rank, rankLabel, gone, flagged, queuePlace }: RowProps) {
  const id = entry.playerId;
  const classes = [
    styles.row,
    gone ? styles.gone : '',
    flagged ? styles.flagged : '',
    id === null ? styles.unranked : ''
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      <span class={`${styles.slot} ${slot === 1 ? styles.starter : ''} mono`}>{slot}</span>
      <span class={styles.mid}>
        <span class={styles.nameLine}>
          <span class={styles.name}>{entry.name}</span>
          {entry.pos && <span class={styles.tag}>{entry.pos}</span>}
          {entry.status && <span class={`${styles.tag} ${styles.hurt}`}>{entry.status}</span>}
          {queuePlace !== undefined && <span class={styles.queueChip}>Q{queuePlace}</span>}
        </span>
        {entry.jersey && <span class={styles.sub}>#{entry.jersey}</span>}
      </span>
      {rank !== null && (
        <span class={styles.rank}>
          <b>{Number.isInteger(rank) ? rank : rank.toFixed(1)}</b>
          <span class={styles.rankLabel}>{rankLabel}</span>
        </span>
      )}
    </>
  );

  // an off-board practice squad body has no player sheet to open
  if (id === null) {
    return (
      <div class={classes}>
        <div class={styles.open}>{body}</div>
      </div>
    );
  }

  return (
    <div class={classes}>
      <button class={styles.open} onClick={() => openSheet(id)}>
        {body}
      </button>
      <StarButton playerId={id} name={entry.name} flagged={flagged} />
    </div>
  );
}

export function DepthView({ state }: { state: AppState }) {
  const code = DEPTH_TEAMS.some(t => t.code === state.ui.depthTeam)
    ? state.ui.depthTeam
    : (DEPTH_TEAMS[0]?.code ?? '');
  const team = resolvedTeam(code);

  const pool = selectPool(state);
  const sources = selectSources(state);
  const sourceIds = selectSourceIds(state);
  const taken = draftedIds(state.draft);
  const flagged = selectFlagged(state);
  const queue = new Map(state.queue.map((id, i) => [id, i + 1]));
  const rankLabel =
    state.ui.source === CONSENSUS
      ? 'AVG'
      : (sources.find(s => s.id === state.ui.source)?.short ?? 'AVG');

  return (
    <>
      <div class={styles.picker}>
        {DEPTH_TEAMS.map(t => (
          <button
            key={t.code}
            class={t.code === code ? styles.on : undefined}
            onClick={() => setDepthTeam(t.code)}
          >
            {t.code}
          </button>
        ))}
      </div>

      {!team ? (
        <div class="empty">No depth chart for this team.</div>
      ) : (
        <>
          <div class={styles.teamHead}>
            <div class={styles.teamName}>{team.name}</div>
            <div class={styles.stamp}>
              {DEPTH_SOURCE} · {DEPTH_LABEL} · pulled {DEPTH_FETCHED_AT}
            </div>
          </div>

          {team.groups.map(group => (
            <div key={group.pos}>
              <div class={styles.groupHead}>
                <span class={styles.groupPos} style={{ background: `var(--${group.pos})` }}>
                  {group.pos}
                </span>
                <span class={styles.groupRule} />
              </div>
              {group.players.map((entry, i) => {
                const player = entry.playerId === null ? null : pool.byId.get(entry.playerId);
                return (
                  <DepthRow
                    key={`${entry.name}-${i}`}
                    entry={entry}
                    slot={i + 1}
                    rank={player ? valueFor(player, state.ui.source, sourceIds) : null}
                    rankLabel={rankLabel}
                    gone={entry.playerId !== null && taken.has(entry.playerId)}
                    flagged={entry.playerId !== null && flagged.has(entry.playerId)}
                    queuePlace={
                      entry.playerId === null ? undefined : queue.get(entry.playerId)
                    }
                  />
                );
              })}
            </div>
          ))}
          <div style={{ height: 24 }} />
        </>
      )}
    </>
  );
}
