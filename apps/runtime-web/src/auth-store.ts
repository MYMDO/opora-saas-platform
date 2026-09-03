/** Клієнтське сховище токена автентифікації (localStorage). */

const TOKEN_KEY = 'opora-auth-token';
const EMAIL_KEY = 'opora-auth-email';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token: string, email: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EMAIL_KEY, email);
  } catch { /* приватний режим */ }
}

export function getEmail(): string | null {
  try { return localStorage.getItem(EMAIL_KEY); } catch { return null; }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
  } catch { /* noop */ }
}

/** Протух або відсутній токен. Перевірка лише для UX-гейту; сервер валідує сам. */
export function isTokenExpired(): boolean {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const body = token?.split('.')[0];
    if (!body) return true;
    const payload = JSON.parse(
      atob(body.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: unknown };
    return typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}
