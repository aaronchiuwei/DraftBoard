// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';

/**
 * Each test gets its own storage backing map so drafts do not leak between
 * them. Storage is resolved at call time rather than captured, so isolation
 * also depends on the afterEach below cancelling the save debounce.
 */
function freshStorage(seed: Record<string, string> = {}) {
  const backing = new Map(Object.entries(seed));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, v),
    removeItem: (k: string) => void backing.delete(k),
    clear: () => backing.clear(),
    key: (i: number) => [...backing.keys()][i] ?? null,
    get length() {
      return backing.size;
    }
  });
  return backing;
}

/** Boots a fresh copy of the app against the storage currently installed. */
async function mountApp() {
  vi.resetModules();
  cleanup();
  document.body.innerHTML = '';
  const { App } = await import('./App');
  render(<App />);
}

/** Reloads the app against the same storage, as closing and reopening would. */
async function remountApp() {
  const { flushSave } = await import('./state/app');
  flushSave();
  await mountApp();
}

function click(el: Element | null | undefined) {
  if (!el) throw new Error('tried to click an element that is not there');
  fireEvent.click(el);
}

function button(name: string | RegExp) {
  return screen.getByRole('button', { name });
}

function row(name: string) {
  return screen.getByText(name).closest('button');
}

/** Boots into a started 12-team draft. */
async function startDraft() {
  freshStorage();
  await mountApp();
  click(button('Start draft'));
}

/** Drafts a player by name from the players list. */
function draft(name: string) {
  click(row(name));
  click(button('Draft'));
}

beforeEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  document.body.innerHTML = '';
});

// flush while this test's module instance is still reachable, so its pending
// debounce cannot fire into the next test's storage
afterEach(async () => {
  const { flushSave } = await import('./state/app');
  flushSave();
});

describe('draft flow', () => {
  it('boots into setup before a league exists', async () => {
    freshStorage();
    await mountApp();
    expect(screen.getByText('League setup')).toBeTruthy();
    expect(screen.getByText(/Set up your league to start/)).toBeTruthy();
  });

  it('starts the draft and puts the first team on the clock', async () => {
    await startDraft();
    expect(screen.getByText('1.01')).toBeTruthy();
    expect(screen.getByText('My Team')).toBeTruthy();
    expect(screen.getByText(/Still needs QB, RB×2/)).toBeTruthy();
  });

  it('drafts a player and advances the clock', async () => {
    await startDraft();
    click(row('Jahmyr Gibbs'));
    expect(button('Draft')).toBeTruthy();
    click(button('Draft'));

    expect(screen.getByText('1.02')).toBeTruthy();
    expect(screen.getByText('Team 2')).toBeTruthy();
    expect(screen.queryByText('Jahmyr Gibbs')).toBeNull();
  });

  it('undoes a pick', async () => {
    await startDraft();
    draft('Jahmyr Gibbs');
    expect(screen.getByText('1.02')).toBeTruthy();

    click(button('Undo'));
    expect(screen.getByText('1.01')).toBeTruthy();
    expect(screen.getByText('Jahmyr Gibbs')).toBeTruthy();
  });

  it('puts a player back from the middle of the draft', async () => {
    await startDraft();
    draft('Jahmyr Gibbs');
    draft('Bijan Robinson');
    expect(screen.getByText('1.03')).toBeTruthy();

    click(button('Hiding taken'));
    click(row('Jahmyr Gibbs'));
    click(button('Put back'));

    // removing an earlier pick pulls every later pick forward
    expect(screen.getByText('1.02')).toBeTruthy();
    expect(screen.getByText('Team 2')).toBeTruthy();
  });

  it('tracks needs as slots fill', async () => {
    await startDraft();
    expect(screen.getByText(/Still needs QB, RB×2, WR×2/)).toBeTruthy();
    draft('Jahmyr Gibbs');
    click(button('Undo'));
    // back on the clock for my team, RB slot open again
    expect(screen.getByText(/Still needs QB, RB×2/)).toBeTruthy();
  });
});

describe('search', () => {
  it('filters without losing focus or caret position', async () => {
    await startDraft();

    const input = screen.getByPlaceholderText('Find a player') as HTMLInputElement;
    input.focus();
    fireEvent.input(input, { target: { value: 'bijan' } });

    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('bijan');
    expect(screen.getByText('Bijan Robinson')).toBeTruthy();
    expect(screen.queryByText('Jahmyr Gibbs')).toBeNull();
  });
});

describe('tabs', () => {
  it('renders the board with the current pick highlighted', async () => {
    await startDraft();
    click(button('Board'));
    expect(screen.getByText('On the clock')).toBeTruthy();
    expect(screen.getByText('RD')).toBeTruthy();
  });

  it('renders an empty lineup on the teams tab', async () => {
    await startDraft();
    click(button('Teams'));
    expect(screen.getByText('Starters — 0 of 10 filled')).toBeTruthy();
    expect(screen.getByText('Nobody on the bench yet')).toBeTruthy();
  });

  it('slots a drafted player into the right starting spot', async () => {
    await startDraft();
    draft('Jahmyr Gibbs');
    click(button('Teams'));
    expect(screen.getByText('Starters — 1 of 10 filled')).toBeTruthy();
    expect(screen.getByText('Jahmyr Gibbs')).toBeTruthy();
  });

  it('renders the compare table with one column per source', async () => {
    await startDraft();
    click(button('Compare'));
    const headers = screen.getAllByRole('columnheader').map(h => h.textContent);
    expect(headers).toEqual(['Player', 'NFFC', 'BIG', 'ESPN', 'YHOO', 'Gap']);
  });
});

describe('imported rankings', () => {
  it('adds a source that then appears everywhere a source can appear', async () => {
    await startDraft();
    click(button('Setup'));

    fireEvent.input(screen.getByPlaceholderText(/Name this ranking/), {
      target: { value: 'MyADP' }
    });
    fireEvent.input(screen.getByPlaceholderText(/Paste a ranking/), {
      target: { value: "Bijan Robinson\nJa'Marr Chase\nTexans D/ST\nNot A Real Guy" }
    });
    click(button('Import ranking'));

    expect(screen.getByText(/Matched/)).toBeTruthy();
    expect(screen.getByText('Not A Real Guy')).toBeTruthy();

    click(button('Players'));
    expect(button('MYADP')).toBeTruthy();

    click(button('Compare'));
    const headers = screen.getAllByRole('columnheader').map(h => h.textContent);
    expect(headers).toContain('MYADP');
  });

  it('sorts the player list by an imported ranking', async () => {
    await startDraft();
    click(button('Setup'));
    fireEvent.input(screen.getByPlaceholderText(/Name this ranking/), {
      target: { value: 'MyADP' }
    });
    fireEvent.input(screen.getByPlaceholderText(/Paste a ranking/), {
      target: { value: 'Bijan Robinson\nJahmyr Gibbs' }
    });
    click(button('Import ranking'));

    click(button('Players'));
    click(button('MYADP'));
    // only the two imported players are ranked by this source, Bijan first
    const names = screen.getAllByRole('button').map(b => b.textContent ?? '');
    const bijan = names.findIndex(t => t.includes('Bijan Robinson'));
    const gibbs = names.findIndex(t => t.includes('Jahmyr Gibbs'));
    expect(bijan).toBeGreaterThan(-1);
    expect(bijan).toBeLessThan(gibbs);
  });

  it('muting a source removes it from the compare table', async () => {
    await startDraft();
    click(button('Setup'));
    click(button('Mute ESPN'));

    click(button('Compare'));
    const headers = screen.getAllByRole('columnheader').map(h => h.textContent);
    expect(headers).not.toContain('ESPN');
  });
});

describe('reset', () => {
  it('needs two taps and keeps the league intact', async () => {
    await startDraft();
    draft('Jahmyr Gibbs');
    click(button('Setup'));

    click(button('Reset draft'));
    expect(screen.getByText('Tap again to erase every pick')).toBeTruthy();

    click(button('Tap again to erase every pick'));
    expect(screen.getByText(/Erases all 0 picks/)).toBeTruthy();
    expect((screen.getByDisplayValue('My Team') as HTMLInputElement).value).toBe('My Team');
  });
});

describe('persistence', () => {
  it('restores a draft in progress from storage', async () => {
    freshStorage();
    await mountApp();
    click(button('Start draft'));
    draft('Jahmyr Gibbs');

    await remountApp();
    expect(screen.getByText('1.02')).toBeTruthy();
    expect(screen.getByText('Team 2')).toBeTruthy();
  });

  it('migrates a draft saved by the original single-file version', async () => {
    freshStorage({
      'draftroom.v1': JSON.stringify({
        ready: true,
        teams: 10,
        rounds: 15,
        me: 3,
        names: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
        picks: [1, 2, 3]
      })
    });
    await mountApp();

    // three picks into a 10-team league puts the clock at 1.04, on team D
    expect(screen.getByText('1.04')).toBeTruthy();
    expect(screen.getByText('D')).toBeTruthy();

    // the three picks went to teams A, B and C, one each
    click(button('Teams'));
    expect(screen.getByText('Starters — 1 of 10 filled')).toBeTruthy();
  });
});
