import { describe, expect, it } from 'vitest';
import { getPool } from '../data/pool';
import { buildCompareDecision } from './compare';
import { defaultDraft } from '../state/persistence';

describe('buildCompareDecision', () => {
  const pool = getPool([]);
  const draft = { ...defaultDraft(), ready: true };
  const sourceIds = pool.sources.map(s => s.id);

  it('picks the higher-consensus player between two backs', () => {
    const gibbs = pool.players.find(p => p.name === 'Jahmyr Gibbs');
    const bijan = pool.players.find(p => p.name === 'Bijan Robinson');
    expect(gibbs).toBeTruthy();
    expect(bijan).toBeTruthy();
    if (!gibbs || !bijan) return;

    const decision = buildCompareDecision(
      [gibbs.id, bijan.id],
      draft,
      pool,
      sourceIds,
      'cons',
      'AVG',
      200
    );
    expect(decision).toBeTruthy();
    expect(decision!.players).toHaveLength(2);
    expect(decision!.headline).toMatch(/^Draft /);
    expect(decision!.sections.some(s => s.rows.some(r => r.key === 'consensus'))).toBe(true);
  });

  it('needs at least two available players', () => {
    const gibbs = pool.players.find(p => p.name === 'Jahmyr Gibbs');
    expect(gibbs).toBeTruthy();
    if (!gibbs) return;

    expect(
      buildCompareDecision([gibbs.id], draft, pool, sourceIds, 'cons', 'AVG', 200)
    ).toBeNull();
  });
});
