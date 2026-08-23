import type { CompareDecision } from '../domain/compare';
import type { Pool } from '../data/pool';
import type { Player } from '../types';
import { injuryFor } from '../data/injuries';
import { headshotFor, isRookie } from '../data/stats';
import { draftPlayer } from '../state/app';
import { InjuryTag } from './InjuryTag';
import { RookieTag } from './RookieTag';
import { Headshot } from './Headshot';
import styles from './CompareDecisionPanel.module.css';

interface Props {
  decision: CompareDecision;
  pool: Pool;
  pinned: readonly number[];
  draftReady: boolean;
  draftOver: boolean;
  onUnpin: (id: number) => void;
  onClear: () => void;
  onOpen: (id: number) => void;
}

export function CompareDecisionPanel({
  decision,
  pool,
  pinned,
  draftReady,
  draftOver,
  onUnpin,
  onClear,
  onOpen
}: Props) {
  const { players, metrics, pickIndex, headline, detail } = decision;

  return (
    <div class={styles.panel}>
      <div class={styles.rec}>
        <div class={styles.recLabel}>Recommendation</div>
        <div class={styles.recHeadline}>{headline}</div>
        <div class={styles.recDetail}>{detail}</div>
      </div>

      <div class={styles.gridWrap}>
        <table class={styles.grid}>
          <thead>
            <tr>
              <th class={styles.metricHead} />
              {players.map((player, i) => (
                <th key={player.id} class={i === pickIndex ? styles.pickCol : undefined}>
                  <PlayerHead player={player} onOpen={() => onOpen(player.id)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map(row => (
              <tr key={row.key}>
                <th class={styles.metricLabel}>{row.label}</th>
                {row.display.map((value, i) => (
                  <td
                    key={`${row.key}-${players[i]?.id ?? i}`}
                    class={`${styles.metricValue} ${row.best === i ? styles.best : ''} ${i === pickIndex ? styles.pickCol : ''}`}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class={styles.actions}>
        {players.map((player, i) => (
          <button
            key={player.id}
            class={`${styles.draftBtn} ${i === pickIndex ? styles.draftPick : ''}`}
            disabled={!draftReady || draftOver}
            onClick={() => draftPlayer(player.id)}
          >
            Draft {player.name.split(' ').pop()}
          </button>
        ))}
      </div>

      <div class={styles.pins}>
        {pinned.map(id => {
          const player = pool.byId.get(id);
          if (!player) return null;
          return (
            <button key={id} class={styles.pinChip} onClick={() => onUnpin(id)}>
              {player.name.split(' ').pop()} ✕
            </button>
          );
        })}
        <button class={styles.clearPins} onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );
}

function PlayerHead({ player, onOpen }: { player: Player; onOpen: () => void }) {
  const injury = injuryFor(player);
  return (
    <button class={styles.playerHead} onClick={onOpen}>
      <Headshot size="sm" src={headshotFor(player)} name={player.name} pos={player.pos} />
      <span class={styles.playerName}>
        <span class={styles.pos} style={{ color: `var(--${player.pos})` }}>
          {player.pos}
        </span>{' '}
        {player.name.split(' ').slice(-1)[0]}
        {isRookie(player) && <> <RookieTag /></>}
        {injury && <> <InjuryTag report={injury} /></>}
      </span>
    </button>
  );
}
