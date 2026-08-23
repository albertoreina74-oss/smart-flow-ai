import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProcessMode } from '../constants/prompts';

const HISTORY_KEY = '@smart-flow-ai/history';
const MAX_HISTORY_ENTRIES = 50;

export type HistoryEntry = {
  id: string;
  originalText: string;
  generatedText: string;
  mode: ProcessMode;
  createdAt: number;
};

export async function getHistory(): Promise<HistoryEntry[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
}

export async function addHistoryEntry(
  entry: Omit<HistoryEntry, 'id' | 'createdAt'>,
): Promise<HistoryEntry[]> {
  const history = await getHistory();
  const newEntry: HistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  const updated = [newEntry, ...history].slice(0, MAX_HISTORY_ENTRIES);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY);
}
