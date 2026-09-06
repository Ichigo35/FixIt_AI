import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIProviderError } from '../src/providers/types';
import { FailoverGeminiProvider, _resetGeminiCooldowns } from '../src/providers/geminiFailover';

const PRIMARY = 'gemini-3.6-flash';
const FALLBACK = 'gemini-3.5-flash';

const VALID_DIAGNOSIS = {
  problem: 'Worn door seal letting cold air in',
  confidence: 0.6,
  severity: 'LOW',
  difficulty: 'EASY',
  possibleCauses: ['Perished rubber seal'],
  recommendedAction: 'Replace the seal.',
  needsProfessional: false,
  hazards: [],
};

function okResponse(): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_DIAGNOSIS) }] } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function rateLimitedResponse(retryDelay?: string): Response {
  const details = retryDelay
    ? [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay }]
    : [];
  return new Response(
    JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'quota', details } }),
    { status: 429 },
  );
}

function overloadedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: { code: 503, status: 'UNAVAILABLE', message: 'This model is currently experiencing high demand.' },
    }),
    { status: 503 },
  );
}

/** `fetch` factice : route selon le modèle présent dans l'URL. */
function mockFetch(byModel: Record<string, () => Response>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const model = url.includes(PRIMARY) ? PRIMARY : url.includes(FALLBACK) ? FALLBACK : 'unknown';
    const handler = byModel[model];
    if (!handler) throw new Error(`fetch inattendu: ${url}`);
    return handler();
  });
}

const input = { description: 'fridge is warm', images: [] };

/** `CooldownStore` factice (comme un KV) pour tester le partage entre isolates. */
function fakeStore() {
  const map = new Map<string, string>();
  return {
    map,
    get: vi.fn(async (key: string) => {
      const v = map.get(key);
      return v ? (JSON.parse(v) as Record<string, number>) : null;
    }),
    put: vi.fn(async (key: string, value: string) => {
      map.set(key, value);
    }),
  };
}

describe('FailoverGeminiProvider', () => {
  beforeEach(() => {
    _resetGeminiCooldowns();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('bascule sur le modèle de repli quand le préféré renvoie 429', async () => {
    const fetchMock = mockFetch({
      [PRIMARY]: () => rateLimitedResponse('30s'),
      [FALLBACK]: () => okResponse(),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new FailoverGeminiProvider('key', [PRIMARY, FALLBACK]);
    const result = await provider.diagnose(input);

    expect(result.problem).toContain('door seal');
    expect(provider.model).toBe(FALLBACK); // le préféré est en repos
    // le préféré a bien été tenté une fois, puis le repli
    const models = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(models.some((u) => u.includes(PRIMARY))).toBe(true);
    expect(models.some((u) => u.includes(FALLBACK))).toBe(true);
  });

  it('bascule aussi quand le préféré est saturé (503 « high demand »)', async () => {
    const fetchMock = mockFetch({
      [PRIMARY]: () => overloadedResponse(),
      [FALLBACK]: () => okResponse(),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new FailoverGeminiProvider('key', [PRIMARY, FALLBACK]);
    const result = await provider.diagnose(input);

    expect(result.problem).toContain('door seal');
    expect(provider.model).toBe(FALLBACK);
  });

  it('remonte ai_overloaded quand tous les modèles sont saturés', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ [PRIMARY]: () => overloadedResponse(), [FALLBACK]: () => overloadedResponse() }),
    );
    const provider = new FailoverGeminiProvider('key', [PRIMARY, FALLBACK]);
    await expect(provider.diagnose(input)).rejects.toMatchObject({ code: 'ai_overloaded' });
  });

  it('le préféré reste évité pendant le repos puis reprend la main après', async () => {
    let primaryHits = 0;
    const fetchMock = mockFetch({
      [PRIMARY]: () => {
        primaryHits++;
        return primaryHits === 1 ? rateLimitedResponse('30s') : okResponse();
      },
      [FALLBACK]: () => okResponse(),
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new FailoverGeminiProvider('key', [PRIMARY, FALLBACK]);

    await provider.diagnose(input); // 1: préféré 429 -> repli
    expect(primaryHits).toBe(1);

    await provider.diagnose(input); // 2: encore en repos -> repli direct, préféré non retenté
    expect(primaryHits).toBe(1);
    expect(provider.model).toBe(FALLBACK);

    vi.advanceTimersByTime(31_000); // repos écoulé

    await provider.diagnose(input); // 3: préféré réessayé en premier et OK
    expect(primaryHits).toBe(2);
    expect(provider.model).toBe(PRIMARY);
  });

  it('sans RetryInfo, applique le repos par défaut (60 s)', async () => {
    let primaryHits = 0;
    const fetchMock = mockFetch({
      [PRIMARY]: () => {
        primaryHits++;
        return primaryHits === 1 ? rateLimitedResponse() : okResponse();
      },
      [FALLBACK]: () => okResponse(),
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new FailoverGeminiProvider('key', [PRIMARY, FALLBACK]);

    await provider.diagnose(input);
    vi.advanceTimersByTime(45_000);
    await provider.diagnose(input); // encore < 60 s -> repli
    expect(primaryHits).toBe(1);

    vi.advanceTimersByTime(20_000); // > 60 s
    await provider.diagnose(input);
    expect(primaryHits).toBe(2);
  });

  it('si tous les modèles sont en 429, lève ai_rate_limited', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ [PRIMARY]: () => rateLimitedResponse('10s'), [FALLBACK]: () => rateLimitedResponse('10s') }),
    );
    const provider = new FailoverGeminiProvider('key', [PRIMARY, FALLBACK]);

    await expect(provider.diagnose(input)).rejects.toMatchObject({
      name: 'AIProviderError',
      code: 'ai_rate_limited',
    });
  });

  it('une erreur non-429 remonte sans bascule', async () => {
    const fetchMock = mockFetch({
      [PRIMARY]: () => new Response('boom', { status: 500 }),
      [FALLBACK]: () => okResponse(),
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new FailoverGeminiProvider('key', [PRIMARY, FALLBACK]);

    await expect(provider.diagnose(input)).rejects.toMatchObject({ code: 'ai_request_failed' });
    expect(fetchMock.mock.calls.every((c) => String(c[0]).includes(PRIMARY))).toBe(true);
  });

  it('un seul modèle configuré : pas de bascule, 429 -> ai_rate_limited', async () => {
    vi.stubGlobal('fetch', mockFetch({ [PRIMARY]: () => rateLimitedResponse('5s') }));
    const provider = new FailoverGeminiProvider('key', [PRIMARY]);
    await expect(provider.diagnose(input)).rejects.toBeInstanceOf(AIProviderError);
  });

  it('partage le repos entre isolates via le CooldownStore (KV)', async () => {
    const store = fakeStore();
    const fetchMock = mockFetch({
      [PRIMARY]: () => rateLimitedResponse('300s'),
      [FALLBACK]: () => okResponse(),
    });
    vi.stubGlobal('fetch', fetchMock);

    // Isolate A : le préféré 429 -> repos écrit dans le KV.
    const isolateA = new FailoverGeminiProvider('key', [PRIMARY, FALLBACK], store);
    await isolateA.diagnose(input);
    expect(store.put).toHaveBeenCalled();
    const primaryHitsAfterA = fetchMock.mock.calls.filter((c) => String(c[0]).includes(PRIMARY)).length;
    expect(primaryHitsAfterA).toBe(1);

    // Nouvel isolate : cache module remis à zéro, mais le KV garde le repos.
    _resetGeminiCooldowns();
    const isolateB = new FailoverGeminiProvider('key', [PRIMARY, FALLBACK], store);
    const result = await isolateB.diagnose(input);

    expect(result.problem).toContain('door seal');
    expect(isolateB.model).toBe(FALLBACK);
    // Le préféré n'a PAS été retenté par l'isolate B (économie d'une requête 429).
    const primaryHitsAfterB = fetchMock.mock.calls.filter((c) => String(c[0]).includes(PRIMARY)).length;
    expect(primaryHitsAfterB).toBe(1);
  });

});
