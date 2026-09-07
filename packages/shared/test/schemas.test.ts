import { describe, expect, it } from 'vitest';
import {
  coerceRawDiagnosis,
  coerceRepairGuide,
  createDiagnosisRequestSchema,
  diagnosisResultSchema,
  MEDIA_CONTENT_TYPES,
  rawDiagnosisSchema,
  uploadRequestSchema,
} from '../src/schemas';

const valid = {
  problem: 'Blocked drain pump filter',
  confidence: 0.82,
  severity: 'LOW',
  difficulty: 'EASY',
  possibleCauses: ['Foreign object in filter', 'Blocked drain hose'],
  recommendedAction: 'Clean the drain filter',
  needsProfessional: false,
  hazards: [],
  tools: ['Towel', 'Shallow tray'],
  parts: [],
  moreInfoNeeded: [],
};

describe('rawDiagnosisSchema', () => {
  it('valide une sortie correcte', () => {
    expect(() => rawDiagnosisSchema.parse(valid)).not.toThrow();
  });

  it('rejette une confidence hors bornes', () => {
    expect(() => rawDiagnosisSchema.parse({ ...valid, confidence: 5 })).toThrow();
  });

  it('rejette une severity inconnue', () => {
    expect(() => rawDiagnosisSchema.parse({ ...valid, severity: 'SEVERE' })).toThrow();
  });

  it('coerceRawDiagnosis normalise confidence en %, severity et difficulty en majuscules', () => {
    const r = coerceRawDiagnosis({ ...valid, confidence: 82, severity: 'low', difficulty: 'easy' });
    expect(r.confidence).toBeCloseTo(0.82);
    expect(r.severity).toBe('LOW');
    expect(r.difficulty).toBe('EASY');
  });

  it('coerceRawDiagnosis applique les valeurs par défaut', () => {
    const r = coerceRawDiagnosis({
      problem: 'x y z',
      confidence: 0.5,
      severity: 'MEDIUM',
      difficulty: 'INTERMEDIATE',
      possibleCauses: ['a'],
      recommendedAction: 'do a',
      needsProfessional: false,
    });
    expect(r.hazards).toEqual([]);
    expect(r.tools).toEqual([]);
    expect(r.moreInfoNeeded).toEqual([]);
    expect(r.partsAvailability).toBe('unknown');
    expect(r.estimatedStepCount).toBe(4);
  });
});

describe('média : photos + vidéo', () => {
  const uuid = '11111111-1111-1111-1111-111111111111';

  it('createDiagnosisRequestSchema accepte videoIds (max 1) et défaut []', () => {
    expect(createDiagnosisRequestSchema.parse({}).videoIds).toEqual([]);
    expect(createDiagnosisRequestSchema.parse({ videoIds: [uuid] }).videoIds).toEqual([uuid]);
    expect(() => createDiagnosisRequestSchema.parse({ videoIds: [uuid, uuid] })).toThrow();
  });

  it('uploadRequestSchema accepte video/mp4 + kind=video, rejette un type inconnu', () => {
    expect(() =>
      uploadRequestSchema.parse({ contentType: 'video/mp4', kind: 'video' }),
    ).not.toThrow();
    expect(() => uploadRequestSchema.parse({ contentType: 'video/avi', kind: 'video' })).toThrow();
  });

  it('createDiagnosisRequestSchema accepte audioIds (max 1) et défaut []', () => {
    expect(createDiagnosisRequestSchema.parse({}).audioIds).toEqual([]);
    expect(createDiagnosisRequestSchema.parse({ audioIds: [uuid] }).audioIds).toEqual([uuid]);
    expect(() => createDiagnosisRequestSchema.parse({ audioIds: [uuid, uuid] })).toThrow();
  });

  it('MEDIA_CONTENT_TYPES contient les types audio et uploadRequestSchema les accepte', () => {
    expect(MEDIA_CONTENT_TYPES).toContain('audio/mp4');
    expect(MEDIA_CONTENT_TYPES).toContain('audio/mpeg');
    expect(() =>
      uploadRequestSchema.parse({ contentType: 'audio/mp4', kind: 'audio' }),
    ).not.toThrow();
  });

  it('diagnosisResultSchema.input : audioIds / serialNumber / errorCode / measurements par défaut', () => {
    const base = {
      id: '11111111-1111-1111-1111-111111111111',
      createdAt: new Date().toISOString(),
      category: null,
      input: { description: 'x', brand: null, model: null, imageIds: [] },
      diagnosis: valid,
      safety: { riskLevel: 'LOW', recommendation: 'DIY', forcedStop: false, reasons: [] },
      repairability: { score: 80, label: 'Easy DIY repair' },
    };
    const parsed = diagnosisResultSchema.parse(base).input;
    expect(parsed.audioIds).toEqual([]);
    expect(parsed.serialNumber).toBeNull();
    expect(parsed.errorCode).toBeNull();
    expect(parsed.measurements).toBeNull();
  });

  it('createDiagnosisRequestSchema accepte errorCode / measurements / serialNumber', () => {
    const r = createDiagnosisRequestSchema.parse({
      errorCode: 'P0300',
      measurements: '12.4 V',
      serialNumber: 'SN123',
    });
    expect(r.errorCode).toBe('P0300');
    expect(r.measurements).toBe('12.4 V');
    expect(r.serialNumber).toBe('SN123');
    expect(() => createDiagnosisRequestSchema.parse({ errorCode: 'x'.repeat(41) })).toThrow();
  });
});

describe('coerceRepairGuide', () => {
  const guide = {
    summary: 'Replace the worn tap cartridge.',
    difficulty: 'intermediate',
    requiredSkill: 'Intermediate',
    estimatedTimeMinutes: 30,
    tools: ['Wrench'],
    parts: [{ name: 'Cartridge', priceKnown: false }],
    steps: [
      { title: 'Shut off water', instruction: 'Close the isolation valves under the sink.' },
      { title: 'Swap cartridge', instruction: 'Remove the retaining nut and replace the cartridge.' },
    ],
  };

  it('normalise la casse et indexe les étapes', () => {
    const r = coerceRepairGuide(guide);
    expect(r.difficulty).toBe('INTERMEDIATE');
    expect(r.requiredSkill).toBe('intermediate');
    expect(r.steps[0]?.index).toBe(0);
    expect(r.steps[1]?.index).toBe(1);
    expect(r.generalWarnings).toEqual([]);
  });

  it('rejette un guide sans étapes', () => {
    expect(() => coerceRepairGuide({ ...guide, steps: [] })).toThrow();
  });

  it('conserve un plan visuel valide', () => {
    const r = coerceRepairGuide({
      ...guide,
      steps: [
        {
          ...guide.steps[0],
          checks: ['Plus une goutte au robinet'],
          estimatedMinutes: 3,
          visual: {
            scene: 'water-off',
            subject: 'les robinets d’arrêt',
            caption: 'Fermer les deux robinets sous l’évier',
            anchors: [{ imageIndex: 0, box: [100, 200, 400, 500], label: 'Robinet' }],
          },
        },
      ],
    });
    expect(r.steps[0]?.visual?.scene).toBe('water-off');
    expect(r.steps[0]?.visual?.anchors).toHaveLength(1);
    expect(r.steps[0]?.checks).toEqual(['Plus une goutte au robinet']);
    expect(r.steps[0]?.estimatedMinutes).toBe(3);
  });

  it('écarte les repères inexploitables sans faire échouer le guide', () => {
    const bad = (anchor: unknown) =>
      coerceRepairGuide({
        ...guide,
        steps: [{ ...guide.steps[0], visual: { scene: 'unscrew', anchors: [anchor] } }],
      }).steps[0]?.visual?.anchors;

    expect(bad({ imageIndex: 0, box: [0, 0, 100], label: 'x' })).toEqual([]); // boîte incomplète
    expect(bad({ imageIndex: 0, box: [0, 0, 1200, 100], label: 'x' })).toEqual([]); // hors bornes
    expect(bad({ imageIndex: 0, box: [50, 50, 50, 50], label: 'x' })).toEqual([]); // dégénérée
    expect(bad({ imageIndex: 0, box: [0, 0, 100, 100] })).toEqual([]); // sans libellé
    expect(bad({ imageIndex: 9, box: [0, 0, 100, 100], label: 'x' })).toEqual([]); // photo absente
  });

  it('accepte un guide sans plan visuel (versions antérieures)', () => {
    const r = coerceRepairGuide(guide);
    expect(r.steps[0]?.visual).toBeNull();
    expect(r.steps[0]?.checks).toEqual([]);
  });
});
