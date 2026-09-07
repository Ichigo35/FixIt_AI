import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/ApiError';
import { friendlyError, isRetryable } from '@/lib/errors';

describe('friendlyError', () => {
  it('mappe les codes API connus vers une phrase lisible', () => {
    expect(friendlyError(new ApiError(502, 'ai_request_failed'), 'diagnosis')).toMatch(
      /AI service is unavailable/i,
    );
    expect(friendlyError(new ApiError(429, 'quota_exceeded'), 'diagnosis')).toMatch(
      /free diagnoses this month/i,
    );
    expect(friendlyError(new ApiError(413, 'payload_too_large'), 'upload')).toMatch(/too large/i);
    expect(friendlyError(new ApiError(400, 'need_description_for_audio'), 'diagnosis')).toMatch(
      /noise happens/i,
    );
  });

  it('applique la retouche par contexte quand elle existe', () => {
    expect(friendlyError(new ApiError(404, 'not_found'), 'repairGuide')).toMatch(
      /cannot build a guide/i,
    );
    // sans contexte spécifique → message générique du code
    expect(friendlyError(new ApiError(404, 'not_found'), 'diagnosis')).toMatch(
      /no longer exists/i,
    );
  });

  it('code inconnu → message générique avec le code', () => {
    expect(friendlyError(new ApiError(400, 'weird_code'))).toBe('Something went wrong (weird_code).');
  });

  it('erreur non-API → message réseau, ou fallback de contexte', () => {
    expect(friendlyError(new Error('boom'))).toMatch(/network error/i);
    expect(friendlyError(new Error('boom'), 'list')).toMatch(/couldn't load your repairs/i);
  });
});

describe('isRetryable', () => {
  it('vrai pour réseau, 5xx, IA, stockage', () => {
    expect(isRetryable(new Error('offline'))).toBe(true);
    expect(isRetryable(new ApiError(500, 'internal_error'))).toBe(true);
    expect(isRetryable(new ApiError(502, 'ai_request_failed'))).toBe(true);
    expect(isRetryable(new ApiError(503, 'storage_unavailable'))).toBe(true);
  });

  it('faux pour les erreurs client définitives', () => {
    expect(isRetryable(new ApiError(404, 'not_found'))).toBe(false);
    expect(isRetryable(new ApiError(409, 'guide_unavailable'))).toBe(false);
    expect(isRetryable(new ApiError(429, 'quota_exceeded'))).toBe(false);
  });
});
