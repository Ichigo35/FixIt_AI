import { describe, expect, it } from 'vitest';
import { resolveScene, STEP_SCENES, type RawDiagnosis } from '@fixit/shared';
import { FailoverGeminiProvider } from '../src/providers/geminiFailover';
import { geminiApiKey } from './helpers';

/**
 * Test « live » : parle au vrai Gemini et consomme du quota.
 * Volontairement opt-in — `GEMINI_LIVE_TEST=1 pnpm --filter @fixit/api test`.
 * Vérifie que le plan visuel (`step.visual`) sort bien du modèle avec le
 * `responseSchema` étendu ; jamais joué en CI (aucune clé n’y est posée).
 */
const apiKey = geminiApiKey;
const enabled = process.env.GEMINI_LIVE_TEST === '1' && !!apiKey;

/** Même montage qu'en production : bascule 3.6 -> 3.5 sur quota (429) ou saturation (503). */
const makeProvider = () =>
  new FailoverGeminiProvider(apiKey!, [
    process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
    process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-3.5-flash',
  ]);

describe.runIf(enabled)('Gemini — plan visuel du guide (live)', () => {
  it('remplit visual.scene / caption / checks sur chaque étape', async () => {
    const provider = makeProvider();
    const guide = await provider.generateRepairGuide({
      diagnosis: {
        problem: 'Le lave-linge ne vidange plus, de l’eau stagne dans le tambour',
        confidence: 0.7,
        severity: 'MEDIUM',
        difficulty: 'INTERMEDIATE',
        possibleCauses: ['Filtre de vidange bouché', 'Pompe de vidange bloquée'],
        recommendedAction: 'Nettoyer le filtre de vidange puis vérifier la pompe.',
        needsProfessional: false,
        hazards: ['mains_electricity', 'water'],
        estimatedTimeMinutes: 45,
        estimatedStepCount: 6,
        tools: ['Tournevis plat', 'Bassine', 'Chiffon'],
        parts: [],
        partsAvailability: 'common',
        riskOfWorseningDamage: 'low',
        moreInfoNeeded: [],
      } as RawDiagnosis,
      category: 'appliance',
      description: 'Mon lave-linge ne vidange plus.',
      images: [],
    });

    expect(guide.steps.length).toBeGreaterThan(2);
    for (const step of guide.steps) {
      expect(step.visual, `étape "${step.title}" sans plan visuel`).toBeTruthy();
      expect(STEP_SCENES).toContain(resolveScene(step));
      expect(step.visual?.caption.length ?? 0).toBeGreaterThan(0);
    }
    // Traçable dans la sortie du test pour inspection manuelle.
    console.log(
      guide.steps
        .map((s) => `${s.index + 1}. [${resolveScene(s)}] ${s.title} — ${s.visual?.caption}`)
        .join('\n'),
    );
  }, 90_000);

  it('pose des repères sur la photo jointe', async () => {
    const photo = process.env.GEMINI_LIVE_PHOTO;
    if (!photo) return; // repère = optionnel, dépend d'une photo fournie
    const { readFileSync } = await import('node:fs');
    const bytes = readFileSync(photo);
    const provider = makeProvider();
    const guide = await provider.generateRepairGuide({
      diagnosis: {
        problem: 'Le panneau arrière doit être déposé pour accéder à la pompe',
        confidence: 0.8,
        severity: 'MEDIUM',
        difficulty: 'INTERMEDIATE',
        possibleCauses: ['Pompe de vidange bloquée'],
        recommendedAction: 'Déposer le panneau arrière et vérifier la pompe.',
        needsProfessional: false,
        hazards: ['mains_electricity'],
        estimatedTimeMinutes: 40,
        estimatedStepCount: 5,
        tools: ['Tournevis cruciforme'],
        parts: [],
        partsAvailability: 'common',
        riskOfWorseningDamage: 'low',
        moreInfoNeeded: [],
      } as RawDiagnosis,
      category: 'appliance',
      description: 'Fuite sous le lave-linge, je dois ouvrir le panneau arrière.',
      images: [
        {
          contentType: 'image/jpeg',
          data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        },
      ],
    });

    const anchored = guide.steps.filter((s) => (s.visual?.anchors.length ?? 0) > 0);
    console.log(
      guide.steps
        .map(
          (s) =>
            `${s.index + 1}. [${resolveScene(s)}] ${s.title}` +
            (s.visual?.anchors ?? [])
              .map((a) => ` → « ${a.label} » img${a.imageIndex} [${a.box.join(',')}]`)
              .join(''),
        )
        .join('\n'),
    );
    expect(anchored.length).toBeGreaterThan(0);
    for (const step of anchored) {
      for (const a of step.visual!.anchors) {
        expect(a.imageIndex).toBe(0);
        const [ymin, xmin, ymax, xmax] = a.box;
        expect(ymax).toBeGreaterThan(ymin);
        expect(xmax).toBeGreaterThan(xmin);
      }
    }
  }, 120_000);
});
