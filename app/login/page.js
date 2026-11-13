'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        const next = new URLSearchParams(window.location.search).get('next');
        window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
        return;
      }
      setError(json.message || 'Could not log in. Try again.');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    }
    setBusy(false);
  }

  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="l-eyebrow">{'// PRIVATE'}</div>
        <h1>Creator Mailer</h1>
        <p className="muted">Log in to send creator outreach from your Gmail.</p>

        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="pw-row">
            <input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-pressed={show}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error ? <p className="login-err" role="alert">{error}</p> : null}

        <button className="btn primary block" type="submit" disabled={busy || !username || !password}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <p className="login-foot">Private tool. Access is limited to the account owner.</p>
      </form>
    </main>
  );
}
