import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Density, Language, ProcessMode } from '../constants/prompts';
import {
  getFriendlyErrorMessage,
  ProcessOptions,
  StreamHandle,
  streamProcessText,
} from '../services/geminiService';
import { buildRefinePrompt, buildRefinedModeLabel } from '../constants/refinements';
import { addHistoryEntry, toggleFavoriteEntry, updateHistoryEntry } from '../services/storageService';

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
  const [isRefining, setIsRefining] = useState(false);
  // Each refinement pushes the result it replaced, so the user can walk back
  // out of a follow-up that made things worse instead of starting over.
  const [refineUndoStack, setRefineUndoStack] = useState<{ text: string; modeLabel: string }[]>([]);
  const streamHandleRef = useRef<StreamHandle | null>(null);
  const modeLabelRef = useRef('');

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
    setRefineUndoStack([]);
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
    setRefineUndoStack([]);
    modeLabelRef.current = modeLabel;

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

  /**
   * Loads a result saved earlier back into the live editing state, so an
   * archived entry becomes a starting point again: it can be listened to,
   * exported, refined further, or favorited, and any refinement updates that
   * same entry rather than creating a duplicate.
   */
  const restoreResult = (entry: {
    id: string;
    generatedText: string;
    modeLabel: string;
    isFavorite: boolean;
  }) => {
    streamHandleRef.current?.cancel();
    setIsProcessing(false);
    setIsRefining(false);
    setErrorMessage('');
    setOutputText(entry.generatedText);
    setCurrentEntryId(entry.id);
    setIsCurrentFavorite(entry.isFavorite);
    setRefineUndoStack([]);
    modeLabelRef.current = entry.modeLabel;
  };

  /**
   * Runs a follow-up pass over the *current result* rather than the original
   * source, so the user can converge on what they wanted in a couple of taps
   * instead of re-running the same generation and hoping for a better roll.
   */
  const refineResult = async (instruction: string, refinementLabel: string) => {
    const previousText = outputText.trim();
    if (!previousText || isProcessing || isRefining) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRefining(true);
    setErrorMessage('');

    const previousModeLabel = modeLabelRef.current;
    const nextModeLabel = buildRefinedModeLabel(previousModeLabel, refinementLabel);
    const entryId = currentEntryId;

    streamHandleRef.current?.cancel();
    streamHandleRef.current = streamProcessText(
      previousText,
      'clean',
      'essential',
      'it',
      {
        onChunk: (fullTextSoFar) => setOutputText(fullTextSoFar),
        onDone: async (finalText) => {
          setIsRefining(false);
          setOutputText(finalText);
          setRefineUndoStack((stack) => [
            ...stack,
            { text: previousText, modeLabel: previousModeLabel },
          ]);
          modeLabelRef.current = nextModeLabel;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          try {
            // A refinement revises the same piece of work, so update the
            // existing archive entry instead of adding a near-duplicate.
            if (entryId) {
              await updateHistoryEntry(entryId, {
                generatedText: finalText,
                modeLabel: nextModeLabel,
              });
            }
          } catch {
            // History persistence failure shouldn't block the result.
          }
        },
        onError: (error) => {
          setIsRefining(false);
          // The partial text streamed so far is not a usable result — put the
          // accepted one back rather than leaving a truncated fragment.
          setOutputText(previousText);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setErrorMessage(getFriendlyErrorMessage(error));
        },
      },
      { customPrompt: buildRefinePrompt(instruction) },
    );
  };

  const undoRefine = async () => {
    const previous = refineUndoStack[refineUndoStack.length - 1];
    if (!previous || isProcessing || isRefining) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    streamHandleRef.current?.cancel();
    setOutputText(previous.text);
    modeLabelRef.current = previous.modeLabel;
    setRefineUndoStack((stack) => stack.slice(0, -1));
    if (currentEntryId) {
      try {
        await updateHistoryEntry(currentEntryId, {
          generatedText: previous.text,
          modeLabel: previous.modeLabel,
        });
      } catch {
        // Non-fatal: the on-screen result is already restored.
      }
    }
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
    isRefining,
    canUndoRefine: refineUndoStack.length > 0,
    refineResult,
    undoRefine,
    restoreResult,
  };
}
