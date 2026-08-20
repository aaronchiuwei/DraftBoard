import type { AppState } from '../types';
import { pickLabel, teamName } from '../domain/draft';
import { gapsOf, lineupFor, starterCount, type RosterEntry } from '../domain/roster';
import { openSheet, setTeamTab } from '../state/app';
import { selectPool } from '../state/selectors';
import styles from './TeamsView.module.css';

function Filled({ entry, label, teams }: { entry: RosterEntry; label: string; teams: number }) {
  return (
    <button class={styles.slot} onClick={() => openSheet(entry.player.id)}>
      <span class={styles.label}>{label}</span>
      <span class={styles.mid}>
        <span class={styles.name}>{entry.player.name}</span>
        <span class={styles.sub} style={{ color: `var(--${entry.player.pos})` }}>
          {entry.player.pos} · {entry.player.team}{' '}
          <span class={styles.pick}>{pickLabel(entry.pickIndex, teams)}</span>
        </span>
      </span>
    </button>
  );
}

export function TeamsView({ state }: { state: AppState }) {
  const { draft } = state;
  if (!draft.ready) return <div class="empty">Set up your league first.</div>;

  const pool = selectPool(state);
  const team = Math.min(state.ui.team, draft.league.teams - 1);
  const lineup = lineupFor(draft, pool, team);
  const missing = gapsOf(lineup).reduce((n, g) => n + g.missing, 0);
  const total = starterCount(draft.league.roster);

  return (
    <>
      <div class={styles.picker}>
        {Array.from({ length: draft.league.teams }, (_, i) => (
          <button
            key={i}
            class={i === team ? styles.on : undefined}
            onClick={() => setTeamTab(i)}
          >
            {teamName(draft.league, i)}
          </button>
        ))}
      </div>

      <div class={`${styles.heading} eyebrow`}>
        {`Starters — ${total - missing} of ${total} filled`}
      </div>

      {lineup.slots.map(slot =>
        Array.from({ length: slot.def.count }, (_, n) => {
          const entry = slot.men[n];
          return entry ? (
            <Filled
              key={`${slot.def.key}${n}`}
              entry={entry}
              label={slot.def.key}
              teams={draft.league.teams}
            />
          ) : (
            <div key={`${slot.def.key}${n}`} class={styles.slot}>
              <span class={styles.label}>{slot.def.key}</span>
              <span class={styles.open}>Open</span>
            </div>
          );
        })
      )}

      <div class={`${styles.benchHead} eyebrow`}>{`Bench — ${lineup.bench.length}`}</div>
      {lineup.bench.length === 0 && (
        <div class={styles.slot}>
          <span class={styles.open}>Nobody on the bench yet</span>
        </div>
      )}
      {lineup.bench.map(entry => (
        <Filled key={entry.pickIndex} entry={entry} label="BN" teams={draft.league.teams} />
      ))}
      <div style={{ height: 30 }} />
    </>
  );
}
