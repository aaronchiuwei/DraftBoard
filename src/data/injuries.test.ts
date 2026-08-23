import { describe, expect, it } from 'vitest';
import {
  daysUntilReturn,
  formatOutDuration,
  injuryForName,
  injuryTooltip,
  reportFromTag
} from './injuries';

describe('injuries', () => {
  it('formats duration from snapshot date to return date', () => {
    expect(daysUntilReturn('2026-08-28', '2026-08-23')).toBe(5);
    expect(formatOutDuration('2026-08-28', '2026-08-23')).toBe('~5 days');
    expect(formatOutDuration('2026-08-24', '2026-08-23')).toBe('~1 day');
    expect(formatOutDuration('2026-09-06', '2026-08-23')).toBe('~2 weeks');
  });

  it('builds a tooltip with return date and duration', () => {
    const tip = injuryTooltip({
      tag: 'Q',
      status: 'Questionable',
      injury: 'Knee',
      returnDate: '2026-08-28'
    });
    expect(tip).toContain('Knee');
    expect(tip).toContain('Questionable');
    expect(tip).toContain('Expected back Aug 28, 2026');
    expect(tip).toContain('~5 days');
  });

  it('looks up injuries by name', () => {
    const benson = injuryForName('Trey Benson', 'ARI');
    expect(benson?.tag).toBe('Q');
    expect(benson?.returnDate).toBeTruthy();
  });

  it('expands depth-chart tags into reports', () => {
    expect(reportFromTag('IR').status).toBe('Injured Reserve');
    expect(reportFromTag('PS').status).toBe('Practice Squad');
  });
});
