import type { ImportedSource, Player, RankSource } from '../types';
import { isPos } from '../types';
import { BUILTIN_SOURCES } from './sources';
import rawData from './players.2026.json';

interface RawPlayer {
  id: number;
  name: string;
  team: string;
  pos: string;
  ranks: Record<string, number>;
}

interface RawPool {
  version: string;
  label: string;
  players: RawPlayer[];
}

/**
 * Player data is the one thing here with no runtime source of truth, so it is
 * validated at boot. A silent bad record would show up mid-draft as a missing
 * name in a cell, which is the worst possible time to find out.
 */
function parseBasePlayers(data: RawPool): Player[] {
  return data.players.map((p, i) => {
    if (typeof p.id !== 'number' || !p.name || !p.team) {
      throw new Error(`players.json: malformed record at index ${i}`);
    }
    if (!isPos(p.pos)) {
      throw new Error(`players.json: unknown position "${p.pos}" for ${p.name}`);
    }
    return { id: p.id, name: p.name, team: p.team, pos: p.pos, ranks: p.ranks };
  });
}

const BASE_PLAYERS: readonly Player[] = parseBasePlayers(rawData as RawPool);
export const DATA_VERSION = (rawData as RawPool).version;
export const DATA_LABEL = (rawData as RawPool).label;

export interface Pool {
  players: readonly Player[];
  byId: ReadonlyMap<number, Player>;
  /** Built-in sources followed by imported ones, in import order. */
  sources: readonly RankSource[];
}

function build(imported: readonly ImportedSource[]): Pool {
  const players: Player[] = imported.length === 0
    ? [...BASE_PLAYERS]
    : BASE_PLAYERS.map(p => {
        const ranks: Record<string, number | undefined> = { ...p.ranks };
        for (const src of imported) {
          const r = src.ranks[p.id];
          if (r !== undefined) ranks[src.meta.id] = r;
        }
        return { ...p, ranks };
      });

  return {
    players,
    byId: new Map(players.map(p => [p.id, p])),
    sources: [...BUILTIN_SOURCES, ...imported.map(s => s.meta)]
  };
}

let cacheKey: readonly ImportedSource[] | null = null;
let cacheVal: Pool | null = null;

/** Rebuilding merges ranks across every player, so it is cached by identity. */
export function getPool(imported: readonly ImportedSource[]): Pool {
  if (cacheKey === imported && cacheVal) return cacheVal;
  cacheKey = imported;
  cacheVal = build(imported);
  return cacheVal;
}

export { BASE_PLAYERS };
