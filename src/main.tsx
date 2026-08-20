import { render } from 'preact';
import { App } from './App';
import { flushSave } from './state/app';
import { requestPersistentStorage } from './state/persistence';
import './styles/global.css';

const root = document.getElementById('app');
if (!root) throw new Error('#app mount point is missing from index.html');

render(<App />, root);

void requestPersistentStorage();

// a phone being locked or the app being swapped away is the common case, and
// pagehide is the only lifecycle event iOS reliably fires for it
addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave();
});
