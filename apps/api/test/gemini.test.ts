import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiProvider } from '../src/providers/gemini';

/** Diagnostic minimal accepté par `coerceRawDiagnosis`. */
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

function gen(text: string): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

const input = { description: 'fridge is warm', images: [] };

describe('GeminiProvider — récupération JSON économe en quota', () => {
  afterEach(() => vi.restoreAllMocks());

  it('récupère un JSON enrobé dans un bloc ```json sans dépenser de 2e requête', async () => {
    const fetchMock = vi.fn(async () => gen('```json\n' + JSON.stringify(VALID_DIAGNOSIS) + '\n```'));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GeminiProvider('key', 'gemini-x');
    const result = await provider.diagnose(input);

    expect(result.problem).toContain('door seal');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('récupère un JSON précédé de prose sans 2e requête', async () => {
    const fetchMock = vi.fn(async () =>
      gen('Sure! Here is the object:\n' + JSON.stringify(VALID_DIAGNOSIS)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GeminiProvider('key', 'gemini-x');
    await provider.diagnose(input);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('quand la réparation est nécessaire, la 2e requête ne renvoie PAS les images', async () => {
    let call = 0;
    const fetchMock = vi.fn(async (_url: unknown, init: { body: string }) => {
      call += 1;
      if (call === 1) return gen('not json at all — the model rambled');
      const body = JSON.parse(init.body) as { contents: { parts: { inline_data?: unknown }[] }[] };
      const parts = body.contents[0]!.parts;
      // Économie de tokens : aucune image ne doit repartir dans l'appel de réparation.
      expect(parts.some((p) => p.inline_data !== undefined)).toBe(false);
      return gen(JSON.stringify(VALID_DIAGNOSIS));
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GeminiProvider('key', 'gemini-x');
    const result = await provider.diagnose({
      description: 'fridge is warm',
      images: [{ contentType: 'image/jpeg', data: new ArrayBuffer(16) }],
    });

    expect(result.problem).toContain('door seal');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('deux sorties irrécupérables ⇒ ai_bad_output (2 requêtes, pas plus)', async () => {
    const fetchMock = vi.fn(async () => gen('still nonsense'));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GeminiProvider('key', 'gemini-x');
    await expect(provider.diagnose(input)).rejects.toMatchObject({ code: 'ai_bad_output' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
