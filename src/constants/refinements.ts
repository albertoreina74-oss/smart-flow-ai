export type RefinementId = 'shorter' | 'formal' | 'simpler' | 'expand';

export type Refinement = {
  id: RefinementId;
  label: string;
  instruction: string;
};

/**
 * One-tap follow-ups applied to a result that's already close to what the
 * user wanted. They deliberately describe a *change* rather than a target
 * style, so they compose: tapping "Più corto" twice keeps shortening.
 */
export const REFINEMENTS: Refinement[] = [
  {
    id: 'shorter',
    label: 'Più corto',
    instruction:
      'Accorcia il testo in modo sensibile, togliendo ripetizioni, giri di parole e dettagli secondari. Conserva tutte le informazioni essenziali.',
  },
  {
    id: 'formal',
    label: 'Più formale',
    instruction:
      'Alza il registro verso un tono formale e professionale, adatto a una comunicazione di lavoro, senza cambiare il contenuto.',
  },
  {
    id: 'simpler',
    label: 'Più semplice',
    instruction:
      'Semplifica il linguaggio: frasi più brevi, parole comuni, nessun tecnicismo non necessario. Il significato deve restare identico.',
  },
  {
    id: 'expand',
    label: 'Espandi',
    instruction:
      'Sviluppa il testo aggiungendo il contesto e i passaggi impliciti che lo rendono più chiaro e completo, senza inventare fatti che non siano già presenti o deducibili.',
  },
];

/**
 * Builds the system prompt for a follow-up pass. Unlike the primary modes,
 * the input here is a *previous result*, so the prompt has to be explicit
 * about preserving what the user already accepted — language and structure
 * above all — and about changing only what was asked.
 */
export function buildRefinePrompt(instruction: string): string {
  return [
    'Ti viene fornito un testo già elaborato. Applica esattamente questa modifica:',
    `"${instruction.trim()}"`,
    "Scrivi nella stessa lingua del testo fornito. Mantieni la formattazione esistente (interruzioni di riga, elenchi puntati, tabelle Markdown) a meno che la modifica richiesta non imponga di cambiarla.",
    'Non aggiungere premesse, commenti o spiegazioni: restituisci esclusivamente il testo modificato.',
  ].join(' ');
}

/** Label recorded in the archive, e.g. "Pulisci · Più corto". */
export function buildRefinedModeLabel(baseLabel: string, refinementLabel: string): string {
  const base = baseLabel.split(' · ')[0];
  return `${base} · ${refinementLabel}`;
}
