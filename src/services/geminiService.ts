import {
  Density,
  DENSITY_MODIFIERS,
  ProcessMode,
  SYSTEM_PROMPTS,
  SYSTEM_PROMPT_OCR,
} from '../constants/prompts';

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function getApiKey(): string {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Chiave API Gemini mancante. Imposta EXPO_PUBLIC_GEMINI_API_KEY nel file .env (vedi .env.example).',
    );
  }
  return apiKey;
}

export async function processText(
  text: string,
  mode: ProcessMode,
  density: Density,
): Promise<string> {
  const apiKey = getApiKey();
  const systemPrompt = `${SYSTEM_PROMPTS[mode]} ${DENSITY_MODIFIERS[density]}`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text }] }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Errore API Gemini (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const resultText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return resultText.trim();
}

export async function extractTextFromImage(base64: string, mimeType: string): Promise<string> {
  const apiKey = getApiKey();

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: SYSTEM_PROMPT_OCR }, { inlineData: { mimeType, data: base64 } }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Errore API Gemini (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const resultText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return resultText.trim();
}
