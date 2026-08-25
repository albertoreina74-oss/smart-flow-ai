import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_ENTRY_PREFIX = '@smart-flow-ai/response-cache/';
const CACHE_INDEX_KEY = '@smart-flow-ai/response-cache-index';
const MAX_CACHE_ENTRIES = 30;

// In-memory first so repeated hits within the same session never touch
// AsyncStorage at all; it's seeded lazily from disk on first read of a key.
const memoryCache = new Map<string, string>();

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/** Builds a stable cache key from the exact request shape — identical inputs only. */
export function buildCacheKey(parts: Record<string, string | number | undefined>): string {
  return simpleHash(JSON.stringify(parts));
}

export async function getCachedResponse(key: string): Promise<string | null> {
  const inMemory = memoryCache.get(key);
  if (inMemory !== undefined) {
    return inMemory;
  }
  const stored = await AsyncStorage.getItem(CACHE_ENTRY_PREFIX + key);
  if (stored !== null) {
    memoryCache.set(key, stored);
  }
  return stored;
}

async function trackCacheKey(key: string): Promise<void> {
  const raw = await AsyncStorage.getItem(CACHE_INDEX_KEY);
  const index: string[] = raw ? JSON.parse(raw) : [];
  const next = [key, ...index.filter((existing) => existing !== key)].slice(0, MAX_CACHE_ENTRIES);
  const evicted = index.filter((existing) => !next.includes(existing));
  await Promise.all(
    evicted.map((evictedKey) => {
      memoryCache.delete(evictedKey);
      return AsyncStorage.removeItem(CACHE_ENTRY_PREFIX + evictedKey);
    }),
  );
  await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(next));
}

export async function setCachedResponse(key: string, value: string): Promise<void> {
  if (!value) {
    return;
  }
  memoryCache.set(key, value);
  await AsyncStorage.setItem(CACHE_ENTRY_PREFIX + key, value);
  await trackCacheKey(key);
}
