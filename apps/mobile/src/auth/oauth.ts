import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { config } from '@/config';
import { jwtSubject } from './jwt';
import { StackAuthError, type StackSession } from './stackClient';

const STACK_BASE = 'https://api.stack-auth.com/api/v1';
/** Neon Auth exige un redirect_uri https → le Worker rebondit vers le schéma natif. */
const REDIRECT_URI = `${config.apiBaseUrl.replace(/\/+$/, '')}/auth/callback`;
const APP_RETURN_URL = 'fixitai://oauth';
/** verifier + state du flux en cours, persistés pour survivre à une recréation de l'app. */
const PENDING_KEY = 'fixit.oauth.pending.v1';

WebBrowser.maybeCompleteAuthSession();

export class OAuthCancelledError extends Error {
  constructor() {
    super('Sign-in was cancelled');
    this.name = 'OAuthCancelledError';
  }
}

/**
 * Flux en cours (en mémoire). Le retour peut arriver par deux chemins selon
 * l'OS / le navigateur :
 * 1. la valeur de retour de `openAuthSessionAsync` (iOS, Custom Tab qui intercepte) ;
 * 2. un deep link `fixitai://oauth?...` capté par la route `app/oauth.tsx` (Android).
 *
 * Sur Android, le navigateur système est un processus séparé : l'app peut être
 * **recréée** pendant que l'utilisateur choisit son compte Google. Dans ce cas
 * l'objet `pending` a disparu → on relit `verifier`/`state` depuis SecureStore
 * (`resolveGoogleRedirect`).
 */
interface PendingOAuth {
  verifier: string;
  state: string;
  resolve: (session: StackSession) => void;
  reject: (err: unknown) => void;
  settled: boolean;
}
let pending: PendingOAuth | null = null;

/**
 * Échange en cours / abouti, indexé par `code`. Garantit qu'un même code n'est
 * envoyé qu'une fois à Stack, même si le retour arrive à la fois par le deep
 * link et par `openAuthSessionAsync` (le code d'autorisation est à usage unique).
 */
const exchanges = new Map<string, Promise<StackSession>>();

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

async function savePending(verifier: string, state: string): Promise<void> {
  await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify({ verifier, state })).catch(
    () => undefined,
  );
}

async function loadPending(): Promise<{ verifier: string; state: string } | null> {
  const raw = await SecureStore.getItemAsync(PENDING_KEY).catch(() => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { verifier?: string; state?: string };
    if (typeof parsed.verifier === 'string' && typeof parsed.state === 'string') {
      return { verifier: parsed.verifier, state: parsed.state };
    }
  } catch {
    /* corps illisible */
  }
  return null;
}

async function clearPending(): Promise<void> {
  pending = null;
  await SecureStore.deleteItemAsync(PENDING_KEY).catch(() => undefined);
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

async function requestToken(code: string, verifier: string): Promise<StackSession> {
  const res = await fetch(`${STACK_BASE}/auth/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.stackProjectId,
      client_secret: config.stackPublishableKey,
      code,
      code_verifier: verifier,
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
 * Termine le flux OAuth à partir de l'URL de redirection
 * (`fixitai://oauth?code=...&state=...`).
 *
 * - Retour « à chaud » : `pending` est encore en mémoire, on résout sa promesse.
 * - Retour « à froid » (app recréée pendant le choix du compte Google) :
 *   `verifier`/`state` sont relus depuis SecureStore et la session est renvoyée
 *   à l'appelant (`AuthProvider.completeGoogleRedirect`) qui la persiste.
 *
 * Idempotent : un même `code` n'est échangé qu'une seule fois.
 * Renvoie `null` quand l'URL ne porte pas de code ou qu'aucun flux n'est connu.
 */
export async function resolveGoogleRedirect(url: string): Promise<StackSession | null> {
  const returned = new URL(url);

  const oauthError = returned.searchParams.get('error');
  if (oauthError) {
    const err = new StackAuthError(
      oauthError,
      returned.searchParams.get('error_description') || 'Google sign-in was rejected',
    );
    settle((p) => p.reject(err));
    await clearPending();
    throw err;
  }

  const code = returned.searchParams.get('code');
  const state = returned.searchParams.get('state');
  if (!code) return null;

  const stored = pending ?? (await loadPending());
  if (!stored) return null; // ni verifier ni state → rien à faire

  if (state && stored.state && state !== stored.state) {
    const err = new StackAuthError(
      'oauth_state_mismatch',
      'Sign-in could not be verified — try again',
    );
    settle((p) => p.reject(err));
    await clearPending();
    throw err;
  }

  let exchange = exchanges.get(code);
  if (!exchange) {
    exchange = requestToken(code, stored.verifier);
    exchanges.set(code, exchange);
  }

  try {
    const session = await exchange;
    settle((p) => p.resolve(session));
    await clearPending();
    return session;
  } catch (err) {
    exchanges.delete(code);
    settle((p) => p.reject(err));
    await clearPending();
    throw err;
  }
}

/**
 * @deprecated Utiliser `resolveGoogleRedirect` (qui renvoie la session).
 * Conservé pour compat : délègue et avale l'erreur (remontée via la promesse
 * de `signInWithGoogle`).
 */
export async function completeGoogleSignIn(url: string): Promise<void> {
  try {
    await resolveGoogleRedirect(url);
  } catch {
    /* remonté via la promesse de signInWithGoogle */
  }
}

/** Flux OAuth Google (code d'autorisation + PKCE) via Neon Auth (Stack). */
export async function signInWithGoogle(): Promise<StackSession> {
  // Un flux déjà en cours : on l'abandonne proprement.
  settle((x) => x.reject(new OAuthCancelledError()));

  const verifier = randomToken(48);
  const challenge = await pkceChallenge(verifier);
  const state = randomToken(16);
  await savePending(verifier, state);

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
      await resolveGoogleRedirect(browser.url).catch(() => undefined);
    } else if (browser.type === 'cancel' || browser.type === 'dismiss') {
      // Sur Android le deep link `fixitai://oauth` peut arriver après la fermeture
      // du navigateur : on laisse à la route `app/oauth.tsx` le temps de conclure
      // (réseau mobile lent inclus) avant d'abandonner.
      setTimeout(() => {
        if (isOAuthPending()) {
          settle((x) => x.reject(new OAuthCancelledError()));
          void clearPending();
        }
      }, 12000);
    }
  } catch (err) {
    settle((x) => x.reject(err));
    await clearPending();
  }

  return result;
}
