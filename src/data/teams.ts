import type { Player } from '../types';
import rawData from './teams.2026.json';

interface RawTeam {
  offRank: number | null;
  defRank: number | null;
  ptsRank: number | null;
  shootoutRank: number | null;
  passRate: number | null;
  playsPerGame: number | null;
  offYpp: number | null;
  rb1Share: number | null;
}

interface RawTeams {
  season: number;
  fetchedAt: string;
  source: string;
  teams: Record<string, RawTeam>;
}

const data = rawData as RawTeams;

export const TEAM_STATS_SEASON = data.season;

export interface TeamContext {
  offRank: number | null;
  defRank: number | null;
  ptsRank: number | null;
  shootoutRank: number | null;
  passRate: number | null;
  playsPerGame: number | null;
  rb1Share: number | null;
}

export function teamContextFor(player: Player): TeamContext | null {
  const team = data.teams[player.team];
  if (!team) return null;
  return {
    offRank: team.offRank,
    defRank: team.defRank,
    ptsRank: team.ptsRank,
    shootoutRank: team.shootoutRank ?? null,
    passRate: team.passRate,
    playsPerGame: team.playsPerGame,
    rb1Share: team.rb1Share ?? null
  };
}

/** Lower rank is better — format as #3 of 32. */
export function formatTeamRank(rank: number | null): string {
  if (rank === null) return '–';
  return `#${rank}`;
}

export function formatPassRate(rate: number | null): string {
  if (rate === null) return '–';
  return `${rate.toFixed(1)}%`;
}

export function formatPlaysPerGame(plays: number | null): string {
  if (plays === null) return '–';
  return plays.toFixed(1);
}
