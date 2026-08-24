export type ProcessMode = 'clean' | 'formal' | 'summary' | 'translate';
export type NonTranslateMode = Exclude<ProcessMode, 'translate'>;
export type Density = 'essential' | 'detailed';
export type Language = 'en' | 'es' | 'fr' | 'de' | 'it';

export const MODE_LABELS: Record<ProcessMode, string> = {
  clean: 'Pulisci',
  formal: 'Formale',
  summary: 'Sintesi',
  translate: '🌐 Traduci',
};

export const DENSITY_LABELS: Record<Density, string> = {
  essential: 'Essenziale',
  detailed: 'Dettagliato',
};

export const LANGUAGE_OPTIONS: { id: Language; label: string }[] = [
  { id: 'en', label: '🇬🇧 Inglese' },
  { id: 'es', label: '🇪🇸 Spagnolo' },
  { id: 'fr', label: '🇫🇷 Francese' },
  { id: 'de', label: '🇩🇪 Tedesco' },
  { id: 'it', label: '🇮🇹 Italiano' },
];

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'inglese',
  es: 'spagnolo',
  fr: 'francese',
  de: 'tedesco',
  it: 'italiano',
};

/** BCP-47 locale codes used to pick the system voice for text-to-speech. */
export const LANGUAGE_SPEECH_LOCALES: Record<Language, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
};

export const SYSTEM_PROMPTS: Record<NonTranslateMode, string> = {
  clean: `Correggi solo i refusi di dettatura e la punteggiatura del testo fornito, senza alterarne lo stile, il tono o il significato originale. Restituisci esclusivamente il testo corretto, senza commenti o premesse aggiuntive.`,
  formal: `Rielabora il testo fornito in un italiano formale e professionale, adatto a comunicazioni di lavoro. Mantieni il significato originale. Restituisci esclusivamente il testo rielaborato, senza commenti o premesse aggiuntive.`,
  summary: `Estrai i punti chiave del testo fornito in un elenco puntato essenziale, in italiano. Restituisci esclusivamente l'elenco puntato, senza commenti o premesse aggiuntive.`,
};

export const DENSITY_MODIFIERS: Record<Density, string> = {
  essential: `Sii il più conciso possibile, riducendo il risultato all'essenziale.`,
  detailed: `Fornisci maggiori dettagli e contesto dove utile, senza essere prolisso.`,
};

export function buildTranslatePrompt(language: Language): string {
  return `Traduci fedelmente il testo fornito in ${LANGUAGE_NAMES[language]}, mantenendo il più possibile la formattazione originale (interruzioni di riga, elenchi puntati, paragrafi). Restituisci esclusivamente il testo tradotto, senza commenti o premesse aggiuntive.`;
}

export const SYSTEM_PROMPT_OCR = `Estrai il testo dall'immagine fornita nel modo più fedele possibile, mantenendo la formattazione originale dove ragionevole.`;

export const SYSTEM_PROMPT_DOCUMENT = `Estrai integralmente il testo dal documento fornito nel modo più fedele possibile, mantenendo la formattazione originale (paragrafi, elenchi) dove ragionevole. Restituisci esclusivamente il testo estratto, senza commenti aggiuntivi.`;
