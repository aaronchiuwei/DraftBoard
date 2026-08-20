import type { ComponentChild } from 'preact';
import type { AppState } from '../types';
import { Controls } from '../components/Controls';
import { PlayerRow, TierDivider } from '../components/PlayerRow';
import { tierMap } from '../domain/analytics';
import { draftedIds } from '../domain/draft';
import { openSheet } from '../state/app';
import {
  selectFlagged,
  selectQueuePositions,
  selectSourceIds,
  selectSources,
  selectVisiblePlayers
} from '../state/selectors';

/** Tier bands only mean something within one position and one opinion. */
function shouldShowTiers(state: AppState): boolean {
  return state.ui.pos !== 'ALL' && state.ui.query === '';
}

export function PlayersView({ state }: { state: AppState }) {
  const players = selectVisiblePlayers(state);
  const sources = selectSources(state);
  const sourceIds = selectSourceIds(state);
  const taken = draftedIds(state.draft);
  const flagged = selectFlagged(state);
  const queuePlaces = selectQueuePositions(state);
  const tiers = shouldShowTiers(state)
    ? tierMap(players, state.ui.source, sourceIds)
    : new Map<number, number>();

  const selectedSource = sources.find(s => s.id === state.ui.source);
  const emptyMessage =
    selectedSource && state.ui.pos !== 'ALL' && state.ui.pos !== 'FLEX'
      ? `${selectedSource.label} does not rank any ${state.ui.pos}. Switch sources to fill this slot.`
      : 'No players match these filters.';

  // built as one flat keyed list so dividers and rows reconcile independently
  const items: ComponentChild[] = [];
  let lastTier = 0;
  for (const player of players) {
    const tier = tiers.get(player.id) ?? 0;
    if (tier > 0 && tier !== lastTier) {
      items.push(<TierDivider key={`tier-${tier}`} index={tier} />);
      lastTier = tier;
    }
    items.push(
      <PlayerRow
        key={player.id}
        player={player}
        sources={sources}
        sourceIds={sourceIds}
        selected={state.ui.source}
        gone={taken.has(player.id)}
        flagged={flagged.has(player.id)}
        queuePlace={queuePlaces.get(player.id)}
        onSelect={openSheet}
      />
    );
  }

  return (
    <>
      <Controls ui={state.ui} sources={sources} showSources />
      <div>
        {players.length === 0 ? <div class="empty">{emptyMessage}</div> : items}
        <div style={{ height: 20 }} />
      </div>
    </>
  );
}
