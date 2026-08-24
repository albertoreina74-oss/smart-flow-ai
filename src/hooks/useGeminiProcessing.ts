import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Density, Language, ProcessMode } from '../constants/prompts';
import {
  getFriendlyErrorMessage,
  ProcessOptions,
  StreamHandle,
  streamProcessText,
} from '../services/geminiService';
import { addHistoryEntry, toggleFavoriteEntry } from '../services/storageService';

const DOUBLE_HAPTIC_DELAY_MS = 150;

/**
 * Encapsulates the "run a Gemini generation, reveal it progressively, save
 * it to history, allow favoriting" flow shared by every screen that
 * produces an AI result (Flow, Documenti, Traduci).
 */
export function useGeminiProcessing() {
  const [outputText, setOutputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [isCurrentFavorite, setIsCurrentFavorite] = useState(false);
  const streamHandleRef = useRef<StreamHandle | null>(null);

  useEffect(() => {
    return () => {
      streamHandleRef.current?.cancel();
    };
  }, []);

  const reset = () => {
    setOutputText('');
    setErrorMessage('');
    setCurrentEntryId(null);
    setIsCurrentFavorite(false);
  };

  const runProcessing = async (
    sourceText: string,
    mode: ProcessMode,
    density: Density,
    language: Language,
    modeLabel: string,
    options?: ProcessOptions,
  ) => {
    const trimmed = sourceText.trim();
    if (!trimmed || isProcessing) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    setErrorMessage('');
    setOutputText('');
    setCurrentEntryId(null);
    setIsCurrentFavorite(false);

    streamHandleRef.current?.cancel();
    streamHandleRef.current = streamProcessText(
      trimmed,
      mode,
      density,
      language,
      {
        onChunk: (fullTextSoFar) => setOutputText(fullTextSoFar),
        onDone: async (finalText) => {
          setIsProcessing(false);
          setOutputText(finalText);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }, DOUBLE_HAPTIC_DELAY_MS);
          try {
            const updated = await addHistoryEntry({
              originalText: trimmed,
              generatedText: finalText,
              modeLabel,
            });
            setCurrentEntryId(updated[0]?.id ?? null);
          } catch {
            // History persistence failure shouldn't block the result from being shown.
          }
        },
        onError: (error) => {
          setIsProcessing(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setErrorMessage(getFriendlyErrorMessage(error));
        },
      },
      options,
    );
  };

  const toggleFavorite = async () => {
    if (!currentEntryId) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = await toggleFavoriteEntry(currentEntryId);
    const entry = updated.find((item) => item.id === currentEntryId);
    setIsCurrentFavorite(Boolean(entry?.isFavorite));
  };

  return {
    outputText,
    isProcessing,
    errorMessage,
    setErrorMessage,
    currentEntryId,
    isCurrentFavorite,
    runProcessing,
    toggleFavorite,
    reset,
  };
}
