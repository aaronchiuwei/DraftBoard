import type { DraftState, LeagueSettings } from '../types';

/** Which team owns a given zero-indexed pick, under snake order. */
export function teamAtPick(pickIndex: number, teams: number): number {
  const round = Math.floor(pickIndex / teams);
  const slot = pickIndex % teams;
  return round % 2 === 0 ? slot : teams - 1 - slot;
}

/** Zero-indexed pick number for a team's nth turn (n starting at 0). */
export function pickIndexForTurn(team: number, turn: number, teams: number): number {
  return turn % 2 === 0 ? turn * teams + team : turn * teams + (teams - 1 - team);
}

export function roundOf(pickIndex: number, teams: number): number {
  return Math.floor(pickIndex / teams) + 1;
}

export function pickLabel(pickIndex: number, teams: number): string {
  const round = Math.floor(pickIndex / teams) + 1;
  const inRound = (pickIndex % teams) + 1;
  return `${round}.${String(inRound).padStart(2, '0')}`;
}

/** Where in its own round a pick falls, one-indexed. */
export function pickInRound(pickIndex: number, teams: number): number {
  return (pickIndex % teams) + 1;
}

export function totalPicks(league: LeagueSettings): number {
  return league.teams * league.rounds;
}

export function currentPick(draft: DraftState): number {
  return draft.picks.length;
}

export function isDraftOver(draft: DraftState): boolean {
  return currentPick(draft) >= totalPicks(draft.league);
}

/**
 * Pick indexes a team still owns from `fromPick` onward. Drives "your next
 * pick is in N" and the survival estimates in analytics.
 */
export function upcomingPicksFor(
  team: number,
  fromPick: number,
  league: LeagueSettings
): number[] {
  const out: number[] = [];
  const total = totalPicks(league);
  for (let turn = 0; turn < league.rounds; turn++) {
    const idx = pickIndexForTurn(team, turn, league.teams);
    if (idx >= fromPick && idx < total) out.push(idx);
  }
  return out.sort((a, b) => a - b);
}

/** How many picks happen before this team is on the clock again. */
export function picksUntilTurn(
  team: number,
  fromPick: number,
  league: LeagueSettings
): number | null {
  const next = upcomingPicksFor(team, fromPick, league)[0];
  return next === undefined ? null : next - fromPick;
}

export interface PickMarker {
  /** Zero-indexed overall pick this marker belongs to. */
  pickIndex: number;
  /**
   * Players expected off the board before it. Reading down a list sorted by
   * rank, everyone above the marker is gone by the time the pick comes round.
   */
  before: number;
}

/**
 * A team's remaining picks expressed as depths into the available-player list,
 * so the list can draw a line at each one. Every pick between now and yours
 * costs one player, which is what makes the depth and the gap the same number.
 */
export function pickMarkersFor(draft: DraftState, team: number): PickMarker[] {
  const current = currentPick(draft);
  return upcomingPicksFor(team, current, draft.league).map(pickIndex => ({
    pickIndex,
    before: pickIndex - current
  }));
}

export function teamName(league: LeagueSettings, team: number): string {
  return league.names[team] ?? `Team ${team + 1}`;
}

export function defaultTeamNames(count: number, mySlot: number): string[] {
  return Array.from({ length: count }, (_, i) => (i === mySlot ? 'My Team' : `Team ${i + 1}`));
}

/** Player ids taken so far, for "is this player gone" lookups. */
export function draftedIds(draft: DraftState): Set<number> {
  return new Set(draft.picks);
}
