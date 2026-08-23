import type { Player } from '../types';
import { BASE_PLAYERS } from './pool';
import { normalizeName } from './import';
import rawDepth from './depth.2026.json';

/** One man at one spot on a team's chart, in ESPN's order. */
export interface DepthEntry {
  name: string;
  jersey?: string;
  /** Only set when it differs from the group, e.g. an FB listed under RB. */
  pos?: string;
  /** Short injury or roster tag: Q, OUT, IR, PS. Absent means active. */
  status?: string;
}

export interface DepthGroup {
  pos: string;
  players: DepthEntry[];
}

export interface DepthTeam {
  code: string;
  name: string;
  short: string;
  groups: DepthGroup[];
}

interface RawDepth {
  season: number;
  label: string;
  fetchedAt: string;
  source: string;
  teams: DepthTeam[];
}

/** A chart entry after the attempt to tie it to a player in the pool. */
export interface ResolvedEntry extends DepthEntry {
  /** Null when the pool doesn't carry him, which is most of a 90-man roster. */
  playerId: number | null;
}

export interface ResolvedGroup {
  pos: string;
  players: ResolvedEntry[];
}

export interface ResolvedTeam {
  code: string;
  name: string;
  short: string;
  groups: ResolvedGroup[];
}

/* Validated at boot for the same reason the player pool is: a bad record would
   otherwise surface as a blank row while you are trying to read a chart. */
function parse(data: RawDepth): DepthTeam[] {
  if (!Array.isArray(data.teams) || data.teams.length === 0) {
    throw new Error('depth.json: no teams');
  }
  return data.teams.map((team, i) => {
    if (!team.code || !team.name || !Array.isArray(team.groups)) {
      throw new Error(`depth.json: malformed team at index ${i}`);
    }
    for (const group of team.groups) {
      if (!group.pos || !Array.isArray(group.players)) {
        throw new Error(`depth.json: malformed group "${group.pos}" for ${team.code}`);
      }
    }
    return team;
  });
}

const raw = rawDepth as RawDepth;
export const DEPTH_TEAMS: readonly DepthTeam[] = parse(raw);
export const DEPTH_LABEL = raw.label;
export const DEPTH_FETCHED_AT = raw.fetchedAt;
export const DEPTH_SOURCE = raw.source;

/**
 * Name matching is deliberately not team-gated. A chart is fresher than the
 * player pool, so the back ESPN lists in Kansas City may still be filed under
 * Seattle here; dropping him would hide the most interesting rows on the page.
 * The team is only used to break a tie between two men with the same name.
 */
function buildNameIndex(players: readonly Player[]): Map<string, Player[]> {
  const index = new Map<string, Player[]>();
  for (const p of players) {
    const key = normalizeName(p.name);
    const list = index.get(key);
    if (list) list.push(p);
    else index.set(key, [p]);
  }
  return index;
}

const NAME_INDEX = buildNameIndex(BASE_PLAYERS);

function matchEntry(entry: DepthEntry, teamCode: string): number | null {
  const candidates = NAME_INDEX.get(normalizeName(entry.name));
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]?.id ?? null;
  const onTeam = candidates.find(p => p.team === teamCode);
  return (onTeam ?? candidates[0])?.id ?? null;
}

function resolve(team: DepthTeam): ResolvedTeam {
  return {
    code: team.code,
    name: team.name,
    short: team.short,
    groups: team.groups.map(group => ({
      pos: group.pos,
      players: group.players.map(entry => ({
        ...entry,
        playerId: matchEntry(entry, team.code)
      }))
    }))
  };
}

/* Player ids never change, so resolution happens once per team and is kept. */
const cache = new Map<string, ResolvedTeam>();

export function resolvedTeam(code: string): ResolvedTeam | null {
  const hit = cache.get(code);
  if (hit) return hit;
  const team = DEPTH_TEAMS.find(t => t.code === code);
  if (!team) return null;
  const built = resolve(team);
  cache.set(code, built);
  return built;
}

export const DEFAULT_DEPTH_TEAM = DEPTH_TEAMS[0]?.code ?? 'ARI';

/** Precomputed depth-chart slot per pool player, e.g. "WR1", keyed by player id. */
function buildDepthRoleIndex(): ReadonlyMap<number, string> {
  const poolById = new Map(BASE_PLAYERS.map(p => [p.id, p]));
  const index = new Map<number, string>();

  for (const team of DEPTH_TEAMS) {
    const resolved = resolve(team);
    for (const group of resolved.groups) {
      for (let i = 0; i < group.players.length; i++) {
        const entry = group.players[i];
        if (!entry || entry.playerId === null) continue;
        const player = poolById.get(entry.playerId);
        if (player?.team === team.code) {
          index.set(entry.playerId, `${group.pos}${i + 1}`);
        }
      }
    }
  }
  return index;
}

const DEPTH_ROLE_BY_PLAYER_ID = buildDepthRoleIndex();

/** Where a player sits on his team's ESPN depth chart, or null when he isn't listed. */
export function depthRoleFor(player: Player): string | null {
  return DEPTH_ROLE_BY_PLAYER_ID.get(player.id) ?? null;
}
