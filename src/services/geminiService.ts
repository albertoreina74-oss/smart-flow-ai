import {
  buildTranslatePrompt,
  Density,
  DENSITY_MODIFIERS,
  Language,
  ProcessMode,
  SYSTEM_PROMPTS,
  SYSTEM_PROMPT_DOCUMENT,
  SYSTEM_PROMPT_OCR,
} from '../constants/prompts';

export const GEMINI_MODEL = 'gemini-flash-latest';
// Used only as an automatic fallback when GEMINI_MODEL is transiently
// overloaded (503) or rate-limited (429) — confirmed working for this key.
const FALLBACK_MODEL = 'gemini-3.6-flash';
const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
const RETRY_DELAY_MS = 1200;

function apiUrl(model: string, action: string, apiKey: string): string {
  return `${GEMINI_API_ROOT}/${model}:${action}?key=${apiKey}`;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ProcessOptions = {
  customPrompt?: string;
  temperature?: number;
};

function getApiKey(): string {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Chiave API Gemini mancante. Imposta EXPO_PUBLIC_GEMINI_API_KEY nel file .env (vedi .env.example).',
    );
  }
  return apiKey;
}

function resolveSystemPrompt(
  mode: ProcessMode,
  density: Density,
  language: Language,
  customPrompt?: string,
): string {
  if (customPrompt) {
    return customPrompt;
  }
  if (mode === 'translate') {
    return buildTranslatePrompt(language);
  }
  return `${SYSTEM_PROMPTS[mode]} ${DENSITY_MODIFIERS[density]}`;
}

function buildGenerationConfig(temperature?: number) {
  return temperature === undefined ? undefined : { temperature };
}

/** Turns a raw error (often a JSON blob from the API) into a short, user-facing message. */
export function getFriendlyErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('Chiave API Gemini mancante')) {
    return raw;
  }
  if (raw.includes('(404)')) {
    return 'Il modello AI richiesto non è al momento disponibile. Riprova più tardi.';
  }
  if (raw.includes('(429)')) {
    return 'Troppe richieste in questo momento. Attendi qualche secondo e riprova.';
  }
  if (raw.includes('(401)') || raw.includes('(403)')) {
    return 'Chiave API non valida o priva dei permessi necessari.';
  }
  if (raw.includes('(500)') || raw.includes('(503)')) {
    return 'Il servizio AI ha riscontrato un problema temporaneo. Riprova tra poco.';
  }
  if (/network|failed to fetch/i.test(raw)) {
    return 'Connessione assente o instabile. Controlla la rete e riprova.';
  }
  return 'Si è verificato un errore imprevisto durante l\'elaborazione. Riprova.';
}

class GeminiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function fetchGenerateContent(model: string, apiKey: string, body: object): Promise<string> {
  const response = await fetch(apiUrl(model, 'generateContent', apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new GeminiHttpError(response.status, `Errore API Gemini (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const resultText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return resultText.trim();
}

/**
 * Calls Gemini with resilience against transient overload: retries the
 * primary model once after a short delay, then falls back to a secondary
 * model if the primary is still failing with a retryable (429/500/503)
 * status. Non-retryable errors (auth, bad request, ...) fail immediately.
 */
async function generateContentWithResilience(apiKey: string, body: object): Promise<string> {
  const attempts: { model: string; delayBeforeMs: number }[] = [
    { model: GEMINI_MODEL, delayBeforeMs: 0 },
    { model: GEMINI_MODEL, delayBeforeMs: RETRY_DELAY_MS },
    { model: FALLBACK_MODEL, delayBeforeMs: 0 },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    if (attempt.delayBeforeMs) {
      await delay(attempt.delayBeforeMs);
    }
    try {
      return await fetchGenerateContent(attempt.model, apiKey, body);
    } catch (error) {
      lastError = error;
      if (!(error instanceof GeminiHttpError) || !isRetryableStatus(error.status)) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function processText(
  text: string,
  mode: ProcessMode,
  density: Density,
  language: Language,
  options?: ProcessOptions,
): Promise<string> {
  const apiKey = getApiKey();
  const systemPrompt = resolveSystemPrompt(mode, density, language, options?.customPrompt);

  return generateContentWithResilience(apiKey, {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: buildGenerationConfig(options?.temperature),
  });
}

export type StreamHandle = { cancel: () => void };

type StreamCallbacks = {
  onChunk: (fullTextSoFar: string) => void;
  onDone: (finalText: string) => void;
  onError: (error: Error) => void;
};

const REVEAL_CHUNK_SIZE = 3;
const REVEAL_INTERVAL_MS = 16;

/**
 * "Streams" a completion into the UI. True HTTP streaming
 * (`streamGenerateContent` + a fetch ReadableStream reader) was tried first,
 * but proved unreliable in this app's bundled runtime: the request itself
 * never resolved, even though the identical call succeeds when made outside
 * the bundle. Rather than ship a feature that can silently hang forever, this
 * calls the regular (non-streaming) endpoint — the same one `processText`
 * uses successfully everywhere else in the app — and reveals the returned
 * text progressively on the client, giving the same real-time-typing UX
 * without depending on fragile network streaming.
 */
export function streamProcessText(
  text: string,
  mode: ProcessMode,
  density: Density,
  language: Language,
  callbacks: StreamCallbacks,
  options?: ProcessOptions,
): StreamHandle {
  let cancelled = false;
  let revealTimer: ReturnType<typeof setInterval> | null = null;

  const stopReveal = () => {
    if (revealTimer) {
      clearInterval(revealTimer);
      revealTimer = null;
    }
  };

  (async () => {
    try {
      const finalText = await processText(text, mode, density, language, options);
      if (cancelled) {
        return;
      }
      if (!finalText) {
        callbacks.onDone('');
        return;
      }

      let revealedLength = 0;
      revealTimer = setInterval(() => {
        if (cancelled) {
          stopReveal();
          return;
        }
        revealedLength = Math.min(revealedLength + REVEAL_CHUNK_SIZE, finalText.length);
        callbacks.onChunk(finalText.slice(0, revealedLength));
        if (revealedLength >= finalText.length) {
          stopReveal();
          callbacks.onDone(finalText);
        }
      }, REVEAL_INTERVAL_MS);
    } catch (error) {
      if (cancelled) {
        return;
      }
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return {
    cancel: () => {
      cancelled = true;
      stopReveal();
    },
  };
}

async function extractTextFromInlineData(promptText: string, base64: string, mimeType: string): Promise<string> {
  const apiKey = getApiKey();

  return generateContentWithResilience(apiKey, {
    contents: [
      {
        role: 'user',
        parts: [{ text: promptText }, { inlineData: { mimeType, data: base64 } }],
      },
    ],
  });
}

export async function extractTextFromImage(base64: string, mimeType: string): Promise<string> {
  return extractTextFromInlineData(SYSTEM_PROMPT_OCR, base64, mimeType);
}

export async function extractTextFromDocument(base64: string, mimeType: string): Promise<string> {
  return extractTextFromInlineData(SYSTEM_PROMPT_DOCUMENT, base64, mimeType);
}
