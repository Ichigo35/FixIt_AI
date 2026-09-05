import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from '@/lib/fetchTimeout';

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('renvoie la réponse quand fetch répond avant le délai', async () => {
    const response = new Response('ok');
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchWithTimeout('https://example.test', {}, 1000);
    expect(result).toBe(response);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it("abandonne (signal aborted) quand fetch ne répond jamais avant le délai", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const pending = fetchWithTimeout('https://example.test', {}, 1000);
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});
