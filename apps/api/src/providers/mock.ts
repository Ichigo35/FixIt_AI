import { coerceRawDiagnosis, type RawDiagnosis } from '@fixit/shared';
import type { AIProvider, DiagnoseInput } from './types';

/**
 * Provider déterministe, sans réseau. Utilisé pour les tests et en secours
 * quand aucune clé IA n'est configurée. Ne "simule" pas une vraie analyse :
 * renvoie un diagnostic générique explicitement marqué comme tel.
 */
export class MockProvider implements AIProvider {
  readonly name = 'mock';
  readonly model = 'mock-v1';

  async diagnose(input: DiagnoseInput): Promise<RawDiagnosis> {
    const text = `${input.description} ${input.category ?? ''}`.toLowerCase();

    // Un mot-clé dangereux dans la description ressort quand même comme HIGH,
    // pour que le SafetyClassifier ait de quoi travailler dans les tests.
    const dangerous = /(mains|gas|voltage|battery|electric|câble|cable|fuel|brake)/.test(text);

    return coerceRawDiagnosis({
      problem: dangerous
        ? 'Possible hazardous fault — more information needed'
        : 'Likely a common wear-and-tear fault (mock diagnosis)',
      confidence: input.images.length > 0 ? 0.5 : 0.35,
      severity: dangerous ? 'HIGH' : 'LOW',
      difficulty: dangerous ? 'PROFESSIONAL' : 'EASY',
      possibleCauses: dangerous
        ? ['Damaged component', 'Unsafe condition that needs inspection']
        : ['Normal wear', 'Loose or dirty part'],
      recommendedAction: dangerous
        ? 'Do not operate the item. Have it inspected by a qualified professional.'
        : 'Inspect and clean the affected part; replace it if worn.',
      needsProfessional: dangerous,
      hazards: dangerous ? ['unspecified_hazard'] : [],
      estimatedTimeMinutes: dangerous ? null : 20,
      estimatedStepCount: dangerous ? 2 : 4,
      estimatedCost: null,
      tools: dangerous ? [] : ['Screwdriver', 'Flashlight'],
      parts: [],
      partsAvailability: 'unknown',
      riskOfWorseningDamage: dangerous ? 'high' : 'low',
      moreInfoNeeded: [
        'This is a placeholder diagnosis (no AI key configured).',
        'Add a clear photo of the problem and of the model label.',
      ],
    });
  }
}
