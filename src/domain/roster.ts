import type { DraftState, LeagueSettings, Player, Pos, SlotDef } from '../types';
import { teamAtPick } from './draft';
import type { Pool } from '../data/pool';

export const DEFAULT_ROSTER: readonly SlotDef[] = [
  { key: 'QB', count: 1, accepts: ['QB'] },
  { key: 'RB', count: 2, accepts: ['RB'] },
  { key: 'WR', count: 2, accepts: ['WR'] },
  { key: 'TE', count: 1, accepts: ['TE'] },
  { key: 'FLEX', count: 2, accepts: ['RB', 'WR', 'TE'] },
  { key: 'DEF', count: 1, accepts: ['DEF'] },
  { key: 'K', count: 1, accepts: ['K'] }
];

export function starterCount(roster: readonly SlotDef[]): number {
  return roster.reduce((n, s) => n + s.count, 0);
}

/** A drafted player together with the pick he came at. */
export interface RosterEntry {
  player: Player;
  pickIndex: number;
}

export function rosterOf(draft: DraftState, pool: Pool, team: number): RosterEntry[] {
  const out: RosterEntry[] = [];
  draft.picks.forEach((id, pickIndex) => {
    if (teamAtPick(pickIndex, draft.league.teams) !== team) return;
    const player = pool.byId.get(id);
    if (player) out.push({ player, pickIndex });
  });
  return out;
}

export interface FilledSlot {
  def: SlotDef;
  men: RosterEntry[];
}

export interface Lineup {
  slots: FilledSlot[];
  bench: RosterEntry[];
}

/**
 * Fill dedicated slots before multi-position ones, so a lone RB lands at RB
 * rather than being eaten by FLEX and leaving RB showing as a need. Slots are
 * ordered by how many positions they accept, so this stays correct if the
 * roster shape is ever reconfigured.
 */
export function fillLineup(roster: readonly SlotDef[], entries: readonly RosterEntry[]): Lineup {
  const slots: FilledSlot[] = roster.map(def => ({ def, men: [] }));
  const used = new Set<number>();

  const order = [...slots].sort((a, b) => a.def.accepts.length - b.def.accepts.length);
  for (const slot of order) {
    for (const entry of entries) {
      if (slot.men.length >= slot.def.count) break;
      if (used.has(entry.pickIndex)) continue;
      if (slot.def.accepts.includes(entry.player.pos)) {
        slot.men.push(entry);
        used.add(entry.pickIndex);
      }
    }
  }

  return { slots, bench: entries.filter(e => !used.has(e.pickIndex)) };
}

export interface Gap {
  key: string;
  missing: number;
}

export function gapsOf(lineup: Lineup): Gap[] {
  return lineup.slots
    .map(s => ({ key: s.def.key, missing: s.def.count - s.men.length }))
    .filter(g => g.missing > 0);
}

export function formatGaps(gaps: readonly Gap[]): string[] {
  return gaps.map(g => (g.missing > 1 ? `${g.key}×${g.missing}` : g.key));
}

export function lineupFor(draft: DraftState, pool: Pool, team: number): Lineup {
  return fillLineup(draft.league.roster, rosterOf(draft, pool, team));
}

/** Positions that would fill an open slot for this team right now. */
export function neededPositions(lineup: Lineup): Set<Pos> {
  const out = new Set<Pos>();
  for (const slot of lineup.slots) {
    if (slot.men.length >= slot.def.count) continue;
    for (const pos of slot.def.accepts) out.add(pos);
  }
  return out;
}

export function normalizeLeague(league: LeagueSettings): LeagueSettings {
  const mySlot = Math.min(Math.max(league.mySlot, 0), league.teams - 1);
  const names = Array.from(
    { length: league.teams },
    (_, i) => {
      const name = league.names[i]?.trim();
      return name || (i === mySlot ? 'My Team' : `Team ${i + 1}`);
    }
  );
  return { ...league, mySlot, names };
}
