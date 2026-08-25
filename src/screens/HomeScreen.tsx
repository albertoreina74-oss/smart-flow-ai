import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  ClipboardPaste,
  Copy,
  File as FileIcon,
  FileDown,
  FileSpreadsheet,
  FileText,
  FileType,
  Link2,
  ListChecks,
  Mic,
  MicOff,
  PenLine,
  Plus,
  Printer,
  Receipt,
  Share as ShareIcon,
  Share2,
  Sparkles,
  Square,
  SquareCheck,
  Star,
  Table,
  Trash2,
  TriangleAlert,
  Volume2,
  VolumeX,
  WandSparkles,
} from 'lucide-react-native';
import { Card } from '../components/Card';
import { ExportSheet } from '../components/ExportSheet';
import { NewPromptModal } from '../components/NewPromptModal';
import { SettingsModal } from '../components/SettingsModal';
import { SignatureModal } from '../components/SignatureModal';
import { StreamingCursor } from '../components/StreamingCursor';
import { Toast } from '../components/Toast';
import { WebLinkModal } from '../components/WebLinkModal';
import { colors, glassBorder, gradient, radius, spacing } from '../constants/theme';
import { screenStyles as s } from '../constants/sharedStyles';
import { DENSITY_LABELS, Density, MODE_LABELS, ProcessMode } from '../constants/prompts';
import { getFriendlyErrorMessage } from '../services/geminiService';
import { readClipboard, writeClipboard } from '../services/clipboardService';
import {
  exportResultAsCsv,
  exportResultAsDocx,
  exportResultAsMarkdown,
  exportResultAsPdf,
  exportResultAsTxt,
  exportResultAsXlsx,
  PdfQuality,
  printResult,
} from '../services/exportService';
import { authenticateWithBiometrics, isBiometricAvailable } from '../services/biometricService';
import {
  addCustomPrompt,
  CustomPrompt,
  getBiometricLockEnabled,
  getCustomPrompts,
  getSavedSignature,
  setBiometricLockEnabled,
} from '../services/storageService';
import { ExtractedArticle, extractArticleFromUrl } from '../services/webExtractorService';
import { IncomingImport } from '../hooks/useIncomingShareIntent';
import { pickBestVoiceForLocale } from '../services/speechVoiceService';
import { useGeminiProcessing } from '../hooks/useGeminiProcessing';
import { computeMetrics, formatMetrics } from '../utils/textMetrics';

const BUILTIN_TONE_OPTIONS: { id: ProcessMode; icon: typeof WandSparkles }[] = [
  { id: 'clean', icon: WandSparkles },
  { id: 'formal', icon: Briefcase },
  { id: 'summary', icon: ListChecks },
  { id: 'table', icon: Receipt },
];

const BUILTIN_MODE_IDS: string[] = BUILTIN_TONE_OPTIONS.map((option) => option.id);

function isBuiltinMode(id: string): id is ProcessMode {
  return BUILTIN_MODE_IDS.includes(id);
}

const DENSITY_OPTIONS: Density[] = ['essential', 'detailed'];

const QUICK_ACTIONS: { id: string; label: string; icon: typeof ClipboardPaste }[] = [
  { id: 'paste', label: 'Incolla', icon: ClipboardPaste },
  { id: 'clear', label: 'Cancella', icon: Trash2 },
  { id: 'dictate', label: 'Dettatura', icon: Mic },
];

const TOAST_DURATION_MS = 1800;

type HomeScreenProps = {
  /** A share-sheet or `smartflow://` deep-link payload waiting to be imported. */
  pendingImport?: IncomingImport | null;
  onPendingImportHandled?: () => void;
};

export function HomeScreen({ pendingImport, onPendingImportHandled }: HomeScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const [selectedTone, setSelectedTone] = useState<string>('clean');
  const [selectedDensity, setSelectedDensity] = useState<Density>('essential');
  const [temperature, setTemperature] = useState(0.7);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isNewPromptVisible, setIsNewPromptVisible] = useState(false);
  const [customPrompts, setCustomPrompts] = useState<CustomPrompt[]>([]);
  const [isExporting, setIsExporting] = useState<
    'pdf' | 'markdown' | 'csv' | 'xlsx' | 'txt' | 'docx' | 'print' | null
  >(null);
  const [lastProcessedMode, setLastProcessedMode] = useState<ProcessMode | null>(null);
  const [pdfQuality, setPdfQuality] = useState<PdfQuality>('high');
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isBiometricHardwareAvailable, setIsBiometricHardwareAvailable] = useState(false);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [includeSignature, setIncludeSignature] = useState(false);
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [isExportSheetVisible, setIsExportSheetVisible] = useState(false);
  const [isWebLinkModalVisible, setIsWebLinkModalVisible] = useState(false);

  const {
    outputText,
    isProcessing,
    errorMessage,
    setErrorMessage,
    currentEntryId,
    isCurrentFavorite,
    runProcessing,
    toggleFavorite,
  } = useGeminiProcessing();

  useEffect(() => {
    getCustomPrompts().then(setCustomPrompts);
  }, []);

  useEffect(() => {
    isBiometricAvailable().then(setIsBiometricHardwareAvailable);
    getBiometricLockEnabled().then(setIsBiometricEnabled);
  }, []);

  useEffect(() => {
    getSavedSignature().then(setSavedSignature);
  }, []);

  useEffect(() => {
    return () => {
      Speech.stop();
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
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), TOAST_DURATION_MS);
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

  const handleProcess = () => {
    const isCustom = !isBuiltinMode(selectedTone);
    const customPrompt = isCustom
      ? customPrompts.find((prompt) => `custom:${prompt.id}` === selectedTone)?.prompt
      : undefined;
    const modeLabel = isCustom
      ? customPrompts.find((prompt) => `custom:${prompt.id}` === selectedTone)?.label ??
        'Personalizzata'
      : MODE_LABELS[selectedTone as ProcessMode];
    const resolvedMode = isCustom ? 'clean' : (selectedTone as ProcessMode);
    Speech.stop();
    setIsSpeaking(false);
    setLastProcessedMode(resolvedMode);
    runProcessing(inputText, resolvedMode, selectedDensity, 'it', modeLabel, { customPrompt, temperature });
  };

  const handleWebExtracted = (article: ExtractedArticle) => {
    const combinedText = article.title ? `${article.title}\n\n${article.content}` : article.content;
    Speech.stop();
    setIsSpeaking(false);
    setInputText(combinedText);
    setSelectedTone('summary');
    setLastProcessedMode('summary');
    showToast('Articolo estratto, sintesi in corso...');
    runProcessing(combinedText, 'summary', selectedDensity, 'it', MODE_LABELS.summary, { temperature });
  };

  // Text shared from another app (share sheet) or from a
  // `smartflow://process?text=...` deep link — cleaned up directly.
  const handleImportedText = (text: string) => {
    Speech.stop();
    setIsSpeaking(false);
    setInputText(text);
    setSelectedTone('clean');
    setLastProcessedMode('clean');
    showToast('Testo importato, elaborazione in corso...');
    runProcessing(text, 'clean', selectedDensity, 'it', MODE_LABELS.clean, { temperature });
  };

  // A web link shared from another app or received via
  // `smartflow://extract-url?url=...` — extracted with the same Jina
  // Reader pipeline as the "Link Web" button, then summarized.
  const handleImportedUrl = async (url: string) => {
    showToast('Link importato, estrazione in corso...');
    try {
      const article = await extractArticleFromUrl(url);
      handleWebExtracted(article);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(getFriendlyErrorMessage(error));
    }
  };

  // Consumes a share-sheet/deep-link payload the moment it arrives — App.tsx
  // only mounts this screen with a `pendingImport` set (switching tabs to
  // Home first), so this fires once per import regardless of whether the
  // app was cold-started or already running.
  useEffect(() => {
    if (!pendingImport) {
      return;
    }
    if (pendingImport.kind === 'text') {
      handleImportedText(pendingImport.value);
    } else {
      handleImportedUrl(pendingImport.value);
    }
    onPendingImportHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingImport]);

  const handleCopyResult = async () => {
    if (!outputText) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await writeClipboard(outputText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('Copiato negli appunti');
  };

  const handleToggleSpeech = async () => {
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
    const voice = await pickBestVoiceForLocale('it-IT');
    Speech.speak(outputText, {
      language: 'it-IT',
      voice,
      pitch: 1.0,
      rate: 0.95,
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

  const handleToggleBiometric = async (enabled: boolean) => {
    if (enabled) {
      const authenticated = await authenticateWithBiometrics('Conferma per attivare il blocco dell\'archivio');
      if (!authenticated) {
        return;
      }
    }
    setIsBiometricEnabled(enabled);
    await setBiometricLockEnabled(enabled);
    showToast(enabled ? 'Blocco biometrico attivato' : 'Blocco biometrico disattivato');
  };

  const handleToggleIncludeSignature = () => {
    if (!savedSignature) {
      setIsSignatureModalVisible(true);
      return;
    }
    Haptics.selectionAsync();
    setIncludeSignature((value) => !value);
  };

  const handleSignatureSaved = (dataUri: string) => {
    setSavedSignature(dataUri);
    setIncludeSignature(true);
    showToast('Firma salvata');
  };

  const resolvedSignature = includeSignature && savedSignature ? savedSignature : undefined;

  const handleExportPdf = async () => {
    if (!outputText || isExporting) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExporting('pdf');
    try {
      await exportResultAsPdf(outputText, resolvedSignature, pdfQuality);
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsExporting(null);
    }
  };

  const handlePrint = async () => {
    if (!outputText || isExporting) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExporting('print');
    try {
      await printResult(outputText, resolvedSignature, pdfQuality);
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

  const handleExportTxt = async () => {
    if (!outputText || isExporting) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExporting('txt');
    try {
      await exportResultAsTxt(outputText);
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportDocx = async () => {
    if (!outputText || isExporting) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExporting('docx');
    try {
      await exportResultAsDocx(outputText);
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportCsv = async () => {
    if (!outputText || isExporting) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExporting('csv');
    try {
      await exportResultAsCsv(outputText);
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportXlsx = async () => {
    if (!outputText || isExporting) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExporting('xlsx');
    try {
      await exportResultAsXlsx(outputText);
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsExporting(null);
    }
  };

  const canProcess = inputText.trim().length > 0 && !isProcessing;
  const isTableResult = lastProcessedMode === 'table';
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
    <LinearGradient colors={gradient.background} style={s.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[s.scrollContent, { paddingTop: Math.max(insets.top, spacing.lg) }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.header}>
            <View>
              <Text style={s.headerTitle}>Smart Flow</Text>
              <Text style={s.headerSubtitle}>Rielabora il testo in un tocco</Text>
            </View>
            <View style={s.headerActions}>
              <Pressable
                style={({ pressed }) => [s.badge, pressed && s.iconButtonPressed]}
                onPress={handleOpenSettings}
                hitSlop={8}
              >
                <Sparkles color={colors.glow} size={14} />
                <Text style={s.badgeLabel}>AI</Text>
              </Pressable>
            </View>
          </View>

          <Card style={s.section}>
            <View style={s.header}>
              <Text style={s.sectionLabel}>Testo di partenza</Text>
              <View style={s.headerActions}>
                <Pressable
                  style={({ pressed }) => [s.iconButton, pressed && s.iconButtonPressed]}
                  onPress={() => setIsWebLinkModalVisible(true)}
                >
                  <Link2 color={colors.glow} size={18} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.iconButton, pressed && s.iconButtonPressed]}
                  onPress={() => handleQuickAction('clear')}
                >
                  <Trash2 color={colors.textMuted} size={18} />
                </Pressable>
              </View>
            </View>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Scrivi o incolla qui il testo da elaborare..."
              placeholderTextColor={colors.textMuted}
              multiline
              style={s.textArea}
            />
            <Text style={s.metricsText}>{formatMetrics(inputMetrics)}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.actionsRow}>
              {QUICK_ACTIONS.map(({ id, label, icon: Icon }) => {
                const isActive = id === 'dictate' && isRecording;
                return (
                  <Pressable
                    key={id}
                    style={({ pressed }) => [
                      s.actionChip,
                      isActive && s.actionChipActive,
                      pressed && s.actionChipPressed,
                    ]}
                    onPress={() => handleQuickAction(id)}
                  >
                    {isActive ? (
                      <MicOff color={colors.glow} size={18} />
                    ) : (
                      <Icon color={colors.text} size={18} />
                    )}
                    <Text style={s.actionChipLabel}>{isActive ? 'In ascolto…' : label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Card>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Modalità</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {allToneOptions.map(({ id, icon: Icon, label }) => {
                const isSelected = selectedTone === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => handleToneSelect(id)}
                    style={[s.chip, isSelected && s.optionSelected]}
                  >
                    <Icon color={isSelected ? colors.text : colors.textMuted} size={18} />
                    <Text style={[s.optionLabel, isSelected && s.optionLabelSelected]}>
                      {isBuiltinMode(id) ? MODE_LABELS[id] : label}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable style={s.chipNew} onPress={handleOpenNewPrompt}>
                <Plus color={colors.glow} size={18} />
                <Text style={s.chipNewLabel}>Nuovo</Text>
              </Pressable>
            </ScrollView>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Densità</Text>
            <View style={s.segmentedControl}>
              {DENSITY_OPTIONS.map((density) => {
                const isSelected = selectedDensity === density;
                return (
                  <Pressable
                    key={density}
                    onPress={() => handleDensitySelect(density)}
                    style={[s.segmentedOption, isSelected && s.segmentedOptionActive]}
                  >
                    <Text style={[s.segmentedLabel, isSelected && s.segmentedLabelActive]}>
                      {DENSITY_LABELS[density]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [s.primaryButtonWrapper, (!canProcess || pressed) && s.primaryButtonDisabled]}
            onPress={handleProcess}
            disabled={!canProcess}
          >
            <LinearGradient colors={gradient.action} style={s.primaryButton}>
              {isProcessing ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Sparkles color={colors.textOnPrimary} size={18} />
              )}
              <Text style={s.primaryButtonLabel}>
                {isProcessing ? 'Elaborazione...' : 'Rielabora testo'}
              </Text>
            </LinearGradient>
          </Pressable>

          <Card style={s.section}>
            <Text style={s.sectionLabel}>Risultato</Text>
            <View style={s.outputBox}>
              {errorMessage ? (
                <View style={s.errorRow}>
                  <TriangleAlert color={colors.danger} size={18} />
                  <Text style={s.outputError}>{errorMessage}</Text>
                </View>
              ) : isProcessing && !outputText ? (
                <ActivityIndicator color={colors.glow} />
              ) : (
                <View style={s.outputTextRow}>
                  <Text style={outputText ? s.outputText : s.outputPlaceholder}>
                    {outputText || 'Il testo rielaborato apparirà qui.'}
                  </Text>
                  {isProcessing && outputText ? <StreamingCursor /> : null}
                </View>
              )}
            </View>
            <Text style={s.metricsText}>{formatMetrics(outputMetrics)}</Text>

            <View style={s.chipRow}>
              <Pressable
                style={({ pressed }) => [s.secondaryAction, (!outputText || pressed) && s.secondaryActionDisabled]}
                onPress={handleToggleSpeech}
                disabled={!outputText}
              >
                {isSpeaking ? <VolumeX color={colors.text} size={18} /> : <Volume2 color={colors.text} size={18} />}
                <Text style={s.secondaryActionLabel}>{isSpeaking ? 'Ferma' : 'Ascolta'}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  s.secondaryAction,
                  (!currentEntryId || pressed) && s.secondaryActionDisabled,
                ]}
                onPress={toggleFavorite}
                disabled={!currentEntryId}
              >
                <Star
                  color={isCurrentFavorite ? colors.glow : colors.text}
                  fill={isCurrentFavorite ? colors.glow : 'transparent'}
                  size={18}
                />
                <Text style={s.secondaryActionLabel}>{isCurrentFavorite ? 'Preferito' : 'Preferisci'}</Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [s.shareButton, (!outputText || pressed) && s.secondaryActionDisabled]}
              onPress={() => setIsExportSheetVisible(true)}
              disabled={!outputText}
            >
              <ShareIcon color={colors.glow} size={19} />
              <Text style={s.shareButtonLabel}>Esporta / Condividi</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                s.primaryFilledButton,
                (!outputText || pressed) && s.primaryFilledButtonPressed,
              ]}
              onPress={handleCopyResult}
              disabled={!outputText}
            >
              <Copy color={colors.textOnPrimary} size={20} />
              <Text style={s.primaryFilledButtonLabel}>Copia Risultato</Text>
            </Pressable>
          </Card>
          <View style={styles.tabBarSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast message={toastMessage} visible={Boolean(toastMessage)} />
      <ExportSheet
        visible={isExportSheetVisible}
        onClose={() => setIsExportSheetVisible(false)}
        header={
          <View style={styles.sheetHeader}>
            <View style={s.chipRow}>
              <Pressable
                style={({ pressed }) => [styles.signatureToggle, pressed && styles.signatureTogglePressed]}
                onPress={handleToggleIncludeSignature}
              >
                {includeSignature && savedSignature ? (
                  <SquareCheck color={colors.glow} size={18} />
                ) : (
                  <Square color={colors.textMuted} size={18} />
                )}
                <Text style={styles.signatureToggleLabel}>Includi firma</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.signatureManageButton, pressed && styles.signatureTogglePressed]}
                onPress={() => setIsSignatureModalVisible(true)}
              >
                <PenLine color={colors.text} size={18} />
              </Pressable>
            </View>
            <View style={s.segmentedControl}>
              <Pressable
                style={[s.segmentedOption, pdfQuality === 'high' && s.segmentedOptionActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPdfQuality('high');
                }}
              >
                <Text style={[s.segmentedLabel, pdfQuality === 'high' && s.segmentedLabelActive]}>
                  Qualità Alta
                </Text>
              </Pressable>
              <Pressable
                style={[s.segmentedOption, pdfQuality === 'compact' && s.segmentedOptionActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPdfQuality('compact');
                }}
              >
                <Text style={[s.segmentedLabel, pdfQuality === 'compact' && s.segmentedLabelActive]}>
                  Compatto per Email
                </Text>
              </Pressable>
            </View>
          </View>
        }
        options={[
          { key: 'share', label: 'Condividi testo', icon: Share2, onPress: handleShare },
          { key: 'pdf', label: 'Esporta PDF', icon: FileDown, onPress: handleExportPdf, loading: isExporting === 'pdf' },
          { key: 'print', label: 'Stampa', icon: Printer, onPress: handlePrint, loading: isExporting === 'print' },
          {
            key: 'markdown',
            label: 'Esporta Markdown',
            icon: FileText,
            onPress: handleExportMarkdown,
            loading: isExporting === 'markdown',
          },
          { key: 'txt', label: 'Esporta TXT', icon: FileIcon, onPress: handleExportTxt, loading: isExporting === 'txt' },
          {
            key: 'docx',
            label: 'Esporta Word',
            icon: FileType,
            onPress: handleExportDocx,
            loading: isExporting === 'docx',
          },
          ...(isTableResult
            ? [
                {
                  key: 'xlsx',
                  label: 'Esporta Excel (.xlsx)',
                  icon: FileSpreadsheet,
                  onPress: handleExportXlsx,
                  loading: isExporting === 'xlsx',
                },
                {
                  key: 'csv',
                  label: 'Esporta CSV',
                  icon: Table,
                  onPress: handleExportCsv,
                  loading: isExporting === 'csv',
                },
              ]
            : []),
        ]}
      />
      <SignatureModal
        visible={isSignatureModalVisible}
        onClose={() => setIsSignatureModalVisible(false)}
        onSaved={handleSignatureSaved}
      />
      <WebLinkModal
        visible={isWebLinkModalVisible}
        onClose={() => setIsWebLinkModalVisible(false)}
        onExtracted={handleWebExtracted}
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
  signatureToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...glassBorder,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  signatureManageButton: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...glassBorder,
  },
  signatureTogglePressed: {
    backgroundColor: colors.surfaceElevated,
  },
  signatureToggleLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  tabBarSpacer: {
    height: 96,
  },
  sheetHeader: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
});
