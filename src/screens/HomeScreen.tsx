import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import {
  Briefcase,
  Camera,
  Clock,
  ClipboardPaste,
  Copy,
  ListChecks,
  Share2,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  WandSparkles,
} from 'lucide-react-native';
import { Card } from '../components/Card';
import { HistoryModal } from '../components/HistoryModal';
import { Toast } from '../components/Toast';
import {
  colors,
  glassBorder,
  glassShadow,
  gradient,
  radius,
  spacing,
  typography,
} from '../constants/theme';
import { DENSITY_LABELS, Density, MODE_LABELS, ProcessMode } from '../constants/prompts';
import { extractTextFromImage, processText } from '../services/geminiService';
import { readClipboard, writeClipboard } from '../services/clipboardService';
import { pickImageFromCamera, pickImageFromLibrary } from '../services/imagePickerService';
import { addHistoryEntry, getHistory, HistoryEntry } from '../services/storageService';

const TONE_OPTIONS: { id: ProcessMode; icon: typeof WandSparkles }[] = [
  { id: 'clean', icon: WandSparkles },
  { id: 'formal', icon: Briefcase },
  { id: 'summary', icon: ListChecks },
];

const DENSITY_OPTIONS: Density[] = ['essential', 'detailed'];

const QUICK_ACTIONS: { id: string; label: string; icon: typeof ClipboardPaste }[] = [
  { id: 'paste', label: 'Incolla', icon: ClipboardPaste },
  { id: 'clear', label: 'Cancella', icon: Trash2 },
  { id: 'camera', label: 'Fotocamera', icon: Camera },
];

const TOAST_DURATION_MS = 1800;
const WORDS_PER_MINUTE = 200;

type TextMetrics = {
  words: number;
  characters: number;
  readingTimeSeconds: number;
};

function computeMetrics(text: string): TextMetrics {
  const trimmed = text.trim();
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  const characters = text.length;
  const readingTimeSeconds = Math.max(1, Math.round((words / WORDS_PER_MINUTE) * 60));
  return { words, characters, readingTimeSeconds: words === 0 ? 0 : readingTimeSeconds };
}

function formatMetrics({ words, characters, readingTimeSeconds }: TextMetrics): string {
  if (words === 0) {
    return '0 parole · 0 caratteri';
  }
  const readingLabel =
    readingTimeSeconds < 60
      ? `~${readingTimeSeconds}s lettura`
      : `~${Math.round(readingTimeSeconds / 60)} min lettura`;
  return `${words} parole · ${characters} caratteri · ${readingLabel}`;
}

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedTone, setSelectedTone] = useState<ProcessMode>('clean');
  const [selectedDensity, setSelectedDensity] = useState<Density>('essential');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      Speech.stop();
    };
  }, []);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(''), TOAST_DURATION_MS);
  };

  const runImageScan = async (source: 'camera' | 'library') => {
    setIsScanning(true);
    setErrorMessage('');
    try {
      const image = source === 'camera' ? await pickImageFromCamera() : await pickImageFromLibrary();
      if (!image) {
        return;
      }
      const extractedText = await extractTextFromImage(image.base64, image.mimeType);
      setInputText(extractedText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(error instanceof Error ? error.message : 'Errore imprevisto durante la scansione.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleQuickAction = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (id === 'clear') {
      setInputText('');
      setErrorMessage('');
      return;
    }
    if (id === 'paste') {
      const clipboardText = await readClipboard();
      if (clipboardText) {
        setInputText(clipboardText);
      }
      return;
    }
    if (id === 'camera') {
      Alert.alert('Scansiona testo', 'Scegli la sorgente dell\'immagine', [
        { text: 'Scatta foto', onPress: () => runImageScan('camera') },
        { text: 'Scegli dalla libreria', onPress: () => runImageScan('library') },
        { text: 'Annulla', style: 'cancel' },
      ]);
    }
  };

  const handleToneSelect = (tone: ProcessMode) => {
    Haptics.selectionAsync();
    setSelectedTone(tone);
  };

  const handleDensitySelect = (density: Density) => {
    Haptics.selectionAsync();
    setSelectedDensity(density);
  };

  const handleProcess = async () => {
    if (!inputText.trim() || isProcessing) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsProcessing(true);
    setErrorMessage('');
    Speech.stop();
    setIsSpeaking(false);
    try {
      const originalText = inputText.trim();
      const result = await processText(originalText, selectedTone, selectedDensity);
      setOutputText(result);
      await addHistoryEntry({ originalText, generatedText: result, mode: selectedTone });
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(error instanceof Error ? error.message : 'Errore imprevisto.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyResult = async () => {
    if (!outputText) {
      return;
    }
    await writeClipboard(outputText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('Copiato negli appunti');
  };

  const handleToggleSpeech = () => {
    if (!outputText) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    Speech.speak(outputText, {
      language: 'it-IT',
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const handleShare = async () => {
    if (!outputText) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({ message: outputText });
    } catch {
      setErrorMessage('Impossibile aprire la condivisione.');
    }
  };

  const handleOpenHistory = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const entries = await getHistory();
    setHistoryEntries(entries);
    setIsHistoryVisible(true);
  };

  const handleSelectHistoryEntry = async (entry: HistoryEntry) => {
    setInputText(entry.originalText);
    setOutputText(entry.generatedText);
    setSelectedTone(entry.mode);
    setErrorMessage('');
    await writeClipboard(entry.generatedText);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsHistoryVisible(false);
    showToast('Ripristinato dallo storico e copiato');
  };

  const canProcess = inputText.trim().length > 0 && !isProcessing;
  const inputMetrics = computeMetrics(inputText);
  const outputMetrics = computeMetrics(outputText);

  return (
    <LinearGradient colors={gradient.background} style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Math.max(insets.top, spacing.lg) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Smart Flow</Text>
              <Text style={styles.headerSubtitle}>Rielabora il testo in un tocco</Text>
            </View>
            <View style={styles.headerActions}>
              <View style={styles.badge}>
                <Sparkles color={colors.glow} size={14} />
                <Text style={styles.badgeLabel}>AI</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.historyButton, pressed && styles.historyButtonPressed]}
                onPress={handleOpenHistory}
                hitSlop={8}
              >
                <Clock color={colors.text} size={20} />
              </Pressable>
            </View>
          </View>

          <Card style={styles.section}>
            <Text style={styles.sectionLabel}>Testo di partenza</Text>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Scrivi o incolla qui il testo da elaborare..."
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.textArea}
            />
            <Text style={styles.metricsText}>{formatMetrics(inputMetrics)}</Text>
            <View style={styles.quickActionsRow}>
              {QUICK_ACTIONS.map(({ id, label, icon: Icon }) => (
                <Pressable
                  key={id}
                  style={({ pressed }) => [
                    styles.quickAction,
                    pressed && styles.quickActionPressed,
                  ]}
                  onPress={() => handleQuickAction(id)}
                  disabled={id === 'camera' && isScanning}
                >
                  {id === 'camera' && isScanning ? (
                    <ActivityIndicator color={colors.text} size="small" />
                  ) : (
                    <Icon color={colors.text} size={18} />
                  )}
                  <Text style={styles.quickActionLabel}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </Card>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Modalità</Text>
            <View style={styles.toneGrid}>
              {TONE_OPTIONS.map(({ id, icon: Icon }) => {
                const isSelected = selectedTone === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => handleToneSelect(id)}
                    style={[styles.toneCard, isSelected && styles.toneCardSelected]}
                  >
                    <Icon color={isSelected ? colors.text : colors.textMuted} size={20} />
                    <Text style={[styles.toneLabel, isSelected && styles.toneLabelSelected]}>
                      {MODE_LABELS[id]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Densità</Text>
            <View style={styles.toneGrid}>
              {DENSITY_OPTIONS.map((density) => {
                const isSelected = selectedDensity === density;
                return (
                  <Pressable
                    key={density}
                    onPress={() => handleDensitySelect(density)}
                    style={[styles.densityCard, isSelected && styles.toneCardSelected]}
                  >
                    <Text style={[styles.toneLabel, isSelected && styles.toneLabelSelected]}>
                      {DENSITY_LABELS[density]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.processButtonWrapper,
              (!canProcess || pressed) && styles.processButtonDisabled,
            ]}
            onPress={handleProcess}
            disabled={!canProcess}
          >
            <LinearGradient colors={gradient.action} style={styles.processButton}>
              {isProcessing ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Sparkles color={colors.textOnPrimary} size={18} />
              )}
              <Text style={styles.processButtonLabel}>
                {isProcessing ? 'Elaborazione...' : 'Rielabora testo'}
              </Text>
            </LinearGradient>
          </Pressable>

          <Card style={styles.section}>
            <Text style={styles.sectionLabel}>Risultato</Text>
            <View style={styles.outputBox}>
              {isProcessing ? (
                <ActivityIndicator color={colors.glow} />
              ) : errorMessage ? (
                <Text style={styles.outputError}>{errorMessage}</Text>
              ) : (
                <Text style={outputText ? styles.outputText : styles.outputPlaceholder}>
                  {outputText || 'Il testo rielaborato apparirà qui.'}
                </Text>
              )}
            </View>
            <Text style={styles.metricsText}>{formatMetrics(outputMetrics)}</Text>

            <View style={styles.outputActionsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryAction,
                  (!outputText || pressed) && styles.secondaryActionDisabled,
                ]}
                onPress={handleToggleSpeech}
                disabled={!outputText}
              >
                {isSpeaking ? (
                  <VolumeX color={colors.text} size={18} />
                ) : (
                  <Volume2 color={colors.text} size={18} />
                )}
                <Text style={styles.secondaryActionLabel}>
                  {isSpeaking ? 'Ferma' : 'Ascolta'}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryAction,
                  (!outputText || pressed) && styles.secondaryActionDisabled,
                ]}
                onPress={handleShare}
                disabled={!outputText}
              >
                <Share2 color={colors.text} size={18} />
                <Text style={styles.secondaryActionLabel}>Condividi</Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.copyButton,
                (!outputText || pressed) && styles.copyButtonPressed,
              ]}
              onPress={handleCopyResult}
              disabled={!outputText}
            >
              <Copy color={colors.textOnPrimary} size={20} />
              <Text style={styles.copyButtonLabel}>Copia Risultato</Text>
            </Pressable>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast message={toastMessage} visible={Boolean(toastMessage)} />
      <HistoryModal
        visible={isHistoryVisible}
        onClose={() => setIsHistoryVisible(false)}
        entries={historyEntries}
        onSelectEntry={handleSelectHistoryEntry}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: colors.text,
    ...typography.title,
  },
  headerSubtitle: {
    color: colors.textMuted,
    ...typography.body,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.glowMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    ...glassBorder,
  },
  historyButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    ...glassBorder,
  },
  historyButtonPressed: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
  },
  badgeLabel: {
    color: colors.glow,
    ...typography.caption,
    fontWeight: '700',
  },
  section: {
    gap: spacing.md,
  },
  sectionLabel: {
    color: colors.textMuted,
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textArea: {
    minHeight: 120,
    color: colors.text,
    ...typography.body,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...glassBorder,
    padding: spacing.md,
  },
  metricsText: {
    color: colors.textMuted,
    ...typography.caption,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...glassBorder,
    paddingVertical: spacing.sm,
  },
  quickActionPressed: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
  },
  quickActionLabel: {
    color: colors.text,
    ...typography.caption,
    fontWeight: '600',
  },
  toneGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toneCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    ...glassBorder,
    paddingVertical: spacing.md,
  },
  densityCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    ...glassBorder,
    paddingVertical: spacing.md,
  },
  toneCardSelected: {
    backgroundColor: colors.glowMuted,
    borderColor: colors.glowBorder,
    ...glassShadow,
  },
  toneLabel: {
    color: colors.textMuted,
    ...typography.body,
    fontWeight: '600',
  },
  toneLabelSelected: {
    color: colors.text,
  },
  processButtonWrapper: {
    borderRadius: radius.md,
    shadowColor: colors.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  processButtonDisabled: {
    opacity: 0.5,
  },
  processButtonLabel: {
    color: colors.textOnPrimary,
    ...typography.subtitle,
    fontWeight: '700',
  },
  outputBox: {
    minHeight: 100,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...glassBorder,
    padding: spacing.md,
    justifyContent: 'center',
  },
  outputText: {
    color: colors.text,
    ...typography.body,
  },
  outputPlaceholder: {
    color: colors.textMuted,
    ...typography.body,
    fontStyle: 'italic',
  },
  outputError: {
    color: colors.danger,
    ...typography.body,
  },
  outputActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...glassBorder,
    paddingVertical: spacing.sm,
  },
  secondaryActionDisabled: {
    opacity: 0.5,
  },
  secondaryActionLabel: {
    color: colors.text,
    ...typography.caption,
    fontWeight: '600',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    shadowColor: colors.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  copyButtonPressed: {
    opacity: 0.5,
  },
  copyButtonLabel: {
    color: colors.textOnPrimary,
    ...typography.subtitle,
    fontWeight: '700',
  },
});
