import {
  coerceRawDiagnosis,
  coerceRawStepCheck,
  coerceRepairGuide,
  type RawDiagnosis,
  type RawStepCheck,
  type RepairGuide,
} from '@fixit/shared';
import { GEMINI_REPAIR_SCHEMA } from './geminiRepairSchema';
import { GEMINI_RESPONSE_SCHEMA } from './geminiSchema';
import { GEMINI_STEP_CHECK_SCHEMA } from './geminiStepSchema';
import {
  buildRepairGuidePrompt,
  buildStepCheckPrompt,
  buildUserPrompt,
  REPAIR_SYSTEM_PROMPT,
  STEP_CHECK_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
} from './prompt';
import {
  AIProviderError,
  type AIProvider,
  type DiagnoseInput,
  type RepairGuideInput,
  type VerifyStepInput,
} from './types';

/** Repos court après un 503 « high demand » : la saturation est passagère. */
const OVERLOAD_COOLDOWN_MS = 20_000;

/**
 * Au-delà de ce seuil, un média part par l'API Files plutôt qu'en base64 inline
 * (la requête `generateContent` totale est plafonnée à ~20 Mo par Gemini). Un
 * clip audio de diagnostic (~30 s AAC ≈ 0,5 Mo) reste toujours inline en pratique.
 */
const INLINE_MEDIA_MAX_BYTES = 18 * 1024 * 1024;

const API_HOST = 'https://generativelanguage.googleapis.com';
const API_ROOT = `${API_HOST}/v1beta/models`;
const FILES_UPLOAD = `${API_HOST}/upload/v1beta/files`;

/**
 * Extrait le délai conseillé (`RetryInfo.retryDelay`, ex. `"41s"` / `"1.5s"`) du
 * corps d'erreur Gemini. Renvoie des millisecondes, ou `undefined` si absent.
 */
function parseRetryAfterMs(body: string): number | undefined {
  const m = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (!m) return undefined;
  const seconds = Number(m[1]);
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : undefined;
}

/**
 * Récupère un objet JSON d'une réponse Gemini légèrement mal formée **sans
 * dépenser de requête** : retire un éventuel bloc ```` ```json ```` et tronque à
 * la première `{` … dernière `}`. `responseSchema` rend la sortie propre la
 * plupart du temps ; ceci rattrape juste le cas où le modèle l'a enrobée.
 */
function salvageJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1]! : raw).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start >= 0 && end > start) return body.slice(start, end + 1);
  return body;
}

/** Ne garde que les parts texte (pour le retry « réparation JSON » : inutile de renvoyer les images). */
function textOnlyParts(parts: GeminiPart[]): GeminiPart[] {
  return parts.filter((p) => p.text !== undefined && !p.inline_data && !p.file_data);
}

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
  file_data?: { mime_type: string; file_uri: string };
}

interface GeminiFile {
  name: string;
  uri: string;
  mimeType?: string;
  state?: 'PROCESSING' | 'ACTIVE' | 'FAILED';
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
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
    // Les vidéos passent par l'API Files (trop lourdes pour l'inline base64).
    const uploaded: string[] = [];
    for (const video of input.videos ?? []) {
      const file = await this.uploadAndWaitFile(video.data, video.contentType, 'diagnosis-clip');
      uploaded.push(file.name);
      parts.push({ file_data: { mime_type: file.mimeType ?? video.contentType, file_uri: file.uri } });
    }
    // Les clips audio sont courts : inline base64 comme les images. Repli API
    // Files seulement si un clip dépasse le plafond de requête inline.
    for (const audio of input.audios ?? []) {
      if (audio.data.byteLength <= INLINE_MEDIA_MAX_BYTES) {
        parts.push({ inline_data: { mime_type: audio.contentType, data: toBase64(audio.data) } });
      } else {
        const file = await this.uploadAndWaitFile(audio.data, audio.contentType, 'diagnosis-audio');
        uploaded.push(file.name);
        parts.push({ file_data: { mime_type: file.mimeType ?? audio.contentType, file_uri: file.uri } });
      }
    }
    try {
      return await this.structured(SYSTEM_PROMPT, GEMINI_RESPONSE_SCHEMA, parts, coerceRawDiagnosis);
    } finally {
      // Nettoyage best-effort (Gemini purge de toute façon les fichiers après 48 h).
      await Promise.all(uploaded.map((name) => this.deleteFile(name).catch(() => undefined)));
    }
  }

  /**
   * Upload d'un média (vidéo ou gros clip audio) via l'API Files (protocole resumable
   * documenté) puis attente de l'état ACTIVE. 1) start -> renvoie une upload URL ;
   * 2) upload+finalize -> renvoie le File.
   */
  private async uploadAndWaitFile(
    data: ArrayBuffer,
    contentType: string,
    displayName: string,
  ): Promise<GeminiFile> {
    const numBytes = data.byteLength;

    let start: Response;
    try {
      start = await fetch(FILES_UPLOAD, {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.apiKey,
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(numBytes),
          'X-Goog-Upload-Header-Content-Type': contentType,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ file: { display_name: displayName } }),
      });
    } catch (err) {
      throw new AIProviderError('ai_request_failed', `Network error starting Gemini upload: ${String(err)}`);
    }
    if (!start.ok) {
      const detail = await start.text().catch(() => '');
      if (start.status === 429) {
        throw new AIProviderError(
          'ai_rate_limited',
          `Gemini Files API quota/rate limit (HTTP 429): ${detail.slice(0, 300)}`,
          { retryAfterMs: parseRetryAfterMs(detail) },
        );
      }
      throw new AIProviderError('ai_request_failed', `Gemini upload start HTTP ${start.status}: ${detail.slice(0, 300)}`);
    }
    const uploadUrl = start.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      throw new AIProviderError('ai_request_failed', 'Gemini upload start returned no upload URL');
    }

    let res: Response;
    try {
      res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'content-length': String(numBytes),
          'X-Goog-Upload-Offset': '0',
          'X-Goog-Upload-Command': 'upload, finalize',
        },
        body: data,
      });
    } catch (err) {
      throw new AIProviderError('ai_request_failed', `Network error uploading media to Gemini: ${String(err)}`);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new AIProviderError('ai_request_failed', `Gemini file upload HTTP ${res.status}: ${detail.slice(0, 300)}`);
    }
    const { file } = (await res.json()) as { file?: GeminiFile };
    if (!file?.name || !file.uri) {
      throw new AIProviderError('ai_bad_output', 'Gemini file upload returned no file reference');
    }

    // Polling : un média court est traité en quelques secondes.
    let current = file;
    for (let i = 0; i < 20 && current.state !== 'ACTIVE'; i++) {
      if (current.state === 'FAILED') {
        throw new AIProviderError('ai_request_failed', 'Gemini failed to process the media file');
      }
      await new Promise((r) => setTimeout(r, 1500));
      current = await this.getFile(file.name);
    }
    if (current.state !== 'ACTIVE') {
      throw new AIProviderError('ai_request_failed', 'Gemini media processing timed out');
    }
    return current;
  }

  private async getFile(name: string): Promise<GeminiFile> {
    const res = await fetch(`${API_HOST}/v1beta/${name}`, {
      headers: { 'x-goog-api-key': this.apiKey },
    });
    if (!res.ok) {
      throw new AIProviderError('ai_request_failed', `Gemini get-file HTTP ${res.status}`);
    }
    return (await res.json()) as GeminiFile;
  }

  private async deleteFile(name: string): Promise<void> {
    await fetch(`${API_HOST}/v1beta/${name}`, {
      method: 'DELETE',
      headers: { 'x-goog-api-key': this.apiKey },
    });
  }

  async generateRepairGuide(input: RepairGuideInput): Promise<RepairGuide> {
    const parts: GeminiPart[] = [{ text: buildRepairGuidePrompt(input) }];
    // Les photos partent dans CE même appel : les repères visuels par étape ne
    // coûtent donc aucune requête supplémentaire (juste des tokens d'entrée).
    for (const img of input.images ?? []) {
      parts.push({ inline_data: { mime_type: img.contentType, data: toBase64(img.data) } });
    }
    return this.structured(REPAIR_SYSTEM_PROMPT, GEMINI_REPAIR_SCHEMA, parts, coerceRepairGuide);
  }

  async verifyStep(input: VerifyStepInput): Promise<RawStepCheck> {
    const parts: GeminiPart[] = [
      { text: buildStepCheckPrompt(input) },
      { inline_data: { mime_type: input.image.contentType, data: toBase64(input.image.data) } },
    ];
    return this.structured(
      STEP_CHECK_SYSTEM_PROMPT,
      GEMINI_STEP_CHECK_SCHEMA,
      parts,
      coerceRawStepCheck,
    );
  }

  /** Appel avec sortie JSON contrainte + 1 tentative de réparation. */
  private async structured<T>(
    systemPrompt: string,
    schema: unknown,
    parts: GeminiPart[],
    coerce: (raw: unknown) => T,
  ): Promise<T> {
    const first = await this.call(systemPrompt, schema, parts);
    let firstErr: Error;
    try {
      return coerce(JSON.parse(first));
    } catch (err) {
      firstErr = err as Error;
    }
    // 1) Récupération locale (0 requête) : le modèle a peut-être enrobé le JSON.
    try {
      return coerce(JSON.parse(salvageJson(first)));
    } catch {
      /* on tente une vraie réparation */
    }
    // 2) Réparation : requête **texte seul** — le modèle corrige sa propre
    //    syntaxe, il n'a pas besoin qu'on lui renvoie les images (économie de
    //    tokens d'entrée, donc de quota).
    const repaired = await this.call(systemPrompt, schema, [
      ...textOnlyParts(parts),
      {
        text: `Your previous JSON was invalid (${firstErr.message}). Return a corrected JSON object matching the schema exactly. Previous output:\n${first}`,
      },
    ]);
    try {
      return coerce(JSON.parse(salvageJson(repaired)));
    } catch (err2) {
      throw new AIProviderError(
        'ai_bad_output',
        `Gemini returned invalid JSON twice: ${(err2 as Error).message}`,
      );
    }
  }

  private async call(systemPrompt: string, schema: unknown, parts: GeminiPart[]): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${API_ROOT}/${this.model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: schema,
          },
        }),
      });
    } catch (err) {
      throw new AIProviderError('ai_request_failed', `Network error calling Gemini: ${String(err)}`);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      if (res.status === 429) {
        throw new AIProviderError(
          'ai_rate_limited',
          `Gemini ${this.model} quota/rate limit (HTTP 429): ${detail.slice(0, 300)}`,
          { retryAfterMs: parseRetryAfterMs(detail) },
        );
      }
      if (res.status === 503) {
        // « High demand » : passager. Traité comme un 429 côté bascule de modèle.
        throw new AIProviderError(
          'ai_overloaded',
          `Gemini ${this.model} saturé (HTTP 503): ${detail.slice(0, 300)}`,
          { retryAfterMs: OVERLOAD_COOLDOWN_MS },
        );
      }
      throw new AIProviderError('ai_request_failed', `Gemini HTTP ${res.status}: ${detail.slice(0, 300)}`);
    }

    const body = (await res.json()) as GeminiResponse;
    if (body.promptFeedback?.blockReason) {
      throw new AIProviderError('ai_bad_output', `Gemini blocked the prompt: ${body.promptFeedback.blockReason}`);
    }
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text.trim()) throw new AIProviderError('ai_bad_output', 'Gemini returned an empty response');
    return text;
  }
}
