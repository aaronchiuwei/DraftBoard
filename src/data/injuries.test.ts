import { describe, expect, it } from 'vitest';
import {
  daysUntilReturn,
  formatBackIn,
  formatOutSince,
  injuryForName,
  injuryTooltip,
  reportFromTag
} from './injuries';

const TODAY = '2026-08-23';

describe('injuries', () => {
  it('formats time until return from today', () => {
    expect(daysUntilReturn('2026-08-28', TODAY)).toBe(5);
    expect(formatBackIn('2026-08-28', TODAY)).toBe('Back in ~5 days');
    expect(formatBackIn('2026-08-24', TODAY)).toBe('Back in ~1 day');
    expect(formatBackIn('2026-09-06', TODAY)).toBe('Back in ~2 weeks');
  });

  it('formats time out since the injury report date', () => {
    expect(formatOutSince('2026-08-20', TODAY)).toBe('Out ~3 days');
    expect(formatOutSince('2026-08-23', TODAY)).toBe('Reported today');
  });

  it('builds a tooltip with out-since and back-in lines', () => {
    const tip = injuryTooltip({
      tag: 'Q',
      status: 'Questionable',
      injury: 'Knee - ACL (Surgery)',
      injuryDate: '2026-08-20',
      returnDate: '2026-08-28'
    });
    expect(tip).toContain('Knee - ACL (Surgery)');
    expect(tip).toContain('Out since Aug 20');
    expect(tip).toContain('Expected back Aug 28, 2026');
    expect(tip).toContain('Back in ~5 days');
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
