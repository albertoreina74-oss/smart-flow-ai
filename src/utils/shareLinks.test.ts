import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { encodeSharePayload, isLikelyUrl, readRawQueryParam } from './shareLinks.ts';

// The iOS Share Extension builds these URLs; this mirrors that construction so
// the encode/decode pair is exercised end to end. See plugins/withShareExtensionFix.js.
function buildShareUrl(route: 'process' | 'extract-url', key: string, payload: string): string {
  return `smartflow://${route}?${key}=${encodeSharePayload(payload)}`;
}

describe('readRawQueryParam', () => {
  it('round-trips payloads that survived a share', () => {
    const payloads = [
      'Ciao come stai',
      "Perché l'AI è utile? Sì & no.",
      'Riga uno\nRiga due\nRiga tre',
      'Promemoria 📤 inoltro test',
      'a=1&b=2&text=rotto',
      'Nota #importante & urgente',
      'Sconto del 100% sul totale',
    ];

    for (const payload of payloads) {
      const url = buildShareUrl('process', 'text', payload);
      assert.equal(readRawQueryParam(url, 'text'), payload, `round-trip failed for: ${payload}`);
    }
  });

  it('preserves percent sequences inside a shared link', () => {
    // The regression this guards: decoding twice turns %20 into a real space,
    // silently pointing the extractor at a different page.
    const link = 'https://example.com/path?q=uno%20due&x=1';
    const url = buildShareUrl('extract-url', 'url', link);
    assert.equal(readRawQueryParam(url, 'url'), link);
  });

  it('does not treat + as a space', () => {
    const payload = 'uno+due';
    const url = buildShareUrl('process', 'text', payload);
    assert.equal(readRawQueryParam(url, 'text'), payload);
  });

  it('reads the right key when several are present', () => {
    const url = 'smartflow://process?nonce=abc&text=ciao&other=x';
    assert.equal(readRawQueryParam(url, 'text'), 'ciao');
    assert.equal(readRawQueryParam(url, 'nonce'), 'abc');
  });

  it('ignores a trailing fragment', () => {
    const url = 'smartflow://process?text=ciao#text';
    assert.equal(readRawQueryParam(url, 'text'), 'ciao');
  });

  it('returns null when the key or query is absent', () => {
    assert.equal(readRawQueryParam('smartflow://process?text=ciao', 'url'), null);
    assert.equal(readRawQueryParam('smartflow://process', 'text'), null);
  });

  it('falls back to the literal value on a malformed escape', () => {
    // Better to hand over something slightly wrong than to drop the share.
    assert.equal(readRawQueryParam('smartflow://process?text=100%sicuro', 'text'), '100%sicuro');
  });
});

describe('isLikelyUrl', () => {
  it('recognises bare links, including surrounding whitespace', () => {
    assert.equal(isLikelyUrl('https://example.com'), true);
    assert.equal(isLikelyUrl('  http://example.com/a/b  '), true);
  });

  it('rejects prose, even when it mentions a link', () => {
    assert.equal(isLikelyUrl('guarda qui https://example.com'), false);
    assert.equal(isLikelyUrl('Ciao come stai'), false);
    assert.equal(isLikelyUrl(''), false);
  });
});
