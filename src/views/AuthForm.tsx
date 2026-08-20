import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { signIn, signUp, useAuth } from '../state/auth';
import styles from './AuthView.module.css';

interface Props {
  /** Extra actions under the submit button, such as skipping the account. */
  footer?: ComponentChildren;
}

/**
 * Email and password against whichever backend the build is using. The cloud
 * gate and the Setup panel share this so the two screens cannot drift.
 */
export function AuthForm({ footer }: Props) {
  const auth = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const creating = mode === 'up';
  const canSubmit = email.trim().length > 3 && password.length >= 6 && !auth.busy;

  async function submit(event: Event) {
    event.preventDefault();
    if (!canSubmit) return;
    if (creating) await signUp(email, password);
    else await signIn(email, password);
  }

  return (
    <form class={styles.form} onSubmit={submit}>
      <div class={styles.tabs}>
        <button
          type="button"
          class={!creating ? styles.tabOn : undefined}
          onClick={() => setMode('in')}
        >
          Sign in
        </button>
        <button
          type="button"
          class={creating ? styles.tabOn : undefined}
          onClick={() => setMode('up')}
        >
          Create account
        </button>
      </div>

      <label class={styles.field}>
        <span class="eyebrow">Email</span>
        <input
          type="email"
          value={email}
          autocomplete="email"
          autocapitalize="none"
          spellcheck={false}
          placeholder="you@example.com"
          onInput={e => setEmail((e.target as HTMLInputElement).value)}
        />
      </label>

      <label class={styles.field}>
        <span class="eyebrow">Password</span>
        <input
          type="password"
          value={password}
          autocomplete={creating ? 'new-password' : 'current-password'}
          placeholder="At least 6 characters"
          onInput={e => setPassword((e.target as HTMLInputElement).value)}
        />
      </label>

      {auth.error ? <div class={styles.error}>{auth.error}</div> : null}
      {auth.notice ? <div class={styles.notice}>{auth.notice}</div> : null}

      <button type="submit" class={styles.submit} disabled={!canSubmit}>
        {auth.busy ? 'Working…' : creating ? 'Create account' : 'Sign in'}
      </button>

      {footer}
    </form>
  );
}
