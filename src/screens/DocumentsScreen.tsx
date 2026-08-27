import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
  ChevronLeft,
  ChevronRight,
  Copy,
  File as FileIcon,
  FileDown,
  FileSpreadsheet,
  FileText,
  FileType,
  Layers,
  Link2,
  ListChecks,
  PenLine,
  Plus,
  Printer,
  Receipt,
  Scan,
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
  X,
} from 'lucide-react-native';
import { Card } from '../components/Card';
import { ExportSheet } from '../components/ExportSheet';
import { RefineBar } from '../components/RefineBar';
import { SignatureModal } from '../components/SignatureModal';
import { StreamingCursor } from '../components/StreamingCursor';
import { Toast } from '../components/Toast';
import { WebLinkModal } from '../components/WebLinkModal';
import { colors, glassBorder, gradient, radius, spacing } from '../constants/theme';
import { screenStyles as s } from '../constants/sharedStyles';
import { DENSITY_LABELS, Density, MODE_LABELS, NonTranslateMode } from '../constants/prompts';
import {
  extractTextFromDocument,
  extractTextFromImage,
  getFriendlyErrorMessage,
} from '../services/geminiService';
import { getSavedSignature } from '../services/storageService';
import { writeClipboard } from '../services/clipboardService';
import { pickImageFromCamera, pickImagesFromLibrary } from '../services/imagePickerService';
import { cropAndEnhanceScanImage, type EnhancedScan } from '../services/scanEnhanceService';
import { CropModal } from '../components/CropModal';
import { useImageCrop } from '../hooks/useImageCrop';
import { pickDocument } from '../services/documentService';
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
import { ExtractedArticle } from '../services/webExtractorService';
import { runShareAction, shareText } from '../services/shareService';
import { pickBestVoiceForLocale } from '../services/speechVoiceService';
import { useGeminiProcessing } from '../hooks/useGeminiProcessing';
import { computeMetrics, formatMetrics } from '../utils/textMetrics';

type ScanPage = {
  id: string;
  uri: string;
  base64: string;
  mimeType: string;
};

let scanPageCounter = 0;
function nextScanPageId(): string {
  scanPageCounter += 1;
  return `scan-${Date.now()}-${scanPageCounter}`;
}

const TONE_OPTIONS: { id: NonTranslateMode; icon: typeof WandSparkles }[] = [
  { id: 'clean', icon: WandSparkles },
  { id: 'formal', icon: Briefcase },
  { id: 'summary', icon: ListChecks },
  { id: 'table', icon: Receipt },
];

const DENSITY_OPTIONS: Density[] = ['essential', 'detailed'];
const TOAST_DURATION_MS = 1800;

export function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const [extractedText, setExtractedText] = useState('');
  const [selectedTone, setSelectedTone] = useState<NonTranslateMode>('clean');
  const [selectedDensity, setSelectedDensity] = useState<Density>('essential');
  const [isScanning, setIsScanning] = useState(false);
  const [isDocumentLoading, setIsDocumentLoading] = useState(false);
  const [scanPages, setScanPages] = useState<ScanPage[]>([]);
  const [isExtractingPages, setIsExtractingPages] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isExporting, setIsExporting] = useState<
    'pdf' | 'markdown' | 'csv' | 'xlsx' | 'txt' | 'docx' | 'print' | null
  >(null);
  const [lastProcessedMode, setLastProcessedMode] = useState<NonTranslateMode | null>(null);
  const [pdfQuality, setPdfQuality] = useState<PdfQuality>('high');
  const [toastMessage, setToastMessage] = useState('');
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [includeSignature, setIncludeSignature] = useState(false);
  const [isSignatureModalVisible, setIsSignatureModalVisible] = useState(false);
  const [isExportSheetVisible, setIsExportSheetVisible] = useState(false);
  const [isWebLinkModalVisible, setIsWebLinkModalVisible] = useState(false);

  useEffect(() => {
    getSavedSignature().then(setSavedSignature);
  }, []);

  const {
    outputText,
    isProcessing,
    errorMessage,
    setErrorMessage,
    currentEntryId,
    isCurrentFavorite,
    runProcessing,
    toggleFavorite,
    isRefining,
    canUndoRefine,
    refineResult,
    undoRefine,
  } = useGeminiProcessing();

  const { cropRequest, requestCrop, confirmCrop, cancelCrop } = useImageCrop();

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), TOAST_DURATION_MS);
  };

  const addScanPageFromCamera = async () => {
    setIsScanning(true);
    setErrorMessage('');
    try {
      const image = await pickImageFromCamera();
      if (!image) {
        return;
      }
      const rect = await requestCrop({ uri: image.uri, width: image.width, height: image.height });
      if (!rect) {
        return;
      }
      const enhanced = await cropAndEnhanceScanImage(image.uri, image.width, image.height, rect);
      setScanPages((pages) => [
        ...pages,
        { id: nextScanPageId(), uri: enhanced.uri, base64: enhanced.base64, mimeType: enhanced.mimeType },
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsScanning(false);
    }
  };

  const addScanPagesFromLibrary = async () => {
    setIsScanning(true);
    setErrorMessage('');
    try {
      const images = await pickImagesFromLibrary();
      if (images.length === 0) {
        return;
      }
      // Sequential rather than `Promise.all`: each page gets its own crop
      // step, and those have to be presented one at a time. Cancelling a
      // crop skips just that page and moves on to the next.
      const enhanced: EnhancedScan[] = [];
      for (let index = 0; index < images.length; index += 1) {
        const image = images[index];
        const rect = await requestCrop({
          uri: image.uri,
          width: image.width,
          height: image.height,
          index,
          total: images.length,
        });
        if (!rect) {
          continue;
        }
        enhanced.push(await cropAndEnhanceScanImage(image.uri, image.width, image.height, rect));
      }
      if (enhanced.length === 0) {
        return;
      }
      setScanPages((pages) => [
        ...pages,
        ...enhanced.map((image) => ({
          id: nextScanPageId(),
          uri: image.uri,
          base64: image.base64,
          mimeType: image.mimeType,
        })),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsScanning(false);
    }
  };

  // Deliberately bypasses the native VisionKit document scanner
  // (`react-native-document-scanner-plugin`): VNDocumentCameraViewController
  // doesn't expose any public API to disable its auto-capture or its
  // post-shot perspective-crop review screen, and on-device that review
  // screen was positioning its crop handles incorrectly and losing edits.
  // The plain camera capture (allowsEditing: false) is fully manual — the
  // shutter only fires on an explicit tap. Cropping is handled afterwards by
  // our own `CropModal`, which we control: `allowsEditing: true` is no help
  // here because on iOS its crop rect is locked to a square (`aspect` is
  // Android-only) and it's ignored entirely for multi-image selection.
  const handleCameraPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Scansiona documento', 'Scegli la sorgente. Puoi aggiungere più pagine di seguito.', [
      { text: 'Scatta foto', onPress: addScanPageFromCamera },
      { text: 'Scegli dalla libreria', onPress: addScanPagesFromLibrary },
      { text: 'Annulla', style: 'cancel' },
    ]);
  };

  const handleRemoveScanPage = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScanPages((pages) => pages.filter((page) => page.id !== id));
  };

  const handleMoveScanPage = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    setScanPages((pages) => {
      if (targetIndex < 0 || targetIndex >= pages.length) {
        return pages;
      }
      Haptics.selectionAsync();
      const next = [...pages];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const handleClearScanPages = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScanPages([]);
  };

  const handleExtractScanPages = async () => {
    if (scanPages.length === 0 || isExtractingPages) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsExtractingPages(true);
    setErrorMessage('');
    const sections: string[] = [];
    let failures = 0;
    for (let i = 0; i < scanPages.length; i += 1) {
      const page = scanPages[i];
      try {
        const text = await extractTextFromImage(page.base64, page.mimeType);
        sections.push(scanPages.length > 1 ? `## Pagina ${i + 1}\n\n${text}` : text);
      } catch (error) {
        failures += 1;
        sections.push(`## Pagina ${i + 1}\n\n[Errore estrazione: ${getFriendlyErrorMessage(error)}]`);
      }
    }
    setExtractedText(sections.join('\n\n'));
    setScanPages([]);
    setIsExtractingPages(false);
    if (failures === scanPages.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(
        failures > 0
          ? `Testo unificato, ${failures} ${failures > 1 ? 'pagine non riuscite' : 'pagina non riuscita'}`
          : `Testo unificato da ${scanPages.length} pagine`,
      );
    }
  };

  const handleDocumentPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsDocumentLoading(true);
    setErrorMessage('');
    try {
      const picked = await pickDocument();
      if (!picked) {
        return;
      }
      const text =
        picked.kind === 'text' ? picked.text : await extractTextFromDocument(picked.base64, picked.mimeType);
      setExtractedText(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsDocumentLoading(false);
    }
  };

  const handleToneSelect = (tone: NonTranslateMode) => {
    Haptics.selectionAsync();
    setSelectedTone(tone);
  };

  const handleDensitySelect = (density: Density) => {
    Haptics.selectionAsync();
    setSelectedDensity(density);
  };

  const handleProcess = () => {
    Speech.stop();
    setIsSpeaking(false);
    setLastProcessedMode(selectedTone);
    runProcessing(extractedText, selectedTone, selectedDensity, 'it', MODE_LABELS[selectedTone]);
  };

  const handleWebExtracted = (article: ExtractedArticle) => {
    const combinedText = article.title ? `${article.title}\n\n${article.content}` : article.content;
    Speech.stop();
    setIsSpeaking(false);
    setExtractedText(combinedText);
    setSelectedTone('summary');
    setLastProcessedMode('summary');
    showToast('Articolo estratto, sintesi in corso...');
    runProcessing(combinedText, 'summary', selectedDensity, 'it', MODE_LABELS.summary);
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
    await shareText(outputText);
  };

  // `runAfterDismiss` comes from the export sheet: with no signature saved yet
  // this opens the signature modal, and a second modal cannot be presented
  // while the sheet is still up — iOS refuses, and the app stops responding.
  const handleToggleIncludeSignature = (runAfterDismiss: (action: () => void) => void) => {
    if (!savedSignature) {
      runAfterDismiss(() => setIsSignatureModalVisible(true));
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
    await runShareAction(() => exportResultAsPdf(outputText, resolvedSignature, pdfQuality));
    setIsExporting(null);
  };

  const handlePrint = async () => {
    if (!outputText || isExporting) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExporting('print');
    await runShareAction(() => printResult(outputText, resolvedSignature, pdfQuality));
    setIsExporting(null);
  };

  const handleExportMarkdown = async () => {
    if (!outputText || isExporting) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExporting('markdown');
    await runShareAction(() => exportResultAsMarkdown(outputText));
    setIsExporting(null);
  };

  const handleExportTxt = async () => {
    if (!outputText || isExporting) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExporting('txt');
    await runShareAction(() => exportResultAsTxt(outputText));
    setIsExporting(null);
  };

  const handleExportDocx = async () => {
    if (!outputText || isExporting) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExporting('docx');
    await runShareAction(() => exportResultAsDocx(outputText));
    setIsExporting(null);
  };

  const handleExportCsv = async () => {
    if (!outputText || isExporting) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExporting('csv');
    await runShareAction(() => exportResultAsCsv(outputText));
    setIsExporting(null);
  };

  const handleExportXlsx = async () => {
    if (!outputText || isExporting) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExporting('xlsx');
    await runShareAction(() => exportResultAsXlsx(outputText));
    setIsExporting(null);
  };

  const canProcess = extractedText.trim().length > 0 && !isProcessing;
  const isTableResult = lastProcessedMode === 'table';
  const metrics = computeMetrics(extractedText);
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
              <Text style={s.headerTitle}>Documenti & OCR</Text>
              <Text style={s.headerSubtitle}>Importa PDF, TXT o scansiona una foto</Text>
            </View>
          </View>

          <View style={s.optionGrid}>
            <Pressable
              style={({ pressed }) => [
                s.optionCard,
                styles.sourceCard,
                pressed && s.actionChipPressed,
                isDocumentLoading && s.optionSelected,
              ]}
              onPress={handleDocumentPress}
              disabled={isDocumentLoading}
            >
              {isDocumentLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <FileText color={colors.glow} size={26} />
              )}
              <Text style={styles.sourceLabel}>Documento</Text>
              <Text style={styles.sourceHint}>PDF · TXT</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                s.optionCard,
                styles.sourceCard,
                pressed && s.actionChipPressed,
                isScanning && s.optionSelected,
              ]}
              onPress={handleCameraPress}
              disabled={isScanning}
            >
              {isScanning ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Camera color={colors.glow} size={26} />
              )}
              <Text style={styles.sourceLabel}>Fotocamera</Text>
              <Text style={styles.sourceHint}>Scansione OCR</Text>
            </Pressable>
          </View>

          {scanPages.length > 0 && (
            <Card style={s.section}>
              <View style={styles.scanHeaderRow}>
                <View style={styles.scanHeaderTitle}>
                  <Layers color={colors.glow} size={16} />
                  <Text style={s.sectionLabel}>
                    Scansione · {scanPages.length} {scanPages.length > 1 ? 'pagine' : 'pagina'}
                  </Text>
                </View>
                <Pressable hitSlop={8} onPress={handleClearScanPages} disabled={isExtractingPages}>
                  <Text style={styles.scanClearLabel}>Annulla</Text>
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pageRow}>
                {scanPages.map((page, index) => (
                  <View key={page.id} style={styles.pageThumbWrapper}>
                    <Image source={{ uri: page.uri }} style={styles.pageThumb} />
                    <View style={styles.pageBadge}>
                      <Text style={styles.pageBadgeLabel}>{index + 1}</Text>
                    </View>
                    <Pressable
                      style={styles.pageDeleteButton}
                      onPress={() => handleRemoveScanPage(page.id)}
                      disabled={isExtractingPages}
                      hitSlop={6}
                    >
                      <X color={colors.textOnPrimary} size={12} />
                    </Pressable>
                    <View style={styles.pageReorderRow}>
                      <Pressable
                        style={[styles.pageReorderButton, index === 0 && styles.pageReorderButtonDisabled]}
                        onPress={() => handleMoveScanPage(index, -1)}
                        disabled={index === 0 || isExtractingPages}
                        hitSlop={6}
                      >
                        <ChevronLeft
                          color={index === 0 ? colors.textMuted : colors.text}
                          size={14}
                        />
                      </Pressable>
                      <Pressable
                        style={[
                          styles.pageReorderButton,
                          index === scanPages.length - 1 && styles.pageReorderButtonDisabled,
                        ]}
                        onPress={() => handleMoveScanPage(index, 1)}
                        disabled={index === scanPages.length - 1 || isExtractingPages}
                        hitSlop={6}
                      >
                        <ChevronRight
                          color={index === scanPages.length - 1 ? colors.textMuted : colors.text}
                          size={14}
                        />
                      </Pressable>
                    </View>
                  </View>
                ))}
                <Pressable
                  style={({ pressed }) => [styles.addPageButton, pressed && styles.addPageButtonPressed]}
                  onPress={handleCameraPress}
                  disabled={isScanning || isExtractingPages}
                >
                  {isScanning ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <Plus color={colors.text} size={22} />
                  )}
                </Pressable>
              </ScrollView>

              <Pressable
                style={({ pressed }) => [
                  s.primaryFilledButton,
                  (isExtractingPages || pressed) && s.primaryFilledButtonPressed,
                ]}
                onPress={handleExtractScanPages}
                disabled={isExtractingPages}
              >
                {isExtractingPages ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Scan color={colors.textOnPrimary} size={18} />
                )}
                <Text style={s.primaryFilledButtonLabel}>
                  {isExtractingPages
                    ? 'Estrazione testo...'
                    : `Estrai testo da ${scanPages.length} ${scanPages.length > 1 ? 'pagine' : 'pagina'}`}
                </Text>
              </Pressable>
            </Card>
          )}

          <Card style={s.section}>
            <View style={s.header}>
              <Text style={s.sectionLabel}>Testo estratto</Text>
              <View style={s.headerActions}>
                <Pressable
                  style={({ pressed }) => [s.iconButton, pressed && s.iconButtonPressed]}
                  onPress={() => setIsWebLinkModalVisible(true)}
                >
                  <Link2 color={colors.glow} size={18} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.iconButton, pressed && s.iconButtonPressed]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setExtractedText('');
                    setErrorMessage('');
                  }}
                >
                  <Trash2 color={colors.textMuted} size={18} />
                </Pressable>
              </View>
            </View>
            <TextInput
              value={extractedText}
              onChangeText={setExtractedText}
              placeholder="Il testo importato apparirà qui, modificabile prima della rielaborazione..."
              placeholderTextColor={colors.textMuted}
              multiline
              style={s.textArea}
            />
            <Text style={s.metricsText}>{formatMetrics(metrics)}</Text>
          </Card>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Modalità</Text>
            <View style={s.segmentedControl}>
              {TONE_OPTIONS.map(({ id, icon: Icon }) => {
                const isSelected = selectedTone === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => handleToneSelect(id)}
                    style={[s.segmentedOption, isSelected && s.segmentedOptionActive]}
                  >
                    <Icon color={isSelected ? colors.text : colors.textMuted} size={14} />
                    <Text style={[s.segmentedLabel, isSelected && s.segmentedLabelActive]}>
                      {id === 'table' ? 'Tabelle' : MODE_LABELS[id]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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

            {outputText && !isProcessing ? (
              <RefineBar
                onRefine={refineResult}
                onUndo={undoRefine}
                canUndo={canUndoRefine}
                isRefining={isRefining}
              />
            ) : null}
          </Card>
          <View style={styles.tabBarSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast message={toastMessage} visible={Boolean(toastMessage)} />
      <ExportSheet
        visible={isExportSheetVisible}
        onClose={() => setIsExportSheetVisible(false)}
        header={({ runAfterDismiss }) => (
          <View style={styles.sheetHeader}>
            <View style={s.chipRow}>
              <Pressable
                style={({ pressed }) => [styles.signatureToggle, pressed && styles.signatureTogglePressed]}
                onPress={() => handleToggleIncludeSignature(runAfterDismiss)}
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
                onPress={() => runAfterDismiss(() => setIsSignatureModalVisible(true))}
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
        )}
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

      <CropModal request={cropRequest} onConfirm={confirmCrop} onCancel={cancelCrop} />
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
  scanHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scanHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  scanClearLabel: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  pageRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pageThumbWrapper: {
    width: 84,
    gap: spacing.xs,
  },
  pageThumb: {
    width: 84,
    height: 112,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    ...glassBorder,
  },
  pageBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    backgroundColor: colors.glow,
    borderRadius: radius.pill,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  pageBadgeLabel: {
    color: colors.textOnPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  pageDeleteButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageReorderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pageReorderButton: {
    width: 32,
    height: 24,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    ...glassBorder,
  },
  pageReorderButtonDisabled: {
    opacity: 0.4,
  },
  addPageButton: {
    width: 84,
    height: 112,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  addPageButtonPressed: {
    backgroundColor: colors.surfaceElevated,
  },
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
