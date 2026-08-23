import type { AppState, Player } from '../types';
import { Controls } from '../components/Controls';
import { Headshot } from '../components/Headshot';
import { InjuryTag } from '../components/InjuryTag';
import { RookieTag } from '../components/RookieTag';
import { injuryFor } from '../data/injuries';
import { headshotFor, isRookie } from '../data/stats';
import { consensusOf, rankOf, spreadOf, type Spread } from '../domain/rankings';
import { draftedIds } from '../domain/draft';
import { openSheet, setCompareSort } from '../state/app';
import {
  selectComparablePlayers,
  selectHorizon,
  selectSourceIds,
  selectSources
} from '../state/selectors';
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

export function CompareView({ state }: { state: AppState }) {
  const sources = selectSources(state);
  const sourceIds = selectSourceIds(state);
  const horizon = selectHorizon(state);
  const taken = draftedIds(state.draft);

  const rows: Row[] = [];
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

  return (
    <>
      <Controls ui={state.ui} sources={sources} showSources={false} />

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
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={sources.length + 2}>
                <div class="empty">Nothing to compare here.</div>
              </td>
            </tr>
          )}
          {rows.slice(0, ROW_LIMIT).map(({ player, spread }) => {
            const injury = injuryFor(player);
            return (
            <tr
              key={player.id}
              class={taken.has(player.id) ? styles.gone : undefined}
              onClick={() => openSheet(player.id)}
            >
              <td class={styles.nameCell}>
                <span class={styles.nameInner}>
                  <Headshot
                    size="sm"
                    src={headshotFor(player)}
                    name={player.name}
                    pos={player.pos}
                  />
                  <span class={styles.nameText}>
                    <span style={{ color: `var(--${player.pos})`, fontWeight: 800, fontSize: 10 }}>
                      {player.pos}
                    </span>{' '}
                    {player.name}
                    {isRookie(player) && <> <RookieTag /></>}
                    {injury && <> <InjuryTag report={injury} /></>}
                  </span>
                </span>
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
            </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ height: 24 }} />
    </>
  );
}
