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
      returnDate: '2026-08-28',
      espn: { tag: 'Q', status: 'Questionable' },
      sleeper: { tag: 'Q', status: 'Questionable' },
      agree: true
    });
    expect(tip).toContain('Knee - ACL (Surgery)');
    expect(tip).toContain('Out since Aug 20');
    expect(tip).toContain('Expected back Aug 28, 2026 (ESPN)');
    expect(tip).toContain('Back in ~5 days');
  });

  it('shows a cross-reference line when ESPN and Sleeper disagree', () => {
    const tip = injuryTooltip({
      tag: 'PUP',
      status: 'PUP',
      injury: 'Achilles (Surgery)',
      espn: { tag: 'OUT', status: 'Out', injury: 'Achilles (Surgery)' },
      sleeper: { tag: 'PUP', status: 'PUP', injury: 'Achilles (Surgery)' },
      agree: false
    });
    expect(tip).toContain('ESPN · OUT');
    expect(tip).toContain('Sleeper · PUP');
  });

  it('looks up merged injuries by name', () => {
    const kittle = injuryForName('George Kittle', 'SF');
    expect(kittle?.tag).toBe('PUP');
    expect(kittle?.agree).toBe(false);
  });

  it('expands depth-chart tags into reports', () => {
    expect(reportFromTag('IR').status).toBe('Injured Reserve');
    expect(reportFromTag('PS').status).toBe('Practice Squad');
  });
});
