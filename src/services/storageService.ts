import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = '@smart-flow-ai/history';
const CUSTOM_PROMPTS_KEY = '@smart-flow-ai/custom-prompts';
const BIOMETRIC_LOCK_KEY = '@smart-flow-ai/biometric-lock';
const MAX_HISTORY_ENTRIES = 50;

export type HistoryEntry = {
  id: string;
  originalText: string;
  generatedText: string;
  modeLabel: string;
  createdAt: number;
  isFavorite: boolean;
};

export async function getHistory(): Promise<HistoryEntry[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
}

export async function addHistoryEntry(
  entry: Omit<HistoryEntry, 'id' | 'createdAt' | 'isFavorite'>,
): Promise<HistoryEntry[]> {
  const history = await getHistory();
  const newEntry: HistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    isFavorite: false,
  };
  const updated = [newEntry, ...history].slice(0, MAX_HISTORY_ENTRIES);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}

export async function deleteHistoryEntry(id: string): Promise<HistoryEntry[]> {
  const history = await getHistory();
  const updated = history.filter((entry) => entry.id !== id);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}

export async function toggleFavoriteEntry(id: string): Promise<HistoryEntry[]> {
  const history = await getHistory();
  const updated = history.map((entry) =>
    entry.id === id ? { ...entry, isFavorite: !entry.isFavorite } : entry,
  );
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY);
}

export type CustomPrompt = {
  id: string;
  label: string;
  prompt: string;
};

export async function getCustomPrompts(): Promise<CustomPrompt[]> {
  const raw = await AsyncStorage.getItem(CUSTOM_PROMPTS_KEY);
  return raw ? (JSON.parse(raw) as CustomPrompt[]) : [];
}

export async function addCustomPrompt(
  label: string,
  prompt: string,
): Promise<CustomPrompt[]> {
  const existing = await getCustomPrompts();
  const newPrompt: CustomPrompt = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    prompt,
  };
  const updated = [...existing, newPrompt];
  await AsyncStorage.setItem(CUSTOM_PROMPTS_KEY, JSON.stringify(updated));
  return updated;
}

export async function deleteCustomPrompt(id: string): Promise<CustomPrompt[]> {
  const existing = await getCustomPrompts();
  const updated = existing.filter((prompt) => prompt.id !== id);
  await AsyncStorage.setItem(CUSTOM_PROMPTS_KEY, JSON.stringify(updated));
  return updated;
}

export async function getBiometricLockEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(BIOMETRIC_LOCK_KEY);
  return raw === 'true';
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_LOCK_KEY, enabled ? 'true' : 'false');
}
