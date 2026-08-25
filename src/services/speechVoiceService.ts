import * as Speech from 'expo-speech';

// The device's voice list doesn't change while the app is running, so this
// is fetched once and reused for every "Ascolta" press instead of hitting
// the native bridge again each time.
let cachedVoicesPromise: Promise<Speech.Voice[]> | null = null;

function getVoices(): Promise<Speech.Voice[]> {
  if (!cachedVoicesPromise) {
    cachedVoicesPromise = Speech.getAvailableVoicesAsync().catch(() => []);
  }
  return cachedVoicesPromise;
}

/**
 * Picks the best-quality voice installed for a given BCP-47 locale (e.g.
 * "it-IT"), preferring an `Enhanced` (high-definition) voice over the
 * default system voice, which on iOS is the flat, metallic-sounding one.
 * Returns `undefined` when nothing matches, letting `Speech.speak` fall
 * back to the platform default for that language.
 */
export async function pickBestVoiceForLocale(locale: string): Promise<string | undefined> {
  const voices = await getVoices();
  if (voices.length === 0) {
    return undefined;
  }

  const languagePrefix = locale.split('-')[0].toLowerCase();
  const languageMatches = voices.filter((voice) => voice.language?.toLowerCase().startsWith(languagePrefix));
  if (languageMatches.length === 0) {
    return undefined;
  }

  const exactLocaleMatches = languageMatches.filter(
    (voice) => voice.language.toLowerCase() === locale.toLowerCase(),
  );
  const candidates = exactLocaleMatches.length > 0 ? exactLocaleMatches : languageMatches;

  const enhanced = candidates.find((voice) => voice.quality === Speech.VoiceQuality.Enhanced);
  return (enhanced ?? candidates[0]).identifier;
}
