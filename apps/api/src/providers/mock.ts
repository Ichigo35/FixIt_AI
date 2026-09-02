import {
  coerceRawDiagnosis,
  coerceRawStepCheck,
  coerceRepairGuide,
  skillForDifficulty,
  type RawDiagnosis,
  type RawStepCheck,
  type RepairGuide,
} from '@fixit/shared';
import type { AIProvider, DiagnoseInput, RepairGuideInput, VerifyStepInput } from './types';

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

    const hasMedia = input.images.length > 0 || (input.videos?.length ?? 0) > 0;

    return coerceRawDiagnosis({
      problem: dangerous
        ? 'Possible hazardous fault — more information needed'
        : 'Likely a common wear-and-tear fault (mock diagnosis)',
      confidence: hasMedia ? 0.5 : 0.35,
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

  async verifyStep(input: VerifyStepInput): Promise<RawStepCheck> {
    const note = (input.note ?? '').toLowerCase();
    const unsafe = /(spark|smoke|burn|shock|bare wire|exposed wire|gas|swollen|melt)/.test(note);
    const retry = /(not|n't|cannot|can not|stuck|won't|wrong|broke|help|unsure|loose|gap)/.test(note);

    if (unsafe) {
      return coerceRawStepCheck({
        verdict: 'unsafe',
        summary: 'Your note mentions a possible hazard — stop and get a professional (mock check).',
        advice: ['Disconnect all power and do not continue.', 'Contact a qualified professional.'],
        escalate: true,
      });
    }
    if (retry || input.image.data.byteLength === 0) {
      return coerceRawStepCheck({
        verdict: 'retry',
        summary: `This step may not be complete yet: ${input.step.title} (mock check).`,
        advice: ['Re-read the step instruction and adjust.', 'Take a clear, well-lit photo and check again.'],
      });
    }
    return coerceRawStepCheck({
      verdict: 'pass',
      summary: `Looks done: ${input.step.title} (mock check — configure an AI key for a real one).`,
      advice: [],
    });
  }

  async generateRepairGuide(input: RepairGuideInput): Promise<RepairGuide> {
    const d = input.diagnosis;
    return coerceRepairGuide({
      summary: `Placeholder guide for: ${d.problem} (no AI key configured).`,
      difficulty: d.difficulty,
      estimatedTimeMinutes: d.estimatedTimeMinutes ?? 30,
      requiredSkill: skillForDifficulty(d.difficulty),
      tools: d.tools.length ? d.tools : ['Screwdriver', 'Flashlight'],
      parts: d.parts,
      optional: ['Work gloves', 'Small parts tray'],
      generalWarnings: ['This is a placeholder guide — configure an AI key for a real one.'],
      steps: [
        {
          index: 0,
          title: 'Make the item safe',
          instruction:
            'Disconnect the item from any power, water or gas supply and let it cool before starting.',
          safetyWarning: 'Do not work on the item while it is connected to mains power.',
          tools: [],
          parts: [],
        },
        {
          index: 1,
          title: 'Inspect the affected area',
          instruction: `Look closely at the area related to: ${d.problem}. Note anything worn, loose or broken.`,
          tools: ['Flashlight'],
          parts: [],
        },
        {
          index: 2,
          title: 'Repair or replace',
          instruction: d.recommendedAction,
          tools: [],
          parts: d.parts.map((p) => p.name),
        },
        {
          index: 3,
          title: 'Reassemble and test',
          instruction:
            'Put everything back together, reconnect the supply and check that the problem is resolved.',
          tools: [],
          parts: [],
        },
      ],
    });
  }
}
