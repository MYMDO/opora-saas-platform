import { useState } from 'react';
import { API_BASE } from './client';

interface Props {
  onAuthenticated(email: string): void;
}

export function LoginForm({ onAuthenticated }: Props) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { token: string; userId: string };
      // Імпортуємо динамічно щоб уникнути circular deps
      const { setToken } = await import('./auth-store');
      setToken(data.token, email.trim());
      onAuthenticated(email.trim());
    } catch (e) {
      setError(String(e).slice(0, 120));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="opora-root" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 32, width: 340,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div>
          <div className="f-display" style={{ fontSize: 20, fontWeight: 700 }}>ОПОРА</div>
          <div className="f-mono" style={{ fontSize: 10, color: 'var(--text-mute)', letterSpacing: '.12em' }}>
            PLATFORM · RUNTIME
          </div>
        </div>

        <label style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
          Email
          <input
            type="email"
            className="input-row"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.ua"
            autoComplete="email"
            autoFocus
            required
          />
        </label>

        <button
          type="submit"
          className="btn btn-solid"
          disabled={!email.trim() || busy}
          style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }}
        >
          {busy ? 'Вхід…' : 'Увійти'}
        </button>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 12.5 }}>{error}</div>
        )}

        <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}>
          Введіть email — токен буде згенеровано автоматично.
          Пароль не потрібен на етапі MVP.
        </div>
      </form>
    </div>
  );
}
