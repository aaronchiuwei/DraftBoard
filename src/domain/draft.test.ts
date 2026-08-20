import { describe, expect, it } from 'vitest';
import {
  pickIndexForTurn,
  pickLabel,
  picksUntilTurn,
  roundOf,
  teamAtPick,
  upcomingPicksFor
} from './draft';
import type { LeagueSettings } from '../types';
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
