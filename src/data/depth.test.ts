import { describe, expect, it } from 'vitest';
import { DEPTH_TEAMS, teamCity, teamMatchesQuery } from './depth';

describe('teamMatchesQuery', () => {
  const kc = DEPTH_TEAMS.find(t => t.code === 'KC');
  const nyg = DEPTH_TEAMS.find(t => t.code === 'NYG');

  it('matches city, mascot, code, and full name', () => {
    expect(kc).toBeTruthy();
    expect(nyg).toBeTruthy();
    if (!kc || !nyg) return;

    expect(teamCity(kc)).toBe('Kansas City');
    expect(teamCity(nyg)).toBe('New York');

    expect(teamMatchesQuery(kc, 'kansas')).toBe(true);
    expect(teamMatchesQuery(kc, 'chiefs')).toBe(true);
    expect(teamMatchesQuery(kc, 'kc')).toBe(true);
    expect(teamMatchesQuery(kc, 'kansas city chiefs')).toBe(true);

    expect(teamMatchesQuery(kc, 'arizona')).toBe(false);
    expect(teamMatchesQuery(nyg, 'new york')).toBe(true);
    expect(teamMatchesQuery(nyg, 'giants')).toBe(true);
  });

  it('shows every team when the query is empty', () => {
    expect(DEPTH_TEAMS.every(t => teamMatchesQuery(t, ''))).toBe(true);
    expect(DEPTH_TEAMS.every(t => teamMatchesQuery(t, '   '))).toBe(true);
  });
});
