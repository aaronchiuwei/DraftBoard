import type { Player } from '../types';
import rawData from './research.2026.json';

interface OlRow {
  olRank2025: number;
  trend: 'up' | 'down' | 'neutral' | 'up2';
  cohesion: number;
  olRank2026: number;
  qbRuns: boolean;
}

interface PlaycallerRow {
  team: string;
  name: string;
  seasons: number;
  fantasyPPG: number | null;
  fantasyRank: number | null;
  team2025PPG: number | null;
  team2025Rank: number | null;
  rbPPG: number | null;
  rbRank: number | null;
  wrPPG: number | null;
  wrRank: number | null;
  rb1Pct: number | null;
  rb1Rank: number | null;
  personnel: string | null;
  paceRank: number | string | null;
  runScheme: string | null;
  motionRank: number | string | null;
  formation: string | null;
  rbScreenRank: number | string | null;
}

interface RbVolumeRow {
  name: string;
  projVolumeRank: number | null;
  adjVolumeRank: number | null;
  confidence: 'high' | 'mid' | 'low';
}

interface LuckRow {
  name: string;
  ptsLost: number;
  pctLost: number;
}

interface RawResearch {
  source: string;
  season: number;
  fetchedAt: string;
  ol: Record<string, OlRow>;
  playcallers: Record<string, PlaycallerRow>;
  rbVolume: Record<string, RbVolumeRow>;
  luck: Record<string, LuckRow>;
}

const data = rawData as RawResearch;

export const RESEARCH_SOURCE = data.source;

export function olFor(player: Player): OlRow | null {
  return data.ol[player.team] ?? null;
}

export function playcallerFor(player: Player): PlaycallerRow | null {
  return data.playcallers[player.team] ?? null;
}

export function rbVolumeFor(player: Player): RbVolumeRow | null {
  return data.rbVolume[String(player.id)] ?? null;
}

export function luckFor(player: Player): LuckRow | null {
  return data.luck[String(player.id)] ?? null;
}

export function formatTrend(trend: OlRow['trend']): string {
  if (trend === 'up') return '↑';
  if (trend === 'up2') return '↑↑';
  if (trend === 'down') return '↓';
  return '–';
}

export function formatRankLabel(rank: number | null): string {
  if (rank === null) return '–';
  const s = rank % 10;
  const suffix = s === 1 && rank !== 11 ? 'st' : s === 2 && rank !== 12 ? 'nd' : s === 3 && rank !== 13 ? 'rd' : 'th';
  return `${rank}${suffix}`;
}

export function formatLuckPts(v: number): string {
  const rounded = Math.round(v * 100) / 100;
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}

export type { OlRow, PlaycallerRow, RbVolumeRow, LuckRow };
