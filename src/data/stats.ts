import type { Player, Pos } from '../types';
import rawData from './stats.2026.json';

/** Compact keys written by scripts/fetch-stats.mjs. */
type StatLine = Readonly<Record<string, number | undefined>>;

interface RawEntry {
  sid: string;
  shot?: string;
  /** Last season, as played. */
  a?: StatLine;
  /** This season, as projected. */
  p?: StatLine;
}

interface RawStats {
  actualSeason: number;
  projectedSeason: number;
  fetchedAt: string;
  source: string;
  scoring: string;
  players: Record<string, RawEntry>;
}

const data = rawData as RawStats;

export const ACTUAL_SEASON = data.actualSeason;
export const PROJECTED_SEASON = data.projectedSeason;
export const STATS_SOURCE = data.source;
export const STATS_FETCHED_AT = data.fetchedAt;

const LABELS: Record<string, string> = {
  pts: 'PPR PTS',
  gp: 'G',
  pa: 'ATT',
  pc: 'CMP',
  py: 'PASS YD',
  pt: 'PASS TD',
  pi: 'INT',
  ra: 'CAR',
  ry: 'RUSH YD',
  rt: 'RUSH TD',
  tgt: 'TGT',
  rec: 'REC',
  recy: 'REC YD',
  rect: 'REC TD',
  fgm: 'FG',
  fga: 'FGA',
  xpm: 'XP',
  sack: 'SACK',
  int: 'INT',
  fr: 'FUM REC',
  dtd: 'DEF TD',
  pa_allow: 'PTS ALW'
};

/**
 * Which lines are worth the width, per position. A running back's targets
 * decide his PPR value, and a kicker has no yards, so a single shared table
 * would be mostly blank whichever position you opened.
 *
 * Team defences deliberately omit games played: Sleeper projects a defence as
 * playing one game, which is an artefact of how it stores them, not a number
 * anyone should read.
 */
const FIELDS_BY_POS: Record<Pos, readonly string[]> = {
  QB: ['pts', 'gp', 'py', 'pt', 'pi', 'ry', 'rt'],
  RB: ['pts', 'gp', 'ra', 'ry', 'rt', 'rec', 'recy', 'rect'],
  WR: ['pts', 'gp', 'tgt', 'rec', 'recy', 'rect', 'ry', 'rt'],
  TE: ['pts', 'gp', 'tgt', 'rec', 'recy', 'rect'],
  K: ['pts', 'gp', 'fgm', 'fga', 'xpm'],
  DEF: ['pts', 'sack', 'int', 'fr', 'dtd', 'pa_allow']
};

export interface StatRow {
  key: string;
  label: string;
  actual: number | null;
  projected: number | null;
}

export interface PlayerStats {
  /** Sleeper CDN portrait, or null for a team defence. */
  headshot: string | null;
  rows: StatRow[];
  hasActual: boolean;
  hasProjected: boolean;
}

function value(line: StatLine | undefined, key: string): number | null {
  const v = line?.[key];
  return typeof v === 'number' ? v : null;
}

/** Sleeper CDN portrait for a pool player, or null when none is baked. */
export function headshotFor(player: Player): string | null {
  const entry = data.players[String(player.id)];
  return entry?.shot ? `https://sleepercdn.com/content/nfl/players/${entry.shot}.jpg` : null;
}

/**
 * The stat panel for one player, or null when Sleeper has neither a season nor
 * a projection for him. Rows both sides leave empty are dropped, so a rookie
 * shows a projection against a blank column rather than eight blank rows.
 */
export function statsFor(player: Player): PlayerStats | null {
  const entry = data.players[String(player.id)];
  if (!entry) return null;

  const rows: StatRow[] = [];
  for (const key of FIELDS_BY_POS[player.pos]) {
    const actual = value(entry.a, key);
    const projected = value(entry.p, key);
    if (actual === null && projected === null) continue;
    rows.push({ key, label: LABELS[key] ?? key.toUpperCase(), actual, projected });
  }
  if (rows.length === 0) return null;

  return {
    headshot: headshotFor(player),
    rows,
    hasActual: entry.a !== undefined,
    hasProjected: entry.p !== undefined
  };
}

/** Points carry a decimal; counting stats read wrong with one. */
export function formatStat(value: number | null): string {
  if (value === null) return '–';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
