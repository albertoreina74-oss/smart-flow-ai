import React, { useState } from 'react';
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
  ArrowRightLeft,
  Camera,
  Check,
  ClipboardPaste,
  Copy,
  File as FileIcon,
  FileDown,
  FileText,
  FileType,
  Image as ImageIcon,
  Printer,
  Share as ShareIcon,
  Share2,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import { Card } from '../components/Card';
import { AppModal } from '../components/Modal';
import { StreamingCursor } from '../components/StreamingCursor';
import { pickBestVoiceForLocale } from '../services/speechVoiceService';
import { ExportSheet } from '../components/ExportSheet';
import { Toast } from '../components/Toast';
import { colors, glassBorder, gradient, radius, spacing, typography } from '../constants/theme';
import { screenStyles as s } from '../constants/sharedStyles';
import {
  buildTranslatePrompt,
  Language,
  LANGUAGE_SPEECH_LOCALES,
  REGISTER_LABELS,
  SOURCE_LANGUAGE_OPTIONS,
  SourceLanguage,
  LANGUAGE_OPTIONS,
  TranslationRegister,
} from '../constants/prompts';
import { extractTextFromImage, getFriendlyErrorMessage } from '../services/geminiService';
import { readClipboard, writeClipboard } from '../services/clipboardService';
import {
  exportResultAsDocx,
  exportResultAsMarkdown,
  exportResultAsPdf,
  exportResultAsTxt,
  PdfQuality,
  printResult,
} from '../services/exportService';
import { pickImageFromCamera, pickImagesFromLibrary } from '../services/imagePickerService';
import { enhanceScanImage } from '../services/scanEnhanceService';
import { useGeminiProcessing } from '../hooks/useGeminiProcessing';
import { computeMetrics, formatMetrics } from '../utils/textMetrics';

const REGISTER_OPTIONS: TranslationRegister[] = ['natural', 'formal'];
const TOAST_DURATION_MS = 1800;

export function TranslateScreen() {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState<SourceLanguage>('auto');
  const [targetLanguage, setTargetLanguage] = useState<Language>('en');
  const [register, setRegister] = useState<TranslationRegister>('natural');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isExporting, setIsExporting] = useState<'pdf' | 'markdown' | 'txt' | 'docx' | 'print' | null>(null);
  const [pdfQuality, setPdfQuality] = useState<PdfQuality>('high');
  const [toastMessage, setToastMessage] = useState('');
  const [isCapturingImage, setIsCapturingImage] = useState<'camera' | 'gallery' | null>(null);
  const [isExportSheetVisible, setIsExportSheetVisible] = useState(false);
  const [activeLanguagePicker, setActiveLanguagePicker] = useState<'source' | 'target' | null>(null);

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

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), TOAST_DURATION_MS);
  };

  const handleSwapLanguages = () => {
    if (sourceLanguage === 'auto') {
      return;
    }
    Haptics.selectionAsync();
    const nextSource = targetLanguage;
    setTargetLanguage(sourceLanguage);
    setSourceLanguage(nextSource);
  };

  const handlePaste = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const clipboardText = await readClipboard();
    if (clipboardText) {
      setInputText(clipboardText);
    }
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText('');
    setErrorMessage('');
  };

  const handleProcess = (textOverride?: string) => {
    const sourceText = textOverride ?? inputText;
    Speech.stop();
    setIsSpeaking(false);
    const customPrompt = buildTranslatePrompt(targetLanguage, sourceLanguage, register);
    runProcessing(sourceText, 'clean', 'essential', targetLanguage, '🌐 Traduci', { customPrompt });
  };

  const runOcrAndTranslate = async (base64: string, mimeType: string) => {
    const extracted = await extractTextFromImage(base64, mimeType);
    setInputText(extracted);
    if (extracted.trim()) {
      handleProcess(extracted);
    }
  };

  // Bypasses the native VisionKit scanner on purpose — see the matching
  // comment in DocumentsScreen.tsx's handleCameraPress for why. The plain
  // camera capture below only fires on an explicit user tap and has no
  // extra crop-review screen.
  const handleCameraScan = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsCapturingImage('camera');
    setErrorMessage('');
    try {
      const image = await pickImageFromCamera();
      if (!image) {
        return;
      }
      const enhanced = await enhanceScanImage(image.uri, image.width, image.height);
      await runOcrAndTranslate(enhanced.base64, enhanced.mimeType);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsCapturingImage(null);
    }
  };

  const handleGalleryPick = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsCapturingImage('gallery');
    setErrorMessage('');
    try {
      const images = await pickImagesFromLibrary();
      if (images.length === 0) {
        return;
      }
      const enhanced = await enhanceScanImage(images[0].uri, images[0].width, images[0].height);
      await runOcrAndTranslate(enhanced.base64, enhanced.mimeType);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsCapturingImage(null);
    }
  };

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
    const locale = LANGUAGE_SPEECH_LOCALES[targetLanguage];
    const voice = await pickBestVoiceForLocale(locale);
    Speech.speak(outputText, {
      language: locale,
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

  const handleExportPdf = async () => {
    if (!outputText || isExporting) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExporting('pdf');
    try {
      await exportResultAsPdf(outputText, undefined, pdfQuality);
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
      await printResult(outputText, undefined, pdfQuality);
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

  const canProcess = inputText.trim().length > 0 && !isProcessing;
  const inputMetrics = computeMetrics(inputText);
  const outputMetrics = computeMetrics(outputText);
  const sourceLabel = SOURCE_LANGUAGE_OPTIONS.find((option) => option.id === sourceLanguage)?.label ?? '';
  const targetLabel = LANGUAGE_OPTIONS.find((option) => option.id === targetLanguage)?.label ?? '';

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
              <Text style={s.headerTitle}>🌐 Traduci</Text>
              <Text style={s.headerSubtitle}>Traduzione fedele in tempo reale</Text>
            </View>
          </View>

          <View style={styles.languageBar}>
            <Pressable
              style={({ pressed }) => [styles.languagePill, pressed && styles.languagePillPressed]}
              onPress={() => setActiveLanguagePicker('source')}
            >
              <Text style={styles.languagePillLabel} numberOfLines={1}>
                {sourceLabel}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.swapButton, pressed && styles.swapButtonPressed]}
              onPress={handleSwapLanguages}
              disabled={sourceLanguage === 'auto'}
              hitSlop={8}
            >
              <ArrowRightLeft
                color={sourceLanguage === 'auto' ? colors.textMuted : colors.glow}
                size={16}
              />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.languagePill, pressed && styles.languagePillPressed]}
              onPress={() => setActiveLanguagePicker('target')}
            >
              <Text style={styles.languagePillLabel} numberOfLines={1}>
                {targetLabel}
              </Text>
            </Pressable>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Registro</Text>
            <View style={s.segmentedControl}>
              {REGISTER_OPTIONS.map((option) => {
                const isSelected = register === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setRegister(option);
                    }}
                    style={[s.segmentedOption, isSelected && s.segmentedOptionActive]}
                  >
                    <Text style={[s.segmentedLabel, isSelected && s.segmentedLabelActive]}>
                      {REGISTER_LABELS[option]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Card style={s.section}>
            <View style={s.header}>
              <Text style={s.sectionLabel}>Testo di partenza</Text>
              <View style={s.headerActions}>
                <Pressable
                  style={({ pressed }) => [s.iconButton, pressed && s.iconButtonPressed]}
                  onPress={handleCameraScan}
                  disabled={Boolean(isCapturingImage)}
                >
                  {isCapturingImage === 'camera' ? (
                    <ActivityIndicator color={colors.glow} size="small" />
                  ) : (
                    <Camera color={colors.glow} size={18} />
                  )}
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.iconButton, pressed && s.iconButtonPressed]}
                  onPress={handleGalleryPick}
                  disabled={Boolean(isCapturingImage)}
                >
                  {isCapturingImage === 'gallery' ? (
                    <ActivityIndicator color={colors.glow} size="small" />
                  ) : (
                    <ImageIcon color={colors.glow} size={18} />
                  )}
                </Pressable>
              </View>
            </View>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Scrivi o incolla il testo da tradurre..."
              placeholderTextColor={colors.textMuted}
              multiline
              style={s.textArea}
            />
            <Text style={s.metricsText}>{formatMetrics(inputMetrics)}</Text>
            <View style={s.chipRow}>
              <Pressable
                style={({ pressed }) => [s.actionChip, pressed && s.actionChipPressed]}
                onPress={handlePaste}
              >
                <ClipboardPaste color={colors.text} size={18} />
                <Text style={s.actionChipLabel}>Incolla</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.actionChip, pressed && s.actionChipPressed]}
                onPress={handleClear}
              >
                <Trash2 color={colors.text} size={18} />
                <Text style={s.actionChipLabel}>Cancella</Text>
              </Pressable>
            </View>
          </Card>

          <Pressable
            style={({ pressed }) => [s.primaryButtonWrapper, (!canProcess || pressed) && s.primaryButtonDisabled]}
            onPress={() => handleProcess()}
            disabled={!canProcess}
          >
            <LinearGradient colors={gradient.action} style={s.primaryButton}>
              {isProcessing ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Sparkles color={colors.textOnPrimary} size={18} />
              )}
              <Text style={s.primaryButtonLabel}>{isProcessing ? 'Traduzione...' : 'Traduci testo'}</Text>
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
                    {outputText || 'La traduzione apparirà qui.'}
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
        ]}
      />
      <AppModal
        visible={activeLanguagePicker !== null}
        onClose={() => setActiveLanguagePicker(null)}
      >
        <Text style={styles.pickerTitle}>
          {activeLanguagePicker === 'source' ? 'Traduci da' : 'Traduci verso'}
        </Text>
        <View style={styles.pickerList}>
          {(activeLanguagePicker === 'source' ? SOURCE_LANGUAGE_OPTIONS : LANGUAGE_OPTIONS).map((option) => {
            const isSelected =
              activeLanguagePicker === 'source' ? sourceLanguage === option.id : targetLanguage === option.id;
            return (
              <Pressable
                key={option.id}
                style={({ pressed }) => [styles.pickerRow, pressed && styles.pickerRowPressed]}
                onPress={() => {
                  Haptics.selectionAsync();
                  if (activeLanguagePicker === 'source') {
                    setSourceLanguage(option.id as SourceLanguage);
                  } else {
                    setTargetLanguage(option.id as Language);
                  }
                  setActiveLanguagePicker(null);
                }}
              >
                <Text style={styles.pickerRowLabel}>{option.label}</Text>
                {isSelected && <Check color={colors.glow} size={18} />}
              </Pressable>
            );
          })}
        </View>
      </AppModal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  languageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  languagePill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    ...glassBorder,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  languagePillPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  languagePillLabel: {
    color: colors.text,
    ...typography.body,
    fontWeight: '600',
  },
  swapButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  swapButtonPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  pickerTitle: {
    color: colors.text,
    ...typography.title,
    marginBottom: spacing.md,
  },
  pickerList: {
    gap: spacing.xs,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...glassBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pickerRowPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  pickerRowLabel: {
    color: colors.text,
    ...typography.body,
    fontWeight: '600',
  },
  tabBarSpacer: {
    height: 96,
  },
});
