import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { useShareIntent } from 'expo-share-intent';

export type IncomingImport = {
  kind: 'text' | 'url';
  value: string;
};

type UseIncomingShareIntentOptions = {
  onImport: (payload: IncomingImport) => void;
};

const URL_LIKE_PATTERN = /^https?:\/\/\S+$/i;

function isLikelyUrl(value: string): boolean {
  return URL_LIKE_PATTERN.test(value.trim());
}

/**
 * `Linking.parse()` already URL-decodes query values (it actually decodes
 * twice internally). If an external caller — a Shortcut, another app —
 * double- or triple-encodes its payload, a residual `%XX` sequence can
 * still be left over. Decode once more only in that case, so an
 * already-clean value is never touched (and never double-decoded into
 * something wrong).
 */
function cleanQueryValue(value: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(value)) {
    return value;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * `getInitialURL()` can be asked before the OS has finished handing the
 * launch URL to the app on a cold start from the Share Extension — a
 * couple of short retries is cheap insurance against reading nothing on
 * that first tick.
 */
async function getInitialUrlWithRetry(maxAttempts = 3, delayMs = 150): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const url = await Linking.getInitialURL();
    if (url) {
      return url;
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

/**
 * Bridges two native entry points into a single callback:
 * - the iOS Share Extension (share sheet → "Smart Flow AI"), for plain text
 *   and web links, wired via the `expo-share-intent` config plugin;
 * - the `smartflow://` deep link scheme, for the `process` and
 *   `extract-url` routes triggered from Shortcuts/Siri.
 *
 * Handles both cold start (app launched by the intent) and the app already
 * running: `expo-share-intent` re-fires `hasShareIntent` whenever a new
 * share arrives regardless of app state, and `Linking.getInitialURL` (cold
 * start, with retry) plus the `url` event listener (already running) cover
 * the same for deep links.
 */
export function useIncomingShareIntent({ onImport }: UseIncomingShareIntentOptions) {
  // `resetOnBackground` is turned off because we reset the intent ourselves
  // right after consuming it below — leaving the library's own automatic
  // background/foreground reset enabled as well risks it clearing the
  // intent in a race with our own read of it.
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    scheme: 'smartflow',
    resetOnBackground: false,
  });
  const lastHandledUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!hasShareIntent) {
      return;
    }
    if (shareIntent.webUrl) {
      onImport({ kind: 'url', value: shareIntent.webUrl });
    } else if (shareIntent.text) {
      const text = shareIntent.text.trim();
      // Some share sources (older Chrome-on-iOS share sheets, some
      // third-party apps) deliver a shared page as `public.plain-text`
      // instead of `public.url`, leaving `webUrl` empty. Treat a text
      // payload that's just a bare URL the same as a real web share, so it
      // still gets extracted + summarized instead of running through the
      // plain "Pulisci" cleanup.
      onImport(isLikelyUrl(text) ? { kind: 'url', value: text } : { kind: 'text', value: text });
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, onImport, resetShareIntent]);

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url || url === lastHandledUrl.current) {
        return;
      }
      const parsed = Linking.parse(url);
      const route = parsed.hostname ?? parsed.path;
      if (route === 'process') {
        const text = parsed.queryParams?.text;
        if (typeof text === 'string' && text.trim()) {
          lastHandledUrl.current = url;
          onImport({ kind: 'text', value: cleanQueryValue(text) });
        }
      } else if (route === 'extract-url') {
        const targetUrl = parsed.queryParams?.url;
        if (typeof targetUrl === 'string' && targetUrl.trim()) {
          lastHandledUrl.current = url;
          onImport({ kind: 'url', value: cleanQueryValue(targetUrl) });
        }
      }
    };

    getInitialUrlWithRetry().then(handleUrl);
    const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, [onImport]);
}
