import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { useShareIntent } from 'expo-share-intent';
import { isLikelyUrl, readRawQueryParam } from '../utils/shareLinks';

export type IncomingImport = {
  kind: 'text' | 'url';
  value: string;
};

type UseIncomingShareIntentOptions = {
  onImport: (payload: IncomingImport) => void;
};


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
      // Only the route name comes from `Linking.parse` — query values are read
      // separately, see `readRawQueryParam`.
      const parsed = Linking.parse(url);
      const route = parsed.hostname ?? parsed.path;
      if (route === 'process') {
        const text = readRawQueryParam(url, 'text');
        if (text && text.trim()) {
          lastHandledUrl.current = url;
          onImport({ kind: 'text', value: text });
        }
      } else if (route === 'extract-url') {
        const targetUrl = readRawQueryParam(url, 'url');
        if (targetUrl && targetUrl.trim()) {
          lastHandledUrl.current = url;
          onImport({ kind: 'url', value: targetUrl });
        }
      }
    };

    getInitialUrlWithRetry().then(handleUrl);
    const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, [onImport]);
}
