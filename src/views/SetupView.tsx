import { useEffect, useRef, useState } from 'preact/hooks';
import type { AppState } from '../types';
import { starterCount } from '../domain/roster';
import { DATA_LABEL } from '../data/pool';
import {
  markReady,
  resetPicks,
  setMySlot,
  setRounds,
  commitTeamName,
  setTeamName,
  setTeams
} from '../state/app';
import { teamName } from '../domain/draft';
import { SourcesPanel } from './SourcesPanel';
import { AccountPanel } from './AccountPanel';
import styles from './SetupView.module.css';

const TEAM_RANGE = Array.from({ length: 13 }, (_, i) => i + 4); // 4–16
const ROUND_RANGE = Array.from({ length: 16 }, (_, i) => i + 10); // 10–25
const ARM_TIMEOUT = 4000;

function rosterSummary(state: AppState): string {
  return state.draft.league.roster.map(s => `${s.count} ${s.key}`).join(', ');
}

/** Two taps, because one misplaced thumb should not end the draft. */
function ResetButton() {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function onClick() {
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), ARM_TIMEOUT);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
    resetPicks();
  }

  return (
    <button class={`${styles.danger} ${armed ? styles.armed : ''}`} onClick={onClick}>
      {armed ? 'Tap again to erase every pick' : 'Reset draft'}
    </button>
  );
}

export function SetupView({ state }: { state: AppState }) {
  const { league, picks } = state.draft;

  return (
    <div class={styles.setup}>
      <h1>League setup</h1>
      <p class={styles.lede}>
        {starterCount(league.roster)} starters: {rosterSummary(state)}. Snake order.
      </p>

      <div class={styles.field}>
        <label class="eyebrow">Teams</label>
        <select
          value={String(league.teams)}
          onChange={e => setTeams(Number((e.target as HTMLSelectElement).value))}
        >
          {TEAM_RANGE.map(n => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div class={styles.field}>
        <label class="eyebrow">Rounds</label>
        <select
          value={String(league.rounds)}
          onChange={e => setRounds(Number((e.target as HTMLSelectElement).value))}
        >
          {ROUND_RANGE.map(n => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div class={styles.field}>
        <label class="eyebrow">Your draft slot</label>
        <select
          value={String(league.mySlot)}
          onChange={e => setMySlot(Number((e.target as HTMLSelectElement).value))}
        >
          {Array.from({ length: league.teams }, (_, i) => (
            <option key={i} value={i}>
              Pick {i + 1} — {teamName(league, i)}
            </option>
          ))}
        </select>
      </div>

      <div class={styles.field}>
        <label class="eyebrow">Team names</label>
        <div class={styles.nameList}>
          {Array.from({ length: league.teams }, (_, i) => (
            <div key={i} class={styles.nameRow}>
              <span>{i + 1}</span>
              <input
                type="text"
                maxLength={18}
                class={i === league.mySlot ? styles.me : undefined}
                value={league.names[i] ?? ''}
                onInput={e => setTeamName(i, (e.target as HTMLInputElement).value)}
                onBlur={() => commitTeamName(i)}
              />
            </div>
          ))}
        </div>
      </div>

      <button class={styles.primary} onClick={markReady}>
        {picks.length ? 'Save changes' : 'Start draft'}
      </button>

      {picks.length > 0 && (
        <p class={`${styles.lede} warn`} style={{ marginTop: 14, fontSize: 12 }}>
          {picks.length} picks recorded. Changing team count will re-shuffle who owns them.
        </p>
      )}

      <div class={styles.section}>
        <span class="eyebrow">Account</span>
        <AccountPanel />
      </div>

      <div class={styles.section}>
        <span class="eyebrow">Rankings</span>
        <p>
          Base data is the {DATA_LABEL} snapshot. Mute a source to drop it from the consensus,
          the rail, and the compare table. Imported rankings behave exactly like the built-in ones.
        </p>
        <SourcesPanel state={state} />
      </div>

      <div class={styles.section}>
        <span class="eyebrow">Reset draft</span>
        <p>
          Erases all {picks.length} picks. Teams, names, your draft slot, and imported rankings
          stay as they are. Takes two taps.
        </p>
        <ResetButton />
      </div>
    </div>
  );
}
