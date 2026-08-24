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
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import {
  Briefcase,
  Camera,
  Clock,
  ClipboardPaste,
  Copy,
  FileDown,
  FileText,
  Languages,
  ListChecks,
  Mic,
  MicOff,
  Plus,
  Share2,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  Volume2,
  VolumeX,
  WandSparkles,
} from 'lucide-react-native';
import { Card } from '../components/Card';
import { HistoryModal } from '../components/HistoryModal';
import { NewPromptModal } from '../components/NewPromptModal';
import { SettingsModal } from '../components/SettingsModal';
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
import {
  DENSITY_LABELS,
  Density,
  Language,
  LANGUAGE_OPTIONS,
  LANGUAGE_SPEECH_LOCALES,
  MODE_LABELS,
  ProcessMode,
} from '../constants/prompts';
import {
  extractTextFromDocument,
  extractTextFromImage,
  getFriendlyErrorMessage,
  StreamHandle,
  streamProcessText,
} from '../services/geminiService';
import { readClipboard, writeClipboard } from '../services/clipboardService';
import { pickImageFromCamera, pickImageFromLibrary } from '../services/imagePickerService';
import { pickDocument } from '../services/documentService';
import { exportResultAsMarkdown, exportResultAsPdf } from '../services/exportService';
import { authenticateWithBiometrics, isBiometricAvailable } from '../services/biometricService';
import {
  addCustomPrompt,
  addHistoryEntry,
  CustomPrompt,
  deleteHistoryEntry,
  getBiometricLockEnabled,
  getCustomPrompts,
  getHistory,
  HistoryEntry,
  setBiometricLockEnabled,
  toggleFavoriteEntry,
} from '../services/storageService';

const BUILTIN_TONE_OPTIONS: { id: ProcessMode; icon: typeof WandSparkles }[] = [
  { id: 'clean', icon: WandSparkles },
  { id: 'formal', icon: Briefcase },
  { id: 'summary', icon: ListChecks },
  { id: 'translate', icon: Languages },
];

const BUILTIN_MODE_IDS: string[] = BUILTIN_TONE_OPTIONS.map((option) => option.id);

function isBuiltinMode(id: string): id is ProcessMode {
  return BUILTIN_MODE_IDS.includes(id);
}

const DENSITY_OPTIONS: Density[] = ['essential', 'detailed'];

const QUICK_ACTIONS: { id: string; label: string; icon: typeof ClipboardPaste }[] = [
  { id: 'paste', label: 'Incolla', icon: ClipboardPaste },
  { id: 'clear', label: 'Cancella', icon: Trash2 },
  { id: 'camera', label: 'Fotocamera', icon: Camera },
  { id: 'document', label: 'Documento', icon: FileText },
  { id: 'dictate', label: 'Dettatura', icon: Mic },
];

const TOAST_DURATION_MS = 1800;
const WORDS_PER_MINUTE = 200;
const DOUBLE_HAPTIC_DELAY_MS = 150;

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
  const [selectedTone, setSelectedTone] = useState<string>('clean');
  const [selectedDensity, setSelectedDensity] = useState<Density>('essential');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const [temperature, setTemperature] = useState(0.7);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isDocumentLoading, setIsDocumentLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isNewPromptVisible, setIsNewPromptVisible] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [customPrompts, setCustomPrompts] = useState<CustomPrompt[]>([]);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [isCurrentFavorite, setIsCurrentFavorite] = useState(false);
  const [isExporting, setIsExporting] = useState<'pdf' | 'markdown' | null>(null);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isBiometricHardwareAvailable, setIsBiometricHardwareAvailable] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamHandleRef = useRef<StreamHandle | null>(null);

  useEffect(() => {
    getCustomPrompts().then(setCustomPrompts);
  }, []);

  useEffect(() => {
    isBiometricAvailable().then(setIsBiometricHardwareAvailable);
    getBiometricLockEnabled().then(setIsBiometricEnabled);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      Speech.stop();
      streamHandleRef.current?.cancel();
    };
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) {
      setInputText(transcript);
    }
  });

  useSpeechRecognitionEvent('end', () => {
    setIsRecording(false);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setIsRecording(false);
    setErrorMessage(getFriendlyErrorMessage(new Error(event.message || event.error)));
  });

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(''), TOAST_DURATION_MS);
  };

  const runProcessing = async (sourceText: string) => {
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
    Speech.stop();
    setIsSpeaking(false);

    const isCustom = !isBuiltinMode(selectedTone);
    const customPrompt = isCustom
      ? customPrompts.find((prompt) => `custom:${prompt.id}` === selectedTone)?.prompt
      : undefined;
    const modeLabel = isCustom
      ? customPrompts.find((prompt) => `custom:${prompt.id}` === selectedTone)?.label ??
        'Personalizzata'
      : MODE_LABELS[selectedTone as ProcessMode];

    streamHandleRef.current?.cancel();
    streamHandleRef.current = streamProcessText(
      trimmed,
      isCustom ? 'clean' : (selectedTone as ProcessMode),
      selectedDensity,
      selectedLanguage,
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
            setHistoryEntries(updated);
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
      { customPrompt, temperature },
    );
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
      if (selectedTone === 'translate') {
        await runProcessing(extractedText);
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsScanning(false);
    }
  };

  const runDocumentPick = async () => {
    setIsDocumentLoading(true);
    setErrorMessage('');
    try {
      const picked = await pickDocument();
      if (!picked) {
        return;
      }
      const extractedText =
        picked.kind === 'text'
          ? picked.text
          : await extractTextFromDocument(picked.base64, picked.mimeType);
      setInputText(extractedText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (selectedTone === 'translate') {
        await runProcessing(extractedText);
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsDocumentLoading(false);
    }
  };

  const handleToggleDictation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isRecording) {
      ExpoSpeechRecognitionModule.stop();
      setIsRecording(false);
      return;
    }
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage('Permesso microfono negato. Abilitalo nelle impostazioni per usare la dettatura.');
        return;
      }
      setErrorMessage('');
      setIsRecording(true);
      ExpoSpeechRecognitionModule.start({ lang: 'it-IT', interimResults: true, continuous: true });
    } catch (error) {
      setIsRecording(false);
      setErrorMessage(getFriendlyErrorMessage(error));
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
      return;
    }
    if (id === 'document') {
      runDocumentPick();
      return;
    }
    if (id === 'dictate') {
      handleToggleDictation();
    }
  };

  const handleToneSelect = (tone: string) => {
    Haptics.selectionAsync();
    setSelectedTone(tone);
  };

  const handleDensitySelect = (density: Density) => {
    Haptics.selectionAsync();
    setSelectedDensity(density);
  };

  const handleLanguageSelect = (language: Language) => {
    Haptics.selectionAsync();
    setSelectedLanguage(language);
  };

  const handleProcess = () => runProcessing(inputText);

  const handleCopyResult = async () => {
    if (!outputText) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    const speechLocale =
      selectedTone === 'translate' ? LANGUAGE_SPEECH_LOCALES[selectedLanguage] : 'it-IT';
    Speech.speak(outputText, {
      language: speechLocale,
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

  const handleToggleCurrentFavorite = async () => {
    if (!currentEntryId) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = await toggleFavoriteEntry(currentEntryId);
    setHistoryEntries(updated);
    const entry = updated.find((item) => item.id === currentEntryId);
    setIsCurrentFavorite(Boolean(entry?.isFavorite));
  };

  const handleOpenSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSettingsVisible(true);
  };

  const handleOpenNewPrompt = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsNewPromptVisible(true);
  };

  const handleSaveNewPrompt = async (label: string, prompt: string) => {
    const updated = await addCustomPrompt(label, prompt);
    setCustomPrompts(updated);
    setIsNewPromptVisible(false);
    const newPrompt = updated[updated.length - 1];
    if (newPrompt) {
      setSelectedTone(`custom:${newPrompt.id}`);
    }
    showToast('Modalità salvata');
  };

  const handleOpenHistory = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isBiometricEnabled) {
      const authenticated = await authenticateWithBiometrics('Sblocca lo storico di Smart Flow');
      if (!authenticated) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
    }
    const entries = await getHistory();
    setHistoryEntries(entries);
    setIsHistoryVisible(true);
  };

  const handleToggleBiometric = async (enabled: boolean) => {
    if (enabled) {
      const authenticated = await authenticateWithBiometrics('Conferma per attivare il blocco dello storico');
      if (!authenticated) {
        return;
      }
    }
    setIsBiometricEnabled(enabled);
    await setBiometricLockEnabled(enabled);
    showToast(enabled ? 'Blocco biometrico attivato' : 'Blocco biometrico disattivato');
  };

  const handleExportPdf = async () => {
    if (!outputText || isExporting) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExporting('pdf');
    try {
      await exportResultAsPdf(outputText);
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportMarkdown = async () => {
    if (!outputText || isExporting) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExporting('markdown');
    try {
      await exportResultAsMarkdown(outputText);
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsExporting(null);
    }
  };

  const handleSelectHistoryEntry = async (entry: HistoryEntry) => {
    setInputText(entry.originalText);
    setOutputText(entry.generatedText);
    setErrorMessage('');
    setCurrentEntryId(entry.id);
    setIsCurrentFavorite(entry.isFavorite);
    await writeClipboard(entry.generatedText);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsHistoryVisible(false);
    showToast('Ripristinato dallo storico e copiato');
  };

  const handleDeleteHistoryEntry = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = await deleteHistoryEntry(id);
    setHistoryEntries(updated);
    if (id === currentEntryId) {
      setCurrentEntryId(null);
      setIsCurrentFavorite(false);
    }
  };

  const handleToggleHistoryFavorite = async (id: string) => {
    const updated = await toggleFavoriteEntry(id);
    setHistoryEntries(updated);
    if (id === currentEntryId) {
      const entry = updated.find((item) => item.id === id);
      setIsCurrentFavorite(Boolean(entry?.isFavorite));
    }
  };

  const canProcess = inputText.trim().length > 0 && !isProcessing;
  const inputMetrics = computeMetrics(inputText);
  const outputMetrics = computeMetrics(outputText);
  const allToneOptions: { id: string; icon: typeof WandSparkles; label?: string }[] = [
    ...BUILTIN_TONE_OPTIONS,
    ...customPrompts.map((prompt) => ({
      id: `custom:${prompt.id}`,
      icon: Sparkles,
      label: prompt.label,
    })),
  ];

  return (
    <LinearGradient colors={gradient.background} style={styles.screen}>
      <StatusBar style="light" />
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
              <Pressable
                style={({ pressed }) => [styles.badge, pressed && styles.historyButtonPressed]}
                onPress={handleOpenSettings}
                hitSlop={8}
              >
                <Sparkles color={colors.glow} size={14} />
                <Text style={styles.badgeLabel}>AI</Text>
              </Pressable>
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickActionsRow}
            >
              {QUICK_ACTIONS.map(({ id, label, icon: Icon }) => {
                const isBusy =
                  (id === 'camera' && isScanning) ||
                  (id === 'document' && isDocumentLoading) ||
                  (id === 'dictate' && isRecording);
                return (
                  <Pressable
                    key={id}
                    style={({ pressed }) => [
                      styles.quickAction,
                      isBusy && styles.quickActionActive,
                      pressed && styles.quickActionPressed,
                    ]}
                    onPress={() => handleQuickAction(id)}
                    disabled={(id === 'camera' && isScanning) || (id === 'document' && isDocumentLoading)}
                  >
                    {id === 'camera' && isScanning ? (
                      <ActivityIndicator color={colors.text} size="small" />
                    ) : id === 'document' && isDocumentLoading ? (
                      <ActivityIndicator color={colors.text} size="small" />
                    ) : id === 'dictate' && isRecording ? (
                      <MicOff color={colors.glow} size={18} />
                    ) : (
                      <Icon color={colors.text} size={18} />
                    )}
                    <Text style={styles.quickActionLabel}>
                      {id === 'dictate' && isRecording ? 'In ascolto…' : label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Card>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Modalità</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modeRow}
            >
              {allToneOptions.map(({ id, icon: Icon, label }) => {
                const isSelected = selectedTone === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => handleToneSelect(id)}
                    style={[styles.modeChip, isSelected && styles.toneCardSelected]}
                  >
                    <Icon color={isSelected ? colors.text : colors.textMuted} size={18} />
                    <Text style={[styles.toneLabel, isSelected && styles.toneLabelSelected]}>
                      {isBuiltinMode(id) ? MODE_LABELS[id] : label}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable style={styles.modeChipNew} onPress={handleOpenNewPrompt}>
                <Plus color={colors.glow} size={18} />
                <Text style={styles.modeChipNewLabel}>Nuovo</Text>
              </Pressable>
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {selectedTone === 'translate' ? 'Lingua' : 'Densità'}
            </Text>
            {selectedTone === 'translate' ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.languageRow}
              >
                {LANGUAGE_OPTIONS.map(({ id, label }) => {
                  const isSelected = selectedLanguage === id;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => handleLanguageSelect(id)}
                      style={[styles.languageChip, isSelected && styles.toneCardSelected]}
                    >
                      <Text style={[styles.toneLabel, isSelected && styles.toneLabelSelected]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
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
            )}
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
              {errorMessage ? (
                <View style={styles.errorRow}>
                  <TriangleAlert color={colors.danger} size={18} />
                  <Text style={styles.outputError}>{errorMessage}</Text>
                </View>
              ) : isProcessing && !outputText ? (
                <ActivityIndicator color={colors.glow} />
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
                  (!currentEntryId || pressed) && styles.secondaryActionDisabled,
                ]}
                onPress={handleToggleCurrentFavorite}
                disabled={!currentEntryId}
              >
                <Star
                  color={isCurrentFavorite ? colors.glow : colors.text}
                  fill={isCurrentFavorite ? colors.glow : 'transparent'}
                  size={18}
                />
                <Text style={styles.secondaryActionLabel}>
                  {isCurrentFavorite ? 'Preferito' : 'Preferisci'}
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

            <View style={styles.outputActionsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryAction,
                  (!outputText || isExporting || pressed) && styles.secondaryActionDisabled,
                ]}
                onPress={handleExportPdf}
                disabled={!outputText || Boolean(isExporting)}
              >
                {isExporting === 'pdf' ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <FileDown color={colors.text} size={18} />
                )}
                <Text style={styles.secondaryActionLabel}>Esporta PDF</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryAction,
                  (!outputText || isExporting || pressed) && styles.secondaryActionDisabled,
                ]}
                onPress={handleExportMarkdown}
                disabled={!outputText || Boolean(isExporting)}
              >
                {isExporting === 'markdown' ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <FileText color={colors.text} size={18} />
                )}
                <Text style={styles.secondaryActionLabel}>Esporta MD</Text>
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
        onDeleteEntry={handleDeleteHistoryEntry}
        onToggleFavorite={handleToggleHistoryFavorite}
      />
      <SettingsModal
        visible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
        temperature={temperature}
        onTemperatureChange={setTemperature}
        isBiometricEnabled={isBiometricEnabled}
        isBiometricAvailable={isBiometricHardwareAvailable}
        onToggleBiometric={handleToggleBiometric}
      />
      <NewPromptModal
        visible={isNewPromptVisible}
        onClose={() => setIsNewPromptVisible(false)}
        onSave={handleSaveNewPrompt}
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
    maxHeight: 220,
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
    paddingRight: spacing.md,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    ...glassBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  quickActionActive: {
    backgroundColor: colors.glowMuted,
    borderColor: colors.glowBorder,
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
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    ...glassBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modeChipNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.glowMuted,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.glowBorder,
    borderStyle: 'dashed',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modeChipNewLabel: {
    color: colors.glow,
    ...typography.body,
    fontWeight: '700',
  },
  languageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  languageChip: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    ...glassBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  toneGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  outputError: {
    flex: 1,
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
