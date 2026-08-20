import { describe, expect, it } from 'vitest';
import { consensusOf, railDots, rankOf, spreadOf, sortValue } from './rankings';
import type { Player, RankSource } from '../types';

const player = (ranks: Record<string, number>): Player => ({
  id: 1,
  name: 'Test Player',
  team: 'FA',
  pos: 'RB',
  ranks
});

const sources: RankSource[] = ['a', 'b', 'c', 'd'].map(id => ({
  id,
  label: id,
  short: id,
  format: 'PPR',
  color: '#fff',
  origin: 'builtin'
}));
const ids = sources.map(s => s.id);

describe('consensusOf', () => {
  it('averages only the sources that rank him', () => {
    expect(consensusOf(player({ a: 10, b: 20 }), ids)).toBe(15);
  });

  it('is null when nobody ranks him', () => {
    expect(consensusOf(player({}), ids)).toBeNull();
  });

  it('ignores sources that are muted', () => {
    expect(consensusOf(player({ a: 10, b: 20, c: 300 }), ['a', 'b'])).toBe(15);
  });

  it('matches the values the original data shipped with', () => {
    // Ja'Marr Chase: espn 4, nffc 3, yahoo 3, bb 3
    expect(consensusOf(player({ a: 4, b: 3, c: 3, d: 3 }), ids)).toBeCloseTo(3.25, 5);
  });
});

describe('rankOf', () => {
  it('returns null rather than undefined for an unranked source', () => {
    expect(rankOf(player({ a: 1 }), 'b')).toBeNull();
  });
});

describe('sortValue', () => {
  it('sorts unranked players last', () => {
    const ranked = sortValue(player({ a: 300 }), 'a', ids);
    const unranked = sortValue(player({ b: 1 }), 'a', ids);
    expect(ranked).toBeLessThan(unranked);
  });
});

describe('spreadOf', () => {
  it('measures the distance between the highest and lowest opinion', () => {
    expect(spreadOf(player({ a: 10, b: 30 }), ids, 200)?.spread).toBe(20);
  });

  it('needs two opinions to mean anything', () => {
    expect(spreadOf(player({ a: 10 }), ids, 200)).toBeNull();
  });

  it('caps deep ranks so the gap measures disagreement, not list length', () => {
    // without the cap this would read as a spread of 455
    expect(spreadOf(player({ a: 10, b: 465 }), ids, 200)?.spread).toBe(190);
  });
});

describe('railDots', () => {
  it('places a source that is high on a player left of centre', () => {
    const dots = railDots(player({ a: 10, b: 40 }), sources);
    const high = dots.find(d => d.sourceId === 'a');
    const low = dots.find(d => d.sourceId === 'b');
    expect(high?.offset).toBeLessThan(0);
    expect(low?.offset).toBeGreaterThan(0);
  });

  it('clamps extreme disagreement to the edges', () => {
    const dots = railDots(player({ a: 1, b: 400 }), sources);
    expect(dots.every(d => d.offset >= -1 && d.offset <= 1)).toBe(true);
  });

  it('skips sources with no opinion', () => {
    expect(railDots(player({ a: 10, b: 20 }), sources)).toHaveLength(2);
  });
});
