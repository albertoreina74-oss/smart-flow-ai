import React, { useState } from 'react';
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
  Copy,
  FileDown,
  FileText,
  ListChecks,
  Share2,
  Sparkles,
  Star,
  TriangleAlert,
  Volume2,
  VolumeX,
  WandSparkles,
} from 'lucide-react-native';
import { Card } from '../components/Card';
import { Toast } from '../components/Toast';
import { colors, gradient, spacing } from '../constants/theme';
import { screenStyles as s } from '../constants/sharedStyles';
import { DENSITY_LABELS, Density, MODE_LABELS, NonTranslateMode } from '../constants/prompts';
import {
  extractTextFromDocument,
  extractTextFromImage,
  getFriendlyErrorMessage,
} from '../services/geminiService';
import { writeClipboard } from '../services/clipboardService';
import { pickImageFromCamera, pickImageFromLibrary } from '../services/imagePickerService';
import { pickDocument } from '../services/documentService';
import { exportResultAsMarkdown, exportResultAsPdf } from '../services/exportService';
import { useGeminiProcessing } from '../hooks/useGeminiProcessing';
import { computeMetrics, formatMetrics } from '../utils/textMetrics';

const TONE_OPTIONS: { id: NonTranslateMode; icon: typeof WandSparkles }[] = [
  { id: 'clean', icon: WandSparkles },
  { id: 'formal', icon: Briefcase },
  { id: 'summary', icon: ListChecks },
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isExporting, setIsExporting] = useState<'pdf' | 'markdown' | null>(null);
  const [toastMessage, setToastMessage] = useState('');

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

  const runImageScan = async (source: 'camera' | 'library') => {
    setIsScanning(true);
    setErrorMessage('');
    try {
      const image = source === 'camera' ? await pickImageFromCamera() : await pickImageFromLibrary();
      if (!image) {
        return;
      }
      const text = await extractTextFromImage(image.base64, image.mimeType);
      setExtractedText(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsScanning(false);
    }
  };

  const handleCameraPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Scansiona testo', "Scegli la sorgente dell'immagine", [
      { text: 'Scatta foto', onPress: () => runImageScan('camera') },
      { text: 'Scegli dalla libreria', onPress: () => runImageScan('library') },
      { text: 'Annulla', style: 'cancel' },
    ]);
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
    runProcessing(extractedText, selectedTone, selectedDensity, 'it', MODE_LABELS[selectedTone]);
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
      language: 'it-IT',
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

  const canProcess = extractedText.trim().length > 0 && !isProcessing;
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

          <Card style={s.section}>
            <Text style={s.sectionLabel}>Testo estratto</Text>
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
            <View style={s.optionGrid}>
              {TONE_OPTIONS.map(({ id, icon: Icon }) => {
                const isSelected = selectedTone === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => handleToneSelect(id)}
                    style={[s.optionCard, isSelected && s.optionSelected]}
                  >
                    <Icon color={isSelected ? colors.text : colors.textMuted} size={18} />
                    <Text style={[s.optionLabel, isSelected && s.optionLabelSelected]}>
                      {MODE_LABELS[id]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Densità</Text>
            <View style={s.optionGrid}>
              {DENSITY_OPTIONS.map((density) => {
                const isSelected = selectedDensity === density;
                return (
                  <Pressable
                    key={density}
                    onPress={() => handleDensitySelect(density)}
                    style={[s.optionCard, isSelected && s.optionSelected]}
                  >
                    <Text style={[s.optionLabel, isSelected && s.optionLabelSelected]}>
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
                <Text style={outputText ? s.outputText : s.outputPlaceholder}>
                  {outputText || 'Il testo rielaborato apparirà qui.'}
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
  tabBarSpacer: {
    height: 96,
  },
});
