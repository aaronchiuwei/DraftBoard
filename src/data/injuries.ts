import type { Player } from '../types';
import { BASE_PLAYERS } from './pool';
import { normalizeName } from './import';
import rawInjuries from './injuries.2026.json';

export interface InjuryReport {
  /** Short tag shown in the row: Q, D, OUT, IR, etc. */
  tag: string;
  /** Full status from ESPN: Questionable, Out, Injured Reserve, … */
  status: string;
  /** Body part / type when ESPN provides it: Knee, Groin, … */
  injury?: string;
  /** ISO date ESPN expects the player back, when known. */
  returnDate?: string;
}

interface RawInjuryEntry {
  name: string;
  team: string;
  tag: string;
  status: string;
  injury?: string;
  returnDate?: string;
}

interface RawInjuries {
  season: number;
  fetchedAt: string;
  source: string;
  players: RawInjuryEntry[];
}

function parse(data: RawInjuries): RawInjuryEntry[] {
  if (!Array.isArray(data.players)) throw new Error('injuries.json: no players');
  return data.players;
}

const raw = rawInjuries as RawInjuries;
export const INJURIES = parse(raw);
export const INJURIES_FETCHED_AT = raw.fetchedAt;
export const INJURIES_SOURCE = raw.source;

const MS_PER_DAY = 86_400_000;

/** Days from the snapshot date to returnDate; negative means already past. */
export function daysUntilReturn(returnDate: string, from = INJURIES_FETCHED_AT): number {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${returnDate}T12:00:00`);
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

/** Human-readable duration for a tooltip: "~5 days", "~3 weeks", … */
export function formatOutDuration(returnDate: string, from = INJURIES_FETCHED_AT): string {
  const days = daysUntilReturn(returnDate, from);
  if (days <= 0) return 'Day-to-day';
  if (days === 1) return '~1 day';
  if (days < 14) return `~${days} days`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return weeks === 1 ? '~1 week' : `~${weeks} weeks`;
  const months = Math.round(days / 30);
  return months === 1 ? '~1 month' : `~${months} months`;
}

function formatReturnDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Two-line tooltip: expected return + time out. */
export function injuryTooltip(report: InjuryReport): string {
  const lines: string[] = [];
  if (report.injury) lines.push(report.injury);
  lines.push(report.status);
  if (report.returnDate) {
    lines.push(`Expected back ${formatReturnDate(report.returnDate)}`);
    lines.push(formatOutDuration(report.returnDate));
  }
  return lines.join('\n');
}

function buildNameIndex(entries: readonly RawInjuryEntry[]): Map<string, RawInjuryEntry[]> {
  const index = new Map<string, RawInjuryEntry[]>();
  for (const e of entries) {
    const key = normalizeName(e.name);
    const list = index.get(key);
    if (list) list.push(e);
    else index.set(key, [e]);
  }
  return index;
}

const NAME_INDEX = buildNameIndex(INJURIES);

function pickEntry(candidates: RawInjuryEntry[], team?: string): RawInjuryEntry | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0] ?? null;
  if (team) {
    const onTeam = candidates.find(c => c.team === team);
    if (onTeam) return onTeam;
  }
  return candidates[0] ?? null;
}

function toReport(entry: RawInjuryEntry): InjuryReport {
  return {
    tag: entry.tag,
    status: entry.status,
    ...(entry.injury ? { injury: entry.injury } : {}),
    ...(entry.returnDate ? { returnDate: entry.returnDate } : {})
  };
}

/** Look up by normalized name; team breaks ties between same-name players. */
export function injuryForName(name: string, team?: string): InjuryReport | null {
  const entry = pickEntry(NAME_INDEX.get(normalizeName(name)) ?? [], team);
  return entry ? toReport(entry) : null;
}

/** Player-id lookup, built once at boot from the 300-man pool. */
const BY_ID = new Map<number, InjuryReport>();

for (const player of BASE_PLAYERS) {
  const report = injuryForName(player.name, player.team);
  if (report) BY_ID.set(player.id, report);
}

/** Expand a depth-chart-only tag into a minimal report for the tooltip. */
const TAG_STATUS: Record<string, string> = {
  Q: 'Questionable',
  D: 'Doubtful',
  OUT: 'Out',
  IR: 'Injured Reserve',
  PS: 'Practice Squad',
  SUSP: 'Suspended',
  PUP: 'Physically Unable to Perform',
  NFI: 'Non-Football Injury',
  DTD: 'Day-To-Day'
};

export function reportFromTag(tag: string): InjuryReport {
  return { tag, status: TAG_STATUS[tag] ?? tag };
}

export function injuryFor(player: Player): InjuryReport | null {
  return BY_ID.get(player.id) ?? injuryForName(player.name, player.team);
}
