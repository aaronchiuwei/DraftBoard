import { useState } from 'preact/hooks';
import type { AppState } from '../types';
import { matchRows, parseRankingText, slugifySourceId } from '../data/import';
import { nextImportColor } from '../data/sources';
import { selectPool } from '../state/selectors';
import { addImportedSource, removeImportedSource, toggleSourceEnabled } from '../state/app';
import styles from './SourcesPanel.module.css';

interface Summary {
  ok: boolean;
  matched: number;
  unmatched: string[];
  duplicates: number;
}

const PLACEHOLDER = `Paste a ranking. Any of these work:

1,Jahmyr Gibbs
2,Bijan Robinson

rank,player,pos,team
1,Jahmyr Gibbs,RB,DET

Jahmyr Gibbs
Bijan Robinson`;

export function SourcesPanel({ state }: { state: AppState }) {
  const pool = selectPool(state);
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);

  const disabled = new Set(state.disabledSources);
  const canImport = label.trim().length > 0 && text.trim().length > 0;

  function runImport() {
    const rows = parseRankingText(text);
    if (rows.length === 0) {
      setSummary({ ok: false, matched: 0, unmatched: [], duplicates: 0 });
      return;
    }

    const result = matchRows(rows, pool.players);
    if (result.matched.length === 0) {
      setSummary({ ok: false, matched: 0, unmatched: rows.slice(0, 8).map(r => r.name), duplicates: 0 });
      return;
    }

    const trimmed = label.trim();
    let id = slugifySourceId(trimmed);
    // an id collision would silently overwrite an existing column
    const taken = new Set(pool.sources.map(s => s.id));
    if (taken.has(id)) {
      let n = 2;
      while (taken.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }

    addImportedSource({
      meta: {
        id,
        label: trimmed,
        short: trimmed.slice(0, 5).toUpperCase(),
        format: 'Imported',
        color: nextImportColor(state.imported.length),
        origin: 'imported',
        importedAt: new Date().toISOString()
      },
      ranks: result.ranks
    });

    setSummary({
      ok: true,
      matched: result.matched.length,
      unmatched: result.unmatched.map(r => r.name),
      duplicates: result.duplicates.length
    });
    setLabel('');
    setText('');
  }

  return (
    <>
      <div class={styles.list}>
        {pool.sources.map(source => {
          const off = disabled.has(source.id);
          return (
            <div key={source.id} class={`${styles.source} ${off ? styles.off : ''}`}>
              <span class={styles.swatch} style={{ background: source.color }} />
              <span class={styles.info}>
                <div class={styles.name}>{source.label}</div>
                <div class={styles.detail}>
                  {source.format}
                  {source.origin === 'imported' && ' · imported'}
                </div>
              </span>
              <button
                class={styles.action}
                aria-label={`${off ? 'Use' : 'Mute'} ${source.label}`}
                onClick={() => toggleSourceEnabled(source.id)}
              >
                {off ? 'Use' : 'Mute'}
              </button>
              {source.origin === 'imported' && (
                <button
                  class={`${styles.action} ${styles.remove}`}
                  aria-label={`Delete ${source.label}`}
                  onClick={() => removeImportedSource(source.id)}
                >
                  Delete
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div class={styles.importBox}>
        <input
          type="text"
          placeholder="Name this ranking, e.g. FantasyPros Sept"
          value={label}
          maxLength={24}
          onInput={e => setLabel((e.target as HTMLInputElement).value)}
        />
        <textarea
          placeholder={PLACEHOLDER}
          value={text}
          spellcheck={false}
          onInput={e => setText((e.target as HTMLTextAreaElement).value)}
        />
        <div class={styles.row}>
          <button class={styles.go} disabled={!canImport} onClick={runImport}>
            Import ranking
          </button>
          {(text || summary) && (
            <button
              class={styles.ghost}
              onClick={() => {
                setText('');
                setSummary(null);
              }}
            >
              Clear
            </button>
          )}
        </div>

        {summary && (
          <div class={`${styles.result} ${summary.ok ? '' : styles.error}`}>
            {summary.ok ? (
              <>
                Matched <b>{summary.matched}</b> players.
                {summary.duplicates > 0 && ` ${summary.duplicates} duplicate rows skipped.`}
                {summary.unmatched.length > 0 && (
                  <>
                    {' '}
                    <b>{summary.unmatched.length}</b> names did not match anyone in the pool:
                    <ul>
                      {summary.unmatched.slice(0, 12).map(n => (
                        <li key={n}>{n}</li>
                      ))}
                      {summary.unmatched.length > 12 && <li>and {summary.unmatched.length - 12} more</li>}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <>Could not read that. Every line needs a player name, optionally with a rank.</>
            )}
          </div>
        )}
      </div>
    </>
  );
}
