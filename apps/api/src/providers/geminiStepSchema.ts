/** `responseSchema` Gemini pour la vérification d'une étape. Compatible `rawStepCheckSchema`. */
export const GEMINI_STEP_CHECK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    verdict: { type: 'STRING', enum: ['pass', 'retry', 'unsafe', 'unclear'] },
    summary: { type: 'STRING' },
    advice: { type: 'ARRAY', items: { type: 'STRING' } },
    escalate: { type: 'BOOLEAN' },
  },
  required: ['verdict', 'summary', 'advice', 'escalate'],
} as const;
