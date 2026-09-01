import { config } from '@/config';
import { ApiError } from './ApiError';

export { ApiError };

/** Pont vers l'auth : renseigné par AuthProvider au montage. */
export const authBridge: {
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
  onSignedOut: () => void;
} = {
  getAccessToken: () => null,
  refresh: async () => null,
  onSignedOut: () => undefined,
};

type Body = string | ArrayBuffer | Blob | undefined;

async function request(path: string, method: string, contentType: string, body: Body): Promise<Response> {
  const url = `${config.apiBaseUrl}${path}`;
  const send = (token: string | null) =>
    fetch(url, {
      method,
      headers: {
        ...(contentType ? { 'content-type': contentType } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body,
    });

  let res = await send(authBridge.getAccessToken());
  if (res.status === 401) {
    const fresh = await authBridge.refresh();
    if (fresh) {
      res = await send(fresh);
      if (res.status === 401) authBridge.onSignedOut();
    } else {
      authBridge.onSignedOut();
    }
  }
  return res;
}

async function parseError(res: Response): Promise<never> {
  let code = `http_${res.status}`;
  try {
    const body = (await res.json()) as { error?: string };
    if (typeof body.error === 'string') code = body.error;
  } catch {
    /* corps non JSON */
  }
  throw new ApiError(res.status, code);
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await request(path, 'GET', '', undefined);
  if (!res.ok) return parseError(res);
  return (await res.json()) as T;
}

export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  const res = await request(path, 'POST', 'application/json', JSON.stringify(body));
  if (!res.ok) return parseError(res);
  return (await res.json()) as T;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await request(path, 'DELETE', '', undefined);
  if (!res.ok && res.status !== 204) return parseError(res);
}

export async function apiPostBinary<T>(
  path: string,
  data: ArrayBuffer | Blob,
  contentType: string,
): Promise<T> {
  const res = await request(path, 'POST', contentType, data);
  if (!res.ok) return parseError(res);
  return (await res.json()) as T;
}
