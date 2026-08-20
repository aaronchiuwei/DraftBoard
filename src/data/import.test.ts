import { describe, expect, it } from 'vitest';
import { matchRows, normalizeName, parseRankingText } from './import';
import type { Player } from '../types';

const pool: Player[] = [
  { id: 1, name: 'Jahmyr Gibbs', team: 'DET', pos: 'RB', ranks: {} },
  { id: 2, name: "Ja'Marr Chase", team: 'CIN', pos: 'WR', ranks: {} },
  { id: 3, name: 'A.J. Brown', team: 'NE', pos: 'WR', ranks: {} },
  { id: 4, name: 'Marvin Harrison', team: 'ARI', pos: 'WR', ranks: {} },
  { id: 5, name: 'Houston Texans', team: 'HOU', pos: 'DEF', ranks: {} },
  { id: 6, name: 'Michael Wilson', team: 'ARI', pos: 'WR', ranks: {} },
  { id: 7, name: 'Michael Pittman', team: 'PIT', pos: 'WR', ranks: {} },
  // shares an initial and surname with id 6, so "M. Wilson" is genuinely ambiguous
  { id: 8, name: 'Marcus Wilson', team: 'SF', pos: 'RB', ranks: {} }
];

describe('normalizeName', () => {
  it('folds punctuation so A.J. and AJ agree', () => {
    expect(normalizeName('A.J. Brown')).toBe(normalizeName('AJ Brown'));
  });

  it('drops generational suffixes', () => {
    expect(normalizeName('Marvin Harrison Jr.')).toBe('marvin harrison');
  });

  it('strips accents', () => {
    expect(normalizeName('Ja’Marr Chase')).toBe('jamarr chase');
  });
});

describe('parseRankingText', () => {
  it('reads a bare ordered list of names', () => {
    const rows = parseRankingText('Jahmyr Gibbs\nBijan Robinson');
    expect(rows).toEqual([
      { name: 'Jahmyr Gibbs', rank: 1 },
      { name: 'Bijan Robinson', rank: 2 }
    ]);
  });

  it('reads a numbered list', () => {
    expect(parseRankingText('1. Jahmyr Gibbs\n2. Bijan Robinson')[1]).toEqual({
      name: 'Bijan Robinson',
      rank: 2
    });
  });

  it('reads CSV with a header in any column order', () => {
    const rows = parseRankingText('player,pos,rank\nJahmyr Gibbs,RB,4');
    expect(rows[0]).toMatchObject({ name: 'Jahmyr Gibbs', rank: 4, pos: 'RB' });
  });

  it('reads CSV without a header', () => {
    expect(parseRankingText('1,Jahmyr Gibbs\n2,Bijan Robinson')[0]).toMatchObject({
      name: 'Jahmyr Gibbs',
      rank: 1
    });
  });

  it('reads JSON objects and bare JSON string arrays', () => {
    expect(parseRankingText('[{"name":"Jahmyr Gibbs","rank":3}]')[0]).toMatchObject({ rank: 3 });
    expect(parseRankingText('["Jahmyr Gibbs","Bijan Robinson"]')[1]).toMatchObject({ rank: 2 });
  });

  it('handles quoted fields containing commas', () => {
    expect(parseRankingText('rank,player\n1,"Gibbs, Jahmyr"')[0]?.name).toBe('Gibbs, Jahmyr');
  });

  it('returns nothing for empty input', () => {
    expect(parseRankingText('   ')).toEqual([]);
  });
});

describe('matchRows', () => {
  it('matches despite punctuation and suffix differences', () => {
    const result = matchRows(
      [
        { name: 'AJ Brown', rank: 1 },
        { name: 'Marvin Harrison Jr.', rank: 2 },
        { name: 'Ja’Marr Chase', rank: 3 }
      ],
      pool
    );
    expect(result.unmatched).toEqual([]);
    expect(result.ranks[3]).toBe(1);
    expect(result.ranks[4]).toBe(2);
    expect(result.ranks[2]).toBe(3);
  });

  it('matches a defense written as a nickname or abbreviation', () => {
    expect(matchRows([{ name: 'Texans D/ST', rank: 1 }], pool).ranks[5]).toBe(1);
    expect(matchRows([{ name: 'HOU DST', rank: 2 }], pool).ranks[5]).toBe(2);
  });

  it('reports names it could not place instead of guessing', () => {
    const result = matchRows([{ name: 'Some Rookie', rank: 1 }], pool);
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toHaveLength(1);
  });

  it('refuses an ambiguous last name without a tiebreaker', () => {
    const result = matchRows([{ name: 'M. Wilson', rank: 1 }], pool);
    expect(result.unmatched).toHaveLength(1);
  });

  it('uses an explicit team to break a tie', () => {
    const result = matchRows([{ name: 'M. Wilson', rank: 1, team: 'ARI' }], pool);
    expect(result.ranks[6]).toBe(1);
  });

  it('uses an explicit position to break a tie', () => {
    const result = matchRows([{ name: 'M. Wilson', rank: 1, pos: 'RB' }], pool);
    expect(result.ranks[8]).toBe(1);
  });

  it('still matches an unambiguous surname on its own', () => {
    expect(matchRows([{ name: 'Gibbs', rank: 1 }], pool).ranks[1]).toBe(1);
  });

  it('does not let two rows claim the same player', () => {
    const result = matchRows(
      [
        { name: 'AJ Brown', rank: 1 },
        { name: 'A.J. Brown', rank: 2 }
      ],
      pool
    );
    expect(result.matched).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
    expect(result.ranks[3]).toBe(1);
  });
});
