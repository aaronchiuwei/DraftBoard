import { openAccounts, signOut, useAuth, type SyncStatus } from '../state/auth';
import { AuthForm } from './AuthForm';
import styles from './AccountPanel.module.css';

const SYNC_TEXT: Record<SyncStatus, string> = {
  idle: 'Saved on this device',
  syncing: 'Syncing…',
  synced: 'Saved to your account',
  offline: 'Offline — this device is up to date and will sync when you reconnect',
  error: 'Could not reach the cloud. Your draft is safe on this device.'
};

export function AccountPanel() {
  const auth = useAuth();

  if (auth.status === 'signedIn') {
    return (
      <div>
        <div class={styles.who}>{auth.email ?? 'Signed in'}</div>
        <div class={`${styles.sync} ${auth.sync === 'error' ? styles.bad : ''}`}>
          {auth.configured ? SYNC_TEXT[auth.sync] : SYNC_TEXT.idle}
        </div>
        <button class={styles.button} onClick={() => void signOut()}>
          Sign out
        </button>
        <p class={styles.text}>
          Signing out leaves this account's draft where it is and returns this device to the
          local one it had before.
        </p>
      </div>
    );
  }

  if (auth.configured) {
    return (
      <div>
        <p class={styles.text}>
          This device is storing the draft locally. Sign in to pick it up on another one.
        </p>
        <button class={styles.button} onClick={openAccounts}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div>
      <p class={styles.text}>
        Each account keeps its own league, queue, flags, and picks on this device.
      </p>
      <AuthForm />
    </div>
  );
}
