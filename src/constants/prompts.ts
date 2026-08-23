export type ProcessMode = 'clean' | 'formal' | 'summary';
export type Density = 'essential' | 'detailed';

export const MODE_LABELS: Record<ProcessMode, string> = {
  clean: 'Pulisci',
  formal: 'Formale',
  summary: 'Sintesi',
};

export const DENSITY_LABELS: Record<Density, string> = {
  essential: 'Essenziale',
  detailed: 'Dettagliato',
};

export const SYSTEM_PROMPTS: Record<ProcessMode, string> = {
  clean: `Correggi solo i refusi di dettatura e la punteggiatura del testo fornito, senza alterarne lo stile, il tono o il significato originale. Restituisci esclusivamente il testo corretto, senza commenti o premesse aggiuntive.`,
  formal: `Rielabora il testo fornito in un italiano formale e professionale, adatto a comunicazioni di lavoro. Mantieni il significato originale. Restituisci esclusivamente il testo rielaborato, senza commenti o premesse aggiuntive.`,
  summary: `Estrai i punti chiave del testo fornito in un elenco puntato essenziale, in italiano. Restituisci esclusivamente l'elenco puntato, senza commenti o premesse aggiuntive.`,
};

export const DENSITY_MODIFIERS: Record<Density, string> = {
  essential: `Sii il più conciso possibile, riducendo il risultato all'essenziale.`,
  detailed: `Fornisci maggiori dettagli e contesto dove utile, senza essere prolisso.`,
};

export const SYSTEM_PROMPT_OCR = `Estrai il testo dall'immagine fornita nel modo più fedele possibile, mantenendo la formattazione originale dove ragionevole.`;
