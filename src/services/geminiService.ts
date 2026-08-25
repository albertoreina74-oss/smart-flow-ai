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
import { buildCacheKey, getCachedResponse, setCachedResponse } from './responseCacheService';

// Fastest model in the 3.x Flash line confirmed live against this API key
// (`gemini-flash-latest` intermittently fails to connect at all for this
// key/region, so a pinned, verified model is used instead of an alias).
export const GEMINI_MODEL = 'gemini-3.6-flash';
// Tried in order the moment GEMINI_MODEL is unavailable — overloaded
// (503/500), rate-limited or out of quota (429). Each model has its own
// separate free-tier quota bucket, so stacking multiple fallbacks makes it
// far less likely all of them are exhausted at once. The Pro model is the
// last resort: slower, but on a wholly separate quota tier from the Flash
// models, so it's the best chance of succeeding when both Flash models are
// exhausted. Every entry here has been individually confirmed against this
// API key — note `gemini-3.1-pro` does not exist; Google's own API error
// for the deprecated `gemini-2.5-pro` points at `gemini-3.1-pro-preview`
// as its replacement, which is what's used here.
const FALLBACK_MODELS = ['gemini-3.5-flash-lite'];
const PRO_FALLBACK_MODEL = 'gemini-3.1-pro-preview';
const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

function apiUrl(model: string, action: string, apiKey: string): string {
  return `${GEMINI_API_ROOT}/${model}:${action}?key=${apiKey}`;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 500;
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
  // Density ("be concise" / "add detail") doesn't make sense for a
  // structured table extraction — the shape of the source data decides
  // that, not a user preference.
  if (mode === 'table') {
    return SYSTEM_PROMPTS.table;
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
    return raw.includes('PerDay')
      ? 'Hai raggiunto il limite giornaliero gratuito di richieste AI. Riprova domani o aumenta il piano su Google AI Studio.'
      : 'Troppe richieste in questo momento. Attendi qualche secondo e riprova.';
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_429_RETRIES = 2;
const RETRY_BACKOFF_MS = [1000, 2000];

function isDailyQuotaExhausted(message: string): boolean {
  return message.includes('PerDay');
}

/**
 * Calls a single model with resilience against transient failures:
 * - 429 (rate limit): a daily-quota exhaustion won't clear in seconds, so
 *   that escalates to the next model immediately. Anything else (a
 *   per-minute/per-second rate limit) gets up to 2 retries on the *same*
 *   model with a short exponential backoff (1s, then 2s), since those
 *   limits do reset within seconds.
 * - 500/503 (transient overload): one quick same-model retry.
 * - Anything else: fails immediately, no retry.
 */
async function callModelWithRetry(model: string, apiKey: string, body: object): Promise<string> {
  let rateLimitAttempts = 0;
  let overloadAttempts = 0;

  for (;;) {
    try {
      return await fetchGenerateContent(model, apiKey, body);
    } catch (error) {
      if (!(error instanceof GeminiHttpError)) {
        throw error;
      }
      if (error.status === 429) {
        if (isDailyQuotaExhausted(error.message) || rateLimitAttempts >= MAX_429_RETRIES) {
          throw error;
        }
        await sleep(RETRY_BACKOFF_MS[rateLimitAttempts]);
        rateLimitAttempts += 1;
        continue;
      }
      if ((error.status === 500 || error.status === 503) && overloadAttempts === 0) {
        overloadAttempts += 1;
        continue;
      }
      throw error;
    }
  }
}

/**
 * Calls Gemini with resilience across the whole model chain: primary Flash,
 * a secondary Flash (separate quota bucket), then Pro as the final resort
 * (slower, but least likely to already be exhausted). See
 * `callModelWithRetry` for the per-model retry/backoff behavior.
 */
async function generateContentWithResilience(apiKey: string, body: object): Promise<string> {
  const chain = [GEMINI_MODEL, ...FALLBACK_MODELS, PRO_FALLBACK_MODEL];
  let lastError: unknown;

  for (const model of chain) {
    try {
      return await callModelWithRetry(model, apiKey, body);
    } catch (error) {
      lastError = error;
      if (!(error instanceof GeminiHttpError) || !isRetryableStatus(error.status)) {
        throw error;
      }
      // This model is unavailable right now — move straight to the next
      // one in the chain. Each is tried fresh again on the next request.
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
// How long real streaming gets to deliver its first byte before this gives
// up on it and falls back to the proven non-streaming path for this
// request. Protects against the exact hang this app hit before: a real
// HTTP stream whose body reader never resolves in this bundled runtime.
const STREAM_FIRST_CHUNK_TIMEOUT_MS = 6000;

function parseSseTextDelta(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) {
    return null;
  }
  const jsonStr = trimmed.slice(5).trim();
  if (!jsonStr) {
    return null;
  }
  try {
    const parsed = JSON.parse(jsonStr);
    return parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch {
    // Partial/malformed SSE frame split across reads — the remainder is
    // recovered on the next chunk, so this one is just dropped.
    return null;
  }
}

/**
 * Attempts real token streaming (`streamGenerateContent`) against the
 * primary model only, for lowest possible time-to-first-token. Returns
 * `null` (never throws) on any failure — bad status, parse issue, or the
 * first-chunk timeout — so the caller can fall back to the resilient
 * non-streaming path without the user ever seeing a failure.
 */
async function tryRealStream(
  text: string,
  mode: ProcessMode,
  density: Density,
  language: Language,
  onChunk: (fullTextSoFar: string) => void,
  controller: AbortController,
  options?: ProcessOptions,
): Promise<string | null> {
  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch {
    return null;
  }
  const systemPrompt = resolveSystemPrompt(mode, density, language, options?.customPrompt);
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: buildGenerationConfig(options?.temperature),
  };

  let firstChunkReceived = false;
  const timeoutId = setTimeout(() => {
    if (!firstChunkReceived) {
      controller.abort();
    }
  }, STREAM_FIRST_CHUNK_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${GEMINI_API_ROOT}/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );
    if (!response.ok || !response.body) {
      return null;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      if (!firstChunkReceived) {
        firstChunkReceived = true;
        clearTimeout(timeoutId);
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const delta = parseSseTextDelta(line);
        if (delta) {
          full += delta;
          onChunk(full);
        }
      }
    }
    return full;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Streams a completion into the UI. Tries real token streaming first
 * (`tryRealStream`); if that fails or hangs for any reason it transparently
 * falls back to the regular endpoint + a client-side progressive reveal —
 * the same resilient path this app has always used — so a broken or
 * unreliable streaming connection never surfaces as a failure to the user.
 * Identical requests (same text/mode/density/language/prompt) are served
 * from cache without hitting the network at all.
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
  const controller = new AbortController();

  const stopReveal = () => {
    if (revealTimer) {
      clearInterval(revealTimer);
      revealTimer = null;
    }
  };

  const revealProgressively = (finalText: string) => {
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
  };

  const cacheKey = buildCacheKey({
    text: text.trim(),
    mode,
    density,
    language,
    customPrompt: options?.customPrompt,
  });

  (async () => {
    const cached = await getCachedResponse(cacheKey);
    if (cancelled) {
      return;
    }
    if (cached) {
      revealProgressively(cached);
      return;
    }

    const streamed = await tryRealStream(
      text,
      mode,
      density,
      language,
      (partial) => {
        if (!cancelled) {
          callbacks.onChunk(partial);
        }
      },
      controller,
      options,
    );
    if (cancelled) {
      return;
    }
    if (streamed !== null) {
      setCachedResponse(cacheKey, streamed).catch(() => {});
      callbacks.onDone(streamed);
      return;
    }

    try {
      const finalText = await processText(text, mode, density, language, options);
      if (cancelled) {
        return;
      }
      setCachedResponse(cacheKey, finalText).catch(() => {});
      revealProgressively(finalText);
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
      controller.abort();
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
