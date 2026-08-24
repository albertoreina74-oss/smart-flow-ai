const WORDS_PER_MINUTE = 200;

export type TextMetrics = {
  words: number;
  characters: number;
  readingTimeSeconds: number;
};

export function computeMetrics(text: string): TextMetrics {
  const trimmed = text.trim();
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  const characters = text.length;
  const readingTimeSeconds = Math.max(1, Math.round((words / WORDS_PER_MINUTE) * 60));
  return { words, characters, readingTimeSeconds: words === 0 ? 0 : readingTimeSeconds };
}

export function formatMetrics({ words, characters, readingTimeSeconds }: TextMetrics): string {
  if (words === 0) {
    return '0 parole · 0 caratteri';
  }
  const readingLabel =
    readingTimeSeconds < 60
      ? `~${readingTimeSeconds}s lettura`
      : `~${Math.round(readingTimeSeconds / 60)} min lettura`;
  return `${words} parole · ${characters} caratteri · ${readingLabel}`;
}
