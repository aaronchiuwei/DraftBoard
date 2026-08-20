import { describe, expect, it } from 'vitest';
import {
  pickInRound,
  pickIndexForTurn,
  pickLabel,
  pickMarkersFor,
  picksUntilTurn,
  roundOf,
  teamAtPick,
  upcomingPicksFor
} from './draft';
import type { DraftState, LeagueSettings } from '../types';
import { DEFAULT_ROSTER } from './roster';

const league = (teams: number, rounds: number, mySlot = 0): LeagueSettings => ({
  teams,
  rounds,
  mySlot,
  names: Array.from({ length: teams }, (_, i) => `Team ${i + 1}`),
  roster: DEFAULT_ROSTER.map(s => ({ ...s, accepts: [...s.accepts] }))
});

describe('teamAtPick', () => {
  it('runs left to right in the first round', () => {
    expect([0, 1, 2, 3].map(i => teamAtPick(i, 4))).toEqual([0, 1, 2, 3]);
  });

  it('reverses in the second round', () => {
    expect([4, 5, 6, 7].map(i => teamAtPick(i, 4))).toEqual([3, 2, 1, 0]);
  });

  it('gives the turn team back-to-back picks across the wrap', () => {
    expect(teamAtPick(3, 4)).toBe(3);
    expect(teamAtPick(4, 4)).toBe(3);
  });

  it('gives every team exactly one pick per round', () => {
    const seen = new Set([8, 9, 10, 11].map(i => teamAtPick(i, 4)));
    expect(seen.size).toBe(4);
  });
});

describe('pickIndexForTurn', () => {
  it('inverts teamAtPick for every pick in the draft', () => {
    const teams = 12;
    for (let turn = 0; turn < 16; turn++) {
      for (let team = 0; team < teams; team++) {
        const index = pickIndexForTurn(team, turn, teams);
        expect(teamAtPick(index, teams)).toBe(team);
        expect(roundOf(index, teams)).toBe(turn + 1);
      }
    }
  });
});

describe('pickLabel', () => {
  it('is one-indexed and zero-padded within the round', () => {
    expect(pickLabel(0, 12)).toBe('1.01');
    expect(pickLabel(11, 12)).toBe('1.12');
    expect(pickLabel(12, 12)).toBe('2.01');
  });
});

describe('upcomingPicksFor', () => {
  it('lists a team\'s remaining picks in order', () => {
    expect(upcomingPicksFor(0, 0, league(4, 3))).toEqual([0, 7, 8]);
  });

  it('stops at the end of the draft', () => {
    expect(upcomingPicksFor(3, 0, league(4, 2))).toEqual([3, 4]);
  });

  it('excludes picks already made', () => {
    expect(upcomingPicksFor(0, 1, league(4, 3))).toEqual([7, 8]);
  });
});

describe('pickInRound', () => {
  it('is one-indexed within the round', () => {
    expect(pickInRound(0, 12)).toBe(1);
    expect(pickInRound(7, 12)).toBe(8);
    expect(pickInRound(12, 12)).toBe(1);
  });
});

describe('pickMarkersFor', () => {
  const draft = (teams: number, rounds: number, mySlot: number, made: number): DraftState => ({
    ready: true,
    league: league(teams, rounds, mySlot),
    picks: Array.from({ length: made }, (_, i) => i + 1)
  });

  it('puts the 8th pick of a 12-team draft after seven players', () => {
    const [first] = pickMarkersFor(draft(12, 16, 7, 0), 7);
    expect(first).toEqual({ pickIndex: 7, before: 7 });
    expect(roundOf(7, 12)).toBe(1);
    expect(pickInRound(7, 12)).toBe(8);
  });

  it('snakes back for the second round', () => {
    const [, second] = pickMarkersFor(draft(12, 16, 7, 0), 7);
    expect(second).toEqual({ pickIndex: 16, before: 16 });
    expect(roundOf(16, 12)).toBe(2);
    expect(pickInRound(16, 12)).toBe(5);
  });

  it('closes the gap as the picks ahead of you come in', () => {
    const [first] = pickMarkersFor(draft(12, 16, 7, 3), 7);
    expect(first).toEqual({ pickIndex: 7, before: 4 });
  });

  it('reads zero on your own clock, so the line sits above the list', () => {
    const [first] = pickMarkersFor(draft(12, 16, 7, 7), 7);
    expect(first).toEqual({ pickIndex: 7, before: 0 });
  });

  it('drops a pick once it has been used', () => {
    const markers = pickMarkersFor(draft(12, 2, 7, 8), 7);
    expect(markers.map(m => m.pickIndex)).toEqual([16]);
  });

  it('is empty once the team has no picks left', () => {
    expect(pickMarkersFor(draft(4, 2, 0, 8), 0)).toEqual([]);
  });

  it('counts every pick between now and yours, back to back at the turn', () => {
    // the last team in the round picks at 3 and again at 4
    const markers = pickMarkersFor(draft(4, 3, 3, 0), 3);
    expect(markers.map(m => m.before)).toEqual([3, 4, 11]);
  });
});

describe('picksUntilTurn', () => {
  it('counts the picks between now and your next turn', () => {
    expect(picksUntilTurn(0, 1, league(4, 3))).toBe(6);
  });

  it('is zero when you are on the clock', () => {
    expect(picksUntilTurn(0, 0, league(4, 3))).toBe(0);
  });

  it('is null once you have no picks left', () => {
    expect(picksUntilTurn(0, 9, league(4, 3))).toBeNull();
  });
});
