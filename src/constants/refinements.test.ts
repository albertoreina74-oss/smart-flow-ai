import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRefinePrompt, buildRefinedModeLabel, REFINEMENTS } from './refinements.ts';

describe('REFINEMENTS', () => {
  it('has unique ids and non-empty instructions', () => {
    const ids = REFINEMENTS.map((refinement) => refinement.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate refinement id');
    for (const refinement of REFINEMENTS) {
      assert.ok(refinement.label.trim(), `empty label for ${refinement.id}`);
      assert.ok(refinement.instruction.trim().length > 20, `thin instruction for ${refinement.id}`);
    }
  });
});

describe('buildRefinePrompt', () => {
  it('embeds the requested change', () => {
    const prompt = buildRefinePrompt('rendilo un elenco puntato');
    assert.ok(prompt.includes('rendilo un elenco puntato'));
  });

  it('keeps the guards that stop a refinement from drifting', () => {
    // Without these the model translates, or strips the formatting the user
    // already accepted, or answers with a preamble instead of the text.
    const prompt = buildRefinePrompt('accorcia');
    assert.ok(/stessa lingua/i.test(prompt), 'missing language guard');
    assert.ok(/formattazione/i.test(prompt), 'missing formatting guard');
    assert.ok(/esclusivamente/i.test(prompt), 'missing "text only" guard');
  });

  it('tolerates a user instruction with odd spacing', () => {
    const prompt = buildRefinePrompt('   piu formale   ');
    assert.ok(prompt.includes('"piu formale"'));
  });
});

describe('buildRefinedModeLabel', () => {
  it('labels the first refinement of a result', () => {
    assert.equal(buildRefinedModeLabel('Pulisci', 'Più corto'), 'Pulisci · Più corto');
  });

  it('replaces the previous refinement instead of accumulating', () => {
    // Chaining four refinements must not yield
    // "Pulisci · A · B · C · D" — the archive label has to stay readable.
    let label = 'Pulisci';
    for (const step of ['Più corto', 'Più formale', 'Più semplice', 'Espandi']) {
      label = buildRefinedModeLabel(label, step);
    }
    assert.equal(label, 'Pulisci · Espandi');
    assert.equal(label.split(' · ').length, 2);
  });

  it('preserves a multi-word base label', () => {
    assert.equal(buildRefinedModeLabel('🌐 Traduci', 'Più formale'), '🌐 Traduci · Più formale');
  });
});
