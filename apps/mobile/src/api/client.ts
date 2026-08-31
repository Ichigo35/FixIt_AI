import { config } from '@/config';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ApiError';
  }
}

type Json = Record<string, unknown>;

async function parseError(res: Response): Promise<never> {
  let code = `http_${res.status}`;
  try {
    const body = (await res.json()) as Json;
    if (typeof body.error === 'string') code = body.error;
  } catch {
    // corps non JSON
  }
  throw new ApiError(res.status, code);
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${config.apiBaseUrl}${path}`);
  if (!res.ok) return parseError(res);
  return (await res.json()) as T;
}

export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseError(res);
  return (await res.json()) as T;
}

/** Envoie des octets bruts (upload d'image relayé par le Worker vers R2). */
export async function apiPostBinary<T>(
  path: string,
  data: ArrayBuffer | Blob,
  contentType: string,
): Promise<T> {
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: data,
  });
  if (!res.ok) return parseError(res);
  return (await res.json()) as T;
}
