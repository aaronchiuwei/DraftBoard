import { describe, expect, it } from 'vitest';
import { DEFAULT_ROSTER, fillLineup, formatGaps, gapsOf, neededPositions } from './roster';
import type { Player, Pos } from '../types';

let nextId = 1;
function entry(pos: Pos) {
  const player: Player = { id: nextId++, name: `${pos}${nextId}`, team: 'FA', pos, ranks: {} };
  return { player, pickIndex: player.id };
}

const roster = DEFAULT_ROSTER.map(s => ({ ...s, accepts: [...s.accepts] }));

describe('fillLineup', () => {
  it('puts a lone running back at RB rather than in FLEX', () => {
    const lineup = fillLineup(roster, [entry('RB')]);
    const rb = lineup.slots.find(s => s.def.key === 'RB');
    const flex = lineup.slots.find(s => s.def.key === 'FLEX');
    expect(rb?.men).toHaveLength(1);
    expect(flex?.men).toHaveLength(0);
  });

  it('overflows into FLEX only once dedicated slots are full', () => {
    const lineup = fillLineup(roster, [entry('RB'), entry('RB'), entry('RB')]);
    expect(lineup.slots.find(s => s.def.key === 'RB')?.men).toHaveLength(2);
    expect(lineup.slots.find(s => s.def.key === 'FLEX')?.men).toHaveLength(1);
    expect(lineup.bench).toHaveLength(0);
  });

  it('benches players once every slot they qualify for is taken', () => {
    const entries = [entry('QB'), entry('QB')];
    const lineup = fillLineup(roster, entries);
    expect(lineup.slots.find(s => s.def.key === 'QB')?.men).toHaveLength(1);
    expect(lineup.bench).toHaveLength(1);
  });

  it('never places one player in two slots', () => {
    const entries = [entry('RB'), entry('WR'), entry('TE'), entry('QB')];
    const lineup = fillLineup(roster, entries);
    const placed = lineup.slots.flatMap(s => s.men.map(m => m.pickIndex));
    expect(new Set(placed).size).toBe(placed.length);
    expect(placed.length + lineup.bench.length).toBe(entries.length);
  });

  it('does not let a kicker reach FLEX', () => {
    const lineup = fillLineup(roster, [entry('K'), entry('K')]);
    expect(lineup.slots.find(s => s.def.key === 'FLEX')?.men).toHaveLength(0);
    expect(lineup.bench).toHaveLength(1);
  });
});

describe('gapsOf', () => {
  it('reports every unfilled slot on an empty roster', () => {
    const gaps = gapsOf(fillLineup(roster, []));
    expect(formatGaps(gaps)).toEqual(['QB', 'RB×2', 'WR×2', 'TE', 'FLEX×2', 'DEF', 'K']);
  });

  it('is empty once the lineup is full', () => {
    const entries = [
      entry('QB'), entry('RB'), entry('RB'), entry('WR'), entry('WR'),
      entry('TE'), entry('RB'), entry('WR'), entry('DEF'), entry('K')
    ];
    expect(gapsOf(fillLineup(roster, entries))).toEqual([]);
  });
});

describe('neededPositions', () => {
  it('includes FLEX-eligible positions while FLEX is open', () => {
    const entries = [
      entry('QB'), entry('RB'), entry('RB'), entry('WR'), entry('WR'),
      entry('TE'), entry('DEF'), entry('K')
    ];
    const needed = neededPositions(fillLineup(roster, entries));
    expect([...needed].sort()).toEqual(['RB', 'TE', 'WR']);
  });
});
