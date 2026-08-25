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
  ClipboardPaste,
  Copy,
  File as FileIcon,
  FileDown,
  FileText,
  FileType,
  Image as ImageIcon,
  Printer,
  Share2,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import { Card } from '../components/Card';
import { Toast } from '../components/Toast';
import { colors, gradient, spacing } from '../constants/theme';
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
import { enhanceScanImage, normalizeNativeScan } from '../services/scanEnhanceService';
import {
  isNativeDocumentScannerAvailable,
  scanDocumentPagesNative,
} from '../services/nativeDocumentScannerService';
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

  const handleCameraScan = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsCapturingImage('camera');
    setErrorMessage('');
    try {
      if (isNativeDocumentScannerAvailable()) {
        const outcome = await scanDocumentPagesNative();
        if (!outcome || outcome.cancelled || outcome.imageUris.length === 0) {
          return;
        }
        const enhanced = await normalizeNativeScan(outcome.imageUris[0]);
        await runOcrAndTranslate(enhanced.base64, enhanced.mimeType);
        return;
      }
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
      language: LANGUAGE_SPEECH_LOCALES[targetLanguage],
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

          <View style={s.section}>
            <Text style={s.sectionLabel}>Da</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {SOURCE_LANGUAGE_OPTIONS.map(({ id, label }) => {
                const isSelected = sourceLanguage === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSourceLanguage(id);
                    }}
                    style={[s.pill, isSelected && s.optionSelected]}
                  >
                    <Text style={[s.optionLabel, isSelected && s.optionLabelSelected]}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <Pressable
            style={({ pressed }) => [styles.swapButton, pressed && styles.swapButtonPressed]}
            onPress={handleSwapLanguages}
            disabled={sourceLanguage === 'auto'}
          >
            <ArrowRightLeft
              color={sourceLanguage === 'auto' ? colors.textMuted : colors.glow}
              size={18}
            />
          </Pressable>

          <View style={s.section}>
            <Text style={s.sectionLabel}>A</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {LANGUAGE_OPTIONS.map(({ id, label }) => {
                const isSelected = targetLanguage === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setTargetLanguage(id);
                    }}
                    style={[s.pill, isSelected && s.optionSelected]}
                  >
                    <Text style={[s.optionLabel, isSelected && s.optionLabelSelected]}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Registro</Text>
            <View style={s.optionGrid}>
              {REGISTER_OPTIONS.map((option) => {
                const isSelected = register === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setRegister(option);
                    }}
                    style={[s.optionCard, isSelected && s.optionSelected]}
                  >
                    <Text style={[s.optionLabel, isSelected && s.optionLabelSelected]}>
                      {REGISTER_LABELS[option]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={s.optionGrid}>
            <Pressable
              style={({ pressed }) => [
                s.optionCard,
                styles.sourceCard,
                pressed && s.actionChipPressed,
                isCapturingImage === 'camera' && s.optionSelected,
              ]}
              onPress={handleCameraScan}
              disabled={Boolean(isCapturingImage)}
            >
              {isCapturingImage === 'camera' ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Camera color={colors.glow} size={26} />
              )}
              <Text style={styles.sourceLabel}>📷 Fotocamera</Text>
              <Text style={styles.sourceHint}>Scansiona</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                s.optionCard,
                styles.sourceCard,
                pressed && s.actionChipPressed,
                isCapturingImage === 'gallery' && s.optionSelected,
              ]}
              onPress={handleGalleryPick}
              disabled={Boolean(isCapturingImage)}
            >
              {isCapturingImage === 'gallery' ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <ImageIcon color={colors.glow} size={26} />
              )}
              <Text style={styles.sourceLabel}>🖼️ Galleria</Text>
              <Text style={styles.sourceHint}>Estrai e traduci</Text>
            </Pressable>
          </View>

          <Card style={s.section}>
            <Text style={s.sectionLabel}>Testo di partenza</Text>
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
                <Text style={outputText ? s.outputText : s.outputPlaceholder}>
                  {outputText || 'La traduzione apparirà qui.'}
                </Text>
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
              <Pressable
                style={({ pressed }) => [s.secondaryAction, (!outputText || pressed) && s.secondaryActionDisabled]}
                onPress={handleShare}
                disabled={!outputText}
              >
                <Share2 color={colors.text} size={18} />
                <Text style={s.secondaryActionLabel}>Condividi</Text>
              </Pressable>
            </View>

            <View style={s.optionGrid}>
              <Pressable
                style={[s.optionCard, pdfQuality === 'high' && s.optionSelected]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPdfQuality('high');
                }}
              >
                <Text style={[s.optionLabel, pdfQuality === 'high' && s.optionLabelSelected]}>
                  Qualità Alta
                </Text>
              </Pressable>
              <Pressable
                style={[s.optionCard, pdfQuality === 'compact' && s.optionSelected]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPdfQuality('compact');
                }}
              >
                <Text style={[s.optionLabel, pdfQuality === 'compact' && s.optionLabelSelected]}>
                  Compatto per Email
                </Text>
              </Pressable>
            </View>

            <View style={s.chipRow}>
              <Pressable
                style={({ pressed }) => [
                  s.secondaryAction,
                  (!outputText || isExporting || pressed) && s.secondaryActionDisabled,
                ]}
                onPress={handleExportPdf}
                disabled={!outputText || Boolean(isExporting)}
              >
                {isExporting === 'pdf' ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <FileDown color={colors.text} size={18} />
                )}
                <Text style={s.secondaryActionLabel}>Esporta PDF</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  s.secondaryAction,
                  (!outputText || isExporting || pressed) && s.secondaryActionDisabled,
                ]}
                onPress={handlePrint}
                disabled={!outputText || Boolean(isExporting)}
              >
                {isExporting === 'print' ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <Printer color={colors.text} size={18} />
                )}
                <Text style={s.secondaryActionLabel}>Stampa</Text>
              </Pressable>
            </View>

            <View style={s.chipRow}>
              <Pressable
                style={({ pressed }) => [
                  s.secondaryAction,
                  (!outputText || isExporting || pressed) && s.secondaryActionDisabled,
                ]}
                onPress={handleExportMarkdown}
                disabled={!outputText || Boolean(isExporting)}
              >
                {isExporting === 'markdown' ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <FileText color={colors.text} size={18} />
                )}
                <Text style={s.secondaryActionLabel}>Esporta MD</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  s.secondaryAction,
                  (!outputText || isExporting || pressed) && s.secondaryActionDisabled,
                ]}
                onPress={handleExportTxt}
                disabled={!outputText || Boolean(isExporting)}
              >
                {isExporting === 'txt' ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <FileIcon color={colors.text} size={18} />
                )}
                <Text style={s.secondaryActionLabel}>Esporta TXT</Text>
              </Pressable>
            </View>

            <View style={s.chipRow}>
              <Pressable
                style={({ pressed }) => [
                  s.secondaryAction,
                  (!outputText || isExporting || pressed) && s.secondaryActionDisabled,
                ]}
                onPress={handleExportDocx}
                disabled={!outputText || Boolean(isExporting)}
              >
                {isExporting === 'docx' ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <FileType color={colors.text} size={18} />
                )}
                <Text style={s.secondaryActionLabel}>Esporta Word</Text>
              </Pressable>
            </View>

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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  sourceCard: {
    gap: spacing.xs,
  },
  sourceLabel: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
    marginTop: spacing.xs,
  },
  sourceHint: {
    color: colors.textMuted,
    fontSize: 12,
  },
  swapButton: {
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: -spacing.sm,
  },
  swapButtonPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  tabBarSpacer: {
    height: 96,
  },
});
