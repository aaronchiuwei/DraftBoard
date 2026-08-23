import type { AppState, Player } from '../types';
import { CONSENSUS } from '../types';
import { injuryFor } from '../data/injuries';
import { depthRoleFor } from '../data/depth';
import { headshotFor, isRookie } from '../data/stats';
import { buildCompareDecision, MAX_COMPARE_PINS } from '../domain/compare';
import { isDraftOver, draftedIds } from '../domain/draft';
import { consensusOf, rankOf, spreadOf } from '../domain/rankings';
import {
  clearComparePins,
  compareQueue,
  openSheet,
  setCompareSort,
  toggleComparePin
} from '../state/app';
import {
  selectComparablePlayers,
  selectHorizon,
  selectPool,
  selectSourceIds,
  selectSources
} from '../state/selectors';
import { CompareDecisionPanel } from '../components/CompareDecisionPanel';
import { Controls } from '../components/Controls';
import { DepthRoleTag } from '../components/DepthRoleTag';
import { Headshot } from '../components/Headshot';
import { InjuryTag } from '../components/InjuryTag';
import { RookieTag } from '../components/RookieTag';
import styles from './CompareView.module.css';

/** Rows past this get cut; nobody scrolls a 300-row table mid-draft. */
const ROW_LIMIT = 260;
/** Below this, a gap is noise rather than a disagreement worth colouring. */
const MEANINGFUL_GAP = 6;

interface Row {
  player: Player;
  spread: Spread;
  consensus: number;
}

type Spread = NonNullable<ReturnType<typeof spreadOf>>;

export function CompareView({ state }: { state: AppState }) {
  const pool = selectPool(state);
  const sources = selectSources(state);
  const sourceIds = selectSourceIds(state);
  const horizon = selectHorizon(state);
  const taken = draftedIds(state.draft);
  const pinned = state.comparePins;
  const sourceKey = state.ui.source;
  const sourceLabel =
    sourceKey === CONSENSUS
      ? 'AVG'
      : (sources.find(s => s.id === sourceKey)?.short ?? 'AVG');

  const decision = buildCompareDecision(
    pinned,
    state.draft,
    pool,
    sourceIds,
    sourceKey,
    sourceLabel,
    horizon
  );

  const showDecision = decision !== null;
  const queueAvailable = state.queue.filter(id => !taken.has(id)).length;

  const rows: Row[] = [];
  if (!showDecision) {
    for (const player of selectComparablePlayers(state)) {
      const spread = spreadOf(player, sourceIds, horizon);
      const consensus = consensusOf(player, sourceIds);
      if (!spread || consensus === null) continue;
      if (spread.min > horizon) continue;
      rows.push({ player, spread, consensus });
    }

    rows.sort((a, b) =>
      state.ui.compareSort === 'spread'
        ? b.spread.spread - a.spread.spread
        : a.consensus - b.consensus
    );
  }

  return (
    <>
      {!showDecision && <Controls ui={state.ui} sources={sources} showSources={false} />}

      <div class={styles.modeHead}>
        {showDecision ? (
          <span class={`eyebrow ${styles.modeLabel}`}>Head-to-head</span>
        ) : (
          <>
            <span class={`eyebrow ${styles.modeLabel}`}>
              {pinned.length === 1
                ? '1 pinned — add one more below'
                : `Pin up to ${MAX_COMPARE_PINS} players to decide`}
            </span>
            {queueAvailable >= 2 && (
              <button class={styles.modeAction} onClick={compareQueue}>
                Compare queue
              </button>
            )}
          </>
        )}
        {pinned.length > 0 && !showDecision && (
          <button class={styles.modeAction} onClick={clearComparePins}>
            Clear {pinned.length} pinned
          </button>
        )}
      </div>

      {showDecision && decision ? (
        <CompareDecisionPanel
          decision={decision}
          pool={pool}
          pinned={pinned}
          draftReady={state.draft.ready}
          draftOver={isDraftOver(state.draft)}
          onUnpin={toggleComparePin}
          onClear={clearComparePins}
          onOpen={openSheet}
        />
      ) : (
        <>
          {pinned.length >= 2 && (
            <div class={`empty ${styles.banner}`}>
              Not enough pinned players are still on the board.
            </div>
          )}
          {pinned.length === 1 && (
            <div class={`empty ${styles.banner}`}>
              Pin one more player below to compare head-to-head.
            </div>
          )}

          <div class={styles.sortRow}>
            <span class={`eyebrow ${styles.label}`}>Sort</span>
            <button
              class={`${styles.sortBtn} ${state.ui.compareSort === 'spread' ? styles.on : ''}`}
              onClick={() => setCompareSort('spread')}
            >
              Most disagreement
            </button>
            <button
              class={`${styles.sortBtn} ${state.ui.compareSort === 'cons' ? styles.on : ''}`}
              onClick={() => setCompareSort('cons')}
            >
              Overall
            </button>
          </div>

          <table class={styles.table}>
            <thead>
              <tr>
                <th class={styles.nameCell}>Player</th>
                {sources.map(s => (
                  <th key={s.id}>{s.short}</th>
                ))}
                <th style={{ paddingRight: 12 }}>Gap</th>
                <th class={styles.pinHead} aria-label="Pin" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={sources.length + 3}>
                    <div class="empty">Nothing to compare here.</div>
                  </td>
                </tr>
              )}
              {rows.slice(0, ROW_LIMIT).map(({ player, spread }) => {
                const injury = injuryFor(player);
                const depthRole = depthRoleFor(player);
                const isPinned = pinned.includes(player.id);
                return (
                  <tr key={player.id} class={taken.has(player.id) ? styles.gone : undefined}>
                    <td class={styles.nameCell}>
                      <button class={styles.open} onClick={() => openSheet(player.id)}>
                        <span class={styles.nameInner}>
                          <Headshot
                            size="sm"
                            src={headshotFor(player)}
                            name={player.name}
                            pos={player.pos}
                          />
                          <span class={styles.nameText}>
                            <span
                              style={{
                                color: `var(--${player.pos})`,
                                fontWeight: 800,
                                fontSize: 10
                              }}
                            >
                              {player.pos}
                            </span>{' '}
                            {player.name}
                            {depthRole && <> <DepthRoleTag role={depthRole} /></>}
                            {isRookie(player) && <> <RookieTag /></>}
                            {injury && <> <InjuryTag report={injury} /></>}
                          </span>
                        </span>
                      </button>
                    </td>
                    {sources.map(s => {
                      const v = rankOf(player, s.id);
                      if (v === null) {
                        return (
                          <td key={s.id} class={styles.value} style={{ color: 'var(--dim)' }}>
                            –
                          </td>
                        );
                      }
                      const capped = Math.min(v, horizon);
                      const notable = spread.spread > MEANINGFUL_GAP;
                      const tone =
                        notable && capped === spread.min
                          ? styles.high
                          : notable && capped === spread.max
                            ? styles.low
                            : '';
                      return (
                        <td key={s.id} class={`${styles.value} ${tone}`}>
                          {v}
                        </td>
                      );
                    })}
                    <td class={styles.gap}>{spread.spread}</td>
                    <td class={styles.pinCell}>
                      <button
                        class={`${styles.pinBtn} ${isPinned ? styles.pinOn : ''}`}
                        aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${player.name} for comparison`}
                        aria-pressed={isPinned}
                        disabled={!isPinned && pinned.length >= MAX_COMPARE_PINS}
                        onClick={() => toggleComparePin(player.id)}
                      >
                        {isPinned ? '●' : '○'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      <div style={{ height: 24 }} />
    </>
  );
}
