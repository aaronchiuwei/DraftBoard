import type { RankSource } from '../types';

/**
 * Scoring formats are not identical across these, which is the single most
 * important caveat when reading a gap. NFFC uses 6-point passing TDs; the
 * others are full PPR. Yahoo is analyst consensus rather than ADP.
 */
export const BUILTIN_SOURCES: readonly RankSource[] = [
  {
    id: 'nffc',
    label: 'NFFC',
    short: 'NFFC',
    format: 'Full PPR, 6pt pass TD',
    color: 'var(--amber)',
    origin: 'builtin',
    note: 'High-stakes entry fee. Kickers and defenses sit in the overall list, so small gaps below ~140 are an artifact.'
  },
  {
    id: 'bb',
    label: 'Big Board',
    short: 'BIG',
    format: 'Full PPR',
    color: 'var(--text)',
    origin: 'builtin',
    note: 'Your own 150-player board. No kickers or defenses on it.'
  },
  {
    id: 'espn',
    label: 'ESPN',
    short: 'ESPN',
    format: 'Full PPR',
    color: 'var(--WR)',
    origin: 'builtin',
    note: 'Ranks kickers and defenses far higher than NFFC does.'
  },
  {
    id: 'yahoo',
    label: 'Yahoo',
    short: 'YHOO',
    format: 'Full PPR',
    color: 'var(--TE)',
    origin: 'builtin',
    note: 'Yahoo analysts\' consensus PPR board, not Yahoo ADP. Kickers and defenses sit in the overall list.'
  },
  {
    id: 'sleeper',
    label: 'Sleeper',
    short: 'SLEEP',
    format: 'Full PPR',
    color: '#2DD4BF',
    origin: 'builtin',
    note: 'Sleeper\'s own PPR ADP. Default Sleeper rooms are half-PPR, so this is the PPR draft market rather than a typical Sleeper league.'
  }
];

/** Colours handed out to imported sources, in order. */
export const IMPORT_COLORS = [
  'var(--RB)',
  'var(--QB)',
  'var(--K)',
  'var(--DEF)',
  '#FF8FD0',
  '#5EEAD4'
] as const;

export function nextImportColor(usedCount: number): string {
  return IMPORT_COLORS[usedCount % IMPORT_COLORS.length] ?? 'var(--RB)';
}
