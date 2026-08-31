import { coerceRawDiagnosis, type RawDiagnosis } from '@fixit/shared';
import { GEMINI_RESPONSE_SCHEMA } from './geminiSchema';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt';
import { AIProviderError, type AIProvider, type DiagnoseInput } from './types';

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';

  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async diagnose(input: DiagnoseInput): Promise<RawDiagnosis> {
    const parts: GeminiPart[] = [{ text: buildUserPrompt(input) }];
    for (const img of input.images) {
      parts.push({ inline_data: { mime_type: img.contentType, data: toBase64(img.data) } });
    }

    const raw = await this.call(parts);
    try {
      return coerceRawDiagnosis(JSON.parse(raw));
    } catch (err) {
      // Une tentative de réparation en renvoyant l'erreur au modèle.
      const repairParts: GeminiPart[] = [
        ...parts,
        {
          text: `Your previous JSON was invalid (${(err as Error).message}). Return a corrected JSON object matching the schema exactly. Previous output:\n${raw}`,
        },
      ];
      const repaired = await this.call(repairParts);
      try {
        return coerceRawDiagnosis(JSON.parse(repaired));
      } catch (err2) {
        throw new AIProviderError(
          'ai_bad_output',
          `Gemini returned invalid JSON twice: ${(err2 as Error).message}`,
        );
      }
    }
  }

  private async call(parts: GeminiPart[]): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${API_ROOT}/${this.model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: GEMINI_RESPONSE_SCHEMA,
          },
        }),
      });
    } catch (err) {
      throw new AIProviderError('ai_request_failed', `Network error calling Gemini: ${String(err)}`);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new AIProviderError(
        'ai_request_failed',
        `Gemini HTTP ${res.status}: ${detail.slice(0, 300)}`,
      );
    }

    const body = (await res.json()) as GeminiResponse;
    if (body.promptFeedback?.blockReason) {
      throw new AIProviderError(
        'ai_bad_output',
        `Gemini blocked the prompt: ${body.promptFeedback.blockReason}`,
      );
    }
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text.trim()) {
      throw new AIProviderError('ai_bad_output', 'Gemini returned an empty response');
    }
    return text;
  }
}
