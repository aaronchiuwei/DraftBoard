export const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;
export type Pos = (typeof POSITIONS)[number];

export function isPos(v: string): v is Pos {
  return (POSITIONS as readonly string[]).includes(v);
}

/**
 * A player carries no rank fields of its own. Ranks live in a map keyed by
 * source id so a newly imported ADP is the same kind of thing as a built-in
 * one, and nothing downstream has to know which sources exist.
 */
export interface Player {
  id: number;
  name: string;
  team: string;
  pos: Pos;
  ranks: Readonly<Record<string, number | undefined>>;
}

export interface RankSource {
  id: string;
  /** Full name, used in the player sheet and settings. */
  label: string;
  /** Short name for the filter chips and table headers. Keep to ~5 chars. */
  short: string;
  /** Scoring format, surfaced so a gap can be read as format vs opinion. */
  format: string;
  /** Colour of this source's dot on the divergence rail. */
  color: string;
  origin: 'builtin' | 'imported';
  note?: string;
  importedAt?: string;
}

/** Rank source ids are strings; consensus is a computed pseudo-source. */
export const CONSENSUS = 'cons';
export type SourceKey = string;

export interface SlotDef {
  key: string;
  count: number;
  accepts: readonly Pos[];
}

export interface LeagueSettings {
  teams: number;
  rounds: number;
  /** Zero-indexed draft slot belonging to the person holding the phone. */
  mySlot: number;
  names: string[];
  roster: SlotDef[];
}

export interface DraftState {
  ready: boolean;
  league: LeagueSettings;
  /** Player ids in pick order. Index is the pick number. */
  picks: number[];
}

export interface ImportedSource {
  meta: RankSource;
  ranks: Record<number, number>;
}

export type PosFilter = Pos | 'ALL' | 'FLEX';
export type ViewId = 'players' | 'queue' | 'compare' | 'board' | 'teams' | 'depth' | 'setup';
export type CompareSort = 'spread' | 'cons';

export interface UiState {
  view: ViewId;
  source: SourceKey;
  pos: PosFilter;
  hideDrafted: boolean;
  query: string;
  /** Which team's roster the Teams tab is showing. */
  team: number;
  /** NFL team code whose depth chart the Depth tab is showing. */
  depthTeam: string;
  compareSort: CompareSort;
  sheetPlayerId: number | null;
}

export interface AppState {
  draft: DraftState;
  ui: UiState;
  imported: ImportedSource[];
  /** Source ids the user has switched off; they stop counting toward consensus. */
  disabledSources: string[];
  /**
   * Player ids in the order you want them, highest first. Independent of the
   * draft: a reset wipes picks but keeps the prep work.
   */
  queue: number[];
  /** Player ids marked to stand out in every list. Order is not meaningful. */
  flagged: number[];
}
