import type { Player } from '../types';
import { BASE_PLAYERS } from './pool';
import { normalizeName } from './import';
import rawInjuries from './injuries.2026.json';

export interface SourceInjury {
  tag: string;
  status: string;
  injury?: string;
  injuryDate?: string;
  returnDate?: string;
}

export interface InjuryReport {
  /** Merged tag shown in the row — most severe when sources disagree. */
  tag: string;
  /** Status label from the source that supplied the merged tag. */
  status: string;
  injury?: string;
  injuryDate?: string;
  returnDate?: string;
  espn?: SourceInjury;
  sleeper?: SourceInjury;
  /** False when ESPN and Sleeper tags differ. */
  agree?: boolean;
}

interface RawInjuryEntry {
  name: string;
  team: string;
  tag: string;
  status: string;
  injury?: string;
  injuryDate?: string;
  returnDate?: string;
  espn?: SourceInjury;
  sleeper?: SourceInjury;
  agree?: boolean;
}

interface RawInjuries {
  season: number;
  fetchedAt: string;
  sources: string[];
  players: RawInjuryEntry[];
}

function parse(data: RawInjuries): RawInjuryEntry[] {
  if (!Array.isArray(data.players)) throw new Error('injuries.json: no players');
  return data.players;
}

const raw = rawInjuries as RawInjuries;
export const INJURIES = parse(raw);
export const INJURIES_FETCHED_AT = raw.fetchedAt;
export const INJURIES_SOURCES = raw.sources ?? ['ESPN'];

const MS_PER_DAY = 86_400_000;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Days from `from` through `to` (both ISO dates). */
export function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

/** Days from a reference date to returnDate. */
export function daysUntilReturn(returnDate: string, from = todayISO()): number {
  return daysBetween(from, returnDate);
}

/** How long ESPN's return date is from today — not total time missed. */
export function formatBackIn(returnDate: string, from = todayISO()): string {
  const days = daysUntilReturn(returnDate, from);
  if (days < 0) return 'Return date passed';
  if (days === 0) return 'Back today';
  if (days === 1) return 'Back in ~1 day';
  if (days < 14) return `Back in ~${days} days`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return weeks === 1 ? 'Back in ~1 week' : `Back in ~${weeks} weeks`;
  const months = Math.round(days / 30);
  return months === 1 ? 'Back in ~1 month' : `Back in ~${months} months`;
}

/** Days since ESPN's injury report date. */
export function formatOutSince(injuryDate: string, from = todayISO()): string {
  const days = daysBetween(injuryDate, from);
  if (days <= 0) return 'Reported today';
  if (days === 1) return 'Out ~1 day';
  if (days < 14) return `Out ~${days} days`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return weeks === 1 ? 'Out ~1 week' : `Out ~${weeks} weeks`;
  const months = Math.round(days / 30);
  return months === 1 ? 'Out ~1 month' : `Out ~${months} months`;
}

function formatInjuryDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatReturnDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function sourceLine(label: string, snap: SourceInjury): string {
  const parts = [label, snap.tag];
  if (snap.injury) parts.push(snap.injury);
  return parts.join(' · ');
}

/** Tooltip lines: injury, status, cross-ref, time out, expected return. */
export function injuryTooltip(report: InjuryReport): string {
  const lines: string[] = [];
  if (report.injury) lines.push(report.injury);
  lines.push(report.status);

  if (report.espn && report.sleeper) {
    if (report.agree === false) {
      lines.push(`${sourceLine('ESPN', report.espn)}  /  ${sourceLine('Sleeper', report.sleeper)}`);
    }
  } else if (report.sleeper && !report.espn) {
    lines.push('Sleeper only — not on ESPN injury report');
  }

  if (report.injuryDate) {
    lines.push(`Out since ${formatInjuryDate(report.injuryDate)} · ${formatOutSince(report.injuryDate)}`);
  }
  if (report.returnDate) {
    lines.push(`Expected back ${formatReturnDate(report.returnDate)} (ESPN)`);
    lines.push(formatBackIn(report.returnDate));
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
    ...(entry.injuryDate ? { injuryDate: entry.injuryDate } : {}),
    ...(entry.returnDate ? { returnDate: entry.returnDate } : {}),
    ...(entry.espn ? { espn: entry.espn } : {}),
    ...(entry.sleeper ? { sleeper: entry.sleeper } : {}),
    ...(entry.agree !== undefined ? { agree: entry.agree } : {})
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
  DTD: 'Day-To-Day',
  DNR: 'Did Not Report',
  COV: 'COVID-19'
};

export function reportFromTag(tag: string): InjuryReport {
  return { tag, status: TAG_STATUS[tag] ?? tag };
}

export function injuryFor(player: Player): InjuryReport | null {
  return BY_ID.get(player.id) ?? injuryForName(player.name, player.team);
}
