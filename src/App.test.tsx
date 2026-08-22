// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';

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

/** The full row element, including the controls sitting outside the tap target. */
function rowBox(name: string) {
  return screen.getByText(name).closest('div[class~="row"]');
}

/** Player names in the order the current list renders them. */
function listedNames() {
  return [...document.querySelectorAll('div[class~="row"] span[class~="name"]')].map(
    el => el.textContent
  );
}

/** Row names and pick-line labels in render order, with the lines bracketed. */
function listWithPickLines(): string[] {
  return [
    ...document.querySelectorAll('div[class~="pickTag"], div[class~="row"] span[class~="name"]')
  ].map(el => (el.className.includes('pickTag') ? `[${el.textContent}]` : (el.textContent ?? '')));
}

/** How many players the list shows above your next pick's line. */
function playersAboveFirstPickLine(): number {
  return listWithPickLines().findIndex(text => text.startsWith('['));
}

/** The pick the clock strip is showing, which the board also prints in a cell. */
function onClockLabel(): string | undefined {
  return document.querySelector('div[class~="pickNo"]')?.textContent ?? undefined;
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

/** Queues a player from whatever list is showing, leaving the sheet closed. */
function enqueue(name: string) {
  click(row(name));
  click(button('Add to queue'));
  click(button('Cancel'));
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
    expect(screen.getByText("YOU'RE UP")).toBeTruthy();
    expect(screen.getByText(/Still needs QB, RB×2/)).toBeTruthy();
  });

  it('drafts a player and advances the clock', async () => {
    await startDraft();
    click(row('Jahmyr Gibbs'));
    expect(button('Draft')).toBeTruthy();
    click(button('Draft'));

    expect(screen.getByText('1.02')).toBeTruthy();
    expect(screen.getByText('Team 2')).toBeTruthy();
    expect(screen.queryByText("YOU'RE UP")).toBeNull();
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

describe('player sheet', () => {
  it('shows last season beside this season\'s projection', async () => {
    await startDraft();
    click(row('Jahmyr Gibbs'));

    expect(screen.getByText('2025')).toBeTruthy();
    expect(screen.getByText('2026 proj')).toBeTruthy();
    expect(screen.getByText('PPR PTS')).toBeTruthy();
    // a running back is judged on his receiving work in PPR
    expect(screen.getByText('REC YD')).toBeTruthy();
  });

  it('shows only the stats that mean something for the position', async () => {
    await startDraft();
    click(row('Brandon Aubrey'));

    expect(screen.getByText('FG')).toBeTruthy();
    expect(screen.queryByText('REC YD')).toBeNull();
  });

  it('points the headshot at the portrait for that player', async () => {
    await startDraft();
    click(row('Jahmyr Gibbs'));

    const shot = document.querySelector('img');
    expect(shot?.getAttribute('src')).toContain('sleepercdn.com');
  });

  it('falls back to initials for a team defence, which has no portrait', async () => {
    await startDraft();
    click(row('Houston Texans'));

    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('HT')).toBeTruthy();
    expect(screen.getByText('SACK')).toBeTruthy();
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
    expect(headers).toEqual(['Player', 'NFFC', 'BIG', 'ESPN', 'YHOO', 'SLEEP', 'Gap']);
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

describe('queue', () => {
  it('explains itself before anything is queued', async () => {
    await startDraft();
    click(button('Queue'));
    expect(screen.getByText(/Nothing queued yet/)).toBeTruthy();
  });

  it('queues a player and counts him as available', async () => {
    await startDraft();
    click(row('Jahmyr Gibbs'));
    click(button('Add to queue'));
    // the sheet stays open so the mark can be undone in place
    expect(button('Queued #1')).toBeTruthy();
    click(button('Cancel'));

    // the players list shows his place without leaving the tab
    expect(screen.getByText('Q1')).toBeTruthy();

    click(button('Queue'));
    expect(screen.getByText('1 available')).toBeTruthy();
    expect(screen.getByText('Jahmyr Gibbs')).toBeTruthy();
  });

  it('reorders with the arrows', async () => {
    await startDraft();
    enqueue('Jahmyr Gibbs');
    enqueue('Bijan Robinson');

    click(button('Queue'));
    expect(listedNames()).toEqual(['Jahmyr Gibbs', 'Bijan Robinson']);

    click(button('Move Jahmyr Gibbs down'));
    expect(listedNames()).toEqual(['Bijan Robinson', 'Jahmyr Gibbs']);

    click(button('Move Jahmyr Gibbs up'));
    expect(listedNames()).toEqual(['Jahmyr Gibbs', 'Bijan Robinson']);
  });

  it('removes a player from the queue', async () => {
    await startDraft();
    enqueue('Jahmyr Gibbs');
    click(button('Queue'));
    click(button('Remove Jahmyr Gibbs from queue'));
    expect(screen.getByText(/Nothing queued yet/)).toBeTruthy();
  });

  it('keeps a taken player in place until you clear him', async () => {
    await startDraft();
    enqueue('Jahmyr Gibbs');
    enqueue('Bijan Robinson');
    draft('Jahmyr Gibbs');

    click(button('Queue'));
    // he stays where he was, so putting him back does not cost the ordering
    expect(listedNames()).toEqual(['Jahmyr Gibbs', 'Bijan Robinson']);
    expect(screen.getByText(/gone 1\.01/)).toBeTruthy();
    expect(screen.getByText('1 available · 1 gone')).toBeTruthy();

    click(button('Clear 1 gone'));
    expect(listedNames()).toEqual(['Bijan Robinson']);
  });

  it('surfaces the top of the queue on the clock strip', async () => {
    await startDraft();
    enqueue('Bijan Robinson');
    expect(button('Queue · Bijan Robinson')).toBeTruthy();

    // once he is gone the chip moves on to the next man standing
    enqueue('Jahmyr Gibbs');
    draft('Bijan Robinson');
    expect(button('Queue · Jahmyr Gibbs')).toBeTruthy();
  });

  it('survives a reset of the draft', async () => {
    await startDraft();
    enqueue('Jahmyr Gibbs');
    click(button('Setup'));
    click(button('Reset draft'));
    click(button('Tap again to erase every pick'));

    click(button('Queue'));
    expect(screen.getByText('Jahmyr Gibbs')).toBeTruthy();
  });
});

describe('flagging', () => {
  it('flags a player from the list and unflags him again', async () => {
    await startDraft();
    click(button('Flag Jahmyr Gibbs'));
    expect(rowBox('Jahmyr Gibbs')?.className).toContain('flagged');

    click(button('Unflag Jahmyr Gibbs'));
    expect(rowBox('Jahmyr Gibbs')?.className).not.toContain('flagged');
  });

  it('flags from the player sheet too', async () => {
    await startDraft();
    click(row('Bijan Robinson'));
    click(button('☆ Flag'));
    expect(button('★ Flagged')).toBeTruthy();
    click(button('Cancel'));
    expect(rowBox('Bijan Robinson')?.className).toContain('flagged');
  });

  it('carries the flag onto the depth chart', async () => {
    await startDraft();
    click(button('Flag Patrick Mahomes'));

    click(button('Depth'));
    click(button('KC'));
    expect(rowBox('Patrick Mahomes')?.className).toContain('flagged');
  });
});

describe('depth charts', () => {
  it('opens on a team and switches to another', async () => {
    await startDraft();
    click(button('Depth'));
    expect(screen.getByText('Arizona Cardinals')).toBeTruthy();

    click(button('KC'));
    expect(screen.getByText('Kansas City Chiefs')).toBeTruthy();
    expect(screen.getByText('Patrick Mahomes')).toBeTruthy();
    expect(screen.getByText('Travis Kelce')).toBeTruthy();
  });

  it('lists a position in ESPN order', async () => {
    await startDraft();
    click(button('Depth'));
    click(button('DET'));
    const names = listedNames();
    const goff = names.indexOf('Jared Goff');
    const gibbs = names.indexOf('Jahmyr Gibbs');
    expect(goff).toBeGreaterThan(-1);
    // quarterbacks are charted before running backs, and the starter leads
    expect(goff).toBeLessThan(gibbs);
    expect(names.indexOf('Amon-Ra St. Brown')).toBeGreaterThan(gibbs);
  });

  it('marks a charted player who is already drafted', async () => {
    await startDraft();
    draft('Travis Kelce');

    click(button('Depth'));
    click(button('KC'));
    expect(rowBox('Travis Kelce')?.className).toContain('gone');
  });

  it('drafts straight off the chart', async () => {
    await startDraft();
    click(button('Depth'));
    click(button('KC'));
    click(row('Rashee Rice'));
    click(button('Draft'));

    expect(screen.getByText('1.02')).toBeTruthy();
    click(button('Teams'));
    expect(screen.getByText('Rashee Rice')).toBeTruthy();
  });

  it('remembers the team between visits', async () => {
    await startDraft();
    click(button('Depth'));
    click(button('KC'));
    click(button('Players'));
    click(button('Depth'));
    expect(screen.getByText('Kansas City Chiefs')).toBeTruthy();
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

  it('restores the queue, the flags, and the depth chart team', async () => {
    freshStorage();
    await mountApp();
    click(button('Start draft'));
    enqueue('Jahmyr Gibbs');
    click(button('Flag Bijan Robinson'));
    click(button('Depth'));
    click(button('KC'));

    await remountApp();
    expect(screen.getByText('Kansas City Chiefs')).toBeTruthy();

    click(button('Queue'));
    expect(screen.getByText('Jahmyr Gibbs')).toBeTruthy();

    click(button('Players'));
    expect(rowBox('Bijan Robinson')?.className).toContain('flagged');
  });

  it('loads a draft saved before the queue existed', async () => {
    freshStorage({
      'draftroom.v2': JSON.stringify({
        schema: 2,
        draft: {
          ready: true,
          league: {
            teams: 12,
            rounds: 16,
            mySlot: 0,
            names: [],
            roster: [
              { key: 'QB', count: 1, accepts: ['QB'] },
              { key: 'RB', count: 2, accepts: ['RB'] }
            ]
          },
          picks: [1]
        },
        imported: [],
        disabledSources: [],
        ui: {
          view: 'players',
          source: 'nffc',
          pos: 'ALL',
          hideDrafted: true,
          compareSort: 'spread',
          team: 0
        }
      })
    });
    await mountApp();

    // the in-progress draft is kept, and the new fields start empty
    expect(screen.getByText('1.02')).toBeTruthy();
    click(button('Queue'));
    expect(screen.getByText(/Nothing queued yet/)).toBeTruthy();
    click(button('Depth'));
    expect(screen.getByText('Arizona Cardinals')).toBeTruthy();
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

describe('accounts', () => {
  /** A saved draft for one account slot, or for the device when userId is null. */
  function savedDraft(picks: number[]) {
    return JSON.stringify({
      schema: 4,
      savedAt: Date.now(),
      draft: {
        ready: true,
        league: { teams: 12, rounds: 16, mySlot: 0, names: [], roster: [] },
        picks
      },
      imported: [],
      disabledSources: [],
      queue: [],
      flagged: [],
      ui: {
        view: 'board',
        source: 'nffc',
        pos: 'ALL',
        hideDrafted: true,
        compareSort: 'spread',
        team: 0
      }
    });
  }

  function configureSupabase() {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is invisible when the build has no project configured', async () => {
    freshStorage();
    await mountApp();
    expect(screen.getByText('League setup')).toBeTruthy();
    expect(screen.queryByText(/Continue without an account/)).toBeNull();
  });

  it('asks for an account before the draft when one is configured', async () => {
    configureSupabase();
    freshStorage();
    await mountApp();
    expect(screen.queryByText('League setup')).toBeNull();
  });

  /* The session is confirmed over the network, and a draft room has no network.
     A device that remembers an account has to open that account's draft on its
     own, which is also what keeps the right draft from being replaced on screen. */
  it('opens a remembered account\'s draft without waiting for the network', async () => {
    configureSupabase();
    freshStorage({
      'draftroom.lastUser': 'user-1',
      'draftroom.v2.u.user-1': savedDraft([1, 2, 3, 4, 5]),
      'draftroom.v2': savedDraft([1])
    });
    await mountApp();

    // five picks in, not the one the device-local draft has
    expect(onClockLabel()).toBe('1.06');
  });

  it('keeps a second account on the same device apart', async () => {
    configureSupabase();
    freshStorage({
      'draftroom.lastUser': 'user-2',
      'draftroom.v2.u.user-1': savedDraft([1, 2, 3, 4, 5]),
      'draftroom.v2.u.user-2': savedDraft([1, 2])
    });
    await mountApp();

    expect(onClockLabel()).toBe('1.03');
  });
});

describe('local accounts', () => {
  async function fillCredentials(email: string, password: string) {
    fireEvent.input(screen.getByPlaceholderText('you@example.com'), { target: { value: email } });
    fireEvent.input(screen.getByPlaceholderText('At least 6 characters'), {
      target: { value: password }
    });
  }

  async function createAccount(email: string, password: string) {
    click(screen.getAllByRole('button', { name: 'Create account' })[0]);
    await fillCredentials(email, password);
    const submits = screen.getAllByRole('button', { name: 'Create account' });
    click(submits[submits.length - 1]);
    await waitFor(() => expect(screen.getByText(email)).toBeTruthy());
  }

  it('keeps two accounts on one device apart', async () => {
    freshStorage();
    await mountApp();
    await createAccount('a@test.com', 'secret1');

    click(button('Start draft'));
    draft('Jahmyr Gibbs');
    expect(onClockLabel()).toBe('1.02');

    click(button('Setup'));
    click(button('Sign out'));
    await waitFor(() => expect(screen.getByPlaceholderText('you@example.com')).toBeTruthy());

    await createAccount('b@test.com', 'secret2');
    click(button('Start draft'));
    expect(onClockLabel()).toBe('1.01');
    expect(screen.getByText('Jahmyr Gibbs')).toBeTruthy();

    click(button('Setup'));
    click(button('Sign out'));
    await waitFor(() => expect(screen.getByPlaceholderText('you@example.com')).toBeTruthy());

    await fillCredentials('a@test.com', 'secret1');
    click(
      screen.getAllByRole('button', { name: 'Sign in' })[
        screen.getAllByRole('button', { name: 'Sign in' }).length - 1
      ]
    );
    await waitFor(() => expect(screen.queryByPlaceholderText('you@example.com')).toBeNull());

    click(button('Players'));
    expect(onClockLabel()).toBe('1.02');
    expect(screen.queryByText('Jahmyr Gibbs')).toBeNull();
  });

  it('rejects a wrong password', async () => {
    freshStorage();
    await mountApp();
    await createAccount('a@test.com', 'secret1');
    click(button('Sign out'));
    await waitFor(() => expect(screen.getByPlaceholderText('you@example.com')).toBeTruthy());

    await fillCredentials('a@test.com', 'nope!!');
    click(screen.getAllByRole('button', { name: 'Sign in' })[screen.getAllByRole('button', { name: 'Sign in' }).length - 1]);
    await waitFor(() =>
      expect(screen.getByText('That email and password do not match.')).toBeTruthy()
    );
  });
});

describe('your pick line', () => {
  /** Boots straight into a running 12-team draft from a given slot. */
  async function draftFromSlot(slot: number, picks: number[] = []) {
    freshStorage({
      'draftroom.v2': JSON.stringify({
        schema: 4,
        draft: {
          ready: true,
          league: { teams: 12, rounds: 16, mySlot: slot, names: [], roster: [] },
          picks
        },
        imported: [],
        disabledSources: [],
        queue: [],
        flagged: [],
        ui: {
          view: 'players',
          source: 'nffc',
          pos: 'ALL',
          hideDrafted: true,
          compareSort: 'spread',
          team: 0
        }
      })
    });
    await mountApp();
  }

  it('draws the 8th pick between the 7th and 8th player', async () => {
    await draftFromSlot(7);
    expect(screen.getByText('Your pick · Round 1 · Pick 8')).toBeTruthy();
    expect(playersAboveFirstPickLine()).toBe(7);
  });

  it('labels the second-round pick by where it falls in that round', async () => {
    await draftFromSlot(7);
    // twelve teams snaking back puts slot 8 fifth in the second round
    expect(screen.getByText('Round 2 · Pick 5')).toBeTruthy();
  });

  it('moves the line up as the picks ahead of you come in', async () => {
    await draftFromSlot(7, [1, 2, 3]);
    expect(playersAboveFirstPickLine()).toBe(4);
  });

  it('counts players still on the board, not rows on screen', async () => {
    await draftFromSlot(7, [1, 2, 3]);
    click(button('Hiding taken'));

    // the three taken players are back on screen but no longer count against
    // the pick, so four available players still separate you from the line
    const above = listWithPickLines().slice(0, playersAboveFirstPickLine());
    expect(above).toHaveLength(7);
    expect(above.slice(0, 3)).toEqual(listedNames().slice(0, 3));
  });

  it('says you are on the clock instead of counting nobody', async () => {
    await draftFromSlot(0);
    expect(screen.getByText('On the clock now')).toBeTruthy();
    expect(playersAboveFirstPickLine()).toBe(0);
  });

  it('drops the lines under a position filter, where the count would not hold', async () => {
    await draftFromSlot(7);
    click(button('RB'));
    expect(screen.queryByText('Your pick · Round 1 · Pick 8')).toBeNull();
    expect(screen.queryByText('Round 1 · Pick 8')).toBeNull();
    expect(playersAboveFirstPickLine()).toBe(-1);
  });

  it('drops the lines once the draft is over', async () => {
    freshStorage({
      'draftroom.v2': JSON.stringify({
        schema: 4,
        draft: {
          ready: true,
          league: { teams: 2, rounds: 1, mySlot: 1, names: [], roster: [] },
          picks: [1, 2]
        },
        imported: [],
        disabledSources: [],
        queue: [],
        flagged: [],
        ui: {
          view: 'players',
          source: 'nffc',
          pos: 'ALL',
          hideDrafted: true,
          compareSort: 'spread',
          team: 0
        }
      })
    });
    await mountApp();
    expect(playersAboveFirstPickLine()).toBe(-1);
  });
});
