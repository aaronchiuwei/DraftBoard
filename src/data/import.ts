import type { Player } from '../types';

export interface ParsedRow {
  name: string;
  rank: number;
  pos?: string;
  team?: string;
}

export interface MatchResult {
  ranks: Record<number, number>;
  matched: { row: ParsedRow; player: Player }[];
  unmatched: ParsedRow[];
  /** Rows that resolved to a player already claimed by an earlier row. */
  duplicates: ParsedRow[];
}

/* ------------------------------------------------------------ normalizing */

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

/**
 * Rankings get pasted from a dozen sources that punctuate names differently.
 * "A.J. Brown", "AJ Brown", and "Aj Brown" all have to land on one player.
 */
export function normalizeName(raw: string): string {
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.'’`,]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const parts = cleaned.split(' ').filter(w => w && !SUFFIXES.has(w));
  return parts.join(' ');
}

/** Strips the "d/st", "dst", "defense" tail that team defenses arrive with. */
function normalizeDefense(raw: string): string {
  return normalizeName(raw)
    .replace(/\b(d ?st|dst|defense|def|special teams)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---------------------------------------------------------------- parsing */

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === '\t') {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const RANK_HEADERS = ['rank', 'rk', 'adp', 'overall', 'ovr', '#', 'pick'];
const NAME_HEADERS = ['player', 'name', 'playername', 'player name'];
const POS_HEADERS = ['pos', 'position'];
const TEAM_HEADERS = ['team', 'tm', 'nfl'];

function headerIndex(cells: string[], candidates: string[]): number {
  return cells.findIndex(c => candidates.includes(c.toLowerCase().trim()));
}

function parseJsonRows(text: string): ParsedRow[] | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;

  const rows: ParsedRow[] = [];
  data.forEach((item, i) => {
    if (typeof item === 'string') {
      rows.push({ name: item, rank: i + 1 });
      return;
    }
    if (!item || typeof item !== 'object') return;
    const o = item as Record<string, unknown>;
    const name = o['name'] ?? o['player'] ?? o['playerName'] ?? o['Player'] ?? o['Name'];
    if (typeof name !== 'string') return;
    const rankRaw = o['rank'] ?? o['adp'] ?? o['overall'] ?? o['rk'] ?? o['Rank'] ?? o['ADP'];
    const rank = typeof rankRaw === 'number' ? rankRaw : Number(rankRaw);
    rows.push({
      name,
      rank: Number.isFinite(rank) ? rank : i + 1,
      pos: typeof o['pos'] === 'string' ? o['pos'] : undefined,
      team: typeof o['team'] === 'string' ? o['team'] : undefined
    });
  });
  return rows.length ? rows : null;
}

/**
 * Accepts JSON, delimited text with or without a header, and a bare list of
 * names where line order is the ranking — which is how a board copied out of
 * a spreadsheet or transcribed off an image usually arrives.
 */
export function parseRankingText(text: string): ParsedRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const json = parseJsonRows(trimmed);
  if (json) return json;

  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const first = splitCsvLine(lines[0] ?? '');
  const nameCol = headerIndex(first, NAME_HEADERS);
  const hasHeader = nameCol >= 0;

  if (hasHeader) {
    const rankCol = headerIndex(first, RANK_HEADERS);
    const posCol = headerIndex(first, POS_HEADERS);
    const teamCol = headerIndex(first, TEAM_HEADERS);
    const rows: ParsedRow[] = [];
    lines.slice(1).forEach((line, i) => {
      const cells = splitCsvLine(line);
      const name = cells[nameCol]?.trim();
      if (!name) return;
      const rankRaw = rankCol >= 0 ? Number(cells[rankCol]) : NaN;
      rows.push({
        name,
        rank: Number.isFinite(rankRaw) ? rankRaw : i + 1,
        pos: posCol >= 0 ? cells[posCol] : undefined,
        team: teamCol >= 0 ? cells[teamCol] : undefined
      });
    });
    return rows;
  }

  // no header: either "<rank><sep><name>" or a bare ordered list of names
  const rows: ParsedRow[] = [];
  lines.forEach((line, i) => {
    const cells = splitCsvLine(line);
    if (cells.length > 1) {
      const lead = Number(cells[0]?.replace(/[.)]$/, ''));
      if (Number.isFinite(lead) && cells[1]) {
        rows.push({ name: cells[1], rank: lead, pos: cells[2], team: cells[3] });
        return;
      }
      const name = cells.find(c => c && !Number.isFinite(Number(c)));
      if (name) rows.push({ name, rank: i + 1 });
      return;
    }
    const m = line.match(/^(\d+)\s*[.):-]?\s+(.*)$/);
    if (m && m[2]) rows.push({ name: m[2], rank: Number(m[1]) });
    else rows.push({ name: line, rank: i + 1 });
  });
  return rows;
}

/* --------------------------------------------------------------- matching */

interface NameIndex {
  exact: Map<string, Player[]>;
  defense: Map<string, Player[]>;
  lastName: Map<string, Player[]>;
}

function buildIndex(players: readonly Player[]): NameIndex {
  const exact = new Map<string, Player[]>();
  const defense = new Map<string, Player[]>();
  const lastName = new Map<string, Player[]>();

  const push = (map: Map<string, Player[]>, key: string, p: Player) => {
    if (!key) return;
    const list = map.get(key);
    if (list) list.push(p);
    else map.set(key, [p]);
  };

  for (const p of players) {
    const norm = normalizeName(p.name);
    push(exact, norm, p);
    const parts = norm.split(' ');
    const last = parts[parts.length - 1];
    if (last) push(lastName, last, p);

    if (p.pos === 'DEF') {
      // defenses are stored as full team names, but arrive as nicknames,
      // abbreviations, or "<city> D/ST"
      push(defense, norm, p);
      if (last) push(defense, last, p);
      push(defense, normalizeName(p.team), p);
    }
  }
  return { exact, defense, lastName };
}

function pick(list: Player[] | undefined, row: ParsedRow): Player | null {
  if (!list || list.length === 0) return null;
  if (list.length === 1) return list[0] ?? null;
  // ambiguous: let an explicit position or team in the import break the tie
  const pos = row.pos?.toUpperCase().replace(/\/|\s/g, '');
  const team = row.team?.toUpperCase();
  const byBoth = list.filter(p => (!pos || p.pos === pos) && (!team || p.team === team));
  if (byBoth.length === 1) return byBoth[0] ?? null;
  const byTeam = team ? list.filter(p => p.team === team) : [];
  if (byTeam.length === 1) return byTeam[0] ?? null;
  return null;
}

export function matchRows(rows: readonly ParsedRow[], players: readonly Player[]): MatchResult {
  const index = buildIndex(players);
  const ranks: Record<number, number> = {};
  const matched: { row: ParsedRow; player: Player }[] = [];
  const unmatched: ParsedRow[] = [];
  const duplicates: ParsedRow[] = [];
  const claimed = new Set<number>();

  for (const row of rows) {
    const norm = normalizeName(row.name);
    // test the normalized form so "D/ST", "D-ST", and "DST" all read the same
    const isDef = /\b(d ?st|dst|defense)\b/.test(norm) || row.pos?.toUpperCase() === 'DEF';

    let player =
      pick(index.exact.get(norm), row) ??
      (isDef ? pick(index.defense.get(normalizeDefense(row.name)), row) : null);

    if (!player) {
      const parts = norm.split(' ');
      const last = parts[parts.length - 1];
      const candidates = last ? index.lastName.get(last) : undefined;
      // a one-word row is a bare surname; its only token is not a first initial
      const initial = parts.length > 1 ? parts[0]?.[0] : undefined;
      const narrowed = candidates?.filter(p => !initial || normalizeName(p.name)[0] === initial);
      player = pick(narrowed, row);
    }

    if (!player) {
      unmatched.push(row);
      continue;
    }
    if (claimed.has(player.id)) {
      duplicates.push(row);
      continue;
    }
    claimed.add(player.id);
    ranks[player.id] = row.rank;
    matched.push({ row, player });
  }

  return { ranks, matched, unmatched, duplicates };
}

export function slugifySourceId(label: string): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base || 'import';
}
