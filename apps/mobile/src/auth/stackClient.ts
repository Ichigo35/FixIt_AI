import { config } from '@/config';
import { fetchWithTimeout } from '@/lib/fetchTimeout';

const BASE = 'https://api.stack-auth.com/api/v1';
/** Stack Auth répond en général en <1 s ; au-delà, on abandonne plutôt que de geler l'écran. */
const AUTH_TIMEOUT_MS = 15_000;

function headers(): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-stack-access-type': 'client',
    'x-stack-project-id': config.stackProjectId,
    'x-stack-publishable-client-key': config.stackPublishableKey,
  };
}

export interface StackSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

export { StackAuthError, isDefinitiveAuthFailure } from './authError';
import { StackAuthError } from './authError';

async function readError(res: Response): Promise<never> {
  let code = `http_${res.status}`;
  let message = 'Authentication failed';
  try {
    const body = (await res.json()) as { code?: string; error?: string };
    if (body.code) code = body.code;
    if (body.error) message = body.error;
  } catch {
    /* noop */
  }
  throw new StackAuthError(code, message, res.status);
}

export async function signUp(email: string, password: string): Promise<StackSession> {
  const res = await fetchWithTimeout(
    `${BASE}/auth/password/sign-up`,
    { method: 'POST', headers: headers(), body: JSON.stringify({ email, password }) },
    AUTH_TIMEOUT_MS,
  );
  if (!res.ok) return readError(res);
  const body = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    user_id: string;
  };
  return { accessToken: body.access_token, refreshToken: body.refresh_token, userId: body.user_id };
}

export async function signIn(email: string, password: string): Promise<StackSession> {
  const res = await fetchWithTimeout(
    `${BASE}/auth/password/sign-in`,
    { method: 'POST', headers: headers(), body: JSON.stringify({ email, password }) },
    AUTH_TIMEOUT_MS,
  );
  if (!res.ok) return readError(res);
  const body = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    user_id: string;
  };
  return { accessToken: body.access_token, refreshToken: body.refresh_token, userId: body.user_id };
}

/** Échange le refresh token contre un nouvel access token. */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetchWithTimeout(
    `${BASE}/auth/sessions/current/refresh`,
    { method: 'POST', headers: { ...headers(), 'x-stack-refresh-token': refreshToken } },
    AUTH_TIMEOUT_MS,
  );
  if (!res.ok) return readError(res);
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

export async function signOutStack(refreshToken: string): Promise<void> {
  await fetchWithTimeout(
    `${BASE}/auth/sessions/current`,
    { method: 'DELETE', headers: { ...headers(), 'x-stack-refresh-token': refreshToken } },
    AUTH_TIMEOUT_MS,
  ).catch(() => undefined);
}
