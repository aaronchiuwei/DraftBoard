import { describe, expect, it } from 'vitest';
import type { AppState } from '../types';
import {
  defaultState,
  fromPersisted,
  loadState,
  parsePersisted,
  readLocalAccounts,
  readPersisted,
  savedAtOf,
  saveState,
  storageKey,
  toPersisted,
  writeLocalAccounts
} from './persistence';

function withPicks(picks: number[]): AppState {
  const base = defaultState();
  return { ...base, draft: { ...base.draft, ready: true, picks } };
}

describe('storageKey', () => {
  it('keeps every account in its own slot', () => {
    expect(storageKey(null)).not.toBe(storageKey('abc'));
    expect(storageKey('abc')).not.toBe(storageKey('def'));
  });
});

describe('toPersisted and fromPersisted', () => {
  it('round-trips a draft', () => {
    const state = withPicks([4, 8, 15]);
    const back = fromPersisted(toPersisted(state));
    expect(back?.draft.picks).toEqual([4, 8, 15]);
    expect(back?.draft.ready).toBe(true);
  });

  it('drops the search box and any open sheet', () => {
    const state = withPicks([]);
    state.ui.query = 'gibbs';
    state.ui.sheetPlayerId = 12;
    const back = fromPersisted(toPersisted(state));
    expect(back?.ui.query).toBe('');
    expect(back?.ui.sheetPlayerId).toBeNull();
  });

  it('stamps the write so two devices can be compared', () => {
    const before = Date.now();
    expect(savedAtOf(toPersisted(withPicks([1])))).toBeGreaterThanOrEqual(before);
  });
});

describe('parsePersisted', () => {
  it('reads the object form the cloud returns as well as stored text', () => {
    const payload = toPersisted(withPicks([1, 2]));
    expect(parsePersisted(payload)?.draft.picks).toEqual([1, 2]);
    expect(parsePersisted(JSON.stringify(payload))?.draft.picks).toEqual([1, 2]);
  });

  it('treats junk, the wrong schema, and a missing draft as absent', () => {
    expect(parsePersisted('not json')).toBeNull();
    expect(parsePersisted(null)).toBeNull();
    expect(parsePersisted({ schema: 99, draft: {} })).toBeNull();
    expect(parsePersisted({ schema: 4 })).toBeNull();
  });

  it('reads a payload saved before writes were stamped', () => {
    const { savedAt: _dropped, ...older } = toPersisted(withPicks([3]));
    expect(savedAtOf(parsePersisted(older))).toBe(0);
  });
});

describe('per-account storage', () => {
  it('keeps two accounts on one device apart', () => {
    saveState(withPicks([1, 2, 3]), 'user-a');
    saveState(withPicks([9]), 'user-b');

    expect(loadState('user-a').draft.picks).toEqual([1, 2, 3]);
    expect(loadState('user-b').draft.picks).toEqual([9]);
  });

  it('leaves the device-local draft alone when an account saves', () => {
    saveState(withPicks([5, 6]), null);
    saveState(withPicks([7]), 'user-c');
    expect(loadState(null).draft.picks).toEqual([5, 6]);
  });

  it('starts an account that has never saved from defaults', () => {
    expect(loadState('nobody').draft.ready).toBe(false);
    expect(readPersisted('nobody')).toBeNull();
  });
});

describe('local account list', () => {
  it('round-trips accounts written to storage', () => {
    writeLocalAccounts([
      { id: 'u1', email: 'a@test.com', salt: 'ab', hash: 'cd' }
    ]);
    expect(readLocalAccounts()).toEqual([
      { id: 'u1', email: 'a@test.com', salt: 'ab', hash: 'cd' }
    ]);
  });
});
