const URL_LIKE_PATTERN = /^https?:\/\/\S+$/i;

/**
 * True when a shared text payload is really just a bare link, which should be
 * fetched and summarized rather than run through the plain cleanup pass.
 */
export function isLikelyUrl(value: string): boolean {
  return URL_LIKE_PATTERN.test(value.trim());
}

/**
 * Reads one query parameter straight off the raw URL, decoding it exactly
 * once.
 *
 * `Linking.parse()` can't be used for this: it decodes query values *twice*
 * (expo-linking's `parse` reads `searchParams`, which already decodes, then
 * calls `decodeURIComponent` on the result again). That silently corrupts any
 * payload containing a legitimate percent sequence — a shared link with `%20`
 * in it comes back with a real space, pointing somewhere else entirely. The
 * Share Extension encodes its payload exactly once, so one decode is right.
 */
export function readRawQueryParam(url: string, key: string): string | null {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) {
    return null;
  }
  const hashStart = url.indexOf('#', queryStart);
  const query = url.slice(queryStart + 1, hashStart === -1 ? undefined : hashStart);

  for (const pair of query.split('&')) {
    const separator = pair.indexOf('=');
    if (separator === -1 || pair.slice(0, separator) !== key) {
      continue;
    }
    const raw = pair.slice(separator + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      // Malformed escape sequence — better to hand over the literal value
      // than to drop the share entirely.
      return raw;
    }
  }
  return null;
}

/**
 * Percent-encodes a payload the same way the iOS Share Extension does
 * (`addingPercentEncoding` over RFC 3986 unreserved characters). Kept here so
 * the encode/decode pair can be exercised together in tests — the native side
 * is the real producer and can't be run from JS.
 */
export function encodeSharePayload(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
