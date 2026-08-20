import { continueLocally, useAuth } from '../state/auth';
import { AuthForm } from './AuthForm';
import styles from './AuthView.module.css';

/**
 * Shown over the app until an account is chosen, but never a wall: the whole
 * point of the thing is that it works in a room with no signal, and an account
 * is about carrying a draft between devices, not about permission to draft.
 */
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
          Sign in to keep your league, queue, and picks on every device you draft from.
        </p>
        <AuthForm
          footer={
            <>
              <button type="button" class={styles.skip} onClick={continueLocally}>
                Continue without an account
              </button>
              <p class={styles.footnote}>
                Without one, the draft stays on this device only — which is all you need if you
                draft from one phone.
              </p>
            </>
          }
        />
      </div>
    </div>
  );
}
