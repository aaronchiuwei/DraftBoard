import { useEffect, useRef } from 'preact/hooks';
import type { ViewId } from './types';
import { Clock } from './components/Clock';
import { Tabs } from './components/Tabs';
import { PlayerSheet } from './components/PlayerSheet';
import { PlayersView } from './views/PlayersView';
import { QueueView } from './views/QueueView';
import { CompareView } from './views/CompareView';
import { BoardView } from './views/BoardView';
import { TeamsView } from './views/TeamsView';
import { DepthView } from './views/DepthView';
import { SetupView } from './views/SetupView';
import { AuthView } from './views/AuthView';
import { setView, useApp } from './state/app';
import { useAuth } from './state/auth';
import styles from './App.module.css';

export function App() {
  const state = useApp();
  const auth = useAuth();
  const main = useRef<HTMLDivElement>(null);
  const view = state.ui.view;

  // switching tabs should land at the top of the new one, not halfway down it
  useEffect(() => {
    if (main.current) main.current.scrollTop = 0;
  }, [view]);

  function onTab(next: ViewId) {
    setView(next);
  }

  if (auth.status !== 'signedIn') {
    return <AuthView />;
  }

  return (
    <div class={styles.app}>
      <Clock state={state} />
      <div class={styles.main} ref={main}>
        {view === 'players' && <PlayersView state={state} />}
        {view === 'queue' && <QueueView state={state} />}
        {view === 'compare' && <CompareView state={state} />}
        {view === 'board' && <BoardView state={state} />}
        {view === 'teams' && <TeamsView state={state} />}
        {view === 'depth' && <DepthView state={state} />}
        {view === 'setup' && <SetupView state={state} />}
      </div>
      <Tabs current={view} onChange={onTab} />
      <PlayerSheet state={state} />
    </div>
  );
}
