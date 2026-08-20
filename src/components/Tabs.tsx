import type { ViewId } from '../types';
import styles from './Tabs.module.css';

const TABS: { id: ViewId; label: string }[] = [
  { id: 'players', label: 'Players' },
  { id: 'queue', label: 'Queue' },
  { id: 'compare', label: 'Compare' },
  { id: 'board', label: 'Board' },
  { id: 'teams', label: 'Teams' },
  { id: 'depth', label: 'Depth' },
  { id: 'setup', label: 'Setup' }
];

interface Props {
  current: ViewId;
  onChange: (view: ViewId) => void;
}

export function Tabs({ current, onChange }: Props) {
  return (
    <nav class={styles.tabs}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          class={current === tab.id ? styles.on : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
