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
 * start) plus the `url` event listener (already running) cover the same
 * for deep links.
 */
export function useIncomingShareIntent({ onImport }: UseIncomingShareIntentOptions) {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({ scheme: 'smartflow' });
  const lastHandledUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!hasShareIntent) {
      return;
    }
    if (shareIntent.webUrl) {
      onImport({ kind: 'url', value: shareIntent.webUrl });
    } else if (shareIntent.text) {
      onImport({ kind: 'text', value: shareIntent.text });
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
          onImport({ kind: 'text', value: text });
        }
      } else if (route === 'extract-url') {
        const targetUrl = parsed.queryParams?.url;
        if (typeof targetUrl === 'string' && targetUrl.trim()) {
          lastHandledUrl.current = url;
          onImport({ kind: 'url', value: targetUrl });
        }
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, [onImport]);
}
