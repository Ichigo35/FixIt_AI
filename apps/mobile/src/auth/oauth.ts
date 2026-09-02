import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { config } from '@/config';
import { jwtSubject } from './jwt';
import { StackAuthError, type StackSession } from './stackClient';

const STACK_BASE = 'https://api.stack-auth.com/api/v1';
/** Neon Auth exige un redirect_uri https → le Worker rebondit vers le schéma natif. */
const REDIRECT_URI = `${config.apiBaseUrl.replace(/\/+$/, '')}/auth/callback`;
const APP_RETURN_URL = 'fixitai://oauth';

WebBrowser.maybeCompleteAuthSession();

export class OAuthCancelledError extends Error {
  constructor() {
    super('Sign-in was cancelled');
    this.name = 'OAuthCancelledError';
  }
}

/**
 * Flux en cours. Le retour peut arriver par deux chemins selon l'OS / le navigateur :
 * 1. la valeur de retour de `openAuthSessionAsync` (iOS, Custom Tabs qui intercepte) ;
 * 2. un deep link `fixitai://oauth?...` capté par la route `app/oauth.tsx` (Android).
 * On garde donc l'état ici et on résout le premier qui aboutit.
 */
interface PendingOAuth {
  verifier: string;
  state: string;
  resolve: (session: StackSession) => void;
  reject: (err: unknown) => void;
  settled: boolean;
}
let pending: PendingOAuth | null = null;

function base64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomToken(bytes = 48): string {
  return base64Url(Crypto.getRandomBytes(bytes));
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function settle(fn: (p: PendingOAuth) => void): void {
  if (!pending || pending.settled) return;
  const p = pending;
  p.settled = true;
  pending = null;
  fn(p);
}

/** `true` si un flux Google est en attente d'un retour (deep link ou navigateur). */
export function isOAuthPending(): boolean {
  return pending !== null && !pending.settled;
}

async function exchangeCode(url: string, p: PendingOAuth): Promise<StackSession> {
  const returned = new URL(url);
  const oauthError = returned.searchParams.get('error');
  if (oauthError) {
    throw new StackAuthError(
      oauthError,
      returned.searchParams.get('error_description') || 'Google sign-in was rejected',
    );
  }
  const code = returned.searchParams.get('code');
  if (!code) throw new StackAuthError('oauth_no_code', 'No authorization code returned');
  if (returned.searchParams.get('state') !== p.state) {
    throw new StackAuthError('oauth_state_mismatch', 'Sign-in could not be verified — try again');
  }

  const res = await fetch(`${STACK_BASE}/auth/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.stackProjectId,
      client_secret: config.stackPublishableKey,
      code,
      code_verifier: p.verifier,
      redirect_uri: REDIRECT_URI,
    }).toString(),
  });

  if (!res.ok) {
    let message = `Google sign-in failed (${res.status})`;
    let apiCode = `http_${res.status}`;
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      if (body.error) message = body.error;
      if (body.code) apiCode = body.code;
    } catch {
      /* corps non JSON */
    }
    throw new StackAuthError(apiCode, message);
  }

  const body = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    user_id?: string;
  };
  const userId = body.user_id ?? jwtSubject(body.access_token);
  if (!userId) throw new StackAuthError('oauth_no_user', 'Sign-in response was incomplete');
  return { accessToken: body.access_token, refreshToken: body.refresh_token, userId };
}

/**
 * Termine le flux à partir de l'URL de redirection (`fixitai://oauth?code=...&state=...`).
 * Appelé par la route `app/oauth.tsx` et par le retour de `openAuthSessionAsync`.
 * Idempotent : ne fait rien si le flux est déjà résolu.
 */
export async function completeGoogleSignIn(url: string): Promise<void> {
  if (!pending || pending.settled) return;
  const p = pending;
  try {
    const session = await exchangeCode(url, p);
    settle((x) => x.resolve(session));
  } catch (err) {
    settle((x) => x.reject(err));
  }
}

/** Flux OAuth Google (code d'autorisation + PKCE) via Neon Auth (Stack). */
export async function signInWithGoogle(): Promise<StackSession> {
  // Un flux déjà en cours : on l'abandonne proprement.
  settle((x) => x.reject(new OAuthCancelledError()));

  const verifier = randomToken(48);
  const challenge = await pkceChallenge(verifier);
  const state = randomToken(16);

  const authUrl = new URL(`${STACK_BASE}/auth/oauth/authorize/google`);
  const q = authUrl.searchParams;
  q.set('client_id', config.stackProjectId);
  q.set('client_secret', config.stackPublishableKey);
  q.set('redirect_uri', REDIRECT_URI);
  q.set('error_redirect_url', REDIRECT_URI);
  q.set('response_type', 'code');
  q.set('grant_type', 'authorization_code');
  q.set('scope', 'legacy');
  q.set('type', 'authenticate');
  q.set('state', state);
  q.set('code_challenge', challenge);
  q.set('code_challenge_method', 'S256');

  const result = new Promise<StackSession>((resolve, reject) => {
    pending = { verifier, state, resolve, reject, settled: false };
  });

  try {
    const browser = await WebBrowser.openAuthSessionAsync(authUrl.toString(), APP_RETURN_URL);
    if (browser.type === 'success' && browser.url) {
      await completeGoogleSignIn(browser.url);
    } else if (browser.type === 'cancel' || browser.type === 'dismiss') {
      // Sur Android le deep link `fixitai://oauth` peut arriver juste après la
      // fermeture du navigateur : on laisse à la route le temps de conclure.
      setTimeout(() => settle((x) => x.reject(new OAuthCancelledError())), 4000);
    }
  } catch (err) {
    settle((x) => x.reject(err));
  }

  return result;
}
