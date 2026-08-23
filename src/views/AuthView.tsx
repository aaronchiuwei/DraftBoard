import { useAuth } from '../state/auth';
import { AuthForm } from './AuthForm';
import styles from './AuthView.module.css';

/** Gate: the app only opens once an account is signed in. */
export function AuthView() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return (
      <div class={styles.scrim}>
        <div class={styles.card}>
          <div class={styles.title}>Draft Room</div>
          <p class={styles.blurb}>Checking your session…</p>
        </div>
      </div>
    );
  }

  return (
    <div class={styles.scrim}>
      <div class={styles.card}>
        <div class={styles.title}>Draft Room</div>
        <p class={styles.blurb}>
          Sign in to open your league, queue, and picks. Your draft stays on this device and
          syncs when you are online.
        </p>
        <AuthForm />
      </div>
    </div>
  );
}
